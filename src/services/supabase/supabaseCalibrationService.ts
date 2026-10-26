import { supabase, isSupabaseConfigured, isSupabaseReady, markSupabaseOffline } from '../../lib/supabase'
import { CalibrationRecord, Goal, ManagerReview, SelfReview, User } from '../../types'
import { getRatingBand } from '../../lib/scoring'
import { matchesCycle, matchesUser, toDatabaseUserId, resolveCycleUuid } from '../../lib/workflow'
import { supabaseNotificationService as notificationService } from './supabaseNotificationService'
import {
  calibrationService as mockCalibrationService,
  CalibrationItem,
  EvidencePdfMeta,
  GoalEvidenceItem,
  isImageFile,
  isPdfFile,
} from '../mock/calibrationService'
import { storageService } from '../mock/storageService'

export type { CalibrationItem, EvidencePdfMeta, GoalEvidenceItem }
export { isImageFile, isPdfFile }

function parseEvidenceMeta(url?: string): { url?: string; fileName?: string } {
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
    fileName = 'uploaded_evidence'
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

export const supabaseCalibrationService = {
  async listForCycle(cycleId: string): Promise<CalibrationItem[]> {
    if (!isSupabaseReady()) {
      return mockCalibrationService.listForCycle(cycleId)
    }

    try {
      // 1. Fetch Cycle to retrieve actual cycle name
      const { data: cycleData } = await supabase
        .from('review_cycles')
        .select('*')
        .or(`id.eq.${resolveCycleUuid(cycleId)},id.eq.${cycleId}`)
        .single()
      const targetCycleUuid = resolveCycleUuid(cycleId)
      const cycleName = cycleData?.name || (await mockCalibrationService.listForCycle(cycleId))?.[0]?.cycleName || 'FY 2026 H2 Performance Review'

      // 2. Fetch manager reviews for this cycle
      const { data: reviewsData, error: reviewsErr } = await supabase
        .from('manager_reviews')
        .select('*')
        .eq('cycle_id', targetCycleUuid)

      if (reviewsErr) {
        console.warn('Notice in supabaseCalibrationService.listForCycle:', reviewsErr.message)
        return mockCalibrationService.listForCycle(cycleId)
      }
      if (!reviewsData || reviewsData.length === 0) {
        return mockCalibrationService.listForCycle(cycleId)
      }

      // 3. Fetch profiles for employees & managers
      const employeeIds = reviewsData.map((r) => r.user_id)
      const reviewerIds = reviewsData.map((r) => r.reviewer_id)
      const allUserIds = Array.from(new Set([...employeeIds, ...reviewerIds]))

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', allUserIds)

      const userMap: Record<string, User> = {}
      if (profilesData) {
        profilesData.forEach((p) => {
          userMap[p.id] = {
            id: p.id,
            name: p.name,
            email: p.email,
            role: p.role,
            department: p.department || 'Engineering',
            designation: p.designation || 'Developer',
            employeeCode: p.employee_code || 'EMP-001',
            avatar: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            active: p.active !== false,
            joinedDate: p.created_at ? p.created_at.split('T')[0] : '2023-01-01',
          }
        })
      }

      // 4. Fetch Goals and Updates for these employees
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .or(`cycle_id.eq.${targetCycleUuid},cycle_id.eq.${cycleId}`)
        .in('user_id', employeeIds)

      const goalIds = goalsData ? goalsData.map((g) => g.id) : []
      const { data: updatesData } = goalIds.length > 0
        ? await supabase
            .from('goal_updates')
            .select('*')
            .in('goal_id', goalIds)
            .order('created_at', { ascending: false })
        : { data: [] }

      // 5. Fetch Calibrations, Self-Assessments, and Final Results
      const { data: calibrationsData } = await supabase
        .from('calibrations')
        .select('*')
        .or(`cycle_id.eq.${targetCycleUuid},cycle_id.eq.${cycleId}`)
        .in('user_id', employeeIds)

      const { data: selfAssessData } = await supabase
        .from('self_assessments')
        .select('*')
        .or(`cycle_id.eq.${targetCycleUuid},cycle_id.eq.${cycleId}`)
        .in('user_id', employeeIds)

      const { data: resultsData } = await supabase
        .from('final_results')
        .select('*')
        .or(`cycle_id.eq.${targetCycleUuid},cycle_id.eq.${cycleId}`)
        .in('user_id', employeeIds)

      // Group goal updates by goal_id
      const updatesByGoal: Record<string, any[]> = {}
      if (updatesData) {
        for (const u of updatesData) {
          if (!updatesByGoal[u.goal_id]) updatesByGoal[u.goal_id] = []
          const { url: cleanUrl, fileName } = parseEvidenceMeta(u.evidence_url)
          updatesByGoal[u.goal_id].push({
            id: u.id,
            date: u.created_at ? u.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            percentage: Number(u.progress || 0),
            note: u.note || '',
            evidenceFileName: fileName,
            evidenceUrl: cleanUrl,
          })
        }
      }

      // Assemble items
      return reviewsData.map((mr) => {
        const employee = userMap[mr.user_id] || {
          id: mr.user_id,
          name: 'Employee',
          email: '',
          role: 'employee',
          department: 'Engineering',
          designation: 'Developer',
          employeeCode: 'EMP-001',
          active: true,
          joinedDate: '2024-01-01',
        }

        const manager = userMap[mr.reviewer_id] || {
          id: mr.reviewer_id,
          name: 'Manager',
          email: '',
          role: 'manager',
          department: 'Engineering',
          designation: 'Director of Engineering',
          employeeCode: 'EMP-014',
          active: true,
          joinedDate: '2022-06-01',
        }

        // Map ManagerReview
        const answers = mr.answers || {}
        const compVals = mr.component_values || {}
        const goalsScore = Number(compVals.goals || mr.overall_rating || 4.0)
        const competenciesScore = Number(compVals.competencies || mr.overall_rating || 4.0)
        const valuesScore = Number(compVals.values || mr.overall_rating || 4.0)
        const compositeScore = Number(mr.overall_rating || 4.0)

        const managerReview: ManagerReview = {
          id: mr.id,
          employeeId: mr.user_id,
          managerId: mr.reviewer_id,
          cycleId: mr.cycle_id,
          status: mr.status as 'draft' | 'submitted',
          submittedAt: mr.submitted_at,
          lastSavedAt: mr.updated_at || mr.created_at || new Date().toISOString(),
          goalsScore,
          competenciesScore,
          valuesScore,
          compositeScore,
          overallComments: mr.comments || answers.overallComments || '',
          strengths: answers.strengths || '',
          growthAreas: answers.growthAreas || '',
          recommendations: mr.recommendations || {
            promotion: false,
            increment: false,
            bonus: false,
            training: false,
            notes: '',
          },
        }

        // Self Review
        const srRecord = selfAssessData?.find((s) => s.user_id === mr.user_id)
        const selfReview: SelfReview | undefined = srRecord
          ? {
              id: srRecord.id,
              userId: srRecord.user_id,
              cycleId: srRecord.cycle_id,
              status: srRecord.status as 'draft' | 'submitted',
              submittedAt: srRecord.submitted_at,
              lastSavedAt: srRecord.updated_at || srRecord.created_at,
              overallRating: Number(srRecord.overall_rating || 4.0),
              overallReflection: srRecord.answers?.overallReflection || '',
              achievements: srRecord.answers?.achievements || '',
              challenges: srRecord.answers?.challenges || '',
              developmentNeeds: srRecord.answers?.developmentNeeds || '',
              competencyRatings: srRecord.answers?.competencyRatings || {},
              valueRatings: srRecord.answers?.valueRatings || {},
            }
          : undefined

        // Goals
        const localEmpGoals = storageService
          .getState()
          .goals.filter(
            (g) =>
              (g.cycleId === cycleId || matchesCycle(g.cycleId, cycleId)) &&
              (g.userId === mr.user_id || matchesUser(g.userId, mr.user_id))
          )
        const userGoals = (goalsData && goalsData.length > 0)
          ? goalsData.filter((g) => g.user_id === mr.user_id)
          : localEmpGoals
        const mappedGoals: Goal[] = userGoals.map((g) => {
          const history = updatesByGoal[g.id] || []
          const latestEvidence = history.find((h) => h.evidenceFileName || h.evidenceUrl)
          return {
            id: g.id,
            userId: g.userId || g.user_id,
            cycleId: g.cycleId || g.cycle_id,
            title: g.title,
            description: g.description || '',
            metric: g.metric,
            target: Number(g.target),
            current: Number(g.progress),
            unit: g.unit,
            weight: Number(g.weight),
            progress: Number(g.progress),
            dueDate: g.dueDate || g.due_date,
            status: g.status,
            returnReason: g.returnReason || g.rejection_reason,
            evidenceFileName: g.evidenceFileName || latestEvidence?.evidenceFileName,
            evidenceUrl: g.evidenceUrl || latestEvidence?.evidenceUrl,
            progressHistory: (g.progressHistory && g.progressHistory.length > 0) ? g.progressHistory : history,
            createdAt: g.createdAt || g.created_at,
            updatedAt: g.updatedAt || g.updated_at,
          }
        })

        // Collect all evidence items across all goals
        const allEvidence: GoalEvidenceItem[] = []

        mappedGoals.forEach((g) => {
          const seenInGoal = new Set<string>()

          if (g.evidenceFileName || g.evidenceUrl) {
            const fn = g.evidenceFileName || 'evidence_document'
            const url = g.evidenceUrl
            const key = `${fn}::${url || ''}`
            seenInGoal.add(key)

            allEvidence.push({
              id: `ev-goal-${g.id}`,
              goalId: g.id,
              goalTitle: g.title,
              fileName: fn,
              fileUrl: url,
              fileSize: g.evidenceFileSize,
              uploadedAt: g.updatedAt || g.createdAt,
              note: 'Goal deliverable evidence',
              isImage: isImageFile(fn, url),
              isPdf: isPdfFile(fn, url),
            })
          }

          if (g.progressHistory && g.progressHistory.length > 0) {
            g.progressHistory.forEach((p) => {
              if (p.evidenceFileName || p.evidenceUrl) {
                const fn = p.evidenceFileName || 'progress_evidence'
                const url = p.evidenceUrl
                const key = `${fn}::${url || ''}`
                if (!seenInGoal.has(key)) {
                  seenInGoal.add(key)
                  allEvidence.push({
                    id: `ev-prog-${p.id}`,
                    goalId: g.id,
                    goalTitle: g.title,
                    fileName: fn,
                    fileUrl: url,
                    fileSize: p.evidenceFileSize,
                    uploadedAt: p.date,
                    note: p.note,
                    isImage: isImageFile(fn, url),
                    isPdf: isPdfFile(fn, url),
                  })
                }
              }
            })
          }
        })

        const firstEv = allEvidence.find((e) => e.isPdf) || allEvidence[0]
        const evidencePdf: EvidencePdfMeta | undefined = firstEv
          ? {
              fileName: firstEv.fileName,
              fileUrl: firstEv.fileUrl,
              title: `${firstEv.goalTitle} - Evidence`,
              authorName: employee.name,
              goalTitle: firstEv.goalTitle,
              verifiedDate: firstEv.uploadedAt ? firstEv.uploadedAt.split('T')[0] : undefined,
            }
          : undefined

        // Calibration record
        // Calibration record fallback to mock storage if Supabase is offline/empty
        const localCal = storageService
          .getState()
          .calibrations.find(
            (c) =>
              (c.cycleId === cycleId || matchesCycle(c.cycleId, cycleId)) &&
              (c.employeeId === mr.user_id || matchesUser(c.employeeId, mr.user_id))
          )
        const localResult = storageService
          .getState()
          .results.find(
            (r) =>
              (r.cycleId === cycleId || matchesCycle(r.cycleId, cycleId)) &&
              (r.employeeId === mr.user_id || matchesUser(r.employeeId, mr.user_id))
          )
        const cal = calibrationsData?.find((c) => c.user_id === mr.user_id)
        const calibrationRecord: CalibrationRecord | undefined = cal
          ? {
              id: cal.id,
              cycleId: cal.cycle_id,
              employeeId: cal.user_id,
              originalScore: Number(cal.original_score),
              adjustedScore: Number(cal.adjusted_score),
              reason: cal.reason,
              calibratedBy: cal.calibrated_by,
              calibratedAt: cal.created_at,
              adminApproved: true,
              status: 'approved',
            }
          : localCal

        const currentScore = calibrationRecord ? calibrationRecord.adjustedScore : compositeScore
        const bandInfo = getRatingBand(currentScore)

        const hasApprovedResult = (resultsData || []).some(
          (r) => r.user_id === mr.user_id && (r.status === 'approved' || r.status === 'released')
        )
        const adminApproved = !!(
          calibrationRecord?.adminApproved ||
          localCal?.adminApproved ||
          hasApprovedResult ||
          localResult
        )

        return {
          employee,
          manager,
          managerReview,
          selfReview,
          goals: mappedGoals,
          evidencePdf,
          allEvidence,
          cycleId,
          cycleName,
          calibrationRecord,
          currentScore,
          ratingBand: bandInfo.band,
          ratingLabel: bandInfo.label,
          adminApproved,
          adminApprovedAt: calibrationRecord?.adminApprovedAt,
        }
      })
    } catch (err) {
      markSupabaseOffline(err)
      console.warn('supabaseCalibrationService.listForCycle fallback to mock:', err)
      return mockCalibrationService.listForCycle(cycleId)
    }
  },

  async calibrate(
    cycleId: string,
    employeeId: string,
    adjustedScore: number,
    reason: string,
    calibratedBy: string
  ): Promise<CalibrationRecord> {
    if (isSupabaseConfigured) {
      const { error } = await supabase.rpc('calibrate_review', {
        p_cycle_id: cycleId,
        p_user_id: employeeId,
        p_score: adjustedScore,
        p_reason: reason,
      })

      if (error) {
        console.warn('RPC calibrate_review notice:', error.message)
      }
    }

    return mockCalibrationService.calibrate(cycleId, employeeId, adjustedScore, reason, calibratedBy)
  },

  async approveAndRelease(
    cycleId: string,
    employeeId: string,
    calibratedBy: string,
    adjustedScore?: number,
    reason?: string
  ) {
    if (isSupabaseConfigured) {
      try {
        if (adjustedScore && reason) {
          await supabase.rpc('calibrate_review', {
            p_cycle_id: resolveCycleUuid(cycleId),
            p_user_id: toDatabaseUserId(employeeId),
            p_score: adjustedScore,
            p_reason: reason,
          })
        }

        await supabase
          .from('final_results')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('cycle_id', resolveCycleUuid(cycleId))
          .eq('user_id', toDatabaseUserId(employeeId))

        // Advance cycle to Stage 7 (released) when admin grants permission
        await supabase
          .from('review_cycles')
          .update({
            stage: 'released',
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolveCycleUuid(cycleId))

        // Also notify employee
        await notificationService.create({
          userId: employeeId,
          title: 'Performance Appraisal Released',
          message: 'Your official performance appraisal outcome has been published by the administration committee.',
          link: '/employee/results',
          type: 'success',
        })
      } catch (e) {
        console.warn('Notice in supabase approveAndRelease:', e)
      }
    }

    return mockCalibrationService.approveAndRelease(cycleId, employeeId, calibratedBy, adjustedScore, reason)
  },

  async revokePermission(cycleId: string, employeeId: string, adminName: string): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('final_results')
          .update({
            status: 'pending',
            released_at: null,
            updated_at: new Date().toISOString(),
          })
          .or(`cycle_id.eq.${targetCycleUuid},cycle_id.eq.${cycleId}`)
          .eq('user_id', employeeId)
      } catch (e) {
        console.warn('Notice in supabase revokePermission:', e)
      }
    }

    return mockCalibrationService.revokePermission(cycleId, employeeId, adminName)
  },

  async releaseCycle(cycleId: string): Promise<{ releasedCount: number }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('release_cycle', {
        p_cycle_id: cycleId,
      })

      if (error) {
        console.warn('RPC release_cycle notice:', error.message)
      } else if (data?.released_results_count !== undefined) {
        await mockCalibrationService.releaseCycle(cycleId)
        return { releasedCount: data.released_results_count }
      }
    }

    return mockCalibrationService.releaseCycle(cycleId)
  },
}
