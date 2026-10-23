import {
  CycleStage,
  ReviewCycle,
  SelfReview,
  ManagerReview,
  EvaluationResult,
  Goal,
  CalibrationRecord,
  User,
} from '../types'
import { TeamReviewSummary } from '../services/mock/reviewService'
import { STAGE_ORDER, CYCLE_STAGE_DETAILS } from './formatters'

export type WorkflowStateInfo = {
  effectiveStage: CycleStage
  stageIndex: number
  stepNumber: number
  badgeLabel: string
  title: string
  description: string
  actionLabel: string
  actionLink: string
  secondaryActionLabel?: string
  secondaryActionLink?: string
}

/**
 * Calculates the synchronized workflow state for an individual Employee.
 */
export function getEmployeeWorkflowState(params: {
  cycle: ReviewCycle
  selfReview?: SelfReview | null
  managerReview?: ManagerReview | null
  result?: EvaluationResult | null
  hasGoals?: boolean
}): WorkflowStateInfo {
  const { cycle, selfReview, managerReview, result } = params

  const isManagerReviewSubmitted = managerReview?.status === 'submitted'
  const isSelfReviewSubmitted = selfReview?.status === 'submitted'

  let effectiveStage: CycleStage

  if (cycle.stage === 'closed' && result) {
    effectiveStage = 'closed'
  } else if (result) {
    // Evaluation results only advance to 'released' if Admin has formally reviewed & granted permission
    effectiveStage = 'released'
  } else if (isManagerReviewSubmitted) {
    // If manager submitted evaluation, it remains strictly in 'calibration' until Admin grants permission
    effectiveStage = 'calibration'
  } else if (isSelfReviewSubmitted || selfReview) {
    effectiveStage = 'manager_review'
  } else {
    const cycleStageIdx = STAGE_ORDER.indexOf(cycle.stage)
    const selfReviewIdx = STAGE_ORDER.indexOf('self_review')
    if (cycleStageIdx >= selfReviewIdx) {
      effectiveStage = 'self_review'
    } else {
      effectiveStage = cycle.stage
    }
  }

  const stageIndex = STAGE_ORDER.indexOf(effectiveStage)
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 1

  switch (effectiveStage) {
    case 'closed':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Cycle Closed',
        title: 'Cycle Closed',
        description: 'Evaluation archived.',
        actionLabel: 'View Final Results',
        actionLink: '/employee/results',
      }
    case 'released':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Results Released',
        title: 'Results Published',
        description: 'Appraisal score published.',
        actionLabel: 'View Final Results',
        actionLink: '/employee/results',
      }
    case 'calibration':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'In Calibration',
        title: 'Calibration',
        description: 'Evaluation in calibration.',
        actionLabel: 'View Submitted Review',
        actionLink: '/employee/self-review',
        secondaryActionLabel: 'View Goals & Evidence',
        secondaryActionLink: '/employee/goals',
      }
    case 'manager_review':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Manager Review',
        title: 'Manager Review',
        description: 'Manager appraisal in progress.',
        actionLabel: 'View Submitted Review',
        actionLink: '/employee/self-review',
        secondaryActionLabel: 'View Goals & Evidence',
        secondaryActionLink: '/employee/goals',
      }
    case 'self_review':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Self-Review',
        title: 'Self-Review',
        description: 'Self-evaluation open.',
        actionLabel: 'Start Self-Review',
        actionLink: '/employee/self-review',
        secondaryActionLabel: 'View Goals & Evidence',
        secondaryActionLink: '/employee/goals',
      }
    case 'tracking':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Goal Tracking',
        title: 'Goal Tracking',
        description: 'Update milestones and evidence.',
        actionLabel: 'View Goals & Evidence',
        actionLink: '/employee/goals',
      }
    case 'goals_open':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Goals Open',
        title: 'Goal Setting',
        description: 'Submit targets for approval.',
        actionLabel: 'Manage Goals',
        actionLink: '/employee/goals',
      }
    default:
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: CYCLE_STAGE_DETAILS[effectiveStage]?.label || 'Setup',
        title: 'Cycle Setup',
        description: 'Setup in progress.',
        actionLabel: 'View Goals & Evidence',
        actionLink: '/employee/goals',
      }
  }
}

/**
 * Calculates the synchronized workflow state for a Manager based on direct reports.
 */
