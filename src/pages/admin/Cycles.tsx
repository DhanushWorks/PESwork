import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { cycleService } from '../../services'
import { ReviewCycle, CycleWeights } from '../../types'
import { CycleStageBadge } from '../../components/ui/Badge'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { DatePicker } from '../../components/ui/DatePicker'
import { formatDate } from '../../lib/formatters'
import { validateCycleWeights } from '../../lib/validation'
import { generateDeterministicDeadlines, validateCycleDatesAndDeadlines, getLastDayOfMonth } from '../../lib/deadlines'
import { AnimatedSearchBar } from '../../components/ui/AnimatedSearchBar'
import {
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Trash2,
  Users,
} from 'lucide-react'

// Returns a clean, empty state for the Create Performance Review Cycle modal
const getEmptyCycleDefaults = () => ({
  name: '',
  description: '',
  startDate: '',
  endDate: '',
  goalsWeight: '' as number | string,
  compWeight: '' as number | string,
  valuesWeight: '' as number | string,
  deadlines: {
    goalsDue: '',
    selfReviewDue: '',
    managerReviewDue: '',
    calibrationDue: '',
    releaseDate: '',
  },
  enrollmentMode: 'empty' as const,
  selectedParticipantIds: [] as string[],
})

export const AdminCycles: React.FC = () => {
  const { allCycles, activeCycle, switchActiveCycle, refreshData, currentUser, allUsers } = useApp()
  const { success, error, warning } = useToast()
  const navigate = useNavigate()

  const [cycles, setCycles] = useState<ReviewCycle[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  // Delete Cycle State
  const [cycleToDelete, setCycleToDelete] = useState<ReviewCycle | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Create Cycle Modal State (clean & completely empty on open)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [goalsWeight, setGoalsWeight] = useState<number | string>('')
  const [compWeight, setCompWeight] = useState<number | string>('')
  const [valuesWeight, setValuesWeight] = useState<number | string>('')

  // Deadlines state for Create modal
  const [createDeadlines, setCreateDeadlines] = useState<ReviewCycle['deadlines']>({
    goalsDue: '',
    selfReviewDue: '',
    managerReviewDue: '',
    calibrationDue: '',
    releaseDate: '',
  })

  // Participant enrollment mode on creation
  const [enrollmentMode, setEnrollmentMode] = useState<'empty' | 'all' | 'custom'>('empty')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState('')

  // Edit Cycle Modal State
  const [cycleToEdit, setCycleToEdit] = useState<ReviewCycle | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editGoalsWeight, setEditGoalsWeight] = useState(60)
  const [editCompWeight, setEditCompWeight] = useState(25)
  const [editValuesWeight, setEditValuesWeight] = useState(15)
  const [editDeadlines, setEditDeadlines] = useState<ReviewCycle['deadlines']>({
    goalsDue: '',
    selfReviewDue: '',
    managerReviewDue: '',
    calibrationDue: '',
    releaseDate: '',
  })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const fetchCycles = async () => {
    setLoading(true)
    try {
      const list = await cycleService.list()
      setCycles(list)
    } catch (err) {
      console.warn('Notice loading cycles:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchCycles().finally(() => {
      clearTimeout(safetyTimer)
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [])

  // Manual date updates for Create Modal - keeps deadlines empty unless user explicitly recalculates
  const handleStartDateChange = (newStart: string) => {
    setStartDate(newStart)
  }

  const handleEndDateChange = (newEnd: string) => {
    setEndDate(newEnd)
  }

  const handleRecalculateCreateDeadlines = () => {
    if (!startDate || !endDate) {
      warning('Dates Needed', 'Please select both Performance Period Start and End dates first.')
      return
    }
    const suggested = generateDeterministicDeadlines(startDate, endDate)
    setCreateDeadlines(suggested)
    success('Deadlines recalculated', 'Deterministic schedule applied for this performance window.')
  }

  // Open Edit Cycle Modal
  const handleOpenEditModal = (c: ReviewCycle) => {
    setCycleToEdit(c)
    setEditName(c.name)
    setEditDescription(c.description || '')
    setEditStartDate(c.startDate)
    setEditEndDate(c.endDate)
    setEditGoalsWeight(c.weights?.goals ?? 60)
    setEditCompWeight(c.weights?.competencies ?? 25)
    setEditValuesWeight(c.weights?.values ?? 15)
    setEditDeadlines({
      goalsDue: c.deadlines?.goalsDue || (c.deadlines as any)?.goal_setting || (c.deadlines as any)?.goals_due || '',
      selfReviewDue: c.deadlines?.selfReviewDue || (c.deadlines as any)?.self_review || (c.deadlines as any)?.self_review_due || '',
      managerReviewDue: c.deadlines?.managerReviewDue || (c.deadlines as any)?.manager_review || (c.deadlines as any)?.manager_review_due || '',
      calibrationDue: c.deadlines?.calibrationDue || (c.deadlines as any)?.calibration || (c.deadlines as any)?.calibration_due || '',
      releaseDate: c.deadlines?.releaseDate || (c.deadlines as any)?.release_date || (c.deadlines as any)?.released_at || c.endDate || '',
    })
    setShowEditModal(true)
  }

  const handleRecalculateEditDeadlines = () => {
    const suggested = generateDeterministicDeadlines(editStartDate, editEndDate)
    setEditDeadlines(suggested)
    success('Deadlines recalculated', 'Deterministic dates applied based on cycle period.')
  }

  // Save Edit Cycle
  const handleSaveEditCycle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cycleToEdit) return

    const weights: CycleWeights = {
      goals: Number(editGoalsWeight),
      competencies: Number(editCompWeight),
      values: Number(editValuesWeight),
    }

    const weightValidation = validateCycleWeights(weights)
    if (!weightValidation.isValid) {
      error('Invalid component weights', weightValidation.errors[0])
      return
    }

    const deadlineValidation = validateCycleDatesAndDeadlines(editStartDate, editEndDate, editDeadlines)
    if (!deadlineValidation.isValid) {
      error('Invalid dates or deadlines', deadlineValidation.errors[0])
      return
    }

    setIsSavingEdit(true)
    try {
      await cycleService.update(cycleToEdit.id, {
        name: editName,
        description: editDescription,
        startDate: editStartDate,
        endDate: editEndDate,
        weights,
        deadlines: editDeadlines,
      })

      success('Cycle updated', `"${editName}" details and deadlines updated successfully.`)
      setShowEditModal(false)
      setCycleToEdit(null)
      await refreshData()
      await fetchCycles()
    } catch (err: any) {
      error('Failed to update cycle', err.message || 'An unexpected error occurred.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Open Create Cycle Modal - ALWAYS resets to a completely empty card with zero prefilled dates
  const handleOpenCreateModal = () => {
    const empty = getEmptyCycleDefaults()
    setName(empty.name)
    setDescription(empty.description)
    setStartDate(empty.startDate)
    setEndDate(empty.endDate)
    setGoalsWeight(empty.goalsWeight)
    setCompWeight(empty.compWeight)
    setValuesWeight(empty.valuesWeight)
    setCreateDeadlines(empty.deadlines)
    setEnrollmentMode(empty.enrollmentMode)
    setSelectedParticipantIds(empty.selectedParticipantIds)
    setUserSearchQuery('')
    setShowCreateModal(true)
  }

  // Create Cycle
  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      error('Cycle name required', 'Please provide a name for this performance cycle.')
      return
    }

    const weights: CycleWeights = {
      goals: Number(goalsWeight),
      competencies: Number(compWeight),
      values: Number(valuesWeight),
    }

    const weightValidation = validateCycleWeights(weights)
    if (!weightValidation.isValid) {
      error('Invalid weights', weightValidation.errors[0])
      return
    }

    const deadlineValidation = validateCycleDatesAndDeadlines(startDate, endDate, createDeadlines)
    if (!deadlineValidation.isValid) {
      error('Invalid dates or deadlines', deadlineValidation.errors[0])
      return
    }

    // Determine initial participants
    let participantIds: string[] = []
    if (enrollmentMode === 'all') {
      participantIds = allUsers.filter((u) => u.role !== 'admin').map((u) => u.id)
    } else if (enrollmentMode === 'custom') {
      participantIds = selectedParticipantIds
    } else {
      participantIds = [] // Admin starts with 0 participants and assigns explicitly later
    }

    try {
      const created = await cycleService.create({
        name,
        description,
        stage: 'draft',
        startDate,
        endDate,
        weights,
        deadlines: createDeadlines,
        participantIds,
      })

      success(
        'Cycle created',
        `"${name}" was created with ${participantIds.length} assigned participant(s).`
      )
      setShowCreateModal(false)
      const empty = getEmptyCycleDefaults()
      setName(empty.name)
      setDescription(empty.description)
      setStartDate(empty.startDate)
      setEndDate(empty.endDate)
      setCreateDeadlines(empty.deadlines)
      setSelectedParticipantIds([])
      await refreshData()
      fetchCycles()
      navigate(`/admin/cycles/${created.id}`)
    } catch (err: any) {
      error('Failed to create cycle', err.message)
    }
  }

  const totalFormWeights = Number(goalsWeight) + Number(compWeight) + Number(valuesWeight)
  const totalEditWeights = Number(editGoalsWeight) + Number(editCompWeight) + Number(editValuesWeight)

  const handleDeleteCycle = async () => {
    if (!cycleToDelete) return
    if (currentUser.role !== 'admin') {
      error('Access Denied', 'Only system administrators can delete appraisal cycles.')
      return
    }

    setIsDeleting(true)
    try {
      await cycleService.delete(cycleToDelete.id, currentUser.name)
      success('Cycle deleted', `"${cycleToDelete.name}" has been permanently removed.`)
      setShowDeleteConfirm(false)
      setCycleToDelete(null)
      await refreshData()
      await fetchCycles()
    } catch (err: any) {
      error('Failed to delete cycle', err.message || 'An unexpected error occurred.')
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredCycles = searchQuery.trim()
    ? cycles.filter((c) => {
        const q = searchQuery.toLowerCase()
        const nameMatch = c.name.toLowerCase().includes(q)
        const descMatch = c.description?.toLowerCase().includes(q)
        const stageMatch = c.stage.toLowerCase().includes(q)
        return nameMatch || descMatch || stageMatch
      })
    : cycles

  const eligibleStaff = allUsers.filter((u) => u.role !== 'admin')
  const filteredUsers = eligibleStaff.filter((u) => {
    if (!userSearchQuery.trim()) return true
    const q = userSearchQuery.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.department.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-4 w-full pb-20 sm:pb-24 lg:pb-16 font-sans">
      {/* Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <AnimatedSearchBar
          value={searchQuery}
          onChangeValue={setSearchQuery}
          placeholder="Search appraisal cycles..."
          animatedPlaceholders={[
            'Search cycles by name...',
            'Filter by cycle year...',
            'Search by stage...',
            'Find appraisal cycle...',
          ]}
          variant="pill"
          sizeVariant="default"
        />

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="h-8.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all border border-transparent shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Cycle</span>
        </button>
      </div>

      {/* Cycles List */}
      <div className="grid grid-cols-1 gap-4 sm:gap-5">
        {filteredCycles.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl p-12 text-center border border-dashed border-slate-300 dark:border-zinc-800 bg-white/50 dark:bg-white/[0.01]">
            <Calendar className="w-10 h-10 text-slate-400 dark:text-zinc-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Review Cycles Found</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
              Your workspace is clean with 0 cycles. Click "Create New Cycle" above to start your first performance appraisal cycle.
            </p>
          </div>
        ) : (
          filteredCycles.map((c) => {
          const isActive = c.id === activeCycle.id
          const participantCount = c.participantIds?.length ?? 0

          return (
            <div
              key={c.id}
              className={`rounded-2xl sm:rounded-3xl p-6 sm:p-7 transition-all duration-300 space-y-5 border bg-white dark:bg-[#18181b] text-slate-900 dark:text-white ${
                isActive
                  ? 'border-indigo-300 dark:border-[#4FE3C1]/30 shadow-md ring-1 ring-indigo-500/10 dark:ring-[#4FE3C1]/10'
                  : 'border-slate-200/90 dark:border-zinc-700/80 hover:border-slate-300 dark:hover:border-zinc-600 shadow-xs'
              }`}
            >
              {/* Top Row: Stage, Active Pill, Date & Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 flex-1">
                  {/* Meta Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <CycleStageBadge stage={c.stage} />
                    {isActive && (
                      <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-sans font-bold uppercase tracking-wider bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs">
                        Active Workspace
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-300 font-semibold font-sans">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                      <span>{formatDate(c.startDate)} – {formatDate(c.endDate)}</span>
                    </span>
                  </div>

                  {/* Cycle Title */}
                  <div>
                    <Link
                      to={`/admin/cycles/${c.id}`}
                      className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white hover:text-slate-700 dark:hover:text-zinc-200 transition-colors inline-block tracking-tight"
                    >
                      {c.name}
                    </Link>
                  </div>

                  {/* Cycle Description */}
                  <p className="text-sm sm:text-[14.5px] text-slate-700 dark:text-zinc-200 leading-relaxed max-w-3xl font-normal tracking-[-0.012em]">
                    {c.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 sm:self-start flex-wrap">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={async () => {
                        await switchActiveCycle(c.id)
                        success('Workspace switched', `Active cycle changed to ${c.name}.`)
                      }}
                      className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-2xs inline-flex items-center justify-center shrink-0"
                    >
                      <span>Make Active</span>
                    </button>
                  )}

                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(c)}
                      title="Edit Cycle & Deadlines"
                      aria-label="Edit Cycle & Deadlines"
                      className="h-8.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  <Link
                    to={`/admin/cycles/${c.id}`}
                    className="inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-100 text-xs font-semibold hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-2xs hover:shadow-xs border border-transparent shrink-0"
                  >
                    <span>Manage Stage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  {currentUser.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCycleToDelete(c)
                        setShowDeleteConfirm(true)
                      }}
                      title="Delete Review Cycle"
                      aria-label="Delete Review Cycle"
                      className="h-8.5 w-8.5 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer shadow-2xs shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Deadlines Preview Strip */}
              {c.deadlines && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3.5 border-t border-slate-200/80 dark:border-zinc-800 text-[11px] font-sans">
                  <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-800 dark:text-zinc-200 block text-[11px] uppercase font-bold tracking-wider mb-0.5">Goals Due</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">{formatDate(c.deadlines.goalsDue || (c.deadlines as any)?.goal_setting || (c.deadlines as any)?.goals_due)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-800 dark:text-zinc-200 block text-[11px] uppercase font-bold tracking-wider mb-0.5">Self-Review</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">{formatDate(c.deadlines.selfReviewDue || (c.deadlines as any)?.self_review || (c.deadlines as any)?.self_review_due)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-800 dark:text-zinc-200 block text-[11px] uppercase font-bold tracking-wider mb-0.5">Manager Review</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">{formatDate(c.deadlines.managerReviewDue || (c.deadlines as any)?.manager_review || (c.deadlines as any)?.manager_review_due)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100/90 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800">
                    <span className="text-slate-800 dark:text-zinc-200 block text-[11px] uppercase font-bold tracking-wider mb-0.5">Calibration</span>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs">{formatDate(c.deadlines.calibrationDue || (c.deadlines as any)?.calibration || (c.deadlines as any)?.calibration_due)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60">
                    <span className="text-indigo-900 dark:text-indigo-300 block text-[11px] uppercase font-bold tracking-wider mb-0.5">Release Date</span>
                    <span className="font-extrabold text-indigo-950 dark:text-white text-xs">{formatDate(c.deadlines.releaseDate || (c.deadlines as any)?.release_date || (c.deadlines as any)?.released_at || c.endDate)}</span>
                  </div>
                </div>
              )}

              {/* Evaluation Formula with Segmented Proportional Weight Bar */}
              <div className="pt-3.5 border-t border-slate-200/90 dark:border-white/10 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-sans uppercase tracking-wider text-slate-700 dark:text-zinc-300 font-bold">
                    <Scale className="w-3.5 h-3.5 text-indigo-600 dark:text-[#4FE3C1] shrink-0" />
                    <span>Evaluation Component Formula</span>
                  </div>

                  <div className="flex items-center gap-2 font-sans text-xs flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-300/80 dark:border-zinc-700 text-xs font-bold shadow-2xs">
                      Goals: {c.weights?.goals ?? 60}%
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-bold">+</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-300/80 dark:border-zinc-700 text-xs font-bold shadow-2xs">
                      Competencies: {c.weights?.competencies ?? 25}%
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 font-bold">+</span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 border border-slate-300/80 dark:border-zinc-700 text-xs font-bold shadow-2xs">
                      Values: {c.weights?.values ?? 15}%
                    </span>
                    <span className="text-slate-800 dark:text-zinc-200 font-extrabold">= 100%</span>
                  </div>
                </div>

                {/* Proportional Mini Segmented Weight Bar */}
                <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-800 flex items-center gap-1 p-0.5 border border-slate-300/80 dark:border-zinc-700">
                  <div
                    style={{ width: `${c.weights?.goals ?? 60}%` }}
                    className="h-full rounded-full bg-indigo-600 dark:bg-[#4FE3C1] transition-all"
                    title={`Goals: ${c.weights?.goals ?? 60}%`}
                  />
                  <div
                    style={{ width: `${c.weights?.competencies ?? 25}%` }}
                    className="h-full rounded-full bg-slate-400 dark:bg-white/40 transition-all"
                    title={`Competencies: ${c.weights?.competencies ?? 25}%`}
                  />
                  <div
                    style={{ width: `${c.weights?.values ?? 15}%` }}
                    className="h-full rounded-full bg-slate-300 dark:bg-white/20 transition-all"
                    title={`Values: ${c.weights?.values ?? 15}%`}
                  />
                </div>
              </div>
            </div>
          )
        }))}
      </div>

      {/* Pagination / Results count under cards */}
      <div className="flex items-center justify-end pt-1 pb-1 text-xs text-slate-500 dark:text-zinc-400 font-sans">
        <span>Showing {filteredCycles.length} of {cycles.length} cycles</span>
      </div>

      {/* Create Cycle Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Performance Review Cycle"
        subtitle="Configure duration, deterministic deadlines, and appraisal formula"
        maxWidth="2xl"
        onSubmit={handleCreateCycle}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors font-sans text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer"
            >
              Create Cycle
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cycle Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FY27 Annual Performance Review or H1 Cycle"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cycle Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Strategic themes, focus goals, and guidelines for this cohort..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
            />
          </div>

          {/* Performance Period Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <DatePicker
                label="Performance Period Start"
                placeholder="Select start date"
                required
                value={startDate}
                onChange={handleStartDateChange}
              />
            </div>
            <div>
              <DatePicker
                label="Performance Period End"
                placeholder="Select end date"
                required
                value={endDate}
                onChange={handleEndDateChange}
                align="right"
              />
            </div>
          </div>

          {/* Key Cycle Deadlines Section (Admin Editable & Deterministically Calculated) */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Key Cycle Deadlines (Editable)</span>
              </div>
              <button
                type="button"
                onClick={handleRecalculateCreateDeadlines}
                className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Recalculate Suggested</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <DatePicker
                  label="1. Goals Approval Due"
                  placeholder="Select deadline"
                  required
                  value={createDeadlines.goalsDue}
                  onChange={(val) => setCreateDeadlines((prev) => ({ ...prev, goalsDue: val }))}
                />
              </div>
              <div>
                <DatePicker
                  label="2. Self-Reviews Due"
                  placeholder="Select deadline"
                  required
                  value={createDeadlines.selfReviewDue}
                  onChange={(val) => setCreateDeadlines((prev) => ({ ...prev, selfReviewDue: val }))}
                  align="right"
                />
              </div>
              <div>
                <DatePicker
                  label="3. Manager Evaluations Due"
                  placeholder="Select deadline"
                  required
                  value={createDeadlines.managerReviewDue}
                  onChange={(val) => setCreateDeadlines((prev) => ({ ...prev, managerReviewDue: val }))}
                />
              </div>
              <div>
                <DatePicker
                  label="4. Calibration Committee"
                  placeholder="Select deadline"
                  required
                  value={createDeadlines.calibrationDue}
                  onChange={(val) => setCreateDeadlines((prev) => ({ ...prev, calibrationDue: val }))}
                  align="right"
                />
              </div>
              <div className="sm:col-span-2">
                <DatePicker
                  label="5. Official Results Release Date"
                  placeholder="Select release date"
                  required
                  value={createDeadlines.releaseDate}
                  onChange={(val) => setCreateDeadlines((prev) => ({ ...prev, releaseDate: val }))}
                />
              </div>
            </div>
          </div>

          {/* Component Weights */}
          <div className="p-3 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-800 dark:text-zinc-200">Component Weights Formula</span>
              <span
                className={`font-sans text-xs ${
                  totalFormWeights === 100 ? 'text-slate-900 dark:text-white font-bold' : 'text-rose-600 font-bold'
                }`}
              >
                Sum: {totalFormWeights}% (Must equal 100%)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Goals Weight (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 50"
                  value={goalsWeight}
                  onChange={(e) => setGoalsWeight(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-sans bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Competencies (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 30"
                  value={compWeight}
                  onChange={(e) => setCompWeight(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-sans bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Values (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 20"
                  value={valuesWeight}
                  onChange={(e) => setValuesWeight(e.target.value === '' ? '' : parseInt(e.target.value) || 0)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-sans bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {/* Employee Participant Enrollment Option */}
          <div className="p-3.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2.5">
            <label className="font-semibold text-slate-800 dark:text-zinc-200 block">
              Employee Participation Cohort
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="enrollmentMode"
                  value="empty"
                  checked={enrollmentMode === 'empty'}
                  onChange={() => setEnrollmentMode('empty')}
                  className="accent-slate-900 dark:accent-white"
                />
                <span className="text-slate-700 dark:text-zinc-300">
                  <strong>Admin controlled:</strong> Start with 0 participants (assign explicitly later)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="enrollmentMode"
                  value="all"
                  checked={enrollmentMode === 'all'}
                  onChange={() => setEnrollmentMode('all')}
                  className="accent-slate-900 dark:accent-white"
                />
                <span className="text-slate-700 dark:text-zinc-300">
                  Enroll all active employees ({allUsers.filter((u) => u.role !== 'admin').length} staff members)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="enrollmentMode"
                  value="custom"
                  checked={enrollmentMode === 'custom'}
                  onChange={() => setEnrollmentMode('custom')}
                  className="accent-slate-900 dark:accent-white"
                />
                <span className="text-slate-700 dark:text-zinc-300">
                  Select specific employees now ({selectedParticipantIds.length} selected)
                </span>
              </label>
            </div>

            {/* Custom User Picker Roster */}
            {enrollmentMode === 'custom' && (
              <div className="mt-2 space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
                <input
                  type="text"
                  placeholder="Filter employees to assign..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 text-xs bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                />
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900">
                  {filteredUsers.map((user) => {
                    const isSelected = selectedParticipantIds.includes(user.id)
                    return (
                      <label
                        key={user.id}
                        className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedParticipantIds((prev) => [...prev, user.id])
                              } else {
                                setSelectedParticipantIds((prev) => prev.filter((id) => id !== user.id))
                              }
                            }}
                            className="accent-slate-900 dark:accent-white"
                          />
                          <span className="font-medium text-slate-800 dark:text-zinc-200">{user.name}</span>
                          <span className="text-[10px] text-slate-400">({user.designation})</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{user.department}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Cycle Modal */}
      {cycleToEdit && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            if (!isSavingEdit) {
              setShowEditModal(false)
              setCycleToEdit(null)
            }
          }}
          title={`Edit "${cycleToEdit.name}"`}
          subtitle="Update cycle parameters, performance period, deadlines, and formula weights"
          maxWidth="2xl"
          onSubmit={handleSaveEditCycle}
          footer={
            <>
              <button
                type="button"
                disabled={isSavingEdit}
                onClick={() => {
                  setShowEditModal(false)
                  setCycleToEdit(null)
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors font-sans text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEdit}
                className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer"
              >
                {isSavingEdit ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </>
          }
        >
          <div className="space-y-4 text-xs font-sans">
            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cycle Name *</label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">Cycle Description</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
              />
            </div>

            {/* Performance Period Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <DatePicker
                  label="Performance Period Start"
                  required
                  value={editStartDate}
                  onChange={(val) => setEditStartDate(val)}
                />
              </div>
              <div>
                <DatePicker
                  label="Performance Period End"
                  required
                  value={editEndDate}
                  onChange={(val) => setEditEndDate(val)}
                  align="right"
                />
              </div>
            </div>

            {/* Key Cycle Deadlines Section (Admin Editable) */}
            <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Key Cycle Deadlines (Admin Editable)</span>
                </div>
                <button
                  type="button"
                  onClick={handleRecalculateEditDeadlines}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Recalculate Recommended</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <DatePicker
                    label="1. Goals Approval Due"
                    required
                    value={editDeadlines.goalsDue}
                    onChange={(val) => setEditDeadlines((prev) => ({ ...prev, goalsDue: val }))}
                  />
                </div>
                <div>
                  <DatePicker
                    label="2. Self-Reviews Due"
                    required
                    value={editDeadlines.selfReviewDue}
                    onChange={(val) => setEditDeadlines((prev) => ({ ...prev, selfReviewDue: val }))}
                    align="right"
                  />
                </div>
                <div>
                  <DatePicker
                    label="3. Manager Evaluations Due"
                    required
                    value={editDeadlines.managerReviewDue}
                    onChange={(val) => setEditDeadlines((prev) => ({ ...prev, managerReviewDue: val }))}
                  />
                </div>
                <div>
                  <DatePicker
                    label="4. Calibration Committee"
                    required
                    value={editDeadlines.calibrationDue}
                    onChange={(val) => setEditDeadlines((prev) => ({ ...prev, calibrationDue: val }))}
                    align="right"
                  />
                </div>
                <div className="sm:col-span-2">
                  <DatePicker
                    label="5. Official Results Release Date"
                    required
                    value={editDeadlines.releaseDate}
                    onChange={(val) => setEditDeadlines((prev) => ({ ...prev, releaseDate: val }))}
                  />
                </div>
              </div>
            </div>

            {/* Component Weights */}
            <div className="p-3 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-800 dark:text-zinc-200">Component Weights Formula</span>
                <span
                  className={`font-sans text-xs ${
                    totalEditWeights === 100 ? 'text-slate-900 dark:text-white font-bold' : 'text-rose-600 font-bold'
                  }`}
                >
                  Sum: {totalEditWeights}% (Must equal 100%)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Goals Weight (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g. 50"
                    value={editGoalsWeight}
                    onChange={(e) => setEditGoalsWeight(e.target.value === '' ? '' as any : parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-sans bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Competencies (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g. 30"
                    value={editCompWeight}
                    onChange={(e) => setEditCompWeight(e.target.value === '' ? '' as any : parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-sans bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-500 dark:text-zinc-400 block mb-1">Values (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    placeholder="e.g. 20"
                    value={editValuesWeight}
                    onChange={(e) => setEditValuesWeight(e.target.value === '' ? '' as any : parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 font-sans bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100"
                  />
                </div>
              </div>
            </div>

          </div>
        </Modal>
      )}

      {/* Delete Review Cycle Confirmation Dialog */}
      {cycleToDelete && (
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          onClose={() => {
            if (!isDeleting) {
              setShowDeleteConfirm(false)
              setCycleToDelete(null)
            }
          }}
          onConfirm={handleDeleteCycle}
          title={`Permanently Delete "${cycleToDelete.name}"?`}
          message={`Are you sure you want to delete this review cycle? All goals, evaluations, self-reviews, and calibration records in this cycle will be permanently deleted. This action cannot be undone.`}
          confirmText="Permanently Delete Cycle"
          variant="danger"
          isLoading={isDeleting}
        />
      )}
    </div>
  )
}

