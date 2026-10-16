import { useState, useEffect, useRef } from 'react'

export interface UseCountUpOptions {
  duration?: number
  delay?: number
  decimals?: number
  startOnMount?: boolean
  enabled?: boolean
  triggerKey?: number | string
}

/**
 * Smooth hardware-synced number count-up hook using requestAnimationFrame
 * with a high-end cubic-bezier easeOut curve (cubic-bezier(0.16, 1, 0.3, 1)).
 * Supports enabled trigger (e.g. scroll-into-view) and triggerKey (e.g. cursor hover).
 */
export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
): number {
  const {
    duration = 1200,
    delay = 100,
    decimals = 0,
    startOnMount = true,
    enabled = true,
    triggerKey = 0,
  } = options

  const [current, setCurrent] = useState(startOnMount && enabled ? 0 : target)
  const hasAnimatedRef = useRef(false)
  const prevTargetRef = useRef(target)

  useEffect(() => {
    if (!enabled) {
      return
    }

    // Only animate ONCE unless target value changes or explicit nonzero triggerKey is set
    if (hasAnimatedRef.current && prevTargetRef.current === target && !triggerKey) {
      setCurrent(target)
      return
    }

    hasAnimatedRef.current = true
    prevTargetRef.current = target

    let startTime: number | null = null
    let animationFrameId: number
    let timeoutId: number

    setCurrent(0)

    timeoutId = window.setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp
        const elapsed = timestamp - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Premium ease-out cubic curve: 1 - (1 - t)^3
        const easeProgress = 1 - Math.pow(1 - progress, 3)
        const nextVal = easeProgress * target

        if (decimals === 0) {
          setCurrent(Math.round(nextVal))
        } else {
          setCurrent(Number(nextVal.toFixed(decimals)))
        }

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(step)
        } else {
          setCurrent(target)
        }
      }

      animationFrameId = requestAnimationFrame(step)
    }, delay)

    return () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(animationFrameId)
    }
  }, [target, duration, delay, decimals, enabled, triggerKey])

  return current
}
