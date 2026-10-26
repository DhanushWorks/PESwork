import { CalibrationRecord, EvaluationResult, Goal, ManagerReview, SelfReview, User } from '../../types'
import { getRatingBand } from '../../lib/scoring'
import { matchesUser, matchesCycle } from '../../lib/workflow'
import { cycleService } from './cycleService'
import { storageService } from './storageService'

export type EvidencePdfMeta = {
  fileName: string
  fileUrl?: string
  title: string
  targetMetric?: string
  currentMetric?: string
  verifiedDate?: string
  hash?: string
  authorName?: string
  goalTitle?: string
}

export type GoalEvidenceItem = {
  id: string
  goalId: string
  goalTitle: string
  fileName: string
  fileUrl?: string
  fileSize?: string
  uploadedAt?: string
  note?: string
  isImage: boolean
  isPdf: boolean
}

export function isImageFile(fileName?: string, fileUrl?: string): boolean {
  if (!fileName && !fileUrl) return false
  const lowerName = (fileName || '').toLowerCase()
  const lowerUrl = (fileUrl || '').toLowerCase()
  return (
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.gif') ||
    lowerName.endsWith('.svg') ||
    lowerUrl.startsWith('data:image/')
  )
}

export function isPdfFile(fileName?: string, fileUrl?: string): boolean {
  if (!fileName && !fileUrl) return false
  const lowerName = (fileName || '').toLowerCase()
  const lowerUrl = (fileUrl || '').toLowerCase()
  return (
    lowerName.endsWith('.pdf') ||
    lowerUrl.startsWith('data:application/pdf') ||
    lowerUrl.includes('.pdf')
  )
}

export type CalibrationItem = {
  employee: User
  manager: User
  managerReview: ManagerReview
  selfReview?: SelfReview
  goals: Goal[]
  evidencePdf?: EvidencePdfMeta
  allEvidence: GoalEvidenceItem[]
  cycleId: string
  cycleName: string
  calibrationRecord?: CalibrationRecord
  currentScore: number
  ratingBand: string
  ratingLabel: string
  adminApproved: boolean
  adminApprovedAt?: string
}

