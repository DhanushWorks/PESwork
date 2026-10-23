import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { reviewService, goalService, peopleService, resultService, storageService } from '../../services'
import { TeamReviewSummary } from '../../services/mock/reviewService'
import { Goal, EvaluationResult, User } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { MetricCard } from '../../components/ui/MetricCard'
import { RatingBadge } from '../../components/ui/Badge'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import { Modal } from '../../components/ui/Modal'
import { getManagerWorkflowState } from '../../lib/workflow'
import { formatDate, STAGE_ORDER } from '../../lib/formatters'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck,
  FileEdit,
  FileText,
  LayoutGrid,
  List,
  RotateCcw,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'

export const ManagerDashboard: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const { success, error } = useToast()
  const navigate = useNavigate()

  const [teamSummaries, setTeamSummaries] = useState<TeamReviewSummary[]>([])
  const [pendingGoalItems, setPendingGoalItems] = useState<Array<{ goal: Goal; employee: User }>>([])
  const [pendingGoals, setPendingGoals] = useState<Goal[]>([])
  const [releasedResults, setReleasedResults] = useState<EvaluationResult[]>([])
  const [teamFilter, setTeamFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Quick Action States for Pending Goals
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [selectedGoalForReturn, setSelectedGoalForReturn] = useState<{ goal: Goal; employee: User } | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [isReturning, setIsReturning] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaries, directReports, allResults] = await Promise.all([
        reviewService.listTeamReviews(currentUser.id, activeCycle.id),
        peopleService.getDirectReports(currentUser.id),
        resultService.getAllResults(activeCycle.id),
      ])

      // Fetch all pending goals for direct reports
      const allGoalsPromises = directReports.map((r) =>
        goalService.listForUser(r.id, activeCycle.id)
      )
      const allGoalsResults = await Promise.all(allGoalsPromises)
      const pendingItems: Array<{ goal: Goal; employee: User }> = []

      directReports.forEach((emp, index) => {
        const userGoals = allGoalsResults[index] || []
        const pending = userGoals.filter((g) => g.status === 'pending_approval')
        pending.forEach((g) => pendingItems.push({ goal: g, employee: emp }))
      })

      setTeamSummaries(summaries)
      setPendingGoalItems(pendingItems)
      setPendingGoals(pendingItems.map((p) => p.goal))
      setReleasedResults(allResults)
    } finally {
      setLoading(false)
    }
  }, [currentUser.id, activeCycle.id])

  useEffect(() => {
    fetchData()

    // Subscribe to state changes so the manager dashboard immediately synchronizes
    const unsubscribe = storageService.subscribe(() => {
      fetchData()
    })

    return () => {
      unsubscribe()
    }
  }, [fetchData])

  const handleQuickApprove = async (goalId: string, goalTitle: string) => {
    setActionInProgress(goalId)
    try {
      await goalService.decide(goalId, 'approved')
      success('Goal approved', `Approved "${goalTitle}". Target is now active.`)
      await fetchData()
    } catch (err: any) {
      error('Approval failed', err.message || 'Could not approve goal')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGoalForReturn) return
    if (!returnReason.trim() || returnReason.trim().length < 5) {
      error('Reason required', 'Please provide constructive feedback explaining what needs revision.')
      return
    }

    setIsReturning(true)
    try {
      await goalService.decide(selectedGoalForReturn.goal.id, 'returned', returnReason)
      success(
        'Goal returned for revision',
        `Returned "${selectedGoalForReturn.goal.title}" to ${selectedGoalForReturn.employee.name} with revision notes.`
      )
      setSelectedGoalForReturn(null)
      setReturnReason('')
      await fetchData()
    } catch (err: any) {
      error('Action failed', err.message || 'Could not return goal')
    } finally {
      setIsReturning(false)
    }
  }

  const scrollToRoster = (filter?: 'all' | 'pending' | 'completed') => {
    if (filter) setTeamFilter(filter)
    const rosterEl = document.getElementById('roster')
    if (rosterEl) {
      rosterEl.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const totalReports = teamSummaries.length

  // Counts & Progress Calculations for Section 1 (Team Review Progress)
  const goalsApprovedReports = teamSummaries.filter(
    (t) => t.goalsCount > 0 && t.goalsApprovedCount === t.goalsCount
  ).length
  const goalApprovalPct = totalReports > 0 ? Math.round((goalsApprovedReports / totalReports) * 100) : 0
  const isGoalApprovalOverdue =
    Boolean(activeCycle.deadlines?.goalsDue) &&
    new Date() > new Date(activeCycle.deadlines.goalsDue) &&
    goalsApprovedReports < totalReports
  const goalApprovalStatus: 'completed' | 'overdue' | 'in_progress' | 'pending' =
    totalReports > 0 && goalsApprovedReports === totalReports
      ? 'completed'
      : isGoalApprovalOverdue
      ? 'overdue'
      : goalsApprovedReports > 0 || pendingGoals.length > 0
      ? 'in_progress'
      : 'pending'

  const selfReviewsSubmittedCount = teamSummaries.filter(
    (t) => t.selfReviewStatus === 'submitted'
  ).length
  const selfReviewPct = totalReports > 0 ? Math.round((selfReviewsSubmittedCount / totalReports) * 100) : 0
  const isSelfReviewOverdue =
    Boolean(activeCycle.deadlines?.selfReviewDue) &&
    new Date() > new Date(activeCycle.deadlines.selfReviewDue) &&
    selfReviewsSubmittedCount < totalReports
  const selfReviewStageStatus: 'completed' | 'overdue' | 'in_progress' | 'pending' =
    totalReports > 0 && selfReviewsSubmittedCount === totalReports
      ? 'completed'
      : isSelfReviewOverdue
      ? 'overdue'
      : selfReviewsSubmittedCount > 0
      ? 'in_progress'
      : 'pending'

  const submittedReviewsCount = teamSummaries.filter(
    (t) => t.managerReviewStatus === 'submitted'
  ).length
  const managerReviewPct = totalReports > 0 ? Math.round((submittedReviewsCount / totalReports) * 100) : 0
  const pendingReviewsCount = teamSummaries.filter(
    (t) => t.managerReviewStatus !== 'submitted'
  ).length
  const isManagerReviewOverdue =
    Boolean(activeCycle.deadlines?.managerReviewDue) &&
    new Date() > new Date(activeCycle.deadlines.managerReviewDue) &&
    submittedReviewsCount < totalReports
  const managerReviewStageStatus: 'completed' | 'overdue' | 'in_progress' | 'pending' =
    totalReports > 0 && submittedReviewsCount === totalReports
      ? 'completed'
      : isManagerReviewOverdue
      ? 'overdue'
      : submittedReviewsCount > 0
      ? 'in_progress'
      : 'pending'

  const resultsReleasedCount = releasedResults.filter((r) =>
    teamSummaries.some((t) => t.employee.id === r.employeeId)
  ).length
  const isReleased =
    activeCycle.stage === 'released' ||
    (totalReports > 0 && resultsReleasedCount >= totalReports)
  const isCalibration = activeCycle.stage === 'calibration'
  const calibrationPct = isReleased
    ? 100
    : isCalibration
    ? Math.round((submittedReviewsCount / (totalReports || 1)) * 100)
    : 0
  const calibrationStageStatus: 'completed' | 'in_progress' | 'pending' = isReleased
    ? 'completed'
    : isCalibration
    ? 'in_progress'
    : 'pending'

  const overallTeamProgress = Math.round(
    (goalApprovalPct * 0.25) +
    (selfReviewPct * 0.25) +
    (managerReviewPct * 0.35) +
    (calibrationPct * 0.15)
  )

  // Calculations for Section 3 (Pending Performance Evaluations)
  const pendingEvaluations = teamSummaries.filter(
    (t) => t.managerReviewStatus !== 'submitted'
  )

  // Calculations for Section 4 (Upcoming Deadlines)
  const getDeadlineMeta = (dueDateStr: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDateStr)
    due.setHours(0, 0, 0, 0)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        status: 'overdue' as const,
        label: `${Math.abs(diffDays)}d overdue`,
        badgeClass: 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/20',
      }
    } else if (diffDays <= 7) {
      return {
        status: 'due_soon' as const,
        label: diffDays === 0 ? 'Due today' : `Due in ${diffDays}d`,
        badgeClass: 'bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border-amber-200 dark:border-[#FFB454]/20',
      }
    } else {
      return {
        status: 'upcoming' as const,
        label: `In ${diffDays}d`,
        badgeClass: 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-zinc-200 border-slate-200 dark:border-white/10',
      }
    }
  }

  type ActiveDeadlineItem = {
    id: string
    task: string
    subtitle: string
    dueDate: string
    status: 'overdue' | 'due_soon' | 'upcoming'
    statusLabel: string
    badgeClass: string
    actionLink: string
    actionLabel: string
  }

  const upcomingDeadlinesList: ActiveDeadlineItem[] = []

  // 1. Goal Approvals Deadline
  if (
    activeCycle.deadlines?.goalsDue &&
    (pendingGoalItems.length > 0 || (totalReports > 0 && goalsApprovedReports < totalReports))
  ) {
    const meta = getDeadlineMeta(activeCycle.deadlines.goalsDue)
    upcomingDeadlinesList.push({
      id: 'goals',
      task: 'Team Goal Approvals',
      subtitle: pendingGoalItems.length > 0
        ? `${pendingGoalItems.length} target agreement${pendingGoalItems.length === 1 ? '' : 's'} awaiting approval`
        : `${totalReports - goalsApprovedReports} member${totalReports - goalsApprovedReports === 1 ? '' : 's'} with unapproved goals`,
      dueDate: activeCycle.deadlines.goalsDue,
      status: meta.status,
      statusLabel: meta.label,
      badgeClass: meta.badgeClass,
      actionLink: '/manager/approvals',
      actionLabel: 'Review Goals',
    })
  }

  // 2. Direct Report Self-Reviews Deadline
  if (
    activeCycle.deadlines?.selfReviewDue &&
    totalReports > 0 &&
    selfReviewsSubmittedCount < totalReports
  ) {
    const meta = getDeadlineMeta(activeCycle.deadlines.selfReviewDue)
    upcomingDeadlinesList.push({
      id: 'self-reviews',
      task: 'Employee Self-Reviews',
      subtitle: `${totalReports - selfReviewsSubmittedCount} reflection${totalReports - selfReviewsSubmittedCount === 1 ? '' : 's'} pending submission`,
      dueDate: activeCycle.deadlines.selfReviewDue,
      status: meta.status,
      statusLabel: meta.label,
      badgeClass: meta.badgeClass,
      actionLink: '#roster',
      actionLabel: 'View Roster',
    })
  }

  // 3. Manager Performance Evaluations Deadline
  if (
    activeCycle.deadlines?.managerReviewDue &&
    totalReports > 0 &&
    submittedReviewsCount < totalReports
  ) {
    const meta = getDeadlineMeta(activeCycle.deadlines.managerReviewDue)
    upcomingDeadlinesList.push({
      id: 'manager-reviews',
      task: 'Manager Performance Appraisals',
      subtitle: `${pendingReviewsCount} team review${pendingReviewsCount === 1 ? '' : 's'} awaiting evaluation`,
      dueDate: activeCycle.deadlines.managerReviewDue,
      status: meta.status,
      statusLabel: meta.label,
      badgeClass: meta.badgeClass,
      actionLink: '#roster',
      actionLabel: 'Evaluate Team',
    })
  }

  // 4. Calibration Committee Review Deadline
  if (
    activeCycle.deadlines?.calibrationDue &&
    activeCycle.stage !== 'released' &&
    activeCycle.stage !== 'closed'
  ) {
    const meta = getDeadlineMeta(activeCycle.deadlines.calibrationDue)
    upcomingDeadlinesList.push({
      id: 'calibration',
      task: 'Committee Calibration Review',
      subtitle: 'Department-level rating distribution & calibration',
      dueDate: activeCycle.deadlines.calibrationDue,
      status: meta.status,
      statusLabel: meta.label,
      badgeClass: meta.badgeClass,
      actionLink: '/manager/analytics',
      actionLabel: 'View Analytics',
    })
  }

  // 5. Outcome Release Deadline
  if (
    activeCycle.deadlines?.releaseDate &&
    activeCycle.stage !== 'released' &&
    activeCycle.stage !== 'closed'
  ) {
    const meta = getDeadlineMeta(activeCycle.deadlines.releaseDate)
    upcomingDeadlinesList.push({
      id: 'release',
      task: 'Performance Outcome Release',
      subtitle: 'Official publication of final ratings to employees',
      dueDate: activeCycle.deadlines.releaseDate,
      status: meta.status,
      statusLabel: meta.label,
      badgeClass: meta.badgeClass,
      actionLink: '#roster',
      actionLabel: 'View Roster',
    })
  }

  // Sort upcoming deadlines by nearest due date ascending
  upcomingDeadlinesList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

  // Synchronized workflow state calculation for Manager role
  const workflowState = getManagerWorkflowState({
    cycle: activeCycle,
    teamSummaries,
    pendingGoals,
    releasedResults,
  })
  const effectiveStage = workflowState.effectiveStage

  const filteredSummaries = teamSummaries.filter((t) => {
    if (teamFilter === 'pending' && t.managerReviewStatus === 'submitted') return false
    if (teamFilter === 'completed' && t.managerReviewStatus !== 'submitted') return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const nameMatch = t.employee?.name?.toLowerCase().includes(q)
      const desMatch = t.employee?.designation?.toLowerCase().includes(q)
      const deptMatch = t.employee?.department?.toLowerCase().includes(q)
      if (!nameMatch && !desMatch && !deptMatch) return false
    }
    return true
  })

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Direct Reports"
          value={teamSummaries.length}
          subtitle="Assigned team members"
        />

        <MetricCard
          title="Goal Approvals"
          value={pendingGoals.length}
          subtitle={
            pendingGoals.length === 0
              ? 'All team goals reviewed'
              : 'Requires manager approval'
          }
          badge={
            pendingGoals.length === 0 ? (
              <span className="text-[10px] font-sans bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-zinc-200 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 font-medium">
                Up to date
              </span>
            ) : (
              <span className="text-[10px] font-sans bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] px-2 py-0.5 rounded border border-amber-200 dark:border-[#FFB454]/20 font-medium">
                Action needed
              </span>
            )
          }
        />

        <MetricCard
          title="Self-Reviews In"
          value={`${selfReviewsSubmittedCount} / ${teamSummaries.length}`}
          subtitle="Completed reflection forms"
        />

        <MetricCard
          title="Manager Reviews"
          value={`${submittedReviewsCount} / ${teamSummaries.length}`}
          subtitle={`Due ${formatDate(activeCycle.deadlines.managerReviewDue)}`}
          trend={{
            value: `${Math.round((submittedReviewsCount / (teamSummaries.length || 1)) * 100)}% complete`,
            neutral: true,
          }}
        />
      </div>

      {/* Workflow Tracking: Progression Stepper */}
      <section>
        <StageStepper currentStage={effectiveStage} cycle={activeCycle} />
      </section>

      {/* Direct Reports Appraisal Roster (Moved to top under Stepper) */}
      <div id="roster" className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs dark:shadow-md transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-zinc-400">
                TEAM PERFORMANCE · DIRECT REPORTS
              </span>
            </div>
            <h2 className="heading-premium text-lg sm:text-xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">
              Evaluation Roster
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Inspect submitted self-reviews, verify goal commitments, and calibrate performance appraisals
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap self-start lg:self-auto shrink-0">
            {/* Status Filter Tabs */}
            <RubberSegmentedControl
              options={[
                { value: 'all', label: 'All', count: teamSummaries.length },
                { value: 'pending', label: 'Pending Review', count: pendingReviewsCount },
                { value: 'completed', label: 'Evaluated', count: submittedReviewsCount },
              ]}
              value={teamFilter}
              onChange={(val) => setTeamFilter(val as any)}
              size="xs"
            />

            {/* View Mode Switcher */}
            <RubberSegmentedControl
              options={[
                { value: 'table', label: 'Table', icon: <List className="w-3.5 h-3.5" /> },
                { value: 'grid', label: 'Cards', icon: <LayoutGrid className="w-3.5 h-3.5" /> },
              ]}
              value={viewMode}
              onChange={(val) => setViewMode(val as any)}
              size="xs"
            />

            {/* Animated Search Bar */}
            <AnimatedSearchBar
              value={searchQuery}
              onChangeValue={setSearchQuery}
              placeholder="Search team members..."
              animatedPlaceholders={[
                'Search direct reports...',
                'Filter by job designation...',
                'Search by teammate name...',
                'Filter team roster...',
              ]}
              variant="pill"
              sizeVariant="default"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 font-sans">
            Loading team evaluation roster...
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 dark:text-zinc-300 font-sans bg-slate-50/50 dark:bg-white/[0.015] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
            No team members match the selected filter.
          </div>
        ) : viewMode === 'table' ? (
          /* High-Density Aligned Executive Table View (Zero Text Wrapping & No Scrollbar) */
          <div
            className="overflow-x-auto no-scrollbar -mx-6 sm:mx-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-white/[0.04] border-y border-slate-200 dark:border-white/[0.12] text-slate-900 dark:text-white uppercase tracking-wider text-xs font-bold font-sans">
                  <th className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                    Direct Report
                  </th>
                  <th className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                    Goal Plan
                  </th>
                  <th className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                    Self-Review
                  </th>
                  <th className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                    Manager Appraisal
                  </th>
                  <th className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                    Appraisal Score
                  </th>
                  <th className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] text-slate-800 dark:text-zinc-200">
                {filteredSummaries.map((summary) => {
                  const emp = summary.employee
                  const isSrSubmitted = summary.selfReviewStatus === 'submitted'
                  const isMrSubmitted = summary.managerReviewStatus === 'submitted'

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => navigate(`/manager/reviews/${emp.id}`)}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors group cursor-pointer"
                    >
                      {/* Column 1: Direct Report Identity */}
                      <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={emp.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-nowrap">
                              <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors">
                                {emp.name}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                ({emp.employeeCode})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[170px]">
                              {emp.designation}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Goal Plan */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Target className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span className="font-semibold text-slate-800 dark:text-zinc-200">
                            {summary.goalsApprovedCount}
                          </span>
                          <span className="text-slate-400 dark:text-zinc-500">
                            / {summary.goalsCount} Approved
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Self-Review Status */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isSrSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-sans">
                              <CheckCircle2 className="w-3 h-3 text-current" />
                              Submitted
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/[0.04] dark:text-zinc-400 border border-slate-200/80 dark:border-white/10 font-sans">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                              Pending
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: Manager Appraisal Status */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isMrSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-sans">
                              <CheckCircle2 className="w-3 h-3 text-current" />
                              Evaluated
                            </span>
                          ) : isSrSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20 font-sans">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-[#FFB454]" />
                              Needs Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-500 dark:bg-white/[0.04] dark:text-zinc-400 border border-slate-200/80 dark:border-white/10 font-sans">
                              Waiting
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Appraisal Score */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        {summary.compositeScore ? (
                          <RatingBadge score={summary.compositeScore} />
                        ) : (
                          <span className="text-slate-400 dark:text-zinc-600 font-mono text-xs">
                            —
                          </span>
                        )}
                      </td>

                      {/* Column 6: Action Button */}
                      <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/manager/reviews/${emp.id}`)
                          }}
                          className={
                            isMrSubmitted
                              ? 'inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all text-xs font-semibold cursor-pointer shadow-2xs'
                              : 'premium-glow-btn text-xs font-semibold px-3.5 py-1.5 cursor-pointer inline-flex items-center gap-1'
                          }
                        >
                          <span>{isMrSubmitted ? 'View' : 'Evaluate'}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSummaries.map((summary) => {
              const emp = summary.employee
              const isSrSubmitted = summary.selfReviewStatus === 'submitted'
              const isMrSubmitted = summary.managerReviewStatus === 'submitted'

              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/manager/reviews/${emp.id}`)}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/20 transition-all cursor-pointer group space-y-3.5 shadow-2xs"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={emp.name}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors truncate">
                            {emp.name}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">
                            {emp.employeeCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {emp.designation}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 shrink-0">
                      {emp.department}
                    </span>
                  </div>

                  {/* Badges Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-sans pt-1">
                    <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 flex flex-col justify-between">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                        Goals
                      </span>
                      <span className="font-bold text-slate-800 dark:text-zinc-200 text-[11px] mt-0.5">
                        {summary.goalsApprovedCount}/{summary.goalsCount} Approved
                      </span>
                    </div>

                    <div className="p-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 flex flex-col justify-between">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                        Self-Review
                      </span>
                      <span className={`font-bold text-[11px] mt-0.5 ${isSrSubmitted ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400'}`}>
                        {isSrSubmitted ? 'Submitted' : 'Pending'}
                      </span>
                    </div>

                    <div className="col-span-2 p-2.5 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                        Appraisal
                      </span>
                      {summary.compositeScore ? (
                        <RatingBadge score={summary.compositeScore} />
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-[#FFB454] font-semibold">
                          Needs Review
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/manager/reviews/${emp.id}`)
                    }}
                    className={
                      isMrSubmitted
                        ? 'w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all text-xs font-semibold cursor-pointer shadow-2xs'
                        : 'w-full premium-glow-btn h-9 text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-xs'
                    }
                  >
                    <span>{isMrSubmitted ? 'View Evaluation' : 'Evaluate Performance'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Row: Section 1 (Team Review Progress) & Section 4 (Upcoming Deadlines) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        {/* SECTION 1: Team Review Progress */}
        <section className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-5 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/90 dark:border-white/[0.08]">
              <div>
                <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-zinc-400">
                  CYCLE MILESTONES · DIRECT REPORTS
                </span>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  Team Review Progress
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300 border border-slate-200 dark:border-white/10 font-mono">
                  {overallTeamProgress}% Overall
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 mb-4">
              Real-time progression of direct reports assigned for {activeCycle.name}
            </p>

            {totalReports === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400 font-sans bg-slate-50/50 dark:bg-white/[0.015] rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                No direct reports assigned to your team in this cycle.
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Stage 1: Goal Approval */}
                <div
                  onClick={() => navigate('/manager/approvals')}
                  className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-slate-700 dark:text-zinc-300">
                        <Target className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
                        Goal Setting & Approvals
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-zinc-400">
                        {goalsApprovedReports}/{totalReports} Approved
                      </span>
                      {goalApprovalStatus === 'completed' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          Complete
                        </span>
                      ) : goalApprovalStatus === 'overdue' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                          Overdue
                        </span>
                      ) : goalApprovalStatus === 'in_progress' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
                          Pending
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        goalApprovalStatus === 'completed'
                          ? 'bg-slate-900 dark:bg-white'
                          : goalApprovalStatus === 'overdue'
                          ? 'bg-rose-500'
                          : 'bg-slate-700 dark:bg-zinc-300'
                      }`}
                      style={{ width: `${goalApprovalPct}%` }}
                    />
                  </div>
                </div>

                {/* Stage 2: Employee Self-Review */}
                <div
                  onClick={() => scrollToRoster('pending')}
                  className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-slate-700 dark:text-zinc-300">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
                        Employee Self-Reviews
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-zinc-400">
                        {selfReviewsSubmittedCount}/{totalReports} Submitted
                      </span>
                      {selfReviewStageStatus === 'completed' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          Complete
                        </span>
                      ) : selfReviewStageStatus === 'overdue' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                          Overdue
                        </span>
                      ) : selfReviewStageStatus === 'in_progress' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
                          Pending
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selfReviewStageStatus === 'completed'
                          ? 'bg-slate-900 dark:bg-white'
                          : selfReviewStageStatus === 'overdue'
                          ? 'bg-rose-500'
                          : 'bg-slate-700 dark:bg-zinc-300'
                      }`}
                      style={{ width: `${selfReviewPct}%` }}
                    />
                  </div>
                </div>

                {/* Stage 3: Manager Evaluation */}
                <div
                  onClick={() => scrollToRoster('pending')}
                  className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-slate-700 dark:text-zinc-300">
                        <CheckSquare className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
                        Manager Appraisals
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-zinc-400">
                        {submittedReviewsCount}/{totalReports} Evaluated
                      </span>
                      {managerReviewStageStatus === 'completed' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          Complete
                        </span>
                      ) : managerReviewStageStatus === 'overdue' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
                          Overdue
                        </span>
                      ) : managerReviewStageStatus === 'in_progress' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20">
                          In Progress
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
                          Pending
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        managerReviewStageStatus === 'completed'
                          ? 'bg-slate-900 dark:bg-white'
                          : managerReviewStageStatus === 'overdue'
                          ? 'bg-rose-500'
                          : 'bg-slate-700 dark:bg-zinc-300'
                      }`}
                      style={{ width: `${managerReviewPct}%` }}
                    />
                  </div>
                </div>

                {/* Stage 4: Calibration & Outcome Release */}
                <div
                  onClick={() => navigate('/manager/analytics')}
                  className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-slate-700 dark:text-zinc-300">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-slate-700 dark:group-hover:text-white transition-colors">
                        Calibration & Release
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-zinc-400">
                        {isReleased ? `${resultsReleasedCount}/${totalReports} Released` : isCalibration ? 'In Calibration' : 'Pending'}
                      </span>
                      {calibrationStageStatus === 'completed' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          Released
                        </span>
                      ) : calibrationStageStatus === 'in_progress' ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20">
                          Calibrating
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
                          Pending
                        </span>
                      )}
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/80 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-slate-900 dark:bg-white"
                      style={{ width: `${calibrationPct}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Cycle: <strong className="text-slate-800 dark:text-zinc-200">{activeCycle.name}</strong></span>
            <span>Target window: {formatDate(activeCycle.endDate)}</span>
          </div>
        </section>

        {/* SECTION 4: Upcoming Deadlines */}
        <section className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/90 dark:border-white/[0.08]">
              <div>
                <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-zinc-400">
                  RESPONSIBILITIES · TIME SENSITIVE
                </span>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  Upcoming Deadlines
                </h3>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300 border border-slate-200 dark:border-white/10 font-semibold">
                {upcomingDeadlinesList.length} Outstanding
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 mb-4">
              Real milestone dates from the evaluation schedule requiring completion
            </p>

            {upcomingDeadlinesList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-300 font-sans bg-slate-50/50 dark:bg-white/[0.015] rounded-xl border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center p-6 space-y-2">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 dark:text-zinc-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-zinc-200">No upcoming deadlines</p>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px] max-w-xs">
                  All active cycle milestones and manager responsibilities are up to date.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingDeadlinesList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 text-slate-700 dark:text-zinc-300">
                        {item.status === 'overdue' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        ) : item.status === 'due_soon' ? (
                          <Clock className="w-4 h-4 text-amber-600 dark:text-[#FFB454]" />
                        ) : (
                          <Calendar className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                            {item.task}
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-mono font-semibold text-slate-900 dark:text-white">
                          {formatDate(item.dueDate)}
                        </div>
                        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border mt-0.5 ${item.badgeClass}`}>
                          {item.statusLabel}
                        </span>
                      </div>

                      {item.actionLink.startsWith('#') ? (
                        <button
                          type="button"
                          onClick={() => scrollToRoster('pending')}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                          title={item.actionLabel}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <Link
                          to={item.actionLink}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                          title={item.actionLabel}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Cycle Stage: <strong className="text-slate-800 dark:text-zinc-200 uppercase">{activeCycle.stage.replace('_', ' ')}</strong></span>
            <span>Sorted by urgency</span>
          </div>
        </section>
      </div>

      {/* Row: Section 2 (Pending Goal Approvals) & Section 3 (Pending Performance Evaluations) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-stretch">
        {/* SECTION 2: Pending Goal Approvals */}
        <section className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/90 dark:border-white/[0.08]">
              <div>
                <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-zinc-400">
                  ACTION REQUIRED · GOALS
                </span>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  Pending Goal Approvals
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-md border font-semibold ${
                  pendingGoalItems.length > 0
                    ? 'bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border-amber-200 dark:border-[#FFB454]/20'
                    : 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300 border-slate-200 dark:border-white/10'
                }`}>
                  {pendingGoalItems.length} Awaiting Action
                </span>
                {pendingGoalItems.length > 0 && (
                  <Link
                    to="/manager/approvals"
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white underline underline-offset-4"
                  >
                    View All
                  </Link>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 mb-4">
              Direct report goals submitted for manager verification and approval
            </p>

            {pendingGoalItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-300 font-sans bg-slate-50/50 dark:bg-white/[0.015] rounded-xl border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center p-6 space-y-2">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 dark:text-zinc-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-zinc-200">No pending goal approvals</p>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px] max-w-xs">
                  All goals submitted by your direct reports have been reviewed and approved for this cycle.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingGoalItems.map((item) => (
                  <div
                    key={item.goal.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={item.employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={item.employee.name}
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {item.employee.name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">
                              ({item.employee.employeeCode})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                            {item.employee.designation}
                          </p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20 shrink-0">
                        <Clock className="w-3 h-3 text-current" />
                        Pending Approval
                      </span>
                    </div>

                    <div className="pt-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                        {item.goal.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-zinc-400 flex-wrap">
                        <span>Target: <strong className="font-mono text-slate-800 dark:text-zinc-200">{item.goal.target} {item.goal.unit}</strong></span>
                        <span>•</span>
                        <span>Weight: <strong className="font-mono text-slate-800 dark:text-zinc-200">{item.goal.weight}%</strong></span>
                        <span>•</span>
                        <span>Submitted: {formatDate(item.goal.updatedAt || item.goal.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                      <Link
                        to={`/employee/goals/${item.goal.id}`}
                        className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors inline-flex items-center gap-1"
                      >
                        <span>Inspect details</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedGoalForReturn(item)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-medium transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Return</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionInProgress === item.goal.id}
                          onClick={() => handleQuickApprove(item.goal.id, item.goal.title)}
                          className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          <span>{actionInProgress === item.goal.id ? 'Approving...' : 'Approve'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Cycle: <strong className="text-slate-800 dark:text-zinc-200">{activeCycle.name}</strong></span>
            <Link
              to="/manager/approvals"
              className="font-medium text-slate-800 dark:text-zinc-200 hover:underline flex items-center gap-1"
            >
              <span>Batch approval portal</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </section>

        {/* SECTION 3: Pending Performance Evaluations */}
        <section className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200/90 dark:border-white/[0.08]">
              <div>
                <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-[0.08em] font-bold text-slate-500 dark:text-zinc-400">
                  ACTION REQUIRED · APPRAISALS
                </span>
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
                  Pending Performance Evaluations
                </h3>
              </div>
              <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-md border font-semibold ${
                pendingReviewsCount > 0
                  ? 'bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border-amber-200 dark:border-[#FFB454]/20'
                  : 'bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-zinc-300 border-slate-200 dark:border-white/10'
              }`}>
                {pendingReviewsCount} to Evaluate
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 mb-4">
              Direct report evaluations awaiting completion according to review workflow dependencies
            </p>

            {pendingEvaluations.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-zinc-300 font-sans bg-slate-50/50 dark:bg-white/[0.015] rounded-xl border border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center p-6 space-y-2">
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/[0.05] flex items-center justify-center text-slate-500 dark:text-zinc-400">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="font-semibold text-slate-800 dark:text-zinc-200">No pending performance evaluations</p>
                <p className="text-slate-500 dark:text-zinc-400 text-[11px] max-w-xs">
                  All team appraisals have been evaluated and submitted for calibration in this cycle.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingEvaluations.map((summary) => {
                  const emp = summary.employee
                  const isSrSubmitted = summary.selfReviewStatus === 'submitted'
                  const isDraft = summary.managerReviewStatus === 'draft'

                  return (
                    <div
                      key={emp.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={emp.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {emp.name}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono shrink-0">
                                ({emp.employeeCode})
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                              {emp.designation} · {emp.department}
                            </p>
                          </div>
                        </div>

                        {/* Workflow Dependency Badge */}
                        {isSrSubmitted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] border border-amber-200 dark:border-[#FFB454]/20 shrink-0">
                            <Clock className="w-3 h-3 text-amber-600 dark:text-[#FFB454]" />
                            {isDraft ? 'Draft in progress' : 'Ready for Evaluation'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200 dark:border-white/10 shrink-0">
                            Awaiting Self-Review
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                          <span>Self-Review:</span>
                          {isSrSubmitted ? (
                            <span className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-slate-900 dark:text-white" />
                              Submitted
                            </span>
                          ) : (
                            <span className="font-medium text-slate-500 dark:text-zinc-400">
                              Pending Reflection
                            </span>
                          )}
                          <span>•</span>
                          <span>Due {formatDate(activeCycle.deadlines.managerReviewDue)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate(`/manager/reviews/${emp.id}`)}
                          className={
                            isSrSubmitted
                              ? 'premium-glow-btn text-xs font-semibold px-3 py-1 cursor-pointer inline-flex items-center gap-1'
                              : 'inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-medium transition-all cursor-pointer shadow-2xs'
                          }
                        >
                          <span>
                            {isSrSubmitted
                              ? isDraft
                                ? 'Continue Evaluation'
                                : 'Evaluate'
                              : 'Workspace'}
                          </span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>Dependency: <strong>Self-Review required before submission</strong></span>
            <button
              type="button"
              onClick={() => scrollToRoster('pending')}
              className="font-medium text-slate-800 dark:text-zinc-200 hover:underline flex items-center gap-1"
            >
              <span>View Roster</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </section>
      </div>

      {/* Return Goal Modal */}
      <Modal
        isOpen={Boolean(selectedGoalForReturn)}
        onClose={() => {
          setSelectedGoalForReturn(null)
          setReturnReason('')
        }}
        title="Return Goal for Revision"
        subtitle={`Provide feedback notes for ${selectedGoalForReturn?.employee.name}`}
      >
        <form onSubmit={handleConfirmReturn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Goal Commitment
            </label>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {selectedGoalForReturn?.goal.title}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Target: {selectedGoalForReturn?.goal.target} {selectedGoalForReturn?.goal.unit} • Weight: {selectedGoalForReturn?.goal.weight}%
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Revision Feedback <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Explain clearly what changes are required before this target can be approved..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white transition-all resize-none font-sans"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setSelectedGoalForReturn(null)
                setReturnReason('')
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-medium text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isReturning || returnReason.trim().length < 5}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isReturning ? 'Returning...' : 'Return for Revision'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
