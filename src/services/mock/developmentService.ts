import { DevelopmentPlan, GrowthAction } from '../../types'
import { storageService } from './storageService'
import { SEED_DEVELOPMENT_PLANS } from '../../data/seedData'

export const developmentService = {
  async getPlan(userId: string): Promise<DevelopmentPlan> {
    const plans = storageService.getState().developmentPlans || {}
    const existing = plans[userId]

    // Default empty plan if employee has no custom plan yet
    const defaultTemplate: DevelopmentPlan = SEED_DEVELOPMENT_PLANS[userId] || {
      id: `dev-${userId}`,
      userId,
      skills: [],
      agreedActions: [],
      recommendedCourses: [],
    }

    if (existing) {
      // Normalize and protect against missing array fields in stored state
      const normalizedPlan: DevelopmentPlan = {
        id: existing.id || defaultTemplate.id,
        userId: existing.userId || userId,
        skills: Array.isArray(existing.skills) && existing.skills.length > 0
          ? existing.skills
          : defaultTemplate.skills,
        agreedActions: Array.isArray(existing.agreedActions)
          ? existing.agreedActions
          : defaultTemplate.agreedActions,
        recommendedCourses: Array.isArray(existing.recommendedCourses) && existing.recommendedCourses.length > 0
          ? existing.recommendedCourses
          : defaultTemplate.recommendedCourses,
      }
      return normalizedPlan
    }

    storageService.updateState((state) => ({
      developmentPlans: { ...(state.developmentPlans || {}), [userId]: defaultTemplate },
    }))

    return defaultTemplate
  },

  async updateActionStatus(
    userId: string,
    actionId: string,
    status: GrowthAction['status']
  ): Promise<DevelopmentPlan> {
    const plan = await this.getPlan(userId)
    const updatedActions = (plan.agreedActions || []).map((a) =>
      a.id === actionId ? { ...a, status } : a
    )

    const updatedPlan: DevelopmentPlan = {
      ...plan,
      agreedActions: updatedActions,
    }

    storageService.updateState((state) => ({
      developmentPlans: { ...(state.developmentPlans || {}), [userId]: updatedPlan },
    }))

    return updatedPlan
  },

  async addAction(userId: string, title: string, targetDate: string): Promise<DevelopmentPlan> {
    const plan = await this.getPlan(userId)
    const newAction: GrowthAction = {
      id: `act-${Date.now()}`,
      title,
      targetDate,
      status: 'not_started',
    }

    const updatedPlan: DevelopmentPlan = {
      ...plan,
      agreedActions: [...(plan.agreedActions || []), newAction],
    }

    storageService.updateState((state) => ({
      developmentPlans: { ...(state.developmentPlans || {}), [userId]: updatedPlan },
    }))

    return updatedPlan
  },
}

