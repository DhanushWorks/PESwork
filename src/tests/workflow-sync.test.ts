import {
  getEmployeeWorkflowState,
  getManagerWorkflowState,
  getAdminWorkflowState,
} from '../lib/workflow'
import {
  ReviewCycle,
  SelfReview,
  ManagerReview,
  EvaluationResult,
  Goal,
  CalibrationRecord,
  User,
} from '../types'
import { TeamReviewSummary } from '../services/mock/reviewService'

// Test setup with employee Alex Rivera, Manager Marcus Chen, Admin Eleanor Vance
const mockCycle: ReviewCycle = {
  id: 'cycle-2026-h1',
  name: 'FY2026 - H1 Performance Appraisal Cycle',
  stage: 'self_review',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  deadlines: {
    goalsDue: '2026-07-31',
    selfReviewDue: '2026-10-15',
    managerReviewDue: '2026-10-31',
    calibrationDue: '2026-11-15',
    releaseDate: '2026-11-30',
  },
  weights: { goals: 50, competencies: 30, values: 20 },
}

const employeeAlex: User = {
  id: 'u-emp-1',
  name: 'Alex Rivera',
  email: 'alex.rivera@performiq.internal',
  role: 'employee',
  department: 'Engineering',
  designation: 'Senior Backend Engineer',
  employeeCode: 'EMP-001',
  managerId: 'u-mgr-1',
  active: true,
  joinedDate: '2023-03-15',
}

