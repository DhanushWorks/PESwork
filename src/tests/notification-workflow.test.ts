import {
  goalService,
  reviewService,
  calibrationService,
  notificationService,
  storageService,
} from '../services'

async function runNotificationTests() {
  console.log('=== IN-APP NOTIFICATION WORKFLOW VERIFICATION ===\n')

  // Reset to clean workflow state
  storageService.resetCleanWorkflow()

  const employeeId = 'u-emp-1' // Alex Rivera
  const managerId = 'u-mgr-1'   // Marcus Chen
  const adminId = 'u-admin'     // Eleanor Vance
  const cycleId = 'cycle-2026-h1'

  // Clear any existing notifications to test fresh workflow triggers
  storageService.updateState(() => ({ notifications: [] }))

  // Seed goals for employee Alex Rivera totaling 100% weight
  const goal1 = await goalService.save({
    userId: employeeId,
    cycleId,
    title: 'Zero-Downtime Microservice Ledger Migration',
    metric: 'Service Availability',
    target: 99.99,
    unit: '%',
    weight: 50,
  })

  const goal2 = await goalService.save({
    userId: employeeId,
    cycleId,
    title: 'P99 Latency Telemetry Optimization',
    metric: 'Latency Reduction',
    target: 25,
    unit: '%',
    weight: 50,
  })

  // -------------------------------------------------------------
  // Test 1: Employee submits goals -> Notify assigned Manager
  // -------------------------------------------------------------
  console.log('--- Test 1: Employee Submits Goals ---')
  const submitGoalRes = await goalService.submitGoalsForApproval(employeeId, cycleId)
  if (!submitGoalRes.success) {
    throw new Error(`Failed to submit goals: ${submitGoalRes.errors?.join(', ')}`)
  }

  const mgrNotifs1 = await notificationService.list(managerId)
  const goalSubNotif = mgrNotifs1.find((n) => n.title === 'Goals Submitted for Approval')

  if (!goalSubNotif) {
    throw new Error('Test 1 FAILED: Manager did not receive "Goals Submitted for Approval" notification')
  }

  console.log(`✔ Manager Notification Received: "${goalSubNotif.title}" - ${goalSubNotif.message}`)
  console.log(`  Link: ${goalSubNotif.link} | Type: ${goalSubNotif.type} | Read: ${goalSubNotif.read}`)

  if (goalSubNotif.link !== '/manager/approvals' || goalSubNotif.type !== 'action' || goalSubNotif.read !== false) {
    throw new Error('Test 1 FAILED: Notification attributes invalid')
  }
  console.log('✔ Test 1 PASSED: Assigned manager correctly notified of submitted goals.\n')

  // -------------------------------------------------------------
  // Test 2: Manager approves goals & returns goals for revision -> Notify Employee
  // -------------------------------------------------------------
  console.log('--- Test 2: Manager Approves & Returns Goals ---')
  storageService.updateState(() => ({ currentUserId: managerId }))
  // Approve first goal
  await goalService.decide(goal1.id, 'approved')
  const empNotifsAfterApprove = await notificationService.list(employeeId)
  const approveNotif = empNotifsAfterApprove.find(
    (n) => n.title === 'Goal Approved' && n.message.includes(goal1.title)
  )

  if (!approveNotif) {
    throw new Error('Test 2 FAILED: Employee did not receive "Goal Approved" notification')
  }
  console.log(`✔ Employee Notification (Approved): "${approveNotif.title}" - ${approveNotif.message}`)

  // Return second goal for revision
  await goalService.decide(goal2.id, 'returned', 'Please refine the target metric to be more specific.')
  const empNotifsAfterReturn = await notificationService.list(employeeId)
  const returnNotif = empNotifsAfterReturn.find(
    (n) => n.title === 'Goal Returned for Revision' && n.message.includes(goal2.title)
  )

  if (!returnNotif) {
    throw new Error('Test 2 FAILED: Employee did not receive "Goal Returned for Revision" notification')
  }
  console.log(`✔ Employee Notification (Returned): "${returnNotif.title}" - ${returnNotif.message}`)
  console.log('✔ Test 2 PASSED: Employee correctly notified of goal approvals and revision returns.\n')

  // -------------------------------------------------------------
  // Test 3: Employee submits self-review -> Notify assigned Manager
  // -------------------------------------------------------------
  console.log('--- Test 3: Employee Submits Self-Review ---')
  storageService.updateState(() => ({ currentUserId: employeeId }))
  await reviewService.submitSelfReview({
    userId: employeeId,
    cycleId,
    overallRating: 4.0,
    overallReflection: 'Completed architecture migration.',
    achievements: 'High availability delivery.',
    challenges: 'Resource constraints.',
    developmentNeeds: 'Cloud certs.',
  })

  const mgrNotifsAfterSelfReview = await notificationService.list(managerId)
  const selfReviewNotif = mgrNotifsAfterSelfReview.find((n) => n.title === 'Self-Review Submitted')

  if (!selfReviewNotif) {
    throw new Error('Test 3 FAILED: Manager did not receive "Self-Review Submitted" notification')
  }
  console.log(`✔ Manager Notification Received: "${selfReviewNotif.title}" - ${selfReviewNotif.message}`)
  console.log(`  Link: ${selfReviewNotif.link}`)

  if (selfReviewNotif.link !== `/manager/reviews/${employeeId}`) {
    throw new Error('Test 3 FAILED: Notification link does not point to manager review workspace')
  }
  console.log('✔ Test 3 PASSED: Manager correctly notified of employee self-review submission.\n')

  // -------------------------------------------------------------
  // Test 4: Manager submits evaluation -> Notify authorized Admin
  // -------------------------------------------------------------
  console.log('--- Test 4: Manager Submits Evaluation ---')
  await reviewService.submitManagerReview({
    employeeId,
    managerId,
    cycleId,
    goalsScore: 4.2,
    competenciesScore: 4.0,
    valuesScore: 4.0,
    overallComments: 'Demonstrated outstanding ownership.',
    strengths: 'Technical leadership.',
    growthAreas: 'Strategic scaling.',
  })

  const adminNotifsAfterMgrReview = await notificationService.list(adminId)
  const mgrRevNotif = adminNotifsAfterMgrReview.find((n) => n.title === 'Manager Evaluation Submitted')

  if (!mgrRevNotif) {
    throw new Error('Test 4 FAILED: Admin did not receive "Manager Evaluation Submitted" notification')
  }
  console.log(`✔ Admin Notification Received: "${mgrRevNotif.title}" - ${mgrRevNotif.message}`)
  console.log(`  Link: ${mgrRevNotif.link}`)

  if (mgrRevNotif.link !== '/admin/calibration') {
    throw new Error('Test 4 FAILED: Notification link does not route to Admin Calibration Hub')
  }
  console.log('✔ Test 4 PASSED: Admin correctly notified of manager evaluation submission.\n')

  // -------------------------------------------------------------
  // Test 5: Admin approves calibration -> Notify Employee and Manager
  // -------------------------------------------------------------
  console.log('--- Test 5: Admin Approves Calibration ---')
  await calibrationService.approveAndRelease(
    cycleId,
    employeeId,
    'Eleanor Vance',
    4.15,
    'Committee consensus approved final rating.'
  )

  const empNotifsAfterApproval = await notificationService.list(employeeId)
  const empReleaseNotif = empNotifsAfterApproval.find((n) => n.title === 'Performance Results Released')

  if (!empReleaseNotif) {
    throw new Error('Test 5 FAILED: Employee did not receive "Performance Results Released" notification')
  }
  console.log(`✔ Employee Notification: "${empReleaseNotif.title}" - ${empReleaseNotif.message}`)

  const mgrNotifsAfterApproval = await notificationService.list(managerId)
  const mgrReleaseNotif = mgrNotifsAfterApproval.find((n) => n.title === 'Appraisal Approved & Released')

  if (!mgrReleaseNotif) {
    throw new Error('Test 5 FAILED: Manager did not receive "Appraisal Approved & Released" notification')
  }
  console.log(`✔ Manager Notification: "${mgrReleaseNotif.title}" - ${mgrReleaseNotif.message}`)
  console.log('✔ Test 5 PASSED: Stakeholders correctly notified of calibration approval & result release.\n')

  // -------------------------------------------------------------
  // Test 6: Verify Unread Count, Mark as Read, Mark All as Read
  // -------------------------------------------------------------
  console.log('--- Test 6: Unread Count & Mark-As-Read Behavior ---')
  const managerNotifs = await notificationService.list(managerId)
  const unreadBefore = managerNotifs.filter((n) => !n.read).length
  console.log(`Manager unread notifications count: ${unreadBefore}`)

  if (unreadBefore === 0) {
    throw new Error('Expected manager to have unread notifications')
  }

  // Mark single notification as read
  const targetNotif = managerNotifs[0]
  await notificationService.markRead(targetNotif.id)
  const managerNotifsAfterSingleRead = await notificationService.list(managerId)
  const updatedSingle = managerNotifsAfterSingleRead.find((n) => n.id === targetNotif.id)

  if (!updatedSingle?.read) {
    throw new Error('Test 6 FAILED: Notification was not marked as read')
  }
  console.log(`✔ Single notification "${targetNotif.title}" marked as read.`)

  // Mark all notifications as read
  await notificationService.markAllRead(managerId)
  const managerNotifsAfterAllRead = await notificationService.list(managerId)
  const unreadAfterAll = managerNotifsAfterAllRead.filter((n) => !n.read).length

  if (unreadAfterAll !== 0) {
    throw new Error(`Test 6 FAILED: Expected 0 unread notifications, got ${unreadAfterAll}`)
  }
  console.log(`✔ Mark all as read succeeded: ${unreadAfterAll} unread remaining.`)
  console.log('✔ Test 6 PASSED: Read/unread state transitions work correctly.\n')

  // -------------------------------------------------------------
  // Test 7: Deduplication & Persistence Verification
  // -------------------------------------------------------------
  console.log('--- Test 7: Deduplication & State Persistence ---')
  const notifPayload = {
    userId: employeeId,
    title: 'Deduplication Test',
    message: 'Testing deduplication protection.',
    link: '/employee/goals',
    type: 'info' as const,
  }

  const created1 = await notificationService.create(notifPayload)
  const created2 = await notificationService.create(notifPayload)

  if (created1.id !== created2.id) {
    throw new Error('Test 7 FAILED: Duplicate notification was created for identical payload within threshold')
  }

  const empNotifsDedupe = await notificationService.list(employeeId)
  const dedupeMatches = empNotifsDedupe.filter((n) => n.title === 'Deduplication Test')

  if (dedupeMatches.length !== 1) {
    throw new Error(`Test 7 FAILED: Expected exactly 1 notification, found ${dedupeMatches.length}`)
  }
  console.log('✔ Deduplication successfully prevented duplicate notification.')

  // Persistence check in storage
  const persistedState = storageService.getState()
  const foundInStorage = persistedState.notifications.find((n) => n.id === created1.id)
  if (!foundInStorage) {
    throw new Error('Test 7 FAILED: Notification not found in persisted storage state')
  }
  console.log('✔ Notification confirmed persisted in system state across reloads.')
  console.log('✔ Test 7 PASSED: Deduplication and persistence verified.\n')

  console.log('========================================================')
  console.log('ALL IN-APP NOTIFICATION WORKFLOW TESTS PASSED! 🎉')
  console.log('========================================================')
}

runNotificationTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})
