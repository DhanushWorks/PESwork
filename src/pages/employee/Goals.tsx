import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { goalService } from '../../services'
import { Goal, GoalStatus } from '../../types'
import { GoalStatusBadge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/MetricCard'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DatePicker } from '../../components/ui/DatePicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { formatDate } from '../../lib/formatters'
import { validateGoalSet } from '../../lib/validation'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit2,
  FileUp,
  Filter,
  Plus,
  Search,
  Send,
  Sliders,
  Target,
  Trash2,
} from 'lucide-react'

// Mini circular donut progress ring for goal weight
const WeightDonut: React.FC<{ weight: number }> = ({ weight }) => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(timer)
  }, [])

  const size = 15
  const strokeWidth = 2.4
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const validWeight = Math.min(100, Math.max(0, weight || 0))
  const targetOffset = circumference - (validWeight / 100) * circumference
  const offset = mounted ? targetOffset : circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90 shrink-0" aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-300 dark:text-zinc-700/80"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-slate-900 dark:text-white transition-all duration-700 ease-out"
      />
    </svg>
  )
}

function getDueStatus(dueDateStr?: string) {
  if (!dueDateStr) return null
  const due = new Date(dueDateStr)
  if (isNaN(due.getTime())) return null
  const now = new Date()
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((dueDay - nowDay) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      label: 'Overdue',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    }
  }
  if (diffDays === 0) {
    return {
      label: 'Due today',
      badgeClass: 'bg-slate-200/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-300/80 dark:border-zinc-700',
    }
  }
  if (diffDays <= 7) {
    return {
      label: `${diffDays}d left`,
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    }
  }
  return {
    label: 'On schedule',
    badgeClass: 'bg-slate-100 dark:bg-zinc-800/70 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/60',
  }
}

