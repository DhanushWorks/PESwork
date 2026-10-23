import { test } from 'node:test'
import assert from 'node:assert'
import {
  generateDeterministicDeadlines,
  validateCycleDatesAndDeadlines,
  addDays,
} from './deadlines.ts'

test('Deadlines: Required example cycle (Jan 1 to Sep 30, 2026) generates deterministic October schedule', () => {
  const deadlines = generateDeterministicDeadlines('2026-01-01', '2026-09-30')

  // Goals approval due end of first month
  assert.strictEqual(deadlines.goalsDue, '2026-01-31')

  // Evaluation window in October 2026, culminating on October 31, 2026
  assert.strictEqual(deadlines.selfReviewDue, '2026-10-12')
  assert.strictEqual(deadlines.managerReviewDue, '2026-10-20')
  assert.strictEqual(deadlines.calibrationDue, '2026-10-26')
  assert.strictEqual(deadlines.releaseDate, '2026-10-31')
})

test('Deadlines: validateCycleDatesAndDeadlines accepts sequential deadlines', () => {
  const deadlines = {
    goalsDue: '2026-01-31',
    selfReviewDue: '2026-10-12',
    managerReviewDue: '2026-10-20',
    calibrationDue: '2026-10-26',
    releaseDate: '2026-10-31',
  }

  const result = validateCycleDatesAndDeadlines('2026-01-01', '2026-09-30', deadlines)
  assert.strictEqual(result.isValid, true)
  assert.strictEqual(result.errors.length, 0)
})

test('Deadlines: validateCycleDatesAndDeadlines rejects inverted date sequences', () => {
  // End date before start date
  const invertedPeriod = validateCycleDatesAndDeadlines('2026-09-30', '2026-01-01', {
    goalsDue: '2026-10-01',
    selfReviewDue: '2026-10-12',
    managerReviewDue: '2026-10-20',
    calibrationDue: '2026-10-26',
    releaseDate: '2026-10-31',
  })
  assert.strictEqual(invertedPeriod.isValid, false)
  assert.match(invertedPeriod.errors[0], /start date must not be after end date/)

  // Self review after manager evaluation
  const invertedStages = validateCycleDatesAndDeadlines('2026-01-01', '2026-09-30', {
    goalsDue: '2026-01-31',
    selfReviewDue: '2026-10-25',
    managerReviewDue: '2026-10-15',
    calibrationDue: '2026-10-26',
    releaseDate: '2026-10-31',
  })
  assert.strictEqual(invertedStages.isValid, false)
  assert.match(invertedStages.errors.join('; '), /Manager evaluations deadline must be on or after the self-reviews deadline/)
})

test('Deadlines: addDays computes accurate calendar days', () => {
  assert.strictEqual(addDays('2026-01-31', 1), '2026-02-01')
  assert.strictEqual(addDays('2026-02-28', 1), '2026-03-01')
  assert.strictEqual(addDays('2026-09-30', 12), '2026-10-12')
})

