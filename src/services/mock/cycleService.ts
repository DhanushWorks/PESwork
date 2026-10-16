import { CycleStage, ReviewCycle } from '../../types'
import { STAGE_ORDER } from '../../lib/formatters'
import { storageService } from './storageService'

export const cycleService = {
  async list(): Promise<ReviewCycle[]> {
    return [...storageService.getState().cycles]
  },

  async getById(id: string): Promise<ReviewCycle | null> {
    const cycle = storageService.getState().cycles.find((c) => c.id === id)
    return cycle ? { ...cycle } : null
  },

  async getActiveCycle(): Promise<ReviewCycle> {
    const { cycles, activeCycleId } = storageService.getState()
    const active = cycles.find((c) => c.id === activeCycleId) || cycles[0]
    return { ...active }
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
        if (c.id === cycleId) {
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

    return updatedCycle!
  },

  async setStage(cycleId: string, stage: CycleStage): Promise<ReviewCycle> {
    let updatedCycle: ReviewCycle | null = null
    storageService.updateState((state) => {
      const cycles = state.cycles.map((c) => {
        if (c.id === cycleId) {
          updatedCycle = { ...c, stage }
          return updatedCycle
        }
        return c
      })
      return { cycles }
    })
    return updatedCycle!
  },

  async create(cycleData: Omit<ReviewCycle, 'id'>): Promise<ReviewCycle> {
    const newCycle: ReviewCycle = {
      ...cycleData,
      id: `cycle-${Date.now()}`,
    }
    storageService.updateState((state) => ({
      cycles: [...state.cycles, newCycle],
      activeCycleId: newCycle.id,
    }))
    return newCycle
  },

  async update(id: string, updates: Partial<ReviewCycle>): Promise<ReviewCycle> {
    let updated: ReviewCycle | null = null
    storageService.updateState((state) => {
      const cycles = state.cycles.map((c) => {
        if (c.id === id) {
          updated = { ...c, ...updates }
          return updated
        }
        return c
      })
      return { cycles }
    })
    return updated!
  },
}

