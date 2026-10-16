import React from 'react'
import { getRatingBand } from '../../lib/scoring'

type RatingInputProps = {
  value: number
  onChange: (val: number) => void
  disabled?: boolean
  label?: string
  id?: string
  hideBadge?: boolean
}

export const RatingInput: React.FC<RatingInputProps> = ({
  value,
  onChange,
  disabled = false,
  label,
  id,
  hideBadge = false,
}) => {
  const currentVal = value || 3.0
  const band = getRatingBand(currentVal)
  const quickSteps = [1.0, 2.0, 3.0, 4.0, 5.0]

  return (
    <div className="space-y-3 py-1">
      {/* Header Row: Label & Rating Band Indicator */}
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <label htmlFor={id} className="text-[13px] font-semibold text-[#172033] dark:text-zinc-200">
            {label}
          </label>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Rating Score
          </span>
        )}
        {!hideBadge && (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-mono border transition-colors ${band.badgeClass}`}
          >
            {band.band} · {band.label}
          </span>
        )}
      </div>

      {/* Slider Track & Numeric Display */}
      <div className="flex items-center gap-3.5">
        <div className="flex-1 flex flex-col gap-2">
          <div className="relative py-1 flex items-center">
            <input
              id={id}
              type="range"
              min="1.0"
              max="5.0"
              step="0.05"
              disabled={disabled}
              value={currentVal}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              className="rating-slider w-full h-2.5 bg-[#e8edf4] dark:bg-zinc-800 rounded-full appearance-none cursor-pointer disabled:opacity-50 transition-all"
            />
          </div>
          <div className="flex justify-between text-xs font-medium text-[#53627a] dark:text-zinc-400 px-0.5">
            <span>1.0 Unsatisfactory</span>
            <strong className="text-[#6147e8] dark:text-[#8B7CFF] font-bold">3.0 Meets</strong>
            <span>5.0 Outstanding</span>
          </div>
        </div>

        {/* High-Contrast Score Input Box */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min="1.0"
            max="5.0"
            step="0.1"
            disabled={disabled}
            value={value}
            onChange={(e) => {
              const val = parseFloat(e.target.value)
              if (!isNaN(val)) {
                onChange(Math.max(1, Math.min(5, val)))
              }
            }}
            className="w-16 px-2.5 py-1.5 text-center text-sm font-bold rounded-xl border border-[#c5d2e3] dark:border-zinc-700 bg-[#f8fafc] dark:bg-zinc-800 text-[#6147e8] dark:text-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] shadow-2xs disabled:opacity-50"
          />
        </div>
      </div>

      {/* Quick Score Presets */}
      {!disabled && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mr-1">
            Presets:
          </span>
          {quickSteps.map((step) => {
            const isActive = Math.abs(currentVal - step) < 0.05
            return (
              <button
                key={step}
                type="button"
                onClick={() => onChange(step)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 dark:bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700'
                }`}
              >
                {step.toFixed(1)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
