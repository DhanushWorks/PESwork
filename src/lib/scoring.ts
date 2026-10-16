import { CycleWeights } from '../types'

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
    color: '#7c3aed',
    lightColor: '#6d28d9',
    darkColor: '#a78bfa',
    barClass: 'bg-violet-600 dark:bg-violet-400',
    badgeClass: 'bg-[#f3edff] text-[#6d28d9] border-[#ddd0ff] dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30 font-mono text-[11px]',
  },
  {
    band: 'Band 4',
    label: 'Exceeds Expectations',
    min: 3.75,
    max: 4.49,
    color: '#6366f1',
    lightColor: '#4f46e5',
    darkColor: '#8B7CFF',
    barClass: 'bg-indigo-600 dark:bg-[#8B7CFF]',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-[#8B7CFF]/15 dark:text-[#8B7CFF] dark:border-[#8B7CFF]/30 font-mono text-[11px]',
  },
  {
    band: 'Band 3',
    label: 'Meets Expectations',
    min: 2.75,
    max: 3.74,
    color: '#0284c7',
    lightColor: '#0284c7',
    darkColor: '#38bdf8',
    barClass: 'bg-sky-600 dark:bg-[#38bdf8]',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/30 font-mono text-[11px]',
  },
  {
    band: 'Band 2',
    label: 'Needs Improvement',
    min: 2.0,
    max: 2.74,
    color: '#d97706',
    lightColor: '#d97706',
    darkColor: '#FFB454',
    barClass: 'bg-amber-500 dark:bg-[#FFB454]',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-[#FFB454]/15 dark:text-[#FFB454] dark:border-[#FFB454]/30 font-mono text-[11px]',
  },
  {
    band: 'Band 1',
    label: 'Unsatisfactory',
    min: 1.0,
    max: 1.99,
    color: '#e11d48',
    lightColor: '#e11d48',
    darkColor: '#fb7185',
    barClass: 'bg-rose-500 dark:bg-rose-400',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30 font-mono text-[11px]',
  },
]

/**
 * Calculates weighted composite score rounded to 2 decimal places.
 * Formula: (goals * goalsWeight + competencies * competenciesWeight + values * valuesWeight) / 100
 */
export function calculateCompositeScore(
  goalsScore: number,
  competenciesScore: number,
  valuesScore: number,
  weights: CycleWeights
): number {
  const g = Math.max(1, Math.min(5, goalsScore || 0))
  const c = Math.max(1, Math.min(5, competenciesScore || 0))
  const v = Math.max(1, Math.min(5, valuesScore || 0))

  const total = (g * weights.goals + c * weights.competencies + v * weights.values) / 100
  return Number(total.toFixed(2))
}

/**
 * Returns the rating band and descriptive label for a composite score.
 */
export function getRatingBand(score: number): RatingBandInfo {
  const bounded = Math.max(1.0, Math.min(5.0, score))
  for (const band of RATING_BANDS) {
    if (bounded >= band.min && bounded <= band.max) {
      return band
    }
  }
  // Fallback for edge precision
  return bounded >= 4.5 ? RATING_BANDS[0] : RATING_BANDS[RATING_BANDS.length - 1]
}

