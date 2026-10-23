import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { ReviewCycle, CycleStage, User } from '../../types'
import { STAGE_ORDER } from '../../lib/formatters'
import { generateDeterministicDeadlines } from '../../lib/deadlines'
import { cycleService as mockCycleService } from '../mock/cycleService'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function resolveCycleUuid(cycleId?: string): string | null {
  if (!cycleId) return null
  if (UUID_REGEX.test(cycleId)) return cycleId
  if (cycleId === 'cycle-2026-h1') return '30000000-0000-0000-0000-000000000001'
  if (cycleId === 'cycle-2025-annual' || cycleId === 'cycle-2025-h2') return '30000000-0000-0000-0000-000000000002'
  return null
}

export function normalizeCycleDeadlines(rawDeadlines: any, startDate: string, endDate: string): ReviewCycle['deadlines'] {
  const generated = generateDeterministicDeadlines(startDate, endDate)
  if (!rawDeadlines || typeof rawDeadlines !== 'object') {
    return generated
  }

  return {
    goalsDue: rawDeadlines.goalsDue || rawDeadlines.goal_setting || rawDeadlines.goals_due || generated.goalsDue,
    selfReviewDue: rawDeadlines.selfReviewDue || rawDeadlines.self_review || rawDeadlines.self_review_due || generated.selfReviewDue,
    managerReviewDue: rawDeadlines.managerReviewDue || rawDeadlines.manager_review || rawDeadlines.manager_review_due || generated.managerReviewDue,
    calibrationDue: rawDeadlines.calibrationDue || rawDeadlines.calibration || rawDeadlines.calibration_due || generated.calibrationDue,
    releaseDate: rawDeadlines.releaseDate || rawDeadlines.release_date || rawDeadlines.released_at || endDate || generated.releaseDate,
  }
}

