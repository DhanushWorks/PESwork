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
  goals?: Goal[]
}): WorkflowStateInfo {
  const { cycle, selfReview, managerReview, result, goals = [] } = params

  const isManagerReviewSubmitted = managerReview?.status === 'submitted'
  const isSelfReviewSubmitted = selfReview?.status === 'submitted'
  const isResultReleased =
    cycle.stage === 'released' ||
    (!!result && (result as any).status !== 'pending' && (result as any).isReleased !== false)

  const hasApprovedGoals = goals.some((g) => g.status === 'approved' || g.status === 'completed')
  const hasPendingGoals = goals.some((g) => g.status === 'pending_approval' || g.status === 'draft' || g.status === 'returned')
  const allGoalsApproved = goals.length > 0 && goals.every((g) => g.status === 'approved' || g.status === 'completed')

  let effectiveStage: CycleStage

  if (cycle.stage === 'closed') {
    effectiveStage = 'closed'
  } else if (isResultReleased) {
    effectiveStage = 'released'
  } else if (isManagerReviewSubmitted || cycle.stage === 'calibration') {
    effectiveStage = 'calibration'
  } else if (isSelfReviewSubmitted || selfReview || cycle.stage === 'manager_review') {
    effectiveStage = 'manager_review'
  } else if (cycle.stage === 'self_review') {
    effectiveStage = 'self_review'
  } else if (allGoalsApproved || cycle.stage === 'tracking' || (hasApprovedGoals && !hasPendingGoals)) {
    effectiveStage = 'tracking'
  } else if (hasPendingGoals || cycle.stage === 'goals_open') {
    effectiveStage = 'goals_open'
  } else {
    effectiveStage = cycle.stage
  }

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

  const cleanReleasedResults = releasedResults.filter((r) => (r as any).status !== 'pending')
  const hasReleasedResults =
    cycle.stage === 'released' ||
    (cleanReleasedResults.length > 0 && totalReports > 0 && cleanReleasedResults.length >= totalReports) ||
    cleanReleasedResults.length > 0

  const allTeamGoalsApproved =
    totalReports > 0
      ? teamSummaries.every((t) => t.goalsCount > 0 && t.goalsApprovedCount >= t.goalsCount)
      : pendingGoals.length === 0

  let effectiveStage: CycleStage

  if (cycle.stage === 'closed') {
    effectiveStage = 'closed'
  } else if (hasReleasedResults) {
    effectiveStage = 'released'
  } else if (
    cycle.stage === 'calibration' ||
    (totalReports > 0 && submittedManagerReviews.length === totalReports) ||
    submittedManagerReviews.length > 0
  ) {
    effectiveStage = 'calibration'
  } else if (pendingManagerReviews.length > 0 || cycle.stage === 'manager_review') {
    effectiveStage = 'manager_review'
  } else if (submittedSelfReviews.length > 0 || cycle.stage === 'self_review') {
    effectiveStage = submittedSelfReviews.length > 0 ? 'manager_review' : 'self_review'
  } else if (pendingGoals.length > 0) {
    effectiveStage = 'goals_open'
  } else if (allTeamGoalsApproved || cycle.stage === 'tracking') {
    effectiveStage = 'tracking'
  } else if (cycle.stage === 'goals_open') {
    const hasAnyGoals = teamSummaries.some((t) => t.goalsCount > 0)
    effectiveStage = hasAnyGoals ? 'tracking' : 'goals_open'
  } else {
    effectiveStage = cycle.stage
  }

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

  const cycleSelf = selfReviews.filter((s) => (s.cycleId === cycle.id || matchesCycle(s.cycleId, cycle.id)) && s.status === 'submitted')
  const cycleMgr = managerReviews.filter((m) => (m.cycleId === cycle.id || matchesCycle(m.cycleId, cycle.id)) && m.status === 'submitted')
  const approvedCals = calibrations.filter((c) => (c.cycleId === cycle.id || matchesCycle(c.cycleId, cycle.id)) && c.adminApproved)
  const cycleResults = results.filter((r) => (r.cycleId === cycle.id || matchesCycle(r.cycleId, cycle.id)) && (r as any).status !== 'pending')
  const cycleGoals = goals.filter((g) => g.cycleId === cycle.id || matchesCycle(g.cycleId, cycle.id))

  const approvedGoals = cycleGoals.filter((g) => g.status === 'approved' || g.status === 'completed')
  const pendingGoals = cycleGoals.filter((g) => g.status === 'pending_approval' || g.status === 'draft')
  const allGoalsApproved =
    (cycleGoals.length > 0 && approvedGoals.length >= cycleGoals.length) ||
    (cycleGoals.length > 0 && pendingGoals.length === 0)

  const isFormallyReleased =
    cycle.stage === 'released' ||
    cycle.stage === 'closed' ||
    cycleResults.length > 0 ||
    approvedCals.some((c) => c.adminApproved || (c as any).status === 'approved')

  let effectiveStage: CycleStage

  if (cycle.stage === 'closed') {
    effectiveStage = 'closed'
  } else if (isFormallyReleased) {
    effectiveStage = 'released'
  } else if (cycleMgr.length > 0 || cycle.stage === 'calibration') {
    effectiveStage = 'calibration'
  } else if (cycleSelf.length > 0 || cycle.stage === 'manager_review') {
    effectiveStage = 'manager_review'
  } else if (cycle.stage === 'self_review') {
    effectiveStage = 'self_review'
  } else if (cycle.stage === 'tracking' || allGoalsApproved) {
    effectiveStage = 'tracking'
  } else if (cycle.stage === 'goals_open') {
    effectiveStage = allGoalsApproved ? 'tracking' : 'goals_open'
  } else {
    effectiveStage = cycle.stage
  }

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
  const c1Ids = [
    'cycle-2026-h1',
    'cycle-2026-h2',
    'cycle-current',
    '30000000-0000-0000-0000-000000000001',
    'bf21ac37-1801-47df-b9ba-b1d05a0d6832',
  ]
  if (c1Ids.includes(idA) && c1Ids.includes(idB)) return true
  const c2Ids = [
    'cycle-2025-annual',
    'cycle-2025-h2',
    '30000000-0000-0000-0000-000000000002',
  ]
  if (c2Ids.includes(idA) && c2Ids.includes(idB)) return true
  return false
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function toDatabaseUserId(userId?: string): string {
  if (!userId) return ''
  if (userId === 'u-emp-1') return '11111111-1111-1111-1111-111111111101'
  if (userId === 'u-mgr-1') return '11111111-1111-1111-1111-111111111102'
  if (userId === 'u-admin') return '11111111-1111-1111-1111-111111111103'
  return userId
}

export function toAppUserId(userId?: string): string {
  if (!userId) return ''
  if (userId === '11111111-1111-1111-1111-111111111101') return 'u-emp-1'
  if (userId === '11111111-1111-1111-1111-111111111102') return 'u-mgr-1'
  if (userId === '11111111-1111-1111-1111-111111111103') return 'u-admin'
  return userId
}

export function resolveCycleUuid(cycleId?: string): string {
  if (!cycleId) return 'bf21ac37-1801-47df-b9ba-b1d05a0d6832'
  if (UUID_PATTERN.test(cycleId)) return cycleId
  if (cycleId === 'cycle-2026-h1' || cycleId === 'cycle-2026-h2' || cycleId === 'cycle-current') {
    return 'bf21ac37-1801-47df-b9ba-b1d05a0d6832'
  }
  if (cycleId === 'cycle-2025-annual' || cycleId === 'cycle-2025-h2') {
    return '30000000-0000-0000-0000-000000000002'
  }
  return cycleId
}
