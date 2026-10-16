import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { cycleService } from '../../services'
import { ReviewCycle } from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { CycleStageBadge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/Modal'
import { AvatarGroup } from '../../components/ui/AvatarGroup'
import { CYCLE_STAGE_DETAILS, STAGE_ORDER, formatDate } from '../../lib/formatters'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FastForward,
  Layers,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sliders,
} from 'lucide-react'

export const AdminCycleDetail: React.FC = () => {
  const { cycleId } = useParams<{ cycleId: string }>()
  const navigate = useNavigate()
  const { refreshData, activeCycle, allUsers } = useApp()
  const { success, error } = useToast()

  const [cycle, setCycle] = useState<ReviewCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)

  const fetchCycle = async () => {
    if (!cycleId) return
    setLoading(true)
    const data = await cycleService.getById(cycleId)
    setCycle(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchCycle()
  }, [cycleId])

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading cycle details...</div>
  }

  if (!cycle) {
    return (
      <div className="p-8 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200">Cycle not found</h2>
        <Link to="/admin/cycles" className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold">
          Return to Cycles list
        </Link>
      </div>
    )
  }

  const currentIndex = STAGE_ORDER.indexOf(cycle.stage)
  const isFinalStage = currentIndex >= STAGE_ORDER.length - 1
  const nextStage = !isFinalStage ? STAGE_ORDER[currentIndex + 1] : null
  const nextStageInfo = nextStage ? CYCLE_STAGE_DETAILS[nextStage] : null

  const handleAdvance = async () => {
    setIsAdvancing(true)
    try {
      const updated = await cycleService.advanceStage(cycle.id)
      setCycle(updated)
      setShowAdvanceConfirm(false)
      await refreshData()
      success(
        'Cycle stage advanced',
        `Cycle transitioned to "${CYCLE_STAGE_DETAILS[updated.stage].label}".`
      )
    } catch (err: any) {
      error('Cannot advance stage', err.message)
    } finally {
      setIsAdvancing(false)
    }
  }

  return (
    <div className="space-y-6 w-full pb-12 font-sans">
      {/* Back Button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/admin/cycles')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-[#8D96AA] dark:hover:text-[#F0F3FA] transition-colors cursor-pointer font-mono"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Review Cycles</span>
        </button>
      </div>

      {/* Main Cycle Card */}
      <div className="dark-glass-card conic-border-glow p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <CycleStageBadge stage={cycle.stage} />
              <span className="text-xs text-slate-400 dark:text-[#8D96AA] font-mono">
                Stage {currentIndex + 1} of {STAGE_ORDER.length}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{cycle.name}</h1>
          </div>

          {!isFinalStage ? (
            <button
              type="button"
              onClick={() => setShowAdvanceConfirm(true)}
              className="premium-glow-btn h-11 px-5 text-xs font-semibold self-start sm:self-auto flex-shrink-0 cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>Advance to {nextStageInfo?.label}</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 dark:text-[#8D96AA] font-mono font-semibold px-3 py-1.5 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.08]">
              Cycle Completed
            </span>
          )}
        </div>

        {/* Visual Stepper */}
        <StageStepper currentStage={cycle.stage} />

        {/* Stage Tasks & Timeline Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 space-y-3">
            <span className="font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-[#8D96AA] text-[10px]">
              Key Deadlines
            </span>
            <div className="space-y-2 text-slate-700 dark:text-zinc-300 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Goals Approval Due:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatDate(cycle.deadlines.goalsDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Self-Reviews Due:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatDate(cycle.deadlines.selfReviewDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Manager Evaluations Due:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatDate(cycle.deadlines.managerReviewDue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Calibration Committee:</span>
                <span className="font-semibold text-slate-900 dark:text-white">{formatDate(cycle.deadlines.calibrationDue)}</span>
              </div>
              <div className="flex justify-between text-slate-900 dark:text-white font-bold pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                <span className="text-indigo-700 dark:text-[#8B7CFF]">Results Release:</span>
                <span className="text-indigo-700 dark:text-[#4FE3C1]">{formatDate(cycle.deadlines.releaseDate)}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 space-y-3">
            <span className="font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-[#8D96AA] text-[10px]">
              Evaluation Formula Weights
            </span>
            <div className="space-y-2 text-slate-700 dark:text-zinc-300 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Strategic Performance Goals:</span>
                <span className="font-mono font-bold text-indigo-700 dark:text-[#4FE3C1]">{cycle.weights.goals}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Core Competencies:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-[#8B7CFF]">{cycle.weights.competencies}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-[#8D96AA]">Cultural Values:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-[#FFB454]">{cycle.weights.values}%</span>
              </div>
              <div className="flex justify-between text-indigo-600 dark:text-[#8B7CFF] font-bold pt-2 border-t border-slate-200 dark:border-white/[0.06]">
                <span>Total Formula Weight:</span>
                <span className="text-indigo-600 dark:text-[#4FE3C1]">100% (Balanced)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Enrolled Participant Cohort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-3.5">
            <AvatarGroup users={allUsers} max={7} size="md" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {allUsers.length} Enrolled Appraisal Participants
              </div>
              <div className="text-[11px] text-slate-500 dark:text-[#8D96AA]">
                Active evaluation cohort across Engineering, Product, and Leadership
              </div>
            </div>
          </div>
          <Link
            to="/admin/users"
            className="text-xs font-mono font-semibold text-[#8B7CFF] hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
          >
            Manage Cohort Directory →
          </Link>
        </div>

        {/* Stage-Specific Tasks Checklist */}
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Current Stage Operational Tasks: {CYCLE_STAGE_DETAILS[cycle.stage].label}
          </h3>
          <p className="text-xs text-slate-500 dark:text-[#8D96AA]">{CYCLE_STAGE_DETAILS[cycle.stage].description}</p>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.08] text-xs text-slate-700 dark:text-[#E6E9F2] space-y-2.5 font-mono">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>Verify participant cohort eligibility in People Directory</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
              <span>Monitor stage deadlines and send automated reminder prompts</span>
            </div>
            {cycle.stage === 'calibration' && (
              <div className="flex items-center gap-2.5 text-[#8B7CFF] font-semibold pt-1">
                <Sliders className="w-4 h-4" />
                <Link to="/admin/calibration" className="underline hover:text-white transition-colors">
                  Calibration Hub is active: click here to calibrate submitted scores →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advance Confirm Dialog */}
      <ConfirmDialog
        isOpen={showAdvanceConfirm}
        onClose={() => setShowAdvanceConfirm(false)}
        onConfirm={handleAdvance}
        title={`Advance Cycle to ${nextStageInfo?.label}?`}
        message={`This will transition the active review cycle from "${CYCLE_STAGE_DETAILS[cycle.stage].label}" to "${nextStageInfo?.label}". Participants will be notified of the new phase.`}
        confirmText="Confirm Stage Advance"
        variant="primary"
        isLoading={isAdvancing}
      />
    </div>
  )
}

