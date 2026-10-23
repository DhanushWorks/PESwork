import type { ReviewCycle } from '../types/index.ts'

/**
 * Helper to add days to a date string (YYYY-MM-DD) without time-zone shifts
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number)
  const d = new Date(year, month - 1, day + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dt = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dt}`
}

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export function formatToISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Helper to get the last day of a month
 */
export function getLastDayOfMonth(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex + 1, 0)
  return formatToISODate(d)
}

/**
 * Deterministically generates suggested cycle deadlines based on performance period.
 * 
 * Rules:
 * - Goals Due: Set ~30 days into performance period (e.g. end of first month).
 * - Evaluation Window: Starts immediately after the performance period ends (endDate).
 *   - Self-Review Due: ~12-14 days after period end.
 *   - Manager Evaluations Due: ~8-10 days after self-reviews.
 *   - Calibration Committee: ~6-7 days after manager evaluations.
 *   - Official Results Release: Final day of evaluation window.
 *
 * Example:
 * 2026 Performance Review — January 1 to September 30, 2026
 * -> Goals Due: 2026-01-31
 * -> Self Reviews Due: 2026-10-12
 * -> Manager Evaluations Due: 2026-10-20
 * -> Calibration Committee: 2026-10-26
 * -> Official Results Release: 2026-10-31
 */
export function generateDeterministicDeadlines(
  startDate: string,
  endDate: string
): ReviewCycle['deadlines'] {
  if (!startDate || !endDate) {
    return {
      goalsDue: '',
      selfReviewDue: '',
      managerReviewDue: '',
      calibrationDue: '',
      releaseDate: '',
    }
  }

  const [startYear, startMonth, startDay] = startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number)

  // 1. Goals Due: End of first month of performance period (or ~30 days after start)
  let goalsDue: string
  const firstMonthEnd = getLastDayOfMonth(startYear, startMonth - 1)
  if (firstMonthEnd >= startDate && firstMonthEnd <= endDate) {
    goalsDue = firstMonthEnd
  } else {
    // If period is short, set midway
    goalsDue = addDays(startDate, Math.max(7, Math.floor((new Date(endYear, endMonth - 1, endDay).getTime() - new Date(startYear, startMonth - 1, startDay).getTime()) / (1000 * 60 * 60 * 24 * 3))))
  }

  // 2. Evaluation Window: Following period end
  // If cycle ends Sept 30, evaluation window is October (culminating Oct 31)
  // Check if endDate is end of a month:
  const isEndAtMonthEnd = getLastDayOfMonth(endYear, endMonth - 1) === endDate

  let selfReviewDue: string
  let managerReviewDue: string
  let calibrationDue: string
  let releaseDate: string

  if (isEndAtMonthEnd) {
    // Evaluation window is the subsequent month
    const evalYear = endMonth === 12 ? endYear + 1 : endYear
    const evalMonth = endMonth === 12 ? 1 : endMonth + 1
    const evalMonthEnd = getLastDayOfMonth(evalYear, evalMonth - 1)

    selfReviewDue = `${evalYear}-${String(evalMonth).padStart(2, '0')}-12`
    managerReviewDue = `${evalYear}-${String(evalMonth).padStart(2, '0')}-20`
    calibrationDue = `${evalYear}-${String(evalMonth).padStart(2, '0')}-26`
    releaseDate = evalMonthEnd
  } else {
    // Relative day spacing
    selfReviewDue = addDays(endDate, 14)
    managerReviewDue = addDays(selfReviewDue, 10)
    calibrationDue = addDays(managerReviewDue, 7)
    releaseDate = addDays(calibrationDue, 5)
  }

  return {
    goalsDue,
    selfReviewDue,
    managerReviewDue,
    calibrationDue,
    releaseDate,
  }
}

/**
 * Validate cycle dates and deadlines sequence
 */
export function validateCycleDatesAndDeadlines(
  startDate: string,
  endDate: string,
  deadlines: ReviewCycle['deadlines']
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  if (!startDate) errors.push('Performance period start date is required.')
  if (!endDate) errors.push('Performance period end date is required.')

  if (startDate && endDate && startDate > endDate) {
    errors.push('Performance period start date must not be after end date.')
  }

  if (!deadlines.goalsDue) errors.push('Goals approval deadline is required.')
  if (!deadlines.selfReviewDue) errors.push('Self-reviews deadline is required.')
  if (!deadlines.managerReviewDue) errors.push('Manager evaluations deadline is required.')
  if (!deadlines.calibrationDue) errors.push('Calibration committee deadline is required.')
  if (!deadlines.releaseDate) errors.push('Official results release date is required.')

  if (errors.length > 0) {
    return { isValid: false, errors, warnings }
  }

  // Sequence checks
  if (deadlines.goalsDue < startDate) {
    errors.push('Goals approval deadline cannot be before the performance period start date.')
  }

  if (deadlines.selfReviewDue < deadlines.goalsDue) {
    errors.push('Self-reviews deadline must be on or after the goals approval deadline.')
  }

  if (deadlines.managerReviewDue < deadlines.selfReviewDue) {
    errors.push('Manager evaluations deadline must be on or after the self-reviews deadline.')
  }

  if (deadlines.calibrationDue < deadlines.managerReviewDue) {
    errors.push('Calibration committee date must be on or after the manager evaluations deadline.')
  }

  if (deadlines.releaseDate < deadlines.calibrationDue) {
    errors.push('Official results release date must be on or after the calibration committee date.')
  }

  // Contextual warnings
  if (deadlines.selfReviewDue < endDate) {
    warnings.push('Note: Self-review deadline occurs before the performance period ends. Typically evaluation takes place after the period closes.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
