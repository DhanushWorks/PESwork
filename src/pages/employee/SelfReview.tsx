import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { reviewService } from '../../services'
import { SelfReview } from '../../types'
import { RatingInput } from '../../components/ui/RatingInput'
import { getRatingBand } from '../../lib/scoring'
import { ConfirmDialog } from '../../components/ui/Modal'
import { formatDateTime, formatDate } from '../../lib/formatters'
import {
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Lock,
  Save,
  Send,
  Sparkles,
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
    const fetchSelfReview = async () => {
      setLoading(true)
      const data = await reviewService.getSelfReview(currentUser.id, activeCycle.id)
      if (data) {
        setSelfReview(data)
        setOverallRating(data.overallRating || 4.0)
        setOverallReflection(data.overallReflection || '')
        setAchievements(data.achievements || '')
        setChallenges(data.challenges || '')
        setDevelopmentNeeds(data.developmentNeeds || '')
        setCompetencyRatings(data.competencyRatings || {})
        setValueRatings(data.valueRatings || {})
        setSaveStatus(`Saved at ${formatDateTime(data.lastSavedAt)}`)
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
      setLoading(false)
    }

    fetchSelfReview()
  }, [currentUser.id, activeCycle.id])

  const handleSaveDraft = async () => {
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

  const isSubmitted = selfReview?.status === 'submitted'

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading self-review...</div>
  }

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Performance Self-Review
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Self-appraisal draft, competency scoring & achievements portfolio for {activeCycle.name}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 shrink-0">
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
                <span>Submit Review</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Submitted Banner if locked */}
      {isSubmitted && (
        <div className="p-4 rounded-2xl dark-glass-card border border-indigo-200/90 dark:border-[#4FE3C1]/30 bg-indigo-50/50 dark:bg-transparent text-xs text-slate-900 dark:text-[#F0F3FA] flex items-start gap-3">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-[#4FE3C1] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">This self-evaluation was submitted on {formatDate(selfReview.submittedAt)}.</p>
            <p className="text-slate-500 dark:text-[#8D96AA] mt-0.5">
              Your submission is locked and visible to your manager for evaluation and calibration.
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Overall Performance & Reflection */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-[#e8edf5] dark:border-white/[0.08] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
            <h2 className="text-[15px] font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-[0.07em]">
              1. Overall Performance Reflection
            </h2>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold font-mono border transition-colors ${getRatingBand(overallRating).badgeClass}`}
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
              disabled={isSubmitted}
              hideBadge={true}
            />
          </div>

          <div className="lg:col-span-7 space-y-2 text-xs">
            <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block">
              Executive Summary & Cycle Reflection *
            </label>
            <textarea
              rows={4}
              disabled={isSubmitted}
              value={overallReflection}
              onChange={(e) => setOverallReflection(e.target.value)}
              placeholder="Summarize your overall impact, key deliverables, and professional contributions across this evaluation period..."
              className="w-full p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]/50 disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 shadow-2xs leading-relaxed text-[13px]"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Core Competencies */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-[#e8edf5] dark:border-white/[0.08]">
          <h2 className="text-[15px] font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-[0.07em]">
            2. Core Competency Self-Evaluation
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-1">
            Assess your capabilities against company engineering & product competency standards.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {COMPETENCIES.map((comp) => {
            const current = competencyRatings[comp.id] || { rating: 4.0, comment: '' }
            return (
              <div
                key={comp.id}
                className="p-5 sm:p-6 rounded-2xl border border-[#d6deea] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-white/[0.02] space-y-4 text-xs transition-colors shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-[#172033] dark:text-[#F0F3FA] text-sm">{comp.title}</h3>
                  <p className="text-slate-600 dark:text-[#8D96AA] text-xs mt-1 leading-relaxed">{comp.desc}</p>
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
                    disabled={isSubmitted}
                  />
                </div>

                <div className="pt-1">
                  <label className="text-[12px] font-semibold text-[#172033] dark:text-[#8D96AA] block mb-1.5">
                    Examples & Evidence
                  </label>
                  <textarea
                    rows={3}
                    disabled={isSubmitted}
                    value={current.comment}
                    onChange={(e) =>
                      setCompetencyRatings((prev) => ({
                        ...prev,
                        [comp.id]: { ...current, comment: e.target.value },
                      }))
                    }
                    placeholder={`Examples & evidence demonstrating ${comp.title}...`}
                    className="w-full p-3.5 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-white dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]/50 disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 shadow-2xs leading-relaxed text-[13px]"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 3: Company Values */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-[#e8edf5] dark:border-white/[0.08]">
          <h2 className="text-[15px] font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-[0.07em]">
            3. Cultural Values & Alignment
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#8D96AA] mt-1">
            How did you embody organizational principles and ethics during everyday execution?
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {VALUES.map((val) => {
            const current = valueRatings[val.id] || { rating: 4.0, comment: '' }
            return (
              <div
                key={val.id}
                className="p-5 sm:p-6 rounded-2xl border border-[#d6deea] dark:border-white/[0.08] bg-[#f8fafc] dark:bg-white/[0.02] space-y-4 text-xs transition-colors shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-[#172033] dark:text-[#F0F3FA] text-sm">{val.title}</h3>
                  <p className="text-slate-600 dark:text-[#8D96AA] text-xs mt-1 leading-relaxed">{val.desc}</p>
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
                    disabled={isSubmitted}
                  />
                </div>

                <div className="pt-1">
                  <label className="text-[12px] font-semibold text-[#172033] dark:text-[#8D96AA] block mb-1.5">
                    Demonstration & Impact
                  </label>
                  <textarea
                    rows={3}
                    disabled={isSubmitted}
                    value={current.comment}
                    onChange={(e) =>
                      setValueRatings((prev) => ({
                        ...prev,
                        [val.id]: { ...current, comment: e.target.value },
                      }))
                    }
                    placeholder={`How you demonstrated ${val.title}...`}
                    className="w-full p-3.5 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-white dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]/50 disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 shadow-2xs leading-relaxed text-[13px]"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Section 4: Narrative Achievements, Challenges & Development */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20">
        <div className="pb-4 border-b border-[#e8edf5] dark:border-white/[0.08]">
          <h2 className="text-[15px] font-bold text-[#172033] dark:text-[#F0F3FA] uppercase tracking-[0.07em]">
            4. Achievements, Challenges & Growth Goals
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
          <div>
            <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block mb-1.5">
              Top 3 Key Accomplishments *
            </label>
            <textarea
              rows={4}
              disabled={isSubmitted}
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="List specific milestones, projects shipped, and positive impacts on the team or customer..."
              className="w-full p-3.5 sm:p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]/50 disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 shadow-2xs leading-relaxed text-[13px]"
            />
          </div>

          <div>
            <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block mb-1.5">
              Key Obstacles & How You Overcame Them
            </label>
            <textarea
              rows={4}
              disabled={isSubmitted}
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              placeholder="What technical, organizational, or delivery hurdles did you face? How did you navigate them?"
              className="w-full p-3.5 sm:p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]/50 disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 shadow-2xs leading-relaxed text-[13px]"
            />
          </div>

          <div>
            <label className="font-semibold text-[13px] text-[#172033] dark:text-[#8D96AA] block mb-1.5">
              Desired Development & Skill Growth in the Next Cycle
            </label>
            <textarea
              rows={4}
              disabled={isSubmitted}
              value={developmentNeeds}
              onChange={(e) => setDevelopmentNeeds(e.target.value)}
              placeholder="What new competencies, leadership responsibilities, or technical capabilities do you want to cultivate?"
              className="w-full p-3.5 sm:p-4 rounded-xl border border-[#c5d2e3] dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#7560ee] bg-[#f8fafc] dark:bg-[#18181b] text-slate-800 dark:text-[#F0F3FA] placeholder:text-slate-400 dark:placeholder:text-[#8D96AA]/50 disabled:bg-slate-100 dark:disabled:bg-white/[0.02] disabled:text-slate-500 shadow-2xs leading-relaxed text-[13px]"
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

