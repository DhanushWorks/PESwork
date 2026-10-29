import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { goalService, storageService, cycleService } from '../../services'
import { apiCache } from '../../lib/apiCache'
import { Goal, GoalStatus } from '../../types'
import { GoalStatusBadge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/MetricCard'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DatePicker } from '../../components/ui/DatePicker'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { formatDate } from '../../lib/formatters'
import { validateGoalSet } from '../../lib/validation'
import { isUserCycleParticipant } from '../../lib/workflow'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Edit2,
  FileText,
  FileUp,
  Filter,
  Plus,
  Search,
  Send,
  Sliders,
  Target,
  Trash2,
  X,
} from 'lucide-react'

// Mini circular donut progress ring for goal weight
const WeightDonut: React.FC<{ weight: number }> = ({ weight }) => {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(timer)
  }, [])

  const size = 15
  const strokeWidth = 2.4
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius
  const validWeight = Math.min(100, Math.max(0, weight || 0))
  const targetOffset = circumference - (validWeight / 100) * circumference
  const offset = mounted ? targetOffset : circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90 shrink-0" aria-hidden="true">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-slate-300 dark:text-zinc-700/80"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-slate-900 dark:text-white transition-all duration-700 ease-out"
      />
    </svg>
  )
}

function getDueStatus(dueDateStr?: string) {
  if (!dueDateStr) return null
  const due = new Date(dueDateStr)
  if (isNaN(due.getTime())) return null
  const now = new Date()
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime()
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const diffDays = Math.round((dueDay - nowDay) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return {
      label: 'Overdue',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    }
  }
  if (diffDays === 0) {
    return {
      label: 'Due today',
      badgeClass: 'bg-slate-200/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-300/80 dark:border-zinc-700',
    }
  }
  if (diffDays <= 7) {
    return {
      label: `${diffDays}d left`,
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    }
  }
  return {
    label: 'On schedule',
    badgeClass: 'bg-slate-100 dark:bg-zinc-800/70 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/60',
  }
}