export const calibrationService = {
  async listForCycle(cycleId: string): Promise<CalibrationItem[]> {
    const { users, cycles, managerReviews, selfReviews, goals, calibrations, results } = storageService.getState()

    const currentCycle = cycles.find((c) => c.id === cycleId || matchesCycle(c.id, cycleId))
    const cycleName = currentCycle?.name || '2026-H1 Annual Performance & Growth Review'

    const reviews = managerReviews.filter(
      (mr) =>
        (mr.cycleId === cycleId || matchesCycle(mr.cycleId, cycleId)) &&
        (mr.status === 'submitted' ||
          calibrations.some(
            (c) =>
              (c.cycleId === cycleId || matchesCycle(c.cycleId, cycleId)) &&
              (c.employeeId === mr.employeeId || matchesUser(c.employeeId, mr.employeeId))
          ))
    )

    return reviews.map((mr) => {
      const employee = users.find((u) => u.id === mr.employeeId || matchesUser(u.id, mr.employeeId)) || {
        id: mr.employeeId,
        name: 'Unknown Employee',
        email: '',
        role: 'employee' as const,
        department: 'Engineering',
        designation: 'Developer',
        employeeCode: 'EMP-000',
        active: true,
        joinedDate: '2024-01-01',
      }

      const manager = users.find((u) => u.id === mr.managerId || matchesUser(u.id, mr.managerId)) || {
        id: mr.managerId,
        name: 'Marcus Chen',
        email: 'marcus.chen@performiq.internal',
        role: 'manager' as const,
        department: 'Engineering',
        designation: 'Director of Engineering',
        employeeCode: 'EMP-014',
        active: true,
        joinedDate: '2022-06-01',
      }

      const selfReview = selfReviews.find(
        (sr) =>
          (sr.cycleId === cycleId || matchesCycle(sr.cycleId, cycleId)) &&
          (sr.userId === mr.employeeId || matchesUser(sr.userId, mr.employeeId))
      )
      const empGoals = goals.filter(
        (g) =>
          (g.cycleId === cycleId || matchesCycle(g.cycleId, cycleId)) &&
          (g.userId === mr.employeeId || matchesUser(g.userId, mr.employeeId))
      )

      // Collect all evidence items across all goals and their progress histories
      const allEvidence: GoalEvidenceItem[] = []

      empGoals.forEach((g) => {
        const seenInGoal = new Set<string>()

        // 1. Direct goal evidence
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

        // 2. All progress history evidence records
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

      // Backward compatible evidencePdf (uses actual first PDF or first evidence item)
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

      const cal = calibrations.find((c) => c.cycleId === cycleId && c.employeeId === mr.employeeId)
      const currentScore = cal ? cal.adjustedScore : mr.compositeScore
      const bandInfo = getRatingBand(currentScore)

      const hasApprovedResult = results.some(
        (r) => r.cycleId === cycleId && r.employeeId === mr.employeeId
      )
      const adminApproved = !!(cal?.adminApproved || (hasApprovedResult && cal?.adminApproved !== false))

      return {
        employee,
        manager,
        managerReview: mr,
        selfReview,
        goals: empGoals,
        evidencePdf,
        allEvidence,
        cycleId,
        cycleName,
        calibrationRecord: cal,
        currentScore,
        ratingBand: bandInfo.band,
        ratingLabel: bandInfo.label,
        adminApproved,
        adminApprovedAt: cal?.adminApprovedAt,
      }
    })
  },

  async calibrate(
    cycleId: string,
    employeeId: string,
    adjustedScore: number,
    reason: string,
    calibratedBy: string
  ): Promise<CalibrationRecord> {
    const originalReview = storageService
      .getState()
      .managerReviews.find((mr) => mr.cycleId === cycleId && mr.employeeId === employeeId)

    const existingCal = storageService
      .getState()
      .calibrations.find((c) => c.cycleId === cycleId && c.employeeId === employeeId)

    const originalScore = originalReview ? originalReview.compositeScore : adjustedScore

    const newRecord: CalibrationRecord = {
      id: existingCal?.id || `cal-${employeeId}-${Date.now()}`,
      cycleId,
      employeeId,
      originalScore,
      adjustedScore: Number(adjustedScore.toFixed(2)),
      reason,
      calibratedBy,
      calibratedAt: new Date().toISOString(),
      adminApproved: existingCal?.adminApproved || false,
      adminApprovedAt: existingCal?.adminApprovedAt,
      status: existingCal?.adminApproved ? 'approved' : 'pending_admin_approval',
    }

    storageService.updateState((state) => {
      const filtered = state.calibrations.filter(
        (c) => !(c.cycleId === cycleId && c.employeeId === employeeId)
      )

      const employee = state.users.find((u) => u.id === employeeId)
      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: calibratedBy,
        action: 'SCORE_CALIBRATED',
        entity: 'Calibration',
        entityId: newRecord.id,
        timestamp: new Date().toISOString(),
        details: `Saved calibrated score draft for ${employee?.name || employeeId} (${adjustedScore.toFixed(2)}). Justification: "${reason}".`,
      }

      return {
        calibrations: [...filtered, newRecord],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return newRecord
  },

  /**
   * Explicit Admin Permission:
   * Formally approves the employee's calibration outcome, creates the released EvaluationResult,
   * and advances this employee to the next cycle step (Results Released).
   */
  async approveAndRelease(
    cycleId: string,
    employeeId: string,
    calibratedBy: string,
    adjustedScore?: number,
    reason?: string
  ): Promise<{ calibration: CalibrationRecord; result: EvaluationResult }> {
    const state = storageService.getState()
    const cycle = await cycleService.getById(cycleId)
    const employee = state.users.find((u) => u.id === employeeId)
    const mr = state.managerReviews.find((r) => r.cycleId === cycleId && r.employeeId === employeeId)
    if (!mr) throw new Error(`Submitted manager review not found for employee ${employeeId}`)

    const existingCal = state.calibrations.find((c) => c.cycleId === cycleId && c.employeeId === employeeId)
    const finalScore = Number((adjustedScore ?? existingCal?.adjustedScore ?? mr.compositeScore).toFixed(2))
    const finalReason =
      reason ||
      existingCal?.reason ||
      `Committee consensus approved final rating of ${finalScore.toFixed(2)} with official executive sign-off.`

    const approvedCal: CalibrationRecord = {
      id: existingCal?.id || `cal-${employeeId}-${Date.now()}`,
      cycleId,
      employeeId,
      originalScore: mr.compositeScore,
      adjustedScore: finalScore,
      reason: finalReason,
      calibratedBy,
      calibratedAt: new Date().toISOString(),
      adminApproved: true,
      adminApprovedAt: new Date().toISOString(),
      status: 'approved',
    }

    const bandInfo = getRatingBand(finalScore)

    const evaluationResult: EvaluationResult = {
      id: `res-${employeeId}-${cycleId}`,
      cycleId,
      employeeId,
      managerId: mr.managerId,
      compositeScore: finalScore,
      finalRatingLabel: bandInfo.label,
      ratingBand: bandInfo.band,
      goalsScore: mr.goalsScore,
      competenciesScore: mr.competenciesScore,
      valuesScore: mr.valuesScore,
      managerComments:
        mr.overallComments || 'Appraisal review completed, calibrated, and officially approved by Admin.',
      agreedActions: [
        mr.growthAreas ? `Focus area: ${mr.growthAreas}` : 'Continue core strategic execution & architecture',
        mr.recommendations?.training
          ? 'Complete recommended advanced systems & technical leadership coursework'
          : 'Engage in cross-squad architecture reviews',
      ],
      acknowledged: false,
      disputeStatus: 'none',
    }

    const empNotif = {
      id: `notif-approved-${employeeId}-${Date.now()}`,
      userId: employeeId,
      title: 'Performance Results Released',
      message: `Your final evaluation for ${cycle?.name || 'Performance Cycle'} was approved and released by Admin. Click to view results.`,
      link: '/employee/results',
      read: false,
      createdAt: new Date().toISOString(),
      type: 'success' as const,
    }

    const mgrNotif = {
      id: `notif-mgr-approved-${employeeId}-${Date.now()}`,
      userId: mr.managerId,
      title: 'Appraisal Approved & Released',
      message: `Admin approved the calibrated evaluation for ${employee?.name || employeeId}. Results have been released.`,
      link: `/manager/reviews/${employeeId}`,
      read: false,
      createdAt: new Date().toISOString(),
      type: 'info' as const,
    }

    const audit = {
      id: `audit-${Date.now()}`,
      actorId: state.currentUserId,
      actorName: calibratedBy,
      action: 'CALIBRATION_ADMIN_APPROVED',
      entity: 'Calibration',
      entityId: approvedCal.id,
      timestamp: new Date().toISOString(),
      details: `Admin ${calibratedBy} formally approved calibration and granted permission to advance to next step for ${employee?.name || employeeId}. Final score: ${finalScore.toFixed(2)} (${bandInfo.label}).`,
    }

    storageService.updateState((s) => {
      const filteredCals = s.calibrations.filter((c) => !(c.cycleId === cycleId && c.employeeId === employeeId))
      const filteredResults = s.results.filter((r) => !(r.cycleId === cycleId && r.employeeId === employeeId))

      const updatedCycles = s.cycles.map((c) => {
        if (c.id === cycleId || matchesCycle(c.id, cycleId)) {
          if (c.stage === 'closed') return c
          return { ...c, stage: 'released' as const }
        }
        return c
      })

      return {
        cycles: updatedCycles,
        activeCycleId: cycleId,
        calibrations: [...filteredCals, approvedCal],
        results: [...filteredResults, evaluationResult],
        notifications: [empNotif, mgrNotif, ...s.notifications],
        auditLogs: [audit, ...s.auditLogs],
      }
    })

    try {
      const currentC = await cycleService.getById(cycleId)
      if (currentC?.stage !== 'closed') {
        await cycleService.setStage(cycleId, 'released')
      }
    } catch (e) {
      console.warn('Notice setting cycle stage in approveAndRelease:', e)
    }

    return { calibration: approvedCal, result: evaluationResult }
  },

  /**
   * Revert calibration permission back to calibration review
   */
  async revokePermission(cycleId: string, employeeId: string, adminName: string): Promise<void> {
    storageService.updateState((state) => {
      const employee = state.users.find((u) => u.id === employeeId)
      const mr = state.managerReviews.find((r) => r.cycleId === cycleId && r.employeeId === employeeId)
      const managerId = mr?.managerId || employee?.managerId
      const filteredResults = state.results.filter((r) => !(r.cycleId === cycleId && r.employeeId === employeeId))

      const updatedCals = state.calibrations.map((c) => {
        if (c.cycleId === cycleId && c.employeeId === employeeId) {
          return {
            ...c,
            adminApproved: false,
            adminApprovedAt: undefined,
            status: 'pending_admin_approval' as const,
          }
        }
        return c
      })

      const revokeNotifs = managerId
        ? [
            {
              id: `notif-revoked-${employeeId}-${Date.now()}`,
              userId: managerId,
              title: 'Appraisal Returned to Calibration',
              message: `Admin ${adminName} returned ${employee?.name || employeeId}'s appraisal back to calibration review.`,
              link: `/manager/reviews/${employeeId}`,
              read: false,
              createdAt: new Date().toISOString(),
              type: 'warning' as const,
            },
          ]
        : []

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: adminName,
        action: 'CALIBRATION_PERMISSION_REVOKED',
        entity: 'Calibration',
        entityId: `cal-${employeeId}`,
        timestamp: new Date().toISOString(),
        details: `Admin ${adminName} revoked release permission for ${employee?.name || employeeId}. Appraisal returned to Calibration stage.`,
      }

      return {
        calibrations: updatedCals,
        results: filteredResults,
        notifications: [...revokeNotifs, ...state.notifications],
        auditLogs: [audit, ...state.auditLogs],
      }
    })
  },

  async releaseCycle(cycleId: string): Promise<{ releasedCount: number }> {
    const cycle = await cycleService.getById(cycleId)
    if (!cycle) throw new Error(`Cycle ${cycleId} not found`)

    const { managerReviews, calibrations, users } = storageService.getState()
    const submittedReviews = managerReviews.filter((mr) => mr.cycleId === cycleId && mr.status === 'submitted')

    const newResults: EvaluationResult[] = submittedReviews.map((mr) => {
      const cal = calibrations.find((c) => c.cycleId === cycleId && c.employeeId === mr.employeeId)
      const finalScore = cal ? cal.adjustedScore : mr.compositeScore
      const bandInfo = getRatingBand(finalScore)

      return {
        id: `res-${mr.employeeId}-${cycleId}`,
        cycleId,
        employeeId: mr.employeeId,
        managerId: mr.managerId,
        compositeScore: finalScore,
        finalRatingLabel: bandInfo.label,
        ratingBand: bandInfo.band,
        goalsScore: mr.goalsScore,
        competenciesScore: mr.competenciesScore,
        valuesScore: mr.valuesScore,
        managerComments: mr.overallComments || 'Review completed, calibrated, and released by leadership.',
        agreedActions: [
          mr.growthAreas ? `Focus area: ${mr.growthAreas}` : 'Continue core strategic execution',
          mr.recommendations?.training
            ? 'Complete recommended leadership & technical coursework'
            : 'Engage with peer community',
        ],
        acknowledged: false,
        disputeStatus: 'none',
      }
    })

    // Advance cycle stage to 'released' if not already closed
    const currentC = await cycleService.getById(cycleId)
    if (currentC?.stage !== 'closed') {
      await cycleService.setStage(cycleId, 'released')
    }

    // Mark all calibrations for this cycle as approved
    const updatedCals = calibrations.map((c) => {
      if (c.cycleId === cycleId) {
        return {
          ...c,
          adminApproved: true,
          adminApprovedAt: new Date().toISOString(),
          status: 'approved' as const,
        }
      }
      return c
    })

    // Notifications for employees and managers
    const empNotifications = submittedReviews.map((mr) => {
      return {
        id: `notif-rel-${mr.employeeId}-${Date.now()}`,
        userId: mr.employeeId,
        title: 'Performance Results Released',
        message: `Your final evaluation for ${cycle.name} has been published. Please review and acknowledge.`,
        link: '/employee/results',
        read: false,
        createdAt: new Date().toISOString(),
        type: 'action' as const,
      }
    })

    const uniqueManagerIds = Array.from(new Set(submittedReviews.map((mr) => mr.managerId)))
    const mgrNotifications = uniqueManagerIds.map((mgrId) => ({
      id: `notif-mgr-rel-${mgrId}-${Date.now()}`,
      userId: mgrId,
      title: 'Cycle Calibration Released',
      message: `Final calibrated performance evaluation outcomes for ${cycle.name} have been released to your direct reports.`,
      link: '/manager',
      read: false,
      createdAt: new Date().toISOString(),
      type: 'info' as const,
    }))

    const notifications = [...empNotifications, ...mgrNotifications]

    storageService.updateState((state) => {
      const filteredResults = state.results.filter((r) => r.cycleId !== cycleId)

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: users.find((u) => u.id === state.currentUserId)?.name || 'Admin',
        action: 'CYCLE_RESULTS_RELEASED',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Admin batch released ${newResults.length} employee evaluation outcomes for ${cycle.name}.`,
      }

      return {
        calibrations: updatedCals,
        results: [...filteredResults, ...newResults],
        notifications: [...notifications, ...state.notifications],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return { releasedCount: newResults.length }
  },
}
