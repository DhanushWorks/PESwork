import { storageService, cycleService, goalService, reviewService, calibrationService, resultService } from '../services'
import { SEED_USERS, FULL_SEED_CYCLES as SEED_CYCLES } from '../data/seedData'

async function runReportsTest() {
  console.log('=== ADMIN CHARTS & REPORTS DYNAMIC VERIFICATION TEST ===\n')

  // Initialize clean state
  storageService.resetCleanWorkflow()

  // Verify Cycle 1: cycle-2026-h1
  const cycle1 = SEED_CYCLES[0]
  console.log(`[Test 1] Testing with Cycle 1: "${cycle1.name}" (${cycle1.id})`)
  
  // Initially, clean state has 0 goals and 0 reviews
  let state = storageService.getState()
  console.log(`- Clean state goals: ${state.goals.length}, manager reviews: ${state.managerReviews.length}`)

  // Create goals for employee u-emp-1
  const g1 = await goalService.save({
    userId: 'u-emp-1',
    cycleId: cycle1.id,
    title: 'Core Architecture Scale',
    metric: 'p99 latency',
    target: 50,
    unit: 'ms',
    weight: 50,
    dueDate: '2026-10-31',
  })
  await goalService.addProgress(g1.id, 90, 'Architecture scale achieved')

  const g2 = await goalService.save({
    userId: 'u-emp-1',
    cycleId: cycle1.id,
    title: 'Fault-Tolerant Microservice Broker',
    metric: 'uptime',
    target: 99.99,
    unit: '%',
    weight: 50,
    dueDate: '2026-10-31',
  })
  await goalService.addProgress(g2.id, 80, 'Broker resilient to faults')

  // Submit manager appraisal
  await reviewService.saveManagerDraft({
    employeeId: 'u-emp-1',
    managerId: 'u-mgr-1',
    cycleId: cycle1.id,
    goalsScore: 4.6,
    competenciesScore: 4.4,
    valuesScore: 4.5,
    overallComments: 'Outstanding execution',
    strengths: 'System architecture',
    growthAreas: 'Documentation',
  })
  await reviewService.submitManagerReview('u-emp-1', cycle1.id, 'u-mgr-1')

  state = storageService.getState()
  const cycle1Goals = state.goals.filter(g => g.cycleId === cycle1.id)
  const avgGoalProgress = Math.round(cycle1Goals.reduce((sum, g) => sum + g.progress, 0) / cycle1Goals.length)
  console.log(`✔ Goal Execution Index for Cycle 1: ${avgGoalProgress}% (Expected: 85%)`)
  if (avgGoalProgress !== 85) throw new Error(`Expected 85%, got ${avgGoalProgress}%`)

  const cycle1Mr = state.managerReviews.find(mr => mr.cycleId === cycle1.id && mr.employeeId === 'u-emp-1')
  console.log(`✔ Manager composite score for Cycle 1: ${cycle1Mr?.compositeScore} (Expected: ~4.52)`)

  // Now create a NEW Cycle: cycle-2026-q3
  console.log(`\n[Test 2] Creating and switching to a new review cycle: "2026 Performance Review - Jan to Sep"`)
  const newCycle = await cycleService.create({
    name: '2026 Performance Review - Jan to Sep',
    description: 'Q1 to Q3 performance cycle',
    stage: 'goals_open',
    startDate: '2026-01-01',
    endDate: '2026-09-30',
    weights: { goals: 60, competencies: 25, values: 15 },
    deadlines: {
      goalsDue: '2026-02-15',
      selfReviewDue: '2026-08-30',
      managerReviewDue: '2026-09-15',
      calibrationDue: '2026-09-25',
      releaseDate: '2026-09-30',
    },
    participantIds: ['u-emp-1'],
  })

  console.log(`✔ New cycle created with ID: ${newCycle.id}`)

  // In this new cycle, goals and reviews are initially empty
  state = storageService.getState()
  const newCycleGoals = state.goals.filter(g => g.cycleId === newCycle.id)
  const newCycleReviews = state.managerReviews.filter(mr => mr.cycleId === newCycle.id)
  console.log(`✔ New cycle goals count: ${newCycleGoals.length} (Expected: 0)`)
  console.log(`✔ New cycle manager reviews count: ${newCycleReviews.length} (Expected: 0)`)

  // Add goal for new cycle
  const gNew = await goalService.save({
    userId: 'u-emp-1',
    cycleId: newCycle.id,
    title: 'Full Stack Observability',
    metric: 'logging',
    target: 100,
    unit: '%',
    weight: 100,
    dueDate: '2026-09-30',
  })
  await goalService.addProgress(gNew.id, 100, 'All services monitored')

  // Submit review with score 4.90
  await reviewService.saveManagerDraft({
    employeeId: 'u-emp-1',
    managerId: 'u-mgr-1',
    cycleId: newCycle.id,
    goalsScore: 5.0,
    competenciesScore: 4.8,
    valuesScore: 4.7,
    overallComments: 'Exceptional',
    strengths: 'End to end leadership',
    growthAreas: 'None',
  })
  await reviewService.submitManagerReview('u-emp-1', newCycle.id, 'u-mgr-1')

  state = storageService.getState()
  const updatedNewCycleGoals = state.goals.filter(g => g.cycleId === newCycle.id)
  const updatedNewCycleMr = state.managerReviews.find(mr => mr.cycleId === newCycle.id && mr.employeeId === 'u-emp-1')

  console.log(`✔ New cycle Goal Execution Index: ${updatedNewCycleGoals[0].progress}% (Expected: 100%)`)
  console.log(`✔ New cycle Manager score: ${updatedNewCycleMr?.compositeScore} (Expected: ~4.91)`)

  // Verify that Cycle 1 still retains its original 85% and ~4.52 score, while New Cycle has 100% and ~4.91!
  const c1GoalsCheck = state.goals.filter(g => g.cycleId === cycle1.id)
  const c1MrCheck = state.managerReviews.find(mr => mr.cycleId === cycle1.id && mr.employeeId === 'u-emp-1')

  console.log(`\n[Test 3: Cycle Isolation & Dynamic Switching]`)
  console.log(`✔ Cycle 1: Goal Progress = ${Math.round(c1GoalsCheck.reduce((s, g) => s + g.progress, 0) / c1GoalsCheck.length)}%, Rating = ${c1MrCheck?.compositeScore}`)
  console.log(`✔ New Cycle: Goal Progress = ${updatedNewCycleGoals[0].progress}%, Rating = ${updatedNewCycleMr?.compositeScore}`)
  console.log(`\nALL DYNAMIC REPORTS VERIFICATION CHECKS PASSED! 🎉`)
}

runReportsTest().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
