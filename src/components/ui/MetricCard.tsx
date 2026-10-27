import React from 'react'
import { useCountUp } from '../../hooks/useCountUp'

type MetricCardProps = {
  title: string
  value: React.ReactNode
  subtitle?: string
  icon?: React.ReactNode
  trend?: {
    value: string
    isPositive?: boolean
    neutral?: boolean
    pulse?: boolean
  }
  badge?: React.ReactNode
  accentColor?: 'indigo' | 'emerald' | 'violet' | 'amber'
  onClick?: () => void
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`dark-glass-card group ${
        onClick ? 'dark-glass-card-lift cursor-pointer' : ''
      } p-3.5 sm:p-4.5 rounded-2xl select-none flex flex-col justify-between transition-all min-h-[96px] sm:min-h-[110px]`}
    >
      {/* Top row: Label & Chip Icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-wider truncate">
          {title}
        </span>
        {icon && (
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg sm:rounded-xl flex items-center justify-center text-slate-600 dark:text-zinc-300 bg-slate-100/90 dark:bg-zinc-800/90 border border-slate-200/70 dark:border-zinc-700/60 shadow-2xs shrink-0 transition-transform duration-200 group-hover:scale-105">
            {icon}
          </div>
        )}
      </div>

      {/* Value & Badge */}
      <div className="my-1 sm:my-1.5 flex items-baseline justify-between gap-2 overflow-hidden">
        <div className="text-xl sm:text-2xl lg:text-[26px] font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums leading-tight truncate">
          {value}
        </div>
        {badge && <div className="shrink-0 scale-90 sm:scale-100 origin-right">{badge}</div>}
      </div>

      {/* Subtitle / Trend */}
      {(subtitle || trend) && (
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 min-w-0">
          {trend && (
            <span
              className={`text-[10px] sm:text-[10.5px] font-medium px-2 py-0.5 rounded-full border inline-flex items-center gap-1 shrink-0 ${
                trend.isPositive
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                  : trend.neutral
                  ? 'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                  : 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
              }`}
            >
              {trend.pulse && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              <span>{trend.value}</span>
            </span>
          )}
          {subtitle && <span className="truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}

type ProgressBarProps = {
  value: number // 0 - 100
  max?: number
  label?: string
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'indigo' | 'emerald' | 'amber' | 'blue' | 'rose'
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  label,
  showPercentage = true,
  size = 'md',
  variant = 'indigo',
}) => {
  const percentage = Math.max(0, Math.min(100, Math.round((value / max) * 100)))
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setIsMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const animatedPercentage = useCountUp(percentage, { duration: 1000, delay: 100 })

  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-2.5',
  }[size]

  const variantClass = {
    indigo: 'bg-slate-900 dark:bg-white',
    emerald: 'bg-slate-900 dark:bg-white',
    amber: 'bg-slate-700 dark:bg-zinc-300',
    blue: 'bg-slate-800 dark:bg-zinc-200',
    rose: 'bg-slate-600 dark:bg-zinc-400',
  }[variant || 'indigo']

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-200 mb-1.5 font-sans font-medium">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="tabular-nums font-semibold text-slate-700 dark:text-zinc-200">
              {animatedPercentage}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${heightClass} rounded-full transition-all duration-1000 ease-out ${variantClass}`}
          style={{ width: isMounted ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  )
}
