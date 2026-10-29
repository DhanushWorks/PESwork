import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { peopleService, goalService, storageService, calibrationService, resultService, cycleService, reviewService } from '../../services'
import { apiCache } from '../../lib/apiCache'
import { CalibrationItem } from '../../services'
import { User, Goal, SelfReview, ManagerReview, CalibrationRecord, EvaluationResult, ReviewCycle, CycleStage } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { MetricCard, ProgressBar } from '../../components/ui/MetricCard'
import { LoadingState } from '../../components/ui/LoadingState'
import { AvatarGroup } from '../../components/ui/AvatarGroup'
import { AnimatedProgressRing } from '../../components/ui/AnimatedProgressRing'
import { useInView } from '../../hooks/useInView'
import { useCountUp } from '../../hooks/useCountUp'
import { getAdminWorkflowState, matchesCycle, matchesUser } from '../../lib/workflow'
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
  const { activeCycle, allUsers } = useApp()

  const initialState = storageService.getState()
  const cachedUsers = apiCache.peek<User[]>('people:list') || initialState.users || []
  const cachedCycles = apiCache.peek<ReviewCycle[]>('cycles:list') || initialState.cycles || []
  const hasCachedData = cachedUsers.length > 0

  const [users, setUsers] = useState<User[]>(cachedUsers)
  const [goals, setGoals] = useState<Goal[]>(() => initialState.goals || [])
  const [selfReviews, setSelfReviews] = useState<SelfReview[]>(() => initialState.selfReviews || [])
  const [managerReviews, setManagerReviews] = useState<ManagerReview[]>(() => initialState.managerReviews || [])
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>(() => initialState.calibrations || [])
  const [results, setResults] = useState<EvaluationResult[]>(() => initialState.results || [])
  const [calibrationItems, setCalibrationItems] = useState<CalibrationItem[]>([])
  const [cycles, setCycles] = useState<ReviewCycle[]>(cachedCycles)
  const [loading, setLoading] = useState(!hasCachedData)

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    const fetchData = async () => {
      if (users.length === 0) setLoading(true)
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

        const freshCals: CalibrationRecord[] = [
          ...(state.calibrations || []),
          ...(calList || [])
            .filter((c) => c.adminApproved || c.calibrationRecord)
            .map((c) => ({
              id: c.calibrationRecord?.id || `cal-${c.employee.id}`,
              cycleId: activeCycle.id,
              employeeId: c.employee.id,
              originalScore: c.currentScore,
              adjustedScore: c.currentScore,
              reason: c.calibrationRecord?.reason || '',
              calibratedBy: c.calibrationRecord?.calibratedBy || 'Admin Eleanor Vance',
              calibratedAt: c.calibrationRecord?.calibratedAt || new Date().toISOString(),
              adminApproved: c.adminApproved,
              adminApprovedAt: c.adminApprovedAt,
              status: c.adminApproved ? ('approved' as const) : ('pending_admin_approval' as const),
            })),
        ]

        if (isMounted) {
          setUsers(uList)
          setGoals(gResults.flat())
          setSelfReviews(srList || state.selfReviews || [])
          setManagerReviews(mrList || state.managerReviews || [])
          setCalibrations(freshCals)
          setResults(allResults)
          setCalibrationItems(calList || [])
          setCycles(cycleList || [])
        }
      } catch (err) {
        console.warn('Notice loading overview data:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
          clearTimeout(safetyTimer)
        }
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

  const [selectedDeptFilter, setSelectedDeptFilter] = useState<'all' | 'Engineering' | 'Product & Experience'>('all')
  const [staffPage, setStaffPage] = useState(1)
  const [showAllStaff, setShowAllStaff] = useState(false)
  const STAFF_PER_PAGE = 8

  // Reset pagination when department filter changes
  useEffect(() => {
    setStaffPage(1)
  }, [selectedDeptFilter])

  const displayedMembers = useMemo(() => {
    if (selectedDeptFilter === 'Engineering') return engineeringMembers
    if (selectedDeptFilter === 'Product & Experience') return productMembers
    return [...engineeringMembers, ...productMembers]
  }, [selectedDeptFilter, engineeringMembers, productMembers])

  const totalStaffPages = Math.ceil(displayedMembers.length / STAFF_PER_PAGE) || 1
  const paginatedStaff = useMemo(() => {
    if (showAllStaff) return displayedMembers
    const start = (staffPage - 1) * STAFF_PER_PAGE
    return displayedMembers.slice(start, start + STAFF_PER_PAGE)
  }, [displayedMembers, staffPage, showAllStaff])

  // Dynamic active cycle derived from fresh cycles list
  const currentCycle = useMemo(() => {
    return cycles.find((c) => c.id === activeCycle.id || matchesCycle(c.id, activeCycle.id)) || activeCycle
  }, [cycles, activeCycle])

  // Synchronized workflow stage for Admin
  const workflowState = getAdminWorkflowState({
    cycle: currentCycle,
    totalEmployees,
    selfReviews,
    managerReviews,
    calibrations,
    results,
    goals,
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
      const sRev = selfReviews.find((r) => matchesUser(r.userId, m.id) && matchesCycle(r.cycleId, currentCycle.id))
      const mRev = managerReviews.find((r) => matchesUser(r.employeeId, m.id) && matchesCycle(r.cycleId, currentCycle.id))
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

    const selfRev = selfReviews.find((r) => matchesUser(r.userId, employee.id) && matchesCycle(r.cycleId, currentCycle.id))
    const mgrRev = managerReviews.find((r) => matchesUser(r.employeeId, employee.id) && matchesCycle(r.cycleId, currentCycle.id))
    const calItem = calibrationItems.find((c) => matchesUser(c.employee.id, employee.id))
    const calRec = calibrations.find((c) => matchesUser(c.employeeId, employee.id) && matchesCycle(c.cycleId, currentCycle.id))
    const res = results.find((r) => matchesUser(r.employeeId, employee.id) && matchesCycle(r.cycleId, currentCycle.id))

    const isSelfDone = selfRev?.status === 'submitted'
    const isMgrDone = mgrRev?.status === 'submitted'
    const isCalibratedApproved = Boolean(
      calItem?.adminApproved ||
      calRec?.adminApproved ||
      (calRec as any)?.status === 'approved' ||
      (res && ((res as any)?.status === 'released' || currentCycle.stage === 'released' || currentCycle.stage === 'closed'))
    )
    const isCalibrated = Boolean(
      isCalibratedApproved ||
      calItem?.calibrationRecord ||
      calRec ||
      (calItem?.currentScore !== undefined && calItem.currentScore !== mgrRev?.compositeScore)
    )
    // Only mark as Released if the cycle is ACTUALLY at Stage 7 (released) or Stage 8 (closed)
    const isCycleOfficiallyReleased = currentCycle.stage === 'released' || currentCycle.stage === 'closed'
    const isReleased = Boolean(isCycleOfficiallyReleased && isCalibratedApproved)
    const score = res?.compositeScore ?? calRec?.adjustedScore ?? calItem?.currentScore ?? mgrRev?.compositeScore ?? selfRev?.overallRating

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

          {isReleased ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-700 text-white dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-600/30">
              <CheckCircle2 className="w-3 h-3 text-current" />
              Released: {Number(score).toFixed(1)}
            </span>
          ) : isCalibratedApproved ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 border border-slate-700/30">
              <CheckCircle2 className="w-3 h-3 text-current" />
              Calibrated (Approved): {Number(score).toFixed(1)}
            </span>
          ) : isCalibrated ? (
            <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-600 text-white dark:bg-amber-500/20 dark:text-amber-300 border border-amber-600/30">
              <Clock className="w-3 h-3 text-current" />
              In Calibration: {Number(score).toFixed(1)}
            </span>
          ) : score ? (
            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
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
          <div className="flex items-center gap-1.5 flex-wrap">
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

            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${
                isCalibratedApproved
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                  : isCalibrated
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400'
              }`}
            >
              Calibrated: {isCalibratedApproved ? 'Done' : isCalibrated ? 'In Review' : 'Pending'}
            </span>

            {isReleased && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/40 font-semibold">
                Released
              </span>
            )}
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
    <div className="space-y-4 sm:space-y-5 w-full pb-4 sm:pb-6 font-sans">
      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <MetricCard
          title="Active Headcount"
          value={totalEmployees}
          subtitle="Across 2 core divisions"
        />

        <MetricCard
          title="Cycle Completion"
          value={
            effectiveStage === 'closed' || effectiveStage === 'released'
              ? '100%'
              : effectiveStage === 'calibration'
              ? '88%'
              : effectiveStage === 'manager_review'
              ? '70%'
              : effectiveStage === 'self_review'
              ? '55%'
              : effectiveStage === 'tracking'
              ? '40%'
              : effectiveStage === 'goals_open'
              ? '25%'
              : '12%'
          }
          subtitle={`Stage: ${effectiveStage.replace(/_/g, ' ')}`}
          trend={{ value: 'On schedule', neutral: true }}
        />

        <MetricCard
          title="Goal Execution"
          value={`${goalAttainmentRate}%`}
          subtitle={`${goals.length} tracked targets`}
          trend={{ value: goals.length > 0 ? `${goals.filter((g) => g.status === 'approved').length} approved` : 'Active', neutral: true }}
        />

        <MetricCard
          title="Calibration Window"
          value="Oct 20"
          subtitle={`Release: ${formatDate(activeCycle?.deadlines?.releaseDate)}`}
          trend={{ value: '4 days left', neutral: true }}
        />
      </div>

      {/* Workflow Tracking: Progression Stepper */}
      <section>
        <StageStepper
          currentStage={effectiveStage}
          cycle={currentCycle}
          isCalibrationApproved={calibrations.some((c) => c.adminApproved) || calibrationItems.some((c) => c.adminApproved)}
        />
      </section>

      {/* Department Breakdown & Immediate Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4.5">
        {/* Department Progress Cards & Employee Roster Columns */}
        <div className="lg:col-span-2 dark-glass-card p-4 sm:p-5 md:p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                  Department Progress
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-mono">
                  {totalEmployees} Staff
                </span>
              </div>
              <Link
                to="/admin/reports"
                className="text-xs font-sans text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
              >
                <span>Reports</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>

            {/* Department Summary Cards Side-by-Side */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Engineering KPI Card */}
              <div
                onClick={() => setSelectedDeptFilter(selectedDeptFilter === 'Engineering' ? 'all' : 'Engineering')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedDeptFilter === 'Engineering'
                    ? 'border-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span>Engineering</span>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                        ({engineeringMembers.length})
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 truncate font-medium">
                      Lead: Marcus Chen
                    </p>
                  </div>

                  <span className="font-sans text-[11px] font-bold text-slate-900 bg-white dark:text-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 shrink-0 shadow-2xs">
                    {engStats.overall}%
                  </span>
                </div>

                <ProgressBar value={engStats.overall} size="sm" showPercentage={false} />

                <div className="flex items-center justify-between text-[10.5px] text-slate-600 dark:text-zinc-300 font-sans pt-2 font-medium flex-wrap gap-1">
                  <span>Self: <strong className="text-slate-900 dark:text-white">{engStats.selfRate}%</strong></span>
                  <span>Manager: <strong className="text-slate-900 dark:text-white">{engStats.mgrRate}%</strong></span>
                  <span>Goals: <strong className="text-slate-900 dark:text-white">{engStats.goalsRate}%</strong></span>
                </div>
              </div>

              {/* Product & Experience KPI Card */}
              <div
                onClick={() => setSelectedDeptFilter(selectedDeptFilter === 'Product & Experience' ? 'all' : 'Product & Experience')}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  selectedDeptFilter === 'Product & Experience'
                    ? 'border-indigo-500/50 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-xs ring-1 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                      <span>Product & Experience</span>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400">
                        ({productMembers.length})
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 truncate font-medium">
                      Lead: Sarah Jenkins
                    </p>
                  </div>

                  <span className="font-sans text-[11px] font-bold text-slate-900 bg-white dark:text-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700 shrink-0 shadow-2xs">
                    {prodStats.overall}%
                  </span>
                </div>

                <ProgressBar value={prodStats.overall} size="sm" showPercentage={false} />

                <div className="flex items-center justify-between text-[10.5px] text-slate-600 dark:text-zinc-300 font-sans pt-2 font-medium flex-wrap gap-1">
                  <span>Self: <strong className="text-slate-900 dark:text-white">{prodStats.selfRate}%</strong></span>
                  <span>Manager: <strong className="text-slate-900 dark:text-white">{prodStats.mgrRate}%</strong></span>
                  <span>Goals: <strong className="text-slate-900 dark:text-white">{prodStats.goalsRate}%</strong></span>
                </div>
              </div>
            </div>

            {/* Department Roster Header & Filter Pills */}
            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Staff Progress ({displayedMembers.length})
              </span>
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-zinc-800/80 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter('all')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedDeptFilter === 'all'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({totalEmployees})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter('Engineering')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedDeptFilter === 'Engineering'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Engineering ({engineeringMembers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDeptFilter('Product & Experience')}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    selectedDeptFilter === 'Product & Experience'
                      ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Product ({productMembers.length})
                </button>
              </div>
            </div>

            {/* Employee Cards Grid - 8 Cards per view (4 rows of 2), perfectly matching Upcoming Deadlines height */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paginatedStaff.map(renderEmployeeCard)}
            </div>
          </div>

          {/* Pagination Controls anchored to bottom to keep left and right columns balanced and equal */}
          {displayedMembers.length > STAFF_PER_PAGE && (
            <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-100 dark:border-white/[0.08] text-xs font-sans">
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                {showAllStaff
                  ? `Showing all ${displayedMembers.length} staff`
                  : `Showing ${(staffPage - 1) * STAFF_PER_PAGE + 1}–${Math.min(staffPage * STAFF_PER_PAGE, displayedMembers.length)} of ${displayedMembers.length} staff`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAllStaff((prev) => !prev)}
                  className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  {showAllStaff ? 'Show Balanced (8)' : `Show All (${displayedMembers.length})`}
                </button>

                {!showAllStaff && totalStaffPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={staffPage <= 1}
                      onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                      className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors font-medium text-[11px] cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="text-[11px] font-semibold text-slate-800 dark:text-white px-1 font-mono">
                      {staffPage} / {totalStaffPages}
                    </span>
                    <button
                      type="button"
                      disabled={staffPage >= totalStaffPages}
                      onClick={() => setStaffPage((p) => Math.min(totalStaffPages, p + 1))}
                      className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors font-medium text-[11px] cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quick Admin Actions & Talent Widget & Deadlines */}
        <div className="space-y-4 flex flex-col">
          {/* Personnel Summary Tile */}
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

          {/* Governance Operations - Compact 2x2 Action Pad */}
          <div className="dark-glass-card p-4 sm:p-5 space-y-3 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <h3 className="text-xs font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-white/[0.08]">
              Governance Operations
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs font-sans">
              <Link
                to="/admin/calibration"
                className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
                title="Open Calibration Hub"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">Calibration</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate">Adjust & release</div>
                </div>
              </Link>

              <Link
                to={`/admin/cycles/${currentCycle.id}`}
                className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
                title="Advance Cycle Stage"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">Cycle Stage</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate">Advance stage</div>
                </div>
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
                title="Talent Directory"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">Directory</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate">Profiles & roles</div>
                </div>
              </Link>

              <Link
                to="/admin/audit"
                className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
                title="Compliance Audit Trail"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0">
                  <History className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">Audit Trail</div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate">Audit logs</div>
                </div>
              </Link>
            </div>
          </div>

          {/* Upcoming Deadlines in Right Column - Eliminates Circle 2 Void */}
          <div className="dark-glass-card p-4 sm:p-5 space-y-3 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Upcoming Deadlines
                </h3>
                {upcomingDeadlines.length > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-mono">
                    {upcomingDeadlines.length}
                  </span>
                )}
              </div>
              <Link
                to="/admin/cycles"
                className="text-xs font-sans text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-colors inline-flex items-center gap-1 font-semibold"
              >
                <span>Cycles</span>
                <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>

            {loading ? (
              <LoadingState message="Loading cycle deadlines..." variant="card" />
            ) : upcomingDeadlines.length === 0 ? (
              <div className="py-6 text-center flex flex-col items-center justify-center">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 flex items-center justify-center mb-2 border border-slate-200 dark:border-zinc-700">
                  <Calendar className="w-4 h-4 stroke-[2]" />
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  No Upcoming Deadlines
                </p>
                <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  All milestones have concluded.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.slice(0, 6).map((dl) => (
                  <Link
                    key={dl.id}
                    to={`/admin/cycles/${dl.cycleId}`}
                    className="p-2.5 rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/20 transition-all flex items-center justify-between gap-2.5 shadow-2xs group cursor-pointer"
                  >
                    <div className="min-w-0 space-y-0.5 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-slate-700 dark:group-hover:text-zinc-200 transition-colors truncate">
                          {dl.taskTitle}
                        </span>
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9.5px] font-semibold border ${dl.badgeClass}`}>
                          {dl.statusLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-zinc-400 font-sans truncate">
                        <span className="truncate max-w-[120px]" title={dl.cycleName}>{dl.cycleName}</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-slate-700 dark:text-zinc-300">{formatDate(dl.dueDate)}</span>
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pending Admin Approvals (Full Width Table) */}
      <section className="dark-glass-card p-4 sm:p-5 md:p-6 space-y-4 mb-8 sm:mb-12">
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
          <LoadingState message="Loading pending approvals..." variant="card" />
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
          <>
            {/* Mobile Adaptive Card View (Zero horizontal or vertical clipping on narrow screens) */}
            <div className="block sm:hidden space-y-3 font-sans">
              {pendingApprovals.map((item) => {
                const liveEmp = allUsers.find((u) => u.id === item.employee.id || matchesUser(u.id, item.employee.id)) || item.employee
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={liveEmp.avatar || item.employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                          alt={liveEmp.name}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                            {liveEmp.name}
                          </div>
                          <div className="text-[10.5px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                            {liveEmp.employeeCode}
                          </div>
                        </div>
                      </div>
                    <Link
                      to={item.reviewUrl}
                      className="h-7 px-2.5 rounded-lg border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/[0.12] text-slate-800 dark:text-zinc-100 text-xs font-semibold inline-flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0 active:scale-95"
                    >
                      <span>Review</span>
                      <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    </Link>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.05] text-[11px]">
                    <div className="min-w-0 truncate">
                      <span className="text-slate-400 dark:text-zinc-500">Cycle: </span>
                      <span className="font-medium text-slate-700 dark:text-zinc-300 truncate" title={item.cycleName}>
                        {item.cycleName}
                      </span>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 shrink-0">
                      {item.approvalType}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10.5px]">
                    <span className="text-slate-500 dark:text-zinc-400 font-mono">
                      {formatDate(item.submissionDate)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{item.status}</span>
                    </span>
                  </div>
                </div>
              )})}
            </div>

            {/* Desktop & Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto no-scrollbar -mx-1 sm:mx-0">
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
                  {pendingApprovals.map((item) => {
                    const liveEmp = allUsers.find((u) => u.id === item.employee.id || matchesUser(u.id, item.employee.id)) || item.employee
                    return (
                      <tr key={item.id} className="group hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={liveEmp.avatar || item.employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                              alt={liveEmp.name}
                              className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {liveEmp.name}
                              </div>
                              <div className="text-[10.5px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                                {liveEmp.employeeCode}
                              </div>
                            </div>
                          </div>
                        </td>
                      <td className="py-3 px-2">
                        <span className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium truncate block max-w-[180px]" title={item.cycleName}>
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
                  )})}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
