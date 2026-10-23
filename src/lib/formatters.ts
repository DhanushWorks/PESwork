import { CycleStage, GoalStatus } from '../types'

export function formatDate(dateString?: string): string {
  if (!dateString) return '—'
  try {
    // If format is YYYY-MM-DD, parse year, month, day in local time to avoid UTC day-shift
    const cleanDate = dateString.split('T')[0]
    const parts = cleanDate.split('-').map(Number)
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const d = new Date(parts[0], parts[1] - 1, parts[2])
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function formatDateTime(dateString?: string): string {
  if (!dateString) return '—'
  try {
    const d = new Date(dateString)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

export function formatScore(score: number): string {
  if (score === undefined || score === null || isNaN(score)) return '—'
  return score.toFixed(2)
}

export function getGoalStatusBadge(status: GoalStatus): { label: string; className: string } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', className: 'bg-slate-900 text-white border-transparent dark:bg-white dark:text-slate-900 font-mono text-[11px] font-semibold' }
    case 'pending_approval':
      return { label: 'Pending Approval', className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 font-mono text-[11px] font-medium' }
    case 'draft':
      return { label: 'Draft', className: 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 font-mono text-[11px]' }
    case 'returned':
      return { label: 'Needs Revision', className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 font-mono text-[11px] font-medium' }
    case 'completed':
      return { label: 'Completed', className: 'bg-slate-900 text-white border-transparent dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 font-medium font-mono text-[11px]' }
    case 'cancelled':
      return { label: 'Cancelled', className: 'bg-slate-100 dark:bg-white/[0.03] text-slate-500 dark:text-[#667085] border-slate-200 dark:border-white/10 font-mono text-[11px]' }
    default:
      return { label: status, className: 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-white/10 font-mono text-[11px]' }
  }
}

export const CYCLE_STAGE_DETAILS: Record<
  CycleStage,
  { label: string; stepNumber: number; description: string; badgeClass: string }
> = {
  draft: {
    label: 'Cycle Draft',
    stepNumber: 1,
    description: 'Setting up cycle parameters, weights, and participant cohorts',
    badgeClass: 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-white/10 font-mono text-[11px]',
  },
  goals_open: {
    label: 'Goals Open',
    stepNumber: 2,
    description: 'Employees create goals; managers review and approve targets',
    badgeClass: 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-[#EEF1F7] border-slate-200 dark:border-white/10 font-mono text-[11px]',
  },
  tracking: {
    label: 'Goal Tracking',
    stepNumber: 3,
    description: 'Ongoing execution and milestone progress check-ins',
    badgeClass: 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-[#EEF1F7] border-slate-200 dark:border-white/10 font-mono text-[11px]',
  },
  self_review: {
    label: 'Self-Review',
    stepNumber: 4,
    description: 'Employees reflect on accomplishments, competencies, and values',
    badgeClass: 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-[#EEF1F7] border-slate-200 dark:border-white/10 font-mono text-[11px]',
  },
  manager_review: {
    label: 'Manager Review',
    stepNumber: 5,
    description: 'Managers evaluate performance, assess competencies, and recommend growth',
    badgeClass: 'bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-[#EEF1F7] border-slate-200 dark:border-white/10 font-mono text-[11px]',
  },
  calibration: {
    label: 'Calibration',
    stepNumber: 6,
    description: 'People Ops and leadership calibrate score distributions across departments',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 font-mono text-[11px] font-medium',
  },
  released: {
    label: 'Results Released',
    stepNumber: 7,
    description: 'Employees view final evaluations, acknowledge outcomes, and plan growth',
    badgeClass: 'bg-slate-900 text-white border-transparent dark:bg-white dark:text-slate-900 font-mono text-[11px] font-semibold',
  },
  closed: {
    label: 'Cycle Closed',
    stepNumber: 8,
    description: 'Cycle finalized and archived for historical reporting',
    badgeClass: 'bg-slate-200/80 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-300 dark:border-zinc-700 font-mono text-[11px] font-semibold',
  },
}

export const STAGE_ORDER: CycleStage[] = [
  'draft',
  'goals_open',
  'tracking',
  'self_review',
  'manager_review',
  'calibration',
  'released',
  'closed',
]

