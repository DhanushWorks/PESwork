import React, { useEffect, useState, useMemo } from 'react'
import { matchesCycle, isUserCycleParticipant } from '../../lib/workflow'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { resultService, reviewService } from '../../services'
import { EvaluationResult, ReviewCycle, ManagerReview, SelfReview, CycleStage } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { RatingBadge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatDate, formatDateTime, STAGE_ORDER } from '../../lib/formatters'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  History,
  ShieldCheck,
  Sparkles,
  FileCheck,
  Scale,
} from 'lucide-react'

export const EmployeeResults: React.FC = () => {
  const { currentUser, activeCycle, allCycles } = useApp()
  const currentCycle = useMemo(() => {
    return allCycles.find((c) => c.id === activeCycle.id || matchesCycle(c.id, activeCycle.id)) || activeCycle
  }, [allCycles, activeCycle])
  const { success, error } = useToast()

  const [loading, setLoading] = useState(true)
  const [isReleased, setIsReleased] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [history, setHistory] = useState<Array<{ cycle: ReviewCycle; result: EvaluationResult }>>([])
  const [managerReview, setManagerReview] = useState<ManagerReview | null>(null)
  const [selfReview, setSelfReview] = useState<SelfReview | null>(null)

  // Acknowledge & Dispute state
  const [showAcknowledgeConfirm, setShowAcknowledgeConfirm] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchResults = async () => {
    setLoading(true)
    try {
      const [resView, mr, sr] = await Promise.all([
        resultService.getMyResults(currentUser.id, activeCycle.id),
        reviewService.getManagerReview(currentUser.id, activeCycle.id),
        reviewService.getSelfReview(currentUser.id, activeCycle.id),
      ])
      setManagerReview(mr)
      setSelfReview(sr)
      if (resView && resView.isReleased) {
        setIsReleased(true)
        setResult(resView.result)
      } else {
        setIsReleased(false)
        setResult(null)
      }

      const hist = await resultService.getHistoricalResults(currentUser.id)
      setHistory(hist.filter((h) => h.cycle.id !== activeCycle.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [currentUser.id, activeCycle.id, activeCycle.stage])

  const handleAcknowledge = async () => {
    if (!result) return
    setIsProcessing(true)
    try {
      const updated = await resultService.acknowledge(result.id)
      setResult(updated)
      setShowAcknowledgeConfirm(false)
      success(
        'Result acknowledged',
        'Your formal receipt has been recorded. This confirms you have reviewed the evaluation.'
      )
    } catch (err: any) {
      error('Acknowledgement failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDispute = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!result) return
    if (!disputeReason.trim() || disputeReason.trim().length < 10) {
      error('Reason required', 'Please provide an explicit rationale for your review inquiry (at least 10 characters).')
      return
    }

    setIsProcessing(true)
    try {
      const updated = await resultService.dispute(result.id, disputeReason)
      setResult(updated)
      setShowDisputeModal(false)
      setDisputeReason('')
      success(
        'Inquiry submitted to People Operations',
        'Your inquiry was submitted to People Ops and your manager for formal reconsideration.'
      )
    } catch (err: any) {
      error('Dispute submission failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const isManagerReviewSubmitted = managerReview?.status === 'submitted'
  const isSelfReviewSubmitted = selfReview?.status === 'submitted'
  const isEnrolledInCycle = isUserCycleParticipant(currentCycle, currentUser.id)

  const effectiveStage: CycleStage = (() => {
    if (currentCycle.stage === 'closed' || activeCycle.stage === 'closed') return 'closed'
    // Evaluation results advance to 'released' if Admin granted permission or cycle is released:
    if (isReleased || currentCycle.stage === 'released' || activeCycle.stage === 'released') {
      return 'released'
    }
    // If manager submitted evaluation, it remains strictly in 'calibration' until Admin grants permission:
    if (isManagerReviewSubmitted) {
      return 'calibration'
    }
    if (isSelfReviewSubmitted || selfReview) {
      return 'manager_review'
    }
    const cycleStageIdx = STAGE_ORDER.indexOf(activeCycle.stage)
    const selfReviewIdx = STAGE_ORDER.indexOf('self_review')
    if (cycleStageIdx >= selfReviewIdx) {
      return 'self_review'
    }
    return activeCycle.stage
  })()

  if (loading) {
    return <LoadingState message="Loading evaluation results..." variant="page" />
  }

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Cycle Stage Tracker */}
      {!isEnrolledInCycle ? (
        <div className="dark-glass-card rounded-2xl p-6 sm:p-7 shadow-sm border border-slate-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    No Review Cycle Assigned
                  </h2>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    Fresh Employee Account
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  You are not enrolled in <strong>{currentCycle.name}</strong>. Appraisal history and outcome reports will generate when an Administrator assigns you to a cycle.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <StageStepper currentStage={effectiveStage} cycle={currentCycle} />
      )}

      {/* UNRELEASED STATE: Calm pending view */}
      {!isEnrolledInCycle ? (
        <div className="dark-glass-card rounded-2xl p-8 sm:p-12 text-center shadow-sm space-y-4 border border-slate-200/90 dark:border-white/10">
          <div className="w-16 h-16 rounded-[20px] grid place-items-center text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.05] border border-slate-200/90 dark:border-white/10 shadow-xs mx-auto">
            <Award className="w-7 h-7 stroke-[1.8]" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              No Appraisal Outcomes Available
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed font-sans">
              Evaluation results, calibrated rating bands, and performance summaries will appear here once an Administrator assigns your profile to a review cycle and formal assessments are submitted.
            </p>
          </div>
        </div>
      ) : !isReleased ? (
        <div className="dark-glass-card conic-border-glow rounded-2xl p-8 sm:p-12 text-center shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-[20px] grid place-items-center text-slate-800 dark:text-white bg-slate-100 dark:bg-white/[0.05] border border-slate-200/90 dark:border-white/10 shadow-xs mx-auto">
            <Clock className="w-7 h-7 stroke-[1.8]" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-[#F0F3FA]">
              Your results will appear after release
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-300 leading-relaxed">
              The evaluation cycle is currently in the{' '}
              <strong className="text-slate-800 dark:text-[#F0F3FA] capitalize font-semibold">
                {effectiveStage.replace('_', ' ')}
              </strong>{' '}
              stage. People Managers and the People Operations Calibration Committee are finalizing
              ratings to ensure organizational parity.
            </p>
          </div>

          <div className="pt-4 max-w-lg mx-auto bg-slate-50 dark:bg-white/[0.03] rounded-xl p-4 border border-slate-200 dark:border-white/[0.08] text-left text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-[#F0F3FA]">
              <Sparkles className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
              <span>What happens next?</span>
            </div>
            <ul className="list-disc list-inside text-slate-600 dark:text-zinc-300 space-y-1 text-[11px] pl-1 font-sans">
              <li>Manager appraisals are normalized across departmental distributions.</li>
              <li>Official release is projected on <strong className="text-slate-800 dark:text-[#F0F3FA]">{formatDate(activeCycle.deadlines.releaseDate)}</strong>.</li>
              <li>You will receive an in-app notification immediately once results become visible.</li>
            </ul>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-zinc-300/70 font-sans">
            Preview tip: You can switch to the <strong className="text-slate-600 dark:text-[#C5CEE0]">Admin (Eleanor Vance)</strong> role to advance the cycle or simulate result release.
          </div>
        </div>
      ) : (
        /* RELEASED STATE: Full Score Breakdown */
        <div className="space-y-6">
          {/* Main Result Card */}
          <div className="dark-glass-card conic-border-glow rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/[0.08]">
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white bg-slate-900 border-transparent dark:text-slate-900 dark:bg-white px-3 py-1 rounded-full border font-sans">
                  Official Released Rating
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-[#F0F3FA] tracking-tight mt-2">
                  {result?.finalRatingLabel}
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-300 font-sans">
                  {result?.ratingBand} · Final Calibrated Performance
                </p>
              </div>

              <div className="text-left sm:text-right sm:border-l sm:border-slate-200 dark:sm:border-white/[0.08] sm:pl-6">
                <div className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-sans">
                  {result?.compositeScore.toFixed(2)}{' '}
                  <span className="text-base font-normal text-slate-400 dark:text-zinc-300">/ 5.0</span>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-300 font-sans mt-0.5">
                  Weighted Composite Score
                </div>
              </div>
            </div>

            {/* 3 Component Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-[#C5CEE0]">Performance Goals</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-300 uppercase font-sans">Weight {activeCycle.weights.goals}%</span>
                </div>
                <div className="text-xl font-bold font-sans text-slate-900 dark:text-[#F0F3FA] mt-2">
                  {result?.goalsScore.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400 dark:text-zinc-300">/ 5.0</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-[#C5CEE0]">Core Competencies</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-300 uppercase font-sans">Weight {activeCycle.weights.competencies}%</span>
                </div>
                <div className="text-xl font-bold font-sans text-slate-900 dark:text-[#F0F3FA] mt-2">
                  {result?.competenciesScore.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400 dark:text-zinc-300">/ 5.0</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-[#C5CEE0]">Company Values</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-300 uppercase font-sans">Weight {activeCycle.weights.values}%</span>
                </div>
                <div className="text-xl font-bold font-sans text-slate-900 dark:text-[#F0F3FA] mt-2">
                  {result?.valuesScore.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400 dark:text-zinc-300">/ 5.0</span>
                </div>
              </div>
            </div>

            {/* Manager Comments */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
                Manager & Calibration Committee Narrative
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-700 dark:text-[#C5CEE0] leading-relaxed whitespace-pre-line font-sans">
                {result?.managerComments}
              </div>
            </div>

            {/* Agreed Actions & Next Steps */}
            {result?.agreedActions && result.agreedActions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
                  Agreed Growth Focus & Next Steps
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-[#C5CEE0]">
                  {result.agreedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 bg-slate-50 dark:bg-white/[0.04] p-2.5 rounded-lg border border-slate-200 dark:border-white/10">
                      <CheckCircle2 className="w-4 h-4 text-slate-700 dark:text-zinc-300 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-800 dark:text-[#E6E9F2] font-sans">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Acknowledged / Dispute Status & Action Bar */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs space-y-1">
                {result?.acknowledged ? (
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold font-sans">
                    <FileCheck className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                    <span>Acknowledged on {formatDateTime(result.acknowledgedAt)}</span>
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-zinc-300 font-sans">
                    Acknowledgement confirms you have viewed this appraisal outcome.
                  </div>
                )}

                {result?.disputeStatus === 'disputed' && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium text-[11px] font-sans">
                    ⚠️ Formal inquiry submitted: "{result.disputeReason}"
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {result?.disputeStatus !== 'disputed' && (
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[12px] border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-all cursor-pointer font-sans"
                  >
                    Submit Inquiry / Dispute
                  </button>
                )}

                {!result?.acknowledged && (
                  <button
                    type="button"
                    onClick={() => setShowAcknowledgeConfirm(true)}
                    className="premium-glow-btn h-9 px-4 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Acknowledge Result</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Acknowledgement Explainer Note */}
          <div className="p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.08] text-[11px] text-slate-500 dark:text-zinc-300 flex items-start gap-2.5">
            <Scale className="w-4 h-4 text-slate-500 dark:text-zinc-400 flex-shrink-0 mt-0.5" />
            <p>
              Note: Formal acknowledgement indicates that you have received and discussed this performance evaluation outcome with your manager. It does not preclude you from submitting inquiries to People Operations.
            </p>
          </div>
        </div>
      )}

      {/* Historical Cycles Section */}
      {history.length > 0 && (
        <div className="dark-glass-card rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-white/[0.08]">
            <History className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
              Previous Cycle Evaluation History
            </h3>
          </div>

          <div className="space-y-3">
            {history.map(({ cycle, result: histResult }) => (
              <div
                key={cycle.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-[#F0F3FA]">{cycle.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-zinc-300 font-sans mt-0.5">
                    {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <RatingBadge score={histResult.compositeScore} />
                  <span className="font-sans font-bold text-slate-800 dark:text-[#F0F3FA] text-sm">
                    {histResult.compositeScore.toFixed(2)} / 5.0
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledge Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showAcknowledgeConfirm}
        onClose={() => setShowAcknowledgeConfirm(false)}
        onConfirm={handleAcknowledge}
        title="Acknowledge Evaluation Results"
        message="By acknowledging, you confirm you have reviewed the evaluation ratings and feedback with your manager. Your timestamp will be logged on your employee record."
        confirmText="Confirm Acknowledgement"
        variant="primary"
        isLoading={isProcessing}
      />

      {/* Dispute Modal */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Submit Evaluation Inquiry or Dispute"
        subtitle="Inquiries are submitted confidentially to People Operations leadership"
        maxWidth="md"
        onSubmit={handleDispute}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowDisputeModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-xs cursor-pointer text-xs disabled:opacity-60"
            >
              {isProcessing ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
            If you believe your evaluation ratings or component calculations do not reflect your delivered accomplishments, please provide a detailed explanation.
          </p>

          <div>
            <label className="font-semibold text-slate-700 dark:text-[#C5CEE0] block mb-1">
              Rationale & Clarification Request *
            </label>
            <textarea
              rows={4}
              required
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Detail specific evidence, misaligned goal metrics, or feedback points to be reviewed..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-slate-400/30 dark:focus:ring-zinc-600/30 focus:border-slate-400 dark:focus:border-zinc-500 bg-white dark:bg-[#18181b] text-slate-900 dark:text-[#F0F3FA] font-sans text-xs"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

