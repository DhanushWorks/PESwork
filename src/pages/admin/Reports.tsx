import React, { useState, useEffect, useCallback } from 'react'
import { useApp } from '../../app/AppContext'
import { MetricCard } from '../../components/ui/MetricCard'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import {
  peopleService,
  goalService,
  calibrationService,
  resultService,
  storageService,
  cycleService,
  reviewService,
  CalibrationItem,
} from '../../services'
import { User, Goal, SelfReview, ManagerReview, CalibrationRecord, EvaluationResult } from '../../types'
import { RefreshCw } from 'lucide-react'

export const AdminReports: React.FC = () => {
  const { activeCycle, allCycles, switchActiveCycle } = useApp()
  const [selectedDept, setSelectedDept] = useState('all')
  const [loading, setLoading] = useState(true)

  // Dynamic cycle data state
  const [users, setUsers] = useState<User[]>([])
  const [cycleGoals, setCycleGoals] = useState<Goal[]>([])
  const [calibrationItems, setCalibrationItems] = useState<CalibrationItem[]>([])
  const [results, setResults] = useState<EvaluationResult[]>([])
  const [selfReviews, setSelfReviews] = useState<SelfReview[]>([])
  const [managerReviews, setManagerReviews] = useState<ManagerReview[]>([])
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([])
  const [enrolledParticipants, setEnrolledParticipants] = useState<User[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [uList, calItems, allResults, enrolled, srList, mrList] = await Promise.all([
        peopleService.list(),
        calibrationService.listForCycle(activeCycle.id),
        resultService.getAllResults(activeCycle.id),
        cycleService.getEnrolledParticipants(activeCycle.id),
        reviewService.listAllSelfReviews(activeCycle.id),
        reviewService.listAllManagerReviews(activeCycle.id),
      ])

      const gPromises = uList.map((u) => goalService.listForUser(u.id, activeCycle.id))
      const gResults = await Promise.all(gPromises)
      const state = storageService.getState()

      setUsers(uList)
      setCalibrationItems(calItems)
      setResults(allResults)
      setEnrolledParticipants(enrolled)
      setCycleGoals(gResults.flat())
      setSelfReviews(srList || state.selfReviews || [])
      setManagerReviews(mrList || state.managerReviews || [])
      setCalibrations(state.calibrations || [])
    } finally {
      setLoading(false)
    }
  }, [activeCycle.id])

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchData().finally(() => {
      clearTimeout(safetyTimer)
    })

    // Real-time synchronization when workflow state, goals, or calibrations update
    const unsubscribe = storageService.subscribe(() => {
      if (isMounted) {
        fetchData()
      }
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      unsubscribe()
    }
  }, [fetchData])

  // Determine active cohort of employees for this specific review cycle
  const cSelfReviews = selfReviews.filter((sr) => sr.cycleId === activeCycle.id)
  const cManagerReviews = managerReviews.filter((mr) => mr.cycleId === activeCycle.id)
  const cCalibrations = calibrations.filter((c) => c.cycleId === activeCycle.id)
  const cGoals = cycleGoals.filter((g) => !g.cycleId || g.cycleId === activeCycle.id)

  const cohortIds = new Set<string>()
  enrolledParticipants.forEach((u) => cohortIds.add(u.id))
  cSelfReviews.forEach((sr) => cohortIds.add(sr.userId))
  cManagerReviews.forEach((mr) => cohortIds.add(mr.employeeId))
  cCalibrations.forEach((c) => cohortIds.add(c.employeeId))
  cGoals.forEach((g) => cohortIds.add(g.userId))
  calibrationItems.forEach((ci) => cohortIds.add(ci.employee.id))

  let cycleEmployees: User[] = []
  if (cohortIds.size > 0) {
    cycleEmployees = users.filter((u) => cohortIds.has(u.id) && u.role !== 'admin')
  }
  if (cycleEmployees.length === 0) {
    cycleEmployees = users.filter((u) => u.active && u.role !== 'admin')
  }

  // 1. Participation Rate
  const participatingCount = cycleEmployees.filter((emp) => {
    const hasSr = cSelfReviews.some((sr) => sr.userId === emp.id && sr.status === 'submitted')
    const hasMr = cManagerReviews.some((mr) => mr.employeeId === emp.id && mr.status === 'submitted')
    const hasG = cGoals.some(
      (g) =>
        g.userId === emp.id &&
        (g.status === 'approved' || g.status === 'completed' || (g.progress !== undefined && g.progress > 0))
    )
    const hasCal = cCalibrations.some((c) => c.employeeId === emp.id)
    return hasSr || hasMr || hasG || hasCal
  }).length

  const overallParticipationRate =
    cycleEmployees.length > 0
      ? Math.round((participatingCount / cycleEmployees.length) * 100)
      : 0

  // 2. Average Rating
  const scoreMap = new Map<string, number>()
  cycleEmployees.forEach((emp) => {
    const res = results.find((r) => r.employeeId === emp.id && r.cycleId === activeCycle.id)
    const cal = cCalibrations.find((c) => c.employeeId === emp.id)
    const ci = calibrationItems.find((item) => item.employee.id === emp.id)
    const mr = cManagerReviews.find((r) => r.employeeId === emp.id && r.status === 'submitted')

    const score =
      res?.compositeScore ??
      cal?.adjustedScore ??
      ci?.currentScore ??
      (mr?.compositeScore && mr.compositeScore > 0 ? mr.compositeScore : null)

    if (typeof score === 'number' && score > 0) {
      scoreMap.set(emp.id, score)
    }
  })

  const evaluatedScores = Array.from(scoreMap.values())
  const avgFinalRating =
    evaluatedScores.length > 0
      ? (evaluatedScores.reduce((sum, s) => sum + s, 0) / evaluatedScores.length).toFixed(2)
      : '—'

  // 3. Goal Execution Progress
  const activeMilestones = cGoals.filter((g) => cycleEmployees.some((emp) => emp.id === g.userId))
  const goalExecutionIndex =
    activeMilestones.length > 0
      ? Math.round(activeMilestones.reduce((sum, g) => sum + (g.progress || 0), 0) / activeMilestones.length)
      : 0

  // 4. Calibration Resolution
  const submittedMrCount = cManagerReviews.filter(
    (mr) => mr.status === 'submitted' && cycleEmployees.some((emp) => emp.id === mr.employeeId)
  ).length

  let variancesResolved = 0
  cycleEmployees.forEach((emp) => {
    const isCalibrated = cCalibrations.some((c) => c.employeeId === emp.id)
    const isApproved = calibrationItems.some((ci) => ci.employee.id === emp.id && ci.adminApproved)
    const isReleased = results.some((r) => r.employeeId === emp.id && r.cycleId === activeCycle.id)
    if (isCalibrated || isApproved || isReleased) {
      variancesResolved++
    }
  })

  const calibrationRate =
    submittedMrCount > 0
      ? Math.min(100, Math.round((variancesResolved / submittedMrCount) * 100))
      : 100

  // 5. Department Breakdown
  const deptUsers: Record<string, User[]> = {}
  cycleEmployees.forEach((emp) => {
    let dName = emp.department || 'General'
    if (dName === 'DevOps & Platform') dName = 'Engineering'
    if (dName === 'Design & Engineering' || dName === 'Product Operations') dName = 'Product & Design'
    if (!deptUsers[dName]) deptUsers[dName] = []
    deptUsers[dName].push(emp)
  })

  if (!deptUsers['Engineering']) deptUsers['Engineering'] = []
  if (!deptUsers['Product & Design']) deptUsers['Product & Design'] = []

  const availableDepartments = Object.keys(deptUsers)

  const computedDepartments = availableDepartments
    .filter((dName) => (selectedDept === 'all' ? true : dName === selectedDept))
    .map((dName) => {
      const members = deptUsers[dName]
      const dGoals = activeMilestones.filter((g) => members.some((m) => m.id === g.userId))
      const dGoalAttainment =
        dGoals.length > 0
          ? Math.round(dGoals.reduce((sum, g) => sum + (g.progress || 0), 0) / dGoals.length)
          : 0

      const completedCount = members.filter((m) => {
        const mr = cManagerReviews.find((r) => r.employeeId === m.id && r.status === 'submitted')
        const cal = cCalibrations.find((c) => c.employeeId === m.id)
        const res = results.find((r) => r.employeeId === m.id && r.cycleId === activeCycle.id)
        return mr || cal || res
      }).length

      const dCompletionRate =
        members.length > 0 ? Math.round((completedCount / members.length) * 100) : 0

      const dScores = members
        .map((m) => scoreMap.get(m.id))
        .filter((s): s is number => typeof s === 'number')

      const dAvgRating =
        dScores.length > 0
          ? (dScores.reduce((sum, s) => sum + s, 0) / dScores.length).toFixed(2)
          : '—'

      return {
        name: dName,
        headcount: members.length,
        completionRate: dCompletionRate,
        goalAttainment: dGoalAttainment,
        avgRating: dAvgRating,
      }
    })

  // 6. Rating Distribution
  const totalGraded = evaluatedScores.length

  const b5Count = evaluatedScores.filter((s) => s >= 4.5).length
  const b4Count = evaluatedScores.filter((s) => s >= 3.75 && s < 4.5).length
  const b3Count = evaluatedScores.filter((s) => s >= 2.75 && s < 3.75).length
  const b21Count = evaluatedScores.filter((s) => s < 2.75).length

  const b5Pct = totalGraded > 0 ? Math.round((b5Count / totalGraded) * 100) : 0
  const b4Pct = totalGraded > 0 ? Math.round((b4Count / totalGraded) * 100) : 0
  const b3Pct = totalGraded > 0 ? Math.round((b3Count / totalGraded) * 100) : 0
  const b21Pct = totalGraded > 0 ? Math.round((b21Count / totalGraded) * 100) : 0

  const getQuotaStatus = (pct: number, minT: number, maxT: number) => {
    if (totalGraded === 0) {
      return {
        text: 'Pending',
        badgeClass:
          'text-slate-500 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700',
      }
    }
    if (pct >= minT && pct <= maxT) {
      return {
        text: `${pct}% · On Target`,
        badgeClass:
          'text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700',
      }
    }
    if (pct > maxT) {
      return {
        text: `${pct}% · Over Target`,
        badgeClass:
          'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50',
      }
    }
    return {
      text: `${pct}% · Under Target`,
      badgeClass:
        'text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700',
    }
  }

  return (
    <div className="space-y-4 w-full pb-4 sm:pb-6 font-sans">
      {/* Top Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 w-full min-w-0">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
            Performance Reports
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs relative z-30 w-full sm:w-auto min-w-0">
          {availableDepartments.length > 1 && (
            <div className="flex-1 sm:flex-initial min-w-0 sm:w-auto">
              <CustomDropdown
                value={selectedDept}
                onChange={setSelectedDept}
                fullWidth
                className="w-full sm:w-auto"
                options={[
                  { value: 'all', label: 'All Departments' },
                  ...availableDepartments.map((d) => ({ value: d, label: d })),
                ]}
              />
            </div>
          )}

          <div className="flex-1 sm:flex-initial min-w-0 sm:w-auto sm:max-w-xs">
            <CustomDropdown
              value={activeCycle.id}
              onChange={switchActiveCycle}
              align="right"
              fullWidth
              className="w-full sm:w-auto"
              options={allCycles.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-800/60 hover:border-slate-300 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-200 shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Refresh reports data"
            aria-label="Refresh reports data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* High Level Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <MetricCard
          title="Participation"
          value={`${overallParticipationRate}%`}
          subtitle="Organization-wide"
        />
        <MetricCard
          title="Average Rating"
          value={avgFinalRating}
          subtitle="Scale 1.0 – 5.0"
        />
        <MetricCard
          title="Goal Progress"
          value={`${goalExecutionIndex}%`}
          subtitle="Milestones delivered"
        />
        <MetricCard
          title="Calibration"
          value={`${calibrationRate}%`}
          subtitle="Variances resolved"
        />
      </div>

      {/* Department Comparison Cards */}
      <div className="dark-glass-card conic-border-glow p-6 sm:p-7 space-y-5">
        <div className="pb-3 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-sans">
            Department Performance
          </h2>
          <span className="text-xs font-sans text-slate-600 dark:text-zinc-300 hidden sm:inline">
            {activeCycle.name}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {computedDepartments.map((dept) => (
            <div
              key={dept.name}
              className="p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] space-y-4 text-xs"
            >
              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                <span>{dept.name}</span>
                <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {dept.headcount} Member{dept.headcount === 1 ? '' : 's'}
                </span>
              </div>

              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-900 dark:text-white font-semibold text-xs sm:text-[13px]">
                    <span>Completion Rate</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {dept.completionRate}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] h-full rounded-full transition-all duration-500"
                      style={{ width: `${dept.completionRate}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-900 dark:text-white font-semibold text-xs sm:text-[13px]">
                    <span>Goal Attainment</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                      {dept.goalAttainment}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] h-full rounded-full transition-all duration-500"
                      style={{ width: `${dept.goalAttainment}%` }}
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-white/[0.06] flex items-center justify-between">
                  <span className="text-slate-900 dark:text-white font-bold text-xs sm:text-[13px]">
                    Average Score:
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
                    {dept.avgRating}{' '}
                    <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                      / 5.0
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="dark-glass-card p-6 sm:p-7 space-y-4">
        <div className="pb-3 border-b border-slate-100 dark:border-white/[0.08] flex items-center justify-between">
          <h2 className="text-sm font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Rating Distribution
          </h2>
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
            {totalGraded} Graded
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Band 5: Outstanding (4.50 – 5.00)
              </span>
              <span className="text-slate-600 dark:text-zinc-300 font-medium text-xs">
                Target: 15% – 20%
              </span>
            </div>
            <span
              className={`font-sans font-bold text-xs px-3 py-1 rounded-lg self-start sm:self-auto border ${
                getQuotaStatus(b5Pct, 15, 20).badgeClass
              }`}
            >
              {getQuotaStatus(b5Pct, 15, 20).text}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Band 4: Exceeds (3.75 – 4.49)
              </span>
              <span className="text-slate-600 dark:text-zinc-300 font-medium text-xs">
                Target: 30% – 35%
              </span>
            </div>
            <span
              className={`font-sans font-bold text-xs px-3 py-1 rounded-lg self-start sm:self-auto border ${
                getQuotaStatus(b4Pct, 30, 35).badgeClass
              }`}
            >
              {getQuotaStatus(b4Pct, 30, 35).text}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Band 3: Meets (2.75 – 3.74)
              </span>
              <span className="text-slate-600 dark:text-zinc-300 font-medium text-xs">
                Target: 40% – 45%
              </span>
            </div>
            <span
              className={`font-sans font-bold text-xs px-3 py-1 rounded-lg self-start sm:self-auto border ${
                getQuotaStatus(b3Pct, 40, 45).badgeClass
              }`}
            >
              {getQuotaStatus(b3Pct, 40, 45).text}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.06]">
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Band 1 & 2: Needs Improvement (&lt; 2.75)
              </span>
              <span className="text-slate-600 dark:text-zinc-300 font-medium text-xs">
                Target: 5% – 10%
              </span>
            </div>
            <span
              className={`font-sans font-bold text-xs px-3 py-1 rounded-lg self-start sm:self-auto border ${
                getQuotaStatus(b21Pct, 5, 10).badgeClass
              }`}
            >
              {getQuotaStatus(b21Pct, 5, 10).text}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
