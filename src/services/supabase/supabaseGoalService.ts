import { apiCache } from '../../lib/apiCache'
import { supabase, isSupabaseConfigured, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { Goal, GoalStatus, ProgressLog } from '../../types'
import { goalService as mockGoalService } from '../mock/goalService'
import { supabaseNotificationService as notificationService } from './supabaseNotificationService'
import { storageService } from '../mock/storageService'
import { matchesUser, matchesCycle, toDatabaseUserId, resolveCycleUuid } from '../../lib/workflow'

function toValidUuid(id?: string): string | null {
  if (!id) return null
  const resolved = resolveCycleUuid(toDatabaseUserId(id))
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolved)) {
    return resolved
  }
  return null
}

async function getTenantId(userId?: string): Promise<string> {
  if (!isSupabaseConfigured) return '00000000-0000-0000-0000-000000000001'
  try {
    if (userId) {
      const { data } = await supabase.from('profiles').select('tenant_id').eq('id', userId).maybeSingle()
      if (data?.tenant_id) return data.tenant_id
    }
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).maybeSingle()
    return tenant?.id || '00000000-0000-0000-0000-000000000001'
  } catch {
    return '00000000-0000-0000-0000-000000000001'
  }
}

function parseEvidenceUrl(url?: string): { url?: string; fileName?: string } {
  if (!url) return { url: undefined, fileName: undefined }
  let fileName: string | undefined = undefined
  let cleanUrl = url

  if (url.includes('#name=')) {
    const [raw, namePart] = url.split('#name=')
    cleanUrl = raw
    try {
      fileName = decodeURIComponent(namePart)
    } catch {
      fileName = namePart
    }
  } else if (url.startsWith('data:')) {
    fileName = 'uploaded_evidence.pdf'
  } else {
    try {
      const parsed = new URL(url)
      const segments = parsed.pathname.split('/')
      const last = segments[segments.length - 1]
      if (last) {
        fileName = decodeURIComponent(last.replace(/^\d+_/, ''))
      }
    } catch {
      const segments = url.split('/')
      const last = segments[segments.length - 1]
      if (last) {
        fileName = decodeURIComponent(last.replace(/^\d+_/, ''))
      }
    }
  }

  return { url: cleanUrl, fileName }
}

const REMOVED_EVIDENCE_KEY = 'performiq_removed_evidence_log_ids'

export function getRemovedEvidenceIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(REMOVED_EVIDENCE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return new Set(parsed)
    }
  } catch {}
  return new Set()
}

export function recordRemovedEvidenceId(id: string) {
  if (typeof window === 'undefined') return
  try {
    const ids = getRemovedEvidenceIds()
    ids.add(id)
    localStorage.setItem(REMOVED_EVIDENCE_KEY, JSON.stringify(Array.from(ids)))
  } catch {}
}

