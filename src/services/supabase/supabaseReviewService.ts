import { apiCache } from '../../lib/apiCache'
import { supabase, isSupabaseConfigured, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { ManagerReview, SelfReview, User } from '../../types'
import { calculateCompositeScore } from '../../lib/scoring'
import { matchesCycle, matchesUser, toDatabaseUserId, resolveCycleUuid } from '../../lib/workflow'
import { supabaseCycleService as cycleService } from './supabaseCycleService'
import { supabasePeopleService as peopleService } from './supabasePeopleService'
import { reviewService as mockReviewService, TeamReviewSummary } from '../mock/reviewService'
import { storageService } from '../mock/storageService'
import { supabaseNotificationService as notificationService } from './supabaseNotificationService'

export type { TeamReviewSummary }

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

export const supabaseReviewService = {
  /**
   * Retrieve employee self-review for a specific cycle
   */
  async getSelfReview(userId: string, cycleId: string): Promise<SelfReview | null> {
    if (!isSupabaseReady()) return mockReviewService.getSelfReview(userId, cycleId)

    try {
      const { data, error } = await supabase
        .from('self_assessments')
        .select('*')
        .eq('user_id', toDatabaseUserId(userId))
        .eq('cycle_id', resolveCycleUuid(cycleId))
        .maybeSingle()

      if (error || !data) {
        return mockReviewService.getSelfReview(userId, cycleId)
      }

      const answers = data.answers || {}

      return {
        id: data.id,
        userId: data.user_id,
        cycleId: data.cycle_id,
        status: data.status as 'draft' | 'submitted',
        submittedAt: data.submitted_at || undefined,
        lastSavedAt: data.updated_at || data.created_at || new Date().toISOString(),
        overallRating: Number(data.overall_rating || 3.0),
        overallReflection: answers.overallReflection || '',
        achievements: answers.achievements || '',
        challenges: answers.challenges || '',
        developmentNeeds: answers.developmentNeeds || '',
        competencyRatings: answers.competencyRatings || {},
        valueRatings: answers.valueRatings || {},
      }
    } catch (err) {
      markSupabaseOffline(err)
      console.warn('Notice fetching self_assessments from Supabase:', err)
      return mockReviewService.getSelfReview(userId, cycleId)
    }
  },

  /**
   * Save draft self-review reflection and competency ratings
   */
  async saveSelfDraft(
    reviewData: Partial<SelfReview> & { userId: string; cycleId: string }
  ): Promise<SelfReview> {
    const mockUpdated = await mockReviewService.saveSelfDraft(reviewData)

    if (isSupabaseConfigured) {
      try {
        const tenantId = await getTenantId(reviewData.userId)
        const payload = {
          tenant_id: tenantId,
          cycle_id: resolveCycleUuid(reviewData.cycleId),
          user_id: toDatabaseUserId(reviewData.userId),
          overall_rating: Number(reviewData.overallRating) || 3.0,
          answers: {
            overallReflection: reviewData.overallReflection || '',
            achievements: reviewData.achievements || '',
            challenges: reviewData.challenges || '',
            developmentNeeds: reviewData.developmentNeeds || '',
            competencyRatings: reviewData.competencyRatings || {},
            valueRatings: reviewData.valueRatings || {},
          },
          status: 'draft',
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from('self_assessments')
          .upsert(payload, { onConflict: 'cycle_id,user_id' })
          .select()
          .single()

        if (!error && data) {
          return {
            ...mockUpdated,
            id: data.id,
            lastSavedAt: data.updated_at || data.created_at,
          }
        }
      } catch (err) {
        console.warn('Notice saving self draft in Supabase:', err)
      }
    }

    return mockUpdated
  },

  /**
   * Submit formal employee self-review with lock & manager notification
   */
  async submitSelfReview(
    reviewData: Partial<SelfReview> & { userId: string; cycleId: string }
  ): Promise<SelfReview> {
    const mockSubmitted = await mockReviewService.submitSelfReview(reviewData)

    if (isSupabaseConfigured) {
      try {
        const tenantId = await getTenantId(reviewData.userId)
        const submittedAt = new Date().toISOString()
        const payload = {
          tenant_id: tenantId,
          cycle_id: resolveCycleUuid(reviewData.cycleId),
          user_id: toDatabaseUserId(reviewData.userId),
          overall_rating: Number(reviewData.overallRating) || 3.0,
          answers: {
            overallReflection: reviewData.overallReflection || '',
            achievements: reviewData.achievements || '',
            challenges: reviewData.challenges || '',
            developmentNeeds: reviewData.developmentNeeds || '',
            competencyRatings: reviewData.competencyRatings || {},
            valueRatings: reviewData.valueRatings || {},
          },
          status: 'submitted',
          submitted_at: submittedAt,
          updated_at: submittedAt,
        }

        const { data, error } = await supabase
          .from('self_assessments')
          .upsert(payload, { onConflict: 'cycle_id,user_id' })
          .select()
          .single()

        // Fetch employee & manager profiles for notification & audit
        const employee = await peopleService.getById(reviewData.userId)
        const cycle = await cycleService.getById(reviewData.cycleId)

        if (employee?.managerId) {
          await notificationService.create({
            userId: employee.managerId,
            title: 'Self-Review Submitted',
            message: `${employee.name} submitted their self-evaluation for ${cycle?.name || 'performance cycle'}. You can now complete your manager appraisal.`,
            link: `/manager/reviews/${reviewData.userId}`,
            type: 'action',
          })
        }

        // Insert audit log
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId,
          actor_id: reviewData.userId,
          action: 'SELF_REVIEW_SUBMITTED',
          entity: 'self_assessments',
          entity_id: data?.id || null,
          details: {
            cycle_id: reviewData.cycleId,
            submitted_at: submittedAt,
            overall_rating: reviewData.overallRating,
          },
        })

        if (!error && data) {
          return {
            ...mockSubmitted,
            id: data.id,
            submittedAt: data.submitted_at,
            lastSavedAt: data.updated_at,
          }
        }
      } catch (err) {
        console.warn('Notice submitting self review to Supabase:', err)
      }
    }

    return mockSubmitted
  },

  /**
   * Retrieve manager review evaluation for an employee
   */
  async getManagerReview(employeeId: string, cycleId: string): Promise<ManagerReview | null> {
    if (!isSupabaseReady()) return mockReviewService.getManagerReview(employeeId, cycleId)

    try {
      const { data, error } = await supabase
        .from('manager_reviews')
        .select('*')
        .eq('user_id', toDatabaseUserId(employeeId))
        .eq('cycle_id', resolveCycleUuid(cycleId))
        .maybeSingle()

      if (error || !data) {
        return mockReviewService.getManagerReview(employeeId, cycleId)
      }

      const compValues = data.component_values || {}
      const answers = data.answers || {}

      return {
        id: data.id,
        employeeId: data.user_id,
        managerId: data.reviewer_id,
        cycleId: data.cycle_id,
        status: data.status as 'draft' | 'submitted',
        submittedAt: data.submitted_at || undefined,
        lastSavedAt: data.updated_at || data.created_at || new Date().toISOString(),
        goalsScore: Number(compValues.goalsScore || 3.0),
        competenciesScore: Number(compValues.competenciesScore || 3.0),
        valuesScore: Number(compValues.valuesScore || 3.0),
        compositeScore: Number(data.overall_rating || compValues.compositeScore || 3.0),
        overallComments: data.comments || '',
        strengths: answers.strengths || '',
        growthAreas: answers.growthAreas || '',
        recommendations: data.recommendations || {
          promotion: false,
          increment: false,
          bonus: false,
          training: false,
          notes: '',
        },
      }
    } catch (err) {
      console.warn('Notice fetching manager_reviews from Supabase:', err)
      return mockReviewService.getManagerReview(employeeId, cycleId)
    }
  },

  /**
   * Save draft manager performance evaluation
   */
  async saveManagerDraft(
    reviewData: Partial<ManagerReview> & { employeeId: string; managerId: string; cycleId: string }
  ): Promise<ManagerReview> {
    const cycle = await cycleService.getById(reviewData.cycleId)
    const weights = cycle?.weights || { goals: 60, competencies: 25, values: 15 }

    const goalsScore = Number(reviewData.goalsScore) || 3.0
    const competenciesScore = Number(reviewData.competenciesScore) || 3.0
    const valuesScore = Number(reviewData.valuesScore) || 3.0
    const compositeScore = calculateCompositeScore(goalsScore, competenciesScore, valuesScore, weights)

    const mockUpdated = await mockReviewService.saveManagerDraft({
      ...reviewData,
      goalsScore,
      competenciesScore,
      valuesScore,
      compositeScore,
    })

    if (isSupabaseConfigured) {
      try {
        const tenantId = await getTenantId(reviewData.managerId)
        const payload = {
          tenant_id: tenantId,
          cycle_id: resolveCycleUuid(reviewData.cycleId),
          user_id: toDatabaseUserId(reviewData.employeeId),
          reviewer_id: toDatabaseUserId(reviewData.managerId),
          overall_rating: compositeScore,
          component_values: {
            goalsScore,
            competenciesScore,
            valuesScore,
            compositeScore,
          },
          answers: {
            strengths: reviewData.strengths || '',
            growthAreas: reviewData.growthAreas || '',
          },
          comments: reviewData.overallComments || '',
          recommendations: reviewData.recommendations || {},
          status: 'draft',
          updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
          .from('manager_reviews')
          .upsert(payload, { onConflict: 'cycle_id,user_id' })
          .select()
          .single()

        if (!error && data) {
          return {
            ...mockUpdated,
            id: data.id,
            lastSavedAt: data.updated_at || data.created_at,
          }
        }
      } catch (err) {
        console.warn('Notice saving manager review draft to Supabase:', err)
      }
    }

    return mockUpdated
  },

  /**
   * Submit formal manager evaluation with weighted composite score
   */
  async submitManagerReview(
    reviewData: Partial<ManagerReview> & { employeeId: string; managerId: string; cycleId: string }
  ): Promise<ManagerReview> {
    const cycle = await cycleService.getById(reviewData.cycleId)
    const weights = cycle?.weights || { goals: 60, competencies: 25, values: 15 }

    const goalsScore = Number(reviewData.goalsScore) || 3.0
    const competenciesScore = Number(reviewData.competenciesScore) || 3.0
    const valuesScore = Number(reviewData.valuesScore) || 3.0
    const compositeScore = calculateCompositeScore(goalsScore, competenciesScore, valuesScore, weights)

    const mockSubmitted = await mockReviewService.submitManagerReview({
      ...reviewData,
      goalsScore,
      competenciesScore,
      valuesScore,
      compositeScore,
    })

    if (isSupabaseConfigured) {
      try {
        const tenantId = await getTenantId(reviewData.managerId)
        const submittedAt = new Date().toISOString()
        const payload = {
          tenant_id: tenantId,
          cycle_id: resolveCycleUuid(reviewData.cycleId),
          user_id: toDatabaseUserId(reviewData.employeeId),
          reviewer_id: toDatabaseUserId(reviewData.managerId),
          overall_rating: compositeScore,
          component_values: {
            goalsScore,
            competenciesScore,
            valuesScore,
            compositeScore,
          },
          answers: {
            strengths: reviewData.strengths || '',
            growthAreas: reviewData.growthAreas || '',
          },
          comments: reviewData.overallComments || '',
          recommendations: reviewData.recommendations || {},
          status: 'submitted',
          submitted_at: submittedAt,
          updated_at: submittedAt,
        }

        const { data, error } = await supabase
          .from('manager_reviews')
          .upsert(payload, { onConflict: 'cycle_id,user_id' })
          .select()
          .single()

        // Upsert initial final_results entry so calibration committee can review it immediately
        const ratingLabel =
          compositeScore >= 4.5
            ? 'Outstanding'
            : compositeScore >= 3.5
            ? 'Exceeds Expectations'
            : compositeScore >= 2.5
            ? 'Meets Expectations'
            : compositeScore >= 1.5
            ? 'Needs Improvement'
            : 'Unsatisfactory'

        await supabase.from('final_results').upsert(
          {
            tenant_id: tenantId,
            cycle_id: reviewData.cycleId,
            user_id: reviewData.employeeId,
            components: { goalsScore, competenciesScore, valuesScore },
            weights,
            final_score: compositeScore,
            rating_label: ratingLabel,
            status: 'pending',
            updated_at: submittedAt,
          },
          { onConflict: 'cycle_id,user_id' }
        )

        // Notify Admins
        const manager = await peopleService.getById(reviewData.managerId)
        const employee = await peopleService.getById(reviewData.employeeId)
        const allUsers: User[] = await peopleService.list()
        const adminUsers = allUsers.filter((u: User) => u.role === 'admin')

        for (const admin of adminUsers) {
          await notificationService.create({
            userId: admin.id,
            title: 'Manager Evaluation Submitted',
            message: `${manager?.name || 'Manager'} submitted performance evaluation for ${employee?.name || 'Employee'} (Score: ${compositeScore.toFixed(2)}). Awaiting calibration review.`,
            link: '/admin/calibration',
            type: 'action',
          })
        }

        // Insert audit log
        await supabase.from('audit_logs').insert({
          tenant_id: tenantId,
          actor_id: reviewData.managerId,
          action: 'MANAGER_REVIEW_SUBMITTED',
          entity: 'manager_reviews',
          entity_id: data?.id || null,
          details: {
            cycle_id: reviewData.cycleId,
            employee_id: reviewData.employeeId,
            composite_score: compositeScore,
          },
        })

        if (!error && data) {
          return {
            ...mockSubmitted,
            id: data.id,
            submittedAt: data.submitted_at,
            lastSavedAt: data.updated_at,
          }
        }
      } catch (err) {
        console.warn('Notice submitting manager review to Supabase:', err)
      }
    }

    return mockSubmitted
  },

  /**
   * List team members with appraisal status for manager direct reports
   */
  async listTeamReviews(managerId: string, cycleId: string): Promise<TeamReviewSummary[]> {
    return apiCache.getOrFetch(`reviews:team:${managerId}:${cycleId}`, async () => {
    if (!isSupabaseReady()) return mockReviewService.listTeamReviews(managerId, cycleId)

    try {
      const dbCycleId = resolveCycleUuid(cycleId)
      const reports: User[] = await peopleService.getDirectReports(managerId)
      if (reports.length === 0) return mockReviewService.listTeamReviews(managerId, cycleId)

      const reportIds = reports.map((r: User) => r.id)

      // Fetch all self reviews, manager reviews, and goals in parallel
      const [srRes, mrRes, gRes] = await Promise.all([
        supabase
          .from('self_assessments')
          .select('id, user_id, status, submitted_at')
          .eq('cycle_id', dbCycleId)
          .in('user_id', reportIds.map(toDatabaseUserId)),
        supabase
          .from('manager_reviews')
          .select('id, user_id, status, overall_rating, submitted_at, component_values')
          .eq('cycle_id', resolveCycleUuid(cycleId))
          .in('user_id', reportIds),
        supabase
          .from('goals')
          .select('id, user_id, status')
          .eq('cycle_id', cycleId)
          .in('user_id', reportIds),
      ])

      const selfMap = new Map((srRes.data || []).map((s: any) => [s.user_id, s]))
      const managerMap = new Map((mrRes.data || []).map((m: any) => [m.user_id, m]))
      const goalsList = gRes.data || []

      // If no Supabase data found for direct reports, fall back to mock service
      if (selfMap.size === 0 && managerMap.size === 0 && goalsList.length === 0) {
        return mockReviewService.listTeamReviews(managerId, cycleId)
      }

      return reports.map((emp: User) => {
        const sr = selfMap.get(emp.id)
        const mr = managerMap.get(emp.id)
        const userGoals = goalsList.filter((g) => g.user_id === emp.id)
        const approvedGoals = userGoals.filter((g) => g.status === 'approved' || g.status === 'completed')

        return {
          employee: emp,
          selfReviewStatus: sr ? (sr.status as any) : 'not_started',
          selfReviewSubmittedAt: sr?.submitted_at || undefined,
          managerReviewStatus: mr ? (mr.status as any) : 'not_started',
          managerReviewSubmittedAt: mr?.submitted_at || undefined,
          compositeScore: mr ? Number(mr.overall_rating || mr.component_values?.compositeScore) : undefined,
          goalsCount: userGoals.length,
          goalsApprovedCount: approvedGoals.length,
        }
      })
    } catch (err) {
      console.warn('Notice listing team reviews from Supabase:', err)
      return mockReviewService.listTeamReviews(managerId, cycleId)
    }
    }, 45000)
  },

  /**
   * List all self reviews for a cycle (Administrative view)
   */
  async listAllSelfReviews(cycleId: string): Promise<SelfReview[]> {
    return apiCache.getOrFetch(`reviews:self:${cycleId}`, async () => {
    if (!isSupabaseReady()) return storageService.getState().selfReviews.filter((s) => s.cycleId === cycleId || matchesCycle(s.cycleId, cycleId))

    try {
      const { data, error } = await supabase
        .from('self_assessments')
        .select('*')
        .eq('cycle_id', cycleId)

      if (error || !data || data.length === 0) {
        return storageService.getState().selfReviews.filter((s) => s.cycleId === cycleId || matchesCycle(s.cycleId, cycleId))
      }

      return data.map((d) => {
        const answers = d.answers || {}
        return {
          id: d.id,
          userId: d.user_id,
          cycleId: d.cycle_id,
          status: d.status as any,
          submittedAt: d.submitted_at || undefined,
          lastSavedAt: d.updated_at || d.created_at,
          overallRating: Number(d.overall_rating || 3.0),
          overallReflection: answers.overallReflection || '',
          achievements: answers.achievements || '',
          challenges: answers.challenges || '',
          developmentNeeds: answers.developmentNeeds || '',
          competencyRatings: answers.competencyRatings || {},
          valueRatings: answers.valueRatings || {},
        }
      })
    } catch {
      return storageService.getState().selfReviews.filter((s) => s.cycleId === cycleId || matchesCycle(s.cycleId, cycleId))
    }
    }, 45000)
  },

  /**
   * List all manager reviews for a cycle (Administrative view)
   */
  async listAllManagerReviews(cycleId: string): Promise<ManagerReview[]> {
    return apiCache.getOrFetch(`reviews:mgr:${cycleId}`, async () => {
    if (!isSupabaseReady()) return storageService.getState().managerReviews.filter((m) => m.cycleId === cycleId || matchesCycle(m.cycleId, cycleId))

    try {
      const { data, error } = await supabase
        .from('manager_reviews')
        .select('*')
        .eq('cycle_id', cycleId)

      if (error || !data || data.length === 0) {
        return storageService.getState().managerReviews.filter((m) => m.cycleId === cycleId || matchesCycle(m.cycleId, cycleId))
      }

      return data.map((d) => {
        const comp = d.component_values || {}
        const answers = d.answers || {}
        return {
          id: d.id,
          employeeId: d.user_id,
          managerId: d.reviewer_id,
          cycleId: d.cycle_id,
          status: d.status as any,
          submittedAt: d.submitted_at || undefined,
          lastSavedAt: d.updated_at || d.created_at,
          goalsScore: Number(comp.goalsScore || 3.0),
          competenciesScore: Number(comp.competenciesScore || 3.0),
          valuesScore: Number(comp.valuesScore || 3.0),
          compositeScore: Number(d.overall_rating || comp.compositeScore || 3.0),
          overallComments: d.comments || '',
          strengths: answers.strengths || '',
          growthAreas: answers.growthAreas || '',
          recommendations: d.recommendations || { promotion: false, increment: false, bonus: false, training: false, notes: '' },
        }
      })
    } catch {
      return storageService.getState().managerReviews.filter((m) => m.cycleId === cycleId || matchesCycle(m.cycleId, cycleId))
    }
    }, 45000)
  },
}

export { supabaseReviewService as reviewService }
