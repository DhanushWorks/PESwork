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
      className={`dark-glass-card dark-glass-card-lift p-5 sm:p-6 select-none flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* Top row: Label & Chip Icon */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-medium uppercase tracking-wider text-slate-500 dark:text-[#8D96AA]">
          {title}
        </span>
        {icon && (
          <div className="w-8 h-8 rounded-xl grid place-items-center text-[#8B7CFF] bg-[#8B7CFF]/15 border border-[#8B7CFF]/28 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {/* Value & Badge */}
      <div className="mt-3 flex items-baseline justify-between gap-2 overflow-hidden">
        <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums leading-tight truncate">
          {value}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>

      {/* Subtitle / Trend */}
      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-[#8D96AA] flex-wrap">
          {trend && (
            <span
              className={`font-mono text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 shrink-0 ${
                trend.neutral
                  ? 'bg-slate-100 text-slate-800 border-slate-200/90 dark:bg-white/10 dark:text-zinc-200 dark:border-white/15'
                  : trend.isPositive
                  ? 'bg-indigo-50/90 text-indigo-700 border-indigo-200 dark:bg-[#8B7CFF]/15 dark:text-[#B7B1FF] dark:border-[#8B7CFF]/30'
                  : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-[#FFB454]/10 dark:text-[#FFB454] dark:border-[#FFB454]/35'
              }`}
            >
              {trend.pulse && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-[#4FE3C1] animate-pulse" />
              )}
              <span>{trend.value}</span>
            </span>
          )}
          {subtitle && <span className="line-clamp-1">{subtitle}</span>}
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
    indigo: 'bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1]',
    emerald: 'bg-gradient-to-r from-indigo-600 to-violet-500 dark:from-[#4FE3C1] dark:to-emerald-400',
    amber: 'bg-gradient-to-r from-amber-500 to-orange-500 dark:from-[#FFB454] dark:to-amber-400',
    blue: 'bg-gradient-to-r from-sky-500 to-blue-600 dark:from-sky-400 dark:to-blue-500',
    rose: 'bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-400 dark:to-pink-500',
  }[variant || 'indigo']

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-[#8D96AA] mb-1.5 font-mono">
          {label && <span>{label}</span>}
          {showPercentage && (
            <span className="tabular-nums font-semibold text-slate-700 dark:text-zinc-200">
              {animatedPercentage}%
            </span>
          )}
        </div>
      )}
      <div className={`w-full bg-slate-200/80 dark:bg-white/[0.08] border border-slate-200 dark:border-transparent rounded-full overflow-hidden ${heightClass}`}>
        <div
          className={`${heightClass} rounded-full transition-all duration-1000 ease-out ${variantClass}`}
          style={{ width: isMounted ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  )
}
