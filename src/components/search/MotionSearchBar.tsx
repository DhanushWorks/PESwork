import React, { useState, useEffect, useRef } from 'react'
import { Search, RotateCcw, Play, Pause, Sparkles } from 'lucide-react'

interface MotionSearchBarProps {
  className?: string
  autoPlay?: boolean
  loop?: boolean
}

export const MotionSearchBar: React.FC<MotionSearchBarProps> = ({
  className = '',
  autoPlay = true,
  loop = true,
}) => {
  const FULL_TEXT = 'Best motion design tool'
  const ACTIVE_DURATION = 4.2 // Motion & typing duration in seconds
  const TOTAL_CYCLE = 6.0 // Active duration + hold settled state before looping

  const [time, setTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const animRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  // Animation timeline loop
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      return
    }

    const step = (now: number) => {
      if (!startTimeRef.current) startTimeRef.current = now - time * 1000
      let elapsed = (now - startTimeRef.current) / 1000

      if (loop && elapsed >= TOTAL_CYCLE) {
        startTimeRef.current = now
        elapsed = 0
      } else if (!loop && elapsed >= ACTIVE_DURATION) {
        setTime(ACTIVE_DURATION)
        setIsPlaying(false)
        return
      }

      setTime(elapsed)
      animRef.current = requestAnimationFrame(step)
    }

    animRef.current = requestAnimationFrame(step)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, loop])

  const handleReplay = () => {
    startTimeRef.current = performance.now()
    setTime(0)
    setIsPlaying(true)
  }

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      startTimeRef.current = performance.now() - time * 1000
      setIsPlaying(true)
    }
  }

  // Smooth ease-in-out cubic easing curve
  const easeInOutCubic = (x: number): number => {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  }

  // Calculate coordinates & text based on current time
  const getSceneState = (t: number) => {
    // Stage 1: 0.0s - 1.0s (Initial State)
    // - Search bar near top
    // - Full text "Best motion design tool"
    // - Cursor visible near bottom of viewport
    if (t < 1.0) {
      return {
        barTranslateY: -44, // px upward (top position)
        barScale: 0.98,
        cursorX: 30, // px relative to center
        cursorY: 125, // px at bottom
        cursorOpacity: 1,
        text: FULL_TEXT,
        phase: '00:00 - 00:01 · Initial Top Position',
      }
    }

    // Stage 2: 1.0s - 2.0s (Transition)
    // - Cursor glides smoothly upward toward search bar
    // - Search bar animates downward to lower-center
    // - Text clears down to "Be"
    if (t >= 1.0 && t < 2.0) {
      const progress = (t - 1.0) / 1.0
      const eased = easeInOutCubic(progress)

      const barTranslateY = -44 + 44 * eased // slides down to 0 (lower-center)
      const barScale = 0.98 + 0.02 * eased
      const cursorX = 30 - 20 * eased
      const cursorY = 125 - 105 * eased // glides upward toward bar

      let currentText = FULL_TEXT
      if (progress < 0.4) {
        currentText = 'Best motio'
      } else if (progress < 0.75) {
        currentText = 'Bes'
      } else {
        currentText = 'Be'
      }

      return {
        barTranslateY,
        barScale,
        cursorX,
        cursorY,
        cursorOpacity: 1,
        text: currentText,
        phase: '00:01 - 00:02 · Repositioning Down & Clearing Text',
      }
    }

    // Stage 3: 2.0s - 4.2s (Typing & Settle)
    // - Text types out smoothly character-by-character "Be" -> "Best motion design tool"
    // - Cursor settles near the bar in final resting state
    const clampedT = Math.min(t, ACTIVE_DURATION)
    const typingProgress = Math.min(1, (clampedT - 2.0) / 2.2)
    const startCharLength = 2 // "Be"
    const targetLength = FULL_TEXT.length
    const currentChars = Math.round(startCharLength + (targetLength - startCharLength) * typingProgress)
    const text = FULL_TEXT.slice(0, currentChars)

    // Cursor settles just below / near the search bar
    const cursorX = 10 + 8 * Math.sin(typingProgress * Math.PI)
    const cursorY = 20 + 15 * typingProgress

    return {
      barTranslateY: 0,
      barScale: 1,
      cursorX,
      cursorY,
      cursorOpacity: 1,
      text,
      phase:
        t < 4.2
          ? '00:02 - 00:04 · Character-by-Character Typing'
          : '00:04+ · Settled Resting State',
    }
  }

  const { barTranslateY, barScale, cursorX, cursorY, text, phase } = getSceneState(time)

  return (
    <div
      className={`relative w-full rounded-2xl bg-gray-100 p-6 sm:p-8 flex flex-col items-center justify-between min-h-[350px] overflow-hidden select-none border border-gray-200/90 shadow-sm ${className}`}
    >
      {/* Top Header & Status Bar */}
      <div className="w-full flex items-center justify-between z-20 mb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/95 backdrop-blur-xs rounded-full border border-gray-200/90 shadow-xs text-xs text-gray-700 font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              isPlaying ? 'bg-indigo-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <span className="font-mono font-semibold text-gray-900">
            {Math.min(time, ACTIVE_DURATION).toFixed(2)}s
          </span>
          <span className="text-gray-400">/ {ACTIVE_DURATION.toFixed(1)}s</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600 truncate max-w-[190px] sm:max-w-[320px]">{phase}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleTogglePlay}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold border border-gray-200 shadow-xs transition-colors cursor-pointer"
            title={isPlaying ? 'Pause animation' : 'Play animation'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={handleReplay}
            className="p-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-200 shadow-xs transition-colors cursor-pointer"
            title="Replay from start"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Animation Stage Viewport */}
      <div className="relative w-full flex-1 flex items-center justify-center py-8">
        {/* Pill-shaped Search Bar Container */}
        <div
          style={{
            transform: `translateY(${barTranslateY}px) scale(${barScale})`,
            transition: 'transform 0.08s cubic-bezier(0.25, 1, 0.5, 1)',
          }}
          className="w-full max-w-md rounded-full bg-white shadow-md px-6 py-3 flex items-center gap-3.5 border border-black/[0.04] z-10"
        >
          {/* Magnifying Glass Icon on Left */}
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />

          {/* Animated Input Text & Blinking Caret */}
          <div className="flex-1 flex items-center text-sm font-medium text-gray-800 tracking-tight overflow-hidden">
            <span className="truncate">{text}</span>
            <span className="w-0.5 h-4 bg-gray-800 ml-0.5 animate-pulse" />
          </div>
        </div>

        {/* Custom Animated Desktop Cursor Element */}
        <div
          style={{
            transform: `translate(${cursorX}px, ${cursorY}px)`,
            transition: 'transform 0.08s ease-out',
          }}
          className="absolute pointer-events-none z-30 flex items-start"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.28)]"
          >
            <path
              d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
              fill="#111827"
              stroke="#FFFFFF"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Bottom Timeline Indicator */}
      <div className="w-full max-w-md mt-auto pt-2 z-20">
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gray-900 rounded-full transition-all duration-75"
            style={{ width: `${(Math.min(time, ACTIVE_DURATION) / ACTIVE_DURATION) * 100}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono mt-1 px-1">
          <span>00:00 Initial Top</span>
          <span>00:01 Gliding Down</span>
          <span>00:02 Typing</span>
          <span>00:04 Settle</span>
        </div>
      </div>
    </div>
  )
}
