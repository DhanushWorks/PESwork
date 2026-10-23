import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { peopleService, goalService, storageService, calibrationService, resultService, cycleService, reviewService } from '../../services'
import { CalibrationItem } from '../../services'
import { User, Goal, SelfReview, ManagerReview, CalibrationRecord, EvaluationResult, ReviewCycle, CycleStage } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { MetricCard, ProgressBar } from '../../components/ui/MetricCard'
import { AvatarGroup } from '../../components/ui/AvatarGroup'
import { AnimatedProgressRing } from '../../components/ui/AnimatedProgressRing'
import { useInView } from '../../hooks/useInView'
import { useCountUp } from '../../hooks/useCountUp'
import { getAdminWorkflowState } from '../../lib/workflow'
import { formatDate, STAGE_ORDER } from '../../lib/formatters'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Sliders,
  Users,
  Star,
  ChevronRight,
  Calendar,
} from 'lucide-react'

export const AdminOverview: React.FC = () => {
  const { activeCycle } = useApp()

  const [users, setUsers] = useState<User[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [selfReviews, setSelfReviews] = useState<SelfReview[]>([])
  const [managerReviews, setManagerReviews] = useState<ManagerReview[]>([])
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([])
  const [results, setResults] = useState<EvaluationResult[]>([])
  const [calibrationItems, setCalibrationItems] = useState<CalibrationItem[]>([])
  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [uList, allResults, calList, cycleList, srList, mrList] = await Promise.all([
          peopleService.list(),
          resultService.getAllResults(activeCycle.id),
          calibrationService.listForCycle(activeCycle.id),
          cycleService.list(),
          reviewService.listAllSelfReviews(activeCycle.id),
          reviewService.listAllManagerReviews(activeCycle.id),
        ])
        const gPromises = uList.map((u) => goalService.listForUser(u.id, activeCycle.id))
        const gResults = await Promise.all(gPromises)
        const state = storageService.getState()

        if (isMounted) {
          setUsers(uList)
          setGoals(gResults.flat())
          setSelfReviews(srList || state.selfReviews || [])
          setManagerReviews(mrList || state.managerReviews || [])
          setCalibrations(state.calibrations || [])
          setResults(allResults)
          setCalibrationItems(calList || [])
          setCycles(cycleList || [])
        }
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
  }, [activeCycle.id])

  const totalEmployees = users.filter((u) => u.active).length
  const engineeringStaff = users.filter(
    (u) => u.department === 'Engineering' || u.department === 'DevOps & Platform'
  )
  const productStaff = users.filter(
    (u) =>
      u.department === 'Design & Engineering' ||
      u.department === 'Product Operations' ||
      u.department === 'Product & Design' ||
      u.department === 'People Operations'
  )

  const engineeringMembers = engineeringStaff.filter((u) => u.id !== 'u-mgr-1')
  const productMembers = productStaff.filter((u) => u.id !== 'u-mgr-3' && u.role !== 'admin')

  // Synchronized workflow stage for Admin
  const workflowState = getAdminWorkflowState({
    cycle: activeCycle,
    totalEmployees,
    selfReviews,
    managerReviews,
    calibrations,
    results,
  })
  const effectiveStage = workflowState.effectiveStage
  const currentStageNumber = workflowState.stepNumber
  const totalStages = STAGE_ORDER.length

  const [heroCardRef, isHeroInView] = useInView<HTMLElement>({ threshold: 0.15, triggerOnce: true })
  const animatedStageNumber = useCountUp(currentStageNumber, {
    duration: 1200,
    delay: 100,
    enabled: isHeroInView,
  })

  const getDeptMetrics = (members: User[]) => {
    if (members.length === 0) return { selfRate: 0, mgrRate: 0, goalsRate: 0, overall: 0 }
    let selfCount = 0
    let mgrCount = 0
    let goalProgressSum = 0
    let usersWithGoals = 0

    members.forEach((m) => {
      const sRev = selfReviews.find((r) => r.userId === m.id && r.cycleId === activeCycle.id)
      const mRev = managerReviews.find((r) => r.employeeId === m.id && r.cycleId === activeCycle.id)
      const uGoals = goals.filter((g) => g.userId === m.id)

      if (sRev?.status === 'submitted') selfCount++
      if (mRev?.status === 'submitted') mgrCount++
      if (uGoals.length > 0) {
        goalProgressSum += uGoals.reduce((s, g) => s + g.progress, 0) / uGoals.length
        usersWithGoals++
      }
    })

    const selfRate = Math.round((selfCount / members.length) * 100)
    const mgrRate = Math.round((mgrCount / members.length) * 100)
    const goalsRate = usersWithGoals > 0 ? Math.round(goalProgressSum / usersWithGoals) : 0
    const overall = Math.round(selfRate * 0.4 + mgrRate * 0.4 + goalsRate * 0.2)
    return { selfRate, mgrRate, goalsRate, overall }
  }

  const engStats = getDeptMetrics(engineeringMembers)
  const prodStats = getDeptMetrics(productMembers)

  const approvedGoals = goals.filter((g) => g.status === 'approved' || g.status === 'completed')
  const goalAttainmentRate =
    approvedGoals.length > 0
      ? Math.round(approvedGoals.reduce((sum, g) => sum + g.progress, 0) / approvedGoals.length)
      : 0

  const renderEmployeeCard = (employee: User) => {
    const userGoals = goals.filter((g) => g.userId === employee.id)
    const avgProgress =
      userGoals.length > 0
        ? Math.round(userGoals.reduce((sum, g) => sum + g.progress, 0) / userGoals.length)
        : 0

    const selfRev = selfReviews.find((r) => r.userId === employee.id && r.cycleId === activeCycle.id)
    const mgrRev = managerReviews.find((r) => r.employeeId === employee.id && r.cycleId === activeCycle.id)

    const isSelfDone = selfRev?.status === 'submitted'
    const isMgrDone = mgrRev?.status === 'submitted'
    const score = mgrRev?.compositeScore || selfRev?.overallRating

    return (
      <Link
        key={employee.id}
        to="/admin/users"
        className="block p-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/20 transition-all duration-150 shadow-2xs group cursor-pointer"
        title={`View ${employee.name}'s talent profile`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative shrink-0">
              <img
                src={employee.avatar}
                alt={employee.name}
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-slate-900 dark:text-white truncate group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors">
                  {employee.name}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono hidden sm:inline">
                  {employee.employeeCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                {employee.designation}
              </p>
            </div>
          </div>

          {score ? (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <Star className="w-3 h-3 text-current fill-current" />
              {Number(score).toFixed(1)}
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
              Review
            </span>
          )}
        </div>

        {/* Micro Status Badges Row */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[10px] gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                isSelfDone
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                  : 'bg-slate-100 dark:bg-white/[0.05] text-slate-500 dark:text-zinc-400'
              }`}
            >
              Self: {isSelfDone ? 'Done' : 'Pending'}
            </span>

            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                isMgrDone
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
              }`}
            >
              Mgr: {isMgrDone ? 'Done' : 'Review'}
            </span>
          </div>

          <div className="flex items-center gap-1 text-slate-500 dark:text-zinc-400 font-medium">
            <span>Goals:</span>
            <span className="font-bold text-slate-900 dark:text-white">{avgProgress}%</span>
          </div>
        </div>
      </Link>
    )
  }

  // Derived Pending Admin Approvals (Real Supabase / service data)
  const pendingApprovals = useMemo(() => {
    const list: Array<{
      id: string
      employee: User
      cycleName: string
      approvalType: string
      submissionDate?: string
      status: string
      reviewUrl: string
    }> = []

    // 1. Calibrations awaiting Admin Permission
    calibrationItems.forEach((item) => {
      if (!item.adminApproved) {
        list.push({
          id: `cal-${item.employee.id}-${item.cycleId}`,
          employee: item.employee,
          cycleName: item.cycleName || activeCycle.name,
          approvalType: 'Calibration Appraisal',
          submissionDate:
            item.managerReview?.submittedAt ||
            item.calibrationRecord?.calibratedAt ||
            item.managerReview?.lastSavedAt,
          status: 'Awaiting Permission',
          reviewUrl: '/admin/calibration',
        })
      }
    })

    // 2. Goals awaiting approval in this cycle (if any)
    goals.forEach((g) => {
      if (g.status === 'pending_approval') {
        const emp = users.find((u) => u.id === g.userId)
        if (emp) {
          list.push({
            id: `goal-${g.id}`,
            employee: emp,
            cycleName: activeCycle.name,
            approvalType: 'Goal Target',
            submissionDate: g.createdAt || g.updatedAt,
            status: 'Pending Approval',
            reviewUrl: '/manager/approvals',
          })
        }
      }
    })

    // Sort by submission date (newest first)
    return list.sort((a, b) => {
      const dateA = a.submissionDate ? new Date(a.submissionDate).getTime() : 0
      const dateB = b.submissionDate ? new Date(b.submissionDate).getTime() : 0
      return dateB - dateA
    })
  }, [calibrationItems, goals, users, activeCycle.name])

  // Derived Upcoming & Overdue Deadlines across cycles (Real Supabase / service data)
  const upcomingDeadlines = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const list: Array<{
      id: string
      cycleId: string
      cycleName: string
      taskTitle: string
      stage: CycleStage
      dueDate: string
      diffDays: number
      isOverdue: boolean
      statusLabel: string
      badgeClass: string
    }> = []

    const stageRank: Record<CycleStage, number> = {
      draft: 1,
      goals_open: 2,
      tracking: 3,
      self_review: 4,
      manager_review: 5,
      calibration: 6,
      released: 7,
      closed: 8,
    }

    const cyclePool = cycles.length > 0 ? cycles : activeCycle ? [activeCycle] : []
    const relevantCycles = cyclePool.filter((c) => c.stage !== 'closed')

    relevantCycles.forEach((c) => {
      if (!c.deadlines) return
      const currentRank = stageRank[c.stage] || 1

      const milestones: Array<{
        key: keyof NonNullable<ReviewCycle['deadlines']>
        taskTitle: string
        stage: CycleStage
        targetRank: number
      }> = [
        { key: 'goalsDue', taskTitle: 'Goals Approval Due', stage: 'goals_open', targetRank: 3 },
        { key: 'selfReviewDue', taskTitle: 'Self-Reviews Due', stage: 'self_review', targetRank: 4 },
        { key: 'managerReviewDue', taskTitle: 'Manager Evaluations Due', stage: 'manager_review', targetRank: 5 },
        { key: 'calibrationDue', taskTitle: 'Calibration Committee', stage: 'calibration', targetRank: 6 },
        { key: 'releaseDate', taskTitle: 'Official Results Release', stage: 'released', targetRank: 7 },
      ]

      milestones.forEach((m) => {
        const dueDateStr = c.deadlines?.[m.key]
        if (!dueDateStr) return

        // Exclude completed stages: if cycle stage rank is past target rank
        if (currentRank > m.targetRank) return

        // Calculate days difference
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

        list.push({
          id: `${c.id}-${m.key}`,
          cycleId: c.id,
          cycleName: c.name,
          taskTitle: m.taskTitle,
          stage: m.stage,
          dueDate: dueDateStr,
          diffDays,
          isOverdue,
          statusLabel,
          badgeClass,
        })
      })
    })

    // Sort by due date ascending (earliest first, overdue at the top)
    return list.sort((a, b) => a.diffDays - b.diffDays)
  }, [cycles, activeCycle])

  return (
    <div className="space-y-4 w-full pb-2 font-sans">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Headcount"
          value={totalEmployees}
          subtitle="Across 2 core divisions"
        />

        <MetricCard
          title="Cycle Completion"
          value={effectiveStage === 'released' ? '100%' : effectiveStage === 'calibration' ? '88%' : '75%'}
          subtitle={`Stage: ${effectiveStage.replace('_', ' ')}`}
          trend={{ value: 'On schedule', neutral: true }}
        />

        <MetricCard
          title="Goal Execution"
          value={`${goalAttainmentRate}%`}
          subtitle={`${goals.length} tracked targets`}
        />

        <MetricCard
          title="Calibration Window"
          value="Oct 20"
          subtitle={`Release: ${formatDate(activeCycle.deadlines.releaseDate)}`}
          trend={{ value: '4 days left', isPositive: true }}
        />
      </div>

      {/* Workflow Tracking: Progression Stepper */}
      <section>
        <StageStepper currentStage={effectiveStage} cycle={activeCycle} />
      </section>

      {/* Department Breakdown & Immediate Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5">
        {/* Department Progress Cards & Employee Roster Columns */}
        <div className="lg:col-span-2 dark-glass-card p-4 sm:p-5 md:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight uppercase">
              Department Progress
            </h2>
            <Link
              to="/admin/reports"
              className="text-xs font-sans text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
            >
              <span>Reports</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
            </Link>
          </div>

          {/* Department Columns Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Column 1: Engineering */}
            <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex flex-col space-y-3">
              {/* Header */}
              <div className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      Engineering
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 truncate font-medium">
                      Lead: Marcus Chen
                    </p>
                  </div>

                  <span className="font-sans text-[11px] font-bold text-slate-900 bg-slate-100 border-slate-300 dark:text-white dark:bg-zinc-800 dark:border-zinc-700 px-2 py-0.5 rounded-md border shrink-0">
                    {engStats.overall}% Completed
                  </span>
                </div>

                <ProgressBar value={engStats.overall} size="sm" showPercentage={false} />

                <div className="flex items-center justify-between text-[10.5px] text-slate-600 dark:text-zinc-300 font-sans pt-0.5 font-medium">
                  <span>Self: <strong className="text-slate-900 dark:text-white">{engStats.selfRate}%</strong></span>
                  <span>Manager: <strong className="text-slate-900 dark:text-white">{engStats.mgrRate}%</strong></span>
                  <span>Goals: <strong className="text-slate-900 dark:text-white">{engStats.goalsRate}%</strong></span>
                </div>
              </div>

              {/* Employee Cards inside Engineering */}
              <div className="space-y-2.5 flex-1">
                {engineeringMembers.map(renderEmployeeCard)}
              </div>
            </div>

            {/* Column 2: Product & Experience */}
            <div className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] flex flex-col space-y-3">
              {/* Header */}
              <div className="space-y-2.5 pb-3 border-b border-slate-200 dark:border-white/[0.08]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      Product & Experience
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 truncate font-medium">
                      Lead: Sarah Jenkins
                    </p>
                  </div>

                  <span className="font-sans text-[11px] font-bold text-slate-900 bg-slate-100 border-slate-300 dark:text-white dark:bg-zinc-800 dark:border-zinc-700 px-2 py-0.5 rounded-md border shrink-0">
                    {prodStats.overall}% Completed
                  </span>
                </div>

                <ProgressBar value={prodStats.overall} size="sm" showPercentage={false} />

                <div className="flex items-center justify-between text-[10.5px] text-slate-600 dark:text-zinc-300 font-sans pt-0.5 font-medium">
                  <span>Self: <strong className="text-slate-900 dark:text-white">{prodStats.selfRate}%</strong></span>
                  <span>Manager: <strong className="text-slate-900 dark:text-white">{prodStats.mgrRate}%</strong></span>
                  <span>Goals: <strong className="text-slate-900 dark:text-white">{prodStats.goalsRate}%</strong></span>
                </div>
              </div>

              {/* Employee Cards inside Product & Experience */}
              <div className="space-y-2.5 flex-1">
                {productMembers.map(renderEmployeeCard)}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Admin Actions & Talent Widget */}
        <div className="space-y-4">
          {/* Personnel Summary Tile - Minimalist Dashboard Card */}
          <div className="dark-glass-card p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.08]">
              <span className="text-xs font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Enterprise Talent
              </span>
              <span className="inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                100% In Sync
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarGroup users={users} max={4} size="sm" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {totalEmployees} Active Personnel
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                    Eng ({engineeringStaff.length}) · Prod ({productStaff.length})
                  </div>
                </div>
              </div>

              <Link
                to="/admin/users"
                className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <span>Directory</span>
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>

          <div className="dark-glass-card p-5 space-y-3.5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <h3 className="text-xs font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2.5 border-b border-slate-100 dark:border-white/[0.08]">
              Governance Operations
            </h3>

            <div className="space-y-2.5 text-xs font-sans">
              <Link
                to="/admin/calibration"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Calibration Hub</div>
                    <div className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium">Adjust & release</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                to={`/admin/cycles/${activeCycle.id}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Advance Cycle Stage</div>
                    <div className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium">Advance stage</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Talent Directory</div>
                    <div className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium">Profiles & roles</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                to="/admin/audit"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Audit Trail</div>
                    <div className="text-[10px] text-slate-600 dark:text-zinc-300 font-medium">Traceability logs</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Admin Approvals & Upcoming Deadlines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4.5">
        {/* Section 1: Pending Admin Approvals */}
        <section className="lg:col-span-7 dark-glass-card p-4 sm:p-5 md:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                  Pending Admin Approvals
                </h2>
                {pendingApprovals.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-mono">
                    {pendingApprovals.length}
                  </span>
                )}
              </div>
              <Link
                to="/admin/calibration"
                className="text-xs font-sans text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
              >
                <span>Calibration Hub</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>

            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500 font-sans">
                Loading pending approvals...
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="py-9 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 flex items-center justify-center mb-2.5 border border-slate-200 dark:border-zinc-700">
                  <CheckCircle2 className="w-5 h-5 stroke-[2]" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  No Pending Admin Approvals
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 max-w-sm">
                  All submitted appraisals and performance targets have been reviewed and approved.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto no-scrollbar -mx-1 sm:mx-0">
                <table className="w-full text-left text-xs border-collapse min-w-[560px]">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/[0.08] text-[10.5px] uppercase font-bold text-slate-500 dark:text-zinc-400 tracking-wider font-sans select-none">
                      <th className="pb-2.5 font-bold">Employee</th>
                      <th className="pb-2.5 font-bold">Review Cycle</th>
                      <th className="pb-2.5 font-bold">Approval Type</th>
                      <th className="pb-2.5 font-bold">Submitted</th>
                      <th className="pb-2.5 font-bold">Status</th>
                      <th className="pb-2.5 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06] font-sans">
                    {pendingApprovals.map((item) => (
                      <tr key={item.id} className="group hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={item.employee.avatar}
                              alt={item.employee.name}
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {item.employee.name}
                              </div>
                              <div className="text-[10.5px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                                {item.employee.employeeCode}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <span className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium truncate block max-w-[130px]" title={item.cycleName}>
                            {item.cycleName}
                          </span>
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                            {item.approvalType}
                          </span>
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {formatDate(item.submissionDate)}
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50">
                            <Clock className="w-3 h-3" />
                            <span>{item.status}</span>
                          </span>
                        </td>
                        <td className="py-3 pl-2 text-right whitespace-nowrap">
                          <Link
                            to={item.reviewUrl}
                            className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-slate-700 dark:text-zinc-200 text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0"
                          >
                            <span>Review</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Section 2: Upcoming Deadlines */}
        <section className="lg:col-span-5 dark-glass-card p-4 sm:p-5 md:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                  Upcoming Deadlines
                </h2>
                {upcomingDeadlines.length > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-mono">
                    {upcomingDeadlines.length}
                  </span>
                )}
              </div>
              <Link
                to="/admin/cycles"
                className="text-xs font-sans text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
              >
                <span>Review Cycles</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>

            {loading ? (
              <div className="py-10 text-center text-xs text-slate-400 dark:text-zinc-500 font-sans">
                Loading deadlines...
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="py-9 text-center flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 flex items-center justify-center mb-2.5 border border-slate-200 dark:border-zinc-700">
                  <Calendar className="w-5 h-5 stroke-[2]" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  No Upcoming Deadlines
                </p>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 max-w-sm">
                  All scheduled workflow milestones for active review cycles have concluded.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {upcomingDeadlines.map((dl) => (
                  <Link
                    key={dl.id}
                    to={`/admin/cycles/${dl.cycleId}`}
                    className="p-3 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/20 transition-all flex items-center justify-between gap-3 shadow-2xs group cursor-pointer"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors">
                          {dl.taskTitle}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${dl.badgeClass}`}>
                          {dl.statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-zinc-400 font-sans truncate">
                        <span className="truncate max-w-[170px]" title={dl.cycleName}>{dl.cycleName}</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">{formatDate(dl.dueDate)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
