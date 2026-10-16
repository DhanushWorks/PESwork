import { CycleWeights, Goal } from '../types'

export type ValidationResult = {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateGoalSet(goals: Goal[], config = { minGoals: 1, maxGoals: 7 }): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  const activeGoals = goals.filter((g) => g.status !== 'cancelled')

  if (activeGoals.length < config.minGoals) {
    errors.push(`You have ${activeGoals.length} active goal(s). A minimum of ${config.minGoals} goal is required before submission.`)
  }

  if (activeGoals.length > config.maxGoals) {
    errors.push(`You have ${activeGoals.length} goals. A maximum of ${config.maxGoals} goals is permitted per cycle.`)
  }

  const totalWeight = activeGoals.reduce((sum, g) => sum + (Number(g.weight) || 0), 0)
  if (Math.abs(totalWeight - 100) > 0.01) {
    errors.push(`Total goal weight must equal exactly 100%. Currently it is ${totalWeight}%.`)
  }

  activeGoals.forEach((goal, idx) => {
    if (!goal.title || goal.title.trim().length < 5) {
      errors.push(`Goal #${idx + 1} needs a descriptive title (at least 5 characters).`)
    }
    if (!goal.metric || goal.metric.trim().length === 0) {
      errors.push(`Goal #${idx + 1} (${goal.title || 'Untitled'}) must specify a measurable metric.`)
    }
    if (goal.weight <= 0) {
      errors.push(`Goal #${idx + 1} must have a weight greater than 0%.`)
    }
    if (goal.target <= 0) {
      errors.push(`Goal #${idx + 1} target value must be greater than zero.`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export function validateCycleWeights(weights: CycleWeights): ValidationResult {
  const errors: string[] = []
  const total = (Number(weights.goals) || 0) + (Number(weights.competencies) || 0) + (Number(weights.values) || 0)

  if (Math.abs(total - 100) > 0.01) {
    errors.push(`Cycle component weights must sum to exactly 100%. Currently they sum to ${total}%.`)
  }

  if (weights.goals < 10) errors.push('Goals weight must be at least 10%.')
  if (weights.competencies < 10) errors.push('Competencies weight must be at least 10%.')
  if (weights.values < 5) errors.push('Values weight must be at least 5%.')

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  }
}

export function validateScoreRange(score: number): boolean {
  return typeof score === 'number' && score >= 1.0 && score <= 5.0 && !isNaN(score)
}

export function validateReason(reason: string, minLength = 10): { isValid: boolean; error?: string } {
  if (!reason || reason.trim().length < minLength) {
    return {
      isValid: false,
      error: `Please provide a thorough justification (minimum ${minLength} characters).`,
    }
  }
  return { isValid: true }
}

