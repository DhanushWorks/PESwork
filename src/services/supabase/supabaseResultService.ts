import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { EvaluationResult, ReviewCycle } from '../../types'
import { resultService as mockResultService, EmployeeResultView } from '../mock/resultService'

export const supabaseResultService = {
  async getMyResults(userId: string, cycleId: string): Promise<EmployeeResultView | null> {
    return mockResultService.getMyResults(userId, cycleId)
  },

  async getHistoricalResults(userId: string): Promise<Array<{ cycle: ReviewCycle; result: EvaluationResult }>> {
    return mockResultService.getHistoricalResults(userId)
  },

  async acknowledge(resultId: string): Promise<EvaluationResult> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('acknowledge_result', {
        p_result_id: resultId,
      })
      if (error) {
        console.warn('RPC acknowledge_result notice:', error.message)
      }
    }
    return mockResultService.acknowledge(resultId)
  },

  async dispute(resultId: string, reason: string): Promise<EvaluationResult> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('dispute_result', {
        p_result_id: resultId,
        p_reason: reason,
      })
      if (error) {
        console.warn('RPC dispute_result notice:', error.message)
      }
    }
    return mockResultService.dispute(resultId, reason)
  },

  async getAllResults(cycleId: string): Promise<EvaluationResult[]> {
    return mockResultService.getAllResults(cycleId)
  },
}

