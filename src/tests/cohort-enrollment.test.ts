import { cycleService } from '../services/mock/cycleService'
import { storageService } from '../services/mock/storageService'

async function runCohortTests() {
  console.log('=== CYCLE PARTICIPANT COHORT ENROLLMENT TESTS ===\n')

  // Test 1: Baseline cycle participant count
  const state = storageService.getState()
  const baseline = await cycleService.getById(state.activeCycleId)
  console.log('Active Cycle:', baseline?.name)
  console.log('Participant IDs in Baseline:', baseline?.participantIds)

  const enrolled = await cycleService.getEnrolledParticipants(baseline!.id)
  console.log('Enrolled Participants in Baseline:', enrolled.map((u) => `${u.name} (${u.role})`))

  const hasAlex = enrolled.some((u) => u.name === 'Alex Rivera')
  const hasMarcus = enrolled.some((u) => u.name === 'Marcus Chen')

  if (!hasAlex || !hasMarcus) {
    throw new Error(`Test 1 Failed: Expected both Alex Rivera and Marcus Chen enrolled, found: ${enrolled.map(u => u.name).join(', ')}`)
  }
  console.log('✔ Test 1 PASSED: Baseline cycle contains both Employee (Alex) and Manager (Marcus)\n')

  // Test 2: Create a new cycle with both employee and manager
  const newCycle = await cycleService.create({
    name: 'FY 2027 Q1 Performance Review',
    stage: 'draft',
    startDate: '2027-01-01',
    endDate: '2027-03-31',
    weights: { goals: 60, competencies: 30, values: 10 },
    deadlines: {
      goalsDue: '2027-01-15',
      selfReviewDue: '2027-02-01',
      managerReviewDue: '2027-02-15',
      calibrationDue: '2027-02-28',
      releaseDate: '2027-03-15',
    },
    participantIds: ['u-emp-1', 'u-mgr-1'],
  })

  const enrolledNew = await cycleService.getEnrolledParticipants(newCycle.id)
  console.log('Enrolled in New Cycle:', enrolledNew.map((u) => `${u.name} (${u.role})`))
  if (enrolledNew.length !== 2) {
    throw new Error(`Test 2 Failed: Expected 2 participants, got ${enrolledNew.length}`)
  }
  console.log('✔ Test 2 PASSED: New cycle created with manager and employee correctly enrolled\n')

  // Test 3: Add an additional participant dynamically
  const remainingStaff = state.users.find((u) => u.role !== 'admin' && u.id !== 'u-emp-1' && u.id !== 'u-mgr-1')
  if (remainingStaff) {
    console.log(`Adding ${remainingStaff.name} to new cycle...`)
    await cycleService.addParticipant(newCycle.id, remainingStaff.id)
    const afterAdd = await cycleService.getEnrolledParticipants(newCycle.id)
    console.log('Participants after add:', afterAdd.map((u) => u.name))
    if (!afterAdd.some((u) => u.id === remainingStaff.id)) {
      throw new Error(`Test 3 Failed: ${remainingStaff.name} was not enrolled`)
    }
    console.log(`✔ Test 3 PASSED: Dynamically enrolled ${remainingStaff.name} successfully\n`)
  }

  // Test 4: Verify persistence in storageService
  const updatedCycleInStorage = storageService.getState().cycles.find((c) => c.id === newCycle.id)
  if (!updatedCycleInStorage || !updatedCycleInStorage.participantIds?.includes('u-mgr-1')) {
    throw new Error('Test 4 Failed: Manager not persisted in storageService state.cycles')
  }
  console.log('✔ Test 4 PASSED: Cohort enrollment persisted cleanly in state.cycles\n')

  console.log('========================================================')
  console.log('ALL COHORT ENROLLMENT TESTS PASSED! 🎉')
  console.log('========================================================')
}

runCohortTests().catch((err) => {
  console.error(err)
  process.exit(1)
})

