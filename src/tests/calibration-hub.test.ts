import assert from 'assert'
import {
  calibrationService,
  goalService,
  reviewService,
  cycleService,
  storageService,
} from '../services'

async function runCalibrationHubTests() {
  console.log('=== ADMIN CALIBRATION HUB VERIFICATION TEST ===\n')

  // Reset to clean state
  storageService.resetCleanWorkflow()

  const employeeId = 'u-emp-1' // Alex Rivera
  const managerId = 'u-mgr-1'   // Marcus Chen
  const adminId = 'u-admin'     // Eleanor Vance
  const cycleId = 'cycle-2026-h1'

  const cycle = await cycleService.getById(cycleId)
  assert(cycle, 'Cycle must exist')
  const expectedCycleName = cycle.name
  console.log(`Target Cycle: "${expectedCycleName}" (${cycleId})\n`)

  // ------------------------------------------------------------------------
  // Step 1: Create three separate goals for employee with evidence (PDFs & Images)
  // ------------------------------------------------------------------------
  console.log('--- Step 1: Creating 3 Separate Goals with Evidence Files ---')

  // Goal 1: Microservice migration with PDF evidence
  const goal1 = await goalService.save({
    userId: employeeId,
    cycleId,
    title: 'Zero-Downtime Microservice Ledger Migration',
    metric: 'Uptime SLA',
    target: 99.99,
    unit: '%',
    weight: 35,
    dueDate: '2026-10-31',
  })

  await goalService.addProgress(
    goal1.id,
    80,
    'Ledger shadow traffic validation passed 99.99% threshold.',
    'microservice_ledger_audit.pdf',
    'data:application/pdf;base64,JVBERi0xLjQKJ...#name=microservice_ledger_audit.pdf',
    '1.2 MB'
  )

  // Goal 2: P99 Latency optimization with PNG image evidence
  const goal2 = await goalService.save({
    userId: employeeId,
    cycleId,
    title: 'P99 Latency Telemetry Optimization',
    metric: 'Latency Drop',
    target: 30,
    unit: '%',
    weight: 35,
    dueDate: '2026-10-31',
  })

  await goalService.addProgress(
    goal2.id,
    95,
    'Grafana dashboard benchmark showing 34.9% latency drop.',
    'latency_benchmark_grafana.png',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...#name=latency_benchmark_grafana.png',
    '450 KB'
  )

  // Goal 3: Disaster Recovery Runbook with multiple evidence files (PDF + JPEG)
  const goal3 = await goalService.save({
    userId: employeeId,
    cycleId,
    title: 'Automated Disaster Recovery Runbook Drill',
    metric: 'RTO Recovery Time',
    target: 15,
    unit: 'minutes',
    weight: 30,
    dueDate: '2026-10-31',
  })

  // First progress on Goal 3 with PDF
  await goalService.addProgress(
    goal3.id,
    50,
    'Simulated failover dry-run logs.',
    'failover_simulation_report.pdf',
    'data:application/pdf;base64,JVBERi0xLjQKJ...#name=failover_simulation_report.pdf',
    '820 KB'
  )

  // Second progress on Goal 3 with Image
  await goalService.addProgress(
    goal3.id,
    100,
    'Live drill sign-off screenshot.',
    'disaster_recovery_signoff.jpg',
    'data:image/jpeg;base64,/9j/4AAQSkZJRg...#name=disaster_recovery_signoff.jpg',
    '310 KB'
  )

  console.log('✔ Goal 1 created with PDF evidence: microservice_ledger_audit.pdf')
  console.log('✔ Goal 2 created with PNG image evidence: latency_benchmark_grafana.png')
  console.log('✔ Goal 3 created with multiple evidence files: failover_simulation_report.pdf & disaster_recovery_signoff.jpg\n')

  // ------------------------------------------------------------------------
  // Step 2: Submit Manager Evaluation with Feedback (Comments, Strengths, Growth)
  // ------------------------------------------------------------------------
  console.log('--- Step 2: Submitting Manager Evaluation & Feedback ---')

  const managerFeedbackComments =
    'Alex delivered exceptional engineering execution this half. Led the zero-downtime migration with zero data loss.'
  const managerFeedbackStrengths =
    'System resilience engineering, architectural rigor, deep observability telemetry, and mentoring junior engineers.'
  const managerFeedbackGrowthAreas =
    'Cross-functional communication with product stakeholders and proactive risk escalation for external dependencies.'

  await reviewService.submitManagerReview({
    employeeId,
    managerId,
    cycleId,
    goalsScore: 4.5,
    competenciesScore: 4.2,
    valuesScore: 4.0,
    overallComments: managerFeedbackComments,
    strengths: managerFeedbackStrengths,
    growthAreas: managerFeedbackGrowthAreas,
    recommendations: {
      promotion: true,
      increment: true,
      bonus: true,
      training: false,
      notes: 'Strong candidate for Staff Engineer promotion based on architectural leadership.',
    },
  })

  console.log('✔ Manager appraisal submitted with narrative, strengths, growth areas, and recommendations.\n')

  // ------------------------------------------------------------------------
  // Step 3: Fetch Calibration Hub Items for Admin
  // ------------------------------------------------------------------------
  console.log('--- Step 3: Verifying Calibration Hub Data Retrieval ---')

  const items = await calibrationService.listForCycle(cycleId)
  assert(items.length > 0, 'Calibration roster must not be empty')

  const calItem = items.find((i) => i.employee.id === employeeId)
  assert(calItem, `Calibration item for employee ${employeeId} must exist`)

  // Check 1: Review Cycle Name
  console.log(`[Check 1: Review Cycle Name] Expected: "${expectedCycleName}", Received: "${calItem.cycleName}"`)
  assert.strictEqual(
    calItem.cycleName,
    expectedCycleName,
    'Calibration item must reflect the actual Review Cycle Name'
  )
  assert.strictEqual(
    calItem.cycleId,
    cycleId,
    'Calibration item must link to the correct Cycle ID'
  )
  console.log('✔ Check 1 PASSED: Review cycle name correctly resolved and displayed.\n')

  // Check 2: All 3 Goals Retrieved
  console.log(`[Check 2: Goals Retrieval] Goals count: ${calItem.goals.length}`)
  assert.strictEqual(calItem.goals.length, 3, 'Must retrieve all three separate performance goals')
  calItem.goals.forEach((g, idx) => {
    console.log(`  Goal #${idx + 1}: "${g.title}" (Progress: ${g.progress}%, Weight: ${g.weight}%)`)
  })
  console.log('✔ Check 2 PASSED: All three goals retrieved separately.\n')

  // Check 3: All Evidence Files Across All Goals
  console.log(`[Check 3: All Evidence Files] Total evidence count: ${calItem.allEvidence.length}`)
  assert(calItem.allEvidence.length >= 4, 'Must contain all uploaded evidence files across all 3 goals')

  const fileNames = calItem.allEvidence.map((e) => e.fileName)
  console.log('  Evidence files detected:', fileNames)

  assert(
    fileNames.includes('microservice_ledger_audit.pdf'),
    'Goal 1 PDF evidence must be present'
  )
  assert(
    fileNames.includes('latency_benchmark_grafana.png'),
    'Goal 2 PNG image evidence must be present'
  )
  assert(
    fileNames.includes('failover_simulation_report.pdf'),
    'Goal 3 PDF evidence must be present'
  )
  assert(
    fileNames.includes('disaster_recovery_signoff.jpg'),
    'Goal 3 JPEG image evidence must be present'
  )

  // Verify file type tagging (Image vs PDF)
  const pngItem = calItem.allEvidence.find((e) => e.fileName === 'latency_benchmark_grafana.png')
  assert(pngItem?.isImage === true, 'PNG file must be tagged as isImage: true')
  assert(pngItem?.isPdf === false, 'PNG file must not be tagged as isPdf: true')

  const pdfItem = calItem.allEvidence.find((e) => e.fileName === 'microservice_ledger_audit.pdf')
  assert(pdfItem?.isPdf === true, 'PDF file must be tagged as isPdf: true')
  assert(pdfItem?.isImage === false, 'PDF file must not be tagged as isImage: true')

  // Verify goal association
  assert.strictEqual(pngItem?.goalTitle, 'P99 Latency Telemetry Optimization')
  assert.strictEqual(pdfItem?.goalTitle, 'Zero-Downtime Microservice Ledger Migration')

  console.log('✔ Check 3 PASSED: All 4 evidence files correctly retrieved, typed (Image/PDF), and linked to goals.\n')

  // Check 4: Manager Feedback Retrieved
  console.log('[Check 4: Manager Feedback]')
  console.log('  Executive Comments:', calItem.managerReview.overallComments)
  console.log('  Core Strengths:', calItem.managerReview.strengths)
  console.log('  Growth Areas:', calItem.managerReview.growthAreas)

  assert.strictEqual(
    calItem.managerReview.overallComments,
    managerFeedbackComments,
    'Manager narrative comments must match actual saved feedback'
  )
  assert.strictEqual(
    calItem.managerReview.strengths,
    managerFeedbackStrengths,
    'Manager strengths must match actual saved feedback'
  )
  assert.strictEqual(
    calItem.managerReview.growthAreas,
    managerFeedbackGrowthAreas,
    'Manager growth areas must match actual saved feedback'
  )
  assert.strictEqual(
    calItem.managerReview.recommendations.promotion,
    true,
    'Manager promotion recommendation must be preserved'
  )

  console.log('✔ Check 4 PASSED: Manager feedback, narrative, strengths, and growth areas verified.\n')

  // ------------------------------------------------------------------------
  // Step 4: Calibrate & Permit Action Integrity
  // ------------------------------------------------------------------------
  console.log('--- Step 4: Calibrate and Grant Permission Actions ---')

  const adjustedScore = 4.8
  const committeeRationale = 'Committee consensus: Outstanding impact on ledger and latency optimizations. Exceeded benchmarks.'

  // 1. Save Calibration
  await calibrationService.calibrate(
    cycleId,
    employeeId,
    adjustedScore,
    committeeRationale,
    'Eleanor Vance'
  )

  const itemsAfterCal = await calibrationService.listForCycle(cycleId)
  const calibratedItem = itemsAfterCal.find((i) => i.employee.id === employeeId)!
  assert.strictEqual(calibratedItem.currentScore, 4.8, 'Calibrated score must update to 4.8')
  assert.strictEqual(calibratedItem.calibrationRecord?.reason, committeeRationale)

  // 2. Grant Permission (Approve & Release)
  await calibrationService.approveAndRelease(
    cycleId,
    employeeId,
    'Eleanor Vance',
    adjustedScore,
    committeeRationale
  )

  const itemsAfterPermit = await calibrationService.listForCycle(cycleId)
  const permittedItem = itemsAfterPermit.find((i) => i.employee.id === employeeId)!
  assert.strictEqual(permittedItem.adminApproved, true, 'Admin permission gate must show approved: true')
  assert.strictEqual(permittedItem.goals.length, 3, 'All 3 goals must remain preserved after permit')
  assert(permittedItem.allEvidence.length >= 4, 'All evidence files must remain preserved after permit')
  assert.strictEqual(permittedItem.cycleName, expectedCycleName, 'Cycle name must remain preserved after permit')

  console.log('✔ Step 4 PASSED: "Calibrate" and "Permit" actions succeed while preserving all goals, evidence, and cycle data.\n')

  console.log('====================================================')
  console.log('ALL CALIBRATION HUB VERIFICATION CHECKS PASSED! 🎉')
  console.log('====================================================')
}

runCalibrationHubTests().catch((err) => {
  console.error('\n❌ Calibration Hub Test Suite Failed:', err)
  process.exit(1)
})

