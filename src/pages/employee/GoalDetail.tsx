import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { goalService } from '../../services'
import { Goal } from '../../types'
import { GoalStatusBadge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/MetricCard'
import { formatDate } from '../../lib/formatters'
import { useToast } from '../../components/ui/Toast'
import { ConfirmDialog } from '../../components/ui/Modal'
import { ArrowLeft, Calendar, FileText, CheckCircle2, History, Eye, Trash2 } from 'lucide-react'
import { PdfViewerModal } from '../../components/ui/PdfViewerModal'

export const GoalDetail: React.FC = () => {
  const { goalId } = useParams<{ goalId: string }>()
  const navigate = useNavigate()
  const { success, error: toastError } = useToast()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [loading, setLoading] = useState(true)

  const [activePdfModal, setActivePdfModal] = useState<{
    isOpen: boolean
    fileName: string
    fileUrl?: string
    goalTitle?: string
  }>({
    isOpen: false,
    fileName: '',
    fileUrl: undefined,
    goalTitle: '',
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    updateId?: string
    fileName: string
    isDeleting: boolean
  }>({
    isOpen: false,
    updateId: undefined,
    fileName: '',
    isDeleting: false,
  })

  useEffect(() => {
    const fetchGoal = async () => {
      if (!goalId) return
      setLoading(true)
      const data = await goalService.getById(goalId)
      setGoal(data)
      setLoading(false)
    }
    fetchGoal()
  }, [goalId])

  const handleConfirmDelete = async () => {
    if (!goal) return
    setDeleteConfirm((prev) => ({ ...prev, isDeleting: true }))
    try {
      const updated = await goalService.removeEvidence(goal.id, deleteConfirm.updateId)
      setGoal(updated)
      success('Evidence removed', `Removed "${deleteConfirm.fileName}" from goal checkpoints.`)
      setDeleteConfirm({ isOpen: false, updateId: undefined, fileName: '', isDeleting: false })
      if (activePdfModal.fileName === deleteConfirm.fileName) {
        setActivePdfModal((prev) => ({ ...prev, isOpen: false }))
      }
    } catch (err: any) {
      toastError('Could not remove evidence', err.message || 'An error occurred.')
      setDeleteConfirm((prev) => ({ ...prev, isDeleting: false }))
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading goal details...</div>
  }

  if (!goal) {
    return (
      <div className="p-8 text-center space-y-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200">Goal not found</h2>
        <Link to="/employee/goals" className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold">
          Return to Goals list
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/employee/goals')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors cursor-pointer font-sans"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Goals</span>
        </button>
      </div>

      {/* Main Goal Card */}
      <div className="dark-glass-card conic-border-glow rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <GoalStatusBadge status={goal.status} />
            <span className="text-[11px] font-sans font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700/80">
              Weight: {goal.weight}%
            </span>
          </div>
          <div className="text-xs text-slate-700 dark:text-zinc-300 font-sans flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
            <span>Target Deadline: <strong className="text-slate-900 dark:text-white font-bold">{formatDate(goal.dueDate)}</strong></span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{goal.title}</h1>
          <p className="text-sm text-slate-800 dark:text-zinc-200 mt-2 leading-relaxed whitespace-pre-line">
            {goal.description || 'No extended description provided.'}
          </p>
        </div>

        {/* Metric and Target Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
            <span className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
              Measurable Metric
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">{goal.metric}</div>
          </div>
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
            <span className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
              Target Commitment
            </span>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1 font-sans">
              {goal.target} {goal.unit}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4">
            <span className="text-[11px] font-sans font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
              Current Progress
            </span>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-1 font-sans">
              {goal.progress}% Completed
            </div>
          </div>
        </div>

        <div className="pt-2">
          <ProgressBar value={goal.progress} size="lg" label="Overall Completion Bar" variant="indigo" />
        </div>

        {/* Latest Evidence Document Banner */}
        {goal.evidenceFileName && (
          <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <FileText className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider block font-semibold">Latest Uploaded Evidence</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white truncate block">{goal.evidenceFileName}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setActivePdfModal({
                    isOpen: true,
                    fileName: goal.evidenceFileName!,
                    fileUrl: goal.evidenceUrl,
                    goalTitle: goal.title,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-xs font-semibold text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 inline-flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Latest Evidence</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetLog = goal.progressHistory.find((p) => p.evidenceFileName === goal.evidenceFileName)
                  setDeleteConfirm({
                    isOpen: true,
                    updateId: targetLog?.id,
                    fileName: goal.evidenceFileName!,
                    isDeleting: false,
                  })
                }}
                className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 transition-all cursor-pointer shadow-2xs active:scale-95 inline-flex items-center gap-1.5"
                title="Remove this uploaded evidence file"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        )}

        {/* Returned Reason Notice */}
        {goal.status === 'returned' && goal.returnReason && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-sans">
            <div className="font-bold text-rose-700 dark:text-rose-300 mb-1">Manager Revision Feedback:</div>
            <p className="italic">{goal.returnReason}</p>
          </div>
        )}
      </div>

      {/* Progress History Log */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <History className="w-5 h-5 text-slate-700 dark:text-zinc-300" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-sans">
            Checkpoint & Evidence Log
          </h2>
        </div>

        {goal.progressHistory.length === 0 ? (
          <p className="text-xs text-slate-700 dark:text-zinc-300 py-6 text-center font-sans font-medium">
            No progress checkpoints recorded yet.
          </p>
        ) : (
          <div className="space-y-4">
            {goal.progressHistory.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-900 dark:text-white font-sans">
                      Progress updated to {log.percentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-600 dark:text-zinc-300 font-sans font-medium">
                    {formatDate(log.date)}
                  </span>
                </div>
                <p className="text-slate-800 dark:text-zinc-100 leading-relaxed pl-6 font-medium">{log.note}</p>
                {log.evidenceFileName && (
                  <div className="pl-6 pt-1 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setActivePdfModal({
                          isOpen: true,
                          fileName: log.evidenceFileName!,
                          fileUrl: log.evidenceUrl,
                          goalTitle: goal.title,
                        })
                      }
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 hover:border-indigo-400 text-xs font-semibold text-indigo-700 dark:text-[#B7B1FF] transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 group"
                      title="Click to view and review attached PDF"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-500" />
                      <span>Evidence: {log.evidenceFileName}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-normal underline ml-1 group-hover:font-semibold">
                        <Eye className="w-3 h-3" />
                        View PDF
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirm({
                          isOpen: true,
                          updateId: log.id,
                          fileName: log.evidenceFileName!,
                          isDeleting: false,
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-white/10 hover:border-rose-200 dark:hover:border-rose-900/60 transition-colors cursor-pointer"
                      title="Remove this attached evidence file"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      <span>Delete Evidence</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF Evidence Document Viewer Modal */}
      {goal && (
        <PdfViewerModal
          isOpen={activePdfModal.isOpen}
          onClose={() => setActivePdfModal((prev) => ({ ...prev, isOpen: false }))}
          fileName={activePdfModal.fileName}
          fileUrl={activePdfModal.fileUrl}
          goalTitle={activePdfModal.goalTitle}
          onDelete={() => {
            const targetLog = goal.progressHistory.find((p) => p.evidenceFileName === activePdfModal.fileName)
            setDeleteConfirm({
              isOpen: true,
              updateId: targetLog?.id,
              fileName: activePdfModal.fileName,
              isDeleting: false,
            })
          }}
        />
      )}

      {/* Confirmation Dialog for Evidence Deletion */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        title="Remove Uploaded Evidence?"
        message={`Are you sure you want to remove "${deleteConfirm.fileName}"? The checkpoint progress and note will be retained, but the attached evidence document will be permanently removed.`}
        confirmText="Remove Evidence"
        variant="danger"
        isLoading={deleteConfirm.isDeleting}
      />
    </div>
  )
}
