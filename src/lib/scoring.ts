import type { CycleWeights } from '../types/index.ts'

export type RatingBandInfo = {
  band: string
  label: string
  min: number
  max: number
  color: string
  lightColor: string
  darkColor: string
  barClass: string
  badgeClass: string
}

export const RATING_BANDS: RatingBandInfo[] = [
  {
    band: 'Band 5',
    label: 'Outstanding Performance',
    min: 4.5,
    max: 5.0,
    color: '#0f172a',
    lightColor: '#0f172a',
    darkColor: '#ffffff',
    barClass: 'bg-slate-900 dark:bg-white',
    badgeClass: 'bg-slate-900 text-white border-transparent dark:bg-white dark:text-slate-900 text-[11px] font-sans font-semibold',
  },
  {
    band: 'Band 4',
    label: 'Exceeds Expectations',
    min: 3.75,
    max: 4.49,
    color: '#334155',
    lightColor: '#334155',
    darkColor: '#cbd5e1',
    barClass: 'bg-slate-700 dark:bg-zinc-300',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 text-[11px] font-sans font-medium',
  },
  {
    band: 'Band 3',
    label: 'Meets Expectations',
    min: 2.75,
    max: 3.74,
    color: '#64748b',
    lightColor: '#64748b',
    darkColor: '#94a3b8',
    barClass: 'bg-slate-500 dark:bg-zinc-500',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-850 dark:text-zinc-300 dark:border-zinc-700 text-[11px] font-sans font-medium',
  },
  {
    band: 'Band 2',
    label: 'Needs Improvement',
    min: 2.0,
    max: 2.74,
    color: '#94a3b8',
    lightColor: '#94a3b8',
    darkColor: '#64748b',
    barClass: 'bg-slate-400 dark:bg-zinc-600',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 text-[11px] font-sans font-medium',
  },
  {
    band: 'Band 1',
    label: 'Unsatisfactory',
    min: 1.0,
    max: 1.99,
    color: '#cbd5e1',
    lightColor: '#cbd5e1',
    darkColor: '#475569',
    barClass: 'bg-slate-300 dark:bg-zinc-700',
    badgeClass: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-zinc-900 dark:text-zinc-500 dark:border-zinc-800 text-[11px] font-sans font-medium',
  },
]

/**
 * Validates that component weights sum to exactly 100% and have non-negative valid numbers.
 */
export function validateWeights(weights: CycleWeights): { isValid: boolean; error?: string } {
  if (!weights) return { isValid: false, error: 'Component weights configuration is missing.' }
  const { goals, competencies, values } = weights
  if (
    typeof goals !== 'number' || typeof competencies !== 'number' || typeof values !== 'number' ||
    isNaN(goals) || isNaN(competencies) || isNaN(values)
  ) {
    return { isValid: false, error: 'All component weights must be valid numbers.' }
  }
  if (goals < 0 || competencies < 0 || values < 0) {
    return { isValid: false, error: 'Component weights cannot be negative.' }
  }
  const sum = Math.round((goals + competencies + values) * 100) / 100
  if (Math.abs(sum - 100) > 0.001) {
    return { isValid: false, error: `Weights must sum to exactly 100%. Currently they sum to ${sum}%.` }
  }
  return { isValid: true }
}

/**
 * Calculates weighted composite score rounded to 2 decimal places.
 * Formula: (goals * goalsWeight + competencies * competenciesWeight + values * valuesWeight) / 100
 * Handles missing scores explicitly: if a component score is unsubmitted, treats it safely as 3.0 (Meets Expectations) default baseline.
 */
export function calculateCompositeScore(
  goalsScore: number | null | undefined,
  competenciesScore: number | null | undefined,
  valuesScore: number | null | undefined,
  weights: CycleWeights
): number {
  const g = typeof goalsScore === 'number' && !isNaN(goalsScore) ? Math.max(1.0, Math.min(5.0, goalsScore)) : 3.0
  const c = typeof competenciesScore === 'number' && !isNaN(competenciesScore) ? Math.max(1.0, Math.min(5.0, competenciesScore)) : 3.0
  const v = typeof valuesScore === 'number' && !isNaN(valuesScore) ? Math.max(1.0, Math.min(5.0, valuesScore)) : 3.0

  const total = (g * weights.goals + c * weights.competencies + v * weights.values) / 100
  return Number(total.toFixed(2))
}

/**
 * Get rating band information for a given composite score.
 */
export function getRatingBand(score: number): RatingBandInfo {
  const bounded = Math.max(1.0, Math.min(5.0, score || 1.0))
  for (const band of RATING_BANDS) {
    if (bounded >= band.min && bounded <= band.max) {
      return band
    }
  }
  return bounded >= 4.5 ? RATING_BANDS[0] : RATING_BANDS[RATING_BANDS.length - 1]
}
