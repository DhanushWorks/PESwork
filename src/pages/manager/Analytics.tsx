import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { peopleService, reviewService, goalService } from '../../services'
import { Goal, User, ManagerReview } from '../../types'
import { MetricCard } from '../../components/ui/MetricCard'
import { RATING_BANDS } from '../../lib/scoring'
import { BarChart3, TrendingUp, Users, Target, Award } from 'lucide-react'

export const ManagerAnalytics: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const [reports, setReports] = useState<User[]>([])
  const [reviews, setReviews] = useState<ManagerReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
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
      setLoading(false)
    }

    fetchData()
  }, [currentUser.id, activeCycle.id])

  // Compute rating band distribution
  const bandCounts: Record<string, number> = {}
  RATING_BANDS.forEach((b) => {
    bandCounts[b.label] = 0
  })

  reviews.forEach((r) => {
    const score = r.compositeScore
    for (const b of RATING_BANDS) {
      if (score >= b.min && score <= b.max) {
        bandCounts[b.label] = (bandCounts[b.label] || 0) + 1
        break
      }
    }
  })

  const avgTeamScore =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.compositeScore, 0) / reviews.length).toFixed(2)
      : '—'

  const avgGoalProgress =
    goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
      : 0

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Clean Dashboard Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Team Distribution & Attainment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Attainment distribution, review pacing & direct report score metrics
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          title="Team Size"
          value={reports.length}
          subtitle="Direct reporting lines"
          icon={<Users className="w-4 h-4 text-[#8B7CFF]" />}
        />

        <MetricCard
          title="Average Appraisal Score"
          value={avgTeamScore}
          subtitle={`${reviews.length} evaluations submitted`}
          icon={<Award className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />}
        />

        <MetricCard
          title="Average Goal Attainment"
          value={`${avgGoalProgress}%`}
          subtitle={`${goals.length} active strategic goals`}
          icon={<Target className="w-4 h-4 text-[#FFB454]" />}
        />
      </div>

      {/* Rating Distribution Bar Chart */}
      <div className="dark-glass-card conic-border-glow rounded-2xl p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider flex items-center gap-2 font-mono">
              <BarChart3 className="w-4 h-4 text-[#8B7CFF]" />
              Appraisal Rating Distribution (Gaussian Curve)
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-0.5">
              Normal curve distribution across submitted team members
            </p>
          </div>
          <span className="text-xs font-semibold font-mono text-[#8B7CFF] bg-[#8B7CFF]/10 px-2.5 py-1 rounded-lg border border-[#8B7CFF]/20">
            {reviews.length} reviews graded
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {RATING_BANDS.map((band) => {
            const count = bandCounts[band.label] || 0
            const percentage = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0

            return (
              <div key={band.band} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-medium">
                  <span className="text-slate-800 dark:text-[#F0F3FA]">
                    <strong className="font-semibold">{band.label}</strong>{' '}
                    <span className="text-slate-400 dark:text-[#8D96AA] font-mono text-[11px]">({band.min.toFixed(2)} – {band.max.toFixed(2)})</span>
                  </span>
                  <span className="font-mono text-slate-700 dark:text-[#8D96AA]">
                    {count} member{count === 1 ? '' : 's'} ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200/90 dark:border-white/[0.06] rounded-full h-3.5 overflow-hidden p-[2px]">
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
        <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-white/[0.06] font-mono">
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
                    <div className="text-[11px] text-slate-500 dark:text-[#8D96AA] font-mono truncate">{empGoals.length} goals</div>
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="w-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200/90 dark:border-white/[0.06] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] h-full rounded-full transition-all duration-500"
                      style={{ width: `${empAvg}%` }}
                    />
                  </div>
                </div>

                <span className="font-mono font-bold text-slate-800 dark:text-[#F0F3FA] text-xs w-12 text-right">
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

