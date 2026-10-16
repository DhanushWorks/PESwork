import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { Goal, GoalStatus } from '../../types'
import { goalService as mockGoalService } from '../mock/goalService'

export const supabaseGoalService = {
  async listForUser(userId: string, cycleId?: string): Promise<Goal[]> {
    if (!isSupabaseConfigured) return mockGoalService.listForUser(userId, cycleId)

    let query = supabase.from('goals').select('*').eq('user_id', userId)
    if (cycleId) {
      query = query.eq('cycle_id', cycleId)
    }

    const { data, error } = await query
    if (error || !data || data.length === 0) {
      return mockGoalService.listForUser(userId, cycleId)
    }

    return data.map((g) => ({
      id: g.id,
      userId: g.user_id,
      cycleId: g.cycle_id,
      title: g.title,
      description: g.description || '',
      metric: g.metric,
      target: Number(g.target),
      current: Number(g.progress),
      unit: g.unit,
      weight: Number(g.weight),
      progress: Number(g.progress),
      dueDate: g.due_date,
      status: g.status as GoalStatus,
      returnReason: g.rejection_reason,
      progressHistory: [],
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }))
  },

  async getById(goalId: string): Promise<Goal | null> {
    if (!isSupabaseConfigured) return mockGoalService.getById(goalId)

    const { data, error } = await supabase.from('goals').select('*').eq('id', goalId).single()
    if (error || !data) {
      return mockGoalService.getById(goalId)
    }

    return {
      id: data.id,
      userId: data.user_id,
      cycleId: data.cycle_id,
      title: data.title,
      description: data.description || '',
      metric: data.metric,
      target: Number(data.target),
      current: Number(data.progress),
      unit: data.unit,
      weight: Number(data.weight),
      progress: Number(data.progress),
      dueDate: data.due_date,
      status: data.status as GoalStatus,
      returnReason: data.rejection_reason,
      progressHistory: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async save(goalData: Partial<Goal> & { userId: string; cycleId: string; title: string }): Promise<Goal> {
    if (!isSupabaseConfigured) return mockGoalService.save(goalData)

    const payload: any = {
      user_id: goalData.userId,
      cycle_id: goalData.cycleId,
      title: goalData.title,
      description: goalData.description || '',
      metric: goalData.metric || 'Completion',
      target: Number(goalData.target) || 100,
      unit: goalData.unit || '%',
      weight: Number(goalData.weight) || 20,
      due_date: goalData.dueDate || new Date().toISOString().split('T')[0],
      status: goalData.status || 'draft',
      progress: Number(goalData.progress) || 0,
    }

    if (goalData.id) {
      payload.id = goalData.id
    }

    const { data, error } = await supabase.from('goals').upsert(payload).select().single()
    if (error || !data) {
      return mockGoalService.save(goalData)
    }

    return {
      id: data.id,
      userId: data.user_id,
      cycleId: data.cycle_id,
      title: data.title,
      description: data.description || '',
      metric: data.metric,
      target: Number(data.target),
      current: Number(data.progress),
      unit: data.unit,
      weight: Number(data.weight),
      progress: Number(data.progress),
      dueDate: data.due_date,
      status: data.status as GoalStatus,
      returnReason: data.rejection_reason,
      progressHistory: [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async delete(goalId: string): Promise<boolean> {
    if (isSupabaseConfigured) {
      await supabase.from('goals').delete().eq('id', goalId)
    }
    return mockGoalService.delete(goalId)
  },

  async submitGoalsForApproval(userId: string, cycleId: string): Promise<{ success: boolean; errors?: string[] }> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('submit_goals', { p_cycle_id: cycleId })
      if (!error) {
        return { success: true }
      }
      console.warn('RPC submit_goals notice:', error.message)
      return { success: false, errors: [error.message] }
    }
    return mockGoalService.submitGoalsForApproval(userId, cycleId)
  },

  async decide(goalId: string, decision: 'approved' | 'returned', reason?: string): Promise<Goal> {
    if (isSupabaseConfigured) {
      await supabase.from('goals').update({
        status: decision,
        rejection_reason: reason,
        approved_at: decision === 'approved' ? new Date().toISOString() : null,
      }).eq('id', goalId)
    }
    return mockGoalService.decide(goalId, decision, reason)
  },

  async addProgress(
    goalId: string,
    percentage: number,
    note: string,
    evidenceFileName?: string
  ): Promise<Goal> {
    if (isSupabaseConfigured) {
      await supabase.from('goal_updates').insert({
        goal_id: goalId,
        progress: percentage,
        note,
        evidence_url: evidenceFileName,
      })
      await supabase.from('goals').update({ progress: percentage }).eq('id', goalId)
    }
    return mockGoalService.addProgress(goalId, percentage, note, evidenceFileName)
  },
}