export const EmployeeGoals: React.FC = () => {
  const { currentUser, activeCycle, refreshData } = useApp()
  const { success, error, warning } = useToast()

  const cachedGoals = apiCache.peek<Goal[]>(`goals:user:${currentUser.id}:${activeCycle.id}`) || []
  const [goals, setGoals] = useState<Goal[]>(cachedGoals)
  const [loading, setLoading] = useState(cachedGoals.length === 0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isEnrolledInCycle = React.useMemo(() => {
    if (!activeCycle || !activeCycle.id) return false
    return isUserCycleParticipant(activeCycle, currentUser.id)
  }, [activeCycle, currentUser.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Modals state
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null)
  const [progressPercentage, setProgressPercentage] = useState(50)
  const [progressNote, setProgressNote] = useState('')
  const [evidenceFileName, setEvidenceFileName] = useState('')
  const [evidenceFileUrl, setEvidenceFileUrl] = useState('')
  const [evidenceFileSize, setEvidenceFileSize] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Submit Goal Set Confirmation
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Goal Form Fields (Default to empty so user enters values manually)
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formMetric, setFormMetric] = useState('')
  const [formTarget, setFormTarget] = useState<number | string>('')
  const [formUnit, setFormUnit] = useState('')
  const [formWeight, setFormWeight] = useState<number | string>('')
  const [formDueDate, setFormDueDate] = useState('')

  const fetchGoals = async () => {
    if (goals.length === 0) setLoading(true)
    try {
      const list = await goalService.listForUser(currentUser.id, activeCycle.id)
      setGoals(list)
    } catch (err) {
      console.warn('Notice fetching goals:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchGoals().finally(() => {
      clearTimeout(safetyTimer)
    })

    const unsubscribe = storageService.subscribe(() => {
      if (isMounted) {
        fetchGoals()
      }
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      unsubscribe()
    }
  }, [currentUser.id, activeCycle.id])

  const totalWeight = goals
    .filter((g) => g.status !== 'cancelled')
    .reduce((sum, g) => sum + (Number(g.weight) || 0), 0)

  const validation = validateGoalSet(goals)

  const openCreateModal = () => {
    if (!isEnrolledInCycle) {
      warning('Goal Planning Locked', 'You are not assigned to this review cycle. An administrator must assign you to the cycle before you can create goals.')
      return
    }
    setEditingGoal(null)
    setFormTitle('')
    setFormDescription('')
    setFormMetric('')
    setFormTarget('')
    setFormUnit('')
    setFormWeight('')
    setFormDueDate('')
    setShowGoalModal(true)
  }

  const openEditModal = (goal: Goal) => {
    setEditingGoal(goal)
    setFormTitle(goal.title)
    setFormDescription(goal.description)
    setFormMetric(goal.metric)
    setFormTarget(goal.target)
    setFormUnit(goal.unit || '%')
    setFormWeight(goal.weight)
    setFormDueDate(goal.dueDate)
    setShowGoalModal(true)
  }

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      error('Title required', 'Please provide a clear title for the performance goal.')
      return
    }
    if (!formMetric.trim()) {
      error('Metric required', 'Please specify a target metric.')
      return
    }
    if (formTarget === '' || isNaN(Number(formTarget))) {
      error('Target value required', 'Please enter a target value.')
      return
    }
    if (formWeight === '' || isNaN(Number(formWeight)) || Number(formWeight) <= 0) {
      error('Weight required', 'Please specify a valid weight allocation percentage.')
      return
    }
    if (!formDueDate) {
      error('Due date required', 'Please select a target due date.')
      return
    }

    try {
      const savedGoal = await goalService.save({
        id: editingGoal?.id,
        userId: currentUser.id,
        cycleId: activeCycle.id,
        title: formTitle.trim(),
        description: formDescription.trim(),
        metric: formMetric.trim(),
        target: Number(formTarget),
        unit: formUnit.trim() || '%',
        weight: Number(formWeight),
        dueDate: formDueDate,
        status: editingGoal?.status === 'returned' ? 'draft' : editingGoal?.status || 'draft',
      })

      // Immediate optimistic update in state
      setGoals((prev) => {
        const idx = prev.findIndex((g) => g.id === savedGoal.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = savedGoal
          return next
        }
        return [savedGoal, ...prev]
      })

      success(
        editingGoal ? 'Goal updated' : 'Goal drafted',
        `"${formTitle}" was saved to your ${activeCycle.name} goal plan.`
      )
      setShowGoalModal(false)
      fetchGoals()
    } catch (err: any) {
      error('Save failed', err.message)
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    try {
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
      await goalService.delete(goalId)
      success('Goal deleted', 'Draft goal removed from plan.')
      fetchGoals()
    } catch (err: any) {
      error('Cannot delete goal', err.message)
    }
  }

  const openProgressModal = (goal: Goal) => {
    setProgressGoal(goal)
    setProgressPercentage(goal.progress)
    setProgressNote('')
    setSelectedFile(null)
    setEvidenceFileName('')
    setEvidenceFileUrl('')
    setEvidenceFileSize('')
    setIsDragging(false)
    setShowProgressModal(true)
  }

  const processSelectedFile = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      error('File too large', 'Please choose a file smaller than 15MB.')
      return
    }

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`

    setSelectedFile(file)
    setEvidenceFileName(file.name)
    setEvidenceFileSize(sizeFormatted)

    const reader = new FileReader()
    reader.onload = () => {
      setEvidenceFileUrl(reader.result as string)
      success('File ready', `${file.name} (${sizeFormatted}) attached.`)
    }
    reader.onerror = () => {
      error('Upload error', 'Failed to read file from your device.')
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processSelectedFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      processSelectedFile(file)
    }
  }

  const handleSaveProgress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!progressGoal) return
    setIsUploading(true)

    try {
      let finalFileName = evidenceFileName
      let finalFileUrl = evidenceFileUrl
      let finalFileSize = evidenceFileSize

      // If a real file was chosen from device, upload through goalService.uploadEvidence with safe fallback
      if (selectedFile) {
        try {
          const uploaded = await goalService.uploadEvidence(
            selectedFile,
            currentUser.id,
            progressGoal.id
          )
          if (uploaded?.fileUrl) {
            finalFileName = uploaded.fileName
            finalFileUrl = uploaded.fileUrl
            finalFileSize = uploaded.fileSize
          }
        } catch (uploadErr) {
          console.warn('Storage upload notice; proceeding with local attached evidence payload:', uploadErr)
          // finalFileUrl already holds the valid Data URL from processSelectedFile
        }
      }

      const updatedGoal = await goalService.addProgress(
        progressGoal.id,
        progressPercentage,
        progressNote || 'Regular milestone checkpoint update.',
        finalFileName || undefined,
        finalFileUrl || undefined,
        finalFileSize || undefined
      )

      if (updatedGoal) {
        setGoals((prev) => prev.map((g) => (g.id === updatedGoal.id ? updatedGoal : g)))
      }

      success('Progress recorded', `Updated progress on "${progressGoal.title}" to ${progressPercentage}%.`)
      setShowProgressModal(false)
      setSelectedFile(null)
      setEvidenceFileName('')
      setEvidenceFileUrl('')
      setEvidenceFileSize('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchGoals()
    } catch (err: any) {
      console.error('Progress update failed:', err)
      error('Progress update failed', err.message || 'Could not save progress and evidence.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmitGoalPlan = async () => {
    if (!validation.isValid) {
      error('Cannot submit goals', validation.errors[0])
      return
    }

    setIsSubmitting(true)
    try {
      const res = await goalService.submitGoalsForApproval(currentUser.id, activeCycle.id, goals)
      if (res.success) {
        setGoals((prev) =>
          prev.map((g) =>
            g.status === 'draft' || g.status === 'returned'
              ? { ...g, status: 'pending_approval' }
              : g
          )
        )
        if (activeCycle && (activeCycle.stage === 'draft' || activeCycle.stage === 'goals_open')) {
          await cycleService.setStage(activeCycle.id, 'tracking')
        }
        await refreshData()
        success('Goals submitted for approval', 'Marcus Chen will review and approve your performance targets.')
        setShowSubmitConfirm(false)
        fetchGoals()
      } else {
        error('Validation error', res.errors?.[0] || 'Goals could not be submitted.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredGoals = goals.filter((g) => {
    const matchSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.metric.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' ? true : g.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6 w-full pb-12 animate-fade-in font-sans">
      {!isEnrolledInCycle && (
        <div className="dark-glass-card rounded-2xl p-5 border border-amber-500/20 bg-amber-500/5 space-y-1.5 font-sans">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Goal Planning Locked — Not Enrolled in Active Review Cycle
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-zinc-300">
            Your account is not assigned to "{activeCycle?.name}". An administrator must assign you to this appraisal cycle before you can create and submit performance goals.
          </p>
        </div>
      )}

      {/* Responsive Page Actions */}
      <div className="flex items-center justify-end gap-2 pb-1">
        <button
          type="button"
          onClick={openCreateModal}
          className="h-8.5 px-3.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-100 font-semibold text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all border border-transparent"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Goal</span>
        </button>

        {goals.some((g) => g.status === 'draft' || g.status === 'returned') && (
          <button
            type="button"
            onClick={() => {
              if (!validation.isValid) {
                warning('Goal plan incomplete', validation.errors[0])
              } else {
                setShowSubmitConfirm(true)
              }
            }}
            className="h-8.5 px-3.5 rounded-xl border border-slate-200 dark:border-white/15 bg-white hover:bg-slate-100 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 text-slate-800 hover:text-slate-900 dark:text-zinc-200 dark:hover:text-white font-semibold text-xs cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all"
          >
            <Send className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
            <span>Submit for Approval</span>
          </button>
        )}
      </div>

      {/* Goal Plan Balance Card (Matching Reference Screenshot) */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-xs dark:shadow-md space-y-5 sm:space-y-6">
        {/* Top Row: Meta info & Stat blocks */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-sans font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                GOAL PLAN BALANCE
              </span>
              {validation.isValid ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1 rounded-full bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-zinc-100 border border-slate-200 dark:border-white/15 shadow-2xs font-semibold">
                  <Check className="w-3.5 h-3.5 text-slate-700 dark:text-zinc-300" />
                  <span>Ready to Submit</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-sans px-3 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-zinc-400 border border-slate-200 dark:border-white/10 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                  <span>Requirements Pending</span>
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
              Requires 3–7 active goals and exactly 100% total weight commitment.
            </p>
          </div>

          {/* Metric Stat Blocks */}
          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 sm:gap-8 shrink-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5">
            <div className="text-left sm:text-right">
              <div className="text-[10px] sm:text-[11px] font-sans tracking-wider uppercase text-slate-500 dark:text-zinc-400">
                ACTIVE GOALS
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                {goals.length} Goals
              </div>
            </div>

            <div className="h-9 w-px bg-slate-200 dark:bg-white/10" />

            <div className="text-right">
              <div className="text-[10px] sm:text-[11px] font-sans tracking-wider uppercase text-slate-500 dark:text-zinc-400">
                TOTAL WEIGHT
              </div>
              <div
                className={`text-xl sm:text-2xl font-bold mt-0.5 tabular-nums ${
                  totalWeight === 100
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                {totalWeight}% / 100%
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Segmented Proportional Weight Bar */}
        <div className="space-y-3">
          <div className="w-full h-3 rounded-full overflow-hidden p-0.5 bg-slate-200 dark:bg-zinc-800 border border-slate-300/80 dark:border-zinc-700 flex items-center">
            {goals.length === 0 ? (
              <div className="w-full h-full rounded-full bg-slate-300 dark:bg-zinc-700" />
            ) : (
              <div
                className="h-full flex items-center gap-2 transition-all duration-500 w-full"
                style={{ width: `${Math.min(100, Math.max(0, totalWeight))}%` }}
              >
                {goals.map((g, idx) => {
                  const colors = ['bg-slate-900 dark:bg-white', 'bg-slate-700 dark:bg-zinc-300', 'bg-slate-500 dark:bg-zinc-400', 'bg-slate-400 dark:bg-zinc-500', 'bg-slate-300 dark:bg-zinc-600']
                  const colorClass = colors[idx % colors.length]

                  return (
                    <div
                      key={g.id || idx}
                      style={{ flex: `${Math.max(1, Number(g.weight) || 0)} 0 0%` }}
                      className={`h-full rounded-full transition-all duration-300 ${colorClass}`}
                      title={`${g.title}: ${g.weight}%`}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Legend Row */}
          {goals.length > 0 && (
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-xs font-sans text-slate-600 dark:text-zinc-300 pt-1">
              {goals.map((g, idx) => {
                const colors = ['bg-slate-900 dark:bg-white', 'bg-slate-700 dark:bg-zinc-300', 'bg-slate-500 dark:bg-zinc-400', 'bg-slate-400 dark:bg-zinc-500', 'bg-slate-300 dark:bg-zinc-600']
                const colorClass = colors[idx % colors.length]

                return (
                  <div key={g.id || idx} className="flex items-center gap-2">
                    <span className={`w-3 h-1.5 rounded-sm shrink-0 ${colorClass}`} />
                    <span className="truncate max-w-[210px] sm:max-w-[260px] text-slate-800 dark:text-zinc-200">
                      {g.title}
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-semibold">{g.weight}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Subtle Horizontal Divider */}
        <div className="border-t border-slate-200/90 dark:border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Bottom Validation Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans border font-medium ${
                goals.length >= 3 && goals.length <= 7
                  ? 'border-slate-300 bg-slate-100 text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>3–7 goals · {goals.length} active</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans border font-medium ${
                totalWeight === 100
                  ? 'border-slate-300 bg-slate-100 text-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>100% weight committed</span>
            </span>
          </div>

          {/* Incomplete details if any */}
          {!validation.isValid && validation.errors.length > 0 && (
            <div className="text-xs font-sans text-slate-500 dark:text-zinc-400">
              {validation.errors[0]}
            </div>
          )}
        </div>
      </div>

      {/* Search & Segmented Filter Bar (Single-Line, No Card Wrapper: Equal Heights & Balanced Widths) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full min-w-0 max-w-full">
        {/* Left: Status Filter Capsule */}
        <div className="w-full sm:w-auto min-w-0 max-w-full py-0.5">
          <RubberSegmentedControl
            options={[
              { value: 'all', label: 'All', count: goals.length },
              { value: 'draft', label: 'Draft', count: goals.filter((g) => g.status === 'draft').length },
              {
                value: 'pending_approval',
                label: 'Pending Approval',
                count: goals.filter((g) => g.status === 'pending_approval').length,
              },
              {
                value: 'approved',
                label: 'Approved',
                count: goals.filter((g) => g.status === 'approved').length,
              },
              {
                value: 'returned',
                label: 'Returned',
                count: goals.filter((g) => g.status === 'returned').length,
              },
              {
                value: 'completed',
                label: 'Completed',
                count: goals.filter((g) => g.status === 'completed').length,
              },
            ]}
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as any)}
            size="sm"
            className="w-full sm:w-auto"
          />
        </div>

        {/* Right: Compact Search Input (Matching h-8.5 height & rounded-full capsule geometry) */}
        <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end min-w-0">
          <div className="relative flex-1 sm:flex-initial sm:w-56 md:w-64 min-w-0 flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search goals by title..."
              className="w-full h-8.5 pl-9 pr-8 rounded-full bg-white dark:bg-[#18181b] border border-slate-200/90 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 transition-all font-sans shadow-2xs"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="absolute right-2.5 pointer-events-none px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-white/[0.06] hidden sm:inline-block">
                /
              </kbd>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setStatusFilter('all')
              setSearch('')
            }}
            className="h-8.5 w-8.5 rounded-full border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center cursor-pointer shrink-0 shadow-2xs"
            title="Reset filters"
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Goals List */}
      {loading ? (
        <LoadingState message="Loading performance goals..." variant="card" />
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          title="No goals found"
          description="Clear filters or create a new goal."
          action={{
            label: 'Create Goal',
            icon: <Plus className="w-3.5 h-3.5" />,
            onClick: openCreateModal,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredGoals.map((g) => {
            const isApproved = g.status === 'approved' || g.status === 'completed'
            const isEditable = g.status === 'draft' || g.status === 'returned'
            const dueStatus = getDueStatus(g.dueDate)
            const remainingToTarget = Math.max(0, 100 - g.progress)

            return (
              <div
                key={g.id}
                className="dark-glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 space-y-4 sm:space-y-5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-white/20"
              >
                {/* Card Top Row: Status, Meta, Due, & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    <GoalStatusBadge status={g.status} />

                    {/* Weight Donut Pill */}
                    <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-800 text-xs font-semibold">
                      <WeightDonut weight={g.weight} />
                      <span>Weight <strong className="font-bold text-slate-900 dark:text-white">{g.weight}%</strong></span>
                    </span>

                    {/* Due Date */}
                    <span className="text-xs font-sans text-slate-500 dark:text-zinc-400">
                      Due: {formatDate(g.dueDate)}
                    </span>

                    {/* Dynamic Urgency Status Pill */}
                    {dueStatus && (
                      <span className={`text-[11px] font-sans px-2.5 py-0.5 rounded-full border ${dueStatus.badgeClass}`}>
                        {dueStatus.label}
                      </span>
                    )}
                  </div>

                  {/* Actions aligned cleanly */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-white/5 shrink-0">
                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => openProgressModal(g)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>Update Progress</span>
                      </button>
                    )}

                    {isEditable && (
                      <button
                        type="button"
                        onClick={() => openEditModal(g)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                        <span>Edit</span>
                      </button>
                    )}

                    {g.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleDeleteGoal(g.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                        title="Delete draft goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Title & Description */}
                <div className="space-y-1.5">
                  <Link
                    to={`/employee/goals/${g.id}`}
                    className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 transition-colors inline-block"
                  >
                    {g.title}
                  </Link>

                  {g.description && (
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
                      {g.description}
                    </p>
                  )}
                </div>

                {/* Returned Comment Banner if returned */}
                {g.status === 'returned' && g.returnReason && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-sans text-rose-600 dark:text-rose-400 space-y-1">
                    <div className="font-semibold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                      <AlertCircle className="w-3.5 h-3.5" /> Manager Revision Feedback:
                    </div>
                    <p className="italic pl-5">"{g.returnReason}"</p>
                  </div>
                )}

                {/* Bottom Section: Dual Column Executive Dashboard Layout */}
                <div className="pt-5 sm:pt-6 border-t border-slate-100 dark:border-white/[0.08] flex flex-col lg:flex-row lg:items-end justify-between gap-5 sm:gap-6">
                  {/* Left Column: Metric Target, Giant Big Number, and Visual Slider Track with Glowing Knob */}
                  <div className="flex-1 min-w-0 pr-0 lg:pr-8">
                    {/* Metric Target Label */}
                    <div className="text-xs font-sans text-slate-500 dark:text-zinc-400 tracking-tight">
                      Metric: {g.metric} (Target: {g.target} {g.unit})
                    </div>

                    {/* Giant Percentage & Target Delta */}
                    <div className="flex items-baseline mt-2 mb-3">
                      <span className="text-4xl sm:text-5xl font-black font-sans tracking-tight text-slate-900 dark:text-white leading-none">
                        {g.progress}
                      </span>
                      <span className="text-2xl font-bold text-slate-400 dark:text-zinc-500 ml-1 leading-none">
                        %
                      </span>
                      <span className="text-xs font-sans font-medium text-slate-500 dark:text-zinc-400 ml-3.5">
                        {g.progress >= 100 ? (
                          <span className="text-slate-900 dark:text-white font-semibold">Target achieved</span>
                        ) : (
                          `${remainingToTarget}% to target`
                        )}
                      </span>
                    </div>

                    {/* Visual Slider Track with Knob */}
                    <div className="relative w-full pt-1">
                      <div className="w-full bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-full h-2.5 relative">
                        <div
                          className="h-full rounded-full bg-slate-900 dark:bg-white transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, g.progress))}%` }}
                        />
                        {/* Executive Knob at current progress tip */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white dark:bg-[#18181b] border-2 border-slate-900 dark:border-white shadow-2xs transition-all duration-500 pointer-events-none"
                          style={{ left: `${Math.min(100, Math.max(0, g.progress))}%` }}
                        />
                      </div>

                      {/* Milestone Scale Ticks */}
                      <div className="flex justify-between text-[10px] font-sans text-slate-400 dark:text-zinc-500 pt-2 px-0.5 select-none">
                        <span>0</span>
                        <span>25</span>
                        <span>50</span>
                        <span>75</span>
                        <span>100</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Checkpoint Stats */}
                  <div className="pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-white/[0.08] lg:pl-8 lg:min-w-[220px] flex flex-col justify-end">
                    <span className="text-[10px] sm:text-[11px] font-sans uppercase tracking-widest text-slate-400 dark:text-zinc-500 font-bold block mb-1">
                      PROGRESS UPDATES LOGGED
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-extrabold font-sans text-slate-900 dark:text-white leading-none">
                        {g.progressHistory?.length || 0}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-zinc-400 font-sans">
                        {(g.progressHistory?.length || 0) === 1 ? 'checkpoint recorded' : 'checkpoints recorded'}
                      </span>
                    </div>

                    {(g.evidenceFileName || g.progressHistory?.[0]?.evidenceFileName) && (
                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-zinc-300 min-w-0" title={g.evidenceFileName || g.progressHistory?.[0]?.evidenceFileName}>
                        <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate font-medium">{g.evidenceFileName || g.progressHistory?.[0]?.evidenceFileName}</span>
                      </div>
                    )}

                    <Link
                      to={`/employee/goals/${g.id}`}
                      className="text-xs font-semibold text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 inline-flex items-center gap-1 mt-2.5 transition-colors group"
                    >
                      <span>View checkpoints</span>
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Results count under cards */}
      {filteredGoals.length > 0 && (
        <div className="flex items-center justify-end pt-1 pb-1 text-xs text-slate-500 dark:text-zinc-400 font-sans">
          <span>Showing {filteredGoals.length} of {goals.length} strategic targets</span>
        </div>
      )}

      {/* Goal Create/Edit Modal */}
      <Modal
        isOpen={showGoalModal}
        onClose={() => setShowGoalModal(false)}
        title={editingGoal ? 'Edit Performance Goal' : 'Define New Performance Goal'}
        subtitle={`Goal will be part of ${activeCycle.name}`}
        maxWidth="lg"
        onSubmit={handleSaveGoal}
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGoalModal(false)}
              className="h-8.5 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-8.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              {editingGoal ? 'Update Goal' : 'Save Goal'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Goal Title *</label>
            <input
              type="text"
              required
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g. Design System v3 Accessibility Modernization"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Description & Strategic Intent</label>
            <textarea
              rows={3}
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Detail key deliverables, customer impact, and technical milestones..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Target Metric *</label>
            <input
              type="text"
              required
              value={formMetric}
              onChange={(e) => setFormMetric(e.target.value)}
              placeholder="e.g. Component adoption rate"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1 whitespace-nowrap">Target Value *</label>
              <input
                type="number"
                required
                placeholder="e.g. 100"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Unit</label>
              <input
                type="text"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                placeholder="e.g. % or count"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Weight Allocation (%) *</label>
              <input
                type="number"
                min="1"
                max="100"
                required
                placeholder="e.g. 25"
                value={formWeight}
                onChange={(e) => setFormWeight(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total weight across goals must sum to 100%.
              </span>
            </div>

            <div>
              <DatePicker
                label="Target Due Date"
                placeholder="Select target due date"
                required
                value={formDueDate}
                onChange={(val) => setFormDueDate(val)}
              />
            </div>
          </div>

        </div>
      </Modal>

      {/* Progress Update Modal */}
      <Modal
        isOpen={showProgressModal}
        onClose={() => setShowProgressModal(false)}
        title="Record Goal Progress & Evidence"
        subtitle={progressGoal?.title}
        maxWidth="md"
        onSubmit={handleSaveProgress}
        footer={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProgressModal(false)}
              className="h-8.5 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-xs font-semibold cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="h-8.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-xs"
            >
              {isUploading ? 'Uploading Evidence...' : 'Record Checkpoint'}
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-700 dark:text-zinc-200">Completion Percentage</label>
              <span className="font-mono font-bold text-base text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-zinc-700">
                {progressPercentage}%
              </span>
            </div>

            {/* Slider Track with Visible High-Contrast Underlay and Active Fill */}
            <div className="relative py-2.5 flex items-center w-full">
              <div className="absolute inset-x-0 h-3 rounded-full bg-slate-200 dark:bg-zinc-800 border-[1.5px] border-slate-300 dark:border-zinc-600 overflow-hidden pointer-events-none shadow-2xs">
                {/* Active Progress Fill */}
                <div
                  className="h-full bg-slate-900 dark:bg-white transition-all duration-75"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              {/* Native Range Slider */}
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={progressPercentage}
                onChange={(e) => setProgressPercentage(parseInt(e.target.value))}
                className="rating-slider relative z-10 w-full h-3 appearance-none bg-transparent cursor-pointer transition-all"
              />
            </div>

            <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-zinc-300 px-0.5 pt-0.5">
              <span>0% Not Started</span>
              <strong className="text-slate-900 dark:text-white font-bold">50% In Progress</strong>
              <span>100% Completed</span>
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex items-center gap-1.5 pt-2.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mr-1">Presets:</span>
              {[0, 25, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setProgressPercentage(preset)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-all cursor-pointer ${
                    progressPercentage === preset
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white shadow-2xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700'
                  }`}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Progress Notes & Milestones Achieved *
            </label>
            <textarea
              rows={3}
              required
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              placeholder="Describe what was delivered, hurdles cleared, or metrics verified..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-[#18181b] text-slate-900 dark:text-zinc-100 text-xs"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">
              Evidence Document / Snapshot (Upload from Device)
            </label>

            {/* Hidden native file input for local device file picker */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />

            {evidenceFileName ? (
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">
                      {evidenceFileName}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2 mt-0.5">
                      <span>{evidenceFileSize || 'Local document'}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready to attach</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-xs font-medium text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    title="Choose a different file"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvidenceFileName('')
                      setEvidenceFileUrl('')
                      setEvidenceFileSize('')
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-zinc-700 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove attached file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-slate-900 dark:border-white bg-slate-100/90 dark:bg-white/[0.08] scale-[1.01]'
                    : 'border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.05] hover:border-slate-400 dark:hover:border-zinc-500'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-zinc-300 flex items-center justify-center mx-auto mb-2">
                  <FileUp className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  Click to browse from your device or drag & drop file here
                </div>
                <div className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                  Upload local PDF audit report, benchmark document, or screenshot (up to 15MB)
                </div>
              </div>
            )}

            {progressGoal?.evidenceFileName && !evidenceFileName && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.04] text-[11px] text-slate-600 dark:text-zinc-400 flex items-center gap-2 border border-slate-200/60 dark:border-white/[0.06]">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">
                  Previous evidence on file: <strong className="text-slate-800 dark:text-zinc-200 font-semibold">{progressGoal.evidenceFileName}</strong>. Upload a new file above to update it.
                </span>
              </div>
            )}
          </div>

        </div>
      </Modal>

      {/* Submit Goals Confirmation */}
      <ConfirmDialog
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={handleSubmitGoalPlan}
        title="Submit Performance Goals for Approval?"
        message={`Your goal set has ${goals.length} goals with exactly 100% weight. Upon submitting, Marcus Chen will be notified to review and lock your targets.`}
        confirmText="Submit Goals"
        variant="primary"
        isLoading={isSubmitting}
      />
    </div>
  )
}

