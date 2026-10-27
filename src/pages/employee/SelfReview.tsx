import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { reviewService } from '../../services'
import { SelfReview } from '../../types'
import { RatingInput } from '../../components/ui/RatingInput'
import { LoadingState } from '../../components/ui/LoadingState'
import { getRatingBand } from '../../lib/scoring'
import { ConfirmDialog } from '../../components/ui/Modal'
import { formatDateTime, formatDate } from '../../lib/formatters'
import { isUserCycleParticipant } from '../../lib/workflow'
import {
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Lock,
  Save,
  Send,
  AlertCircle,
} from 'lucide-react'

const COMPETENCIES = [
  { id: 'technical_mastery', title: 'Technical Mastery & Craft', desc: 'Deep domain expertise, code quality, software architecture, and standards.' },
  { id: 'execution_delivery', title: 'Execution & Reliability', desc: 'Punctual delivery of committed milestones, attention to edge cases, and resilience.' },
  { id: 'collaboration', title: 'Collaboration & Teamwork', desc: 'Partnering across disciplines, transparent communication, and empathy.' },
  { id: 'leadership_mentorship', title: 'Leadership & Guild Mentorship', desc: 'Elevating peers, sharing knowledge, and building sustainable team culture.' },
]

const VALUES = [
  { id: 'customer_obsession', title: 'Customer Obsession & Quality', desc: 'Prioritizing end-user experience, responsiveness, and performance.' },
  { id: 'ownership_integrity', title: 'Ownership & Integrity', desc: 'Taking full accountability for outcomes, admitting mistakes, and follow-through.' },
  { id: 'inclusivity_empathy', title: 'Inclusivity & Empathy', desc: 'Fostering an inclusive, psychologically safe, and accessible product and team.' },
]

