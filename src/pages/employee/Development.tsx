import React, { useEffect, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import { developmentService } from '../../services'
import { DevelopmentPlan, GrowthAction, RecommendedCourse } from '../../types'
import { Modal } from '../../components/ui/Modal'
import { DatePicker } from '../../components/ui/DatePicker'
import { RubberSegmentedControl } from '../../components/ui/RubberSegmentedControl'
import { LoadingState } from '../../components/ui/LoadingState'
import { formatDate } from '../../lib/formatters'
import {
  Award,
  BookOpen,
  Calendar,
  Check,
  Clock,
  Compass,
  Laptop,
  Plus,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  PlayCircle,
  ExternalLink,
} from 'lucide-react'

// Proficiency Level Helper for Skills Matrix
const getLevelDescription = (level: number) => {
  switch (level) {
    case 1:
      return 'Foundational'
    case 2:
      return 'Developing'
    case 3:
      return 'Proficient'
    case 4:
      return 'Advanced'
    case 5:
      return 'Mastery / Staff'
    default:
      return `Level ${level}`
  }
}

// Milestone Domain Tag Helper
const getMilestoneTag = (title: string) => {
  const t = title.toLowerCase()
  if (t.includes('cloud') || t.includes('architect') || t.includes('aws') || t.includes('security')) {
    return 'Cloud Architecture'
  }
  if (t.includes('summit') || t.includes('keynote') || t.includes('speaking') || t.includes('workshop')) {
    return 'Thought Leadership'
  }
  if (t.includes('token') || t.includes('design') || t.includes('figma') || t.includes('ui')) {
    return 'Design Engineering'
  }
  if (t.includes('kafka') || t.includes('database') || t.includes('query') || t.includes('postgres')) {
    return 'Data Infrastructure'
  }
  return 'Strategic Capability'
}

// Course Metadata & Syllabus Description Helper
const getCourseMetadata = (crs: RecommendedCourse) => {
  const t = crs.title.toLowerCase()
  if (t.includes('architecture') || t.includes('distributed')) {
    return {
      description: 'Distributed consensus, fault tolerance, and event streams.',
      tag: 'System Design',
      progress: crs.status === 'completed' ? 100 : crs.status === 'enrolled' ? 65 : 0,
      modules: '8 Modules',
      icon: <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
    }
  }
  if (t.includes('communication') || t.includes('leadership') || t.includes('strategic')) {
    return {
      description: 'Technical consensus, RFC framing, and stakeholder alignment.',
      tag: 'Leadership',
      progress: crs.status === 'completed' ? 100 : crs.status === 'enrolled' ? 40 : 0,
      modules: '5 Modules',
      icon: <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />,
    }
  }
  return {
    description: 'Browser profiling, memory optimization, and worker threading.',
    tag: 'Performance',
    progress: crs.status === 'completed' ? 100 : crs.status === 'enrolled' ? 55 : 0,
    modules: '4 Modules',
    icon: <Laptop className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />,
  }
}

export const EmployeeDevelopment: React.FC = () => {
  const { currentUser } = useApp()
  const { success, error } = useToast()

  const [plan, setPlan] = useState<DevelopmentPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState<'all' | 'in_progress' | 'completed'>('all')

  // Add Action Modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTargetDate, setNewTargetDate] = useState('')

  const fetchPlan = async () => {
    setLoading(true)
    try {
      const data = await developmentService.getPlan(currentUser.id)
      setPlan(data)
    } catch (err) {
      console.warn('Notice loading development plan:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 4500)

    fetchPlan().finally(() => {
      clearTimeout(safetyTimer)
    })

    return () => {
      isMounted = false
      clearTimeout(safetyTimer)
    }
  }, [currentUser.id])

  const handleToggleStatus = async (action: GrowthAction) => {
    const nextStatus: GrowthAction['status'] =
      action.status === 'not_started'
        ? 'in_progress'
        : action.status === 'in_progress'
        ? 'completed'
        : 'not_started'

    try {
      const updated = await developmentService.updateActionStatus(currentUser.id, action.id, nextStatus)
      setPlan(updated)
      const readableStatus = nextStatus === 'not_started' ? 'Not Started' : nextStatus === 'in_progress' ? 'In Progress' : 'Completed'
      success('Milestone updated', `"${action.title}" changed to ${readableStatus}.`)
    } catch (err: any) {
      error('Update failed', err.message)
    }
  }

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) {
      error('Title required', 'Please provide a title for the growth milestone.')
      return
    }
    if (!newTargetDate) {
      error('Date required', 'Please select a target completion date.')
      return
    }

    try {
      const updated = await developmentService.addAction(currentUser.id, newTitle, newTargetDate)
      setPlan(updated)
      setShowAddModal(false)
      setNewTitle('')
      setNewTargetDate('')
      success('Growth action added', 'New development milestone added to your growth plan.')
    } catch (err: any) {
      error('Failed to add action', err.message)
    }
  }

  const handleCourseAction = (course: RecommendedCourse) => {
    if (course.status === 'completed') {
      success('Credential verified', `Viewing completed certification for "${course.title}".`)
    } else if (course.status === 'enrolled') {
      success('Curriculum workspace launched', `Resuming learning modules for "${course.title}".`)
    } else {
      success('Enrolled in curriculum', `You are now enrolled in "${course.title}". Added to active syllabus.`)
    }
  }

  if (loading) {
    return <LoadingState message="Loading career growth milestones & syllabus..." variant="page" />
  }

  const allActions = plan?.agreedActions || []
  const completedCount = allActions.filter((a) => a.status === 'completed').length
  const inProgressCount = allActions.filter((a) => a.status === 'in_progress').length
  const notStartedCount = allActions.filter((a) => a.status === 'not_started').length
  const pctComplete = allActions.length > 0 ? Math.round((completedCount / allActions.length) * 100) : 0

  const filteredActions = allActions.filter((a) => {
    if (actionFilter === 'in_progress') return a.status === 'in_progress'
    if (actionFilter === 'completed') return a.status === 'completed'
    return true
  })

  return (
    <div className="space-y-5 w-full pb-16 font-sans">
      {/* SECTION 1: Skills Matrix */}
      <div className="dark-glass-card conic-border-glow rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs dark:shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div>
            <h2 className="heading-premium text-lg sm:text-xl font-bold tracking-[-0.03em] text-slate-900 dark:text-white">
              Skills Matrix
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
              <span>{plan?.skills?.length || 0} Competencies</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4.5">
          {(plan?.skills || []).map((skill, i) => {
            const currentLevelName = getLevelDescription(skill.currentLevel)
            const targetLevelName = getLevelDescription(skill.targetLevel)
            const delta = skill.targetLevel - skill.currentLevel
            const percent = (skill.currentLevel / 5) * 100

            return (
              <div
                key={i}
                className="group relative rounded-2xl p-4.5 sm:p-5 border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] transition-all duration-200 hover:border-slate-300 dark:hover:border-white/20 hover:shadow-xs space-y-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-sans uppercase tracking-wider font-semibold text-slate-400 dark:text-zinc-500">
                      Competency {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="font-display font-bold text-sm sm:text-[15px] tracking-[-0.015em] text-slate-900 dark:text-white leading-snug">
                      {skill.name}
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 font-sans text-[11px] font-semibold shrink-0">
                    L{skill.currentLevel} → L{skill.targetLevel}
                    {delta > 0 && <span className="text-[10px] opacity-80">(+{delta})</span>}
                  </span>
                </div>

                {/* Level Descriptions */}
                <div className="flex items-center justify-between text-xs font-sans">
                  <span className="text-slate-600 dark:text-zinc-400">
                    Current: <strong className="text-slate-900 dark:text-white">{currentLevelName}</strong>
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400">
                    Target: <strong className="text-slate-900 dark:text-white">{targetLevelName}</strong>
                  </span>
                </div>

                {/* Discrete 5-Step Segmented Bar */}
                <div className="space-y-1.5 pt-0.5">
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((level) => {
                      const isCurrent = level <= skill.currentLevel
                      const isTarget = level === skill.targetLevel

                      return (
                        <div
                          key={level}
                          className={`h-2 rounded-full transition-all duration-300 relative ${
                            isCurrent
                              ? 'bg-indigo-600 dark:bg-indigo-500'
                              : isTarget
                              ? 'bg-indigo-100 dark:bg-indigo-950/40 border border-dashed border-indigo-400 dark:border-indigo-600'
                              : 'bg-slate-200 dark:bg-white/[0.08]'
                          }`}
                          title={`Level ${level}: ${getLevelDescription(level)}`}
                        />
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-sans text-slate-400 dark:text-zinc-500">
                    <span>L1 · Baseline</span>
                    <span>L3 · Proficient</span>
                    <span>L5 · Mastery</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* SECTION 2: Development Commitments */}
      <div className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs dark:shadow-md space-y-6">
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div>
            <h2 className="heading-premium text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white">
              Development Commitments
            </h2>
          </div>

          {/* Rubber Segmented Control Filter Tabs & Add Action */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
            <RubberSegmentedControl
              options={[
                { value: 'all', label: 'All', count: allActions.length },
                {
                  value: 'in_progress',
                  label: 'In Progress',
                  count: inProgressCount,
                },
                {
                  value: 'completed',
                  label: 'Completed',
                  count: completedCount,
                },
              ]}
              value={actionFilter}
              onChange={(val) => setActionFilter(val as any)}
              size="sm"
            />

            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-8.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-zinc-900 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all border border-transparent"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Action</span>
            </button>
          </div>
        </div>

        {/* Milestone Execution Summary Pill & Progress Track */}
        {allActions.length > 0 && (
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.025] border border-slate-200/80 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 font-sans">
              <span className="font-semibold text-slate-900 dark:text-white">
                Progress:
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200/80 dark:border-emerald-800/40">
                {completedCount} of {allActions.length} ({pctComplete}%)
              </span>
              {inProgressCount > 0 && (
                <span className="text-slate-500 dark:text-zinc-400 text-[11px] hidden md:inline">
                  · {inProgressCount} in progress
                </span>
              )}
            </div>

            {/* Proportional Segmented Progress Mini Track */}
            <div className="w-full sm:w-64 h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-white/[0.08] flex items-center p-0.5 gap-0.5">
              <div
                style={{ width: `${(completedCount / allActions.length) * 100}%` }}
                className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-500"
                title={`Completed: ${completedCount}`}
              />
              <div
                style={{ width: `${(inProgressCount / allActions.length) * 100}%` }}
                className="h-full rounded-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-500"
                title={`In Progress: ${inProgressCount}`}
              />
              <div
                style={{ width: `${(notStartedCount / allActions.length) * 100}%` }}
                className="h-full rounded-full bg-slate-300 dark:bg-white/20 transition-all duration-500"
                title={`Not Started: ${notStartedCount}`}
              />
            </div>
          </div>
        )}

        {/* Milestone Rows List */}
        <div className="space-y-3">
          {filteredActions.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 dark:text-zinc-500 font-mono bg-slate-50/50 dark:bg-white/[0.015] rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
              No milestones found for the "{actionFilter.replace('_', ' ')}" filter.
            </div>
          ) : (
            filteredActions.map((action) => {
              const isCompleted = action.status === 'completed'
              const isInProgress = action.status === 'in_progress'
              const domainTag = getMilestoneTag(action.title)

              return (
                <div
                  key={action.id}
                  onClick={() => handleToggleStatus(action)}
                  className={`group relative rounded-2xl p-4.5 sm:p-5 border transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none ${
                    isCompleted
                      ? 'bg-slate-50/80 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 text-slate-700 dark:text-zinc-300'
                      : isInProgress
                      ? 'bg-white dark:bg-zinc-900 border-indigo-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-zinc-600 text-slate-900 dark:text-white shadow-2xs'
                      : 'bg-white dark:bg-white/[0.02] border-slate-200/90 dark:border-white/[0.09] hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] text-slate-900 dark:text-white shadow-2xs'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleToggleStatus(action)
                    }
                  }}
                  title="Click to cycle status"
                >
                  {/* Left Column: Interactive Checkbox / Glyph + Content */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    {/* Status Glyph Pill */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 ${
                        isCompleted
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : isInProgress
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 shadow-xs'
                          : 'border-2 border-slate-300 dark:border-white/25 group-hover:border-slate-400 dark:group-hover:border-white/50 text-transparent'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 stroke-[3]" />
                      ) : isInProgress ? (
                        <div className="w-2 h-2 rounded-xs bg-indigo-600 dark:bg-indigo-400" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-60 transition-opacity" />
                      )}
                    </div>

                    {/* Title & Metadata */}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-display font-bold text-sm sm:text-[15.5px] tracking-[-0.015em] transition-colors leading-snug ${
                            isCompleted
                              ? 'line-through decoration-slate-400 text-slate-500 dark:text-zinc-400'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {action.title}
                        </span>
                      </div>

                      {/* Meta Pill Row */}
                      <div className="flex items-center gap-2 flex-wrap text-xs font-sans">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-zinc-300 text-[11px] font-medium">
                          <Calendar className="w-3 h-3 text-slate-400 dark:text-zinc-400" />
                          <span>Target: {formatDate(action.targetDate)}</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100/90 dark:bg-white/[0.04] text-slate-500 dark:text-zinc-400 text-[10.5px]">
                          {domainTag}
                        </span>

                        {isCompleted && (
                          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hidden md:inline">
                            · Completed
                          </span>
                        )}
                        {isInProgress && (
                          <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400 hidden md:inline">
                            · In progress
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Status Capsule & Hover Action Cue */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-white/10">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-semibold border shadow-2xs ${
                        isCompleted
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50'
                          : isInProgress
                          ? 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700'
                          : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {isCompleted ? (
                        <>
                          <Check className="w-3 h-3 stroke-[2.5]" />
                          <span>Completed</span>
                        </>
                      ) : isInProgress ? (
                        <span>In Progress</span>
                      ) : (
                        <span>Not Started</span>
                      )}
                    </span>

                    <span className="text-[11px] font-sans text-slate-400 dark:text-zinc-500 group-hover:text-slate-700 dark:group-hover:text-zinc-300 transition-colors flex items-center gap-1">
                      <span>Toggle</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* SECTION 3: Recommended Courses */}
      <div className="dark-glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs dark:shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/90 dark:border-white/[0.08]">
          <div>
            <h2 className="heading-premium text-xl sm:text-2xl font-extrabold tracking-[-0.03em] text-slate-900 dark:text-white">
              Recommended Courses
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans font-medium bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-white/10">
              <BookOpen className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              <span>3 Tracks · 26 Hours</span>
            </span>
          </div>
        </div>

        {/* 3 Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(plan?.recommendedCourses || []).map((crs) => {
            const meta = getCourseMetadata(crs)
            const isCompleted = crs.status === 'completed'
            const isEnrolled = crs.status === 'enrolled'

            return (
              <div
                key={crs.id}
                onClick={() => handleCourseAction(crs)}
                className="group relative rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-white/10 bg-white dark:bg-white/[0.02] hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-all duration-300 flex flex-col justify-between space-y-4 shadow-2xs hover:border-slate-300 dark:hover:border-white/20 hover:-translate-y-0.5 cursor-pointer overflow-hidden"
              >
                {/* Top Row: Provider Badge with Icon + Duration Pill */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {meta.icon}
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                      {crs.provider}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md font-mono text-[10.5px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-white/10">
                    <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-400" />
                    <span>{crs.duration}</span>
                  </span>
                </div>

                {/* Course Title & Syllabus Summary */}
                <div className="space-y-2.5 flex-1">
                  <h3 className="font-display font-bold text-base sm:text-[16.5px] tracking-tight leading-snug text-slate-900 dark:text-white transition-colors">
                    {crs.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed line-clamp-3">
                    {meta.description}
                  </p>
                </div>

                {/* Domain Pill & Module Count */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-white/[0.06]">
                  <span className="text-[10.5px] font-sans font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                    {meta.tag}
                  </span>
                  <span className="text-[11px] font-sans text-slate-400 dark:text-zinc-500">
                    {meta.modules}
                  </span>
                </div>

                {/* Progress Bar & Status Pill */}
                <div className="space-y-2 pt-1">
                  <div className="w-full bg-slate-100 dark:bg-white/[0.08] rounded-full h-1.5 overflow-hidden p-[1px]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : isEnrolled
                          ? 'bg-indigo-600 dark:bg-indigo-500'
                          : 'bg-slate-300 dark:bg-white/20'
                      }`}
                      style={{ width: `${meta.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-sans">
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Progress
                    </span>
                    <span
                      className={`text-[11px] font-bold ${
                        isCompleted
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : isEnrolled
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-500 dark:text-zinc-400'
                      }`}
                    >
                      {meta.progress}%
                    </span>
                  </div>
                </div>

                {/* Bottom Action Trigger */}
                <div className="pt-2">
                  {isCompleted ? (
                    <div className="w-full py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50 font-sans text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs">
                      <Award className="w-3.5 h-3.5" />
                      <span>Certified · View Credential</span>
                    </div>
                  ) : isEnrolled ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCourseAction(crs)
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-slate-100 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Resume Track</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCourseAction(crs)
                      }}
                      className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] text-slate-800 dark:text-white font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Enroll in Track</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add Action Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Growth Milestone"
        maxWidth="md"
        overflowVisible={true}
        onSubmit={handleAddAction}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="h-9 px-4 rounded-xl border border-slate-200 dark:border-white/12 text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="premium-glow-btn h-9 px-4 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
            >
              Add Milestone
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs font-sans">
          <div>
            <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
              Growth Milestone Title *
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Lead architecture review on micro-frontends"
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-zinc-700/80 focus:outline-hidden focus:ring-2 focus:ring-slate-900 dark:focus:ring-white bg-white dark:bg-[#18181b] text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs font-sans"
            />
          </div>

          <div>
            <DatePicker
              label="Target Completion Date"
              placeholder="Select completion date"
              required
              value={newTargetDate}
              onChange={(val) => setNewTargetDate(val)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
