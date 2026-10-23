import React, { useEffect, useState, useRef } from 'react'

export interface SegmentItem {
  id?: string | number
  weight: number
  opacity?: number
  title?: string
  color?: string
}

export interface AnimatedSegmentedBarsProps {
  segments: SegmentItem[]
  heightClass?: string
  delay?: number
  stagger?: number
  barColor?: string
  className?: string
  /** Controlled enabled trigger for scroll-in-view */
  enabled?: boolean
  /** Re-trigger key (e.g. cursor hover or mouse movement) */
  triggerKey?: number | string
  /** Replay animation when hovered directly */
  replayOnHover?: boolean
}

export const AnimatedSegmentedBars: React.FC<AnimatedSegmentedBarsProps> = ({
  segments,
  heightClass = 'h-2',
  delay = 140,
  stagger = 110,
  barColor = '#0f172a',
  className = '',
  enabled = true,
  triggerKey = 0,
  replayOnHover = false,
}) => {
  const [isAnimated, setIsAnimated] = useState(false)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    if (hasAnimatedRef.current && !replayOnHover && !triggerKey) {
      setIsAnimated(true)
      return
    }

    hasAnimatedRef.current = true

    const timer = window.setTimeout(() => {
      setIsAnimated(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, enabled, triggerKey, replayOnHover])

  const defaultOpacities = [1, 0.75, 0.55, 0.38]

  return (
    <div className={`flex gap-1.5 ${heightClass} ${className}`}>
      {segments.map((seg, idx) => {
        const opacity = seg.opacity ?? defaultOpacities[idx % defaultOpacities.length]
        const color = seg.color ?? barColor

        return (
          <div
            key={seg.id ?? idx}
            className={`h-full bg-slate-200/60 dark:bg-white/[0.06] rounded-full overflow-hidden`}
            style={{ flex: seg.weight || 25 }}
            title={seg.title || `Weight: ${seg.weight}%`}
          >
            <div
              className={`h-full rounded-full ${
                isAnimated ? 'transition-all duration-700 ease-out' : ''
              }`}
              style={{
                backgroundColor: color,
                width: isAnimated ? '100%' : '0%',
                opacity: isAnimated ? opacity : 0,
                transitionDelay: isAnimated ? `${idx * stagger + delay}ms` : '0ms',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
