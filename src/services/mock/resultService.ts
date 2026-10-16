import { EvaluationResult, ReviewCycle } from '../../types'
import { cycleService } from './cycleService'
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

    // Strictly check if cycle is released or closed
    const isReleased = cycle.stage === 'released' || cycle.stage === 'closed'

    if (!isReleased) {
      return {
        isReleased: false,
        cycle,
        result: null,
      }
    }

    const result = storageService
      .getState()
      .results.find((r) => r.employeeId === userId && r.cycleId === cycleId)

    if (!result) {
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
        const r = results.find((res) => res.employeeId === userId && res.cycleId === c.id)
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
      const results = state.results.map((r) => {
        if (r.id === resultId) {
          updated = {
            ...r,
            acknowledged: true,
            acknowledgedAt: new Date().toISOString(),
          }
          return updated
        }
        return r
      })

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: state.users.find((u) => u.id === state.currentUserId)?.name || 'Employee',
        action: 'RESULT_ACKNOWLEDGED',
        entity: 'EvaluationResult',
        entityId: resultId,
        timestamp: new Date().toISOString(),
        details: 'Employee formally acknowledged receipt of performance evaluation outcome.',
      }

      return {
        results,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    if (!updated) throw new Error(`Result ${resultId} not found`)
    return updated
  },

  async dispute(resultId: string, reason: string): Promise<EvaluationResult> {
    if (!reason || reason.trim().length < 10) {
      throw new Error('Please provide an explicit rationale for the dispute (at least 10 characters).')
    }

    let updated: EvaluationResult | null = null
    storageService.updateState((state) => {
      const results = state.results.map((r) => {
        if (r.id === resultId) {
          updated = {
            ...r,
            disputeStatus: 'disputed' as const,
            disputeReason: reason,
            disputeSubmittedAt: new Date().toISOString(),
          }
          return updated
        }
        return r
      })

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: state.users.find((u) => u.id === state.currentUserId)?.name || 'Employee',
        action: 'RESULT_DISPUTED',
        entity: 'EvaluationResult',
        entityId: resultId,
        timestamp: new Date().toISOString(),
        details: `Employee submitted formal dispute inquiry. Reason: "${reason}".`,
      }

      return {
        results,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    if (!updated) throw new Error(`Result ${resultId} not found`)
    return updated
  },

  async getAllResults(cycleId: string): Promise<EvaluationResult[]> {
    return storageService.getState().results.filter((r) => r.cycleId === cycleId)
  },
}

