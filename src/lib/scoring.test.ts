import { test } from 'node:test'
import assert from 'node:assert'
import { calculateCompositeScore, getRatingBand, validateWeights, RATING_BANDS } from './scoring.ts'

test('Scoring: validateWeights accepts valid 100% configurations', () => {
  // Test prompt's example 60/25/15
  const res1 = validateWeights({ goals: 60, competencies: 25, values: 15 })
  assert.strictEqual(res1.isValid, true)
  assert.strictEqual(res1.error, undefined)

  // Test 50/30/20
  const res2 = validateWeights({ goals: 50, competencies: 30, values: 20 })
  assert.strictEqual(res2.isValid, true)
})

test('Scoring: validateWeights rejects weights not summing to 100%', () => {
  const res1 = validateWeights({ goals: 60, competencies: 20, values: 15 })
  assert.strictEqual(res1.isValid, false)
  assert.match(res1.error || '', /sum to exactly 100%/)

  const res2 = validateWeights({ goals: 70, competencies: 30, values: 10 })
  assert.strictEqual(res2.isValid, false)
})

test('Scoring: validateWeights rejects negative or non-numeric values', () => {
  const res1 = validateWeights({ goals: -10, competencies: 60, values: 50 })
  assert.strictEqual(res1.isValid, false)
  assert.match(res1.error || '', /cannot be negative/)

  const res2 = validateWeights({ goals: NaN as any, competencies: 50, values: 50 })
  assert.strictEqual(res2.isValid, false)
})

test('Scoring: calculateCompositeScore computes accurate weighted scores', () => {
  // 60/25/15 with 5.0, 4.0, 3.0 -> (300 + 100 + 45)/100 = 4.45
  const score1 = calculateCompositeScore(5.0, 4.0, 3.0, { goals: 60, competencies: 25, values: 15 })
  assert.strictEqual(score1, 4.45)

  // Uniform 4.0 -> 4.00
  const score2 = calculateCompositeScore(4.0, 4.0, 4.0, { goals: 60, competencies: 25, values: 15 })
  assert.strictEqual(score2, 4.0)

  // 50/30/20 with 3.5, 4.2, 4.8 -> (175 + 126 + 96)/100 = 3.97
  const score3 = calculateCompositeScore(3.5, 4.2, 4.8, { goals: 50, competencies: 30, values: 20 })
  assert.strictEqual(score3, 3.97)
})

test('Scoring: calculateCompositeScore clamps out-of-bounds scores', () => {
  // Goals > 5 clamped to 5
  const scoreHigh = calculateCompositeScore(10, 5, 5, { goals: 60, competencies: 25, values: 15 })
  assert.strictEqual(scoreHigh, 5.0)

  // Scores < 1 clamped to 1
  const scoreLow = calculateCompositeScore(-2, 0, 1, { goals: 60, competencies: 25, values: 15 })
  assert.strictEqual(scoreLow, 1.0)
})

test('Scoring: calculateCompositeScore handles missing/unsubmitted scores', () => {
  // Missing scores safely default to 3.0 baseline
  const score = calculateCompositeScore(null, undefined, 4.0, { goals: 60, competencies: 25, values: 15 })
  // (3.0*60 + 3.0*25 + 4.0*15)/100 = (180 + 75 + 60)/100 = 3.15
  assert.strictEqual(score, 3.15)
})

test('Scoring: getRatingBand maps composite scores to correct bands', () => {
  // Band 5 (>= 4.5)
  assert.strictEqual(getRatingBand(4.8).band, 'Band 5')
  assert.strictEqual(getRatingBand(4.5).band, 'Band 5')

  // Band 4 (3.75 - 4.49)
  assert.strictEqual(getRatingBand(4.45).band, 'Band 4')
  assert.strictEqual(getRatingBand(3.75).band, 'Band 4')

  // Band 3 (2.75 - 3.74)
  assert.strictEqual(getRatingBand(3.5).band, 'Band 3')
  assert.strictEqual(getRatingBand(2.75).band, 'Band 3')

  // Band 2 (2.0 - 2.74)
  assert.strictEqual(getRatingBand(2.5).band, 'Band 2')
  assert.strictEqual(getRatingBand(2.0).band, 'Band 2')

  // Band 1 (< 2.0)
  assert.strictEqual(getRatingBand(1.5).band, 'Band 1')
  assert.strictEqual(getRatingBand(1.0).band, 'Band 1')
})
