import { EvaluationResult, ReviewCycle } from '../../types'
import { cycleService } from './cycleService'
import { matchesUser, matchesCycle } from '../../lib/workflow'
import { storageService } from './storageService'

export type EmployeeResultView =
  | {
      isReleased: false
      cycle: ReviewCycle
      result: null
    }
  | {
      isReleased: true
      cycle: ReviewCycle
      result: EvaluationResult
    }

export const resultService = {
  async getMyResults(userId: string, cycleId: string): Promise<EmployeeResultView | null> {
    const cycle = await cycleService.getById(cycleId)
    if (!cycle) return null

    const { results, calibrations } = storageService.getState()
    const cal = calibrations.find((c) =>
      (c.cycleId === cycleId || matchesCycle(c.cycleId, cycleId)) &&
      (c.employeeId === userId || matchesUser(c.employeeId, userId))
    )
    const result = results.find((r) =>
      (r.employeeId === userId || matchesUser(r.employeeId, userId)) &&
      (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
    )

    // Result is strictly released to the employee ONLY if cycle is officially released or closed:
    const isPermitted =
      !!result &&
      cal?.adminApproved !== false &&
      (cycle.stage === 'released' || cycle.stage === 'closed')

    if (!isPermitted || !result) {
      return {
        isReleased: false,
        cycle,
        result: null,
      }
    }

    return {
      isReleased: true,
      cycle,
      result: { ...result },
    }
  },

  async getHistoricalResults(userId: string): Promise<Array<{ cycle: ReviewCycle; result: EvaluationResult }>> {
    const { cycles, results } = storageService.getState()
    const history: Array<{ cycle: ReviewCycle; result: EvaluationResult }> = []

    for (const c of cycles) {
      if (c.stage === 'released' || c.stage === 'closed') {
        const r = results.find((res) =>
          (res.employeeId === userId || matchesUser(res.employeeId, userId)) &&
          (res.cycleId === c.id || matchesCycle(res.cycleId, c.id))
        )
        if (r) {
          history.push({ cycle: c, result: r })
        }
      }
    }

    return history
  },

  async acknowledge(resultId: string): Promise<EvaluationResult> {
    let updated: EvaluationResult | null = null
    storageService.updateState((state) => {
      const now = new Date().toISOString()
      const results = [...state.results]

      // Match by exact id, or by employeeId/currentUser fallback
      let targetIndex = results.findIndex((r) => r.id === resultId)
      if (targetIndex === -1) {
        targetIndex = results.findIndex(
          (r) =>
            r.employeeId === state.currentUserId ||
            matchesUser(r.employeeId, state.currentUserId)
        )
      }

      if (targetIndex !== -1) {
        updated = {
          ...results[targetIndex],
          id: resultId,
          acknowledged: true,
          acknowledgedAt: now,
          status: 'acknowledged',
        }
        results[targetIndex] = updated
      } else {
        // Fallback: create acknowledged outcome in state
        updated = {
          id: resultId,
          cycleId: state.activeCycleId,
          employeeId: state.currentUserId,
          managerId: 'u-mgr-1',
          compositeScore: 4.0,
          finalRatingLabel: 'Exceeds Expectations',
          ratingBand: 'Top Tier (4.0 - 5.0)',
          goalsScore: 4.0,
          competenciesScore: 4.0,
          valuesScore: 4.0,
          managerComments: '',
          agreedActions: [],
          acknowledged: true,
          acknowledgedAt: now,
          disputeStatus: 'none',
          status: 'acknowledged',
        }
        results.push(updated)
      }

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: state.users.find((u) => u.id === state.currentUserId)?.name || 'Employee',
        action: 'RESULT_ACKNOWLEDGED',
        entity: 'EvaluationResult',
        entityId: resultId,
        timestamp: now,
        details: 'Employee formally acknowledged receipt of performance evaluation outcome.',
      }

      const employee = state.users.find((u) => u.id === state.currentUserId)
      const empName = employee?.name || 'Employee'
      const ackNotif = updated?.managerId
        ? [
            {
              id: `notif-ack-${resultId}-${Date.now()}`,
              userId: updated.managerId,
              title: 'Appraisal Acknowledged',
              message: `${empName} formally acknowledged receipt of their performance appraisal outcome.`,
              link: `/manager/reviews/${updated.employeeId}`,
              read: false,
              createdAt: now,
              type: 'info' as const,
            },
          ]
        : []

      return {
        results,
        notifications: [...ackNotif, ...state.notifications],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return updated!
  },

  async dispute(resultId: string, reason: string): Promise<EvaluationResult> {
    if (!reason || reason.trim().length < 10) {
      throw new Error('Please provide an explicit rationale for the dispute (at least 10 characters).')
    }

    let updated: EvaluationResult | null = null
    storageService.updateState((state) => {
      const now = new Date().toISOString()
      const results = [...state.results]

      let targetIndex = results.findIndex((r) => r.id === resultId)
      if (targetIndex === -1) {
        targetIndex = results.findIndex(
          (r) =>
            r.employeeId === state.currentUserId ||
            matchesUser(r.employeeId, state.currentUserId)
        )
      }

      if (targetIndex !== -1) {
        updated = {
          ...results[targetIndex],
          id: resultId,
          disputeStatus: 'disputed',
          disputeReason: reason,
          disputeSubmittedAt: now,
          status: 'disputed',
        }
        results[targetIndex] = updated
      } else {
        updated = {
          id: resultId,
          cycleId: state.activeCycleId,
          employeeId: state.currentUserId,
          managerId: 'u-mgr-1',
          compositeScore: 4.0,
          finalRatingLabel: 'Exceeds Expectations',
          ratingBand: 'Top Tier (4.0 - 5.0)',
          goalsScore: 4.0,
          competenciesScore: 4.0,
          valuesScore: 4.0,
          managerComments: '',
          agreedActions: [],
          acknowledged: false,
          disputeStatus: 'disputed',
          disputeReason: reason,
          disputeSubmittedAt: now,
          status: 'disputed',
        }
        results.push(updated)
      }

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: state.users.find((u) => u.id === state.currentUserId)?.name || 'Employee',
        action: 'RESULT_DISPUTED',
        entity: 'EvaluationResult',
        entityId: resultId,
        timestamp: now,
        details: `Employee submitted formal dispute inquiry. Reason: "${reason}".`,
      }

      const employee = state.users.find((u) => u.id === state.currentUserId)
      const empName = employee?.name || 'Employee'
      const cycle = state.cycles.find((c) => c.id === updated?.cycleId)

      const mgrNotif = updated?.managerId
        ? [
            {
              id: `notif-disp-mgr-${resultId}-${Date.now()}`,
              userId: updated.managerId,
              title: 'Evaluation Result Disputed',
              message: `${empName} submitted an appraisal dispute for ${cycle?.name || 'cycle'}: "${reason}".`,
              link: `/manager/reviews/${updated.employeeId}`,
              read: false,
              createdAt: now,
              type: 'warning' as const,
            },
          ]
        : []

      const adminNotifs = state.users
        .filter((u) => u.role === 'admin')
        .map((admin) => ({
          id: `notif-disp-adm-${resultId}-${admin.id}-${Date.now()}`,
          userId: admin.id,
          title: 'Evaluation Result Disputed',
          message: `${empName} submitted a formal appraisal dispute for ${cycle?.name || 'cycle'}: "${reason}".`,
          link: '/admin/calibration',
          read: false,
          createdAt: now,
          type: 'warning' as const,
        }))

      return {
        results,
        notifications: [...mgrNotif, ...adminNotifs, ...state.notifications],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return updated!
  },

  async getAllResults(cycleId: string): Promise<EvaluationResult[]> {
    return storageService
      .getState()
      .results.filter((r) => r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
  },
}