export const EmployeeGoals: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const { success, error, warning } = useToast()

  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null)
  const [progressPercentage, setProgressPercentage] = useState(50)
  const [progressNote, setProgressNote] = useState('')
  const [evidenceFileName, setEvidenceFileName] = useState('')

  // Submit Goal Set Confirmation
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Goal Form Fields
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMetric, setFormMetric] = useState('')
  const [formTarget, setFormTarget] = useState(100)
  const [formUnit, setFormUnit] = useState('%')
  const [formWeight, setFormWeight] = useState(25)
  const [formDueDate, setFormDueDate] = useState('')

  const fetchGoals = async () => {
    setLoading(true)
    try {
      const list = await goalService.listForUser(currentUser.id, activeCycle.id)
      setGoals(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGoals()
  }, [currentUser.id, activeCycle.id])

  const totalWeight = goals
    .filter((g) => g.status !== 'cancelled')
    .reduce((sum, g) => sum + (Number(g.weight) || 0), 0)

  const validation = validateGoalSet(goals)

  const openCreateModal = () => {
    setEditingGoal(null)
    setFormTitle('')
    setFormDescription('')
    setFormMetric('')
    setFormTarget(100)
    setFormUnit('%')
    setFormWeight(25)
    setFormDueDate(activeCycle.deadlines.goalsDue || '2026-11-30')
    setShowGoalModal(true)
  }

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal)
    setFormTitle(goal.title)
    setFormDescription(goal.description)
    setFormMetric(goal.metric)
    setFormTarget(goal.target)
    setFormUnit(goal.unit)
    setFormWeight(goal.weight)
    setFormDueDate(goal.dueDate)
    setShowGoalModal(true)
  }

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      error('Title required', 'Please provide a clear title for the performance goal.')
      return
    }

    try {
      await goalService.save({
        id: editingGoal?.id,
        userId: currentUser.id,
        cycleId: activeCycle.id,
        title: formTitle,
        description: formDescription,
        metric: formMetric,
        target: Number(formTarget),
        unit: formUnit,
        weight: Number(formWeight),
        dueDate: formDueDate,
        status: editingGoal?.status === 'returned' ? 'draft' : editingGoal?.status || 'draft',
      })

      success(
        editingGoal ? 'Goal updated' : 'Goal drafted',
        `"${formTitle}" was saved to your ${activeCycle.name} goal plan.`
      )
      setShowGoalModal(false)
      fetchGoals()
    } catch (err: any) {
      error('Save failed', err.message)
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await goalService.delete(goalId)
      success('Goal deleted', 'Draft goal removed from plan.')
      fetchGoals()
    } catch (err: any) {
      error('Cannot delete goal', err.message)
    }
  }

  const openProgressModal = (goal: Goal) => {
    setProgressGoal(goal)
    setProgressPercentage(goal.progress)
    setProgressNote('')
    setEvidenceFileName('')
    setShowProgressModal(true)
  }

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!progressGoal) return

    try {
      await goalService.addProgress(
        progressGoal.id,
        progressPercentage,
        progressNote || 'Regular milestone checkpoint update.',
        evidenceFileName || undefined
      )
      success('Progress recorded', `Updated progress on "${progressGoal.title}" to ${progressPercentage}%.`)
      setShowProgressModal(false)
      fetchGoals()
    } catch (err: any) {
      error('Progress update failed', err.message)
    }
  }

  const handleSubmitGoalPlan = async () => {
    if (!validation.isValid) {
      error('Cannot submit goals', validation.errors[0])
      return
    }

    setIsSubmitting(true)
    try {
      const res = await goalService.submitGoalsForApproval(currentUser.id, activeCycle.id)
      if (res.success) {
        success('Goals submitted for approval', 'Marcus Chen will review and approve your performance targets.')
        setShowSubmitConfirm(false)
        fetchGoals()
      } else {
        error('Validation error', res.errors?.[0] || 'Goals could not be submitted.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredGoals = goals.filter((g) => {
    const matchSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.metric.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' ? true : g.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Page Header (Matching Reference UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Performance Goals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Define measurable OKRs, milestones & weighted commitments for {activeCycle.name}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openCreateModal}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 dark:bg-white dark:hover:bg-slate-100 dark:text-black font-semibold text-xs sm:text-sm cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all border border-slate-200 dark:border-white/10"
          >
            <Plus className="w-4 h-4" />
            <span>Create Goal</span>
          </button>

          {goals.some((g) => g.status === 'draft' || g.status === 'returned') && (
            <button
              type="button"
              onClick={() => {
                if (!validation.isValid) {
                  warning('Goal plan incomplete', validation.errors[0])
                } else {
                  setShowSubmitConfirm(true)
                }
              }}
              className="inline-flex items-center gap-2 h-10 sm:h-11 px-4 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all font-medium text-xs cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>Submit for Approval</span>
            </button>
          )}
        </div>
      </div>

      {/* Goal Plan Balance Card (Matching Reference Screenshot) */}
      <div className="rounded-2xl sm:rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-6">
        {/* Top Row: Meta info & Stat blocks */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                GOAL PLAN BALANCE
              </span>
              {validation.isValid ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-indigo-50/90 text-indigo-700 dark:text-[#B7B1FF] border border-indigo-200/90 dark:border-[#8B7CFF]/30 dark:bg-[#8B7CFF]/15 shadow-2xs font-semibold">
                  <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-[#B7B1FF]" />
                  <span>Ready to Submit</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-[#FFB454] border border-amber-500/30">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-[#FFB454]" />
                  <span>Requirements Pending</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Requires 3–7 active goals and exactly 100% total weight commitment.
            </p>
          </div>

          {/* Metric Stat Blocks */}
          <div className="flex items-center gap-6 sm:gap-8 shrink-0">
            <div className="text-right">
              <div className="text-[10px] sm:text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-zinc-400">
                ACTIVE GOALS
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {goals.length} Goals
              </div>
            </div>

            <div className="h-9 w-px bg-slate-200 dark:bg-white/10" />

            <div className="text-right">
              <div className="text-[10px] sm:text-[11px] font-mono tracking-wider uppercase text-slate-500 dark:text-zinc-400">
                TOTAL WEIGHT
              </div>
              <div
                className={`text-xl sm:text-2xl font-bold mt-0.5 tabular-nums ${
                  totalWeight === 100
                    ? 'text-indigo-600 dark:text-[#8B7CFF]'
                    : 'text-amber-600 dark:text-[#FFB454]'
                }`}
              >
                {totalWeight}% / 100%
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Segmented Proportional Weight Bar */}
        <div className="space-y-3">
          <div className="w-full h-3 rounded-full overflow-hidden p-0.5 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] flex items-center">
            {goals.length === 0 ? (
              <div className="w-full h-full rounded-full bg-slate-200 dark:bg-white/10" />
            ) : (
              <div
                className="h-full flex items-center gap-2 transition-all duration-500 w-full"
                style={{ width: `${Math.min(100, Math.max(0, totalWeight))}%` }}
              >
                {goals.map((g, idx) => {
                  const colors = ['bg-indigo-600 dark:bg-[#8B7CFF]', 'bg-slate-900 dark:bg-white', 'bg-slate-400 dark:bg-zinc-300', 'bg-slate-600 dark:bg-zinc-400', 'bg-slate-500 dark:bg-zinc-500']
                  const colorClass = colors[idx % colors.length]

                  return (
                    <div
                      key={g.id || idx}
                      style={{ flex: `${Math.max(1, Number(g.weight) || 0)} 0 0%` }}
                      className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                      title={`${g.title}: ${g.weight}%`}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend Row */}
          {goals.length > 0 && (
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-xs font-mono text-slate-600 dark:text-zinc-300 pt-1">
              {goals.map((g, idx) => {
                const colors = ['bg-indigo-600 dark:bg-[#8B7CFF]', 'bg-slate-900 dark:bg-white', 'bg-slate-400 dark:bg-zinc-300', 'bg-slate-600 dark:bg-zinc-400', 'bg-slate-500 dark:bg-zinc-500']
                const colorClass = colors[idx % colors.length]

                return (
                  <div key={g.id || idx} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
                    <span className="truncate max-w-[210px] sm:max-w-[260px] text-slate-800 dark:text-zinc-200">
                      {g.title}
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-semibold">{g.weight}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Subtle Horizontal Divider */}
        <div className="border-t border-slate-200/90 dark:border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Bottom Validation Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border font-semibold ${
                goals.length >= 3 && goals.length <= 7
                  ? 'border-indigo-200/90 bg-indigo-50/90 text-indigo-700 dark:border-[#8B7CFF]/30 dark:bg-[#8B7CFF]/15 dark:text-[#B7B1FF]'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-[#FFB454]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>3–7 goals · {goals.length} active</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border font-semibold ${
                totalWeight === 100
                  ? 'border-indigo-200/90 bg-indigo-50/90 text-indigo-700 dark:border-[#8B7CFF]/30 dark:bg-[#8B7CFF]/15 dark:text-[#B7B1FF]'
                  : 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-[#FFB454]'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>100% weight committed</span>
            </span>
          </div>

          {/* Incomplete details if any */}
          {!validation.isValid && validation.errors.length > 0 && (
            <div className="text-xs font-mono text-amber-700 dark:text-[#FFB454]">
              {validation.errors[0]}
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar Card (Matching Reference Screenshot) */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-3.5">
        {/* Top Search Input & Filter Button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-4 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals by title..."
              className="w-full h-11 pl-11 pr-12 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 transition-all font-sans"
            />
            <div className="absolute right-3.5 pointer-events-none px-2 py-0.5 rounded-md border border-slate-200 dark:border-white/10 text-[11px] font-mono text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.06]">
              /
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className="h-11 w-11 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center cursor-pointer shrink-0"
            title="Reset filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Status Filter Tabs Capsule */}
        <div className="overflow-x-auto w-full sm:w-fit scrollbar-none">
          <RubberSegmentedControl
            options={[
              { value: 'all', label: 'All', count: goals.length },
              { value: 'draft', label: 'Draft', count: goals.filter((g) => g.status === 'draft').length },
              {
                value: 'pending_approval',
                label: 'Pending Approval',
                count: goals.filter((g) => g.status === 'pending_approval').length,
              },
              {
                value: 'approved',
                label: 'Approved',
                count: goals.filter((g) => g.status === 'approved').length,
              },
              {
                value: 'returned',
                label: 'Returned',
                count: goals.filter((g) => g.status === 'returned').length,
              },
              {
                value: 'completed',
                label: 'Completed',
                count: goals.filter((g) => g.status === 'completed').length,
              },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            size="sm"
          />
        </div>
      </div>

      {/* Goals List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading goals...</div>
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          title="No goals match your filter"
          description="Try clearing your search query or create a new performance goal."
          action={{
            label: 'Create Goal',
            icon: <Plus className="w-3.5 h-3.5" />,
            onClick: openCreateModal,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredGoals.map((g) => {
            const isApproved = g.status === 'approved' || g.status === 'completed'
            const isEditable = g.status === 'draft' || g.status === 'returned'
            const dueStatus = getDueStatus(g.dueDate)
            const remainingToTarget = Math.max(0, 100 - g.progress)

            return (
              <div
                key={g.id}
                className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20"
              >
                {/* Card Top Row: Status, Meta, Due, & Actions */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <GoalStatusBadge status={g.status} />

                    {/* Weight Donut Pill */}
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-800 text-xs font-semibold">
                      <WeightDonut weight={g.weight} />
                      <span>Weight <strong className="font-bold text-slate-900 dark:text-white">{g.weight}%</strong></span>
                    </span>

                    {/* Due Date */}
                    <span className="text-xs font-mono text-slate-500 dark:text-zinc-400">
                      Due: {formatDate(g.dueDate)}
                    </span>

                    {/* Dynamic Urgency Status Pill */}
                    {dueStatus && (
                      <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${dueStatus.badgeClass}`}>
                        {dueStatus.label}
                      </span>
                    )}
                  </div>

                  {/* Actions aligned to top right */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => openProgressModal(g)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>Update Progress</span>
                      </button>
                    )}

                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => openEditModal(g)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>Edit</span>
                      </button>
                    )}

                    {g.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title="Delete draft goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Title & Description */}
                <div className="space-y-1.5">
                  <Link
                    to={`/employee/goals/${g.id}`}
                    className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 transition-colors inline-block"
                  >
                    {g.title}
                  </Link>

                  {g.description && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                      {g.description}
                    </p>
                  )}
                </div>

                {/* Returned Comment Banner if returned */}
                {g.status === 'returned' && g.returnReason && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-mono text-rose-600 dark:text-rose-400 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                      <AlertCircle className="w-3.5 h-3.5" /> Manager Revision Feedback:
                    </div>
                    <p className="italic pl-5">"{g.returnReason}"</p>
                  </div>
                )}

                {/* Bottom Section: Dual Column Executive Dashboard Layout */}
                <div className="pt-6 border-t border-slate-100 dark:border-white/[0.08] flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                  {/* Left Column: Metric Target, Giant Big Number, and Visual Slider Track with Glowing Knob */}
                  <div className="flex-1 min-w-0 pr-0 lg:pr-8">
                    {/* Metric Target Label */}
                    <div className="text-xs font-mono text-slate-500 dark:text-zinc-400 tracking-tight">
                      Metric: {g.metric} (Target: {g.target} {g.unit})
                    </div>

                    {/* Giant Percentage & Target Delta */}
                    <div className="flex items-baseline mt-2 mb-3">
                      <span className="text-4xl sm:text-5xl font-black font-sans tracking-tight text-slate-900 dark:text-white leading-none">
                        {g.progress}
                      </span>
                      <span className="text-2xl font-bold text-slate-400 dark:text-zinc-500 ml-1 leading-none">
                        %
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-500 dark:text-zinc-400 ml-3.5">
                        {g.progress >= 100 ? (
                          <span className="text-indigo-600 dark:text-[#B7B1FF] font-semibold">Target achieved</span>
                        ) : (
                          `${remainingToTarget}% to target`
                        )}
                      </span>
                    </div>

                    {/* Visual Slider Track with Glowing Knob */}
                    <div className="relative w-full pt-1">
                      <div className="w-full bg-slate-200/90 dark:bg-zinc-900 border border-slate-300/80 dark:border-zinc-800/90 rounded-full h-2.5 relative">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:via-[#6366f1] dark:to-[#4FE3C1] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }}
                        />
                        {/* Luminous Knob at current progress tip */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white dark:bg-white border-2 border-slate-900 dark:border-zinc-950 shadow-[0_0_12px_rgba(139,124,255,0.7)] ring-2 ring-indigo-500/40 dark:ring-[#4FE3C1]/50 transition-all duration-500 pointer-events-none"
                          style={{ left: `${Math.min(100, Math.max(0, g.progress))}%` }}
                        />
                      </div>

                      {/* Milestone Scale Ticks */}
                      <div className="flex justify-between text-[10px] font-mono text-slate-400 dark:text-zinc-500 pt-2 px-0.5 select-none">
                        <span>0</span>
                        <span>25</span>
                        <span>50</span>
                        <span>75</span>
                        <span>100</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Checkpoint Stats */}
                  <div className="lg:border-l border-slate-200 dark:border-white/[0.08] lg:pl-8 lg:min-w-[220px] flex flex-col justify-end pt-3 lg:pt-0">
                    <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-bold block mb-1">
                      PROGRESS UPDATES LOGGED
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold font-mono text-slate-900 dark:text-white leading-none">
                        {g.progressHistory?.length || 0}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                        {(g.progressHistory?.length || 0) === 1 ? 'checkpoint recorded' : 'checkpoints recorded'}
                      </span>
                    </div>
                    <Link
                      to={`/employee/goals/${g.id}`}
                      className="text-xs font-semibold text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 inline-flex items-center gap-1 mt-2.5 transition-colors group"
                    >
                      <span>View checkpoints</span>
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Goal Create/Edit Modal */}
      <Modal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        title={editingGoal ? 'Edit Performance Goal' : 'Define New Performance Goal'}
        subtitle={`Goal will be part of ${activeCycle.name}`}
        maxWidth="lg"
        overflowVisible={true}
      >
        <form onSubmit={handleSaveGoal} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Goal Title *</label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Design System v3 Accessibility Modernization"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Description & Strategic Intent</label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Detail key deliverables, customer impact, and technical milestones..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Target Metric *</label>
              <input
                type="text"
                required
                value={formMetric}
                onChange={(e) => setFormMetric(e.target.value)}
                placeholder="e.g. Component adoption rate"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Target Value</label>
                <input
                  type="number"
                  required
                  value={formTarget}
                  onChange={(e) => setFormTarget(parseFloat(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Unit</label>
                <input
                  type="text"
                  required
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="%"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Weight Allocation (%) *</label>
              <input
                type="number"
                min="5"
                max="100"
                required
                value={formWeight}
                onChange={(e) => setFormWeight(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total weight across goals must sum to 100%.
              </span>
            </div>

            <div>
              <DatePicker
                label="Target Due Date"
                required
                value={formDueDate}
                onChange={(val) => setFormDueDate(val)}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowGoalModal(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white font-semibold transition-colors shadow-xs cursor-pointer"
            >
              {editingGoal ? 'Update Goal' : 'Save Goal'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Progress Update Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="Record Goal Progress & Evidence"
        subtitle={progressGoal?.title}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProgress} className="space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 dark:text-zinc-300">Completion Percentage</label>
              <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">{progressPercentage}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressPercentage}
              onChange={(e) => setProgressPercentage(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Progress Notes & Milestones Achieved</label>
            <textarea
              rows={3}
              required
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Describe what was delivered, hurdles cleared, or metrics verified..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Evidence Document / Snapshot (Optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={evidenceFileName}
                onChange={(e) => setEvidenceFileName(e.target.value)}
                placeholder="e.g. lighthouse_audit_q3.pdf or dashboard_snapshot.png"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setEvidenceFileName('metric_telemetry_snapshot.pdf')}
                className="px-2.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg text-slate-600 dark:text-zinc-300 flex-shrink-0 cursor-pointer"
                title="Use sample filename"
              >
                <FileUp className="w-4 h-4" />
              </button>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1 block">
              In preview mode, file references are logged in the goal audit history.
            </span>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowProgressModal(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-xs cursor-pointer"
            >
              Record Checkpoint
            </button>
          </div>
        </form>
      </Modal>

      {/* Submit Goals Confirmation */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmitGoalPlan}
        title="Submit Performance Goals for Approval?"
        message={`Your goal set has ${goals.length} goals with exactly 100% weight. Upon submitting, Marcus Chen will be notified to review and lock your targets.`}
        confirmText="Submit Goals"
        variant="primary"
        isLoading={isSubmitting}
      />
    </div>
  )
}