async function runTests() {
  console.log('=== WORKFLOW TRACKING SYNCHRONIZATION TESTS ===\n')

  // -------------------------------------------------------------
  // Scenario 1: Initial state in self_review stage
  // Alex hasn't submitted self-review yet.
  // -------------------------------------------------------------
  console.log('--- Test 1: Initial Self-Review Stage ---')
  const empState1 = getEmployeeWorkflowState({
    cycle: mockCycle,
    selfReview: null,
    managerReview: null,
    result: null,
  })

  const teamSummary1: TeamReviewSummary = {
    employee: employeeAlex,
    selfReviewStatus: 'not_started',
    managerReviewStatus: 'not_started',
    goalsCount: 3,
    goalsApprovedCount: 3,
  }

  const mgrState1 = getManagerWorkflowState({
    cycle: mockCycle,
    teamSummaries: [teamSummary1],
    pendingGoals: [],
    releasedResults: [],
  })

  const adminState1 = getAdminWorkflowState({
    cycle: mockCycle,
    totalEmployees: 1,
    selfReviews: [],
    managerReviews: [],
    calibrations: [],
    results: [],
  })

  console.log(`Employee Stage: ${empState1.effectiveStage} (Step ${empState1.stepNumber}) - ${empState1.badgeLabel}`)
  console.log(`Manager Stage:  ${mgrState1.effectiveStage} (Step ${mgrState1.stepNumber}) - ${mgrState1.badgeLabel}`)
  console.log(`Admin Stage:    ${adminState1.effectiveStage} (Step ${adminState1.stepNumber}) - ${adminState1.badgeLabel}`)

  if (
    empState1.effectiveStage === 'self_review' &&
    mgrState1.effectiveStage === 'self_review' &&
    adminState1.effectiveStage === 'self_review'
  ) {
    console.log('✔ Test 1 PASSED: All three roles synchronized on "self_review"\n')
  } else {
    throw new Error('Test 1 FAILED: Inconsistent initial stage')
  }

  // -------------------------------------------------------------
  // Scenario 2: Employee Alex submits Self-Review
  // Self review is submitted; manager review is not started yet.
  // -------------------------------------------------------------
  console.log('--- Test 2: Employee Submits Self-Review ---')
  const cycleStage2: ReviewCycle = { ...mockCycle, stage: 'manager_review' }
  const submittedSelfReview: SelfReview = {
    id: 'sr-u-emp-1-1',
    userId: 'u-emp-1',
    cycleId: 'cycle-2026-h1',
    status: 'submitted',
    submittedAt: '2026-10-10T14:00:00Z',
    overallRating: 4.0,
    overallReflection: 'Delivered high-throughput caching service.',
    achievements: 'Led database migration.',
    challenges: 'Tight deadlines.',
    developmentNeeds: 'Distributed systems training.',
    competencyRatings: {},
    valueRatings: {},
  }

  const empState2 = getEmployeeWorkflowState({
    cycle: cycleStage2,
    selfReview: submittedSelfReview,
    managerReview: null,
    result: null,
  })

  const teamSummary2: TeamReviewSummary = {
    employee: employeeAlex,
    selfReviewStatus: 'submitted',
    selfReviewSubmittedAt: submittedSelfReview.submittedAt,
    managerReviewStatus: 'not_started',
    goalsCount: 3,
    goalsApprovedCount: 3,
  }

  const mgrState2 = getManagerWorkflowState({
    cycle: cycleStage2,
    teamSummaries: [teamSummary2],
    pendingGoals: [],
    releasedResults: [],
  })

  const adminState2 = getAdminWorkflowState({
    cycle: cycleStage2,
    totalEmployees: 1,
    selfReviews: [submittedSelfReview],
    managerReviews: [],
    calibrations: [],
    results: [],
  })

  console.log(`Employee Stage: ${empState2.effectiveStage} (Step ${empState2.stepNumber}) - ${empState2.badgeLabel}`)
  console.log(`Manager Stage:  ${mgrState2.effectiveStage} (Step ${mgrState2.stepNumber}) - ${mgrState2.badgeLabel}`)
  console.log(`Admin Stage:    ${adminState2.effectiveStage} (Step ${adminState2.stepNumber}) - ${adminState2.badgeLabel}`)
  console.log(`Manager Action: ${mgrState2.actionLabel} -> ${mgrState2.actionLink}`)

  if (
    empState2.effectiveStage === 'manager_review' &&
    mgrState2.effectiveStage === 'manager_review' &&
    adminState2.effectiveStage === 'manager_review' &&
    mgrState2.actionLink.includes('/manager/reviews/u-emp-1')
  ) {
    console.log('✔ Test 2 PASSED: All three roles synchronized on "manager_review", Manager CTA targets Alex\n')
  } else {
    throw new Error('Test 2 FAILED: Inconsistent manager review stage')
  }

  // -------------------------------------------------------------
  // Scenario 3: Manager Marcus Chen submits Manager Evaluation
  // Manager evaluation is formally submitted; awaiting Calibration
  // -------------------------------------------------------------
  console.log('--- Test 3: Manager Submits Appraisal Review ---')
  const cycleStage3: ReviewCycle = { ...mockCycle, stage: 'calibration' }
  const submittedManagerReview: ManagerReview = {
    id: 'mr-u-emp-1-1',
    employeeId: 'u-emp-1',
    managerId: 'u-mgr-1',
    cycleId: 'cycle-2026-h1',
    status: 'submitted',
    submittedAt: '2026-10-18T16:00:00Z',
    goalsScore: 4.2,
    competenciesScore: 4.0,
    valuesScore: 4.0,
    compositeScore: 4.1,
    overallComments: 'Exceptional ownership and architectural execution.',
    strengths: 'Deep domain expertise.',
    growthAreas: 'Delegation across squads.',
    recommendations: {
      promotion: false,
      increment: true,
      bonus: true,
      training: false,
      notes: '',
    },
  }

  const empState3 = getEmployeeWorkflowState({
    cycle: cycleStage3,
    selfReview: submittedSelfReview,
    managerReview: submittedManagerReview,
    result: null,
  })

  const teamSummary3: TeamReviewSummary = {
    employee: employeeAlex,
    selfReviewStatus: 'submitted',
    selfReviewSubmittedAt: submittedSelfReview.submittedAt,
    managerReviewStatus: 'submitted',
    managerReviewSubmittedAt: submittedManagerReview.submittedAt,
    compositeScore: 4.1,
    goalsCount: 3,
    goalsApprovedCount: 3,
  }

  const mgrState3 = getManagerWorkflowState({
    cycle: cycleStage3,
    teamSummaries: [teamSummary3],
    pendingGoals: [],
    releasedResults: [],
  })

  const adminState3 = getAdminWorkflowState({
    cycle: cycleStage3,
    totalEmployees: 1,
    selfReviews: [submittedSelfReview],
    managerReviews: [submittedManagerReview],
    calibrations: [],
    results: [],
  })

  console.log(`Employee Stage: ${empState3.effectiveStage} (Step ${empState3.stepNumber}) - ${empState3.badgeLabel}`)
  console.log(`Manager Stage:  ${mgrState3.effectiveStage} (Step ${mgrState3.stepNumber}) - ${mgrState3.badgeLabel}`)
  console.log(`Admin Stage:    ${adminState3.effectiveStage} (Step ${adminState3.stepNumber}) - ${adminState3.badgeLabel}`)
  console.log(`Admin Action:   ${adminState3.actionLabel} -> ${adminState3.actionLink}`)

  if (
    empState3.effectiveStage === 'calibration' &&
    mgrState3.effectiveStage === 'calibration' &&
    adminState3.effectiveStage === 'calibration' &&
    adminState3.actionLink === '/admin/calibration'
  ) {
    console.log('✔ Test 3 PASSED: All three roles synchronized on "calibration", Admin CTA points to Calibration Hub\n')
  } else {
    throw new Error('Test 3 FAILED: Inconsistent calibration stage')
  }

  // -------------------------------------------------------------
  // Scenario 4: Admin Eleanor Vance approves calibration and releases result
  // Result is formally released
  // -------------------------------------------------------------
  console.log('--- Test 4: Admin Grants Approval & Releases Outcomes ---')
  const approvedCalibration: CalibrationRecord = {
    id: 'cal-u-emp-1-1',
    cycleId: 'cycle-2026-h1',
    employeeId: 'u-emp-1',
    originalScore: 4.1,
    adjustedScore: 4.1,
    reason: 'Committee consensus: Approved score 4.10 with high performance designation.',
    calibratedBy: 'Eleanor Vance',
    calibratedAt: '2026-10-20T10:00:00Z',
    adminApproved: true,
    adminApprovedAt: '2026-10-20T10:05:00Z',
    status: 'approved',
  }

  const releasedResult: EvaluationResult = {
    id: 'res-u-emp-1-cycle-2026-h1',
    cycleId: 'cycle-2026-h1',
    employeeId: 'u-emp-1',
    managerId: 'u-mgr-1',
    compositeScore: 4.1,
    finalRatingLabel: 'Exceeds Expectations',
    ratingBand: 'EE',
    goalsScore: 4.2,
    competenciesScore: 4.0,
    valuesScore: 4.0,
    managerComments: submittedManagerReview.overallComments,
    agreedActions: ['Continue core strategic execution'],
    acknowledged: false,
    disputeStatus: 'none',
  }

  const cycleStage4: ReviewCycle = { ...mockCycle, stage: 'released' }
  const empState4 = getEmployeeWorkflowState({
    cycle: cycleStage4,
    selfReview: submittedSelfReview,
    managerReview: submittedManagerReview,
    result: releasedResult,
  })

  const mgrState4 = getManagerWorkflowState({
    cycle: cycleStage4,
    teamSummaries: [teamSummary3],
    pendingGoals: [],
    releasedResults: [releasedResult],
  })

  const adminState4 = getAdminWorkflowState({
    cycle: cycleStage4,
    totalEmployees: 1,
    selfReviews: [submittedSelfReview],
    managerReviews: [submittedManagerReview],
    calibrations: [approvedCalibration],
    results: [releasedResult],
  })

  console.log(`Employee Stage: ${empState4.effectiveStage} (Step ${empState4.stepNumber}) - ${empState4.badgeLabel}`)
  console.log(`Manager Stage:  ${mgrState4.effectiveStage} (Step ${mgrState4.stepNumber}) - ${mgrState4.badgeLabel}`)
  console.log(`Admin Stage:    ${adminState4.effectiveStage} (Step ${adminState4.stepNumber}) - ${adminState4.badgeLabel}`)

  if (
    empState4.effectiveStage === 'released' &&
    mgrState4.effectiveStage === 'released' &&
    adminState4.effectiveStage === 'released'
  ) {
    console.log('✔ Test 4 PASSED: All three roles synchronized on "released"\n')
  } else {
    throw new Error('Test 4 FAILED: Inconsistent released stage')
  }

  // -------------------------------------------------------------
  // Scenario 5: Cycle Closed
  // -------------------------------------------------------------
  console.log('--- Test 5: Cycle Closed ---')
  const closedCycle: ReviewCycle = { ...mockCycle, stage: 'closed' }

  const empState5 = getEmployeeWorkflowState({
    cycle: closedCycle,
    selfReview: submittedSelfReview,
    managerReview: submittedManagerReview,
    result: releasedResult,
  })

  const mgrState5 = getManagerWorkflowState({
    cycle: closedCycle,
    teamSummaries: [teamSummary3],
    pendingGoals: [],
    releasedResults: [releasedResult],
  })

  const adminState5 = getAdminWorkflowState({
    cycle: closedCycle,
    totalEmployees: 1,
    selfReviews: [submittedSelfReview],
    managerReviews: [submittedManagerReview],
    calibrations: [approvedCalibration],
    results: [releasedResult],
  })

  console.log(`Employee Stage: ${empState5.effectiveStage} (Step ${empState5.stepNumber}) - ${empState5.badgeLabel}`)
  console.log(`Manager Stage:  ${mgrState5.effectiveStage} (Step ${mgrState5.stepNumber}) - ${mgrState5.badgeLabel}`)
  console.log(`Admin Stage:    ${adminState5.effectiveStage} (Step ${adminState5.stepNumber}) - ${adminState5.badgeLabel}`)

  if (
    empState5.effectiveStage === 'closed' &&
    mgrState5.effectiveStage === 'closed' &&
    adminState5.effectiveStage === 'closed'
  ) {
    console.log('✔ Test 5 PASSED: All three roles synchronized on "closed"\n')
  } else {
    throw new Error('Test 5 FAILED: Inconsistent closed stage')
  }

  // -------------------------------------------------------------
  // Scenario 6: Dynamic Auto-Advance when Cycle is nominally in 'tracking'
  // But Employee has submitted self-review (User Issue Fix)
  // -------------------------------------------------------------
  console.log('--- Test 6: Dynamic Auto-Advance to Manager Review ---')
  const nominalTrackingCycle: ReviewCycle = { ...mockCycle, stage: 'tracking' }
  const mgrState6 = getManagerWorkflowState({
    cycle: nominalTrackingCycle,
    teamSummaries: [teamSummary2], // selfReviewStatus is 'submitted'
    pendingGoals: [],
    releasedResults: [],
  })

  if (mgrState6.effectiveStage === 'manager_review' && mgrState6.stepNumber === 5) {
    console.log('✔ Test 6 PASSED: Cycle stage auto-advanced to Step 5 (manager_review) based on submitted self-review!\n')
  } else {
    throw new Error(`Test 6 FAILED: Expected manager_review, got ${mgrState6.effectiveStage}`)
  }

  // -------------------------------------------------------------
  // Scenario 7: Calibration Stage Held - Admin Has NOT Granted Permission Yet
  // Calibrations await approval (adminApproved: false). Dashboards MUST stay on Step 6 (Calibration),
  // and MUST NOT jump prematurely to Step 7 (Results Released).
  // -------------------------------------------------------------
  console.log('--- Test 7: Calibration Gate Held (No Release Permission Granted Yet) ---')
  const calPendingCycle: ReviewCycle = { ...mockCycle, stage: 'calibration' }
  const unapprovedCal: CalibrationRecord = {
    id: 'cal-u-emp-1',
    cycleId: 'cycle-2026-h1',
    employeeId: 'u-emp-1',
    originalScore: 4.0,
    adjustedScore: 4.0,
    reason: '',
    calibratedBy: '',
    calibratedAt: '',
    adminApproved: false,
    status: 'pending_admin_approval',
  }
  const draftResult: EvaluationResult = {
    ...releasedResult,
    status: 'pending',
  }

  const empState7 = getEmployeeWorkflowState({
    cycle: calPendingCycle,
    selfReview: submittedSelfReview,
    managerReview: submittedManagerReview,
    result: null, // Not permitted yet
  })

  const mgrState7 = getManagerWorkflowState({
    cycle: calPendingCycle,
    teamSummaries: [teamSummary3], // Manager appraisal submitted
    pendingGoals: [],
    releasedResults: [draftResult],
  })

  const adminState7 = getAdminWorkflowState({
    cycle: calPendingCycle,
    totalEmployees: 1,
    selfReviews: [submittedSelfReview],
    managerReviews: [submittedManagerReview],
    calibrations: [unapprovedCal],
    results: [draftResult],
  })

  console.log(`Employee Stage: ${empState7.effectiveStage} (Step ${empState7.stepNumber}) - ${empState7.badgeLabel}`)
  console.log(`Manager Stage:  ${mgrState7.effectiveStage} (Step ${mgrState7.stepNumber}) - ${mgrState7.badgeLabel}`)
  console.log(`Admin Stage:    ${adminState7.effectiveStage} (Step ${adminState7.stepNumber}) - ${adminState7.badgeLabel}`)

  if (
    empState7.effectiveStage === 'calibration' && empState7.stepNumber === 6 &&
    mgrState7.effectiveStage === 'calibration' && mgrState7.stepNumber === 6 &&
    adminState7.effectiveStage === 'calibration' && adminState7.stepNumber === 6
  ) {
    console.log('✔ Test 7 PASSED: All three roles stay strictly on Step 6 (Calibration) until Admin explicitly grants permission!\n')
  } else {
    throw new Error(`Test 7 FAILED: Expected calibration (6), got Emp: ${empState7.effectiveStage}, Mgr: ${mgrState7.effectiveStage}, Admin: ${adminState7.effectiveStage}`)
  }

  // -------------------------------------------------------------
  // Scenario 8: Result Acknowledgement with Supabase UUID
  // Ensures acknowledging a result by Supabase UUID never fails with "Result not found"
  // -------------------------------------------------------------
  console.log('--- Test 8: Result Acknowledgement with UUID ---')
  const { resultService } = await import('../services/index')
  const ackOutcome = await resultService.acknowledge('10c9e9b6-38d6-4e94-b217-dbe42727aa7a')
  if (ackOutcome && ackOutcome.acknowledged === true) {
    console.log(`✔ Test 8 PASSED: Successfully acknowledged result (${ackOutcome.id}) without errors!\n`)
  } else {
    throw new Error('Test 8 FAILED: Expected acknowledged result')
  }

  // -------------------------------------------------------------
  // Scenario 9: Complete 8-Stage Lifecycle Validation (User Process)
  // 1. draft -> 2. goals_open -> 3. tracking (pending approval) ->
  // 4. self_review (goals approved) -> 5. manager_review ->
  // 6. calibration -> 7. released -> 8. closed
  // -------------------------------------------------------------
  console.log('--- Test 9: Complete 8-Stage Lifecycle Progression ---')
  const lifeCycle: ReviewCycle = { ...mockCycle, stage: 'draft' }

  // Stage 1: Draft
  const s1 = getEmployeeWorkflowState({ cycle: lifeCycle })
  if (s1.stepNumber !== 1 || s1.effectiveStage !== 'draft') {
    throw new Error(`Stage 1 failed: expected draft (1), got ${s1.effectiveStage} (${s1.stepNumber})`)
  }

  // Stage 2: Goals Open
  const cycleOpen: ReviewCycle = { ...lifeCycle, stage: 'goals_open' }
  const s2 = getEmployeeWorkflowState({ cycle: cycleOpen, goals: [] })
  if (s2.stepNumber !== 2 || s2.effectiveStage !== 'goals_open') {
    throw new Error(`Stage 2 failed: expected goals_open (2), got ${s2.effectiveStage} (${s2.stepNumber})`)
  }

  // Stage 3: Employee creates goals and submits for approval -> Goal Tracking (pending approval)
  const pendingGoal: Goal = {
    id: 'g-1',
    userId: 'u-emp-1',
    cycleId: lifeCycle.id,
    title: 'Complete backend migration',
    metric: '100% services on new cluster',
    weight: 100,
    progress: 0,
    status: 'pending_approval',
    createdAt: '2026-07-02T10:00:00Z',
    updatedAt: '2026-07-02T10:00:00Z',
  }
  const s3 = getEmployeeWorkflowState({ cycle: cycleOpen, goals: [pendingGoal] })
  if (s3.stepNumber !== 3 || s3.effectiveStage !== 'tracking' || !s3.badgeLabel.includes('Pending')) {
    throw new Error(`Stage 3 failed: expected tracking (3) pending approval, got ${s3.effectiveStage} (${s3.stepNumber}) - ${s3.badgeLabel}`)
  }

  // Stage 4: Manager approves goals -> Self-Review (update progress and write reflection)
  const approvedGoal: Goal = { ...pendingGoal, status: 'approved' }
  const s4 = getEmployeeWorkflowState({ cycle: cycleOpen, goals: [approvedGoal] })
  if (s4.stepNumber !== 4 || s4.effectiveStage !== 'self_review') {
    throw new Error(`Stage 4 failed: expected self_review (4), got ${s4.effectiveStage} (${s4.stepNumber})`)
  }

  // Stage 5: Employee submits self-review -> Manager Review (waiting for manager evaluation)
  const s5 = getEmployeeWorkflowState({ cycle: cycleOpen, goals: [approvedGoal], selfReview: submittedSelfReview })
  if (s5.stepNumber !== 5 || s5.effectiveStage !== 'manager_review') {
    throw new Error(`Stage 5 failed: expected manager_review (5), got ${s5.effectiveStage} (${s5.stepNumber})`)
  }

  // Stage 6: Manager submits review -> Calibration Gate
  const s6 = getEmployeeWorkflowState({ cycle: cycleOpen, goals: [approvedGoal], selfReview: submittedSelfReview, managerReview: submittedManagerReview })
  if (s6.stepNumber !== 6 || s6.effectiveStage !== 'calibration') {
    throw new Error(`Stage 6 failed: expected calibration (6), got ${s6.effectiveStage} (${s6.stepNumber})`)
  }

  // Stage 7: Admin calibrates & permits -> Results Released
  const cycleReleased: ReviewCycle = { ...lifeCycle, stage: 'released' }
  const s7 = getEmployeeWorkflowState({ cycle: cycleReleased, goals: [approvedGoal], selfReview: submittedSelfReview, managerReview: submittedManagerReview, result: releasedResult })
  if (s7.stepNumber !== 7 || s7.effectiveStage !== 'released') {
    throw new Error(`Stage 7 failed: expected released (7), got ${s7.effectiveStage} (${s7.stepNumber})`)
  }

  // Stage 8: Cycle Closed
  const stage8ClosedCycle: ReviewCycle = { ...lifeCycle, stage: 'closed' }
  const s8 = getEmployeeWorkflowState({ cycle: stage8ClosedCycle, goals: [approvedGoal], selfReview: submittedSelfReview, managerReview: submittedManagerReview, result: releasedResult })
  if (s8.stepNumber !== 8 || s8.effectiveStage !== 'closed') {
    throw new Error(`Stage 8 failed: expected closed (8), got ${s8.effectiveStage} (${s8.stepNumber})`)
  }

  console.log('✔ Test 9 PASSED: Complete 8-Stage Lifecycle accurately validated from Draft to Closed!\n')

  console.log('========================================================')
  console.log('ALL WORKFLOW SYNCHRONIZATION TESTS PASSED SUCCESSFULLY! 🎉')
  console.log('========================================================')
}

runTests()

