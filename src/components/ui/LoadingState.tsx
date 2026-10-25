import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  message?: string
  variant?: 'page' | 'card' | 'table' | 'inline'
  rows?: number
  colSpan?: number
}

/**
 * Enterprise Loading State & Skeleton component
 * Matches PerformIQ's high-contrast theme tokens for both light and dark modes
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading workspace data...',
  variant = 'page',
  rows = 4,
  colSpan = 6,
}) => {
  if (variant === 'table') {
    return (
      <tr>
        <td colSpan={colSpan} className="py-12 px-4 text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 shadow-2xs">
            <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <span className="text-xs font-medium text-slate-700 dark:text-zinc-200 font-sans">
              {message}
            </span>
          </div>
        </td>
      </tr>
    )
  }

  if (variant === 'card') {
    return (
      <div className="dark-glass-card rounded-2xl p-6 border border-slate-200/90 dark:border-white/10 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded-md w-1/3"></div>
          <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded-md w-16"></div>
        </div>
        <div className="space-y-2.5 pt-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-9 bg-slate-100 dark:bg-zinc-800/60 rounded-xl border border-slate-200/60 dark:border-zinc-700/50"
            />
          ))}
        </div>
        <div className="pt-2 flex items-center justify-center gap-2 text-slate-500 dark:text-zinc-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-medium font-sans">{message}</span>
        </div>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-slate-600 dark:text-zinc-300">
        <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-medium font-sans">{message}</span>
      </div>
    )
  }

  // Default 'page' full layout skeleton
  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Top Banner / Indicator */}
      <div className="flex items-center justify-between pb-1">
        <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded-lg w-48 animate-pulse" />
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80">
          <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />
          <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">
            {message}
          </span>
        </div>
      </div>

      {/* Main Section Skeleton Cards */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 border border-slate-200/90 dark:border-white/10 space-y-6">
        <div className="space-y-2">
          <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded-md w-1/4 animate-pulse" />
          <div className="h-3.5 bg-slate-100 dark:bg-zinc-800/60 rounded-md w-1/2 animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="h-28 bg-slate-100 dark:bg-zinc-800/50 rounded-xl border border-slate-200/60 dark:border-zinc-700/50 p-4 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/3" />
            <div className="h-8 bg-slate-200/70 dark:bg-zinc-700/40 rounded-lg" />
          </div>
          <div className="h-28 bg-slate-100 dark:bg-zinc-800/50 rounded-xl border border-slate-200/60 dark:border-zinc-700/50 p-4 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/3" />
            <div className="h-8 bg-slate-200/70 dark:bg-zinc-700/40 rounded-lg" />
          </div>
        </div>

        <div className="h-32 bg-slate-100 dark:bg-zinc-800/40 rounded-xl border border-slate-200/60 dark:border-zinc-700/50 p-4 space-y-2.5 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-800 rounded w-1/4" />
          <div className="h-16 bg-slate-200/50 dark:bg-zinc-700/30 rounded-lg" />
        </div>
      </div>

      {/* Secondary Section Skeleton */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 border border-slate-200/90 dark:border-white/10 space-y-4">
        <div className="h-5 bg-slate-200 dark:bg-zinc-800 rounded-md w-1/3 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-slate-100 dark:bg-zinc-800/50 rounded-xl border border-slate-200/60 dark:border-zinc-700/50 p-3 space-y-2 animate-pulse"
            >
              <div className="h-3.5 bg-slate-200 dark:bg-zinc-800 rounded w-1/2" />
              <div className="h-5 bg-slate-200/70 dark:bg-zinc-700/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

