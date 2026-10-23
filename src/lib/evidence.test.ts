import { goalService } from '../services/index.ts'
import { storageService } from '../services/mock/storageService'

export async function testEvidenceUploadFlow() {
  console.log('=================================================================')
  console.log('TEST SUITE: Evidence Upload, Persistence, Retrieval & History')
  console.log('=================================================================')

  // Setup: Reset demo state to clean workflow
  storageService.resetCleanWorkflow()
  const userId = 'u-emp-1'
  const cycleId = 'cycle-2026-h1'

  // Step 1: Create a goal for testing
  const goal = await goalService.save({
    userId,
    cycleId,
    title: 'Zero Downtime Database Cluster Migration',
    description: 'Execute blue/green PostgreSQL switchover',
    metric: 'Downtime (seconds)',
    target: 0,
    unit: 'sec',
    weight: 25,
    dueDate: '2026-11-15',
    status: 'approved',
    progress: 10,
  })
  console.log('[Step 1] Created Goal ID:', goal.id, '| Initial Progress:', goal.progress)

  // Step 2: Upload Evidence A (Checkpoint 1)
  const evidenceA_name = 'Evidence_A_pre_migration_audit.pdf'
  const evidenceA_url = 'https://supabase.placeholder.co/storage/v1/object/public/evidence/u-emp-1/' + goal.id + '/1729600100_' + evidenceA_name + '#name=' + encodeURIComponent(evidenceA_name)
  const evidenceA_size = '1.8 MB'

  const goalAfterA = await goalService.addProgress(
    goal.id,
    40,
    'Step 1 completed: Pre-migration telemetry verified.',
    evidenceA_name,
    evidenceA_url,
    evidenceA_size
  )

  console.log('[Step 2] Uploaded Evidence A:')
  console.log('  -> Goal latest evidenceFileName:', goalAfterA.evidenceFileName)
  console.log('  -> Goal latest evidenceUrl:', goalAfterA.evidenceUrl)
  console.log('  -> Checkpoint count:', goalAfterA.progressHistory.length)
  console.log('  -> Checkpoint [0] evidence:', goalAfterA.progressHistory[0]?.evidenceFileName)

  if (goalAfterA.evidenceFileName !== evidenceA_name) {
    throw new Error(`FAIL: Goal should show Evidence A, got ${goalAfterA.evidenceFileName}`)
  }
  if (goalAfterA.progressHistory.length !== 1 || goalAfterA.progressHistory[0].evidenceFileName !== evidenceA_name) {
    throw new Error(`FAIL: Checkpoint 0 should hold Evidence A`)
  }

  // Step 3: Upload Evidence B (Checkpoint 2 for the same goal)
  const evidenceB_name = 'Evidence_B_switchover_validation.pdf'
  const evidenceB_url = 'https://supabase.placeholder.co/storage/v1/object/public/evidence/u-emp-1/' + goal.id + '/1729600200_' + evidenceB_name + '#name=' + encodeURIComponent(evidenceB_name)
  const evidenceB_size = '3.4 MB'

  const goalAfterB = await goalService.addProgress(
    goal.id,
    80,
    'Step 2 completed: Switchover succeeded with 0 packet drops.',
    evidenceB_name,
    evidenceB_url,
    evidenceB_size
  )

  console.log('[Step 3] Uploaded Evidence B:')
  console.log('  -> Goal latest evidenceFileName:', goalAfterB.evidenceFileName)
  console.log('  -> Goal latest evidenceUrl:', goalAfterB.evidenceUrl)
  console.log('  -> Checkpoint count:', goalAfterB.progressHistory.length)
  console.log('  -> Checkpoint [0] (newest) evidence:', goalAfterB.progressHistory[0]?.evidenceFileName)
  console.log('  -> Checkpoint [1] (previous) evidence:', goalAfterB.progressHistory[1]?.evidenceFileName)

  if (goalAfterB.evidenceFileName !== evidenceB_name) {
    throw new Error(`FAIL: Goal should now show Evidence B, but shows ${goalAfterB.evidenceFileName}`)
  }
  if (goalAfterB.progressHistory[0].evidenceFileName !== evidenceB_name) {
    throw new Error(`FAIL: Checkpoint [0] must be Evidence B`)
  }
  if (goalAfterB.progressHistory[1].evidenceFileName !== evidenceA_name) {
    throw new Error(`FAIL: Checkpoint [1] must preserve Evidence A`)
  }

  // Step 4: Verification via goalService.getById
  const fetchedGoal = await goalService.getById(goal.id)
  console.log('[Step 4] Fetch by ID (Simulating page refresh / GoalDetail load):')
  console.log('  -> Fetched Goal evidenceFileName:', fetchedGoal?.evidenceFileName)
  console.log('  -> Fetched Checkpoints count:', fetchedGoal?.progressHistory.length)
  console.log('  -> Fetched Checkpoint [0]:', fetchedGoal?.progressHistory[0]?.evidenceFileName)
  console.log('  -> Fetched Checkpoint [1]:', fetchedGoal?.progressHistory[1]?.evidenceFileName)

  if (fetchedGoal?.evidenceFileName !== evidenceB_name) {
    throw new Error(`FAIL: Fresh getById should return Evidence B as latest evidence, got ${fetchedGoal?.evidenceFileName}`)
  }

  // Step 5: Verification via goalService.listForUser
  const userGoals = await goalService.listForUser(userId, cycleId)
  const listed = userGoals.find((g) => g.id === goal.id)
  console.log('[Step 5] Fetch by listForUser (Simulating Goals.tsx load):')
  console.log('  -> Listed Goal evidenceFileName:', listed?.evidenceFileName)
  console.log('  -> Listed Goal checkpoints count:', listed?.progressHistory.length)

  if (listed?.evidenceFileName !== evidenceB_name) {
    throw new Error(`FAIL: listForUser should return Evidence B as latest evidence, got ${listed?.evidenceFileName}`)
  }

  // Step 6: Test Deleting Evidence
  console.log('\n[Step 6] Deleting Evidence B from Checkpoint [0]:')
  const checkpointBId = goalAfterB.progressHistory[0].id
  const goalAfterDeleteB = await goalService.removeEvidence(goal.id, checkpointBId)

  console.log('  -> Goal latest evidenceFileName after deleting Evidence B:', goalAfterDeleteB.evidenceFileName)
  console.log('  -> Checkpoint [0] evidenceFileName:', goalAfterDeleteB.progressHistory[0]?.evidenceFileName)
  console.log('  -> Checkpoint [1] evidenceFileName:', goalAfterDeleteB.progressHistory[1]?.evidenceFileName)

  if (goalAfterDeleteB.progressHistory[0].evidenceFileName !== undefined) {
    throw new Error(`FAIL: Checkpoint [0] should have undefined evidence after deletion`)
  }
  if (goalAfterDeleteB.evidenceFileName !== evidenceA_name) {
    throw new Error(`FAIL: Goal should fall back to Evidence A after deleting Evidence B, got ${goalAfterDeleteB.evidenceFileName}`)
  }
  if (goalAfterDeleteB.progressHistory[1].evidenceFileName !== evidenceA_name) {
    throw new Error(`FAIL: Checkpoint [1] should still preserve Evidence A`)
  }

  console.log('=================================================================')
  console.log(' ALL TESTS PASSED: Evidence upload, retrieval, history, and delete verified!')
  console.log('=================================================================')
}

testEvidenceUploadFlow().catch((err) => {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
})

