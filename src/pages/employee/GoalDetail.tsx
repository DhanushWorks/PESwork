import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { goalService } from '../../services'
import { Goal } from '../../types'
import { GoalStatusBadge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/MetricCard'
import { formatDate } from '../../lib/formatters'
import { ArrowLeft, Calendar, FileText, CheckCircle2, History } from 'lucide-react'

export const GoalDetail: React.FC = () => {
  const { goalId } = useParams<{ goalId: string }>()
  const navigate = useNavigate()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [loading, setLoading] = useState(true)

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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-[#8D96AA] dark:hover:text-[#F0F3FA] transition-colors cursor-pointer font-mono"
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
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700/80">
              Weight: {goal.weight}%
            </span>
          </div>
          <div className="text-xs text-slate-400 dark:text-[#8D96AA] font-mono flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#8B7CFF]" />
            <span>Target Deadline: <strong className="text-slate-700 dark:text-[#F0F3FA]">{formatDate(goal.dueDate)}</strong></span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{goal.title}</h1>
          <p className="text-sm text-slate-600 dark:text-[#8D96AA] mt-2 leading-relaxed whitespace-pre-line">
            {goal.description || 'No extended description provided.'}
          </p>
        </div>

        {/* Metric and Target Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-4">
            <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-[#8D96AA] uppercase tracking-wider">
              Measurable Metric
            </span>
            <div className="text-sm font-bold text-slate-800 dark:text-[#F0F3FA] mt-1">{goal.metric}</div>
          </div>
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-4">
            <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-[#8D96AA] uppercase tracking-wider">
              Target Commitment
            </span>
            <div className="text-sm font-bold text-slate-800 dark:text-[#F0F3FA] mt-1 font-mono">
              {goal.target} {goal.unit}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-4">
            <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-[#8D96AA] uppercase tracking-wider">
              Current Progress
            </span>
            <div className="text-sm font-bold text-indigo-600 dark:text-[#4FE3C1] mt-1 font-mono">
              {goal.progress}% Completed
            </div>
          </div>
        </div>

        <div className="pt-2">
          <ProgressBar value={goal.progress} size="lg" label="Overall Completion Bar" variant="indigo" />
        </div>

        {/* Returned Reason Notice */}
        {goal.status === 'returned' && goal.returnReason && (
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-mono">
            <div className="font-bold text-rose-700 dark:text-rose-300 mb-1">Manager Revision Feedback:</div>
            <p className="italic">{goal.returnReason}</p>
          </div>
        )}
      </div>

      {/* Progress History Log */}
      <div className="dark-glass-card rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <History className="w-5 h-5 text-[#8B7CFF]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-[#F0F3FA] uppercase tracking-wider font-mono">
            Checkpoint & Evidence Log
          </h2>
        </div>

        {goal.progressHistory.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-[#8D96AA] py-6 text-center font-mono">
            No progress checkpoints recorded yet. Use the "Update Progress" button on the goals page to record status updates.
          </p>
        ) : (
          <div className="space-y-4">
            {goal.progressHistory.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl border border-slate-100 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.03] text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-[#4FE3C1]" />
                    <span className="font-bold text-slate-800 dark:text-[#F0F3FA] font-mono">
                      Progress updated to {log.percentage}%
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-[#8D96AA] font-mono">
                    {formatDate(log.date)}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-[#8D96AA] leading-relaxed pl-6">{log.note}</p>
                {log.evidenceFileName && (
                  <div className="pl-6 pt-1 flex items-center gap-1.5 text-[11px] text-[#8B7CFF] font-semibold font-mono">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Evidence Attached: {log.evidenceFileName}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

