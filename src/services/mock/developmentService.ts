import { DevelopmentPlan, GrowthAction } from '../../types'
import { storageService } from './storageService'
import { FULL_SEED_DEVELOPMENT_PLANS } from '../../data/seedData'
import { toAppUserId, toDatabaseUserId } from '../../lib/workflow'

export const developmentService = {
  async getPlan(userId: string): Promise<DevelopmentPlan> {
    const plans = storageService.getState().developmentPlans || {}
    const appUserId = toAppUserId(userId)
    const dbUserId = toDatabaseUserId(userId)

    const existing = plans[userId] || plans[appUserId] || plans[dbUserId]

    // Default template from rich seed plans
    const defaultTemplate: DevelopmentPlan =
      FULL_SEED_DEVELOPMENT_PLANS[userId] ||
      FULL_SEED_DEVELOPMENT_PLANS[appUserId] ||
      FULL_SEED_DEVELOPMENT_PLANS[dbUserId] ||
      FULL_SEED_DEVELOPMENT_PLANS['u-emp-1'] || {
        id: `dev-${userId}`,
        userId,
        skills: [
          { name: 'React 19 & Micro-frontends', currentLevel: 4, targetLevel: 5 },
          { name: 'Distributed Systems & Caching', currentLevel: 3, targetLevel: 4 },
          { name: 'Web Accessibility (WCAG 2.1 AA)', currentLevel: 4, targetLevel: 5 },
          { name: 'System Architecture & RFC Leadership', currentLevel: 4, targetLevel: 5 },
        ],
        agreedActions: [
          { id: 'm-1', title: 'Pass Cloud Solutions Architect Certification', targetDate: '2026-11-30', status: 'completed' },
          { id: 'm-2', title: 'Deliver Keynote at Internal Tech Summit', targetDate: '2026-12-15', status: 'in_progress' },
          { id: 'm-3', title: 'Publish Design Token Integration Guidebook', targetDate: '2027-01-20', status: 'not_started' },
        ],
        recommendedCourses: [
          { id: 'c-1', title: 'Enterprise System Architecture at Scale', provider: 'PerformIQ Academy', duration: '12 hrs', status: 'completed' },
          { id: 'c-2', title: 'Strategic Communication for Staff Engineers', provider: 'Leadership Lab', duration: '8 hrs', status: 'recommended' },
          { id: 'c-3', title: 'High Performance Frontend Profiling', provider: 'Web Academy', duration: '6 hrs', status: 'enrolled' },
        ],
      }

    // Auto-heal empty plans from previous cached state
    const normalizedPlan: DevelopmentPlan = {
      id: existing?.id || defaultTemplate.id,
      userId: existing?.userId || userId,
      skills: Array.isArray(existing?.skills) && existing.skills.length > 0
        ? existing.skills
        : defaultTemplate.skills,
      agreedActions: Array.isArray(existing?.agreedActions) && existing.agreedActions.length > 0
        ? existing.agreedActions
        : defaultTemplate.agreedActions,
      recommendedCourses: Array.isArray(existing?.recommendedCourses) && existing.recommendedCourses.length > 0
        ? existing.recommendedCourses
        : defaultTemplate.recommendedCourses,
    }

    if (!existing || !existing.skills?.length || !existing.agreedActions?.length) {
      storageService.updateState((state) => ({
        developmentPlans: {
          ...(state.developmentPlans || {}),
          [userId]: normalizedPlan,
          [appUserId]: normalizedPlan,
          [dbUserId]: normalizedPlan,
        },
      }))
    }

    return normalizedPlan
  },

  async updateActionStatus(
    userId: string,
    actionId: string,
    status: GrowthAction['status']
  ): Promise<DevelopmentPlan> {
    const plan = await this.getPlan(userId)
    const appUserId = toAppUserId(userId)
    const dbUserId = toDatabaseUserId(userId)

    const updatedActions = (plan.agreedActions || []).map((a) =>
      a.id === actionId ? { ...a, status } : a
    )

    const updatedPlan: DevelopmentPlan = {
      ...plan,
      agreedActions: updatedActions,
    }

    storageService.updateState((state) => ({
      developmentPlans: {
        ...(state.developmentPlans || {}),
        [userId]: updatedPlan,
        [appUserId]: updatedPlan,
        [dbUserId]: updatedPlan,
      },
    }))

    return updatedPlan
  },

  async addAction(userId: string, title: string, targetDate: string): Promise<DevelopmentPlan> {
    const plan = await this.getPlan(userId)
    const appUserId = toAppUserId(userId)
    const dbUserId = toDatabaseUserId(userId)

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
      developmentPlans: {
        ...(state.developmentPlans || {}),
        [userId]: updatedPlan,
        [appUserId]: updatedPlan,
        [dbUserId]: updatedPlan,
      },
    }))

    return updatedPlan
  },
}