export function getManagerWorkflowState(params: {
  cycle: ReviewCycle
  teamSummaries: TeamReviewSummary[]
  pendingGoals: Goal[]
  releasedResults?: EvaluationResult[]
}): WorkflowStateInfo {
  const { cycle, teamSummaries, pendingGoals, releasedResults = [] } = params

  const totalReports = teamSummaries.length
  const submittedSelfReviews = teamSummaries.filter((t) => t.selfReviewStatus === 'submitted')
  const submittedManagerReviews = teamSummaries.filter((t) => t.managerReviewStatus === 'submitted')
  const pendingManagerReviews = teamSummaries.filter(
    (t) => t.managerReviewStatus !== 'submitted' && t.selfReviewStatus === 'submitted'
  )
  const firstPendingReport =
    pendingManagerReviews[0]?.employee ||
    teamSummaries.find((t) => t.managerReviewStatus !== 'submitted')?.employee

  const hasReleasedResults =
    (releasedResults.length > 0 && totalReports > 0 && releasedResults.length >= totalReports) ||
    cycle.stage === 'released'

  let effectiveStage: CycleStage

  if (cycle.stage === 'closed') {
    effectiveStage = 'closed'
  } else if (hasReleasedResults) {
    effectiveStage = 'released'
  } else if (totalReports > 0 && submittedManagerReviews.length === totalReports) {
    // All direct reports' evaluations have been submitted to calibration
    effectiveStage = 'calibration'
  } else if (pendingManagerReviews.length > 0) {
    // Direct reports have submitted self-reviews; manager reviews pending
    effectiveStage = 'manager_review'
  } else if (totalReports > 0 && submittedManagerReviews.length > 0) {
    // Some manager reviews completed, remaining haven't submitted self-reviews yet
    effectiveStage = 'calibration'
  } else if (
    cycle.stage === 'self_review' ||
    (STAGE_ORDER.indexOf(cycle.stage) >= STAGE_ORDER.indexOf('self_review') &&
      submittedSelfReviews.length < totalReports)
  ) {
    effectiveStage = 'self_review'
  } else if (pendingGoals.length > 0 || cycle.stage === 'goals_open') {
    effectiveStage = 'goals_open'
  } else if (cycle.stage === 'tracking') {
    effectiveStage = 'tracking'
  } else {
    effectiveStage = cycle.stage
  }

  const stageIndex = STAGE_ORDER.indexOf(effectiveStage)
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 1

  switch (effectiveStage) {
    case 'closed':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Cycle Closed',
        title: 'Cycle Closed',
        description: 'Team evaluations archived.',
        actionLabel: 'Inspect Team Roster',
        actionLink: '#roster',
      }
    case 'released':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Results Released',
        title: 'Results Published',
        description: 'Outcomes published to team.',
        actionLabel: 'Inspect Team Roster',
        actionLink: '#roster',
      }
    case 'calibration':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'In Calibration',
        title: 'Calibration',
        description: 'Appraisals in calibration.',
        actionLabel: 'View Evaluation Roster',
        actionLink: '#roster',
      }
    case 'manager_review':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Review Required',
        title: 'Manager Reviews',
        description: `${pendingManagerReviews.length} appraisals pending.`,
        actionLabel: firstPendingReport
          ? `Evaluate ${firstPendingReport.name}`
          : 'Evaluate Direct Reports',
        actionLink: firstPendingReport ? `/manager/reviews/${firstPendingReport.id}` : '#roster',
        secondaryActionLabel: pendingGoals.length > 0 ? 'Goal Approvals' : undefined,
        secondaryActionLink: pendingGoals.length > 0 ? '/manager/approvals' : undefined,
      }
    case 'self_review':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Self-Reviews',
        title: 'Self-Reviews',
        description: `${submittedSelfReviews.length} of ${totalReports} submitted.`,
        actionLabel: 'Inspect Team Roster',
        actionLink: '#roster',
        secondaryActionLabel: pendingGoals.length > 0 ? 'Goal Approvals' : undefined,
        secondaryActionLink: pendingGoals.length > 0 ? '/manager/approvals' : undefined,
      }
    case 'goals_open':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Goal Approvals',
        title: 'Goal Approvals',
        description: `${pendingGoals.length} goals pending approval.`,
        actionLabel: 'Review Goals',
        actionLink: '/manager/approvals',
      }
    case 'tracking':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Goal Tracking',
        title: 'Goal Tracking',
        description: 'Team milestones in progress.',
        actionLabel: 'Inspect Team Roster',
        actionLink: '#roster',
      }
    default:
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: CYCLE_STAGE_DETAILS[effectiveStage]?.label || 'Setup',
        title: 'Cycle Setup',
        description: 'Setup in progress.',
        actionLabel: 'Inspect Team Roster',
        actionLink: '#roster',
      }
  }
}

/**
 * Calculates the synchronized workflow state for Admin across the entire cycle.
 */
