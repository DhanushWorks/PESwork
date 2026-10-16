import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { peopleService, goalService } from '../../services'
import { User, Goal } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { MetricCard, ProgressBar } from '../../components/ui/MetricCard'
import { AvatarGroup } from '../../components/ui/AvatarGroup'
import { formatDate } from '../../lib/formatters'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Sliders,
  Users,
} from 'lucide-react'

export const AdminOverview: React.FC = () => {
  const { activeCycle } = useApp()

  const [users, setUsers] = useState<User[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const uList = await peopleService.list()
        const gPromises = uList.map((u) => goalService.listForUser(u.id, activeCycle.id))
        const gResults = await Promise.all(gPromises)

        if (isMounted) {
          setUsers(uList)
          setGoals(gResults.flat())
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => {
      isMounted = false
    }
  }, [activeCycle.id])

  const totalEmployees = users.filter((u) => u.active).length
  const engineeringStaff = users.filter((u) => u.department === 'Engineering')
  const productStaff = users.filter((u) => u.department === 'Product & Design')

  const approvedGoals = goals.filter((g) => g.status === 'approved' || g.status === 'completed')
  const goalAttainmentRate =
    approvedGoals.length > 0
      ? Math.round(approvedGoals.reduce((sum, g) => sum + g.progress, 0) / approvedGoals.length)
      : 84

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Organization Appraisal Command
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Enterprise cycle telemetry, appraisal completion velocity & distribution health
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/cycles"
            className="h-11 px-4 rounded-[14px] border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 transition-all font-medium text-xs cursor-pointer shadow-xs inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#8B7CFF]" />
            <span>Manage Cycles</span>
          </Link>
          <Link
            to="/admin/calibration"
            className="premium-glow-btn h-11 px-5 text-xs font-semibold cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Calibration Hub</span>
          </Link>
        </div>
      </div>

      {/* Cycle Stage Stepper */}
      <StageStepper currentStage={activeCycle.stage} />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Headcount"
          value={totalEmployees}
          subtitle="Across 2 core divisions"
          icon={<Users className="w-4 h-4 text-[#8B7CFF]" />}
        />

        <MetricCard
          title="Cycle Completion"
          value="88%"
          subtitle={`Stage: ${activeCycle.stage.replace('_', ' ')}`}
          icon={<CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />}
          trend={{ value: 'On schedule', neutral: true }}
        />

        <MetricCard
          title="Goal Execution"
          value={`${goalAttainmentRate}%`}
          subtitle={`${goals.length} tracked targets`}
          icon={<BarChart3 className="w-4 h-4 text-[#FFB454]" />}
        />

        <MetricCard
          title="Calibration Window"
          value="Oct 20"
          subtitle={`Release: ${formatDate(activeCycle.deadlines.releaseDate)}`}
          icon={<Clock className="w-4 h-4 text-[#8B7CFF]" />}
          trend={{ value: '4 days left', isPositive: true, pulse: true }}
        />
      </div>

      {/* Personnel Summary Tile - Futuristic Highlight Card */}
      <div className="dark-glass-card conic-border-glow p-5 sm:p-6 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <AvatarGroup users={users} max={7} size="md" />
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white">
                {totalEmployees} Active Enterprise Personnel
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-[#4FE3C1]/10 dark:text-[#4FE3C1] border dark:border-[#4FE3C1]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-[#4FE3C1] animate-pulse" />
                100% Cohort In Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono">
              Engineering ({engineeringStaff.length}) · Product & Design ({productStaff.length})
            </p>
          </div>
        </div>

        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-[12px] border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 transition-all font-mono text-xs font-medium cursor-pointer shrink-0"
        >
          <span>View Talent Directory</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#8B7CFF]" />
        </Link>
      </div>

      {/* Department Breakdown & Immediate Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department Progress Cards */}
        <div className="lg:col-span-2 dark-glass-card p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.08]">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                Department Cycle Progression
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono mt-0.5">
                Self-reviews and manager evaluations by operating division
              </p>
            </div>
            <Link
              to="/admin/reports"
              className="text-xs font-mono text-slate-500 dark:text-[#8D96AA] hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Executive Reports →
            </Link>
          </div>

          <div className="space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] space-y-3.5 transition-all hover:border-slate-300 dark:hover:border-white/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">Engineering</span>
                    <span className="text-slate-400 dark:text-[#8D96AA] font-mono text-[11px] ml-2">Lead: Marcus Chen</span>
                  </div>
                  <AvatarGroup users={engineeringStaff} max={4} size="sm" />
                </div>
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-[#4FE3C1] dark:bg-[#4FE3C1]/10 px-2.5 py-0.5 rounded-full border dark:border-[#4FE3C1]/20 self-start sm:self-auto">
                  92% Completed
                </span>
              </div>
              <ProgressBar value={92} size="md" showPercentage={false} />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8D96AA] font-mono pt-1">
                <span>Self-reviews: <strong className="text-slate-700 dark:text-white">100%</strong></span>
                <span>Manager reviews: <strong className="text-slate-700 dark:text-white">100%</strong></span>
                <span>Goals: <strong className="text-slate-700 dark:text-white">95%</strong></span>
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] space-y-3.5 transition-all hover:border-slate-300 dark:hover:border-white/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-xs">Product & Experience</span>
                    <span className="text-slate-400 dark:text-[#8D96AA] font-mono text-[11px] ml-2">Lead: Sarah Jenkins</span>
                  </div>
                  <AvatarGroup users={productStaff} max={4} size="sm" />
                </div>
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-[#8B7CFF] dark:bg-[#8B7CFF]/10 px-2.5 py-0.5 rounded-full border dark:border-[#8B7CFF]/20 self-start sm:self-auto">
                  85% Completed
                </span>
              </div>
              <ProgressBar value={85} size="md" showPercentage={false} />
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#8D96AA] font-mono pt-1">
                <span>Self-reviews: <strong className="text-slate-700 dark:text-white">100%</strong></span>
                <span>Manager reviews: <strong className="text-slate-700 dark:text-white">80%</strong></span>
                <span>Goals: <strong className="text-slate-700 dark:text-white">90%</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Admin Actions */}
        <div className="space-y-4">
          <div className="dark-glass-card p-6 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-100 dark:border-white/[0.08]">
              Governance Operations
            </h3>

            <div className="space-y-2.5 text-xs font-mono">
              <Link
                to="/admin/calibration"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#8B7CFF]/10 text-[#8B7CFF] flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Calibration Hub</div>
                    <div className="text-[10px] text-slate-400 dark:text-[#8D96AA]">Score adjustments & release</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                to={`/admin/cycles/${activeCycle.id}`}
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-[#4FE3C1]/10 text-indigo-600 dark:text-[#4FE3C1] flex items-center justify-center">
                    <RefreshCw className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Advance Cycle Stage</div>
                    <div className="text-[10px] text-slate-400 dark:text-[#8D96AA]">Transition enterprise phase</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
              </Link>

              <Link
                to="/admin/users"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#FFB454]/10 text-[#FFB454] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Manage Talent Directory</div>
                    <div className="text-[10px] text-slate-400 dark:text-[#8D96AA]">Roles, reporting lines & profiles</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[#FFB454] transition-colors" />
              </Link>

              <Link
                to="/admin/audit"
                className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:border-slate-300 dark:hover:border-white/20 text-slate-800 dark:text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">Security & Audit Log</div>
                    <div className="text-[10px] text-slate-400 dark:text-[#8D96AA]">Cryptographic traceability</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-white transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
