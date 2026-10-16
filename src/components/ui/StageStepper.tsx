import React, { useEffect, useState, useRef } from 'react'
import { CycleStage } from '../../types'
import { CYCLE_STAGE_DETAILS, STAGE_ORDER } from '../../lib/formatters'
import { useInView } from '../../hooks/useInView'
import { Check, Sparkles } from 'lucide-react'

type StageStepperProps = {
  currentStage: CycleStage
  onStageSelect?: (stage: CycleStage) => void
  readOnly?: boolean
  replayOnHover?: boolean
}

export const StageStepper: React.FC<StageStepperProps> = ({
  currentStage,
  onStageSelect,
  readOnly = true,
  replayOnHover = false,
}) => {
  const currentIndex = STAGE_ORDER.indexOf(currentStage)
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
      className="dark-glass-card p-5 sm:p-6 overflow-x-auto no-scrollbar group cursor-default transition-all"
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#8B7CFF]" />
          <span className="text-[12px] font-bold tracking-[0.07em] uppercase text-[#172033] dark:text-[#F0F3FA]">
            Review Cycle Progression
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold font-mono border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-slate-800 dark:text-[#EEF1F7]">
          Stage {currentIndex + 1} of {STAGE_ORDER.length}
        </span>
      </div>

      {/* Steps Track with Connected Progress Bar */}
      <div className="relative min-w-[760px] pb-1">
        {/* Base Connecting Line behind circles */}
        <div className="absolute top-[21px] left-[6.25%] w-[87.5%] h-[2.5px] bg-slate-200 dark:bg-white/[0.08] rounded-full pointer-events-none overflow-hidden">
          {/* Active Gradient Filled Line with glowing particle head */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-indigo-600 via-[#7560ee] to-indigo-500 dark:from-[#8B7CFF] dark:via-[#7560ee] dark:to-[#4FE3C1] transition-all duration-1000 ease-out rounded-full"
            style={{
              width: isAnimated ? `${targetPercentage}%` : '0%',
            }}
          >
            {/* Ambient traveling beam */}
            <div className="absolute inset-y-0 w-28 bg-gradient-to-r from-transparent via-white/80 dark:via-white to-transparent animate-line-travel opacity-90" />
            {/* Glowing particle head at the leading edge */}
            {isAnimated && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_#6366f1,0_0_4px_#ffffff] dark:shadow-[0_0_14px_#8B7CFF,0_0_4px_#4FE3C1]" />
            )}
          </div>
        </div>

        {/* Step Nodes Row */}
        <div className="relative flex justify-between">
          {STAGE_ORDER.map((stage, idx) => {
            const isCompleted = idx < currentIndex
            const isCurrent = idx === currentIndex
            const isLit = idx <= activeStepIndex
            const details = CYCLE_STAGE_DETAILS[stage]

            return (
              <div
                key={stage}
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
                          ? 'bg-slate-900 dark:bg-[#18181b] text-white border-2 border-indigo-600 dark:border-[#8B7CFF] shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/25 dark:ring-[#8B7CFF]/35 scale-105'
                          : 'bg-white dark:bg-[#18181b] text-slate-400 dark:text-[#667085] border border-slate-200 dark:border-zinc-700/80'
                        : isCompleted
                        ? isLit
                          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-[#8B7CFF] dark:to-[#6147e8] text-white shadow-sm shadow-indigo-500/25 animate-step-pop'
                          : 'bg-white dark:bg-[#18181b] text-slate-400 dark:text-[#667085] border border-slate-200 dark:border-zinc-700/80'
                        : 'bg-white dark:bg-[#18181b] text-slate-400 dark:text-[#667085] border border-slate-200 dark:border-zinc-700/80'
                    }`}
                  >
                    {isCompleted && isLit ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <span className="tabular-nums">{idx + 1}</span>
                    )}
                  </div>

                  {/* Active Pulse Ring Indicator */}
                  {isCurrent && isLit && (
                    <>
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 dark:bg-[#4FE3C1] ring-2 ring-white dark:ring-[#18181b] animate-ping" />
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 dark:bg-[#4FE3C1] ring-2 ring-white dark:ring-[#18181b]" />
                    </>
                  )}
                </div>

                {/* Step Label */}
                <div
                  className={`text-xs transition-colors line-clamp-1 ${
                    isCurrent
                      ? 'text-slate-950 dark:text-white font-bold'
                      : isCompleted && isLit
                      ? 'text-slate-700 dark:text-[#C9CEDB] font-medium'
                      : 'text-slate-400 dark:text-[#667085] font-normal'
                  }`}
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
