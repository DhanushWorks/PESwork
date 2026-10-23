import React from 'react'
import { CycleStage, GoalStatus, Role } from '../../types'
import { CYCLE_STAGE_DETAILS, getGoalStatusBadge } from '../../lib/formatters'
import { getRatingBand } from '../../lib/scoring'

import { Check, Clock, AlertCircle } from 'lucide-react'

type StatusBadgeProps = {
  status: GoalStatus
}

export const GoalStatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const { label, className } = getGoalStatusBadge(status)
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
    >
      {(status === 'approved' || status === 'completed') && (
        <Check className="w-3 h-3 stroke-[2.5]" />
      )}
      {status === 'pending_approval' && (
        <Clock className="w-3 h-3 stroke-[2]" />
      )}
      {status === 'returned' && (
        <AlertCircle className="w-3 h-3 stroke-[2]" />
      )}
      <span>{label}</span>
    </span>
  )
}

type StageBadgeProps = {
  stage: CycleStage
}

export const CycleStageBadge: React.FC<StageBadgeProps> = ({ stage }) => {
  const info = CYCLE_STAGE_DETAILS[stage] || { label: stage, badgeClass: 'bg-gray-100 text-gray-700' }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${info.badgeClass}`}
    >
      {info.label}
    </span>
  )
}

type RatingBadgeProps = {
  score: number
  showBand?: boolean
  className?: string
}

export const RatingBadge: React.FC<RatingBadgeProps> = ({ score, showBand = false, className = '' }) => {
  const info = getRatingBand(score)
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${info.badgeClass} ${className}`}
    >
      <span>
        {showBand ? `${info.band} · ` : ''}
        {info.label}
      </span>
      <span className="ml-0.5 px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[10.5px] font-sans font-semibold tracking-tight">
        {score.toFixed(2)}
      </span>
    </span>
  )
}

type RoleBadgeProps = {
  role: Role
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const styles = {
    admin:
      'bg-slate-100 dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 border-slate-200 dark:border-zinc-800 font-sans text-[11px]',
    manager:
      'bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-800 font-sans text-[11px]',
    employee:
      'bg-slate-50 dark:bg-zinc-900/60 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 font-sans text-[11px]',
  }[role]

  const label = {
    admin: 'Administrator',
    manager: 'People Manager',
    employee: 'Individual Contributor',
  }[role]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-semibold border shadow-2xs tracking-wide ${styles}`}
    >
      {label}
    </span>
  )
}

