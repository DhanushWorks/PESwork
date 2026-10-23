import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react'
import { formatDate } from '../../lib/formatters'

export type DatePickerProps = {
  value: string // YYYY-MM-DD format
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  label?: string
  disabled?: boolean
  minDate?: string
  maxDate?: string
  className?: string
  align?: 'left' | 'right'
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  required = false,
  label,
  disabled = false,
  minDate,
  maxDate,
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Floating portal coordinates
  const [coords, setCoords] = useState<{
    top: number
    left: number
    width: number
    placeAbove: boolean
  }>({
    top: 0,
    left: 0,
    width: 310,
    placeAbove: false,
  })

  // Parse current value or fallback to today
  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const today = new Date()
  const todayYear = today.getFullYear()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()

  // Viewing state (which month/year is shown in calendar)
  const [viewYear, setViewYear] = useState(
    selectedDate ? selectedDate.getFullYear() : todayYear
  )
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? selectedDate.getMonth() : todayMonth
  )

  // Calendar view mode: 'days' | 'months' | 'years'
  const [calendarView, setCalendarView] = useState<'days' | 'months' | 'years'>('days')
  const [yearRangeStart, setYearRangeStart] = useState<number>(
    Math.floor((selectedDate ? selectedDate.getFullYear() : todayYear) / 10) * 10 - 1
  )

  // Reset view to 'days' whenever popover opens
  useEffect(() => {
    if (isOpen) {
      setCalendarView('days')
      setYearRangeStart(Math.floor(viewYear / 10) * 10 - 1)
    }
  }, [isOpen, viewYear])

  // Update viewing month/year when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
        setYearRangeStart(Math.floor(d.getFullYear() / 10) * 10 - 1)
      }
    }
  }, [value])

  // Calculate coordinates with auto-flip when near bottom of viewport or modal
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const popoverWidth = Math.min(310, window.innerWidth - 24)
    const popoverHeight = 330 // approximate calendar popover height

    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    // Flip to top if space below is too small and space above has more room
    const placeAbove = spaceBelow < popoverHeight && spaceAbove > spaceBelow

    let left = rect.left
    if (align === 'right' || left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.right - popoverWidth)
    }
    // Prevent clipping off left edge
    left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12))

    const top = placeAbove
      ? Math.max(8, rect.top - popoverHeight - 8)
      : Math.min(window.innerHeight - popoverHeight - 8, rect.bottom + 8)

    setCoords({
      top,
      left,
      width: popoverWidth,
      placeAbove,
    })
  }, [align])

  // Attach outside click and sync position with scroll / resize
  useEffect(() => {
    if (!isOpen) return
    updatePosition()

    const handleScrollOrResize = () => {
      updatePosition()
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false)
        setCalendarView('days')
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setCalendarView('days')
      }
    }

    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, updatePosition])

  // Navigation handlers (adaptive based on active view)
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (calendarView === 'days') {
      if (viewMonth === 0) {
        setViewMonth(11)
        setViewYear((prev) => prev - 1)
      } else {
        setViewMonth((prev) => prev - 1)
      }
    } else if (calendarView === 'months') {
      setViewYear((prev) => prev - 1)
    } else if (calendarView === 'years') {
      setYearRangeStart((prev) => prev - 10)
    }
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (calendarView === 'days') {
      if (viewMonth === 11) {
        setViewMonth(0)
        setViewYear((prev) => prev + 1)
      } else {
        setViewMonth((prev) => prev + 1)
      }
    } else if (calendarView === 'months') {
      setViewYear((prev) => prev + 1)
    } else if (calendarView === 'years') {
      setYearRangeStart((prev) => prev + 10)
    }
  }

  // Days calculations
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

  // Handle day click
  const handleSelectDay = (day: number, monthOffset = 0) => {
    let targetYear = viewYear
    let targetMonth = viewMonth + monthOffset

    if (targetMonth < 0) {
      targetMonth = 11
      targetYear -= 1
    } else if (targetMonth > 11) {
      targetMonth = 0
      targetYear += 1
    }

    const m = String(targetMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    const formatted = `${targetYear}-${m}-${d}`

    onChange(formatted)
    setIsOpen(false)
    setCalendarView('days')
  }

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation()
    const m = String(todayMonth + 1).padStart(2, '0')
    const d = String(todayDate).padStart(2, '0')
    onChange(`${todayYear}-${m}-${d}`)
    setViewYear(todayYear)
    setViewMonth(todayMonth)
    setCalendarView('days')
    setIsOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setCalendarView('days')
    setIsOpen(false)
  }

  // Format date display on trigger
  const displayValue = value ? formatDate(value) : placeholder

  const decadeStart = yearRangeStart + 1
  const decadeEnd = yearRangeStart + 10

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="font-semibold text-slate-700 dark:text-zinc-300 block mb-1 text-xs">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            updatePosition()
            setIsOpen((prev) => !prev)
          }
        }}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs cursor-pointer select-none transition-all duration-200 outline-none ${
          isOpen
            ? 'ring-2 ring-slate-900/15 dark:ring-white/20 border-slate-900 dark:border-white shadow-xs'
            : 'border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600'
        } ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-800'
            : 'bg-white dark:bg-zinc-900'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon
            className={`w-4 h-4 shrink-0 transition-colors ${
              value
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-400 dark:text-zinc-500'
            }`}
          />
          <span
            className={`truncate font-medium ${
              value
                ? 'text-slate-900 dark:text-zinc-100 font-semibold'
                : 'text-slate-400 dark:text-zinc-500'
            }`}
          >
            {displayValue}
          </span>
        </div>

        {value && !required && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleClear}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            title="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Premium Portal-Mounted Calendar Popover (Never clipped, Never causes scrolling) */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="p-3.5 rounded-2xl border shadow-2xl backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 duration-150 bg-white/98 dark:bg-[#18181b]/98 border-slate-200/90 dark:border-zinc-700/80 shadow-black/20 dark:shadow-[0_20px_50px_rgba(0,0,0,0.85)] select-none text-slate-900 dark:text-zinc-100"
          >
            {/* Header Month / Year & Prev / Next navigation */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-zinc-700/80">
              <div className="flex items-center gap-1 font-sans text-xs">
                {/* Touch/Click Month to select month */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCalendarView((curr) => (curr === 'months' ? 'days' : 'months'))
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg font-bold tracking-tight uppercase transition-all cursor-pointer group active:scale-95 ${
                    calendarView === 'months'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs ring-1 ring-slate-900/10 dark:ring-white/20'
                      : 'text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                  title={calendarView === 'months' ? 'Return to days' : 'Touch to change month'}
                  aria-label="Select month"
                >
                  <span>{MONTH_NAMES[viewMonth]}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      calendarView === 'months'
                        ? 'rotate-180 text-current'
                        : 'opacity-50 text-slate-500 dark:text-zinc-400 group-hover:opacity-100'
                    }`}
                  />
                </button>

                {/* Touch/Click Year to select year */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setYearRangeStart(Math.floor(viewYear / 10) * 10 - 1)
                    setCalendarView((curr) => (curr === 'years' ? 'days' : 'years'))
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg font-semibold tracking-tight transition-all cursor-pointer group active:scale-95 ${
                    calendarView === 'years'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs ring-1 ring-slate-900/10 dark:ring-white/20'
                      : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                  title={calendarView === 'years' ? 'Return to days' : 'Touch to change year'}
                  aria-label="Select year"
                >
                  <span>{calendarView === 'years' ? `${decadeStart}–${decadeEnd}` : viewYear}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-200 ${
                      calendarView === 'years'
                        ? 'rotate-180 text-current'
                        : 'opacity-50 text-slate-500 dark:text-zinc-400 group-hover:opacity-100'
                    }`}
                  />
                </button>
              </div>

              {/* Prev / Next Chevrons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-95"
                  title={
                    calendarView === 'years'
                      ? 'Previous decade'
                      : calendarView === 'months'
                      ? 'Previous year'
                      : 'Previous month'
                  }
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer active:scale-95"
                  title={
                    calendarView === 'years'
                      ? 'Next decade'
                      : calendarView === 'months'
                      ? 'Next year'
                      : 'Next month'
                  }
                  aria-label="Next"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* View 1: DAYS MATRIX */}
            {calendarView === 'days' && (
              <>
                {/* Days of the Week Row */}
                <div className="grid grid-cols-7 gap-1 text-center my-2">
                  {DAYS_OF_WEEK.map((d) => (
                    <span
                      key={d}
                      className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-sans"
                    >
                      {d}
                    </span>
                  ))}
                </div>

                {/* Month Days Matrix */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Leading days from previous month */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                    const day = daysInPrevMonth - firstDayOfWeek + i + 1
                    return (
                      <button
                        key={`prev-${i}`}
                        type="button"
                        onClick={() => handleSelectDay(day, -1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 mx-auto flex items-center justify-center rounded-xl text-xs font-medium text-slate-300 dark:text-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      >
                        {day}
                      </button>
                    )
                  })}

                  {/* Current month days */}
                  {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                    const day = i + 1
                    const isSelected =
                      selectedDate &&
                      selectedDate.getFullYear() === viewYear &&
                      selectedDate.getMonth() === viewMonth &&
                      selectedDate.getDate() === day

                    const isCurrentDay =
                      todayYear === viewYear &&
                      todayMonth === viewMonth &&
                      todayDate === day

                    return (
                      <button
                        key={`day-${day}`}
                        type="button"
                        onClick={() => handleSelectDay(day, 0)}
                        className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto flex items-center justify-center rounded-xl text-xs font-medium relative transition-all duration-150 cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md scale-105 z-10'
                            : isCurrentDay
                            ? 'text-slate-900 dark:text-white font-bold border border-slate-900/40 dark:border-white/50 hover:bg-slate-100 dark:hover:bg-zinc-800'
                            : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <span>{day}</span>
                        {isCurrentDay && !isSelected && (
                          <span className="absolute bottom-1 w-1 h-1 rounded-full bg-slate-900 dark:bg-white" />
                        )}
                      </button>
                    )
                  })}

                  {/* Trailing days for next month */}
                  {Array.from({
                    length: (7 - ((firstDayOfWeek + daysInCurrentMonth) % 7)) % 7,
                  }).map((_, i) => {
                    const day = i + 1
                    return (
                      <button
                        key={`next-${i}`}
                        type="button"
                        onClick={() => handleSelectDay(day, 1)}
                        className="w-7 h-7 sm:w-8 sm:h-8 mx-auto flex items-center justify-center rounded-xl text-xs font-medium text-slate-300 dark:text-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* View 2: MONTH SELECTION GRID (Touch friendly 3x4 layout) */}
            {calendarView === 'months' && (
              <div className="grid grid-cols-3 gap-2 py-2.5 my-1 min-h-[212px]">
                {MONTH_NAMES.map((mName, idx) => {
                  const isSelected = viewMonth === idx
                  const isCurrentMonth = todayYear === viewYear && todayMonth === idx
                  const shortName = mName.slice(0, 3).toUpperCase()

                  return (
                    <button
                      key={mName}
                      type="button"
                      onClick={() => {
                        setViewMonth(idx)
                        setCalendarView('days')
                      }}
                      className={`h-11 rounded-xl text-xs font-semibold flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md scale-[1.02]'
                          : isCurrentMonth
                          ? 'text-slate-900 dark:text-white font-bold border border-slate-900/40 dark:border-white/50 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="font-sans tracking-wider font-bold">{shortName}</span>
                      <span className="text-[10px] opacity-75 font-normal leading-tight">{mName}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* View 3: YEAR SELECTION GRID (Touch friendly 3x4 layout) */}
            {calendarView === 'years' && (
              <div className="grid grid-cols-3 gap-2 py-2.5 my-1 min-h-[212px]">
                {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((yr, idx) => {
                  const isSelected = viewYear === yr
                  const isCurrentYear = todayYear === yr
                  const isOutside = idx === 0 || idx === 11

                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => {
                        setViewYear(yr)
                        setCalendarView('days')
                      }}
                      className={`h-11 rounded-xl text-xs font-semibold flex items-center justify-center transition-all cursor-pointer font-sans active:scale-95 ${
                        isSelected
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-zinc-950 font-bold shadow-md scale-[1.02]'
                          : isCurrentYear
                          ? 'text-slate-900 dark:text-white font-bold border border-slate-900/40 dark:border-white/50 hover:bg-slate-100 dark:hover:bg-zinc-800'
                          : isOutside
                          ? 'text-slate-400 dark:text-zinc-600 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-zinc-300'
                          : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span>{yr}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Quick Action Footer */}
            <div className="pt-2.5 mt-2.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-400 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-200 font-medium transition-colors cursor-pointer text-[11px]"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-zinc-950 hover:bg-slate-800 dark:hover:bg-zinc-200 font-semibold transition-all cursor-pointer active:scale-95 text-[11px] shadow-xs"
              >
                Today
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
