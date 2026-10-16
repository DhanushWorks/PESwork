import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { CalibrationRecord } from '../../types'
import { calibrationService as mockCalibrationService, CalibrationItem } from '../mock/calibrationService'

export const supabaseCalibrationService = {
  async listForCycle(cycleId: string): Promise<CalibrationItem[]> {
    return mockCalibrationService.listForCycle(cycleId)
  },

  async calibrate(
    cycleId: string,
    employeeId: string,
    adjustedScore: number,
    reason: string,
    calibratedBy: string
  ): Promise<CalibrationRecord> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('calibrate_review', {
        p_cycle_id: cycleId,
        p_user_id: employeeId,
        p_score: adjustedScore,
        p_reason: reason,
      })

      if (error) {
        console.warn('RPC calibrate_review notice:', error.message)
      }
    }

    return mockCalibrationService.calibrate(cycleId, employeeId, adjustedScore, reason, calibratedBy)
  },

  async releaseCycle(cycleId: string): Promise<{ releasedCount: number }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('release_cycle', {
        p_cycle_id: cycleId,
      })

      if (error) {
        console.warn('RPC release_cycle notice:', error.message)
      } else if (data?.released_results_count !== undefined) {
        await mockCalibrationService.releaseCycle(cycleId)
        return { releasedCount: data.released_results_count }
      }
    }

    return mockCalibrationService.releaseCycle(cycleId)
  },
}

