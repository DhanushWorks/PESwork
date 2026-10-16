import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import {
  peopleService,
  goalService,
  reviewService,
  feedbackService,
} from '../../services'
import { Goal, ManagerReview, SelfReview, User, FeedbackItem } from '../../types'
import { RatingInput } from '../../components/ui/RatingInput'
import { ScorePreviewCard } from '../../components/ui/ScorePreviewCard'
import { ProgressBar } from '../../components/ui/MetricCard'
import { GoalStatusBadge, RatingBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { formatDate, formatDateTime } from '../../lib/formatters'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  FileCheck,
  FileText,
  Lock,
  MessageSquareHeart,
  Save,
  Send,
  Sparkles,
  Target,
  UserCheck,
} from 'lucide-react'

export const ManagerReviewWorkspace: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>()
  const navigate = useNavigate()
  const { currentUser, activeCycle } = useApp()
  const { success, error } = useToast()

  const [employee, setEmployee] = useState<User | null>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [selfReview, setSelfReview] = useState<SelfReview | null>(null)
  const [peerFeedback, setPeerFeedback] = useState<FeedbackItem[]>([])
  const [existingReview, setExistingReview] = useState<ManagerReview | null>(null)
  const [loading, setLoading] = useState(true)

  // Scoring Inputs
  const [goalsScore, setGoalsScore] = useState<number>(4.0)
  const [competenciesScore, setCompetenciesScore] = useState<number>(4.0)
  const [valuesScore, setValuesScore] = useState<number>(4.0)
  const [overallComments, setOverallComments] = useState<string>('')
  const [strengths, setStrengths] = useState<string>('')
  const [growthAreas, setGrowthAreas] = useState<string>('')
  const [recommendations, setRecommendations] = useState({
    promotion: false,
    increment: true,
    bonus: true,
    training: false,
    notes: '',
  })

  // Submit and Save State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('')

  useEffect(() => {
    const fetchData = async () => {
      if (!employeeId) return
      setLoading(true)
      try {
        const [emp, gList, sr, mr, fb] = await Promise.all([
          peopleService.getById(employeeId),
          goalService.listForUser(employeeId, activeCycle.id),
          reviewService.getSelfReview(employeeId, activeCycle.id),
          reviewService.getManagerReview(employeeId, activeCycle.id),
          feedbackService.listForUser(employeeId),
        ])

        setEmployee(emp)
        setGoals(gList)
        setSelfReview(sr)
        setPeerFeedback(fb.received)

        if (mr) {
          setExistingReview(mr)
          setGoalsScore(mr.goalsScore)
          setCompetenciesScore(mr.competenciesScore)
          setValuesScore(mr.valuesScore)
          setOverallComments(mr.overallComments || '')
          setStrengths(mr.strengths || '')
          setGrowthAreas(mr.growthAreas || '')
          setRecommendations(mr.recommendations || {
            promotion: false,
            increment: true,
            bonus: true,
            training: false,
            notes: '',
          })
          setSaveStatus(`Saved at ${formatDateTime(mr.lastSavedAt)}`)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [employeeId, activeCycle.id])

  const handleSaveDraft = async () => {
    if (!employeeId) return
    try {
      const saved = await reviewService.saveManagerDraft({
        employeeId,
        managerId: currentUser.id,
        cycleId: activeCycle.id,
        goalsScore,
        competenciesScore,
        valuesScore,
        overallComments,
        strengths,
        growthAreas,
        recommendations,
      })
      setExistingReview(saved)
      setSaveStatus(`Saved just now at ${new Date().toLocaleTimeString()}`)
      success('Draft saved', 'Your evaluation notes and live scores have been preserved.')
    } catch (err: any) {
      error('Draft save failed', err.message)
    }
  }

  const handleSubmit = async () => {
    if (!employeeId) return
    if (!overallComments.trim() || !strengths.trim()) {
      error('Incomplete review', 'Please provide narrative remarks and key strengths before submitting.')
      return
    }

    setIsSubmitting(true)
    try {
      const submitted = await reviewService.submitManagerReview({
        employeeId,
        managerId: currentUser.id,
        cycleId: activeCycle.id,
        goalsScore,
        competenciesScore,
        valuesScore,
        overallComments,
        strengths,
        growthAreas,
        recommendations,
      })
      setExistingReview(submitted)
      setShowSubmitConfirm(false)
      success(
        'Manager evaluation submitted',
        `Appraisal for ${employee?.name} was locked and queued for calibration committee.`
      )
    } catch (err: any) {
      error('Submission failed', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSubmitted = existingReview?.status === 'submitted'

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading review workspace...</div>
  }

  if (!employee) {
    return (
      <div className="p-8 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-800">Employee not found</h2>
        <Link to="/manager" className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold">
          Return to Manager Dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Back and Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/manager')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-[#8D96AA] dark:hover:text-[#F0F3FA] transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Team Roster</span>
          </button>

          <div className="flex items-center gap-3">
            <img
              src={employee.avatar}
              alt={employee.name}
              className="w-12 h-12 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {employee.name}
                </h1>
                {isSubmitted ? (
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border-indigo-200/90 dark:text-[#B7B1FF] dark:bg-[#8B7CFF]/15 px-2.5 py-0.5 rounded-full border dark:border-[#8B7CFF]/30 flex items-center gap-1 font-mono">
                    <FileCheck className="w-3.5 h-3.5" /> Evaluation Submitted
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border-amber-200 dark:text-[#FFB454] dark:bg-[#FFB454]/10 px-2.5 py-0.5 rounded-full border dark:border-[#FFB454]/20 font-mono">
                    Draft in Progress
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8D96AA] mt-0.5">
                {employee.designation} · {employee.department} · {activeCycle.name}
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] font-mono hidden sm:inline">
              {saveStatus}
            </span>
          )}

          {!isSubmitted && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[14px] border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-500 dark:text-[#8D96AA]" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="premium-glow-btn h-11 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Submit Evaluation</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isSubmitted && (
        <div className="p-4 rounded-2xl dark-glass-card border border-indigo-200/90 dark:border-[#4FE3C1]/30 bg-indigo-50/50 dark:bg-transparent text-xs text-slate-900 dark:text-[#F0F3FA] flex items-start gap-3">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-[#4FE3C1] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Review formally submitted on {formatDate(existingReview.submittedAt)} (Score:{' '}
              {existingReview.compositeScore.toFixed(2)}).
            </p>
            <p className="text-slate-500 dark:text-[#8D96AA] mt-0.5">
              This appraisal is locked. It is now queued for the People Ops Calibration committee.
            </p>
          </div>
        </div>
      )}

      {/* 2-Column Desktop Layout / Stacked Mobile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: EVIDENCE & CONTEXT */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#e8edf5] dark:border-white/[0.06]">
            <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-[#8D96AA]">
              Evidence & Employee Reflection
            </h2>
          </div>

          {/* Goals & Logged Progress */}
          <div className="dark-glass-card rounded-2xl p-5 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8edf5] dark:border-white/[0.06]">
              <span className="text-xs font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#8B7CFF]" />
                Approved Goals ({goals.length})
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] font-mono">Weight: {activeCycle.weights.goals}%</span>
            </div>

            <div className="space-y-4 divide-y divide-[#e8edf5] dark:divide-white/[0.06]">
              {goals.map((g) => (
                <div key={g.id} className="pt-3 first:pt-0 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-[#172033] dark:text-[#F0F3FA]">{g.title}</div>
                    <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-[#8B7CFF] dark:bg-[#8B7CFF]/10 px-2 py-0.5 rounded border dark:border-[#8B7CFF]/20 flex-shrink-0">
                      {g.weight}% wt
                    </span>
                  </div>
                  <ProgressBar
                    value={g.progress}
                    label={`Metric: ${g.metric} (${g.current}/${g.target} ${g.unit})`}
                    size="sm"
                    variant={g.progress >= 90 ? 'indigo' : 'blue'}
                  />
                  {g.progressHistory.length > 0 && (
                    <div className="text-[11px] text-[#52637c] dark:text-[#8D96AA] bg-[#f8fafc] dark:bg-white/[0.03] p-3 rounded-xl border border-[#c5d2e3] dark:border-white/[0.08] space-y-1">
                      <div className="font-semibold text-[#172033] dark:text-[#F0F3FA]">Latest progress note:</div>
                      <p className="italic">"{g.progressHistory[0].note}"</p>
                      {g.progressHistory[0].evidenceFileName && (
                        <div className="text-[10px] text-indigo-700 dark:text-[#B7B1FF] font-semibold font-mono">
                          📄 {g.progressHistory[0].evidenceFileName}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Self-Review Answers */}
          <div className="dark-glass-card rounded-2xl p-5 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8edf5] dark:border-white/[0.06]">
              <span className="text-xs font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Submitted Self-Review
              </span>
              {selfReview ? (
                <RatingBadge score={selfReview.overallRating} />
              ) : (
                <span className="text-[11px] text-[#FFB454] font-mono">Not Submitted</span>
              )}
            </div>

            {selfReview ? (
              <div className="space-y-3.5 text-xs text-slate-700 dark:text-[#E6E9F2]">
                <div>
                  <span className="font-bold text-[#172033] dark:text-[#F0F3FA] block mb-0.5">Overall Reflection</span>
                  <p className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-white/[0.03] border border-[#c5d2e3] dark:border-white/[0.08] text-[#52637c] dark:text-[#8D96AA] leading-relaxed italic">
                    "{selfReview.overallReflection}"
                  </p>
                </div>

                <div>
                  <span className="font-bold text-[#172033] dark:text-[#F0F3FA] block mb-0.5">Top Accomplishments</span>
                  <p className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-white/[0.03] border border-[#c5d2e3] dark:border-white/[0.08] text-[#52637c] dark:text-[#8D96AA] leading-relaxed whitespace-pre-line">
                    {selfReview.achievements}
                  </p>
                </div>

                {selfReview.challenges && (
                  <div>
                    <span className="font-bold text-[#172033] dark:text-[#F0F3FA] block mb-0.5">Challenges Overcome</span>
                    <p className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-white/[0.03] border border-[#c5d2e3] dark:border-white/[0.08] text-[#52637c] dark:text-[#8D96AA] leading-relaxed">
                      {selfReview.challenges}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-[#8D96AA] py-3 text-center font-mono">
                Employee has not yet submitted their self-review reflection.
              </p>
            )}
          </div>

          {/* Peer Feedback / Aggregate (with >= 3 privacy rule) */}
          <div className="dark-glass-card rounded-2xl p-5 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-[#e8edf5] dark:border-white/[0.06]">
              <span className="text-xs font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareHeart className="w-4 h-4 text-rose-500" />
                Peer Feedback Aggregate
              </span>
              <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] font-mono">
                {peerFeedback.length} responses
              </span>
            </div>

            {peerFeedback.length >= 3 ? (
              <div className="space-y-3 text-xs">
                {peerFeedback.map((fb) => (
                  <div key={fb.id} className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-white/[0.03] border border-[#c5d2e3] dark:border-white/[0.08] space-y-1">
                    <span className="font-semibold text-[#172033] dark:text-[#F0F3FA] text-[11px]">
                      {fb.competency} · {fb.type === 'kudos' ? '🌟 Kudos' : '💡 Coaching'}
                    </span>
                    <p className="italic text-[#52637c] dark:text-[#8D96AA] leading-snug">"{fb.message}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-[#f8fafc] dark:bg-white/[0.03] border border-[#c5d2e3] dark:border-white/[0.08] rounded-xl text-xs text-[#52637c] dark:text-[#8D96AA]">
                <p className="font-semibold text-[#172033] dark:text-[#F0F3FA]">Peer Anonymity Threshold:</p>
                <p className="text-[11px] mt-0.5 text-[#52637c] dark:text-[#8D96AA]">
                  A minimum of 3 peer reviews is required before aggregated comments are visible to protect colleague anonymity (Current: {peerFeedback.length} response{peerFeedback.length === 1 ? '' : 's'}).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FORMAL APPRAISAL & LIVE SCORING */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-[#e8edf5] dark:border-white/[0.06]">
            <Award className="w-4 h-4 text-[#8B7CFF]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#172033] dark:text-[#8D96AA]">
              Manager Appraisal & Scoring
            </h2>
          </div>

          {/* Live Score Preview Card */}
          <ScorePreviewCard
            goalsScore={goalsScore}
            competenciesScore={competenciesScore}
            valuesScore={valuesScore}
            weights={activeCycle.weights}
          />

          {/* Evaluation Form Card */}
          <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <h3 className="text-[13px] font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-[0.07em] pb-3 border-b border-[#e8edf5] dark:border-white/[0.06]">
              Component Ratings (1.0 to 5.0)
            </h3>

            {/* 1. Goals Score */}
            <div>
              <RatingInput
                id="goalsScore"
                label={`1. Goal Attainment Score (${activeCycle.weights.goals}% Weight)`}
                value={goalsScore}
                onChange={setGoalsScore}
                disabled={isSubmitted}
              />
            </div>

            {/* 2. Competencies Score */}
            <div>
              <RatingInput
                id="compScore"
                label={`2. Core Competencies Score (${activeCycle.weights.competencies}% Weight)`}
                value={competenciesScore}
                onChange={setCompetenciesScore}
                disabled={isSubmitted}
              />
            </div>

            {/* 3. Values Score */}
            <div>
              <RatingInput
                id="valScore"
                label={`3. Values & Cultural Alignment (${activeCycle.weights.values}% Weight)`}
                value={valuesScore}
                onChange={setValuesScore}
                disabled={isSubmitted}
              />
            </div>

            {/* Narrative Comments */}
            <div className="pt-4 border-t border-[#e8edf5] dark:border-white/[0.06] space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block mb-1.5">
                  Overall Manager Summary & Narrative *
                </label>
                <textarea
                  rows={4}
                  required
                  disabled={isSubmitted}
                  value={overallComments}
                  onChange={(e) => setOverallComments(e.target.value)}
                  placeholder="Detail overall performance context, delivery impact, and leadership contributions..."
                  className="w-full p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 dark:disabled:text-[#8D96AA] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] text-[13px] leading-relaxed shadow-2xs"
                />
              </div>

              <div>
                <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block mb-1.5">Key Strengths Demonstrated *</label>
                <textarea
                  rows={2}
                  required
                  disabled={isSubmitted}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="What does this employee excel at? Where are they a role model?"
                  className="w-full p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 dark:disabled:text-[#8D96AA] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] text-[13px] leading-relaxed shadow-2xs"
                />
              </div>

              <div>
                <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block mb-1.5">
                  Development Opportunities & Growth Areas
                </label>
                <textarea
                  rows={2}
                  disabled={isSubmitted}
                  value={growthAreas}
                  onChange={(e) => setGrowthAreas(e.target.value)}
                  placeholder="Constructive advice on where they should stretch in the next cycle..."
                  className="w-full p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 dark:disabled:text-[#8D96AA] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] text-[13px] leading-relaxed shadow-2xs"
                />
              </div>
            </div>

            {/* Recommendations Checkboxes */}
            <div className="pt-4 border-t border-[#e8edf5] dark:border-white/[0.06] space-y-3 text-xs">
              <span className="font-bold text-[#172033] dark:text-[#F0F3FA] block uppercase tracking-[0.07em] text-[11px]">
                Compensation & Growth Recommendations
              </span>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-[#d6deea] dark:border-white/10 bg-[#f8fafc] dark:bg-transparent cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-white/[0.04] transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    disabled={isSubmitted}
                    checked={recommendations.promotion}
                    onChange={(e) =>
                      setRecommendations((prev) => ({ ...prev, promotion: e.target.checked }))
                    }
                    className="rounded text-[#7560ee] focus:ring-[#7560ee]"
                  />
                  <span className="font-medium text-slate-800 dark:text-[#E6E9F2]">Recommend Promotion</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-[#d6deea] dark:border-white/10 bg-[#f8fafc] dark:bg-transparent cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-white/[0.04] transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    disabled={isSubmitted}
                    checked={recommendations.increment}
                    onChange={(e) =>
                      setRecommendations((prev) => ({ ...prev, increment: e.target.checked }))
                    }
                    className="rounded text-[#7560ee] focus:ring-[#7560ee]"
                  />
                  <span className="font-medium text-slate-800 dark:text-[#E6E9F2]">Merit Salary Increment</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-[#d6deea] dark:border-white/10 bg-[#f8fafc] dark:bg-transparent cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-white/[0.04] transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    disabled={isSubmitted}
                    checked={recommendations.bonus}
                    onChange={(e) =>
                      setRecommendations((prev) => ({ ...prev, bonus: e.target.checked }))
                    }
                    className="rounded text-[#7560ee] focus:ring-[#7560ee]"
                  />
                  <span className="font-medium text-slate-800 dark:text-[#E6E9F2]">Performance Bonus</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-[#d6deea] dark:border-white/10 bg-[#f8fafc] dark:bg-transparent cursor-pointer hover:bg-[#f1f5f9] dark:hover:bg-white/[0.04] transition-colors shadow-2xs">
                  <input
                    type="checkbox"
                    disabled={isSubmitted}
                    checked={recommendations.training}
                    onChange={(e) =>
                      setRecommendations((prev) => ({ ...prev, training: e.target.checked }))
                    }
                    className="rounded text-[#7560ee] focus:ring-[#7560ee]"
                  />
                  <span className="font-medium text-slate-800 dark:text-[#E6E9F2]">Targeted Leadership Course</span>
                </label>
              </div>

              <div>
                <input
                  type="text"
                  disabled={isSubmitted}
                  value={recommendations.notes}
                  onChange={(e) =>
                    setRecommendations((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Optional confidential notes on compensation or leveling..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 text-[13px] focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-[#f8fafc] dark:bg-[#18181b] text-slate-900 dark:text-[#F0F3FA] shadow-2xs"
                />
              </div>
            </div>

            {/* Bottom Actions */}
            {!isSubmitted && (
              <div className="pt-4 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[14px] border border-slate-200 dark:border-white/12 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-[#E6E9F2] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
                >
                  Submit Formal Review
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmit}
        title="Submit Manager Evaluation Formally?"
        message={`Are you sure you want to submit your evaluation for ${employee.name}? The calculated composite score is ${((goalsScore * activeCycle.weights.goals + competenciesScore * activeCycle.weights.competencies + valuesScore * activeCycle.weights.values) / 100).toFixed(2)}. Once submitted, it will be locked and sent to calibration.`}
        confirmText="Confirm & Submit Review"
        variant="primary"
        isLoading={isSubmitting}
      />
    </div>
  )
}

