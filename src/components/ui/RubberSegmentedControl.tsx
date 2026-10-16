import React, { useRef, useState, useLayoutEffect, useEffect, useMemo } from 'react'

export interface RubberSegmentOption {
  value: string
  label: string
  count?: number
  icon?: React.ReactNode
}

export interface RubberSegmentedControlProps {
  options: (string | RubberSegmentOption)[]
  value: string
  onChange: (value: string) => void
  className?: string
  indicatorClassName?: string
  size?: 'xs' | 'sm' | 'md'
  fullWidth?: boolean
}

export const RubberSegmentedControl: React.FC<RubberSegmentedControlProps> = ({
  options,
  value,
  onChange,
  className = '',
  indicatorClassName = '',
  size = 'sm',
  fullWidth = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const prevValueRef = useRef<string>(value)
  const isInitialMountRef = useRef<boolean>(true)
  const timerRef = useRef<number | null>(null)
  const optionsRef = useRef(options)
  optionsRef.current = options

  // Single consolidated state to avoid multiple re-renders and eliminate lag
  const [indicator, setIndicator] = useState<{
    x: number
    width: number
    scaleX: number
    scaleY: number
    origin: string
    isReady: boolean
  }>({
    x: 0,
    width: 0,
    scaleX: 1,
    scaleY: 1,
    origin: 'center center',
    isReady: false,
  })

  // Serialize options to a stable string primitive so inline array prop declarations never cause infinite re-renders
  const optionsKey = options
    .map((o) => (typeof o === 'string' ? o : `${o.value}:${o.label}:${o.count ?? ''}`))
    .join('|')

  const normalizedOptions: RubberSegmentOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string'
        ? { value: opt, label: opt.replace(/_/g, ' ') }
        : opt
    )
  }, [optionsKey])

  const sizeClasses = {
    xs: 'py-1 px-2.5 text-[11px]',
    sm: 'py-1.5 px-3.5 text-xs',
    md: 'py-2 px-4.5 text-xs sm:text-sm',
  }[size]

  // Safe position calculation using offsetLeft/offsetWidth (Zero Layout Reflow)
  const updatePosition = (targetValue: string, animate: boolean) => {
    const activeEl = buttonRefs.current[targetValue]
    if (!activeEl) return

    const x = activeEl.offsetLeft
    const width = activeEl.offsetWidth

    if (!animate) {
      setIndicator((prev) => {
        if (
          prev.x === x &&
          prev.width === width &&
          prev.scaleX === 1 &&
          prev.scaleY === 1 &&
          prev.isReady === true
        ) {
          return prev
        }
        return {
          x,
          width,
          scaleX: 1,
          scaleY: 1,
          origin: 'center center',
          isReady: true,
        }
      })
      return
    }

    const currentOpts = optionsRef.current
    const prevIdx = currentOpts.findIndex(
      (o) => (typeof o === 'string' ? o : o.value) === prevValueRef.current
    )
    const nextIdx = currentOpts.findIndex(
      (o) => (typeof o === 'string' ? o : o.value) === targetValue
    )
    const dist = Math.abs(nextIdx - prevIdx)
    const isMovingRight = nextIdx > prevIdx

    // True physics rubber squash & stretch:
    // Stretches along X in the direction of motion, squashes along Y to preserve volume
    const stretchAmount = Math.min(1 + Math.max(1, dist) * 0.08, 1.22)
    const squashY = Math.max(0.9, 1 / Math.sqrt(stretchAmount))
    const origin = isMovingRight ? 'left center' : 'right center'

    // Step 1: Launch rubber stretch in motion
    setIndicator({
      x,
      width,
      scaleX: stretchAmount,
      scaleY: squashY,
      origin,
      isReady: true,
    })

    // Step 2: Snap back with elastic spring recoil
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setIndicator((prev) => {
        if (prev.scaleX === 1 && prev.scaleY === 1) return prev
        return {
          ...prev,
          scaleX: 1,
          scaleY: 1,
          origin: 'center center',
        }
      })
    }, 240)
  }

  // Runs strictly when `value` changes (mount or tab selection)
  useLayoutEffect(() => {
    const isFirst = isInitialMountRef.current
    isInitialMountRef.current = false

    updatePosition(value, !isFirst)
    prevValueRef.current = value

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value])

  // Quietly adjust geometry if options/counts change without animation
  useLayoutEffect(() => {
    if (!isInitialMountRef.current) {
      updatePosition(value, false)
    }
  }, [optionsKey])

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => updatePosition(value, false)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [value])

  // Immediate touch response handler
  const handleSelect = (optValue: string) => {
    if (optValue !== value) {
      onChange(optValue)
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        touchAction: 'manipulation',
      }}
      className={`relative inline-flex items-center p-1 rounded-full bg-slate-100/90 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 select-none overflow-x-auto no-scrollbar shadow-2xs ${
        fullWidth ? 'w-full justify-between' : ''
      } ${className}`}
      role="tablist"
      aria-orientation="horizontal"
    >
      {/* Sliding Rubber Indicator: FILLED DARK in White Mode, FILLED WHITE in Dark Mode */}
      {indicator.isReady && (
        <div
          className={`absolute top-1 bottom-1 rounded-full bg-slate-900 dark:bg-white shadow-xs pointer-events-none ${indicatorClassName}`}
          style={{
            width: `${indicator.width}px`,
            transform: `translate3d(${indicator.x}px, 0, 0) scaleX(${indicator.scaleX}) scaleY(${indicator.scaleY})`,
            transformOrigin: indicator.origin,
            willChange: 'transform, width',
            transition:
              'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), width 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          aria-hidden="true"
        />
      )}

      {/* Segment Option Buttons */}
      {normalizedOptions.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[opt.value] = el
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => handleSelect(opt.value)}
            style={{
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
            }}
            className={`relative z-10 flex items-center justify-center gap-2 ${sizeClasses} font-sans font-medium rounded-full whitespace-nowrap transition-colors duration-150 cursor-pointer ${
              fullWidth ? 'flex-1' : ''
            } ${
              isActive
                ? 'text-white dark:text-black font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white dark:bg-black/15 dark:text-black'
                    : 'bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-zinc-400'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