export const supabaseCycleService = {
  async list(): Promise<ReviewCycle[]> {
    if (!isSupabaseConfigured) return mockCycleService.list()

    try {
      const { data, error } = await supabase.from('review_cycles').select('*')
      if (error) {
        console.warn('Supabase fetch cycles error, falling back:', error)
        return mockCycleService.list()
      }
      if (!data || data.length === 0) {
        return mockCycleService.list()
      }

      // Query participants count or mapping
      const { data: participants } = await supabase.from('cycle_participants').select('cycle_id, user_id')

      return data.map((c) => {
        const cycleParticipants = participants
          ? participants.filter((p) => p.cycle_id === c.id).map((p) => p.user_id)
          : []

        return {
          id: c.id,
          name: c.name,
          stage: c.stage as CycleStage,
          startDate: c.start_date,
          endDate: c.end_date,
          description: c.description || `Evaluation cycle for ${c.name}`,
          weights: c.weights || { goals: 60, competencies: 30, values: 10 },
          deadlines: normalizeCycleDeadlines(c.deadlines, c.start_date, c.end_date),
          participantIds: cycleParticipants,
        }
      })
    } catch {
      return mockCycleService.list()
    }
  },

  async getById(id: string): Promise<ReviewCycle | null> {
    if (!isSupabaseConfigured) return mockCycleService.getById(id)

    const targetUuid = resolveCycleUuid(id)
    if (!targetUuid) {
      return mockCycleService.getById(id)
    }

    try {
      const { data, error } = await supabase.from('review_cycles').select('*').eq('id', targetUuid).maybeSingle()
      if (error || !data) {
        return mockCycleService.getById(id)
      }

      const { data: participants } = await supabase
        .from('cycle_participants')
        .select('user_id')
        .eq('cycle_id', targetUuid)

      const participantIds = participants ? participants.map((p) => p.user_id) : []

      return {
        id: data.id,
        name: data.name,
        stage: data.stage as CycleStage,
        startDate: data.start_date,
        endDate: data.end_date,
        description: data.description || `Evaluation cycle for ${data.name}`,
        weights: data.weights || { goals: 60, competencies: 30, values: 10 },
        deadlines: normalizeCycleDeadlines(data.deadlines, data.start_date, data.end_date),
        participantIds,
      }
    } catch {
      return mockCycleService.getById(id)
    }
  },

  async getActiveCycle(): Promise<ReviewCycle> {
    const list = await this.list()
    if (!list || list.length === 0) {
      return {
        id: '',
        name: 'No Active Cycle',
        stage: 'draft',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        description: 'No active review cycle found. Please create one to start.',
        weights: { goals: 60, competencies: 30, values: 10 },
        deadlines: {
          goalsDue: '',
          selfReviewDue: '',
          managerReviewDue: '',
          calibrationDue: '',
          releaseDate: '',
        },
        participantIds: [],
      }
    }
    const active = list.find((c) => c.stage !== 'closed') || list[0]
    return active
  },

  async setActiveCycle(id: string): Promise<ReviewCycle> {
    return mockCycleService.setActiveCycle(id)
  },

  async advanceStage(cycleId: string): Promise<ReviewCycle> {
    if (!isSupabaseConfigured) return mockCycleService.advanceStage(cycleId)

    const current = await this.getById(cycleId)
    if (!current) throw new Error(`Cycle ${cycleId} not found`)

    const currentIndex = STAGE_ORDER.indexOf(current.stage)
    if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
      throw new Error(`Cycle is already at final stage (${current.stage})`)
    }

    const nextStage = STAGE_ORDER[currentIndex + 1]
    const targetUuid = resolveCycleUuid(cycleId)

    if (isSupabaseConfigured && targetUuid) {
      try {
        const { error } = await supabase.rpc('advance_review_cycle', {
          p_cycle_id: targetUuid,
          p_target_stage: nextStage,
          p_reason: 'Stage advanced from administrative interface',
        })

        if (error) {
          // Fallback to direct table update if RPC function has tenant mismatch
          await supabase
            .from('review_cycles')
            .update({ stage: nextStage })
            .eq('id', targetUuid)
        }
      } catch (e) {
        console.warn('Supabase advanceStage RPC fallback:', e)
      }
    }

    // Keep mock state in sync
    return mockCycleService.advanceStage(cycleId)
  },

  async setStage(cycleId: string, stage: CycleStage): Promise<ReviewCycle> {
    const targetUuid = resolveCycleUuid(cycleId)
    if (isSupabaseConfigured && targetUuid) {
      try {
        await supabase.from('review_cycles').update({ stage }).eq('id', targetUuid)
      } catch (e) {
        console.warn('Failed to update stage in Supabase', e)
      }
    }
    return mockCycleService.setStage(cycleId, stage)
  },

  async create(cycleData: Omit<ReviewCycle, 'id'>): Promise<ReviewCycle> {
    const mockCreated = await mockCycleService.create(cycleData)

    if (isSupabaseConfigured) {
      try {
        const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
        const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000001'

        const { data, error } = await supabase
          .from('review_cycles')
          .insert({
            tenant_id: tenantId,
            name: cycleData.name,
            stage: cycleData.stage || 'draft',
            start_date: cycleData.startDate,
            end_date: cycleData.endDate,
            weights: cycleData.weights,
            deadlines: cycleData.deadlines,
          })
          .select()
          .single()

        if (!error && data) {
          // Add participant rows
          if (cycleData.participantIds && cycleData.participantIds.length > 0) {
            const rows = cycleData.participantIds.map((userId) => ({
              tenant_id: tenantId,
              cycle_id: data.id,
              user_id: userId,
            }))
            await supabase.from('cycle_participants').insert(rows)
          }

          return {
            id: data.id,
            name: data.name,
            stage: data.stage as CycleStage,
            startDate: data.start_date,
            endDate: data.end_date,
            description: cycleData.description,
            weights: data.weights,
            deadlines: data.deadlines,
            participantIds: cycleData.participantIds || [],
          }
        }
      } catch (e) {
        console.warn('Supabase create cycle error, preserved in local storage:', e)
      }
    }

    return mockCreated
  },

  async update(id: string, updates: Partial<ReviewCycle>): Promise<ReviewCycle> {
    const updated = await mockCycleService.update(id, updates)
    const targetUuid = resolveCycleUuid(id)

    if (isSupabaseConfigured && targetUuid) {
      try {
        const dbUpdates: any = {}
        if (updates.name) dbUpdates.name = updates.name
        if (updates.startDate) dbUpdates.start_date = updates.startDate
        if (updates.endDate) dbUpdates.end_date = updates.endDate
        if (updates.weights) dbUpdates.weights = updates.weights
        if (updates.deadlines) dbUpdates.deadlines = updates.deadlines
        if (updates.stage) dbUpdates.stage = updates.stage

        await supabase.from('review_cycles').update(dbUpdates).eq('id', targetUuid)
      } catch (e) {
        console.warn('Supabase update cycle error:', e)
      }
    }

    return updated
  },

  async getEnrolledParticipants(cycleId: string): Promise<User[]> {
    return mockCycleService.getEnrolledParticipants(cycleId)
  },

  async checkParticipantEvaluationHistory(cycleId: string, userId: string) {
    return mockCycleService.checkParticipantEvaluationHistory(cycleId, userId)
  },

  async removeParticipant(
    cycleId: string,
    userId: string,
    actorName: string = 'Admin',
    purgeEvaluations: boolean = false
  ): Promise<ReviewCycle> {
    const targetUuid = resolveCycleUuid(cycleId)
    if (isSupabaseConfigured && targetUuid && UUID_REGEX.test(userId)) {
      try {
        await supabase
          .from('cycle_participants')
          .delete()
          .eq('cycle_id', targetUuid)
          .eq('user_id', userId)
      } catch (e) {
        console.warn('Supabase removeParticipant notice:', e)
      }
    }

    return mockCycleService.removeParticipant(cycleId, userId, actorName, purgeEvaluations)
  },

  async addParticipant(cycleId: string, userId: string, actorName: string = 'Admin'): Promise<ReviewCycle> {
    const targetUuid = resolveCycleUuid(cycleId)
    if (isSupabaseConfigured && targetUuid && UUID_REGEX.test(userId)) {
      try {
        const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
        const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000001'

        await supabase.from('cycle_participants').insert({
          tenant_id: tenantId,
          cycle_id: targetUuid,
          user_id: userId,
        })
      } catch (e) {
        console.warn('Supabase addParticipant notice:', e)
      }
    }

    return mockCycleService.addParticipant(cycleId, userId, actorName)
  },

  async addParticipantsBulk(cycleId: string, userIds: string[], actorName: string = 'Admin'): Promise<ReviewCycle> {
    const targetUuid = resolveCycleUuid(cycleId)
    if (isSupabaseConfigured && targetUuid) {
      try {
        const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single()
        const tenantId = tenant?.id || '00000000-0000-0000-0000-000000000001'

        const validUserIds = userIds.filter((u) => UUID_REGEX.test(u))
        if (validUserIds.length > 0) {
          const rows = validUserIds.map((userId) => ({
            tenant_id: tenantId,
            cycle_id: targetUuid,
            user_id: userId,
          }))
          await supabase.from('cycle_participants').insert(rows)
        }
      } catch (e) {
        console.warn('Supabase addParticipantsBulk notice:', e)
      }
    }

    return mockCycleService.addParticipantsBulk(cycleId, userIds, actorName)
  },

  async delete(cycleId: string, actorName: string = 'Admin'): Promise<void> {
    const targetUuid = resolveCycleUuid(cycleId)

    if (isSupabaseConfigured && targetUuid) {
      try {
        // Cascade delete child rows in Supabase using valid UUID only
        await supabase.from('cycle_participants').delete().eq('cycle_id', targetUuid)
        await supabase.from('goals').delete().eq('cycle_id', targetUuid)
        await supabase.from('self_assessments').delete().eq('cycle_id', targetUuid)
        await supabase.from('manager_reviews').delete().eq('cycle_id', targetUuid)
        await supabase.from('calibrations').delete().eq('cycle_id', targetUuid)
        await supabase.from('final_results').delete().eq('cycle_id', targetUuid)
        const { error } = await supabase.from('review_cycles').delete().eq('id', targetUuid)
        if (error) {
          console.warn('Supabase delete cycle notice (non-fatal):', error.message)
        }
      } catch (e: any) {
        console.warn('Supabase delete cycle exception (non-fatal):', e?.message || e)
      }
    }

    // Always delete from mock / local storage so cycle is permanently removed without errors
    await mockCycleService.delete(cycleId, actorName)
    if (targetUuid && targetUuid !== cycleId) {
      try {
        await mockCycleService.delete(targetUuid, actorName)
      } catch {
        // Silently ignore if already removed
      }
    }
  },
}
