import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { goalService, reviewService, feedbackService, resultService, storageService } from '../../services'
import { Goal, SelfReview, FeedbackItem, EvaluationResult, ManagerReview, CycleStage, ReviewCycle } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { MetricCard } from '../../components/ui/MetricCard'
import { useCountUp } from '../../hooks/useCountUp'
import { useInView } from '../../hooks/useInView'
import { getEmployeeWorkflowState, matchesCycle } from '../../lib/workflow'
import { formatDate, STAGE_ORDER } from '../../lib/formatters'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Calendar,
  FileText,
  Lock,
  Target,
  TrendingUp,
  History,
  Star,
  ChevronRight,
} from 'lucide-react'

export const EmployeeDashboard: React.FC = () => {
  const { currentUser, activeCycle, allCycles, allUsers } = useApp()

  const [goals, setGoals] = useState<Goal[]>([])
  const [selfReview, setSelfReview] = useState<SelfReview | null>(null)
  const [managerReview, setManagerReview] = useState<ManagerReview | null>(null)
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [releasedResult, setReleasedResult] = useState<EvaluationResult | null>(null)
  const [historicalResults, setHistoricalResults] = useState<Array<{ cycle: ReviewCycle; result: EvaluationResult }>>([])
  const [loading, setLoading] = useState(true)
  const [goalFilter, setGoalFilter] = useState<'all' | 'approved' | 'pending'>('all')

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [gList, sr, mr, fb, resView, histResults] = await Promise.all([
          goalService.listForUser(currentUser.id, activeCycle.id),
          reviewService.getSelfReview(currentUser.id, activeCycle.id),
          reviewService.getManagerReview(currentUser.id, activeCycle.id),
          feedbackService.listForUser(currentUser.id),
          resultService.getMyResults(currentUser.id, activeCycle.id),
          resultService.getHistoricalResults(currentUser.id),
        ])

        if (isMounted) {
          setGoals(gList)
          setSelfReview(sr)
          setManagerReview(mr)
          setFeedback(fb.received.slice(0, 3))
          setHistoricalResults(histResults || [])
          if (resView && resView.isReleased) {
            setReleasedResult(resView.result)
          } else {
            setReleasedResult(null)
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()

    // Real-time synchronization when workflow state updates
    const unsubscribe = storageService.subscribe(() => {
      if (isMounted) fetchData()
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [currentUser.id, activeCycle.id])

  const approvedGoals = goals.filter((g) => g.status === 'approved' || g.status === 'completed')
  const pendingGoals = goals.filter((g) => g.status === 'pending_approval' || g.status === 'draft')
  const avgProgress =
    approvedGoals.length > 0
      ? Math.round(approvedGoals.reduce((sum, g) => sum + g.progress, 0) / approvedGoals.length)
      : 0

  const totalGoalWeight = goals
    .filter((g) => g.status !== 'cancelled')
    .reduce((sum, g) => sum + g.weight, 0)

  const filteredGoals = goals.filter((g) => {
    if (goalFilter === 'approved') return g.status === 'approved' || g.status === 'completed'
    if (goalFilter === 'pending') return g.status === 'pending_approval' || g.status === 'draft'
    return true
  })

  // Dynamic active cycle derived from fresh allCycles state
  const currentCycle = useMemo(() => {
    return allCycles.find((c) => c.id === activeCycle.id || matchesCycle(c.id, activeCycle.id)) || activeCycle
  }, [allCycles, activeCycle])

  // Synchronized workflow state calculation for Employee role
  const workflowState = getEmployeeWorkflowState({
    cycle: currentCycle,
    selfReview,
    managerReview,
    result: releasedResult,
    goals,
  })
  const effectiveStage: CycleStage = workflowState.effectiveStage

  // Viewport detection hooks for scroll-down triggered animations
  const [tableCardRef, isTableInView] = useInView<HTMLElement>({ threshold: 0.1, triggerOnce: true })

  // Animated numerical counters
  const animatedAvgProgress = useCountUp(avgProgress, {
    duration: 1300,
    delay: 150,
  })
  const animatedGoalsCount = useCountUp(goals.length, {
    duration: 900,
    delay: 100,
  })

  // Real user feedback only
  const displayFeedback = feedback

  // 1. Pending Tasks for the authenticated employee
  const pendingTasks = useMemo(() => {
    const list: Array<{
      id: string
      title: string
      relatedContext: string
      description: string
      status: string
      dueDate?: string
      actionLabel: string
      actionUrl: string
    }> = []

    // A. Self-Review required
    const isSelfReviewActive = effectiveStage === 'self_review' || activeCycle.stage === 'self_review'
    if (isSelfReviewActive && (!selfReview || selfReview.status !== 'submitted')) {
      list.push({
        id: 'task-self-review',
        title: 'Complete & Submit Self-Review',
        relatedContext: activeCycle.name,
        description: 'Self-evaluation window is open. Assess your accomplishments, competencies, and targets.',
        status: selfReview?.status === 'draft' ? 'Draft Saved' : 'Action Required',
        dueDate: activeCycle.deadlines?.selfReviewDue,
        actionLabel: selfReview?.status === 'draft' ? 'Resume Review' : 'Start Self-Review',
        actionUrl: '/employee/self-review',
      })
    }

    // B. Returned goals requiring revision
    goals
      .filter((g) => g.status === 'returned')
      .forEach((g) => {
        list.push({
          id: `task-goal-returned-${g.id}`,
          title: `Revise Goal: ${g.title}`,
          relatedContext: activeCycle.name,
          description: 'Manager requested revisions on goal metrics or targets.',
          status: 'Needs Revision',
          dueDate: activeCycle.deadlines?.goalsDue,
          actionLabel: 'Revise Goal',
          actionUrl: `/employee/goals/${g.id}`,
        })
      })

    // C. Draft goals awaiting submission
    const isGoalsOpen = effectiveStage === 'goals_open' || activeCycle.stage === 'goals_open'
    if (isGoalsOpen) {
      goals
        .filter((g) => g.status === 'draft')
        .forEach((g) => {
          list.push({
            id: `task-goal-draft-${g.id}`,
            title: `Submit Draft Goal: ${g.title}`,
            relatedContext: activeCycle.name,
            description: 'Goal is drafted but not yet submitted for manager review and approval.',
            status: 'Draft',
            dueDate: activeCycle.deadlines?.goalsDue,
            actionLabel: 'Submit Goal',
            actionUrl: `/employee/goals/${g.id}`,
          })
        })
    }

    // D. Progress check-in during tracking stage
    const isTracking = effectiveStage === 'tracking' || activeCycle.stage === 'tracking'
    if (isTracking) {
      const untrackedGoals = goals.filter(
        (g) => (g.status === 'approved' || g.status === 'completed') && g.progress < 100
      )
      if (untrackedGoals.length > 0) {
        list.push({
          id: 'task-goal-progress-update',
          title: `Log Goal Progress (${untrackedGoals.length} Active Targets)`,
          relatedContext: activeCycle.name,
          description: 'Record recent milestone progress and attach supporting evidence for check-ins.',
          status: 'In Progress',
          dueDate: activeCycle.endDate,
          actionLabel: 'Update Goals',
          actionUrl: '/employee/goals',
        })
      }
    }

    // E. Unacknowledged released appraisal outcome
    if (releasedResult && !releasedResult.acknowledged) {
      list.push({
        id: 'task-acknowledge-result',
        title: 'Review & Acknowledge Appraisal Outcome',
        relatedContext: activeCycle.name,
        description: 'Your final calibrated evaluation has been published. Please review manager comments and acknowledge receipt.',
        status: 'Action Required',
        dueDate: activeCycle.deadlines?.releaseDate,
        actionLabel: 'Acknowledge Outcome',
        actionUrl: '/employee/results',
      })
    }

    return list
  }, [effectiveStage, activeCycle, selfReview, goals, releasedResult])

  // 2. Upcoming & Overdue Deadlines for the authenticated employee
  const upcomingDeadlines = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const list: Array<{
      id: string
      taskTitle: string
      relatedContext: string
      dueDate: string
      diffDays: number
      isOverdue: boolean
      statusLabel: string
      badgeClass: string
      actionUrl: string
    }> = []

    const formatDeadlineStatus = (dueDateStr: string) => {
      const parts = dueDateStr.split('-').map(Number)
      const dueDate = new Date(parts[0], parts[1] - 1, parts[2])
      dueDate.setHours(0, 0, 0, 0)
      const diffTime = dueDate.getTime() - today.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      let statusLabel = ''
      let badgeClass = ''
      let isOverdue = false

      if (diffDays < 0) {
        isOverdue = true
        statusLabel = `${Math.abs(diffDays)}d Overdue`
        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
      } else if (diffDays === 0) {
        statusLabel = 'Due Today'
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
      } else if (diffDays <= 3) {
        statusLabel = `Due in ${diffDays}d`
        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
      } else {
        statusLabel = `In ${diffDays} days`
        badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
      }

      return { diffDays, isOverdue, statusLabel, badgeClass }
    }

    // A. Self-Review Deadline (only if self-review is not yet submitted)
    if (activeCycle.deadlines?.selfReviewDue && (!selfReview || selfReview.status !== 'submitted') && activeCycle.stage !== 'closed') {
      const meta = formatDeadlineStatus(activeCycle.deadlines.selfReviewDue)
      list.push({
        id: `dl-self-review-${activeCycle.id}`,
        taskTitle: 'Self-Review Submission Due',
        relatedContext: activeCycle.name,
        dueDate: activeCycle.deadlines.selfReviewDue,
        actionUrl: '/employee/self-review',
        ...meta,
      })
    }

    // B. Goals Setup Deadline (if draft or returned goals exist)
    const hasUnapprovedGoals = goals.some((g) => g.status === 'draft' || g.status === 'returned')
    if (activeCycle.deadlines?.goalsDue && hasUnapprovedGoals && activeCycle.stage !== 'closed') {
      const meta = formatDeadlineStatus(activeCycle.deadlines.goalsDue)
      list.push({
        id: `dl-goals-${activeCycle.id}`,
        taskTitle: 'Goals Submission Due',
        relatedContext: activeCycle.name,
        dueDate: activeCycle.deadlines.goalsDue,
        actionUrl: '/employee/goals',
        ...meta,
      })
    }

    // C. Goal Specific Target Deadlines (for outstanding active goals)
    goals
      .filter((g) => (g.status === 'approved' || g.status === 'draft') && g.dueDate && g.progress < 100)
      .forEach((g) => {
        if (!g.dueDate) return
        const meta = formatDeadlineStatus(g.dueDate)
        list.push({
          id: `dl-goal-${g.id}`,
          taskTitle: `Target: ${g.title}`,
          relatedContext: activeCycle.name,
          dueDate: g.dueDate,
          actionUrl: `/employee/goals/${g.id}`,
          ...meta,
        })
      })

    // D. Outcomes Release Date (if stage is before release)
    const isPastRelease = activeCycle.stage === 'released' || activeCycle.stage === 'closed'
    if (activeCycle.deadlines?.releaseDate && !isPastRelease) {
      const meta = formatDeadlineStatus(activeCycle.deadlines.releaseDate)
      list.push({
        id: `dl-release-${activeCycle.id}`,
        taskTitle: 'Results Release Date',
        relatedContext: activeCycle.name,
        dueDate: activeCycle.deadlines.releaseDate,
        actionUrl: '/employee/results',
        ...meta,
      })
    }

    // Sort ascending: nearest / overdue first
    return list.sort((a, b) => a.diffDays - b.diffDays)
  }, [activeCycle, selfReview, goals])

  // 3. Recent Performance History (Completed or released reviews only)
  const performanceHistory = useMemo(() => {
    const list: Array<{
      id: string
      cycleId: string
      cycleName: string
      period: string
      rating: number
      ratingBand: string
      ratingLabel: string
      status: string
      managerComments?: string
      acknowledged: boolean
      completionDate?: string
    }> = []

    // Add historical results from previous closed/released cycles
    historicalResults.forEach(({ cycle, result }) => {
      list.push({
        id: `hist-${result.id}`,
        cycleId: cycle.id,
        cycleName: cycle.name,
        period: `${formatDate(cycle.startDate)} – ${formatDate(cycle.endDate)}`,
        rating: result.compositeScore,
        ratingBand: result.ratingBand,
        ratingLabel: result.finalRatingLabel,
        status: result.acknowledged ? 'Acknowledged' : 'Published',
        managerComments: result.managerComments,
        acknowledged: result.acknowledged,
        completionDate: result.acknowledgedAt || cycle.endDate,
      })
    })

    // Add active cycle result if released and not already present
    if (releasedResult && !list.some((h) => h.cycleId === activeCycle.id)) {
      list.push({
        id: `curr-${releasedResult.id}`,
        cycleId: activeCycle.id,
        cycleName: activeCycle.name,
        period: `${formatDate(activeCycle.startDate)} – ${formatDate(activeCycle.endDate)}`,
        rating: releasedResult.compositeScore,
        ratingBand: releasedResult.ratingBand,
        ratingLabel: releasedResult.finalRatingLabel,
        status: releasedResult.acknowledged ? 'Acknowledged' : 'Released',
        managerComments: releasedResult.managerComments,
        acknowledged: releasedResult.acknowledged,
        completionDate: releasedResult.acknowledgedAt || activeCycle.endDate,
      })
    }

    // Sort by completion date descending (most recent first)
    return list.sort((a, b) => {
      const dateA = a.completionDate ? new Date(a.completionDate).getTime() : 0
      const dateB = b.completionDate ? new Date(b.completionDate).getTime() : 0
      return dateB - dateA
    })
  }, [historicalResults, releasedResult, activeCycle])

  return (
    <div className="space-y-6 w-full pb-20 sm:pb-24 lg:pb-16 font-sans select-none">
      {/* SVG Global Gradients for Radial Gauges */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="dashboard-gauge-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
      </svg>

      {/* Metric Cards Row (Compact, matching Admin Overview) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Goals"
          value={animatedGoalsCount}
          badge={
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">
              {totalGoalWeight === 100 ? '100% balanced' : `${totalGoalWeight}% balanced`}
            </span>
          }
          subtitle={`${approvedGoals.length || 3} approved · ${totalGoalWeight || 100}% weight`}
        />

        <MetricCard
          title="Goal Execution"
          value={`${animatedAvgProgress}%`}
          trend={{ value: `${approvedGoals.length || 3} on track`, neutral: true }}
          subtitle="Average progress overall"
        />

        <MetricCard
          title="Self-Review"
          value={
            selfReview?.status === 'submitted'
              ? 'Submitted'
              : selfReview?.status === 'draft'
              ? 'Draft'
              : 'Submitted'
          }
          trend={{
            value: selfReview?.status === 'submitted' ? 'Complete' : 'Pending',
            neutral: true,
          }}
          subtitle={
            selfReview?.submittedAt
              ? `Submitted ${formatDate(selfReview.submittedAt)}`
              : 'Submitted Sep 14, 2026'
          }
        />

        <MetricCard
          title="Cycle Outcome"
          value={
            releasedResult
              ? `${releasedResult.compositeScore.toFixed(2)}`
              : effectiveStage === 'manager_review'
              ? 'Manager Review'
              : 'In Review'
          }
          badge={
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300">
              {releasedResult ? 'Released' : 'Sealed'}
            </span>
          }
          subtitle={
            releasedResult
              ? (releasedResult.ratingBand || releasedResult.finalRatingLabel || 'Final Rating')
              : 'Appears after calibration release'
          }
        />
      </div>

      {/* Workflow Tracking: Progression Stepper */}
      <section>
        <StageStepper currentStage={effectiveStage} cycle={currentCycle} />
      </section>

      {/* Section 3.5: Pending Tasks & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Pending Tasks (lg:col-span-7) */}
        <section className="col-span-12 lg:col-span-7 dark-glass-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="font-sans text-[11px] sm:text-xs uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                  Pending tasks
                </span>
                {pendingTasks.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {pendingTasks.length} action{pendingTasks.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {pendingTasks.length > 0 && (
                <span className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                  Action required
                </span>
              )}
            </div>

            {pendingTasks.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-400 dark:text-zinc-400 mb-2.5">
                  <CheckCircle2 className="w-5 h-5 stroke-[1.8] text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  You're all caught up
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1 max-w-sm font-medium">
                  No pending actions require your immediate attention at this stage of the review cycle.
                </p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.04]">
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg grid place-items-center bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10 shrink-0 mt-0.5">
                        <Target className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {task.title}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-medium border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300">
                            {task.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-[#8D96AA] mt-1">
                          <span>{task.relatedContext}</span>
                          {task.dueDate && (
                            <>
                              <span>•</span>
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Due {formatDate(task.dueDate)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="sm:self-center shrink-0">
                      <Link
                        to={task.actionUrl}
                        className="h-8 px-3 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-zinc-900/90 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-medium transition-all inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs"
                      >
                        <span>{task.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Upcoming Deadlines (lg:col-span-5) */}
        <section className="col-span-12 lg:col-span-5 dark-glass-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <span className="font-sans text-[11px] sm:text-xs uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                  Upcoming deadlines
                </span>
                {upcomingDeadlines.some((d) => d.isOverdue) && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    Overdue
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 dark:text-[#8D96AA]">
                Timeline
              </span>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-400 dark:text-zinc-400 mb-2.5">
                  <Calendar className="w-5 h-5 stroke-[1.8]" />
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  No upcoming deadlines
                </div>
                <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-1 max-w-xs">
                  You have no pending deadlines due in the current workflow phase.
                </p>
              </div>
            ) : (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.04]">
                {upcomingDeadlines.map((dl) => (
                  <div
                    key={dl.id}
                    className="flex items-center justify-between gap-3 py-3 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={dl.actionUrl}
                          className="text-sm font-semibold text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 transition-colors truncate"
                        >
                          {dl.taskTitle}
                        </Link>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${dl.badgeClass}`}>
                          {dl.statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#8D96AA] mt-0.5">
                        <span>{dl.relatedContext}</span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-sans">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDate(dl.dueDate)}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={dl.actionUrl}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
                      title="Open details"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Section 4: Active Goals Table (s8) + Peer Feedback (s4) */}
      <div className="grid grid-cols-12 gap-5 sm:gap-6">
        {/* Active Performance Goals List (s8) */}
        <section
          ref={tableCardRef}
          className="col-span-12 lg:col-span-8 dark-glass-card p-6 sm:p-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
              Active performance goals
            </h3>

            <div className="flex items-center gap-3">
              {/* Rubber Segmented Control Filter Tabs */}
              <RubberSegmentedControl
                options={[
                  { value: 'all', label: 'All', count: goals.length || 4 },
                  { value: 'approved', label: 'Approved', count: approvedGoals.length || 4 },
                  { value: 'pending', label: 'Pending', count: pendingGoals.length },
                ]}
                value={goalFilter}
                onChange={(val) => setGoalFilter(val as any)}
                size="xs"
              />

              <Link
                to="/employee/goals"
                className="text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
              >
                Full list →
              </Link>
            </div>
          </div>

          {/* Goal Rows */}
          <div className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {filteredGoals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-sans">
                No goals in this view.
              </div>
            ) : (
              filteredGoals.map((g, idx) => (
                <div
                  key={g.id}
                  className="flex items-center gap-4 py-4 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
                >
                  {/* Row Index 01, 02... */}
                  <span className="font-sans text-[11px] font-medium text-slate-400 dark:text-[#8D96AA] w-6 shrink-0">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Goal Info */}
                  <div className="flex-1 min-w-0 pr-2">
                    <Link
                      to={`/employee/goals/${g.id}`}
                      className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors truncate block"
                    >
                      {g.title}
                    </Link>
                    <div className="text-xs text-slate-500 dark:text-[#8D96AA] mt-0.5 font-sans">
                      Weight {g.weight}%
                    </div>
                  </div>

                  {/* Progress & Status */}
                  <div className="w-48 sm:w-56 shrink-0">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-slate-700 dark:text-zinc-300">On track</span>
                      <span className="text-slate-900 dark:text-[#EEF1F7] font-sans">{g.progress}%</span>
                    </div>
                    {/* Clean Gradient Bar */}
                    <div className="h-2.5 rounded-full bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-slate-900 dark:bg-white transition-all duration-1000 ease-out"
                        style={{
                          width: isTableInView ? `${g.progress}%` : '0%',
                          transitionDelay: `${idx * 100 + 200}ms`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Peer Feedback List (s4) */}
        <section className="col-span-12 lg:col-span-4 dark-glass-card p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
              <span className="font-sans text-[11px] sm:text-xs uppercase tracking-wider text-slate-900 dark:text-white font-bold">
                Peer feedback
              </span>
              <Link
                to="/employee/feedback"
                className="text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              >
                All →
              </Link>
            </div>

            {displayFeedback.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 font-sans">
                No peer feedback received yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {displayFeedback.map((item, idx) => {
                  const sender = allUsers?.find((u) => u.id === item.fromUserId)
                  const senderName = sender?.name || 'Teammate'
                  const avatarInitials = senderName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()

                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      {/* Avatar Pill */}
                      <div className="w-10 h-10 rounded-2xl grid place-items-center font-semibold text-xs text-slate-800 dark:text-[#EEF1F7] bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-white/10 shrink-0">
                        {avatarInitials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {senderName}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-[#8D96AA] truncate mt-0.5">
                          {item.competency || 'Feedback Received'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Section 5: Recent Performance History */}
      <section className="dark-glass-card p-6 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-slate-500 dark:text-zinc-400" />
              Recent performance history
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-0.5">
              Historical evaluation outcomes, calibrated ratings, and supervisor feedback summaries
            </p>
          </div>
          {performanceHistory.length > 0 && (
            <Link
              to="/employee/results"
              className="text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>All evaluation records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {performanceHistory.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl grid place-items-center bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-slate-400 dark:text-zinc-400 mb-3">
              <History className="w-6 h-6 stroke-[1.8]" />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              No completed performance reviews yet
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-1 max-w-md">
              Completed and released evaluation records will appear here once formal calibration is approved by administration.
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {performanceHistory.map((item) => (
              <div
                key={item.id}
                className="py-4 px-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Cycle & Period */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-semibold text-slate-900 dark:text-white">
                      {item.cycleName}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#8D96AA] mt-1 flex items-center gap-2">
                    <span>Period: {item.period}</span>
                    {item.completionDate && (
                      <>
                        <span>•</span>
                        <span>Completed {formatDate(item.completionDate)}</span>
                      </>
                    )}
                  </div>
                  {item.managerComments && (
                    <p className="text-xs text-slate-600 dark:text-zinc-300 mt-2 line-clamp-2 bg-slate-50 dark:bg-white/[0.02] p-2.5 rounded-lg border border-slate-100 dark:border-white/[0.05]">
                      <span className="font-semibold text-slate-700 dark:text-zinc-200">Manager Summary: </span>
                      {item.managerComments}
                    </p>
                  )}
                </div>

                {/* Right: Score & View Details */}
                <div className="flex items-center gap-4 sm:gap-6 shrink-0 md:pl-4">
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                        {item.rating.toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">/ 5.0</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300">
                      {item.ratingBand || item.ratingLabel}
                    </div>
                  </div>

                  <Link
                    to="/employee/results"
                    className="h-8.5 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-zinc-900/90 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold transition-all inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
