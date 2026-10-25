import React, { useEffect, useState, useCallback } from 'react'
import { useApp } from '../../app/AppContext'
import { peopleService, reviewService, goalService, storageService } from '../../services'
import { Goal, User, ManagerReview } from '../../types'
import { MetricCard } from '../../components/ui/MetricCard'
import { LoadingState } from '../../components/ui/LoadingState'
import { RATING_BANDS } from '../../lib/scoring'
import { TrendingUp, Users, Target, Award } from 'lucide-react'

export const ManagerAnalytics: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const [reports, setReports] = useState<User[]>([])
  const [reviews, setReviews] = useState<ManagerReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const direct = await peopleService.getDirectReports(currentUser.id)
      setReports(direct)

      const mrList: ManagerReview[] = []
      const gList: Goal[] = []

      for (const emp of direct) {
        const mr = await reviewService.getManagerReview(emp.id, activeCycle.id)
        if (mr) mrList.push(mr)
        const userGoals = await goalService.listForUser(emp.id, activeCycle.id)
        gList.push(...userGoals)
      }

      setReviews(mrList)
      setGoals(gList)
    } catch (err) {
      console.warn('Notice loading manager analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [currentUser.id, activeCycle.id])

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchData().finally(() => {
      clearTimeout(safetyTimer)
    })

    const unsubscribe = storageService.subscribe(() => {
      if (isMounted) fetchData()
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      unsubscribe()
    }
  }, [fetchData])

  // Compute rating band distribution
  const bandCounts: Record<string, number> = {}
  RATING_BANDS.forEach((b) => {
    bandCounts[b.label] = 0
  })

  const analyticsState = storageService.getState()
  const calList = analyticsState.calibrations || []
  const resList = analyticsState.results || []

  reviews.forEach((r) => {
    const matchingCal = calList.find((c) => c.employeeId === r.employeeId && c.cycleId === activeCycle.id)
    const matchingRes = resList.find((res) => res.employeeId === r.employeeId && res.cycleId === activeCycle.id)
    const score = matchingRes?.compositeScore ?? matchingCal?.adjustedScore ?? r.compositeScore

    for (const b of RATING_BANDS) {
      if (score >= b.min && score <= b.max) {
        bandCounts[b.label] = (bandCounts[b.label] || 0) + 1
        break
      }
    }
  })

  const avgTeamScore =
    reviews.length > 0
      ? (
          reviews.reduce((sum, r) => {
            const matchingCal = calList.find((c) => c.employeeId === r.employeeId && c.cycleId === activeCycle.id)
            const matchingRes = resList.find((res) => res.employeeId === r.employeeId && res.cycleId === activeCycle.id)
            const score = matchingRes?.compositeScore ?? matchingCal?.adjustedScore ?? r.compositeScore
            return sum + score
          }, 0) / reviews.length
        ).toFixed(2)
      : '—'

  const avgGoalProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0

  if (loading) {
    return <LoadingState message="Loading team performance analytics..." variant="page" />
  }

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Team Size"
          value={reports.length}
          subtitle="Direct reporting lines"
        />

        <MetricCard
          title="Average Appraisal Score"
          value={avgTeamScore}
          subtitle={`${reviews.length} evaluations submitted`}
        />

        <MetricCard
          title="Average Goal Attainment"
          value={`${avgGoalProgress}%`}
          subtitle={`${goals.length} active strategic goals`}
        />
      </div>

      {/* Rating Distribution Bar Chart */}
      <div className="dark-glass-card conic-border-glow rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
              Rating Distribution
            </h2>
          </div>
          <span className="text-xs font-semibold font-sans text-[#8B7CFF] bg-[#8B7CFF]/10 px-2.5 py-1 rounded-lg border border-[#8B7CFF]/20">
            {reviews.length} Graded
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {RATING_BANDS.map((band) => {
            const count = bandCounts[band.label] || 0
            const percentage = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0

            if (loading) {
    return <LoadingState message="Loading team performance analytics..." variant="page" />
  }

  return (
              <div key={band.band} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-slate-800 dark:text-[#F0F3FA]">
                    <strong className="font-semibold">{band.label}</strong>{' '}
                    <span className="text-slate-600 dark:text-zinc-300 font-sans font-semibold text-[11px]">({band.min.toFixed(2)} – {band.max.toFixed(2)})</span>
                  </span>
                  <span className="font-sans text-slate-700 dark:text-zinc-300">
                    {count} member{count === 1 ? '' : 's'} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-full h-3.5 overflow-hidden p-[2px]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 shadow-xs ${band.barClass}`}
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Goal Progress Breakdown by Team Member */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-white/[0.06] font-sans">
          Goal Completion by Team Member
        </h2>

        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
          {reports.map((emp) => {
            const empGoals = goals.filter((g) => g.userId === emp.id)
            const empAvg =
              empGoals.length > 0
                ? Math.round(empGoals.reduce((sum, g) => sum + g.progress, 0) / empGoals.length)
                : 0

            return (
              <div key={emp.id} className="py-3.5 first:pt-0 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 w-48 truncate">
                  <img src={emp.avatar} alt={emp.name} className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20" />
                  <div className="truncate">
                    <div className="font-bold text-slate-900 dark:text-[#F0F3FA] truncate">{emp.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-300 font-sans truncate">{empGoals.length} goals</div>
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] h-full rounded-full transition-all duration-500"
                      style={{ width: `${empAvg}%` }}
                    />
                  </div>
                </div>

                <span className="font-sans font-bold text-slate-800 dark:text-[#F0F3FA] text-xs w-12 text-right">
                  {empAvg}%
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

