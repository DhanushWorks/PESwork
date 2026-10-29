import { ManagerReview, SelfReview, User } from '../../types'
import { calculateCompositeScore } from '../../lib/scoring'
import { cycleService } from './cycleService'
import { peopleService } from './peopleService'
import { matchesUser, matchesCycle } from '../../lib/workflow'
import { storageService } from './storageService'
import { mockNotificationService } from './notificationService'

export type TeamReviewSummary = {
  employee: User
  selfReviewStatus: 'not_started' | 'draft' | 'submitted'
  selfReviewSubmittedAt?: string
  managerReviewStatus: 'not_started' | 'draft' | 'submitted'
  managerReviewSubmittedAt?: string
  compositeScore?: number
  goalsCount: number
  goalsApprovedCount: number
  isCalibrated?: boolean
  isReleased?: boolean
  adminApproved?: boolean
  calibratedScore?: number
  ratingBandLabel?: string
}

export const reviewService = {
  async getSelfReview(userId: string, cycleId: string): Promise<SelfReview | null> {
    const review = storageService
      .getState()
      .selfReviews.find((r) =>
        (r.userId === userId || matchesUser(r.userId, userId)) &&
        (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
      )
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

    // In-app notification: Notify assigned manager that self-review is submitted
    const state = storageService.getState()
    const employee = state.users.find((u) => u.id === reviewData.userId)
    const cycle = state.cycles.find((c) => c.id === reviewData.cycleId)
    const managerId = employee?.managerId
    if (managerId) {
      await mockNotificationService.create({
        id: `notif-self-review-${reviewData.userId}-${reviewData.cycleId}-${Date.now()}`,
        userId: managerId,
        title: 'Self-Review Submitted',
        message: `${employee?.name || 'Employee'} submitted their self-evaluation for ${cycle?.name || 'performance cycle'}. You can now complete your manager appraisal.`,
        link: `/manager/reviews/${reviewData.userId}`,
        type: 'action',
      })
    }

    return submitted
  },

  async listTeamReviews(managerId: string, cycleId: string): Promise<TeamReviewSummary[]> {
    const reports = await peopleService.getDirectReports(managerId)
    const { cycles, selfReviews, managerReviews, goals, calibrations, results } = storageService.getState()
    const cycle = cycles.find((c) => c.id === cycleId || matchesCycle(c.id, cycleId))

    // Only include direct reports who have been explicitly enrolled into this cycle by an Administrator
    const enrolledReports = reports.filter((employee) => {
      if (!cycle || !Array.isArray(cycle.participantIds)) return false
      return cycle.participantIds.some((pId) => pId === employee.id || matchesUser(pId, employee.id))
    })

    return enrolledReports.map((employee) => {
      const sr = selfReviews.find((r) =>
        (r.userId === employee.id || matchesUser(r.userId, employee.id)) &&
        (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
      )
      const mr = managerReviews.find((r) =>
        (r.employeeId === employee.id || matchesUser(r.employeeId, employee.id)) &&
        (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
      )
      const userGoals = goals.filter((g) =>
        (g.userId === employee.id || matchesUser(g.userId, employee.id)) &&
        (g.cycleId === cycleId || matchesCycle(g.cycleId, cycleId))
      )
      const cal = calibrations?.find((c) =>
        (c.employeeId === employee.id || matchesUser(c.employeeId, employee.id)) &&
        (c.cycleId === cycleId || matchesCycle(c.cycleId, cycleId))
      )
      const res = results?.find((r) =>
        (r.employeeId === employee.id || matchesUser(r.employeeId, employee.id)) &&
        (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
      )

      const isReleased = Boolean(res || cal?.adminApproved)
      const isMrSubmitted = mr?.status === 'submitted'
      const finalScore = res?.compositeScore ?? cal?.adjustedScore ?? (isMrSubmitted ? mr?.compositeScore : undefined)

      return {
        employee,
        selfReviewStatus: sr ? sr.status : 'not_started',
        selfReviewSubmittedAt: sr?.submittedAt,
        managerReviewStatus: mr ? mr.status : 'not_started',
        managerReviewSubmittedAt: mr?.submittedAt,
        compositeScore: finalScore,
        goalsCount: userGoals.length,
        goalsApprovedCount: userGoals.filter((g) => g.status === 'approved' || g.status === 'completed').length,
        isCalibrated: Boolean(cal),
        isReleased,
        adminApproved: cal?.adminApproved ?? false,
        calibratedScore: cal?.adjustedScore,
        ratingBandLabel: res?.finalRatingLabel,
      }
    })
  },

  async getManagerReview(employeeId: string, cycleId: string): Promise<ManagerReview | null> {
    const review = storageService
      .getState()
      .managerReviews.find((r) =>
        (r.employeeId === employeeId || matchesUser(r.employeeId, employeeId)) &&
        (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId))
      )
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

    // In-app notification: Notify authorized Admin(s) that manager evaluation is submitted and awaits calibration review
    const state = storageService.getState()
    const manager = state.users.find((u) => u.id === reviewData.managerId)
    const employee = state.users.find((u) => u.id === reviewData.employeeId)
    const adminUsers = state.users.filter((u) => u.role === 'admin')
    for (const admin of adminUsers) {
      await mockNotificationService.create({
        id: `notif-mgr-review-${reviewData.employeeId}-${admin.id}-${Date.now()}`,
        userId: admin.id,
        title: 'Manager Evaluation Submitted',
        message: `${manager?.name || 'Manager'} submitted performance evaluation for ${employee?.name || 'Employee'} (Score: ${submitted.compositeScore.toFixed(2)}). Awaiting calibration review.`,
        link: '/admin/calibration',
        type: 'action',
      })
    }

    return submitted
  },
}
