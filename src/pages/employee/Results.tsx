import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { resultService } from '../../services'
import { EvaluationResult, ReviewCycle } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { RatingBadge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { formatDate, formatDateTime } from '../../lib/formatters'
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
  const { currentUser, activeCycle } = useApp()
  const { success, error } = useToast()

  const [loading, setLoading] = useState(true)
  const [isReleased, setIsReleased] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [history, setHistory] = useState<Array<{ cycle: ReviewCycle; result: EvaluationResult }>>([])

  // Acknowledge & Dispute state
  const [showAcknowledgeConfirm, setShowAcknowledgeConfirm] = useState(false)
  const [showDisputeModal, setShowDisputeModal] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchResults = async () => {
    setLoading(true)
    try {
      const resView = await resultService.getMyResults(currentUser.id, activeCycle.id)
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

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading evaluation results...</div>
  }

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Page Header (Matching Dashboard UI) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Performance Results
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Official appraisal release, composite rating breakdown & governance acknowledgement
          </p>
        </div>
      </div>

      {/* Cycle Stage Tracker */}
      <StageStepper currentStage={activeCycle.stage} />

      {/* UNRELEASED STATE: Calm pending view */}
      {!isReleased ? (
        <div className="dark-glass-card conic-border-glow rounded-2xl p-8 sm:p-12 text-center shadow-sm space-y-5">
          <div className="w-16 h-16 rounded-[20px] grid place-items-center text-slate-800 dark:text-white bg-slate-100 dark:bg-white/[0.05] border border-slate-200/90 dark:border-white/10 shadow-xs mx-auto">
            <Clock className="w-7 h-7 stroke-[1.8]" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-slate-900 dark:text-[#F0F3FA]">
              Your results will appear after release
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#8D96AA] leading-relaxed">
              The evaluation cycle is currently in the{' '}
              <strong className="text-slate-800 dark:text-[#F0F3FA] capitalize font-semibold">
                {activeCycle.stage.replace('_', ' ')}
              </strong>{' '}
              stage. People Managers and the People Operations Calibration Committee are finalizing
              ratings to ensure organizational parity.
            </p>
          </div>

          <div className="pt-4 max-w-lg mx-auto bg-slate-50 dark:bg-white/[0.03] rounded-xl p-4 border border-slate-200 dark:border-white/[0.08] text-left text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-[#F0F3FA]">
              <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
              <span>What happens next?</span>
            </div>
            <ul className="list-disc list-inside text-slate-600 dark:text-[#8D96AA] space-y-1 text-[11px] pl-1 font-mono">
              <li>Manager appraisals are normalized across departmental distributions.</li>
              <li>Official release is projected on <strong className="text-slate-800 dark:text-[#F0F3FA]">{formatDate(activeCycle.deadlines.releaseDate)}</strong>.</li>
              <li>You will receive an in-app notification immediately once results become visible.</li>
            </ul>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-[#8D96AA]/70 font-mono">
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border-indigo-200/90 dark:text-[#B7B1FF] dark:bg-[#8B7CFF]/15 dark:border-[#8B7CFF]/30 px-3 py-1 rounded-full border font-mono">
                  Official Released Rating
                </span>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-[#F0F3FA] tracking-tight mt-2">
                  {result?.finalRatingLabel}
                </h2>
                <p className="text-xs text-slate-500 dark:text-[#8D96AA] font-mono">
                  {result?.ratingBand} · Final Calibrated Performance
                </p>
              </div>

              <div className="text-left sm:text-right sm:border-l sm:border-slate-200 dark:sm:border-white/[0.08] sm:pl-6">
                <div className="text-4xl font-black text-indigo-600 dark:text-[#B7B1FF] tracking-tight font-mono">
                  {result?.compositeScore.toFixed(2)}{' '}
                  <span className="text-base font-normal text-slate-400 dark:text-[#8D96AA]">/ 5.0</span>
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#8D96AA] font-mono mt-0.5">
                  Weighted Composite Score
                </div>
              </div>
            </div>

            {/* 3 Component Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-[#C5CEE0]">Performance Goals</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-[#8D96AA] uppercase font-mono">Weight {activeCycle.weights.goals}%</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-[#F0F3FA] mt-2">
                  {result?.goalsScore.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400 dark:text-[#8D96AA]">/ 5.0</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-[#C5CEE0]">Core Competencies</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-[#8D96AA] uppercase font-mono">Weight {activeCycle.weights.competencies}%</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-[#F0F3FA] mt-2">
                  {result?.competenciesScore.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400 dark:text-[#8D96AA]">/ 5.0</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-[#C5CEE0]">Company Values</span>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-[#8D96AA] uppercase font-mono">Weight {activeCycle.weights.values}%</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-[#F0F3FA] mt-2">
                  {result?.valuesScore.toFixed(2)}{' '}
                  <span className="text-xs font-normal text-slate-400 dark:text-[#8D96AA]">/ 5.0</span>
                </div>
              </div>
            </div>

            {/* Manager Comments */}
            <div className="space-y-2 pt-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
                Manager & Calibration Committee Narrative
              </h3>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] text-xs text-slate-700 dark:text-[#C5CEE0] leading-relaxed whitespace-pre-line font-mono">
                {result?.managerComments}
              </div>
            </div>

            {/* Agreed Actions & Next Steps */}
            {result?.agreedActions && result.agreedActions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
                  Agreed Growth Focus & Next Steps
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-[#C5CEE0]">
                  {result.agreedActions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 bg-indigo-50/70 dark:bg-[#8B7CFF]/10 p-2.5 rounded-lg border border-indigo-200/80 dark:border-[#8B7CFF]/20">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#8B7CFF] flex-shrink-0 mt-0.5" />
                      <span className="text-slate-800 dark:text-[#E6E9F2] font-mono">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Acknowledged / Dispute Status & Action Bar */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs space-y-1">
                {result?.acknowledged ? (
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-[#B7B1FF] font-semibold font-mono">
                    <FileCheck className="w-4 h-4 text-indigo-600 dark:text-[#B7B1FF]" />
                    <span>Acknowledged on {formatDateTime(result.acknowledgedAt)}</span>
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-[#8D96AA] font-mono">
                    Acknowledgement confirms you have viewed this appraisal outcome.
                  </div>
                )}

                {result?.disputeStatus === 'disputed' && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium text-[11px] font-mono">
                    ⚠️ Formal inquiry submitted: "{result.disputeReason}"
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                {result?.disputeStatus !== 'disputed' && (
                  <button
                    type="button"
                    onClick={() => setShowDisputeModal(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[12px] border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-semibold transition-all cursor-pointer font-mono"
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
          <div className="p-4 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/[0.08] text-[11px] text-slate-500 dark:text-[#8D96AA] flex items-start gap-2.5">
            <Scale className="w-4 h-4 text-[#8B7CFF] flex-shrink-0 mt-0.5" />
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
            <History className="w-4 h-4 text-[#8B7CFF]" />
            <h3 className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
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
                  <div className="text-[11px] text-slate-500 dark:text-[#8D96AA] font-mono mt-0.5">
                    {formatDate(cycle.startDate)} to {formatDate(cycle.endDate)}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <RatingBadge score={histResult.compositeScore} />
                  <span className="font-mono font-bold text-slate-800 dark:text-[#F0F3FA] text-sm">
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
      >
        <form onSubmit={handleDispute} className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-[#8D96AA]">
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
              className="w-full p-3 rounded-lg border border-slate-300 dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-[#8B7CFF] bg-white dark:bg-[#18181b] text-slate-900 dark:text-[#F0F3FA]"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowDisputeModal(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-white/12 text-slate-600 dark:text-[#8D96AA] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors shadow-xs"
            >
              {isProcessing ? 'Submitting...' : 'Submit Inquiry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

