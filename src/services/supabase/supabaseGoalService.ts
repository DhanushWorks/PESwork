import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { Goal, GoalStatus, ProgressLog } from '../../types'
import { goalService as mockGoalService } from '../mock/goalService'
import { supabaseNotificationService as notificationService } from './supabaseNotificationService'

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

export const supabaseGoalService = {
  async listForUser(userId: string, cycleId?: string): Promise<Goal[]> {
    if (!isSupabaseConfigured) return mockGoalService.listForUser(userId, cycleId)

    try {
      let query = supabase.from('goals').select('*').eq('user_id', userId)
    if (cycleId) {
      query = query.eq('cycle_id', cycleId)
    }

    const { data, error } = await query
    const mockGoals = await mockGoalService.listForUser(userId, cycleId)

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
    if (updatesData) {
      for (const u of updatesData) {
        if (!updatesByGoal[u.goal_id]) {
          updatesByGoal[u.goal_id] = []
        }
        const { url: cleanUrl, fileName } = parseEvidenceUrl(u.evidence_url)
        updatesByGoal[u.goal_id].push({
          id: u.id,
          date: u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          percentage: Number(u.progress),
          note: u.note,
          evidenceFileName: fileName,
          evidenceUrl: cleanUrl,
        })
      }
    }

    const dbGoals = data.map((g) => {
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

    // Merge: include any fallback goals that aren't already in DB
    const existingTitles = new Set(dbGoals.map((g) => g.title.toLowerCase().trim()))
    const extraMockGoals = mockGoals.filter((mg) => !existingTitles.has(mg.title.toLowerCase().trim()))

    return [...dbGoals, ...extraMockGoals]
    } catch {
      return mockGoalService.listForUser(userId, cycleId)
    }
  },

  async getById(goalId: string): Promise<Goal | null> {
    if (!isSupabaseConfigured) return mockGoalService.getById(goalId)

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

    const progressHistory: ProgressLog[] = (updatesData || []).map((u) => {
      const { url: cleanUrl, fileName } = parseEvidenceUrl(u.evidence_url)
      return {
        id: u.id,
        date: u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        percentage: Number(u.progress),
        note: u.note,
        evidenceFileName: fileName,
        evidenceUrl: cleanUrl,
      }
    })

    const latestEvidence = progressHistory.find((h) => h.evidenceFileName || h.evidenceUrl)

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
      evidenceFileName: latestEvidence?.evidenceFileName,
      evidenceUrl: latestEvidence?.evidenceUrl,
      evidenceFileSize: latestEvidence?.evidenceFileSize,
      progressHistory,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  },

  async save(goalData: Partial<Goal> & { userId: string; cycleId: string; title: string }): Promise<Goal> {
    if (!isSupabaseConfigured) return mockGoalService.save(goalData)

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
      return mockGoalService.save(goalData)
    }

    try {
      await mockGoalService.save({ ...goalData, id: data.id })
    } catch {}

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
      progressHistory: goalData.progressHistory || [],
      evidenceFileName: goalData.evidenceFileName,
      evidenceUrl: goalData.evidenceUrl,
      evidenceFileSize: goalData.evidenceFileSize,
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
      const { data: updatedGoal } = await supabase.from('goals').update({
        status: decision,
        rejection_reason: reason,
        approved_at: decision === 'approved' ? new Date().toISOString() : null,
      }).eq('id', goalId).select('id, user_id, title').single()

      if (updatedGoal) {
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
      }
    }
    return mockGoalService.decide(goalId, decision, reason)
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

    if (isSupabaseConfigured) {
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${userId}/${goalId}/${Date.now()}_${cleanName}`

      const { error: uploadError } = await supabase.storage
        .from('evidence')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.error('Supabase Storage upload error:', uploadError)
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      // Generate a fresh signed URL (valid for 7 days)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('evidence')
        .createSignedUrl(filePath, 60 * 60 * 24 * 7)

      let storageUrl = signedData?.signedUrl
      if (!storageUrl || signedError) {
        const { data: pubData } = supabase.storage.from('evidence').getPublicUrl(filePath)
        storageUrl = pubData.publicUrl
      }

      const finalUrl = `${storageUrl}#name=${encodeURIComponent(file.name)}`
      return {
        fileName: file.name,
        fileUrl: finalUrl,
        fileSize: sizeFormatted,
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
    const boundedPct = Math.max(0, Math.min(100, Math.round(percentage)))

    if (isSupabaseConfigured) {
      // 1. Fetch current goal to obtain tenant_id and user_id for NOT NULL foreign keys
      const { data: currentGoal, error: goalFetchErr } = await supabase
        .from('goals')
        .select('id, tenant_id, user_id, progress')
        .eq('id', goalId)
        .single()

      if (goalFetchErr || !currentGoal) {
        console.warn('Goal not in Supabase, updating in presentation store:', goalId)
        return mockGoalService.addProgress(goalId, percentage, note, evidenceFileName, evidenceUrl, evidenceFileSize)
      }

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

      const { error: updateGoalErr } = await supabase
        .from('goals')
        .update(goalUpdatePayload)
        .eq('id', goalId)

      if (updateGoalErr) {
        console.error('Supabase goal progress update failed:', updateGoalErr)
        throw new Error(`Failed to update goal progress: ${updateGoalErr.message}`)
      }
    }

    return mockGoalService.addProgress(goalId, percentage, note, evidenceFileName, evidenceUrl, evidenceFileSize)
  },

  async removeEvidence(goalId: string, updateId?: string): Promise<Goal> {
    if (isSupabaseConfigured) {
      if (updateId) {
        const { error } = await supabase
          .from('goal_updates')
          .update({ evidence_url: null })
          .eq('id', updateId)

        if (error) {
          console.error('Supabase removeEvidence failed:', error)
          throw new Error(`Failed to remove evidence from update: ${error.message}`)
        }
      } else {
        const { error } = await supabase
          .from('goal_updates')
          .update({ evidence_url: null })
          .eq('goal_id', goalId)

        if (error) {
          console.error('Supabase removeEvidence failed:', error)
          throw new Error(`Failed to remove evidence: ${error.message}`)
        }
      }
    }

    return mockGoalService.removeEvidence(goalId, updateId)
  },
}
