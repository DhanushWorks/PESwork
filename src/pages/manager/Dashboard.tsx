import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { reviewService, goalService, peopleService } from '../../services'
import { TeamReviewSummary } from '../../services/mock/reviewService'
import { Goal } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { MetricCard } from '../../components/ui/MetricCard'
import { RatingBadge } from '../../components/ui/Badge'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import { formatDate } from '../../lib/formatters'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileCheck,
  FileEdit,
  FileText,
  LayoutGrid,
  List,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'

export const ManagerDashboard: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const navigate = useNavigate()

  const [teamSummaries, setTeamSummaries] = useState<TeamReviewSummary[]>([])
  const [pendingGoals, setPendingGoals] = useState<Goal[]>([])
  const [teamFilter, setTeamFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [summaries, directReports] = await Promise.all([
          reviewService.listTeamReviews(currentUser.id, activeCycle.id),
          peopleService.getDirectReports(currentUser.id),
        ])

        // Fetch all pending goals for reports
        const allGoalsPromises = directReports.map((r) =>
          goalService.listForUser(r.id, activeCycle.id)
        )
        const allGoalsResults = await Promise.all(allGoalsPromises)
        const pending = allGoalsResults
          .flat()
          .filter((g) => g.status === 'pending_approval')

        if (isMounted) {
          setTeamSummaries(summaries)
          setPendingGoals(pending)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchData()
    return () => {
      isMounted = false
    }
  }, [currentUser.id, activeCycle.id])

  const submittedReviewsCount = teamSummaries.filter(
    (t) => t.managerReviewStatus === 'submitted'
  ).length
  const selfReviewsSubmittedCount = teamSummaries.filter(
    (t) => t.selfReviewStatus === 'submitted'
  ).length
  const pendingReviewsCount = teamSummaries.filter(
    (t) => t.managerReviewStatus !== 'submitted'
  ).length

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
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Team Performance & Evaluations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Direct report reviews, goal approvals & continuous team coaching
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/manager/approvals"
            className="h-11 px-4 rounded-[14px] border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-all font-medium text-xs cursor-pointer shadow-xs inline-flex items-center gap-2"
          >
            <CheckSquare className="w-4 h-4 text-[#FFB454]" />
            <span>Goal Approvals</span>
            {pendingGoals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200 dark:bg-[#FFB454]/20 dark:text-[#FFB454] dark:border-[#FFB454]/30 font-bold">
                {pendingGoals.length}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Cycle Stage Stepper */}
      <StageStepper currentStage={activeCycle.stage} />

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Direct Reports"
          value={teamSummaries.length}
          subtitle="Assigned team members"
          icon={<Users className="w-4 h-4 text-[#8B7CFF]" />}
        />

        <MetricCard
          title="Goal Approvals"
          value={pendingGoals.length}
          subtitle={
            pendingGoals.length === 0
              ? 'All team goals reviewed'
              : 'Requires manager approval'
          }
          icon={<CheckSquare className="w-4 h-4 text-[#FFB454]" />}
          badge={
            pendingGoals.length === 0 ? (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-zinc-200 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 font-medium">
                Up to date
              </span>
            ) : (
              <span className="text-[10px] font-mono bg-amber-50 text-amber-800 dark:bg-[#FFB454]/10 dark:text-[#FFB454] px-2 py-0.5 rounded border border-amber-200 dark:border-[#FFB454]/20 font-medium">
                Action needed
              </span>
            )
          }
        />

        <MetricCard
          title="Self-Reviews In"
          value={`${selfReviewsSubmittedCount} / ${teamSummaries.length}`}
          subtitle="Completed reflection forms"
          icon={<FileText className="w-4 h-4 text-[#8B7CFF]" />}
        />

        <MetricCard
          title="Manager Reviews"
          value={`${submittedReviewsCount} / ${teamSummaries.length}`}
          subtitle={`Due ${formatDate(activeCycle.deadlines.managerReviewDue)}`}
          icon={<CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#8B7CFF]" />}
          trend={{
            value: `${Math.round((submittedReviewsCount / (teamSummaries.length || 1)) * 100)}% complete`,
            neutral: true,
          }}
        />
      </div>

      {/* Direct Reports Appraisal Roster (Executive Aligned Table & Card Suite) */}
      <div className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs dark:shadow-md transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.08em] font-bold text-indigo-600 dark:text-[#8B7CFF]">
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
          <div className="py-16 text-center text-xs text-slate-400 font-mono">
            Loading team evaluation roster...
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-500 dark:text-[#8D96AA] font-mono bg-slate-50/50 dark:bg-white/[0.015] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
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
                <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-y border-slate-200/80 dark:border-white/[0.08] text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[11px] font-mono">
                  <th className="py-3 px-3 sm:px-4 font-semibold whitespace-nowrap">
                    Direct Report
                  </th>
                  <th className="py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">
                    Goal Plan
                  </th>
                  <th className="py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">
                    Self-Review
                  </th>
                  <th className="py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">
                    Manager Appraisal
                  </th>
                  <th className="py-3 px-2 sm:px-3 font-semibold whitespace-nowrap">
                    Appraisal Score
                  </th>
                  <th className="py-3 px-3 sm:px-4 font-semibold text-right whitespace-nowrap">
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
                      {/* Column 1: Direct Report Identity (Code Never Breaks) */}
                      <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={emp.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shrink-0"
                          />
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm tracking-tight transition-colors truncate">
                                {emp.name}
                              </span>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-white/10 shrink-0 whitespace-nowrap">
                                {emp.employeeCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[160px] sm:max-w-[200px]">
                              {emp.designation}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Goal Plan */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 dark:bg-white/[0.04] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10 font-mono text-[11px]">
                          <Target className="w-3.5 h-3.5 text-indigo-500 dark:text-[#8B7CFF] shrink-0" />
                          <span>
                            <strong className="text-slate-900 dark:text-white font-bold">{summary.goalsApprovedCount}/{summary.goalsCount}</strong> Approved
                          </span>
                        </div>
                      </td>

                      {/* Column 3: Self-Review Status */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        {isSrSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 dark:bg-indigo-500/10 dark:text-[#8B7CFF] dark:border-indigo-500/30">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Submitted</span>
                          </span>
                        ) : summary.selfReviewStatus === 'draft' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-[#FFB454] border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            <span>In Draft</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-100 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10">
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Column 4: Manager Appraisal Status */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        {isMrSubmitted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-700 dark:text-[#8B7CFF] border border-indigo-500/30">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Evaluated</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-[#FFB454] border border-amber-500/30">
                            <Clock className="w-3 h-3" />
                            <span>Needs Review</span>
                          </span>
                        )}
                      </td>

                      {/* Column 5: Performance Rating (Never Wraps) */}
                      <td className="py-3.5 px-2 sm:px-3 whitespace-nowrap">
                        {summary.compositeScore ? (
                          <RatingBadge score={summary.compositeScore} />
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500 italic">
                            Awaiting scoring
                          </span>
                        )}
                      </td>

                      {/* Column 6: Action */}
                      <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/manager/reviews/${emp.id}`)
                          }}
                          className={
                            isMrSubmitted
                              ? 'inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] hover:border-slate-300 dark:hover:border-white/20 transition-all text-xs font-mono font-semibold cursor-pointer shadow-2xs group/btn'
                              : 'premium-glow-btn h-8 px-3.5 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 shadow-xs'
                          }
                        >
                          {isMrSubmitted ? (
                            <FileCheck className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 group-hover/btn:text-indigo-600 transition-colors" />
                          ) : (
                            <FileEdit className="w-3.5 h-3.5" />
                          )}
                          <span>{isMrSubmitted ? 'View Evaluation' : 'Evaluate'}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Modern Card Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSummaries.map((summary) => {
              const emp = summary.employee
              const isSrSubmitted = summary.selfReviewStatus === 'submitted'
              const isMrSubmitted = summary.managerReviewStatus === 'submitted'

              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/manager/reviews/${emp.id}`)}
                  className="group relative rounded-2xl p-5 border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/20 transition-all duration-200 flex flex-col justify-between space-y-4 cursor-pointer shadow-2xs hover:shadow-md"
                >
                  {/* Top identity */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                        alt={emp.name}
                        className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm transition-colors">
                          {emp.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[160px]">
                          {emp.designation}
                        </div>
                      </div>
                    </div>

                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-white/10 shrink-0 whitespace-nowrap">
                      {emp.employeeCode}
                    </span>
                  </div>

                  {/* Badges Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
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
                      <span className={`font-bold text-[11px] mt-0.5 ${isSrSubmitted ? 'text-indigo-600 dark:text-[#8B7CFF]' : 'text-amber-600 dark:text-[#FFB454]'}`}>
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
    </div>
  )
}
