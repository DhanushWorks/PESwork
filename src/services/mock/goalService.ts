import { Goal, GoalStatus, ProgressLog } from '../../types'
import { validateGoalSet } from '../../lib/validation'
import { storageService } from './storageService'

export const goalService = {
  async listForUser(userId: string, cycleId?: string): Promise<Goal[]> {
    const goals = storageService.getState().goals.filter((g) => {
      const matchUser = g.userId === userId
      const matchCycle = cycleId ? g.cycleId === cycleId : true
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
        id: `goal-${Date.now()}`,
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

    return { success: true }
  },

  async decide(goalId: string, decision: 'approved' | 'returned', reason?: string): Promise<Goal> {
    const goal = await this.getById(goalId)
    if (!goal) throw new Error(`Goal ${goalId} not found`)

    if (decision === 'returned' && (!reason || reason.trim().length < 5)) {
      throw new Error('A descriptive comment is required when returning a goal for revision.')
    }

    let updated: Goal | null = null
    storageService.updateState((state) => {
      const goals = state.goals.map((g) => {
        if (g.id === goalId) {
          updated = {
            ...g,
            status: decision === 'approved' ? 'approved' : 'returned',
            returnReason: decision === 'returned' ? reason : undefined,
            updatedAt: new Date().toISOString(),
          }
          return updated
        }
        return g
      })

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
            ? `Approved goal "${goal.title}".`
            : `Returned goal "${goal.title}" with comment: "${reason}".`,
      }

      return {
        goals,
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return updated!
  },

  async addProgress(
    goalId: string,
    percentage: number,
    note: string,
    evidenceFileName?: string
  ): Promise<Goal> {
    const boundedPct = Math.max(0, Math.min(100, Math.round(percentage)))
    const goal = await this.getById(goalId)
    if (!goal) throw new Error(`Goal ${goalId} not found`)

    const newLog: ProgressLog = {
      id: `prog-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      percentage: boundedPct,
      note: note || 'Progress update recorded.',
      evidenceFileName,
    }

    let updated: Goal | null = null
    storageService.updateState((state) => {
      const goals = state.goals.map((g) => {
        if (g.id === goalId) {
          updated = {
            ...g,
            progress: boundedPct,
            status: boundedPct === 100 ? 'completed' : g.status,
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

