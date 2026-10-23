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
  const percentage = Math.max(0, Math.min(100, ((currentVal - 1.0) / 4.0) * 100))

  return (
    <div className="space-y-3 py-1">
      {/* Header Row: Label & Rating Band Indicator */}
      <div className="flex items-center justify-between gap-2">
        {label ? (
          <label htmlFor={id} className="text-[13px] font-bold text-slate-900 dark:text-zinc-100">
            {label}
          </label>
        ) : (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
            Rating Score
          </span>
        )}
        {!hideBadge && (
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-sans border transition-colors ${band.badgeClass}`}
          >
            {band.band} · {band.label}
          </span>
        )}
      </div>

      {/* Slider Track & Numeric Display */}
      <div className="flex items-center gap-3.5">
        <div className="flex-1 flex flex-col gap-2">
          <div className="relative py-2 flex items-center w-full">
            {/* Visual Underlay Track: Guaranteed 100% visible on any screen, browser, and theme */}
            <div className="absolute inset-x-0 h-3 rounded-full bg-slate-200 dark:bg-zinc-800 border-[1.5px] border-slate-300 dark:border-zinc-600 overflow-hidden pointer-events-none shadow-2xs">
              {/* Active Progress Fill up to the thumb */}
              <div
                className={`h-full transition-all duration-75 ${
                  disabled
                    ? 'bg-slate-700 dark:bg-zinc-200'
                    : 'bg-slate-900 dark:bg-white'
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>

            {/* Native Range Slider */}
            <input
              id={id}
              type="range"
              min="1.0"
              max="5.0"
              step="0.05"
              disabled={disabled}
              value={currentVal}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              style={{ '--slider-pct': `${percentage}%` } as React.CSSProperties}
              className="rating-slider relative z-10 w-full h-3 appearance-none bg-transparent cursor-pointer disabled:cursor-default transition-all"
            />
          </div>
          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-zinc-300 px-0.5">
            <span>1.0 Unsatisfactory</span>
            <strong className="text-slate-900 dark:text-white font-bold">3.0 Meets</strong>
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
            className="w-16 px-2.5 py-1.5 text-center text-sm font-bold rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white shadow-2xs disabled:opacity-100 disabled:bg-slate-100 dark:disabled:bg-zinc-800 disabled:text-slate-900 dark:disabled:text-white"
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
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-zinc-950 border-slate-900 dark:border-white shadow-xs font-bold'
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
