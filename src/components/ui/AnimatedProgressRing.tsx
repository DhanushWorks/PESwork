import React, { useEffect, useState, useRef } from 'react'

export interface AnimatedProgressRingProps {
  /** Target value, e.g. 6 or 78 */
  value: number
  /** Max value, default 100 */
  max?: number
  /** Diameter of the SVG ring in px */
  size?: number
  /** Stroke width in px */
  strokeWidth?: number
  /** Optional custom viewBox, e.g. "0 0 150 150" */
  viewBox?: string
  /** Radius of the circle. If omitted, calculated as (size - strokeWidth) / 2 */
  radius?: number
  /** Custom gradient ID */
  gradientId?: string
  /** Gradient start and end colors */
  gradientColors?: [string, string]
  /** Animation duration in ms */
  duration?: number
  /** Initial delay before animation triggers in ms */
  delay?: number
  /** Custom class for outer wrapper */
  className?: string
  /** Custom class for background ring */
  trackClassName?: string
  /** Custom class for active animated arc */
  arcClassName?: string
  /** Elements rendered in the dead center of the ring */
  children?: React.ReactNode
  /** Controlled enabled trigger for scroll-in-view */
  enabled?: boolean
  /** Re-trigger key (e.g. cursor hover or mouse movement) */
  triggerKey?: number | string
  /** Replay animation when hovered directly */
  replayOnHover?: boolean
}

export const AnimatedProgressRing: React.FC<AnimatedProgressRingProps> = ({
  value,
  max = 100,
  size = 170,
  strokeWidth = 9,
  viewBox,
  radius: customRadius,
  gradientId = 'animated-gauge-gradient',
  gradientColors = ['#8B7CFF', '#4FE3C1'],
  duration = 1300,
  delay = 100,
  className = '',
  trackClassName = 'text-slate-200 dark:text-white/[0.07]',
  arcClassName = '',
  children,
  enabled = true,
  triggerKey = 0,
  replayOnHover = false,
}) => {
  const [isAnimated, setIsAnimated] = useState(false)
  const hasAnimatedRef = useRef(false)
  const prevValueRef = useRef(value)

  // Calculate geometry
  const center = size / 2
  const radius = customRadius ?? (center - strokeWidth / 2)
  const circumference = 2 * Math.PI * radius

  const clampedValue = Math.max(0, Math.min(max, value))
  const progressRatio = max > 0 ? clampedValue / max : 0

  // Standard stroke-dashoffset formula:
  // offset = circumference - (ratio * circumference)
  const targetOffset = circumference - progressRatio * circumference

  useEffect(() => {
    if (!enabled) return

    // If already animated once and value hasn't changed, stay at final position!
    if (hasAnimatedRef.current && prevValueRef.current === value && !triggerKey) {
      setIsAnimated(true)
      return
    }

    hasAnimatedRef.current = true
    prevValueRef.current = value

    setIsAnimated(false)

    const timeout = window.setTimeout(() => {
      setIsAnimated(true)
    }, delay)

    return () => clearTimeout(timeout)
  }, [delay, enabled, value, triggerKey])

  const vb = viewBox || `0 0 ${size} ${size}`
  const vbParts = vb.split(' ').map(Number)
  const cx = vbParts.length === 4 ? vbParts[2] / 2 : center
  const cy = vbParts.length === 4 ? vbParts[3] / 2 : center

  return (
    <div
      className={`relative shrink-0 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={vb}
        aria-hidden="true"
        className="w-full h-full transform -rotate-90 pointer-events-none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={gradientColors[0]} />
            <stop offset="100%" stopColor={gradientColors[1]} />
          </linearGradient>
        </defs>

        {/* Background Track Circle */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />

        {/* Active Animated Arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={isAnimated ? targetOffset : circumference}
          style={{
            transition: isAnimated
              ? `stroke-dashoffset ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`
              : 'none',
          }}
          className={arcClassName}
        />
      </svg>

      {/* Centered Content */}
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-auto">
          {children}
        </div>
      )}
    </div>
  )
}
