import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { goalService, peopleService } from '../../services'
import { Goal, User } from '../../types'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/formatters'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CheckSquare,
  CornerDownLeft,
  RotateCcw,
  Target,
  User as UserIcon,
} from 'lucide-react'

export const ManagerApprovals: React.FC = () => {
  const { currentUser, activeCycle } = useApp()
  const { success, error } = useToast()

  const [pendingGoals, setPendingGoals] = useState<Array<{ goal: Goal; employee: User }>>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Return modal
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [returnReason, setReturnReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Approve all dialog
  const [showApproveAllConfirm, setShowApproveAllConfirm] = useState(false)

  const fetchPendingGoals = async () => {
    setLoading(true)
    try {
      const reports = await peopleService.getDirectReports(currentUser.id)
      const all: Array<{ goal: Goal; employee: User }> = []

      for (const emp of reports) {
        const goals = await goalService.listForUser(emp.id, activeCycle.id)
        const pending = goals.filter((g) => g.status === 'pending_approval')
        pending.forEach((g) => all.push({ goal: g, employee: emp }))
      }

      setPendingGoals(all)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingGoals()
  }, [currentUser.id, activeCycle.id])

  const handleApprove = async (goalId: string, goalTitle: string) => {
    try {
      await goalService.decide(goalId, 'approved')
      success('Goal approved', `Approved "${goalTitle}". Target is now active.`)
      fetchPendingGoals()
    } catch (err: any) {
      error('Approval failed', err.message)
    }
  }

  const handleApproveAll = async () => {
    setIsProcessing(true)
    try {
      for (const item of pendingGoals) {
        await goalService.decide(item.goal.id, 'approved')
      }
      success('All goals approved', `Approved ${pendingGoals.length} pending goals for your team.`)
      setShowApproveAllConfirm(false)
      fetchPendingGoals()
    } catch (err: any) {
      error('Batch approval failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGoal) return
    if (!returnReason.trim() || returnReason.trim().length < 5) {
      error('Reason required', 'Please provide constructive feedback explaining what needs revision.')
      return
    }

    setIsProcessing(true)
    try {
      await goalService.decide(selectedGoal.id, 'returned', returnReason)
      success(
        'Goal returned for revision',
        `Returned "${selectedGoal.title}" to employee with revision notes.`
      )
      setShowReturnModal(false)
      setSelectedGoal(null)
      setReturnReason('')
      fetchPendingGoals()
    } catch (err: any) {
      error('Return failed', err.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const displayedGoals = searchQuery.trim()
    ? pendingGoals.filter(({ goal, employee }) => {
        const q = searchQuery.toLowerCase()
        const titleMatch = goal.title.toLowerCase().includes(q)
        const nameMatch = employee.name.toLowerCase().includes(q)
        const descMatch = goal.description?.toLowerCase().includes(q)
        const metricMatch = goal.metric?.toLowerCase().includes(q)
        return titleMatch || nameMatch || descMatch || metricMatch
      })
    : pendingGoals

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {/* Clean Dashboard Standard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold tracking-[-0.035em] text-slate-900 dark:text-white leading-[1.15]">
            Team Goal Commitments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Review, calibrate & approve direct report performance plans for {activeCycle.name}
          </p>
        </div>
      </div>

      {/* Search Toolbar with 270px x 48px Animated Search Bar */}
      {pendingGoals.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <AnimatedSearchBar
            value={searchQuery}
            onChangeValue={setSearchQuery}
            placeholder="Search pending approvals..."
            animatedPlaceholders={[
              'Search by employee name...',
              'Search goal title...',
              'Filter pending approvals...',
              'Type to filter...',
            ]}
            variant="pill"
            sizeVariant="default"
          />

          <button
            type="button"
            onClick={() => setShowApproveAllConfirm(true)}
            className="premium-glow-btn h-11 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2 self-start sm:self-auto shrink-0"
          >
            <Check className="w-4 h-4" />
            <span>Approve All ({pendingGoals.length})</span>
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400 font-mono">Loading pending goals...</div>
      ) : pendingGoals.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="w-8 h-8 text-indigo-600 dark:text-[#4FE3C1]" />}
          title="All submitted goals are approved"
          description="There are currently no team goals pending manager review for this cycle."
        />
      ) : displayedGoals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-8 h-8 text-slate-400" />}
          title="No matching goals found"
          description={`No pending approvals match "${searchQuery}".`}
        />
      ) : (
        <div className="space-y-4">
          {displayedGoals.map(({ goal, employee }) => (
            <div
              key={goal.id}
              className="dark-glass-card rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20"
            >
              {/* Employee Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <img
                    src={employee.avatar}
                    alt={employee.name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA]">{employee.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-[#8D96AA] font-mono">{employee.designation}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700/80 text-[11px]">
                    Weight: {goal.weight}%
                  </span>
                  <span className="text-slate-500 dark:text-[#8D96AA] font-mono text-[11px]">
                    Due: <strong className="text-slate-700 dark:text-[#F0F3FA]">{formatDate(goal.dueDate)}</strong>
                  </span>
                </div>
              </div>

              {/* Goal Content */}
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{goal.title}</h2>
                <p className="text-xs text-slate-600 dark:text-[#8D96AA] leading-relaxed">{goal.description}</p>
              </div>

              {/* Metric Spec Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-3 text-xs">
                  <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#8D96AA] tracking-wider">
                    Measurable Metric
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-[#F0F3FA] mt-0.5">{goal.metric}</div>
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-3 text-xs">
                  <span className="text-[10px] uppercase font-mono text-slate-400 dark:text-[#8D96AA] tracking-wider">
                    Target Commitment
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-[#F0F3FA] mt-0.5 font-mono">
                    {goal.target} {goal.unit}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGoal(goal)
                    setReturnReason('')
                    setShowReturnModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer font-mono"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                  <span>Return for Revision</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(goal.id, goal.title)}
                  className="premium-glow-btn h-9 px-4 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Goal</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Return Goal Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Return Goal for Revision"
        subtitle={selectedGoal?.title}
        maxWidth="md"
      >
        <form onSubmit={handleReturn} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Please provide specific, actionable feedback on what the employee should adjust (e.g., metric precision, target threshold, or weight allocation).
          </p>

          <div>
            <label className="font-semibold text-slate-700 block mb-1">
              Revision Feedback & Manager Comments *
            </label>
            <textarea
              rows={4}
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Please define an explicit P95 latency threshold and specify measurement telemetry..."
              className="w-full p-3 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowReturnModal(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors shadow-xs"
            >
              {isProcessing ? 'Returning...' : 'Return to Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Approve All Confirmation */}
      <ConfirmDialog
        isOpen={showApproveAllConfirm}
        onClose={() => setShowApproveAllConfirm(false)}
        onConfirm={handleApproveAll}
        title="Approve All Pending Goals?"
        message={`Are you sure you want to approve all ${pendingGoals.length} pending goals for your team? This will lock the targets for tracking.`}
        confirmText="Approve All"
        variant="primary"
        isLoading={isProcessing}
      />
    </div>
  )
}

