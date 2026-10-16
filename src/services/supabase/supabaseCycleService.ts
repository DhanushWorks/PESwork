import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { ReviewCycle, CycleStage } from '../../types'
import { STAGE_ORDER } from '../../lib/formatters'
import { cycleService as mockCycleService } from '../mock/cycleService'

const DEFAULT_WEIGHTS = { goals: 60, competencies: 30, values: 10 }
const DEFAULT_DEADLINES = {
  goalsDue: '2026-02-15',
  selfReviewDue: '2026-05-15',
  managerReviewDue: '2026-05-30',
  calibrationDue: '2026-06-15',
  releaseDate: '2026-06-30',
}

export const supabaseCycleService = {
  async list(): Promise<ReviewCycle[]> {
    if (!isSupabaseConfigured) return mockCycleService.list()

    const { data, error } = await supabase.from('review_cycles').select('*')
    if (error || !data || data.length === 0) {
      return mockCycleService.list()
    }

    return data.map((c) => ({
      id: c.id,
      name: c.name,
      stage: c.stage as CycleStage,
      startDate: c.start_date,
      endDate: c.end_date,
      description: `Evaluation cycle for ${c.name}`,
      weights: c.weights || DEFAULT_WEIGHTS,
      deadlines: DEFAULT_DEADLINES,
    }))
  },

  async getById(id: string): Promise<ReviewCycle | null> {
    if (!isSupabaseConfigured) return mockCycleService.getById(id)

    const { data, error } = await supabase.from('review_cycles').select('*').eq('id', id).single()
    if (error || !data) {
      return mockCycleService.getById(id)
    }

    return {
      id: data.id,
      name: data.name,
      stage: data.stage as CycleStage,
      startDate: data.start_date,
      endDate: data.end_date,
      description: `Evaluation cycle for ${data.name}`,
      weights: data.weights || DEFAULT_WEIGHTS,
      deadlines: DEFAULT_DEADLINES,
    }
  },

  async getActiveCycle(): Promise<ReviewCycle> {
    const list = await this.list()
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

    const { error } = await supabase.rpc('advance_review_cycle', {
      p_cycle_id: cycleId,
      p_target_stage: nextStage,
      p_reason: 'Stage advanced from application interface',
    })

    if (error) {
      console.warn('RPC advance_review_cycle notice:', error.message)
      return mockCycleService.advanceStage(cycleId)
    }

    return {
      ...current,
      stage: nextStage,
    }
  },

  async setStage(cycleId: string, stage: CycleStage): Promise<ReviewCycle> {
    return mockCycleService.setStage(cycleId, stage)
  },

  async create(cycleData: Omit<ReviewCycle, 'id'>): Promise<ReviewCycle> {
    return mockCycleService.create(cycleData)
  },

  async update(id: string, updates: Partial<ReviewCycle>): Promise<ReviewCycle> {
    return mockCycleService.update(id, updates)
  },
}

