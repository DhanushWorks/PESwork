import { Goal, GoalStatus, ProgressLog } from '../../types'
import { validateGoalSet } from '../../lib/validation'
import { matchesUser, matchesCycle } from '../../lib/workflow'
import { storageService } from './storageService'
import { mockNotificationService } from './notificationService'

export const goalService = {
  async listForUser(userId: string, cycleId?: string): Promise<Goal[]> {
    const goals = storageService.getState().goals.filter((g) => {
      const matchUser = g.userId === userId || matchesUser(g.userId, userId)
      const matchCycle = cycleId ? (g.cycleId === cycleId || matchesCycle(g.cycleId, cycleId)) : true
      return matchUser && matchCycle
    })
    return goals.map((g) => ({ ...g }))
  },

  async getById(goalId: string): Promise<Goal | null> {
    const goal = storageService.getState().goals.find((g) => g.id === goalId)
    return goal ? { ...goal } : null
  },

  async save(goalData: Partial<Goal> & { userId: string; cycleId: string; title: string }): Promise<Goal> {
    let resultGoal: Goal

    if (goalData.id) {
      // Update existing
      const existing = await this.getById(goalData.id)
      if (!existing) throw new Error(`Goal ${goalData.id} not found`)

      resultGoal = {
        ...existing,
        ...goalData,
        updatedAt: new Date().toISOString(),
      }

      storageService.updateState((state) => ({
        goals: state.goals.map((g) => (g.id === resultGoal.id ? resultGoal : g)),
      }))
    } else {
      // Create new draft
      const newGoal: Goal = {
        id: `goal-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        userId: goalData.userId,
        cycleId: goalData.cycleId,
        title: goalData.title,
        description: goalData.description || '',
        metric: goalData.metric || '',
        target: Number(goalData.target) || 100,
        current: Number(goalData.current) || 0,
        unit: goalData.unit || '%',
        weight: Number(goalData.weight) || 20,
        progress: Number(goalData.progress) || 0,
        dueDate: goalData.dueDate || new Date().toISOString().split('T')[0],
        status: (goalData.status as GoalStatus) || 'draft',
        progressHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      resultGoal = newGoal

      storageService.updateState((state) => ({
        goals: [...state.goals, newGoal],
      }))
    }

    return resultGoal
  },

  async submitGoalsForApproval(userId: string, cycleId: string): Promise<{ success: boolean; errors?: string[] }> {
    const userGoals = await this.listForUser(userId, cycleId)
    const validation = validateGoalSet(userGoals)

    if (!validation.isValid) {
      return { success: false, errors: validation.errors }
    }

    storageService.updateState((state) => {
      const goals = state.goals.map((g) => {
        if (g.userId === userId && g.cycleId === cycleId && (g.status === 'draft' || g.status === 'returned')) {
          return {
            ...g,
            status: 'pending_approval' as GoalStatus,
            returnReason: undefined,
            updatedAt: new Date().toISOString(),
          }
        }
        return g
      })

      // Add audit log
      const user = state.users.find((u) => u.id === userId)
      const audit = {
        id: `audit-${Date.now()}`,
        actorId: userId,
        actorName: user?.name || 'Employee',
        action: 'GOALS_SUBMITTED',
        entity: 'GoalSet',
        entityId: `${userId}:${cycleId}`,
        timestamp: new Date().toISOString(),
        details: `Submitted ${userGoals.length} goals totaling 100% weight for manager review.`,
      }

      return {
        goals,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    // In-app notification: Notify assigned manager that goals were submitted
    const state = storageService.getState()
    const employee = state.users.find((u) => u.id === userId)
    const cycle = state.cycles.find((c) => c.id === cycleId)
    const managerId = employee?.managerId
    if (managerId) {
      await mockNotificationService.create({
        id: `notif-goals-sub-${userId}-${cycleId}-${Date.now()}`,
        userId: managerId,
        title: 'Goals Submitted for Approval',
        message: `${employee?.name || 'Employee'} submitted their performance goals for ${cycle?.name || 'review cycle'}. Review and approve their strategic targets.`,
        link: '/manager/approvals',
        type: 'action',
      })
    }

    return { success: true }
  },

  async decide(goalId: string, decision: 'approved' | 'returned', reason?: string): Promise<Goal> {
    let goal = await this.getById(goalId)
    if (!goal) {
      const state = storageService.getState()
      goal = state.goals.find((g) => g.id === goalId) || null
    }

    if (decision === 'returned' && (!reason || reason.trim().length < 5)) {
      throw new Error('A descriptive comment is required when returning a goal for revision.')
    }

    if (!goal) {
      // Fallback synthesis so mock store doesn't hard-crash on DB-synced items
      goal = {
        id: goalId,
        userId: storageService.getState().currentUserId || 'u-emp-1',
        cycleId: storageService.getState().activeCycleId || '',
        title: 'Goal',
        description: '',
        metric: 'Completion',
        target: 100,
        current: 0,
        unit: '%',
        weight: 0,
        progress: 0,
        dueDate: new Date().toISOString().split('T')[0],
        status: decision === 'approved' ? 'approved' : 'returned',
        progressHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    }

    const safeGoal = goal

    let updated: Goal | null = null
    storageService.updateState((state) => {
      const exists = state.goals.some((g) => g.id === goalId)
      const mappedGoal: Goal = {
        ...safeGoal,
        status: decision === 'approved' ? 'approved' : 'returned',
        returnReason: decision === 'returned' ? reason : undefined,
        updatedAt: new Date().toISOString(),
      }
      updated = mappedGoal

      const goals = exists
        ? state.goals.map((g) => (g.id === goalId ? mappedGoal : g))
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
            ? `Approved goal "${safeGoal.title}".`
            : `Returned goal "${safeGoal.title}" with comment: "${reason}".`,
      }

      return {
        goals,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    // In-app notification: Notify employee of goal approval or return
    const state = storageService.getState()
    const employee = state.users.find((u) => u.id === safeGoal.userId)
    const manager = state.users.find((u) => u.id === employee?.managerId)
    const approver = state.users.find((u) => u.id === state.currentUserId)
    const approverName =
      approver && approver.id !== safeGoal.userId && (approver.role === 'manager' || approver.role === 'admin')
        ? approver.name
        : manager?.name || 'Manager'

    if (decision === 'approved') {
      await mockNotificationService.create({
        id: `notif-goal-app-${goalId}-${Date.now()}`,
        userId: safeGoal.userId,
        title: 'Goal Approved',
        message: `Your manager ${approverName} approved your goal "${safeGoal.title}". Target is now active.`,
        link: '/employee/goals',
        type: 'success',
      })
    } else {
      await mockNotificationService.create({
        id: `notif-goal-ret-${goalId}-${Date.now()}`,
        userId: safeGoal.userId,
        title: 'Goal Returned for Revision',
        message: `Your goal "${safeGoal.title}" was returned by ${approverName} with note: "${reason}". Please revise and resubmit.`,
        link: '/employee/goals',
        type: 'warning',
      })
    }

    return updated!
  },

  async uploadEvidence(
    file: File,
    _userId: string,
    _goalId: string
  ): Promise<{ fileName: string; fileUrl: string; fileSize: string }> {
    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const finalUrl = `${reader.result as string}#name=${encodeURIComponent(file.name)}`
        resolve({
          fileName: file.name,
          fileUrl: finalUrl,
          fileSize: sizeFormatted,
        })
      }
      reader.onerror = () => reject(new Error('Failed to read file from local device.'))
      reader.readAsDataURL(file)
    })
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
    const goal = await this.getById(goalId)
    if (!goal) throw new Error(`Goal ${goalId} not found`)

    const newLog: ProgressLog = {
      id: `prog-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: new Date().toISOString().split('T')[0],
      percentage: boundedPct,
      note: note || 'Progress update recorded.',
      evidenceFileName,
      evidenceUrl,
      evidenceFileSize,
    }

    let updated: Goal | null = null
    storageService.updateState((state) => {
      const goals = state.goals.map((g) => {
        if (g.id === goalId) {
          updated = {
            ...g,
            progress: boundedPct,
            status: boundedPct === 100 ? 'completed' : g.status,
            evidenceFileName: evidenceFileName || g.evidenceFileName,
            evidenceUrl: evidenceUrl || g.evidenceUrl,
            evidenceFileSize: evidenceFileSize || g.evidenceFileSize,
            progressHistory: [newLog, ...(g.progressHistory || [])],
            updatedAt: new Date().toISOString(),
          }
          return updated
        }
        return g
      })
      return { goals }
    })

    return updated!
  },

  async removeEvidence(goalId: string, updateId?: string): Promise<Goal> {
    const goal = await this.getById(goalId)
    if (!goal) throw new Error(`Goal ${goalId} not found`)

    let updated: Goal | null = null
    storageService.updateState((state) => {
      const goals = state.goals.map((g) => {
        if (g.id === goalId) {
          const updatedHistory = (g.progressHistory || []).map((p) => {
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

          const latestEvidence = updatedHistory.find((p) => p.evidenceFileName || p.evidenceUrl)

          updated = {
            ...g,
            evidenceFileName: latestEvidence?.evidenceFileName,
            evidenceUrl: latestEvidence?.evidenceUrl,
            evidenceFileSize: latestEvidence?.evidenceFileSize,
            progressHistory: updatedHistory,
            updatedAt: new Date().toISOString(),
          }
          return updated
        }
        return g
      })
      return { goals }
    })

    return updated!
  },

  async delete(goalId: string): Promise<boolean> {
    const goal = await this.getById(goalId)
    if (!goal) return false
    if (goal.status === 'approved' || goal.status === 'completed') {
      throw new Error('Approved or completed goals cannot be deleted.')
    }

    storageService.updateState((state) => ({
      goals: state.goals.filter((g) => g.id !== goalId),
    }))
    return true
  },
}

