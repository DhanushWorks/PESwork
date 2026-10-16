import React, { useState } from 'react'
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListFilter,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { formatDate } from '../../lib/formatters'
import { MONTH_NAMES, DAYS_OF_WEEK } from './DatePicker'

export type CycleDeadlines = {
  goalsDue: string
  selfReviewDue: string
  managerReviewDue: string
  calibrationDue: string
  releaseDate: string
}

type DashboardCalendarProps = {
  deadlines: CycleDeadlines
  cycleName: string
  currentStage?: string
}

export const DashboardCalendar: React.FC<DashboardCalendarProps> = ({
  deadlines,
  cycleName,
  currentStage,
}) => {
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar')

  // Map deadlines to lookup keys (YYYY-MM-DD)
  const milestoneEvents: Record<string, { title: string; stage: string }> = {
    [deadlines.goalsDue]: { title: 'Goals Approval Due', stage: 'goals_setup' },
    [deadlines.selfReviewDue]: { title: 'Self-Review Due', stage: 'self_review' },
    [deadlines.managerReviewDue]: { title: 'Manager Evaluation Due', stage: 'manager_review' },
    [deadlines.calibrationDue]: { title: 'Calibration Committee', stage: 'calibration' },
    [deadlines.releaseDate]: { title: 'Outcomes Release', stage: 'released' },
  }

  // Find initial viewing date (closest future milestone or today)
  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()
  const todayIso = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`

  // Initial viewing month/year based on first milestone or today
  const firstMilestoneDate = Object.keys(milestoneEvents)[0]
    ? new Date(Object.keys(milestoneEvents)[0] + 'T00:00:00')
    : today

  const [viewYear, setViewYear] = useState(firstMilestoneDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(firstMilestoneDate.getMonth())
  const [selectedDateIso, setSelectedDateIso] = useState<string>(
    Object.keys(milestoneEvents)[0] || todayIso
  )

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((prev) => prev - 1)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((prev) => prev + 1)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  // Calendar calculations
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    setSelectedDateIso(`${viewYear}-${m}-${d}`)
  }

  const selectedMilestone = milestoneEvents[selectedDateIso]

  return (
    <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200/90 dark:border-zinc-700/80 p-4 sm:p-5 shadow-xs space-y-3.5 transition-all">
      {/* Header with Title and Mode Switcher */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-700/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-800 dark:text-zinc-200">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
              Cycle Calendar
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
              {cycleName}
            </p>
          </div>
        </div>

        {/* View Toggle Pill */}
        <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800/80 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'calendar'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('agenda')}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              viewMode === 'agenda'
                ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Agenda
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="space-y-3">
          {/* Calendar Month Navigation */}
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS_OF_WEEK.map((d) => (
              <span
                key={d}
                className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500"
              >
                {d}
              </span>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Previous month filler */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const day = daysInPrevMonth - firstDayOfWeek + i + 1
              return (
                <div
                  key={`prev-${i}`}
                  className="h-7 sm:h-8 flex items-center justify-center text-[11px] text-slate-300 dark:text-zinc-700"
                >
                  {day}
                </div>
              )
            })}

            {/* Current month days */}
            {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
              const day = i + 1
              const m = String(viewMonth + 1).padStart(2, '0')
              const d = String(day).padStart(2, '0')
              const iso = `${viewYear}-${m}-${d}`

              const isSelected = selectedDateIso === iso
              const isToday = todayIso === iso
              const hasMilestone = Boolean(milestoneEvents[iso])

              return (
                <button
                  key={`cur-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`relative h-7 sm:h-8 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center cursor-pointer select-none ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-xs'
                      : isToday
                      ? 'border border-slate-900/40 dark:border-white/50 text-slate-900 dark:text-white font-bold'
                      : hasMilestone
                      ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold hover:bg-slate-200 dark:hover:bg-zinc-700'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800/50 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{day}</span>
                  {hasMilestone && (
                    <span
                      className={`absolute bottom-0.5 w-1 h-1 rounded-full ${
                        isSelected
                          ? 'bg-white dark:bg-zinc-950'
                          : 'bg-slate-900 dark:bg-white'
                      }`}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Active Milestone Card / Detail */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-zinc-800/80">
            {selectedMilestone ? (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/70 dark:border-zinc-800 text-xs flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-500 dark:text-zinc-400 block">
                    Appraisal Deadline
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-zinc-100 truncate mt-0.5">
                    {selectedMilestone.title}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white block">
                    {formatDate(selectedDateIso)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-1 px-2 text-center text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                Select any dotted date to view appraisal milestones
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Agenda Mode: Clean List of Deadlines */
        <div className="space-y-2 text-xs">
          {Object.entries(milestoneEvents).map(([dateIso, meta]) => (
            <div
              key={dateIso}
              onClick={() => {
                setSelectedDateIso(dateIso)
                const d = new Date(dateIso + 'T00:00:00')
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
                setViewMode('calendar')
              }}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white" />
                <span className="font-medium text-slate-700 dark:text-zinc-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  {meta.title}
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-zinc-100">
                {formatDate(dateIso)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

