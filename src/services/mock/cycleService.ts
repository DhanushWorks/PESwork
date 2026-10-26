import { CycleStage, ReviewCycle, User } from '../../types'
import { STAGE_ORDER } from '../../lib/formatters'
import { matchesCycle, matchesUser } from '../../lib/workflow'
import { storageService } from './storageService'

export const cycleService = {
  async list(): Promise<ReviewCycle[]> {
    return [...storageService.getState().cycles]
  },

  async getById(id: string): Promise<ReviewCycle | null> {
    const cycle = storageService.getState().cycles.find((c) => c.id === id || matchesCycle(c.id, id))
    return cycle ? { ...cycle } : null
  },

  async getActiveCycle(): Promise<ReviewCycle> {
    const { cycles, activeCycleId } = storageService.getState()
    const targetId = activeCycleId || cycles[0]?.id
    const active = cycles.find((c) => c.id === targetId || matchesCycle(c.id, targetId)) || cycles[0]
    return active ? { ...active } : null as any
  },

  async setActiveCycle(id: string): Promise<ReviewCycle> {
    const target = await this.getById(id)
    if (!target) throw new Error(`Cycle ${id} not found`)
    storageService.updateState(() => ({ activeCycleId: id }))
    return target
  },

  async advanceStage(cycleId: string): Promise<ReviewCycle> {
    const cycle = await this.getById(cycleId)
    if (!cycle) throw new Error(`Cycle ${cycleId} not found`)

    const currentIndex = STAGE_ORDER.indexOf(cycle.stage)
    if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
      throw new Error(`Cycle is already at final stage (${cycle.stage})`)
    }

    const nextStage = STAGE_ORDER[currentIndex + 1]

    let updatedCycle: ReviewCycle | null = null
    storageService.updateState((state) => {
      const cycles = state.cycles.map((c) => {
        if (c.id === cycleId || matchesCycle(c.id, cycleId)) {
          updatedCycle = { ...c, stage: nextStage }
          return updatedCycle
        }
        return c
      })

      // Add audit log
      const newAudit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: state.users.find((u) => u.id === state.currentUserId)?.name || 'Admin',
        action: 'CYCLE_ADVANCED',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Advanced review cycle stage from "${cycle.stage}" to "${nextStage}".`,
      }

      return {
        cycles,
        auditLogs: [newAudit, ...state.auditLogs],
      }
    })

    return updatedCycle || { ...cycle, stage: nextStage }
  },

  async setStage(cycleId: string, stage: CycleStage): Promise<ReviewCycle> {
    let updatedCycle: ReviewCycle | null = null
    storageService.updateState((state) => {
      const cycles = state.cycles.map((c) => {
        if (c.id === cycleId || matchesCycle(c.id, cycleId)) {
          updatedCycle = { ...c, stage }
          return updatedCycle
        }
        return c
      })
      return { cycles, activeCycleId: cycleId }
    })
    return updatedCycle || (await this.getById(cycleId))!
  },

  /**
   * Create a review cycle with explicit deadlines and explicit participant assignment.
   */
  async create(cycleData: Omit<ReviewCycle, 'id'>): Promise<ReviewCycle> {
    const newCycle: ReviewCycle = {
      ...cycleData,
      id: `cycle-${Date.now()}`,
      participantIds: Array.isArray(cycleData.participantIds) ? cycleData.participantIds : [],
    }
    storageService.updateState((state) => ({
      cycles: [...state.cycles, newCycle],
      activeCycleId: newCycle.id,
    }))
    return newCycle
  },

  /**
   * Update review cycle configuration, including deadlines and weights.
   */
  async update(id: string, updates: Partial<ReviewCycle>): Promise<ReviewCycle> {
    let updated: ReviewCycle | null = null
    storageService.updateState((state) => {
      const cycles = state.cycles.map((c) => {
        if (c.id === id) {
          updated = {
            ...c,
            ...updates,
            deadlines: updates.deadlines ? { ...c.deadlines, ...updates.deadlines } : c.deadlines,
            weights: updates.weights ? { ...c.weights, ...updates.weights } : c.weights,
          }
          return updated
        }
        return c
      })
      return { cycles }
    })
    if (!updated) throw new Error(`Cycle ${id} not found`)
    return updated
  },

  /**
   * Get all enrolled participants for a given review cycle.
   * If participantIds is an empty array [], returns empty array (zero participants).
   * Only falls back to all users if participantIds is undefined (legacy unconfigured cycles).
   */
  async getEnrolledParticipants(cycleId: string): Promise<User[]> {
    const cycle = await this.getById(cycleId)
    if (!cycle) return []

    const { users } = storageService.getState()
    if (cycle.participantIds !== undefined && Array.isArray(cycle.participantIds)) {
      return users
        .filter((u) => u.role !== 'admin')
        .filter((u) =>
          cycle.participantIds!.some((pId) => u.id === pId || matchesUser(u.id, pId))
        )
    }

    // Strict: cycles only include explicitly enrolled non-admin participants
    return []
  },

  /**
   * Check if an employee has protected evaluation history in this cycle.
   */
  async checkParticipantEvaluationHistory(cycleId: string, userId: string): Promise<{
    hasSelfReview: boolean
    hasManagerReview: boolean
    hasResult: boolean
    isProtected: boolean
  }> {
    const state = storageService.getState()
    const hasSelfReview = state.selfReviews.some(
      (sr) => sr.cycleId === cycleId && sr.userId === userId && sr.status === 'submitted'
    )
    const hasManagerReview = state.managerReviews.some(
      (mr) => mr.cycleId === cycleId && mr.employeeId === userId && mr.status === 'submitted'
    )
    const hasResult = state.results.some(
      (r) => r.cycleId === cycleId && r.employeeId === userId
    )

    return {
      hasSelfReview,
      hasManagerReview,
      hasResult,
      isProtected: hasSelfReview || hasManagerReview || hasResult,
    }
  },

  /**
   * Remove an employee from this review cycle (Admin only).
   * Removes cycle-participant association.
   * Preserves historical evaluation records for audit integrity if already submitted.
   */
  async removeParticipant(
    cycleId: string,
    userId: string,
    actorName: string = 'Admin',
    purgeEvaluations: boolean = false
  ): Promise<ReviewCycle> {
    const cycle = await this.getById(cycleId)
    if (!cycle) throw new Error(`Review cycle ${cycleId} not found`)

    const { users } = storageService.getState()
    const targetUser = users.find((u) => u.id === userId)

    // Compute updated participantIds
    const currentParticipantIds = cycle.participantIds !== undefined
      ? cycle.participantIds
      : users.map((u) => u.id)

    const updatedParticipantIds = currentParticipantIds.filter(
      (id) => id !== userId && !matchesUser(id, userId)
    )

    let updatedCycle: ReviewCycle = {
      ...cycle,
      participantIds: updatedParticipantIds,
    }

    storageService.updateState((state) => {
      const newCycles = state.cycles.map((c) => (c.id === cycleId ? updatedCycle : c))

      // Only purge if explicitly requested or if no submitted evaluations exist
      let filteredGoals = state.goals
      let filteredSelfReviews = state.selfReviews
      let filteredManagerReviews = state.managerReviews
      let filteredCalibrations = state.calibrations
      let filteredResults = state.results

      if (purgeEvaluations) {
        filteredGoals = state.goals.filter(
          (g) => !(g.cycleId === cycleId && g.userId === userId)
        )
        filteredSelfReviews = state.selfReviews.filter(
          (sr) => !(sr.cycleId === cycleId && sr.userId === userId)
        )
        filteredManagerReviews = state.managerReviews.filter(
          (mr) => !(mr.cycleId === cycleId && mr.employeeId === userId)
        )
        filteredCalibrations = state.calibrations.filter(
          (c) => !(c.cycleId === cycleId && c.employeeId === userId)
        )
        filteredResults = state.results.filter(
          (r) => !(r.cycleId === cycleId && r.employeeId === userId)
        )
      }

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName,
        action: 'PARTICIPANT_REMOVED_FROM_CYCLE',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Admin ${actorName} unenrolled ${targetUser?.name || userId} from review cycle "${cycle.name}" (Evaluation records ${purgeEvaluations ? 'purged' : 'retained'}).`,
      }

      return {
        cycles: newCycles,
        goals: filteredGoals,
        selfReviews: filteredSelfReviews,
        managerReviews: filteredManagerReviews,
        calibrations: filteredCalibrations,
        results: filteredResults,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return updatedCycle
  },

  /**
   * Add an employee into this review cycle (Admin only).
   */
  async addParticipant(cycleId: string, userId: string, actorName: string = 'Admin'): Promise<ReviewCycle> {
    const cycle = await this.getById(cycleId)
    if (!cycle) throw new Error(`Review cycle ${cycleId} not found`)

    const { users } = storageService.getState()
    const targetUser = users.find((u) => u.id === userId)

    const currentParticipantIds = cycle.participantIds !== undefined
      ? cycle.participantIds
      : users.map((u) => u.id)

    if (currentParticipantIds.some((pId) => pId === userId || matchesUser(pId, userId))) {
      return cycle
    }

    const updatedParticipantIds = [...currentParticipantIds, userId]
    const updatedCycle: ReviewCycle = {
      ...cycle,
      participantIds: updatedParticipantIds,
    }

    storageService.updateState((state) => {
      const newCycles = state.cycles.map((c) => (c.id === cycleId ? updatedCycle : c))

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName,
        action: 'PARTICIPANT_ENROLLED_IN_CYCLE',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Admin ${actorName} enrolled ${targetUser?.name || userId} into review cycle "${cycle.name}".`,
      }

      return {
        cycles: newCycles,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return updatedCycle
  },

  /**
   * Bulk assign employees into a review cycle (Admin only).
   */
  async addParticipantsBulk(cycleId: string, userIds: string[], actorName: string = 'Admin'): Promise<ReviewCycle> {
    const cycle = await this.getById(cycleId)
    if (!cycle) throw new Error(`Review cycle ${cycleId} not found`)

    const { users } = storageService.getState()
    const currentParticipantIds = cycle.participantIds !== undefined
      ? cycle.participantIds
      : users.map((u) => u.id)

    const uniqueNewIds = userIds.filter(
      (id) => !currentParticipantIds.some((pId) => pId === id || matchesUser(pId, id))
    )
    if (uniqueNewIds.length === 0) {
      return cycle
    }

    const updatedParticipantIds = [...currentParticipantIds, ...uniqueNewIds]
    const updatedCycle: ReviewCycle = {
      ...cycle,
      participantIds: updatedParticipantIds,
    }

    storageService.updateState((state) => {
      const newCycles = state.cycles.map((c) => (c.id === cycleId ? updatedCycle : c))
      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName,
        action: 'PARTICIPANTS_BULK_ENROLLED',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Admin ${actorName} enrolled ${uniqueNewIds.length} employees into review cycle "${cycle.name}".`,
      }

      return {
        cycles: newCycles,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return updatedCycle
  },

  /**
   * Permanently delete a review cycle (Admin only).
   */
  async delete(cycleId: string, actorName: string = 'Admin'): Promise<void> {
    const state = storageService.getState()
    const remainingCycles = state.cycles.filter((c) => c.id !== cycleId && !matchesCycle(c.id, cycleId))
    const newActiveId =
      (state.activeCycleId === cycleId || matchesCycle(state.activeCycleId, cycleId))
        ? (remainingCycles[0]?.id || '')
        : state.activeCycleId

    storageService.updateState((s) => {
      // Purge all associated cycle data
      const filteredGoals = s.goals.filter((g) => g.cycleId !== cycleId && !matchesCycle(g.cycleId, cycleId))
      const filteredSelfReviews = s.selfReviews.filter((sr) => sr.cycleId !== cycleId && !matchesCycle(sr.cycleId, cycleId))
      const filteredManagerReviews = s.managerReviews.filter((mr) => mr.cycleId !== cycleId && !matchesCycle(mr.cycleId, cycleId))
      const filteredCalibrations = s.calibrations.filter((c) => c.cycleId !== cycleId && !matchesCycle(c.cycleId, cycleId))
      const filteredResults = s.results.filter((r) => r.cycleId !== cycleId && !matchesCycle(r.cycleId, cycleId))

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: s.currentUserId,
        actorName,
        action: 'CYCLE_DELETED',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Deleted review cycle.`,
      }

      return {
        cycles: remainingCycles,
        activeCycleId: newActiveId,
        goals: filteredGoals,
        selfReviews: filteredSelfReviews,
        managerReviews: filteredManagerReviews,
        calibrations: filteredCalibrations,
        results: filteredResults,
        auditLogs: [audit, ...s.auditLogs],
      }
    })
  },
}
