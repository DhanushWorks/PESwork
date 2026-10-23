import React from 'react'
import { CycleWeights } from '../../types'
import { calculateCompositeScore, getRatingBand } from '../../lib/scoring'
import { Award, Calculator } from 'lucide-react'

type ScorePreviewCardProps = {
  goalsScore: number
  competenciesScore: number
  valuesScore: number
  weights: CycleWeights
  title?: string
}

export const ScorePreviewCard: React.FC<ScorePreviewCardProps> = ({
  goalsScore,
  competenciesScore,
  valuesScore,
  weights,
  title = 'Live Evaluation Score Preview',
}) => {
  const compositeScore = calculateCompositeScore(goalsScore, competenciesScore, valuesScore, weights)
  const band = getRatingBand(compositeScore)

  const goalsContribution = ((goalsScore * weights.goals) / 100).toFixed(2)
  const compContribution = ((competenciesScore * weights.competencies) / 100).toFixed(2)
  const valuesContribution = ((valuesScore * weights.values) / 100).toFixed(2)

  return (
    <div className="dark-glass-card conic-border-glow rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 dark:border-indigo-800/50 flex items-center justify-center">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-[#F0F3FA]">{title}</h3>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-sans border ${band.badgeClass}`}
        >
          {band.label}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-3xl font-extrabold font-sans text-slate-900 dark:text-[#F0F3FA] tracking-tight">
            {compositeScore.toFixed(2)}{' '}
            <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">/ 5.00</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-zinc-300 mt-0.5 font-sans font-medium">
            {band.band} · Weighted Composite Score
          </p>
        </div>
        <div className="p-2.5 bg-indigo-50 border border-indigo-200/80 dark:bg-indigo-950/40 dark:border-indigo-800/50 rounded-xl text-indigo-700 dark:text-indigo-300">
          <Award className="w-6 h-6" />
        </div>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-2.5 text-center">
          <div className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-200">Goals ({weights.goals}%)</div>
          <div className="text-sm font-bold font-sans text-slate-800 dark:text-[#F0F3FA] mt-1">{goalsScore.toFixed(2)}</div>
          <div className="text-[10px] font-sans text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">+{goalsContribution} pts</div>
        </div>

        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-2.5 text-center">
          <div className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-200">Competencies ({weights.competencies}%)</div>
          <div className="text-sm font-bold font-sans text-slate-800 dark:text-[#F0F3FA] mt-1">{competenciesScore.toFixed(2)}</div>
          <div className="text-[10px] font-sans text-indigo-700 dark:text-indigo-400 font-semibold mt-0.5">+{compContribution} pts</div>
        </div>

        <div className="bg-slate-50/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-2.5 text-center">
          <div className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-200">Values ({weights.values}%)</div>
          <div className="text-sm font-bold font-sans text-slate-800 dark:text-[#F0F3FA] mt-1">{valuesScore.toFixed(2)}</div>
          <div className="text-[10px] font-sans text-amber-700 dark:text-amber-400 font-semibold mt-0.5">+{valuesContribution} pts</div>
        </div>
      </div>

      <p className="text-[11px] text-slate-600 dark:text-zinc-300 font-sans leading-tight font-medium">
        Formula: <code className="bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">({goalsScore}×{weights.goals}% + {competenciesScore}×{weights.competencies}% + {valuesScore}×{weights.values}%) / 100</code>
      </p>
    </div>
  )
}

