import { ManagerReview, SelfReview, User } from '../../types'
import { calculateCompositeScore } from '../../lib/scoring'
import { cycleService } from './cycleService'
import { peopleService } from './peopleService'
import { storageService } from './storageService'

export type TeamReviewSummary = {
  employee: User
  selfReviewStatus: 'not_started' | 'draft' | 'submitted'
  selfReviewSubmittedAt?: string
  managerReviewStatus: 'not_started' | 'draft' | 'submitted'
  managerReviewSubmittedAt?: string
  compositeScore?: number
  goalsCount: number
  goalsApprovedCount: number
}

export const reviewService = {
  async getSelfReview(userId: string, cycleId: string): Promise<SelfReview | null> {
    const review = storageService
      .getState()
      .selfReviews.find((r) => r.userId === userId && r.cycleId === cycleId)
    return review ? { ...review } : null
  },

  async saveSelfDraft(reviewData: Partial<SelfReview> & { userId: string; cycleId: string }): Promise<SelfReview> {
    const existing = await this.getSelfReview(reviewData.userId, reviewData.cycleId)

    const updated: SelfReview = {
      id: existing ? existing.id : `sr-${reviewData.userId}-${Date.now()}`,
      userId: reviewData.userId,
      cycleId: reviewData.cycleId,
      status: 'draft',
      lastSavedAt: new Date().toISOString(),
      overallRating: Number(reviewData.overallRating) || 3.0,
      overallReflection: reviewData.overallReflection || '',
      achievements: reviewData.achievements || '',
      challenges: reviewData.challenges || '',
      developmentNeeds: reviewData.developmentNeeds || '',
      competencyRatings: reviewData.competencyRatings || {},
      valueRatings: reviewData.valueRatings || {},
    }

    storageService.updateState((state) => {
      const filtered = state.selfReviews.filter(
        (r) => !(r.userId === reviewData.userId && r.cycleId === reviewData.cycleId)
      )
      return { selfReviews: [...filtered, updated] }
    })

    return updated
  },

  async submitSelfReview(reviewData: Partial<SelfReview> & { userId: string; cycleId: string }): Promise<SelfReview> {
    const draft = await this.saveSelfDraft(reviewData)
    const submitted: SelfReview = {
      ...draft,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    }

    storageService.updateState((state) => {
      const filtered = state.selfReviews.filter(
        (r) => !(r.userId === reviewData.userId && r.cycleId === reviewData.cycleId)
      )

      const user = state.users.find((u) => u.id === reviewData.userId)
      const audit = {
        id: `audit-${Date.now()}`,
        actorId: reviewData.userId,
        actorName: user?.name || 'Employee',
        action: 'SELF_REVIEW_SUBMITTED',
        entity: 'SelfReview',
        entityId: submitted.id,
        timestamp: new Date().toISOString(),
        details: 'Submitted formal self-evaluation reflection and competency ratings.',
      }

      return {
        selfReviews: [...filtered, submitted],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return submitted
  },

  async listTeamReviews(managerId: string, cycleId: string): Promise<TeamReviewSummary[]> {
    const reports = await peopleService.getDirectReports(managerId)
    const { selfReviews, managerReviews, goals } = storageService.getState()

    return reports.map((employee) => {
      const sr = selfReviews.find((r) => r.userId === employee.id && r.cycleId === cycleId)
      const mr = managerReviews.find((r) => r.employeeId === employee.id && r.cycleId === cycleId)
      const userGoals = goals.filter((g) => g.userId === employee.id && g.cycleId === cycleId)

      return {
        employee,
        selfReviewStatus: sr ? sr.status : 'not_started',
        selfReviewSubmittedAt: sr?.submittedAt,
        managerReviewStatus: mr ? mr.status : 'not_started',
        managerReviewSubmittedAt: mr?.submittedAt,
        compositeScore: mr?.compositeScore,
        goalsCount: userGoals.length,
        goalsApprovedCount: userGoals.filter((g) => g.status === 'approved' || g.status === 'completed').length,
      }
    })
  },

  async getManagerReview(employeeId: string, cycleId: string): Promise<ManagerReview | null> {
    const review = storageService
      .getState()
      .managerReviews.find((r) => r.employeeId === employeeId && r.cycleId === cycleId)
    return review ? { ...review } : null
  },

  async saveManagerDraft(
    reviewData: Partial<ManagerReview> & { employeeId: string; managerId: string; cycleId: string }
  ): Promise<ManagerReview> {
    const cycle = await cycleService.getById(reviewData.cycleId)
    const weights = cycle?.weights || { goals: 50, competencies: 30, values: 20 }

    const goalsScore = Number(reviewData.goalsScore) || 3.0
    const competenciesScore = Number(reviewData.competenciesScore) || 3.0
    const valuesScore = Number(reviewData.valuesScore) || 3.0
    const compositeScore = calculateCompositeScore(goalsScore, competenciesScore, valuesScore, weights)

    const existing = await this.getManagerReview(reviewData.employeeId, reviewData.cycleId)

    const updated: ManagerReview = {
      id: existing ? existing.id : `mr-${reviewData.employeeId}-${Date.now()}`,
      employeeId: reviewData.employeeId,
      managerId: reviewData.managerId,
      cycleId: reviewData.cycleId,
      status: 'draft',
      lastSavedAt: new Date().toISOString(),
      goalsScore,
      competenciesScore,
      valuesScore,
      compositeScore,
      overallComments: reviewData.overallComments || '',
      strengths: reviewData.strengths || '',
      growthAreas: reviewData.growthAreas || '',
      recommendations: reviewData.recommendations || {
        promotion: false,
        increment: false,
        bonus: false,
        training: false,
        notes: '',
      },
    }

    storageService.updateState((state) => {
      const filtered = state.managerReviews.filter(
        (r) => !(r.employeeId === reviewData.employeeId && r.cycleId === reviewData.cycleId)
      )
      return { managerReviews: [...filtered, updated] }
    })

    return updated
  },

  async submitManagerReview(
    reviewData: Partial<ManagerReview> & { employeeId: string; managerId: string; cycleId: string }
  ): Promise<ManagerReview> {
    const draft = await this.saveManagerDraft(reviewData)
    const submitted: ManagerReview = {
      ...draft,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      lastSavedAt: new Date().toISOString(),
    }

    storageService.updateState((state) => {
      const filtered = state.managerReviews.filter(
        (r) => !(r.employeeId === reviewData.employeeId && r.cycleId === reviewData.cycleId)
      )

      const manager = state.users.find((u) => u.id === reviewData.managerId)
      const employee = state.users.find((u) => u.id === reviewData.employeeId)
      const audit = {
        id: `audit-${Date.now()}`,
        actorId: reviewData.managerId,
        actorName: manager?.name || 'Manager',
        action: 'MANAGER_REVIEW_SUBMITTED',
        entity: 'ManagerReview',
        entityId: submitted.id,
        timestamp: new Date().toISOString(),
        details: `Submitted formal evaluation for ${employee?.name || 'Employee'} (Score: ${submitted.compositeScore}).`,
      }

      return {
        managerReviews: [...filtered, submitted],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return submitted
  },
}

