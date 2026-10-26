import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import {
  peopleService,
  goalService,
  reviewService,
  feedbackService,
  storageService,
} from '../../services'
import { Goal, ManagerReview, SelfReview, User, FeedbackItem } from '../../types'
import { RatingInput } from '../../components/ui/RatingInput'
import { ScorePreviewCard } from '../../components/ui/ScorePreviewCard'
import { ProgressBar } from '../../components/ui/MetricCard'
import { GoalStatusBadge, RatingBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatDate, formatDateTime } from '../../lib/formatters'
import { matchesUser } from '../../lib/workflow'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Eye,
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
import { PdfViewerModal } from '../../components/ui/PdfViewerModal'

export const ManagerReviewWorkspace: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>()
  const navigate = useNavigate()
  const { currentUser, activeCycle, allUsers, refreshData } = useApp()
  const { success, error } = useToast()

  const [employee, setEmployee] = useState<User | null>(null)

  // Dynamically resolve live employee record to prevent stale profile details
  const liveEmployee = useMemo(() => {
    if (!employee) return null
    const matched = allUsers.find((u) => u.id === employee.id || matchesUser(u.id, employee.id))
    return matched ? { ...employee, ...matched } : employee
  }, [employee, allUsers])
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

  // Evidence PDF Viewer Modal State
  const [activePdfModal, setActivePdfModal] = useState<{
    isOpen: boolean
    fileName: string
    fileUrl?: string
    goalTitle?: string
    authorName?: string
  }>({
    isOpen: false,
    fileName: '',
    fileUrl: undefined,
    goalTitle: '',
    authorName: '',
  })

  useEffect(() => {
    const fetchData = async () => {
      if (!employeeId) {
        setLoading(false)
        return
      }
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
      await refreshData()
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
  const appState = storageService.getState()
  const calRecord = appState.calibrations?.find(
    (c) => c.employeeId === employeeId && c.cycleId === activeCycle.id
  )
  const evalResult = appState.results?.find(
    (r) => r.employeeId === employeeId && r.cycleId === activeCycle.id
  )
  const isReleased = Boolean(evalResult || calRecord?.adminApproved)
  const officialScore = evalResult?.compositeScore ?? calRecord?.adjustedScore ?? existingReview?.compositeScore

  if (loading) {
    return <LoadingState message="Loading review workspace..." variant="page" />
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Team Roster</span>
          </button>

          <div className="flex items-center gap-3">
            <img
              src={liveEmployee?.avatar || employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
              alt={liveEmployee?.name || employee.name}
              className="w-12 h-12 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20 shadow-sm"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  {liveEmployee?.name || employee.name}
                </h1>
                {isReleased ? (
                  <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border dark:border-emerald-800/50 flex items-center gap-1 font-sans">
                    <CheckCircle2 className="w-3.5 h-3.5 text-current" /> Official Results Released
                  </span>
                ) : isSubmitted ? (
                  <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border-indigo-200/90 dark:text-[#B7B1FF] dark:bg-[#8B7CFF]/15 px-2.5 py-0.5 rounded-full border dark:border-[#8B7CFF]/30 flex items-center gap-1 font-sans">
                    <FileCheck className="w-3.5 h-3.5" /> Evaluation Submitted
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border-amber-200 dark:text-[#FFB454] dark:bg-[#FFB454]/10 px-2.5 py-0.5 rounded-full border dark:border-[#FFB454]/20 font-sans">
                    Draft in Progress
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-200 mt-0.5 font-medium">
                {employee.designation} · {employee.department} · {activeCycle.name}
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-3">
          {saveStatus && (
            <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-sans hidden sm:inline font-medium">
              {saveStatus}
            </span>
          )}

          {!isSubmitted && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-zinc-900/90 text-slate-800 dark:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-semibold shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-300" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(true)}
                className="h-8.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all border border-transparent"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Submit Evaluation</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isReleased && existingReview ? (
        <div className="p-4 rounded-2xl dark-glass-card border border-emerald-200/90 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-slate-900 dark:text-[#F0F3FA] flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-emerald-900 dark:text-emerald-300">
              Admin Permission Granted & Results Released ({officialScore?.toFixed(2)} – {evalResult?.finalRatingLabel || 'Official Calibrated Rating'})
            </p>
            <p className="text-slate-700 dark:text-zinc-200 font-medium">
              This appraisal has been calibrated, officially approved by Admin, and published across Employee, Manager, and Admin dashboards.
            </p>
            {calRecord?.reason && (
              <p className="text-slate-600 dark:text-zinc-400 text-[11px] italic pt-1 border-t border-emerald-200/60 dark:border-white/10">
                Committee Note: "{calRecord.reason}"
              </p>
            )}
          </div>
        </div>
      ) : isSubmitted ? (
        <div className="p-4 rounded-2xl dark-glass-card border border-indigo-200/90 dark:border-[#4FE3C1]/30 bg-indigo-50/50 dark:bg-transparent text-xs text-slate-900 dark:text-[#F0F3FA] flex items-start gap-3">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-[#4FE3C1] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Review formally submitted on {formatDate(existingReview.submittedAt)} (Score:{' '}
              {existingReview.compositeScore.toFixed(2)}).
            </p>
            <p className="text-slate-700 dark:text-zinc-200 mt-0.5 font-medium">
              This appraisal is locked. It is now queued for the People Ops Calibration committee.
            </p>
          </div>
        </div>
      ) : null}

      {/* 2-Column Desktop Layout / Stacked Mobile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: EVIDENCE & CONTEXT */}
        <div className="lg:col-span-5 space-y-6">
          <div className="pb-2 border-b border-slate-300 dark:border-zinc-700">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
              Evidence & Employee Reflection
            </h2>
          </div>

          {/* Goals & Logged Progress */}
          <div className="dark-glass-card rounded-2xl p-5 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-zinc-700">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Approved Goals ({goals.length})
              </span>
              <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-sans font-medium">Weight: {activeCycle.weights.goals}%</span>
            </div>

            <div className="space-y-4 divide-y divide-slate-300 dark:divide-zinc-700">
              {goals.map((g) => (
                <div key={g.id} className="pt-3 first:pt-0 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{g.title}</div>
                    <span className="text-[11px] font-sans text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/40 px-2 py-0.5 rounded border dark:border-indigo-800/40 flex-shrink-0">
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
                    <div className="text-[11px] text-slate-800 dark:text-zinc-200 bg-slate-50 dark:bg-white/[0.04] p-3 rounded-xl border border-slate-300 dark:border-white/10 space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">Latest progress note:</div>
                      <p className="italic">"{g.progressHistory[0].note}"</p>
                      {(() => {
                        const targetEvidence = g.progressHistory.find((p) => p.evidenceFileName) || (g.evidenceFileName ? { evidenceFileName: g.evidenceFileName, evidenceUrl: g.evidenceUrl, evidenceFileSize: g.evidenceFileSize } : null)
                        if (!targetEvidence?.evidenceFileName) return null
                        return (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                setActivePdfModal({
                                  isOpen: true,
                                  fileName: targetEvidence.evidenceFileName!,
                                  fileUrl: targetEvidence.evidenceUrl,
                                  goalTitle: g.title,
                                  authorName: employee?.name || 'Deepak',
                                })
                              }
                              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-indigo-200 dark:border-indigo-500/30 hover:border-indigo-500 dark:hover:border-indigo-400 hover:shadow-md transition-all group cursor-pointer text-left active:scale-[0.99] mt-1"
                              title="Touch or click to open and review PDF document"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400 font-sans font-bold text-[10px] shadow-2xs group-hover:scale-105 transition-transform">
                                  PDF
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate flex items-center gap-1.5 transition-colors">
                                    <span>{targetEvidence.evidenceFileName}</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 font-sans">
                                      Verified
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-2 mt-0.5">
                                    <span>{targetEvidence.evidenceFileSize || '1.4 MB'}</span>
                                    <span>•</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">Click to review PDF document</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0 pl-2">
                                <Eye className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Review PDF</span>
                              </div>
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Self-Review Answers */}
          <div className="dark-glass-card rounded-2xl p-5 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-zinc-700">
              <span className="text-xs font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Submitted Self-Review
              </span>
              {selfReview ? (
                <RatingBadge score={selfReview.overallRating} />
              ) : (
                <span className="text-[11px] text-[#FFB454] font-sans">Not Submitted</span>
              )}
            </div>

            {selfReview ? (
              <div className="space-y-3.5 text-xs text-slate-800 dark:text-zinc-100">
                <div>
                  <span className="font-bold text-slate-900 dark:text-zinc-100 block mb-0.5">Overall Reflection</span>
                  <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 text-slate-800 dark:text-zinc-100 leading-relaxed italic">
                    "{selfReview.overallReflection}"
                  </p>
                </div>

                <div>
                  <span className="font-bold text-slate-900 dark:text-zinc-100 block mb-0.5">Top Accomplishments</span>
                  <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 text-slate-800 dark:text-zinc-100 leading-relaxed whitespace-pre-line">
                    {selfReview.achievements}
                  </p>
                </div>

                {selfReview.challenges && (
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100 block mb-0.5">Challenges Overcome</span>
                    <p className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 text-slate-800 dark:text-zinc-100 leading-relaxed">
                      {selfReview.challenges}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-zinc-300 py-3 text-center font-sans font-medium">
                Employee has not yet submitted their self-review reflection.
              </p>
            )}
          </div>

          {/* Peer Feedback / Aggregate (with >= 3 privacy rule) */}
          <div className="dark-glass-card rounded-2xl p-5 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-300 dark:border-zinc-700">
              <span className="text-xs font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquareHeart className="w-4 h-4 text-rose-500" />
                Peer Feedback Aggregate
              </span>
              <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-sans font-medium">
                {peerFeedback.length} responses
              </span>
            </div>

            {peerFeedback.length >= 3 ? (
              <div className="space-y-3 text-xs">
                {peerFeedback.map((fb) => (
                  <div key={fb.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 space-y-1">
                    <span className="font-semibold text-slate-900 dark:text-zinc-100 text-[11px]">
                      {fb.competency} · {fb.type === 'kudos' ? '🌟 Kudos' : '💡 Coaching'}
                    </span>
                    <p className="italic text-slate-800 dark:text-zinc-200 leading-snug">"{fb.message}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 rounded-xl text-xs text-slate-800 dark:text-zinc-200">
                <p className="font-bold text-slate-900 dark:text-white">Peer Anonymity Threshold:</p>
                <p className="text-[11px] mt-0.5 text-slate-700 dark:text-zinc-300">
                  A minimum of 3 peer reviews is required before aggregated comments are visible to protect colleague anonymity (Current: {peerFeedback.length} response{peerFeedback.length === 1 ? '' : 's'}).
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: FORMAL APPRAISAL & LIVE SCORING */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-300 dark:border-zinc-700">
            <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
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
            <h3 className="text-[13px] font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-[0.07em] pb-3 border-b border-slate-300 dark:border-zinc-700">
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
            <div className="pt-4 border-t border-slate-300 dark:border-zinc-700 space-y-4 text-xs">
              <div>
                <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block mb-1.5">
                  Overall Manager Summary & Narrative *
                </label>
                <textarea
                  rows={4}
                  required
                  disabled={isSubmitted}
                  value={overallComments}
                  onChange={(e) => setOverallComments(e.target.value)}
                  placeholder="Detail overall performance context, delivery impact, and leadership contributions..."
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 text-[13px] leading-relaxed shadow-2xs font-sans"
                />
              </div>

              <div>
                <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block mb-1.5">Key Strengths Demonstrated *</label>
                <textarea
                  rows={2}
                  required
                  disabled={isSubmitted}
                  value={strengths}
                  onChange={(e) => setStrengths(e.target.value)}
                  placeholder="What does this employee excel at? Where are they a role model?"
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 text-[13px] leading-relaxed shadow-2xs font-sans"
                />
              </div>

              <div>
                <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block mb-1.5">
                  Development Opportunities & Growth Areas
                </label>
                <textarea
                  rows={2}
                  disabled={isSubmitted}
                  value={growthAreas}
                  onChange={(e) => setGrowthAreas(e.target.value)}
                  placeholder="Constructive advice on where they should stretch in the next cycle..."
                  className="w-full p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 text-[13px] leading-relaxed shadow-2xs font-sans"
                />
              </div>
            </div>

            {/* Recommendations Checkboxes */}
            <div className="pt-4 border-t border-slate-300 dark:border-zinc-700 space-y-3 text-xs">
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

      {/* PDF Evidence Document Viewer Modal */}
      <PdfViewerModal
        isOpen={activePdfModal.isOpen}
        onClose={() => setActivePdfModal((prev) => ({ ...prev, isOpen: false }))}
        fileName={activePdfModal.fileName}
        fileUrl={activePdfModal.fileUrl}
        goalTitle={activePdfModal.goalTitle}
        authorName={activePdfModal.authorName}
      />
    </div>
  )
}

