import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { goalService, peopleService } from '../../services'
import { Goal, User } from '../../types'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatDate } from '../../lib/formatters'
import { matchesUser } from '../../lib/workflow'
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
  const { currentUser, activeCycle, allUsers, refreshData } = useApp()
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
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchPendingGoals().finally(() => {
      clearTimeout(safetyTimer)
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [currentUser.id, activeCycle.id])

  const handleApprove = async (goalId: string, goalTitle: string) => {
    try {
      await goalService.decide(goalId, 'approved')
      success('Goal approved', `Approved "${goalTitle}". Target is now active.`)
      await fetchPendingGoals()
      await refreshData()
    } catch (err: any) {
      error('Approval failed', err.message)
    }
  }

  const handleApproveAll = async () => {
    setIsProcessing(true)
    let approvedCount = 0
    const errors: string[] = []

    try {
      for (const item of pendingGoals) {
        try {
          await goalService.decide(item.goal.id, 'approved')
          approvedCount++
        } catch (itemErr: any) {
          errors.push(itemErr.message || `Failed to approve "${item.goal.title}"`)
        }
      }

      if (approvedCount > 0) {
        success(
          'All goals approved',
          `Successfully approved ${approvedCount} pending goal${approvedCount === 1 ? '' : 's'} for your team.`
        )
      }

      if (errors.length > 0) {
        error('Some goals could not be approved', errors.join('; '))
      }

      setShowApproveAllConfirm(false)
      await fetchPendingGoals()
      await refreshData()
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
      await fetchPendingGoals()
      await refreshData()
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
      {/* Search Toolbar with unified single-row balanced layout */}
      {pendingGoals.length > 0 && (
        <div className="flex items-center justify-between gap-2.5 sm:gap-3 w-full">
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
            containerClassName="flex-1 min-w-0 sm:flex-initial sm:w-64 md:w-72"
          />

          <button
            type="button"
            onClick={() => setShowApproveAllConfirm(true)}
            className="h-8.5 sm:h-9 px-3 sm:px-3.5 rounded-full sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 font-semibold text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all border border-transparent shrink-0 whitespace-nowrap"
          >
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>Approve All ({pendingGoals.length})</span>
          </button>
        </div>
      )}

      {loading ? (
        <LoadingState message="Loading pending goals..." variant="card" />
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
          {displayedGoals.map(({ goal, employee }) => {
            const liveEmp = allUsers.find((u) => u.id === employee.id || matchesUser(u.id, employee.id)) || employee
            return (
              <div
                key={goal.id}
                className="dark-glass-card rounded-2xl p-4 sm:p-6 lg:p-7 space-y-4 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20"
              >
                {/* Employee Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    <img
                      src={liveEmp.avatar || employee.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                      alt={liveEmp.name}
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/20"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-[#F0F3FA]">{liveEmp.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-300 font-sans">{liveEmp.designation}</div>
                    </div>
                  </div>

                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-sans font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700/80 text-[11px]">
                    Weight: {goal.weight}%
                  </span>
                  <span className="text-slate-500 dark:text-zinc-300 font-sans text-[11px]">
                    Due: <strong className="text-slate-700 dark:text-[#F0F3FA]">{formatDate(goal.dueDate)}</strong>
                  </span>
                </div>
              </div>

              {/* Goal Content */}
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{goal.title}</h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{goal.description}</p>
              </div>

              {/* Metric Spec Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-3 text-xs">
                  <span className="text-[10px] uppercase font-sans text-slate-400 dark:text-zinc-300 tracking-wider">
                    Measurable Metric
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-[#F0F3FA] mt-0.5">{goal.metric}</div>
                </div>
                <div className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.08] rounded-xl p-3 text-xs">
                  <span className="text-[10px] uppercase font-sans text-slate-400 dark:text-zinc-300 tracking-wider">
                    Target Commitment
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-[#F0F3FA] mt-0.5 font-sans">
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer font-sans"
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
          )})}
        </div>
      )}

      {/* Return Goal Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Return Goal for Revision"
        subtitle={selectedGoal?.title}
        maxWidth="md"
        onSubmit={handleReturn}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowReturnModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors shadow-xs text-xs cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? 'Returning...' : 'Return to Employee'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          <p className="text-slate-600 dark:text-zinc-300 leading-relaxed">
            Please provide specific, actionable feedback on what the employee should adjust (e.g., metric precision, target threshold, or weight allocation).
          </p>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Revision Feedback & Manager Comments *
            </label>
            <textarea
              rows={4}
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Please define an explicit P95 latency threshold and specify measurement telemetry..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 font-sans text-xs"
            />
          </div>
        </div>
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

