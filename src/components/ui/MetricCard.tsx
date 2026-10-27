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
      className={`dark-glass-card ${
        onClick ? 'dark-glass-card-lift cursor-pointer' : ''
      } p-3 sm:p-4 rounded-xl sm:rounded-2xl select-none flex flex-col justify-between transition-all min-h-[92px] sm:min-h-[104px]`}
    >
      {/* Top row: Label & Chip Icon */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[10.5px] sm:text-xs font-bold uppercase tracking-[0.05em] text-slate-900 dark:text-white truncate">
          {title}
        </span>
        {icon && (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg grid place-items-center text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Value & Badge */}
      <div className="my-1 sm:my-1.5 flex items-baseline justify-between gap-1.5 overflow-hidden">
        <div className="text-xl sm:text-[26px] font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none truncate">
          {value}
        </div>
        {badge && <div className="shrink-0 scale-90 sm:scale-100 origin-right">{badge}</div>}
      </div>

      {/* Subtitle / Trend */}
      {(subtitle || trend) && (
        <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-slate-600 dark:text-zinc-300 flex-wrap font-medium">
          {trend && (
            <span
              className="text-[9px] sm:text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md border inline-flex items-center shrink-0 bg-slate-100 text-slate-800 border-slate-300/80 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700"
            >
              <span>{trend.value}</span>
            </span>
          )}
          {subtitle && <span className="line-clamp-1 truncate">{subtitle}</span>}
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
