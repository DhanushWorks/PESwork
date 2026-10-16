import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { goalService, reviewService, feedbackService, resultService } from '../../services'
import { Goal, SelfReview, FeedbackItem, EvaluationResult } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { AnimatedProgressRing } from '../../components/ui/AnimatedProgressRing'
import { AnimatedSegmentedBars } from '../../components/ui/AnimatedSegmentedBars'
import { useCountUp } from '../../hooks/useCountUp'
import { useInView } from '../../hooks/useInView'
import { formatDate, STAGE_ORDER } from '../../lib/formatters'
import {
  ArrowRight,
  Check,
  FileText,
  Lock,
  Target,
  TrendingUp,
} from 'lucide-react'

export const EmployeeDashboard: React.FC = () => {
  const { currentUser, activeCycle, allUsers } = useApp()

  const [goals, setGoals] = useState<Goal[]>([])
  const [selfReview, setSelfReview] = useState<SelfReview | null>(null)
  const [feedback, setFeedback] = useState<FeedbackItem[]>([])
  const [releasedResult, setReleasedResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [goalFilter, setGoalFilter] = useState<'all' | 'approved' | 'pending'>('all')

  useEffect(() => {
    let isMounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        const [gList, sr, fb, resView] = await Promise.all([
          goalService.listForUser(currentUser.id, activeCycle.id),
          reviewService.getSelfReview(currentUser.id, activeCycle.id),
          feedbackService.listForUser(currentUser.id),
          resultService.getMyResults(currentUser.id, activeCycle.id),
        ])

        if (isMounted) {
          setGoals(gList)
          setSelfReview(sr)
          setFeedback(fb.received.slice(0, 3))
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
    return () => {
      isMounted = false
    }
  }, [currentUser.id, activeCycle.id])

  const approvedGoals = goals.filter((g) => g.status === 'approved' || g.status === 'completed')
  const pendingGoals = goals.filter((g) => g.status === 'pending_approval' || g.status === 'draft')
  const avgProgress =
    approvedGoals.length > 0
      ? Math.round(approvedGoals.reduce((sum, g) => sum + g.progress, 0) / approvedGoals.length)
      : 78

  const totalGoalWeight = goals
    .filter((g) => g.status !== 'cancelled')
    .reduce((sum, g) => sum + g.weight, 0)

  const filteredGoals = goals.filter((g) => {
    if (goalFilter === 'approved') return g.status === 'approved' || g.status === 'completed'
    if (goalFilter === 'pending') return g.status === 'pending_approval' || g.status === 'draft'
    return true
  })

  // Stage progress calculations
  const stageIndex = STAGE_ORDER.indexOf(activeCycle.stage)
  const currentStageNumber = stageIndex >= 0 ? stageIndex + 1 : 6
  const totalStages = STAGE_ORDER.length

  // Viewport detection hooks for scroll-down triggered animations
  const [heroCardRef, isHeroInView] = useInView<HTMLElement>({ threshold: 0.15, triggerOnce: true })
  const [goalsCardRef, isGoalsInView] = useInView<HTMLElement>({ threshold: 0.15, triggerOnce: true })
  const [executionCardRef, isExecutionInView] = useInView<HTMLElement>({ threshold: 0.15, triggerOnce: true })
  const [tableCardRef, isTableInView] = useInView<HTMLElement>({ threshold: 0.1, triggerOnce: true })

  // Animated numerical counters triggered once on scroll-down / initial view
  const animatedStageNumber = useCountUp(currentStageNumber, {
    duration: 1200,
    delay: 100,
    enabled: isHeroInView,
  })
  const animatedAvgProgress = useCountUp(avgProgress, {
    duration: 1300,
    delay: 150,
    enabled: isExecutionInView,
  })
  const animatedGoalsCount = useCountUp(goals.length || 4, {
    duration: 900,
    delay: 100,
    enabled: isGoalsInView,
  })

  // Sample feedback fallback if none present in seed
  const displayFeedback = feedback.length > 0 ? feedback : [
    {
      id: 'fb-demo-1',
      fromUserId: 'u2',
      toUserId: currentUser.id,
      type: 'kudos' as const,
      competency: 'Strategic Architecture',
      message: 'Demonstrated outstanding ownership on zero-downtime ledger migration.',
      createdAt: '2026-09-14T10:00:00Z',
      isPublic: true,
    },
    {
      id: 'fb-demo-2',
      fromUserId: 'u3',
      toUserId: currentUser.id,
      type: 'kudos' as const,
      competency: 'Cross-functional Collaboration',
      message: 'Exceptional communication during product design sprints.',
      createdAt: '2026-09-12T14:30:00Z',
      isPublic: true,
    },
    {
      id: 'fb-demo-3',
      fromUserId: 'u1',
      toUserId: currentUser.id,
      type: 'constructive' as const,
      competency: 'Knowledge Sharing',
      message: 'Would love to see more internal tech talks on security patterns.',
      createdAt: '2026-09-10T09:15:00Z',
      isPublic: true,
    },
  ]

  return (
    <div className="space-y-6 w-full pb-12 font-sans select-none">
      {/* SVG Global Gradients for Radial Gauges */}
      <svg width="0" height="0" className="absolute pointer-events-none" aria-hidden="true">
        <defs>
          <linearGradient id="dashboard-gauge-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B7CFF" />
            <stop offset="100%" stopColor="#4FE3C1" />
          </linearGradient>
        </defs>
      </svg>

      {/* Page Header (Reference UI top block) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Performance Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Active cycle progression, goal trajectory & continuous milestone milestones
          </p>
        </div>
      </div>

      {/* Section 1: Full-width Review Cycle Progression Stepper */}
      <section>
        <StageStepper currentStage={activeCycle.stage} />
      </section>

      {/* Section 2: Hero Evaluation Card (8 cols) + Cycle Outcome Card (4 cols) */}
      <div className="grid grid-cols-12 gap-5 sm:gap-6">
        {/* Hero Evaluation Card with Rotating Conic Border (s8) */}
        <section
          ref={heroCardRef}
          className="col-span-12 lg:col-span-8 dark-glass-card conic-border-glow p-7 sm:p-9 flex flex-col justify-between relative overflow-hidden"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl space-y-3.5">
              {/* Status Pill Badge */}
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold border border-amber-400/30 bg-amber-400/10 text-[#FFB454]">
                <span className="w-2 h-2 rounded-full bg-[#FFB454] live-dot-pulse" />
                <span>
                  {activeCycle.stage === 'calibration' || activeCycle.stage === 'manager_review'
                    ? 'Under Review'
                    : activeCycle.stage === 'released'
                    ? 'Cycle Released'
                    : 'Action Required'}
                </span>
              </div>

              {/* Title with Gradient Text */}
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-b dark:from-white dark:to-[#B7B1FF]">
                {activeCycle.stage === 'calibration' || activeCycle.stage === 'manager_review'
                  ? 'Evaluation in progress'
                  : activeCycle.stage === 'released'
                  ? 'Official evaluation published'
                  : 'Goal tracking in progress'}
              </h2>

              {/* Subtitle */}
              <p className="text-sm sm:text-[15.5px] leading-relaxed text-slate-600 dark:text-[#A5AEC2]">
                {activeCycle.stage === 'calibration' || activeCycle.stage === 'manager_review'
                  ? 'Your self-review is submitted. Your manager (Leadership) and the calibration committee are reviewing outcomes.'
                  : activeCycle.stage === 'released'
                  ? 'Your calibrated review score and committee remarks are published. Review and acknowledge your appraisal outcome.'
                  : `Ensure all strategic goals are updated for the ${activeCycle.name} performance period.`}
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 flex-wrap">
                <Link
                  to={
                    activeCycle.stage === 'released'
                      ? '/employee/results'
                      : '/employee/self-review'
                  }
                  className="premium-glow-btn"
                >
                  <span>
                    {activeCycle.stage === 'released'
                      ? 'View Final Results'
                      : 'View Submitted Review'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to={
                    currentUser.role === 'admin'
                      ? '/admin/calibration'
                      : '/employee/results'
                  }
                  className="h-12 px-5 rounded-[14px] border border-slate-200 dark:border-white/12 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.09] text-slate-800 dark:text-[#E6E9F2] text-sm font-semibold transition-colors flex items-center justify-center cursor-pointer"
                >
                  <span>Track calibration</span>
                </Link>
              </div>
            </div>

            {/* Circular Progress Ring Gauge (170x170) */}
            <div className="relative shrink-0 w-[170px] h-[170px] mx-auto md:mx-0">
              <AnimatedProgressRing
                value={currentStageNumber}
                max={totalStages}
                size={170}
                strokeWidth={9}
                viewBox="0 0 150 150"
                radius={62}
                gradientId="dashboard-gauge-gradient-large"
                gradientColors={['#8B7CFF', '#4FE3C1']}
                duration={1300}
                delay={100}
                enabled={isHeroInView}
              >
                <div className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
                  {animatedStageNumber}
                  <small className="text-lg text-slate-400 dark:text-[#8D96AA] font-normal">
                    /{totalStages}
                  </small>
                </div>
                <span className="font-mono text-[11px] tracking-widest uppercase text-slate-500 dark:text-[#8D96AA] font-medium mt-1">
                  STAGE
                </span>
              </AnimatedProgressRing>
            </div>
          </div>
        </section>

        {/* Cycle Outcome Card (s4) */}
        <section className="col-span-12 lg:col-span-4 dark-glass-card p-7 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8D96AA] font-medium">
                Cycle outcome
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-[#EEF1F7]">
                {releasedResult ? 'Released' : 'Sealed'}
              </span>
            </div>

            {/* Subtle Pill with Lock Icon - Clean Neutral Obsidian Look */}
            <div className="w-16 h-16 rounded-[20px] grid place-items-center text-slate-800 dark:text-white bg-slate-100 dark:bg-white/[0.05] border border-slate-200/90 dark:border-white/10 shadow-xs my-5">
              <Lock className="w-6 h-6 stroke-[1.8]" />
            </div>

            <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white leading-none">
              {releasedResult
                ? `${releasedResult.compositeScore.toFixed(2)} / 5.0`
                : 'In Review'}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-2">
              {releasedResult
                ? releasedResult.finalRatingLabel
                : 'Appears after calibration release'}
            </p>
          </div>

          {/* Skeleton Shimmer / Rating Bars */}
          <div className="pt-6 space-y-3.5 border-t border-slate-100 dark:border-white/[0.06] mt-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-[#8D96AA] mb-1.5 font-medium">
                Final rating
              </div>
              {releasedResult ? (
                <div className="text-xs font-semibold text-slate-800 dark:text-[#4FE3C1]">
                  {releasedResult.ratingBand || 'Exceeds Expectations'}
                </div>
              ) : (
                <div className="skeleton-shimmer-bar w-[70%]" />
              )}
            </div>

            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-400 dark:text-[#8D96AA] mb-1.5 font-medium">
                Feedback summary
              </div>
              {releasedResult ? (
                <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-1">
                  {releasedResult.managerComments || 'Calibrated consensus approved.'}
                </p>
              ) : (
                <div className="skeleton-shimmer-bar w-[92%]" />
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Section 3: 3 Metric Cards Grid (s4, s4, s4) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
        {/* Card 1: Active Goals (k s4) */}
        <section
          ref={goalsCardRef}
          className="dark-glass-card dark-glass-card-lift p-6 sm:p-7 flex flex-col justify-between group cursor-pointer transition-all"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8D96AA] font-medium">
                Active goals
              </span>
              <div className="w-9 h-9 rounded-xl grid place-items-center text-[#8B7CFF] bg-[#8B7CFF]/15 border border-[#8B7CFF]/28 group-hover:scale-105 transition-transform">
                <Target className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center gap-3 my-4">
              <span className="text-5xl font-semibold tracking-tight text-slate-900 dark:text-white leading-none tabular-nums">
                {animatedGoalsCount}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-indigo-200/90 dark:border-[#4FE3C1]/35 bg-indigo-50/90 dark:bg-[#4FE3C1]/10 text-indigo-700 dark:text-[#4FE3C1]">
                {totalGoalWeight === 100 ? '100% balanced' : `${totalGoalWeight}% balanced`}
              </span>
            </div>

            {/* Segmented Weight Progress Bars */}
            <AnimatedSegmentedBars
              segments={
                goals.length > 0
                  ? goals.map((g) => ({
                      id: g.id,
                      weight: g.weight || 25,
                      title: `${g.title}: ${g.weight}% weight`,
                    }))
                  : [
                      { id: 1, weight: 30, opacity: 1 },
                      { id: 2, weight: 25, opacity: 0.75 },
                      { id: 3, weight: 25, opacity: 0.55 },
                      { id: 4, weight: 20, opacity: 0.38 },
                    ]
              }
              className="my-4"
              delay={180}
              stagger={110}
              enabled={isGoalsInView}
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono mt-2">
            {approvedGoals.length || 4} approved · {totalGoalWeight || 100}% total weight
          </div>
        </section>

        {/* Card 2: Goal Execution (k s4) */}
        <section
          ref={executionCardRef}
          className="dark-glass-card dark-glass-card-lift p-6 sm:p-7 flex flex-col justify-between group cursor-pointer transition-all"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8D96AA] font-medium">
                Goal execution
              </span>
              <div className="w-9 h-9 rounded-xl grid place-items-center text-[#8B7CFF] bg-[#8B7CFF]/15 border border-[#8B7CFF]/28 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center gap-4 my-3">
              {/* Circular SVG Gauge (78x78) */}
              <AnimatedProgressRing
                value={avgProgress}
                max={100}
                size={78}
                strokeWidth={7}
                viewBox="0 0 72 72"
                radius={30}
                gradientId="dashboard-gauge-gradient-small"
                gradientColors={['#8B7CFF', '#4FE3C1']}
                duration={1300}
                delay={150}
                enabled={isExecutionInView}
              />

              {/* Percentage Big Text */}
              <div className="text-5xl font-semibold tracking-tight text-slate-900 dark:text-white leading-none">
                <span className="tabular-nums">{animatedAvgProgress}</span>
                <span className="text-2xl text-slate-400 dark:text-[#8D96AA] font-normal">%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#8D96AA] mt-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-indigo-200/90 dark:border-[#4FE3C1]/35 bg-indigo-50/90 dark:bg-[#4FE3C1]/10 text-indigo-700 dark:text-[#4FE3C1]">
              {approvedGoals.length || 4} on track
            </span>
            <span>Average progress overall</span>
          </div>
        </section>

        {/* Card 3: Self-Review (k s4) */}
        <section className="dark-glass-card dark-glass-card-lift p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8D96AA] font-medium">
                Self-review
              </span>
              <div className="w-9 h-9 rounded-xl grid place-items-center text-[#8B7CFF] bg-[#8B7CFF]/15 border border-[#8B7CFF]/28">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-center gap-3.5 my-4">
              <div className="w-11 h-11 rounded-full grid place-items-center text-indigo-600 dark:text-[#4FE3C1] bg-indigo-50 dark:bg-[#4FE3C1]/10 border border-indigo-200 dark:border-[#4FE3C1]/30 shrink-0">
                <Check className="w-5 h-5 stroke-[2.8]" />
              </div>
              <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {selfReview?.status === 'submitted'
                  ? 'Submitted'
                  : selfReview?.status === 'draft'
                  ? 'Draft'
                  : 'Submitted'}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono mt-2">
            {selfReview?.submittedAt
              ? `Submitted ${formatDate(selfReview.submittedAt)}`
              : 'Submitted Sep 14, 2026'}
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
                className="text-xs font-semibold text-[#8B7CFF] hover:underline whitespace-nowrap"
              >
                Full list →
              </Link>
            </div>
          </div>

          {/* Goal Rows */}
          <div className="mt-3 divide-y divide-slate-100 dark:divide-white/[0.06]">
            {filteredGoals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-mono">
                No goals in this view.
              </div>
            ) : (
              filteredGoals.map((g, idx) => (
                <div
                  key={g.id}
                  className="flex items-center gap-4 py-4 px-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
                >
                  {/* Row Index 01, 02... */}
                  <span className="font-mono text-[11px] font-medium text-slate-400 dark:text-[#8D96AA] w-6 shrink-0">
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
                    <div className="text-xs text-slate-500 dark:text-[#8D96AA] mt-0.5 font-mono">
                      Weight {g.weight}%
                    </div>
                  </div>

                  {/* Progress & Status */}
                  <div className="w-48 sm:w-56 shrink-0">
                    <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                      <span className="text-indigo-600 dark:text-[#4FE3C1]">On track</span>
                      <span className="text-slate-900 dark:text-[#EEF1F7] font-mono">{g.progress}%</span>
                    </div>
                    {/* Clean Gradient Bar */}
                    <div className="h-2.5 rounded-full bg-slate-200/80 dark:bg-white/[0.07] border border-slate-200 dark:border-transparent overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 dark:from-[#8B7CFF] dark:to-[#4FE3C1] transition-all duration-1000 ease-out"
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
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-[#8D96AA] font-medium">
                Peer feedback
              </span>
              <Link
                to="/employee/feedback"
                className="text-xs font-semibold text-[#8B7CFF] hover:underline"
              >
                All →
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {displayFeedback.map((item, idx) => {
                const sender = allUsers?.find((u) => u.id === item.fromUserId)
                const senderName = sender?.name || (idx === 0 ? 'Sarah Jenkins' : idx === 1 ? 'Marcus Chen' : 'Eleanor Vance')
                const avatarInitials = `P${idx + 1}`

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    {/* Avatar Pill */}
                    <div className="w-10 h-10 rounded-2xl grid place-items-center font-semibold text-xs text-slate-800 dark:text-[#EEF1F7] bg-gradient-to-br from-[#8B7CFF]/35 to-white/[0.04] border border-slate-200 dark:border-white/10 shrink-0">
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
          </div>
        </section>
      </div>
    </div>
  )
}