export const supabaseGoalService = {
  async listForUser(userId: string, cycleId?: string): Promise<Goal[]> {
    return apiCache.getOrFetch(`goals:user:${userId}:${cycleId || "all"}`, async () => {
    if (!isSupabaseReady()) return mockGoalService.listForUser(userId, cycleId)

    try {
      const validUserId = toValidUuid(userId)
      const mockGoals = await mockGoalService.listForUser(userId, cycleId)

      if (!validUserId) {
        return mockGoals
      }

      let query = supabase.from('goals').select('*').eq('user_id', validUserId)

      // Only pass cycle_id to Postgres if it is a genuine UUID to avoid 22P02 syntax errors
      const validCycleUuid = toValidUuid(cycleId)
      if (validCycleUuid) {
        query = query.eq('cycle_id', validCycleUuid)
      }

      const { data, error } = await query

      if (error || !data || data.length === 0) {
        return mockGoals
      }

      const goalIds = data.map((g) => g.id)

      // Fetch updates for these goals ordered by created_at DESC (latest first)
      const { data: updatesData, error: updatesErr } = await supabase
        .from('goal_updates')
        .select('*')
        .in('goal_id', goalIds)
        .order('created_at', { ascending: false })

      if (updatesErr) {
        console.warn('Notice fetching goal_updates:', updatesErr.message)
      }

      const updatesByGoal: Record<string, ProgressLog[]> = {}
      const removedEvidenceIds = getRemovedEvidenceIds()
      if (updatesData) {
        for (const u of updatesData) {
          if (!updatesByGoal[u.goal_id]) {
            updatesByGoal[u.goal_id] = []
          }
          const isDeleted = (u.id && removedEvidenceIds.has(u.id)) || removedEvidenceIds.has(`goal_${u.goal_id}`)
          const { url: cleanUrl, fileName } = isDeleted
            ? { url: undefined, fileName: undefined }
            : parseEvidenceUrl(u.evidence_url)

          updatesByGoal[u.goal_id].push({
            id: u.id,
            date: u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            percentage: Number(u.progress),
            note: u.note,
            evidenceFileName: isDeleted ? undefined : fileName,
            evidenceUrl: isDeleted ? undefined : cleanUrl,
          })
        }
      }

      let dbGoals: Goal[] = data.map((g) => {
        const history = updatesByGoal[g.id] || []
        const latestEvidence = history.find((h) => h.evidenceFileName || h.evidenceUrl)

        return {
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
          evidenceFileName: latestEvidence?.evidenceFileName,
          evidenceUrl: latestEvidence?.evidenceUrl,
          evidenceFileSize: latestEvidence?.evidenceFileSize,
          progressHistory: history,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
        }
      })

      // If cycleId was specified but was an alias (not UUID), filter with matchesCycle in memory
      if (cycleId && !validCycleUuid) {
        dbGoals = dbGoals.filter((g) => !g.cycleId || matchesCycle(g.cycleId, cycleId))
      }

      // Sync Supabase goals into local storageService state so other components stay updated
      try {
        storageService.updateState((state) => {
          const map = new Map(state.goals.map((g) => [g.id, g]))
          for (const dg of dbGoals) {
            map.set(dg.id, dg)
          }
          return {
            goals: Array.from(map.values()),
          }
        })
      } catch {}

      // Merge: include any fallback goals that aren't already in DB
      const existingTitles = new Set(dbGoals.map((g) => g.title.toLowerCase().trim()))
      const extraMockGoals = mockGoals.filter((mg) => !existingTitles.has(mg.title.toLowerCase().trim()))

      return [...dbGoals, ...extraMockGoals]
    } catch {
      return mockGoalService.listForUser(userId, cycleId)
    }
    }, 45000)
  },

  async getById(goalId: string): Promise<Goal | null> {
    if (!isSupabaseReady()) return mockGoalService.getById(goalId)

    try {

    const { data, error } = await supabase.from('goals').select('*').eq('id', goalId).single()
    if (error || !data) {
      return mockGoalService.getById(goalId)
    }

    // Fetch progress updates for this specific goal ordered newest first
    const { data: updatesData, error: updatesErr } = await supabase
      .from('goal_updates')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })

    if (updatesErr) {
      console.warn('Notice fetching goal_updates for goal:', updatesErr.message)
    }

    const removedEvidenceIds = getRemovedEvidenceIds()
    const progressHistory: ProgressLog[] = (updatesData || []).map((u) => {
      const isDeleted = (u.id && removedEvidenceIds.has(u.id)) || removedEvidenceIds.has(`goal_${goalId}`)
      const { url: cleanUrl, fileName } = isDeleted
        ? { url: undefined, fileName: undefined }
        : parseEvidenceUrl(u.evidence_url)

      return {
        id: u.id,
        date: u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        percentage: Number(u.progress),
        note: u.note,
        evidenceFileName: isDeleted ? undefined : fileName,
        evidenceUrl: isDeleted ? undefined : cleanUrl,
      }
    })

    const latestEvidence = progressHistory.find((h) => h.evidenceFileName || h.evidenceUrl)

    const mappedGoal: Goal = {
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
      evidenceFileName: latestEvidence?.evidenceFileName,
      evidenceUrl: latestEvidence?.evidenceUrl,
      evidenceFileSize: latestEvidence?.evidenceFileSize,
      progressHistory,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    try {
      storageService.updateState((state) => ({
        goals: state.goals.some((g) => g.id === data.id)
          ? state.goals.map((g) => (g.id === data.id ? mappedGoal : g))
          : [mappedGoal, ...state.goals],
      }))
    } catch {}

    return mappedGoal
    } catch (err) {
      markSupabaseOffline(err)
      return mockGoalService.getById(goalId)
    }
  },

  async save(goalData: Partial<Goal> & { userId: string; cycleId: string; title: string }): Promise<Goal> {
    apiCache.invalidate('goals:')
    if (!isSupabaseReady()) {
      const res = await mockGoalService.save(goalData)
      apiCache.invalidate('goals:')
      return res
    }

    const tenantId = await getTenantId(goalData.userId)

    const payload: any = {
      tenant_id: tenantId,
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
      const res = await mockGoalService.save(goalData)
      apiCache.invalidate('goals:')
      return res
    }

    try {
      await mockGoalService.save({ ...goalData, id: data.id })
    } catch {}

    const saved: Goal = {
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
      progressHistory: goalData.progressHistory || [],
      evidenceFileName: goalData.evidenceFileName,
      evidenceUrl: goalData.evidenceUrl,
      evidenceFileSize: goalData.evidenceFileSize,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    try {
      storageService.updateState((state) => {
        const exists = state.goals.some((g) => g.id === saved.id)
        return {
          goals: exists
            ? state.goals.map((g) => (g.id === saved.id ? saved : g))
            : [saved, ...state.goals],
        }
      })
    } catch {}

    apiCache.invalidate('goals:')
    return saved
  },

  async delete(goalId: string): Promise<boolean> {
    apiCache.invalidate('goals:')
    if (isSupabaseReady()) {
      await supabase.from('goals').delete().eq('id', goalId)
    }
    try {
      storageService.updateState((state) => ({
        goals: state.goals.filter((g) => g.id !== goalId),
      }))
    } catch {}
    try {
      const res = await mockGoalService.delete(goalId)
      apiCache.invalidate('goals:')
      return res
    } catch {
      apiCache.invalidate('goals:')
      return true
    }
  },

  async submitGoalsForApproval(userId: string, cycleId: string): Promise<{ success: boolean; errors?: string[] }> {
    apiCache.invalidate('goals:')
    if (isSupabaseReady()) {
      try {
        const { error } = await supabase.rpc('submit_goals', { p_cycle_id: resolveCycleUuid(cycleId) || cycleId })
        if (error) {
          console.warn('RPC submit_goals notice:', error.message)
          // Direct update fallback in Supabase
          await supabase
            .from('goals')
            .update({ status: 'pending_approval' })
            .eq('user_id', toDatabaseUserId(userId))
            .eq('cycle_id', resolveCycleUuid(cycleId) || cycleId)
        }
      } catch (e) {
        console.warn('Notice in supabase submitGoalsForApproval:', e)
      }
    }
    const res = await mockGoalService.submitGoalsForApproval(userId, cycleId)
    apiCache.invalidate('goals:')
    return res
  },

  async decide(goalId: string, decision: 'approved' | 'returned', reason?: string): Promise<Goal> {
    apiCache.invalidate('goals:')
    if (decision === 'returned' && (!reason || reason.trim().length < 5)) {
      throw new Error('A descriptive comment is required when returning a goal for revision.')
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(goalId)
    if (isSupabaseReady() && isUuid) {
      try {
        const { data: updatedGoal, error: updateErr } = await supabase
          .from('goals')
          .update({
            status: decision,
            rejection_reason: decision === 'returned' ? (reason || null) : null,
            approved_at: decision === 'approved' ? new Date().toISOString() : null,
          })
          .eq('id', goalId)
          .select('*')
          .maybeSingle()

        if (updateErr) {
          console.warn('Supabase goal decide warning:', updateErr.message)
        } else if (updatedGoal) {
        const mappedGoal: Goal = {
          id: updatedGoal.id,
          userId: updatedGoal.user_id,
          cycleId: updatedGoal.cycle_id,
          title: updatedGoal.title,
          description: updatedGoal.description || '',
          metric: updatedGoal.metric,
          target: Number(updatedGoal.target),
          current: Number(updatedGoal.progress),
          unit: updatedGoal.unit,
          weight: Number(updatedGoal.weight),
          progress: Number(updatedGoal.progress),
          dueDate: updatedGoal.due_date,
          status: updatedGoal.status as GoalStatus,
          returnReason: updatedGoal.rejection_reason,
          progressHistory: [],
          createdAt: updatedGoal.created_at,
          updatedAt: updatedGoal.updated_at,
        }

        // Keep local storage in sync
        try {
          storageService.updateState((state) => {
            const exists = state.goals.some((g) => g.id === goalId)
            const goals = exists
              ? state.goals.map((g) => (g.id === goalId ? { ...g, ...mappedGoal } : g))
              : [mappedGoal, ...state.goals]

            const audit = {
              id: `audit-${Date.now()}`,
              actorId: state.currentUserId,
              actorName: state.users.find((u) => u.id === state.currentUserId)?.name || 'Manager',
              action: decision === 'approved' ? 'GOAL_APPROVED' : 'GOAL_RETURNED',
              entity: 'Goal',
              entityId: goalId,
              timestamp: new Date().toISOString(),
              details:
                decision === 'approved'
                  ? `Approved goal "${updatedGoal.title}".`
                  : `Returned goal "${updatedGoal.title}" with comment: "${reason}".`,
            }

            return {
              goals,
              auditLogs: [audit, ...state.auditLogs],
            }
          })
        } catch (e) {
          console.warn('Sync to mock storage notice:', e)
        }

        // Create notification for employee
        try {
          await notificationService.create({
            userId: updatedGoal.user_id,
            title: decision === 'approved' ? 'Goal Approved' : 'Goal Returned for Revision',
            message:
              decision === 'approved'
                ? `Your goal "${updatedGoal.title}" was approved by your manager.`
                : `Your goal "${updatedGoal.title}" was returned for revision: "${reason}"`,
            link: '/employee/goals',
            type: decision === 'approved' ? 'success' : 'action',
          })
        } catch (e) {
          console.warn('Notification notice:', e)
        }

        // Auto-advance review cycle to 'tracking' if all pending goals in this cycle are approved
        if (decision === 'approved' && updatedGoal.cycle_id) {
          try {
            const { data: remainingPending } = await supabase
              .from('goals')
              .select('id')
              .eq('cycle_id', updatedGoal.cycle_id)
              .eq('status', 'pending_approval')

            if (!remainingPending || remainingPending.length === 0) {
              const { data: currentCycle } = await supabase
                .from('review_cycles')
                .select('stage')
                .eq('id', updatedGoal.cycle_id)
                .maybeSingle()

              if (currentCycle?.stage === 'goals_open' || currentCycle?.stage === 'draft') {
                await supabase
                  .from('review_cycles')
                  .update({ stage: 'tracking' })
                  .eq('id', updatedGoal.cycle_id)

                storageService.updateState((state) => ({
                  cycles: state.cycles.map((c) =>
                    c.id === updatedGoal.cycle_id || matchesCycle(c.id, updatedGoal.cycle_id)
                      ? { ...c, stage: 'tracking' as const }
                      : c
                  ),
                }))
              }
            }
          } catch (autoErr) {
            console.warn('Auto-advance to tracking notice:', autoErr)
          }
        }

        apiCache.invalidate('goals:')
        return mappedGoal
      }
      } catch (err) {
        console.warn('Supabase goal decide exception:', err)
      }
    }

    const res = await mockGoalService.decide(goalId, decision, reason)
    apiCache.invalidate('goals:')
    return res
  },

  async uploadEvidence(
    file: File,
    userId: string,
    goalId: string
  ): Promise<{ fileName: string; fileUrl: string; fileSize: string }> {
    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`

    if (isSupabaseReady()) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${userId}/${goalId}/${Date.now()}_${cleanName}`

      try {
        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          })

        if (!uploadError) {
          // Generate a fresh signed URL (valid for 7 days)
          const { data: signedData, error: signedError } = await supabase.storage
            .from('evidence')
            .createSignedUrl(filePath, 60 * 60 * 24 * 7)

          let storageUrl = signedData?.signedUrl
          if (!storageUrl || signedError) {
            const { data: pubData } = supabase.storage.from('evidence').getPublicUrl(filePath)
            storageUrl = pubData.publicUrl
          }

          if (storageUrl) {
            const finalUrl = `${storageUrl}#name=${encodeURIComponent(file.name)}`
            return {
              fileName: file.name,
              fileUrl: finalUrl,
              fileSize: sizeFormatted,
            }
          }
        } else {
          console.warn(
            `[PerformIQ] Supabase Storage upload skipped (${uploadError.message}); seamlessly falling back to persistent Data URI.`
          )
        }
      } catch (storageErr: any) {
        console.warn(
          `[PerformIQ] Supabase Storage exception (${storageErr?.message || storageErr}); falling back to persistent Data URI.`
        )
      }
    }

    return mockGoalService.uploadEvidence(file, userId, goalId)
  },

  async addProgress(
    goalId: string,
    percentage: number,
    note: string,
    evidenceFileName?: string,
    evidenceUrl?: string,
    evidenceFileSize?: string
  ): Promise<Goal> {
    apiCache.invalidate('goals:')
    const boundedPct = Math.max(0, Math.min(100, Math.round(percentage)))

    if (isSupabaseReady()) {
      // 1. Fetch current goal to obtain tenant_id and user_id for NOT NULL foreign keys
      const { data: currentGoal, error: goalFetchErr } = await supabase
        .from('goals')
        .select('*')
        .eq('id', goalId)
        .maybeSingle()

      if (currentGoal) {
        // Encode filename in evidence_url if present
        const storedUrl = evidenceUrl
          ? (evidenceFileName && !evidenceUrl.includes('#name=') ? `${evidenceUrl}#name=${encodeURIComponent(evidenceFileName)}` : evidenceUrl)
          : (evidenceFileName || null)

        // 2. Insert into goal_updates with all required foreign keys
        const { error: insertErr } = await supabase.from('goal_updates').insert({
          tenant_id: currentGoal.tenant_id,
          goal_id: goalId,
          user_id: currentGoal.user_id,
          progress: boundedPct,
          note,
          evidence_url: storedUrl,
        })

        if (insertErr) {
          console.error('Supabase goal_updates insert failed:', insertErr)
          throw new Error(`Failed to save progress update in database: ${insertErr.message}`)
        }

        // 3. Update goal progress & status
        const goalUpdatePayload: any = {
          progress: boundedPct,
          updated_at: new Date().toISOString(),
        }
        if (boundedPct === 100) {
          goalUpdatePayload.status = 'completed'
        }

        const { data: updatedGoal, error: updateGoalErr } = await supabase
          .from('goals')
          .update(goalUpdatePayload)
          .eq('id', goalId)
          .select('*')
          .single()

        if (updateGoalErr) {
          console.error('Supabase goal progress update failed:', updateGoalErr)
          throw new Error(`Failed to update goal progress: ${updateGoalErr.message}`)
        }

        try {
          await mockGoalService.addProgress(goalId, percentage, note, evidenceFileName, evidenceUrl, evidenceFileSize)
        } catch {}

        apiCache.invalidate('goals:')
        const fullGoal = await this.getById(goalId)
        if (fullGoal) {
          try {
            storageService.updateState((state) => ({
              goals: state.goals.map((g) => (g.id === goalId ? fullGoal : g)),
            }))
          } catch {}
          return fullGoal
        }

        const fallbackMapped: Goal = {
          id: updatedGoal.id,
          userId: updatedGoal.user_id,
          cycleId: updatedGoal.cycle_id,
          title: updatedGoal.title,
          description: updatedGoal.description || '',
          metric: updatedGoal.metric,
          target: Number(updatedGoal.target),
          current: Number(updatedGoal.progress),
          unit: updatedGoal.unit,
          weight: Number(updatedGoal.weight),
          progress: Number(updatedGoal.progress),
          dueDate: updatedGoal.due_date,
          status: updatedGoal.status as GoalStatus,
          returnReason: updatedGoal.rejection_reason,
          progressHistory: [],
          createdAt: updatedGoal.created_at,
          updatedAt: updatedGoal.updated_at,
        }

        try {
          storageService.updateState((state) => ({
            goals: state.goals.map((g) => (g.id === goalId ? fallbackMapped : g)),
          }))
        } catch {}

        return fallbackMapped
      }
    }

    const res = await mockGoalService.addProgress(goalId, percentage, note, evidenceFileName, evidenceUrl, evidenceFileSize)
    apiCache.invalidate('goals:')
    return res
  },

  async removeEvidence(goalId: string, updateId?: string): Promise<Goal> {
    apiCache.invalidate('goals:')
    if (updateId) {
      recordRemovedEvidenceId(updateId)
    } else {
      recordRemovedEvidenceId(`goal_${goalId}`)
    }

    if (isSupabaseReady()) {
      try {
        if (updateId) {
          await supabase
            .from('goal_updates')
            .update({ evidence_url: null })
            .eq('id', updateId)
        } else {
          await supabase
            .from('goal_updates')
            .update({ evidence_url: null })
            .eq('goal_id', goalId)
        }
      } catch (err) {
        console.warn('Notice updating evidence_url in Supabase:', err)
      }

      try {
        await mockGoalService.removeEvidence(goalId, updateId)
      } catch {}

      const fullGoal = await this.getById(goalId)
      if (fullGoal) {
        // Enforce evidence removal in returned object
        const updatedHistory = (fullGoal.progressHistory || []).map((p) => {
          if (!updateId || p.id === updateId) {
            return {
              ...p,
              evidenceFileName: undefined,
              evidenceUrl: undefined,
              evidenceFileSize: undefined,
            }
          }
          return p
        })
        const latestEv = updatedHistory.find((p) => p.evidenceFileName || p.evidenceUrl)
        const sanitizedGoal: Goal = {
          ...fullGoal,
          evidenceFileName: latestEv?.evidenceFileName,
          evidenceUrl: latestEv?.evidenceUrl,
          evidenceFileSize: latestEv?.evidenceFileSize,
          progressHistory: updatedHistory,
        }

        try {
          storageService.updateState((state) => ({
            goals: state.goals.map((g) => (g.id === goalId ? sanitizedGoal : g)),
          }))
        } catch {}

        apiCache.invalidate('goals:')
        return sanitizedGoal
      }
    }

    const res = await mockGoalService.removeEvidence(goalId, updateId)
    apiCache.invalidate('goals:')
    return res
  },
}
