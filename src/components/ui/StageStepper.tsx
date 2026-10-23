import React, { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { CycleStage, ReviewCycle } from '../../types'
import { CYCLE_STAGE_DETAILS, STAGE_ORDER, formatDate } from '../../lib/formatters'
import { useInView } from '../../hooks/useInView'
import { useApp } from '../../app/AppContext'
import { ArrowRight, Calendar, Check, CheckSquare } from 'lucide-react'

type StageStepperProps = {
  currentStage: CycleStage
  onStageSelect?: (stage: CycleStage) => void
  readOnly?: boolean
  replayOnHover?: boolean
  isFinished?: boolean
  cycle?: ReviewCycle | null
  showCycleInfo?: boolean
}

export const StageStepper: React.FC<StageStepperProps> = ({
  currentStage,
  onStageSelect,
  readOnly = true,
  replayOnHover = false,
  isFinished = false,
  cycle,
  showCycleInfo = true,
}) => {
  const { activeCycle, currentUser } = useApp()
  const effectiveCycle = cycle ?? activeCycle
  const isActiveWorkspace = effectiveCycle?.id === activeCycle?.id

  const currentIndex = STAGE_ORDER.indexOf(currentStage)
  const isCycleFinished = isFinished || currentStage === 'closed'
  const [containerRef, isInView] = useInView<HTMLDivElement>({ threshold: 0.15, triggerOnce: true })
  const [isAnimated, setIsAnimated] = useState(false)
  const [activeStepIndex, setActiveStepIndex] = useState(-1)
  const hasAnimatedRef = useRef(false)
  const prevStageRef = useRef(currentStage)

  useEffect(() => {
    if (!isInView) return

    // Animate ONCE on initial view; do not replay on subsequent re-renders unless stage changes
    if (hasAnimatedRef.current && prevStageRef.current === currentStage) {
      setIsAnimated(true)
      setActiveStepIndex(currentIndex)
      return
    }

    hasAnimatedRef.current = true
    prevStageRef.current = currentStage

    setIsAnimated(false)
    setActiveStepIndex(-1)

    // Trigger progressive track line expansion
    const lineTimer = window.setTimeout(() => {
      setIsAnimated(true)
    }, 120)

    // Progressive illumination of step nodes in sync with the traveling line
    const timeouts: number[] = []
    const totalDuration = 1000 // duration of line draw
    const effectiveIndex = Math.max(0, currentIndex)

    STAGE_ORDER.forEach((_, idx) => {
      if (idx <= currentIndex) {
        const delay = 120 + (effectiveIndex > 0 ? (idx / effectiveIndex) * totalDuration : 0)
        const timer = window.setTimeout(() => {
          setActiveStepIndex(idx)
        }, delay)
        timeouts.push(timer)
      }
    })

    return () => {
      clearTimeout(lineTimer)
      timeouts.forEach(clearTimeout)
    }
  }, [isInView, currentIndex, currentStage])

  const targetPercentage =
    currentIndex >= 0
      ? (Math.min(currentIndex, STAGE_ORDER.length - 1) / (STAGE_ORDER.length - 1)) * 100
      : 0

  return (
    <div
      ref={containerRef}
      className="dark-glass-card p-4 sm:p-5 overflow-x-auto no-scrollbar group cursor-default transition-all"
    >
      {/* Header Bar */}
      {showCycleInfo ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
          {/* Left: Cycle Identity */}
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {effectiveCycle?.name || 'Enterprise Appraisal Workflow'}
            </h2>
          </div>

          {/* Right: Date Badge & Contextual Actions */}
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center flex-wrap sm:flex-nowrap">
            {effectiveCycle?.startDate && effectiveCycle?.endDate && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-zinc-200 font-sans bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700">
                <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400 shrink-0" />
                <span>{formatDate(effectiveCycle.startDate)} – {formatDate(effectiveCycle.endDate)}</span>
              </span>
            )}

            {currentUser?.role === 'admin' && effectiveCycle && (
              <Link
                to={`/admin/cycles/${effectiveCycle.id}`}
                className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-zinc-200 dark:hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/20 bg-white hover:bg-slate-100 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-500 transition-all cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                title="Inspect or manage cycle settings"
              >
                <span>Cycle Settings</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            )}
            {currentUser?.role === 'manager' && (
              <Link
                to="/manager/approvals"
                className="group inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-zinc-200 dark:hover:text-white px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/20 bg-white hover:bg-slate-100 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-500 transition-all cursor-pointer shadow-2xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                title="Review pending goal approvals"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#FFB454]" />
                <span>Goal Approvals</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 mb-3.5 pb-2 border-b border-slate-100 dark:border-white/[0.06]">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-[#A5AEC2] font-sans">
            Review Cycle Workflow Tracking
          </span>
        </div>
      )}

      {/* Steps Track with Connected Progress Bar */}
      <div className="relative min-w-[760px] pb-1">
        {/* Base Connecting Line behind circles */}
        <div className="absolute top-[21px] left-[6.25%] w-[87.5%] h-[2.5px] bg-slate-200 dark:bg-white/[0.08] rounded-full pointer-events-none overflow-hidden">
          {/* Active Filled Line */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-slate-900 dark:bg-white transition-all duration-1000 ease-out rounded-full"
            style={{
              width: isAnimated ? `${targetPercentage}%` : '0%',
            }}
          >
            {/* Ambient traveling beam */}
            <div className="absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-white/40 dark:via-zinc-400/40 to-transparent animate-line-travel opacity-75" />
            {/* Particle head at the leading edge */}
            {isAnimated && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 rounded-full bg-slate-900 dark:bg-white shadow-xs" />
            )}
          </div>
        </div>

        {/* Step Nodes Row */}
        <div className="relative flex justify-between">
          {STAGE_ORDER.map((stage, idx) => {
            const isCompleted = isCycleFinished ? idx <= currentIndex : idx < currentIndex
            const isCurrent = isCycleFinished ? false : idx === currentIndex
            const isLit = idx <= activeStepIndex
            const details = CYCLE_STAGE_DETAILS[stage]

            return (
              <div
                key={stage}
                title={!readOnly && onStageSelect ? `Switch stage to: ${details.label}` : details.label}
                className={`flex-1 text-center relative select-none ${
                  !readOnly && onStageSelect ? 'cursor-pointer group' : ''
                }`}
                onClick={() => !readOnly && onStageSelect && onStageSelect(stage)}
              >
                {/* Step Node Circle (42px) */}
                <div className="relative w-[42px] h-[42px] mx-auto mb-2.5">
                  <div
                    className={`w-full h-full rounded-full grid place-items-center font-bold text-sm transition-all duration-300 ${
                      isCurrent
                        ? isLit
                          ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white border-2 border-slate-900 dark:border-white ring-4 ring-slate-900/15 dark:ring-white/20 scale-105'
                          : 'bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800'
                        : isCompleted
                        ? isLit
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800'
                        : 'bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800'
                    } ${!readOnly && onStageSelect ? 'group-hover:scale-110 group-hover:ring-4 group-hover:ring-indigo-500/25 group-hover:border-indigo-500' : ''}`}
                  >
                    {isCompleted && isLit ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <span className="tabular-nums">{idx + 1}</span>
                    )}
                  </div>
                </div>

                {/* Step Label */}
                <div
                  className={`text-xs transition-colors line-clamp-1 ${
                    isCurrent || (isCycleFinished && idx === currentIndex)
                      ? 'text-slate-950 dark:text-white font-bold'
                      : isCompleted && isLit
                      ? 'text-slate-700 dark:text-[#C9CEDB] font-medium'
                      : 'text-slate-400 dark:text-[#667085] font-normal'
                  } ${!readOnly && onStageSelect ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : ''}`}
                >
                  {details.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
