import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { cycleService, storageService } from '../../services'
import { LoadingState } from '../../components/ui/LoadingState'
import {
  ReviewCycle,
  User,
  CycleWeights,
  CycleStage,
  Goal,
  SelfReview,
  ManagerReview,
  CalibrationRecord,
  EvaluationResult,
} from '../../types'
import { StageStepper } from '../../components/ui/StageStepper'
import { CycleStageBadge } from '../../components/ui/Badge'
import { CustomDropdown } from '../../components/ui/CustomDropdown'
import { Modal, ConfirmDialog } from '../../components/ui/Modal'
import { AvatarGroup } from '../../components/ui/AvatarGroup'
import { DatePicker } from '../../components/ui/DatePicker'
import { CYCLE_STAGE_DETAILS, STAGE_ORDER, formatDate } from '../../lib/formatters'
import { generateDeterministicDeadlines, validateCycleDatesAndDeadlines } from '../../lib/deadlines'
import { validateCycleWeights } from '../../lib/validation'
import { getAdminWorkflowState, matchesUser, matchesCycle } from '../../lib/workflow'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FastForward,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  TrendingUp,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

export const AdminCycleDetail: React.FC = () => {
  const { cycleId } = useParams<{ cycleId: string }>()
  const navigate = useNavigate()
  const { refreshData, allCycles, activeCycle, allUsers, currentUser } = useApp()
  const { success, error, warning } = useToast()

  const [cycle, setCycle] = useState<ReviewCycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [enrolledUsers, setEnrolledUsers] = useState<User[]>([])

  // Live Workflow Artifacts for Synchronized Effective Stage
  const [goals, setGoals] = useState<Goal[]>([])
  const [selfReviews, setSelfReviews] = useState<SelfReview[]>([])
  const [managerReviews, setManagerReviews] = useState<ManagerReview[]>([])
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([])
  const [results, setResults] = useState<EvaluationResult[]>([])

  // Stage Advance & Fast Switch State
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
  const [isAdvancing, setIsAdvancing] = useState(false)
  const [targetStageToSwitch, setTargetStageToSwitch] = useState<CycleStage | null>(null)
  const [showSwitchStageModal, setShowSwitchStageModal] = useState(false)
  const [isSwitchingStage, setIsSwitchingStage] = useState(false)

  // Cohort Management Modal State
  const [showCohortModal, setShowCohortModal] = useState(false)
  const [cohortSearch, setCohortSearch] = useState('')
  const [cohortDeptFilter, setCohortDeptFilter] = useState('all')
  const [selectedUnenrolledIds, setSelectedUnenrolledIds] = useState<string[]>([])
  const [unenrolledSearch, setUnenrolledSearch] = useState('')

  // Remove Participant State
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<User | null>(null)
  const [participantHasHistory, setParticipantHasHistory] = useState(false)
  const [historyNotes, setHistoryNotes] = useState<string[]>([])
  const [isRemoving, setIsRemoving] = useState(false)

  // Enroll Participant State
  const [isEnrolling, setIsEnrolling] = useState(false)

  // Edit Cycle & Deadlines Modal State
  const [showEditCycleModal, setShowEditCycleModal] = useState(false)
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
  const [isSavingCycle, setIsSavingCycle] = useState(false)

  // Delete Review Cycle State
  const [showDeleteCycleConfirm, setShowDeleteCycleConfirm] = useState(false)
  const [isDeletingCycle, setIsDeletingCycle] = useState(false)

  const isAdmin = currentUser.role === 'admin'

  const fetchCycleData = async () => {
    if (!cycleId) {
      setLoading(false)
      return
    }
    try {
      const data = await cycleService.getById(cycleId)
      setCycle(data)
      if (data) {
        const participants = await cycleService.getEnrolledParticipants(data.id)
        setEnrolledUsers(participants)

        // Load all evaluation records for this cycle to accurately compute synchronized workflow state
        const state = storageService.getState()
        setGoals((state.goals || []).filter((g) => g.cycleId === data.id || matchesCycle(g.cycleId, data.id)))
        setSelfReviews((state.selfReviews || []).filter((s) => s.cycleId === data.id || matchesCycle(s.cycleId, data.id)))
        setManagerReviews((state.managerReviews || []).filter((m) => m.cycleId === data.id || matchesCycle(m.cycleId, data.id)))
        setCalibrations((state.calibrations || []).filter((c) => c.cycleId === data.id || matchesCycle(c.cycleId, data.id)))
        setResults((state.results || []).filter((r) => r.cycleId === data.id || matchesCycle(r.cycleId, data.id)))
      }
    } catch (err) {
      console.warn('Notice loading cycle data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchCycleData().finally(() => {
      clearTimeout(safetyTimer)
    })

    // Real-time synchronization when workflow state updates
    const unsubscribe = storageService.subscribe(() => {
      if (isMounted) {
        fetchCycleData()
      }
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
      unsubscribe()
    }
  }, [cycleId])

  if (loading) {
    return <LoadingState message="Loading review cycle details & roster..." variant="page" />
  }

  if (!cycle) {
    return (
      <div className="p-8 text-center space-y-3 font-sans">
        <h2 className="text-base font-bold text-slate-800 dark:text-zinc-200">Review Cycle Not Found</h2>
        <Link to="/admin/cycles" className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold">
          Return to All Cycles
        </Link>
      </div>
    )
  }

  // Synchronized workflow stage for this cycle, exactly matching the Dashboard workflow state
  const workflowState = getAdminWorkflowState({
    cycle,
    totalEmployees: enrolledUsers.length,
    selfReviews,
    managerReviews,
    calibrations,
    results,
    goals,
  })

  const effectiveStage = workflowState.effectiveStage
  const effectiveIndex = STAGE_ORDER.indexOf(effectiveStage)
  const isFinalStage = effectiveIndex >= STAGE_ORDER.length - 1
  const nextStage = !isFinalStage ? STAGE_ORDER[effectiveIndex + 1] : null
  const nextStageInfo = nextStage ? CYCLE_STAGE_DETAILS[nextStage] : null

  // Milestone Completion Metrics
  const submittedSelfCount = selfReviews.filter((s) => s.status === 'submitted').length
  const submittedManagerCount = managerReviews.filter((m) => m.status === 'submitted').length
  const approvedCalibrationsCount = calibrations.filter((c) => c.adminApproved).length
  const publishedResultsCount = results.length
  const approvedGoalsCount = goals.filter((g) => g.status === 'approved' || g.status === 'completed').length
  const totalEnrolled = enrolledUsers.length

  let isCurrentStageComplete = false
  let stageProgressText = ''

  switch (effectiveStage) {
    case 'draft':
      isCurrentStageComplete = totalEnrolled > 0
      stageProgressText = totalEnrolled > 0 ? `${totalEnrolled} staff enrolled` : 'No participants enrolled yet'
      break
    case 'goals_open':
      isCurrentStageComplete = goals.length > 0 && approvedGoalsCount >= goals.length
      stageProgressText = `${approvedGoalsCount} of ${goals.length || totalEnrolled} strategic goals approved`
      break
    case 'tracking':
      isCurrentStageComplete = goals.length > 0 && goals.every((g) => g.progress >= 50)
      stageProgressText = `${goals.length} active goals tracked`
      break
    case 'self_review':
      isCurrentStageComplete = totalEnrolled > 0 && submittedSelfCount >= totalEnrolled
      stageProgressText = `${submittedSelfCount} of ${totalEnrolled} self-evaluations submitted`
      break
    case 'manager_review':
      isCurrentStageComplete = totalEnrolled > 0 && submittedManagerCount >= totalEnrolled
      stageProgressText = `${submittedManagerCount} of ${totalEnrolled} manager reviews submitted`
      break
    case 'calibration':
      isCurrentStageComplete = submittedManagerCount > 0 && approvedCalibrationsCount >= submittedManagerCount
      stageProgressText = `${approvedCalibrationsCount} of ${submittedManagerCount || totalEnrolled} calibrations approved`
      break
    case 'released':
      isCurrentStageComplete = publishedResultsCount >= totalEnrolled
      stageProgressText = `${publishedResultsCount} of ${totalEnrolled} official appraisal results published`
      break
    case 'closed':
      isCurrentStageComplete = true
      stageProgressText = 'Cycle finalized and archived'
      break
  }

  // Open Edit Cycle Modal
  const handleOpenEditCycleModal = () => {
    setEditName(cycle.name)
    setEditDescription(cycle.description || '')
    setEditStartDate(cycle.startDate)
    setEditEndDate(cycle.endDate)
    setEditGoalsWeight(cycle.weights?.goals ?? 60)
    setEditCompWeight(cycle.weights?.competencies ?? 25)
    setEditValuesWeight(cycle.weights?.values ?? 15)
    setEditDeadlines({
      goalsDue: cycle.deadlines?.goalsDue || (cycle.deadlines as any)?.goal_setting || (cycle.deadlines as any)?.goals_due || '',
      selfReviewDue: cycle.deadlines?.selfReviewDue || (cycle.deadlines as any)?.self_review || (cycle.deadlines as any)?.self_review_due || '',
      managerReviewDue: cycle.deadlines?.managerReviewDue || (cycle.deadlines as any)?.manager_review || (cycle.deadlines as any)?.manager_review_due || '',
      calibrationDue: cycle.deadlines?.calibrationDue || (cycle.deadlines as any)?.calibration || (cycle.deadlines as any)?.calibration_due || '',
      releaseDate: cycle.deadlines?.releaseDate || (cycle.deadlines as any)?.release_date || (cycle.deadlines as any)?.released_at || cycle.endDate || '',
    })
    setShowEditCycleModal(true)
  }

  const handleRecalculateDeadlines = () => {
    const suggested = generateDeterministicDeadlines(editStartDate, editEndDate)
    setEditDeadlines(suggested)
    success('Deadlines recalculated', 'Deterministic dates applied based on cycle period.')
  }

  const handleSaveCycleEdits = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cycle) return

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

    setIsSavingCycle(true)
    try {
      const updated = await cycleService.update(cycle.id, {
        name: editName,
        description: editDescription,
        startDate: editStartDate,
        endDate: editEndDate,
        weights,
        deadlines: editDeadlines,
      })

      setCycle(updated)
      setShowEditCycleModal(false)
      await refreshData()
      success('Cycle updated', `"${editName}" details and deadlines saved successfully.`)
    } catch (err: any) {
      error('Failed to update cycle', err.message || 'An unexpected error occurred.')
    } finally {
      setIsSavingCycle(false)
    }
  }

  // Advance stage handler
  const handleAdvance = async () => {
    if (!cycle || !nextStage) return
    setIsAdvancing(true)
    try {
      const updated = await cycleService.setStage(cycle.id, nextStage)
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

  // Fast Stage Switch Handlers (When clicking any node in StageStepper)
  const handleRequestStageSelect = (targetStage: CycleStage) => {
    if (!isAdmin || !cycle) return
    if (targetStage === effectiveStage) return
    setTargetStageToSwitch(targetStage)
    setShowSwitchStageModal(true)
  }

  const handleConfirmStageSwitch = async () => {
    if (!cycle || !targetStageToSwitch) return
    setIsSwitchingStage(true)
    try {
      const updated = await cycleService.setStage(cycle.id, targetStageToSwitch)
      setCycle(updated)
      setShowSwitchStageModal(false)
      setTargetStageToSwitch(null)
      await refreshData()
      success(
        'Stage Switched',
        `Cycle stage manually transitioned to "${CYCLE_STAGE_DETAILS[updated.stage].label}".`
      )
    } catch (err: any) {
      error('Failed to switch stage', err.message)
    } finally {
      setIsSwitchingStage(false)
    }
  }

  // Trigger Remove Participant Dialog (with audit history check)
  const handleRequestRemoveParticipant = async (user: User) => {
    setParticipantToRemove(user)
    try {
      const history = await cycleService.checkParticipantEvaluationHistory(cycle.id, user.id)
      setParticipantHasHistory(history.isProtected)
      const notes: string[] = []
      if (history.hasSelfReview) notes.push('Submitted Self-Review')
      if (history.hasManagerReview) notes.push('Completed Manager Evaluation')
      if (history.hasResult) notes.push('Calibrated Final Result')
      setHistoryNotes(notes)
    } catch {
      setParticipantHasHistory(false)
      setHistoryNotes([])
    }
    setShowRemoveConfirm(true)
  }

  // Remove participant confirmed
  const handleRemoveParticipant = async () => {
    if (!participantToRemove || !cycle) return
    if (!isAdmin) {
      error('Access Denied', 'Only administrators can remove participants from a review cycle.')
      return
    }

    setIsRemoving(true)
    try {
      const updatedCycle = await cycleService.removeParticipant(
        cycle.id,
        participantToRemove.id,
        currentUser.name,
        false // Do not blindly purge submitted evaluations
      )
      setCycle(updatedCycle)
      const updatedList = await cycleService.getEnrolledParticipants(cycle.id)
      setEnrolledUsers(updatedList)
      setShowRemoveConfirm(false)
      setParticipantToRemove(null)
      await refreshData()

      success(
        'Employee Removed',
        `${participantToRemove.name} was successfully removed from review cycle "${cycle.name}". Submitted history is preserved in audit logs.`
      )
    } catch (err: any) {
      error('Failed to remove employee', err.message)
    } finally {
      setIsRemoving(false)
    }
  }

  // Enroll single participant handler (Admin only)
  const handleEnrollParticipant = async (userToEnroll: User) => {
    if (!cycle || !isAdmin || userToEnroll.role === 'admin') return
    setIsEnrolling(true)
    try {
      const updatedCycle = await cycleService.addParticipant(
        cycle.id,
        userToEnroll.id,
        currentUser.name
      )
      setCycle(updatedCycle)
      const updatedList = await cycleService.getEnrolledParticipants(cycle.id)
      setEnrolledUsers(updatedList)
      await refreshData()

      success(
        'Employee Enrolled',
        `${userToEnroll.name} was enrolled into review cycle "${cycle.name}".`
      )
    } catch (err: any) {
      error('Enrollment failed', err.message)
    } finally {
      setIsEnrolling(false)
    }
  }

  // Enroll bulk participants handler (Admin only)
  const handleEnrollBulkParticipants = async () => {
    if (!cycle || !isAdmin || selectedUnenrolledIds.length === 0) return
    setIsEnrolling(true)
    try {
      const updatedCycle = await cycleService.addParticipantsBulk(
        cycle.id,
        selectedUnenrolledIds,
        currentUser.name
      )
      setCycle(updatedCycle)
      const updatedList = await cycleService.getEnrolledParticipants(cycle.id)
      setEnrolledUsers(updatedList)
      setSelectedUnenrolledIds([])
      await refreshData()

      success(
        'Employees Enrolled',
        `Successfully enrolled ${selectedUnenrolledIds.length} employee(s) into "${cycle.name}".`
      )
    } catch (err: any) {
      error('Bulk enrollment failed', err.message)
    } finally {
      setIsEnrolling(false)
    }
  }

  // Delete review cycle handler (Admin only)
  const handleDeleteCycle = async () => {
    if (!cycle) return
    if (!isAdmin) {
      error('Access Denied', 'Only administrators can delete review cycles.')
      return
    }

    setIsDeletingCycle(true)
    try {
      await cycleService.delete(cycle.id, currentUser.name)
      await refreshData()
      setShowDeleteCycleConfirm(false)
      success(
        'Review Cycle Deleted',
        `"${cycle.name}" and its associated evaluation cohort records were permanently removed.`
      )
      navigate('/admin/cycles', { replace: true })
    } catch (err: any) {
      error('Cannot delete cycle', err.message)
    } finally {
      setIsDeletingCycle(false)
    }
  }

  // Filter cohort participants in modal
  const filteredCohort = enrolledUsers.filter((u) => {
    if (cohortDeptFilter !== 'all' && u.department !== cohortDeptFilter) return false
    if (cohortSearch.trim()) {
      const q = cohortSearch.toLowerCase()
      const nameMatch = u.name.toLowerCase().includes(q)
      const emailMatch = u.email.toLowerCase().includes(q)
      const titleMatch = u.designation?.toLowerCase().includes(q)
      const deptMatch = u.department?.toLowerCase().includes(q)
      return nameMatch || emailMatch || titleMatch || deptMatch
    }
    return true
  })

  // Filter eligible staff for appraisal cohort: strictly exclude administrators
  const eligibleStaff = allUsers.filter((u) => u.role !== 'admin')

  // Unenrolled users available to be enrolled (eligible non-admin staff only)
  const unenrolledUsers = eligibleStaff.filter(
    (u) => !enrolledUsers.some((eu) => eu.id === u.id || matchesUser(eu.id, u.id))
  )

  const filteredUnenrolled = unenrolledUsers.filter((u) => {
    if (!unenrolledSearch.trim()) return true
    const q = unenrolledSearch.toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q) ||
      u.designation.toLowerCase().includes(q)
    )
  })

  const departments = Array.from(new Set(eligibleStaff.map((u) => u.department))).filter(Boolean)
  const totalEditWeights = Number(editGoalsWeight) + Number(editCompWeight) + Number(editValuesWeight)

  return (
    <div className="space-y-4 w-full pb-3 font-sans">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/cycles')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors cursor-pointer font-sans"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Review Cycles</span>
        </button>

        {isAdmin && (
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleOpenEditCycleModal}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs font-sans"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Cycle & Deadlines</span>
            </button>

            <button
              type="button"
              onClick={() => setShowDeleteCycleConfirm(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold transition-all cursor-pointer shadow-2xs font-sans"
              title="Permanently delete this review cycle"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Cycle</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Cycle Card */}
      <div className="dark-glass-card conic-border-glow p-6 sm:p-8 space-y-6">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100 dark:border-white/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <CycleStageBadge stage={effectiveStage} />
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-sans font-medium">
                Stage {effectiveIndex + 1} of {STAGE_ORDER.length}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-zinc-400 font-sans">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400 shrink-0" />
                <span>{formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {cycle.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 max-w-3xl leading-relaxed">
              {cycle.description}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto flex-wrap">
            {!isFinalStage ? (
              <button
                type="button"
                onClick={() => setShowAdvanceConfirm(true)}
                className="premium-glow-btn h-11 px-5 text-xs font-semibold cursor-pointer inline-flex items-center gap-2"
              >
                <FastForward className="w-4 h-4" />
                <span>Advance to {nextStageInfo?.label}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-700 dark:text-zinc-300 font-sans font-semibold px-3 py-1.5 bg-slate-100 dark:bg-white/[0.04] rounded-xl border border-slate-200 dark:border-white/[0.08]">
                Cycle Completed
              </span>
            )}
          </div>
        </div>

        {/* Visual Stepper */}
        <StageStepper
          currentStage={effectiveStage}
          cycle={cycle}
          readOnly={!isAdmin}
          onStageSelect={isAdmin ? handleRequestStageSelect : undefined}
          showCycleInfo={false}
        />

        {/* Live Stage Progression Status Banner */}
        <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/90 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-sans">
                Active Workflow Stage: {CYCLE_STAGE_DETAILS[effectiveStage].label}
              </span>
                {isCurrentStageComplete ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/50">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Stage Milestones Completed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-zinc-700">
                    <span>In Progress</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 dark:text-zinc-300 mt-1 truncate font-medium">
                {stageProgressText} • {CYCLE_STAGE_DETAILS[effectiveStage].description}
              </p>
            </div>

          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            {isCurrentStageComplete && !isFinalStage && (
              <button
                type="button"
                onClick={() => setShowAdvanceConfirm(true)}
                className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Ready to Advance →</span>
              </button>
            )}
            {isAdmin && !isFinalStage && !isCurrentStageComplete && (
              <button
                type="button"
                onClick={() => setShowAdvanceConfirm(true)}
                className="h-9 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-semibold transition-all cursor-pointer shadow-2xs inline-flex items-center gap-1.5"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Advance Stage</span>
              </button>
            )}
          </div>
        </div>

        {/* Stage Tasks & Timeline Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Key Deadlines Card */}
          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-slate-700 dark:text-zinc-300 shrink-0" />
                <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-white text-xs font-sans">
                  Key Cycle Deadlines
                </h3>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenEditCycleModal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-[#8B7CFF] hover:underline cursor-pointer"
                >
                  <Pencil className="w-3 h-3" />
                  <span>Edit Dates</span>
                </button>
              )}
            </div>

            <div className="space-y-3.5 text-sm font-sans">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Goals Approval Due</span>
                <span className="font-bold text-slate-900 dark:text-white font-sans text-sm">
                  {formatDate(cycle.deadlines?.goalsDue || (cycle.deadlines as any)?.goal_setting || (cycle.deadlines as any)?.goals_due)}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Self-Reviews Due</span>
                <span className="font-bold text-slate-900 dark:text-white font-sans text-sm">
                  {formatDate(cycle.deadlines?.selfReviewDue || (cycle.deadlines as any)?.self_review || (cycle.deadlines as any)?.self_review_due)}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Manager Evaluations Due</span>
                <span className="font-bold text-slate-900 dark:text-white font-sans text-sm">
                  {formatDate(cycle.deadlines?.managerReviewDue || (cycle.deadlines as any)?.manager_review || (cycle.deadlines as any)?.manager_review_due)}
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Calibration Committee</span>
                <span className="font-bold text-slate-900 dark:text-white font-sans text-sm">
                  {formatDate(cycle.deadlines?.calibrationDue || (cycle.deadlines as any)?.calibration || (cycle.deadlines as any)?.calibration_due)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Official Results Release</span>
                <span className="font-bold font-sans text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs">
                  {formatDate(cycle.deadlines?.releaseDate || (cycle.deadlines as any)?.release_date || (cycle.deadlines as any)?.released_at || cycle.endDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Evaluation Formula Weights Card */}
          <div className="bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <Scale className="w-4 h-4 text-slate-700 dark:text-zinc-300 shrink-0" />
                <h3 className="font-bold uppercase tracking-wider text-slate-900 dark:text-white text-xs font-sans">
                  Evaluation Component Weights
                </h3>
              </div>
              <span className="text-xs font-sans font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-zinc-700">
                100% Total
              </span>
            </div>

            <div className="space-y-3.5 text-sm font-sans">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Strategic Performance Goals</span>
                <span className="font-bold font-sans text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs">
                  {cycle.weights.goals}%
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Core Competencies</span>
                <span className="font-bold font-sans text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs">
                  {cycle.weights.competencies}%
                </span>
              </div>
              <div className="flex items-center justify-between py-0.5">
                <span className="text-slate-700 dark:text-zinc-300 font-medium text-sm">Cultural & Organizational Values</span>
                <span className="font-bold font-sans text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs">
                  {cycle.weights.values}%
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white">
                <span className="font-bold text-sm text-slate-900 dark:text-white">Balanced Calculation Formula</span>
                <span className="font-bold font-sans text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-2xs">
                  100% Balanced
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enrolled Participant Cohort Card (Interactive & Directly Manageable) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/[0.08] transition-all">
          <div className="flex items-center gap-3.5">
            <AvatarGroup users={enrolledUsers} max={7} size="md" />
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{enrolledUsers.length} Enrolled Appraisal Participants</span>
                {isAdmin && (
                  <span className="text-[10px] font-sans font-semibold text-indigo-600 dark:text-[#8B7CFF] bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                    Admin Controlled
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-700 dark:text-zinc-300 font-medium">
                Explicit participant cohort participating in {cycle.name}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCohortModal(true)}
            className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 text-xs font-semibold cursor-pointer inline-flex items-center gap-2 shadow-xs transition-all self-start sm:self-auto shrink-0 border border-transparent dark:border-white/10"
          >
            <Users className="w-3.5 h-3.5 opacity-80" />
            <span>Manage Enrolled Cohort ({enrolledUsers.length})</span>
          </button>
        </div>

        {/* Stage-Specific Tasks Checklist */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-sans font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Current Stage Operational Tasks: {CYCLE_STAGE_DETAILS[effectiveStage].label}
              </h3>
              <p className="text-xs text-slate-700 dark:text-zinc-300 mt-0.5 font-medium">
                {CYCLE_STAGE_DETAILS[effectiveStage].description}
              </p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400 font-semibold hidden sm:inline">
              Stage {effectiveIndex + 1} of {STAGE_ORDER.length}
            </span>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.08] text-xs text-slate-700 dark:text-[#E6E9F2] space-y-2.5 font-sans">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
              <span>Verify participant cohort eligibility ({enrolledUsers.length} active employees assigned)</span>
            </div>

            {effectiveStage === 'draft' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 ${enrolledUsers.length > 0 ? 'text-emerald-600 dark:text-[#4FE3C1]' : 'text-slate-300 dark:text-zinc-600'} shrink-0`} />
                  <span>Enroll participant cohort ({enrolledUsers.length} staff enrolled)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
                  <span>Configure appraisal component weights & stage deadlines</span>
                </div>
              </>
            )}

            {effectiveStage === 'goals_open' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 ${goals.length > 0 ? 'text-emerald-600 dark:text-[#4FE3C1]' : 'text-slate-300 dark:text-zinc-600'} shrink-0`} />
                  <span>Employees define strategic performance goals ({goals.length} goals recorded)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 ${approvedGoalsCount >= (goals.length || 1) && goals.length > 0 ? 'text-emerald-600 dark:text-[#4FE3C1]' : 'text-slate-300 dark:text-zinc-600'} shrink-0`} />
                  <span>Department manager goal approvals ({approvedGoalsCount} of {goals.length} approved)</span>
                </div>
              </>
            )}

            {effectiveStage === 'tracking' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
                  <span>Strategic OKR milestones and execution check-ins active</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
                  <span>Monitor milestone progress ahead of self-evaluation window</span>
                </div>
              </>
            )}

            {effectiveStage === 'self_review' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 ${submittedSelfCount > 0 ? 'text-emerald-600 dark:text-[#4FE3C1]' : 'text-slate-300 dark:text-zinc-600'} shrink-0`} />
                  <span>Employee self-reflections submitted ({submittedSelfCount} of {totalEnrolled} completed)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-300 dark:text-zinc-600 shrink-0" />
                  <span>Unlock manager evaluations as self-reviews complete</span>
                </div>
              </>
            )}

            {effectiveStage === 'manager_review' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
                  <span>Employee self-reviews completed ({submittedSelfCount} submitted)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 ${submittedManagerCount >= totalEnrolled && totalEnrolled > 0 ? 'text-emerald-600 dark:text-[#4FE3C1]' : 'text-slate-300 dark:text-zinc-600'} shrink-0`} />
                  <span>Department manager evaluations ({submittedManagerCount} of {totalEnrolled} completed)</span>
                </div>
                <div className="flex items-center gap-2.5 text-indigo-600 dark:text-[#8B7CFF] font-semibold pt-1">
                  <Users className="w-4 h-4 shrink-0" />
                  <Link to="/admin/users" className="underline hover:text-indigo-800 dark:hover:text-white transition-colors">
                    Inspect Talent Directory to track department completion rates →
                  </Link>
                </div>
              </>
            )}

            {effectiveStage === 'calibration' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
                  <span>Manager appraisals submitted ({submittedManagerCount} appraisals submitted)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className={`w-4 h-4 ${approvedCalibrationsCount >= (submittedManagerCount || 1) && submittedManagerCount > 0 ? 'text-emerald-600 dark:text-[#4FE3C1]' : 'text-slate-300 dark:text-zinc-600'} shrink-0`} />
                  <span>Calibration Committee review & Admin approval ({approvedCalibrationsCount} of {submittedManagerCount} approved)</span>
                </div>
                <div className="flex items-center gap-2.5 text-indigo-600 dark:text-[#8B7CFF] font-semibold pt-1">
                  <Sliders className="w-4 h-4 shrink-0" />
                  <Link to="/admin/calibration" className="underline hover:text-indigo-800 dark:hover:text-white transition-colors">
                    Calibration Hub is active: click here to inspect dossiers & grant permission →
                  </Link>
                </div>
              </>
            )}

            {effectiveStage === 'released' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
                  <span>Calibrated ratings and executive approvals finalized</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
                  <span>Official appraisal scorecards released ({publishedResultsCount} results published)</span>
                </div>
                <div className="flex items-center gap-2.5 text-indigo-600 dark:text-[#8B7CFF] font-semibold pt-1">
                  <Link to="/admin/reports" className="underline hover:text-indigo-800 dark:hover:text-white transition-colors">
                    Inspect cycle rating distributions and executive analytics →
                  </Link>
                </div>
              </>
            )}

            {effectiveStage === 'closed' && (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-[#4FE3C1] shrink-0" />
                  <span>Appraisal cycle concluded and historical records archived</span>
                </div>
                <div className="flex items-center gap-2.5 text-indigo-600 dark:text-[#8B7CFF] font-semibold pt-1">
                  <Link to="/admin/audit" className="underline hover:text-indigo-800 dark:hover:text-white transition-colors">
                    View system audit trail and cycle compliance logs →
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Admin Danger Zone Section (Cycle Deletion) */}
        {isAdmin && (
          <div className="pt-6 border-t border-slate-200/80 dark:border-white/[0.08] space-y-3">
            <div className="p-5 rounded-2xl border border-red-500/20 bg-red-500/[0.03] dark:bg-red-500/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider font-sans">
                  <ShieldAlert className="w-4 h-4" />
                  <span>Admin Danger Zone</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Permanently Delete Review Cycle
                </h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xl">
                  Permanently removes "{cycle.name}" and purges all participant evaluations, goals, self-reviews, and calibrations associated with this cycle. This action cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeleteCycleConfirm(true)}
                className="h-10 px-4 rounded-xl border border-red-500/40 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-all cursor-pointer shadow-xs inline-flex items-center gap-2 shrink-0 self-start sm:self-auto"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Review Cycle</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cohort Participant Management Modal */}
      <Modal
        isOpen={showCohortModal}
        onClose={() => setShowCohortModal(false)}
        title="Manage Review Cycle Participants"
        subtitle={`Explicitly assigned employees for ${cycle.name} (${enrolledUsers.length} total enrolled)`}
        maxWidth="2xl"
        footer={
          <button
            type="button"
            onClick={() => setShowCohortModal(false)}
            className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 text-xs font-semibold cursor-pointer transition-all"
          >
            Done
          </button>
        }
      >
        <div className="space-y-5 font-sans">
          {/* Search & Department Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={cohortSearch}
                onChange={(e) => setCohortSearch(e.target.value)}
                placeholder="Search enrolled staff by name, email, department..."
                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white dark:bg-[#18181b] border border-slate-200/90 dark:border-white/10 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:border-slate-400 dark:focus:border-white/30 transition-all font-sans shadow-2xs"
              />
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <CustomDropdown
                value={cohortDeptFilter}
                onChange={setCohortDeptFilter}
                align="right"
                triggerClassName="h-10 px-3.5 rounded-xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold shadow-2xs w-full sm:w-auto sm:min-w-[190px]"
                menuClassName="w-full sm:w-56 rounded-xl border border-slate-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#18181b] shadow-xl p-1 z-[120]"
                options={[
                  { value: 'all', label: `All Departments (${enrolledUsers.length})` },
                  ...departments.map((dept) => {
                    const count = enrolledUsers.filter((u) => u.department === dept).length
                    return {
                      value: dept,
                      label: count > 0 ? `${dept} (${count})` : dept,
                    }
                  }),
                ]}
              />
            </div>
          </div>

          {/* Enrolled Staff Roster */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden bg-white dark:bg-zinc-900/60 shadow-2xs">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 flex items-center justify-between text-xs font-sans">
              <span className="font-bold text-slate-700 dark:text-zinc-300">
                Active Participants ({filteredCohort.length})
              </span>
              <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                {isAdmin ? 'Admin can remove any employee safely' : 'Read-only view'}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto no-scrollbar divide-y divide-slate-100 dark:divide-white/[0.06]">
              {filteredCohort.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 dark:text-zinc-500 font-sans">
                  {enrolledUsers.length === 0
                    ? 'No participants currently assigned to this cycle. Use the Add Staff section below to assign employees.'
                    : 'No enrolled participants match the current search filters.'}
                </div>
              ) : (
                filteredCohort.map((user) => (
                  <div
                    key={user.id}
                    className="p-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-slate-200 dark:ring-white/10 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2 truncate">
                          <span>{user.name}</span>
                          {user.employeeCode && (
                            <span className="text-[10px] font-sans text-slate-400 dark:text-zinc-500">
                              #{user.employeeCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                          {user.designation} • {user.department}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-sans font-medium bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
                        <UserCheck className="w-3 h-3" />
                        <span>Enrolled</span>
                      </span>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRequestRemoveParticipant(user)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 text-red-600 dark:text-red-400 text-xs font-semibold cursor-pointer transition-all shadow-2xs font-sans"
                          title={`Remove ${user.name} from this review cycle`}
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Unenrolled Staff Assignment Section (Admin Only, Multi-Select & Bulk Enrollment) */}
          {isAdmin && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-white/[0.02] border border-indigo-100 dark:border-white/10 space-y-3 font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600 dark:text-[#8B7CFF]" />
                  <span className="font-bold text-xs text-slate-900 dark:text-white font-sans">
                    Assign Eligible Staff to Cycle ({unenrolledUsers.length} available)
                  </span>
                </div>

                {filteredUnenrolled.length > 0 && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedUnenrolledIds.length === filteredUnenrolled.length) {
                          setSelectedUnenrolledIds([])
                        } else {
                          setSelectedUnenrolledIds(filteredUnenrolled.map((u) => u.id))
                        }
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      {selectedUnenrolledIds.length === filteredUnenrolled.length ? 'Deselect All' : 'Select All'}
                    </button>
                    {selectedUnenrolledIds.length > 0 && (
                      <button
                        type="button"
                        disabled={isEnrolling}
                        onClick={handleEnrollBulkParticipants}
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer transition-all"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Assign Selected ({selectedUnenrolledIds.length})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {unenrolledUsers.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  All active employees are already enrolled in this cycle.
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    value={unenrolledSearch}
                    onChange={(e) => setUnenrolledSearch(e.target.value)}
                    placeholder="Search unenrolled staff by name, title, or department..."
                    className="w-full h-8 px-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                  />

                  <div className="max-h-48 overflow-y-auto no-scrollbar divide-y divide-indigo-100/60 dark:divide-white/[0.04]">
                    {filteredUnenrolled.map((user) => {
                      const isSelected = selectedUnenrolledIds.includes(user.id)

                      return (
                        <div
                          key={user.id}
                          className="py-2 px-1 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUnenrolledIds((prev) => [...prev, user.id])
                                } else {
                                  setSelectedUnenrolledIds((prev) => prev.filter((id) => id !== user.id))
                                }
                              }}
                              className="accent-slate-900 dark:accent-white"
                            />
                            <img
                              src={user.avatar}
                              alt={user.name}
                              className="w-7 h-7 rounded-full object-cover shrink-0"
                            />
                            <div className="truncate">
                              <span className="font-semibold text-slate-900 dark:text-white mr-1.5">
                                {user.name}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                                ({user.designation} • {user.department})
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isEnrolling}
                            onClick={() => handleEnrollParticipant(user)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-2xs font-sans"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Enroll</span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </Modal>

      {/* Edit Review Cycle & Deadlines Modal */}
      <Modal
        isOpen={showEditCycleModal}
        onClose={() => {
          if (!isSavingCycle) setShowEditCycleModal(false)
        }}
        title={`Edit "${cycle.name}"`}
        subtitle="Update cycle information, deterministic deadlines, and formula weights"
        maxWidth="2xl"
        onSubmit={handleSaveCycleEdits}
        footer={
          <>
            <button
              type="button"
              disabled={isSavingCycle}
              onClick={() => setShowEditCycleModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors font-sans text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingCycle}
              className="premium-glow-btn h-10 px-5 text-xs font-semibold cursor-pointer"
            >
              {isSavingCycle ? 'Saving...' : 'Save Cycle Changes'}
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

          {/* Key Cycle Deadlines Section */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Key Cycle Deadlines (Admin Editable)</span>
              </div>
              <button
                type="button"
                onClick={handleRecalculateDeadlines}
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

      {/* Remove Participant Confirmation Dialog (With explicit audit history notice) */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        onConfirm={handleRemoveParticipant}
        title={`Remove ${participantToRemove?.name} from this cycle?`}
        message={
          participantHasHistory
            ? `Warning: ${participantToRemove?.name} has recorded evaluation progress for this cycle (${historyNotes.join(', ')}). Removing them will safely unenroll them from future workflow stages while preserving their completed audit records. Do you wish to continue?`
            : `Are you sure you want to remove ${participantToRemove?.name} from "${cycle.name}"? This unenrolls them from this review cycle. You can re-enroll them anytime.`
        }
        confirmText={participantHasHistory ? 'Yes, Unenroll & Preserve History' : 'Yes, Remove Employee'}
        variant={participantHasHistory ? 'warning' : 'danger'}
        isLoading={isRemoving}
      />

      {/* Advance Cycle Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showAdvanceConfirm}
        onClose={() => setShowAdvanceConfirm(false)}
        onConfirm={handleAdvance}
        title={`Advance Cycle to ${nextStageInfo?.label}?`}
        message={`This will transition the active review cycle from "${CYCLE_STAGE_DETAILS[effectiveStage].label}" to "${nextStageInfo?.label}". Enterprise workflow tracking, operational tasks, and participant stages will update immediately.`}
        confirmText="Confirm Stage Advance"
        variant="primary"
        isLoading={isAdvancing}
      />

      {/* Fast Switch Stage Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showSwitchStageModal}
        onClose={() => setShowSwitchStageModal(false)}
        onConfirm={handleConfirmStageSwitch}
        title={`Switch Cycle Stage to "${targetStageToSwitch ? CYCLE_STAGE_DETAILS[targetStageToSwitch].label : ''}"?`}
        message={`Are you sure you want to transition "${cycle.name}" to "${
          targetStageToSwitch ? CYCLE_STAGE_DETAILS[targetStageToSwitch].label : ''
        }"? The enterprise workflow tracking will immediately update to reflect this phase.`}
        confirmText="Switch Stage"
        variant="primary"
        isLoading={isSwitchingStage}
      />

      {/* Delete Review Cycle Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteCycleConfirm}
        onClose={() => setShowDeleteCycleConfirm(false)}
        onConfirm={handleDeleteCycle}
        title={`Permanently Delete "${cycle.name}"?`}
        message={`Are you sure you want to delete this review cycle? All goals, evaluations, self-reviews, and calibration records in this cycle will be permanently deleted. This action is irreversible.`}
        confirmText="Permanently Delete Cycle"
        variant="danger"
        isLoading={isDeletingCycle}
      />
    </div>
  )
}