export function getAdminWorkflowState(params: {
  cycle: ReviewCycle
  totalEmployees: number
  selfReviews: SelfReview[]
  managerReviews: ManagerReview[]
  calibrations: CalibrationRecord[]
  results: EvaluationResult[]
  goals?: Goal[]
}): WorkflowStateInfo {
  const { cycle, totalEmployees, selfReviews, managerReviews, calibrations, results, goals = [] } = params

  const cycleSelf = selfReviews.filter((s) => s.cycleId === cycle.id && s.status === 'submitted')
  const cycleMgr = managerReviews.filter((m) => m.cycleId === cycle.id && m.status === 'submitted')
  const approvedCals = calibrations.filter((c) => c.cycleId === cycle.id && c.adminApproved)
  const cycleResults = results.filter((r) => r.cycleId === cycle.id)
  const cycleGoals = goals.filter((g) => g.cycleId === cycle.id)

  const approvedGoals = cycleGoals.filter((g) => g.status === 'approved' || g.status === 'completed')
  const allGoalsApproved = cycleGoals.length > 0 && approvedGoals.length >= cycleGoals.length

  let effectiveStage: CycleStage

  if (cycle.stage === 'closed') {
    effectiveStage = 'closed'
  } else if (cycleResults.length > 0 || cycle.stage === 'released') {
    effectiveStage = 'released'
  } else if (cycleMgr.length > 0 || cycle.stage === 'calibration') {
    effectiveStage = 'calibration'
  } else if (cycleSelf.length > 0 || cycle.stage === 'manager_review') {
    effectiveStage = 'manager_review'
  } else if (cycle.stage === 'self_review') {
    effectiveStage = 'self_review'
  } else if (cycle.stage === 'tracking') {
    effectiveStage = 'tracking'
  } else if (cycle.stage === 'goals_open') {
    if (allGoalsApproved) {
      effectiveStage = 'tracking'
    } else {
      effectiveStage = 'goals_open'
    }
  } else {
    effectiveStage = cycle.stage
  }

  // Ensure effectiveStage is never behind cycle.stage if explicitly advanced by Admin
  const cycleStageIdx = STAGE_ORDER.indexOf(cycle.stage)
  const effectiveStageIdx = STAGE_ORDER.indexOf(effectiveStage)
  if (cycleStageIdx > effectiveStageIdx) {
    effectiveStage = cycle.stage
  }

  const stageIndex = STAGE_ORDER.indexOf(effectiveStage)
  const stepNumber = stageIndex >= 0 ? stageIndex + 1 : 1

  switch (effectiveStage) {
    case 'closed':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Cycle Closed',
        title: 'Cycle Closed',
        description: 'Evaluations completed and archived.',
        actionLabel: 'View Audit Records',
        actionLink: '/admin/audit',
      }
    case 'released':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Results Released',
        title: 'Results Published',
        description: `${cycleResults.length} outcomes released to employees.`,
        actionLabel: 'Open Calibration Hub',
        actionLink: '/admin/calibration',
        secondaryActionLabel: 'Cycle Governance',
        secondaryActionLink: `/admin/cycles/${cycle.id}`,
      }
    case 'calibration': {
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'In Calibration',
        title: 'Calibration Gate',
        description: `${approvedCals.length} of ${cycleMgr.length} appraisals approved.`,
        actionLabel: 'Open Calibration Hub',
        actionLink: '/admin/calibration',
        secondaryActionLabel: 'Cycle Settings',
        secondaryActionLink: `/admin/cycles/${cycle.id}`,
      }
    }
    case 'manager_review':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Manager Reviews',
        title: 'Manager Reviews',
        description: `${cycleSelf.length} self-evaluations submitted.`,
        actionLabel: 'Inspect Directory',
        actionLink: '/admin/users',
        secondaryActionLabel: 'Calibration Hub',
        secondaryActionLink: '/admin/calibration',
      }
    case 'self_review':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Self-Reviews',
        title: 'Self-Reviews',
        description: `${cycleSelf.length} of ${totalEmployees} submitted.`,
        actionLabel: 'Talent Directory',
        actionLink: '/admin/users',
      }
    case 'tracking':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Goal Tracking',
        title: 'Goal Tracking',
        description: 'Milestones and evidence in progress.',
        actionLabel: 'Cycle Management',
        actionLink: `/admin/cycles/${cycle.id}`,
      }
    case 'goals_open':
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: 'Goals Open',
        title: 'Goal Setting',
        description: `${approvedGoals.length} of ${cycleGoals.length} goals approved.`,
        actionLabel: 'Cycle Management',
        actionLink: `/admin/cycles/${cycle.id}`,
      }
    default:
      return {
        effectiveStage,
        stageIndex,
        stepNumber,
        badgeLabel: CYCLE_STAGE_DETAILS[effectiveStage]?.label || 'Setup',
        title: 'Cycle Setup',
        description: 'Setup in progress.',
        actionLabel: 'Cycle Management',
        actionLink: `/admin/cycles/${cycle.id}`,
      }
  }
}

export function matchesUser(idA?: string, idB?: string): boolean {
  if (!idA || !idB) return false
  if (idA === idB) return true
  const empIds = ['u-emp-1', '11111111-1111-1111-1111-111111111101']
  if (empIds.includes(idA) && empIds.includes(idB)) return true
  const mgrIds = ['u-mgr-1', '11111111-1111-1111-1111-111111111102']
  if (mgrIds.includes(idA) && mgrIds.includes(idB)) return true
  const adminIds = ['u-admin', '11111111-1111-1111-1111-111111111103']
  if (adminIds.includes(idA) && adminIds.includes(idB)) return true
  return false
}

export function matchesCycle(idA?: string, idB?: string): boolean {
  if (!idA || !idB) return false
  if (idA === idB) return true
  const c1Ids = ['cycle-2026-h1', '30000000-0000-0000-0000-000000000001']
  if (c1Ids.includes(idA) && c1Ids.includes(idB)) return true
  const c2Ids = ['cycle-2025-annual', 'cycle-2025-h2', '30000000-0000-0000-0000-000000000002']
  if (c2Ids.includes(idA) && c2Ids.includes(idB)) return true
  return false
}
