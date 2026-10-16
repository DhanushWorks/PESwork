import { CalibrationRecord, EvaluationResult, ManagerReview, User } from '../../types'
import { getRatingBand } from '../../lib/scoring'
import { cycleService } from './cycleService'
import { storageService } from './storageService'

export type CalibrationItem = {
  employee: User
  manager: User
  managerReview: ManagerReview
  calibrationRecord?: CalibrationRecord
  currentScore: number
  ratingBand: string
  ratingLabel: string
}

export const calibrationService = {
  async listForCycle(cycleId: string): Promise<CalibrationItem[]> {
    const { users, managerReviews, calibrations } = storageService.getState()

    const reviews = managerReviews.filter((mr) => mr.cycleId === cycleId && mr.status === 'submitted')

    return reviews.map((mr) => {
      const employee = users.find((u) => u.id === mr.employeeId) || {
        id: mr.employeeId,
        name: 'Unknown Employee',
        email: '',
        role: 'employee',
        department: 'General',
        designation: '',
        employeeCode: '',
        active: true,
        joinedDate: '',
      }

      const manager = users.find((u) => u.id === mr.managerId) || {
        id: mr.managerId,
        name: 'Unknown Manager',
        email: '',
        role: 'manager',
        department: 'General',
        designation: '',
        employeeCode: '',
        active: true,
        joinedDate: '',
      }

      const cal = calibrations.find((c) => c.cycleId === cycleId && c.employeeId === mr.employeeId)
      const currentScore = cal ? cal.adjustedScore : mr.compositeScore
      const bandInfo = getRatingBand(currentScore)

      return {
        employee,
        manager,
        managerReview: mr,
        calibrationRecord: cal,
        currentScore,
        ratingBand: bandInfo.band,
        ratingLabel: bandInfo.label,
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

    const originalScore = originalReview ? originalReview.compositeScore : adjustedScore

    const newRecord: CalibrationRecord = {
      id: `cal-${employeeId}-${Date.now()}`,
      cycleId,
      employeeId,
      originalScore,
      adjustedScore: Number(adjustedScore.toFixed(2)),
      reason,
      calibratedBy,
      calibratedAt: new Date().toISOString(),
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
        details: `Adjusted score for ${employee?.name || employeeId} from ${originalScore} to ${adjustedScore}. Reason: "${reason}".`,
      }

      return {
        calibrations: [...filtered, newRecord],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return newRecord
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
        managerComments: mr.overallComments || 'Review completed and calibrated by leadership.',
        agreedActions: [
          mr.growthAreas ? `Focus area: ${mr.growthAreas}` : 'Continue core strategic execution',
          mr.recommendations.training ? 'Complete recommended leadership & technical coursework' : 'Engage with peer community',
        ],
        acknowledged: false,
        disputeStatus: 'none',
      }
    })

    // Advance cycle stage to 'released'
    await cycleService.setStage(cycleId, 'released')

    // Notifications for employees
    const notifications = submittedReviews.map((mr) => {
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

    storageService.updateState((state) => {
      // Replace or merge results for this cycle
      const filteredResults = state.results.filter((r) => r.cycleId !== cycleId)

      const audit = {
        id: `audit-${Date.now()}`,
        actorId: state.currentUserId,
        actorName: users.find((u) => u.id === state.currentUserId)?.name || 'Admin',
        action: 'CYCLE_RESULTS_RELEASED',
        entity: 'ReviewCycle',
        entityId: cycleId,
        timestamp: new Date().toISOString(),
        details: `Simulated release of ${newResults.length} employee evaluation results.`,
      }

      return {
        results: [...filteredResults, ...newResults],
        notifications: [...notifications, ...state.notifications],
        auditLogs: [audit, ...state.auditLogs],
      }
    })

    return { releasedCount: newResults.length }
  },
}