export const EmployeeSelfReview: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const { success, error } = useToast()

  const [loading, setLoading] = useState(true)
  const [selfReview, setSelfReview] = useState<SelfReview | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string>('')

  // Form Fields
  const [overallRating, setOverallRating] = useState<number>(4.0)
  const [overallReflection, setOverallReflection] = useState<string>('')
  const [achievements, setAchievements] = useState<string>('')
  const [challenges, setChallenges] = useState<string>('')
  const [developmentNeeds, setDevelopmentNeeds] = useState<string>('')
  const [competencyRatings, setCompetencyRatings] = useState<Record<string, { rating: number; comment: string }>>({})
  const [valueRatings, setValueRatings] = useState<Record<string, { rating: number; comment: string }>>({})

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    const fetchSelfReview = async () => {
      setLoading(true)
      try {
        if (!currentUser?.id) {
          if (isMounted) setLoading(false)
          return
        }

        const data = await reviewService.getSelfReview(currentUser.id, activeCycle?.id || '')
        if (!isMounted) return

        if (data) {
          setSelfReview(data)
          setOverallRating(data.overallRating || 4.0)
          setOverallReflection(data.overallReflection || '')
          setAchievements(data.achievements || '')
          setChallenges(data.challenges || '')
          setDevelopmentNeeds(data.developmentNeeds || '')
          setCompetencyRatings(data.competencyRatings || {})
          setValueRatings(data.valueRatings || {})
          setSaveStatus(data.lastSavedAt ? `Saved at ${formatDateTime(data.lastSavedAt)}` : '')
        } else {
          // Defaults
          const compInit: Record<string, { rating: number; comment: string }> = {}
          COMPETENCIES.forEach((c) => {
            compInit[c.id] = { rating: 4.0, comment: '' }
          })
          const valInit: Record<string, { rating: number; comment: string }> = {}
          VALUES.forEach((v) => {
            valInit[v.id] = { rating: 4.0, comment: '' }
          })
          setCompetencyRatings(compInit)
          setValueRatings(valInit)
        }
      } catch (err) {
        console.warn('Error loading self-review:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
          clearTimeout(safetyTimer)
        }
      }
    }

    fetchSelfReview()

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [currentUser?.id, activeCycle?.id])

  const isEnrolledInCycle = isUserCycleParticipant(activeCycle, currentUser?.id)
  const isSubmitted = selfReview?.status === 'submitted'
  const isFormDisabled = isSubmitted || !isEnrolledInCycle

  const handleSaveDraft = async () => {
    if (!isEnrolledInCycle) {
      error('Enrollment Required', 'You must be assigned to an active review cycle by an Admin before saving self-evaluations.')
      return
    }
    try {
      const saved = await reviewService.saveSelfDraft({
        userId: currentUser.id,
        cycleId: activeCycle.id,
        overallRating,
        overallReflection,
        achievements,
        challenges,
        developmentNeeds,
        competencyRatings,
        valueRatings,
      })
      setSelfReview(saved)
      setSaveStatus(`Saved just now at ${new Date().toLocaleTimeString()}`)
      success('Draft saved', 'Your self-evaluation progress was saved to local browser storage.')
    } catch (err: any) {
      error('Draft save failed', err.message)
    }
  }

  const handleSubmit = async () => {
    if (!isEnrolledInCycle) {
      error('Enrollment Required', 'You must be assigned to an active review cycle by an Admin before submitting self-evaluations.')
      return
    }
    if (!overallReflection.trim() || !achievements.trim()) {
      error('Incomplete review', 'Please fill out your overall reflection and key achievements.')
      return
    }

    setIsSubmitting(true)
    try {
      const submitted = await reviewService.submitSelfReview({
        userId: currentUser.id,
        cycleId: activeCycle.id,
        overallRating,
        overallReflection,
        achievements,
        challenges,
        developmentNeeds,
        competencyRatings,
        valueRatings,
      })
      setSelfReview(submitted)
      setShowSubmitConfirm(false)
      success(
        'Self-review submitted!',
        'Your reflection has been formally recorded and shared with your manager.'
      )
    } catch (err: any) {
      error('Submission failed', err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState message="Loading self-review workspace..." variant="page" />
  }

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Top Action Bar */}
      <div className="flex items-center justify-end gap-3 pb-1">
        {saveStatus && (
          <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-sans hidden sm:inline font-medium">
            {saveStatus}
          </span>
        )}

        {isEnrolledInCycle && !isSubmitted && (
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
              <span>Submit Review</span>
            </button>
          </>
        )}
      </div>

      {/* Not Enrolled Warning Card */}
      {!isEnrolledInCycle && (
        <div className="p-5 rounded-2xl border border-amber-300/80 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-slate-900 dark:text-zinc-100 flex items-start gap-3.5 shadow-xs">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-[14px] text-amber-900 dark:text-amber-300">
              Self-Review Locked — Not Enrolled in Active Cycle
            </h3>
            <p className="text-slate-700 dark:text-zinc-300 text-xs leading-relaxed font-medium">
              Your employee account is currently not assigned to <strong>{activeCycle?.name || 'the active review cycle'}</strong>.
              Form fields are read-only. Performance evaluations and self-ratings will unlock once an Administrator assigns you to an evaluation cycle.
            </p>
          </div>
        </div>
      )}

      {/* Submitted Banner if locked */}
      {isSubmitted && (
        <div className="p-4 rounded-2xl dark-glass-card border border-indigo-200/90 dark:border-emerald-500/30 bg-indigo-50/50 dark:bg-transparent text-xs text-slate-900 dark:text-white flex items-start gap-3">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Submitted on {formatDate(selfReview.submittedAt)}</p>
            <p className="text-slate-700 dark:text-zinc-200 mt-0.5 font-medium">
              Locked and awaiting manager review.
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Overall Performance & Reflection */}
      <div className="dark-glass-card rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-slate-300 dark:border-zinc-700 flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Overall Reflection
          </h2>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-sans border transition-colors ${getRatingBand(overallRating).badgeClass}`}
          >
            {getRatingBand(overallRating).band} · {getRatingBand(overallRating).label}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-3">
            <RatingInput
              label="Self-Assessed Overall Performance Rating (1.0 to 5.0)"
              value={overallRating}
              onChange={setOverallRating}
              disabled={isFormDisabled}
              hideBadge={true}
            />
          </div>

          <div className="lg:col-span-7 space-y-2 text-xs">
            <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block">
              Executive Summary & Cycle Reflection *
            </label>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={overallReflection}
              onChange={(e) => setOverallReflection(e.target.value)}
              placeholder="Summarize your overall impact, key deliverables, and professional contributions across this evaluation period..."
              className="w-full p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 shadow-2xs leading-relaxed text-[13px] font-sans"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Core Competencies */}
      <div className="dark-glass-card rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-slate-300 dark:border-zinc-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Core Competencies
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {COMPETENCIES.map((comp) => {
            const current = competencyRatings[comp.id] || { rating: 4.0, comment: '' }
            return (
              <div
                key={comp.id}
                className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-white/[0.02] space-y-4 text-xs transition-colors shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{comp.title}</h3>
                  <p className="text-slate-700 dark:text-zinc-300 text-xs mt-1 leading-relaxed">{comp.desc}</p>
                </div>

                <div className="pt-1">
                  <RatingInput
                    value={current.rating}
                    onChange={(r) =>
                      setCompetencyRatings((prev) => ({
                        ...prev,
                        [comp.id]: { ...current, rating: r },
                      }))
                    }
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="pt-1">
                  <label className="text-[12px] font-bold text-slate-900 dark:text-zinc-100 block mb-1.5">
                    Examples & Evidence
                  </label>
                  <textarea
                    rows={3}
                    disabled={isFormDisabled}
                    value={current.comment}
                    onChange={(e) =>
                      setCompetencyRatings((prev) => ({
                        ...prev,
                        [comp.id]: { ...current, comment: e.target.value },
                      }))
                    }
                    placeholder={`Examples & evidence demonstrating ${comp.title}...`}
                    className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 shadow-2xs leading-relaxed text-[13px] font-sans"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Company Values */}
      <div className="dark-glass-card rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-slate-300 dark:border-zinc-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Cultural Values
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {VALUES.map((val) => {
            const current = valueRatings[val.id] || { rating: 4.0, comment: '' }
            return (
              <div
                key={val.id}
                className="p-5 sm:p-6 rounded-2xl border border-slate-300 dark:border-zinc-700 bg-slate-50/60 dark:bg-white/[0.02] space-y-4 text-xs transition-colors shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{val.title}</h3>
                  <p className="text-slate-700 dark:text-zinc-300 text-xs mt-1 leading-relaxed">{val.desc}</p>
                </div>

                <div className="pt-1">
                  <RatingInput
                    value={current.rating}
                    onChange={(r) =>
                      setValueRatings((prev) => ({
                        ...prev,
                        [val.id]: { ...current, rating: r },
                      }))
                    }
                    disabled={isFormDisabled}
                  />
                </div>

                <div className="pt-1">
                  <label className="text-[12px] font-bold text-slate-900 dark:text-zinc-100 block mb-1.5">
                    Demonstration & Impact
                  </label>
                  <textarea
                    rows={3}
                    disabled={isFormDisabled}
                    value={current.comment}
                    onChange={(e) =>
                      setValueRatings((prev) => ({
                        ...prev,
                        [val.id]: { ...current, comment: e.target.value },
                      }))
                    }
                    placeholder={`How you demonstrated ${val.title}...`}
                    className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 shadow-2xs leading-relaxed text-[13px] font-sans"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 4: Narrative Achievements, Challenges & Development */}
      <div className="dark-glass-card rounded-2xl p-4 sm:p-6 lg:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-slate-300 dark:border-zinc-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Growth & Goals
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
          <div>
            <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block mb-1.5">
              Top 3 Key Accomplishments *
            </label>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="List specific milestones, projects shipped, and positive impacts on the team or customer..."
              className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 shadow-2xs leading-relaxed text-[13px] font-sans"
            />
          </div>

          <div>
            <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block mb-1.5">
              Key Obstacles & How You Overcame Them
            </label>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              placeholder="What technical, organizational, or delivery hurdles did you face? How did you navigate them?"
              className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 shadow-2xs leading-relaxed text-[13px] font-sans"
            />
          </div>

          <div>
            <label className="font-bold text-[13px] text-slate-900 dark:text-zinc-100 block mb-1.5">
              Desired Development & Skill Growth in the Next Cycle
            </label>
            <textarea
              rows={4}
              disabled={isFormDisabled}
              value={developmentNeeds}
              onChange={(e) => setDevelopmentNeeds(e.target.value)}
              placeholder="What new competencies, leadership responsibilities, or technical capabilities do you want to cultivate?"
              className="w-full p-3.5 sm:p-4 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder:text-slate-500 dark:placeholder:text-zinc-500 disabled:bg-slate-100 dark:disabled:bg-zinc-900/90 disabled:text-slate-900 dark:disabled:text-zinc-100 disabled:border-slate-300 dark:disabled:border-zinc-700 shadow-2xs leading-relaxed text-[13px] font-sans"
            />
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmit}
        title="Submit Self-Review Formally?"
        message="Once submitted, your self-review cannot be edited and will be reviewed by your manager for formal appraisal."
        confirmText="Confirm & Submit Review"
        variant="primary"
        isLoading={isSubmitting}
      />
    </div>
  )
}
