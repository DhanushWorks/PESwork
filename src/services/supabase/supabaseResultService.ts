import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { EvaluationResult, ReviewCycle } from '../../types'
import { resultService as mockResultService, EmployeeResultView } from '../mock/resultService'
import { supabaseCycleService as cycleService } from './supabaseCycleService'
import { getRatingBand } from '../../lib/scoring'
import { supabaseNotificationService as notificationService } from './supabaseNotificationService'

export type { EmployeeResultView }

export const supabaseResultService = {
  /**
   * Fetch evaluation result for the authenticated employee with privacy barrier
   */
  async getMyResults(userId: string, cycleId: string): Promise<EmployeeResultView | null> {
    if (!isSupabaseConfigured) return mockResultService.getMyResults(userId, cycleId)

    try {
      const cycle = await cycleService.getById(cycleId)
      if (!cycle) return mockResultService.getMyResults(userId, cycleId)

      // Query public.final_results
      const { data: resultData, error: resultErr } = await supabase
        .from('final_results')
        .select('*')
        .eq('user_id', userId)
        .eq('cycle_id', cycleId)
        .maybeSingle()

      if (resultErr || !resultData) {
        return mockResultService.getMyResults(userId, cycleId)
      }

      // Check if officially released
      const isCycleReleased = cycle.stage === 'released' || cycle.stage === 'closed'
      const isRowReleased = resultData.status !== 'pending'

      if (!isCycleReleased && !isRowReleased) {
        return {
          isReleased: false,
          cycle,
          result: null,
        }
      }

      // Fetch manager review to extract scores & comments
      const { data: mrData } = await supabase
        .from('manager_reviews')
        .select('*')
        .eq('user_id', userId)
        .eq('cycle_id', cycleId)
        .maybeSingle()

      const compValues = mrData?.component_values || resultData.components || {}
      const finalScore = Number(resultData.final_score || mrData?.overall_rating || 3.0)
      const bandInfo = getRatingBand(finalScore)

      const result: EvaluationResult = {
        id: resultData.id,
        cycleId: resultData.cycle_id,
        employeeId: resultData.user_id,
        managerId: mrData?.reviewer_id || '',
        compositeScore: finalScore,
        finalRatingLabel: resultData.rating_label || bandInfo.label,
        ratingBand: bandInfo.band,
        goalsScore: Number(compValues.goalsScore || 3.0),
        competenciesScore: Number(compValues.competenciesScore || 3.0),
        valuesScore: Number(compValues.valuesScore || 3.0),
        managerComments: mrData?.comments || '',
        agreedActions: [],
        acknowledged: resultData.status === 'acknowledged',
        acknowledgedAt: resultData.acknowledged_at || undefined,
        disputeStatus: resultData.status === 'disputed' ? 'disputed' : 'none',
        disputeReason: resultData.dispute_reason || undefined,
        disputeSubmittedAt: resultData.disputed_at || undefined,
      }

      return {
        isReleased: true,
        cycle,
        result,
      }
    } catch (err) {
      console.warn('Notice in supabaseResultService.getMyResults:', err)
      return mockResultService.getMyResults(userId, cycleId)
    }
  },

  /**
   * Fetch past completed / released cycle outcomes
   */
  async getHistoricalResults(userId: string): Promise<Array<{ cycle: ReviewCycle; result: EvaluationResult }>> {
    if (!isSupabaseConfigured) return mockResultService.getHistoricalResults(userId)

    try {
      const { data: resultsData, error } = await supabase
        .from('final_results')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'pending')

      if (error || !resultsData || resultsData.length === 0) {
        return mockResultService.getHistoricalResults(userId)
      }

      const allCycles: ReviewCycle[] = await cycleService.list()
      const cycleMap = new Map<string, ReviewCycle>(allCycles.map((c: ReviewCycle) => [c.id, c]))

      const history: Array<{ cycle: ReviewCycle; result: EvaluationResult }> = []

      for (const row of resultsData) {
        const cycle = cycleMap.get(row.cycle_id)
        if (!cycle) continue

        const finalScore = Number(row.final_score || 3.0)
        const bandInfo = getRatingBand(finalScore)
        const comp = row.components || {}

        const result: EvaluationResult = {
          id: row.id,
          cycleId: row.cycle_id,
          employeeId: row.user_id,
          managerId: '',
          compositeScore: finalScore,
          finalRatingLabel: row.rating_label || bandInfo.label,
          ratingBand: bandInfo.band,
          goalsScore: Number(comp.goalsScore || finalScore),
          competenciesScore: Number(comp.competenciesScore || finalScore),
          valuesScore: Number(comp.valuesScore || finalScore),
          managerComments: '',
          agreedActions: [],
          acknowledged: row.status === 'acknowledged',
          acknowledgedAt: row.acknowledged_at || undefined,
          disputeStatus: row.status === 'disputed' ? 'disputed' : 'none',
          disputeReason: row.dispute_reason || undefined,
          disputeSubmittedAt: row.disputed_at || undefined,
        }

        history.push({ cycle, result })
      }

      return history
    } catch (err) {
      console.warn('Notice in getHistoricalResults:', err)
      return mockResultService.getHistoricalResults(userId)
    }
  },

  /**
   * Formal employee acknowledgement of released review
   */
  async acknowledge(resultId: string): Promise<EvaluationResult> {
    const mockRes = await mockResultService.acknowledge(resultId)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('acknowledge_result', {
          p_result_id: resultId,
        })

        if (error) {
          // Direct table update fallback
          await supabase
            .from('final_results')
            .update({
              status: 'acknowledged',
              acknowledged_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', resultId)
        }
      } catch (e) {
        console.warn('Notice in supabase acknowledge:', e)
      }
    }

    return mockRes
  },

  /**
   * Formal employee inquiry / dispute of released evaluation
   */
  async dispute(resultId: string, reason: string): Promise<EvaluationResult> {
    const mockRes = await mockResultService.dispute(resultId, reason)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.rpc('dispute_result', {
          p_result_id: resultId,
          p_reason: reason,
        })

        if (error) {
          // Direct table update fallback
          await supabase
            .from('final_results')
            .update({
              status: 'disputed',
              dispute_reason: reason,
              disputed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', resultId)
        }

        // Notify Admins
        const allUsers = await supabase.from('profiles').select('id, role').eq('role', 'admin')
        if (allUsers.data) {
          for (const admin of allUsers.data) {
            await notificationService.create({
              userId: admin.id,
              title: 'Evaluation Result Disputed',
              message: `A team member submitted a formal inquiry regarding their published appraisal.`,
              link: '/admin/calibration',
              type: 'warning',
            })
          }
        }
      } catch (e) {
        console.warn('Notice in supabase dispute:', e)
      }
    }

    return mockRes
  },

  /**
   * Retrieve all evaluation results for a cycle
   */
  async getAllResults(cycleId: string): Promise<EvaluationResult[]> {
    if (!isSupabaseConfigured) return mockResultService.getAllResults(cycleId)

    try {
      const { data, error } = await supabase
        .from('final_results')
        .select('*')
        .eq('cycle_id', cycleId)

      if (error || !data || data.length === 0) {
        return mockResultService.getAllResults(cycleId)
      }

      return data.map((row) => {
        const finalScore = Number(row.final_score || 3.0)
        const bandInfo = getRatingBand(finalScore)
        const comp = row.components || {}

        return {
          id: row.id,
          cycleId: row.cycle_id,
          employeeId: row.user_id,
          managerId: '',
          compositeScore: finalScore,
          finalRatingLabel: row.rating_label || bandInfo.label,
          ratingBand: bandInfo.band,
          goalsScore: Number(comp.goalsScore || finalScore),
          competenciesScore: Number(comp.competenciesScore || finalScore),
          valuesScore: Number(comp.valuesScore || finalScore),
          managerComments: '',
          agreedActions: [],
          acknowledged: row.status === 'acknowledged',
          acknowledgedAt: row.acknowledged_at || undefined,
          disputeStatus: row.status === 'disputed' ? 'disputed' : 'none',
          disputeReason: row.dispute_reason || undefined,
          disputeSubmittedAt: row.disputed_at || undefined,
        }
      })
    } catch {
      return mockResultService.getAllResults(cycleId)
    }
  },
}

export { supabaseResultService as resultService }
