import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Play, RotateCcw, ArrowRight, User, Target, ClipboardList, RefreshCw, Sparkles, Command } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { storageService } from '../../services'
import { Goal } from '../../types'

type MotionSearchDialogProps = {
  isOpen: boolean
  onClose: () => void
}

export const MotionSearchDialog: React.FC<MotionSearchDialogProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate()
  const { allUsers } = useApp()
  const [allGoals, setAllGoals] = useState<Goal[]>([])

  useEffect(() => {
    if (isOpen) {
      setAllGoals(storageService.getState().goals || [])
    }
  }, [isOpen])

  const [activeTab, setActiveTab] = useState<'motion' | 'interactive'>('motion')
  const [isPlaying, setIsPlaying] = useState(true)
  const [timelineSec, setTimelineSec] = useState(0)
  const [interactiveQuery, setInteractiveQuery] = useState('')
  const animFrameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const FULL_TEXT = 'Best motion design tool'
  const TOTAL_DURATION = 4.5 // seconds

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Animation Loop for Timeline
  useEffect(() => {
    if (!isOpen || activeTab !== 'motion' || !isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp - timelineSec * 1000
      const elapsed = (timestamp - startTimeRef.current) / 1000

      if (elapsed >= TOTAL_DURATION) {
        setTimelineSec(TOTAL_DURATION)
        setIsPlaying(false)
        return
      }

      setTimelineSec(elapsed)
      animFrameRef.current = requestAnimationFrame(step)
    }

    animFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isOpen, activeTab, isPlaying])

  const restartAnimation = () => {
    startTimeRef.current = null
    setTimelineSec(0)
    setIsPlaying(true)
  }

  // Calculate current animation state based on timeline (0s to 4.5s)
  // 0.0s - 1.0s: Initial state - search bar top-center, text = "Best motion design tool", cursor at bottom
  // 1.0s - 2.0s: Cursor moves upward, search bar repositions down to middle, text shortens to "Be"
  // 2.0s - 4.2s: Typing out smoothly "Be" -> "Best motion design tool"
  // 4.2s - 4.5s: Settle state with cursor resting below search bar
  const calculateMotion = (t: number) => {
    let searchBarY = -48 // px offset (top-center)
    let searchBarScale = 0.96
    let cursorX = 260 // px
    let cursorY = 220 // bottom
    let cursorOpacity = 0.85
    let displayedText = FULL_TEXT
    let phaseLabel = '00:00 - 00:01 · Initial Top State'

    if (t < 1.0) {
      // Phase 1: 00:00 - 00:01
      searchBarY = -48
      searchBarScale = 0.96
      cursorX = 260
      cursorY = 200
      cursorOpacity = 0.85
      displayedText = FULL_TEXT
      phaseLabel = '00:00 - 00:01 · Initial State (Filled text, cursor at bottom)'
    } else if (t >= 1.0 && t < 2.0) {
      // Phase 2: 00:01 - 00:02 (Repositioning & Clearing to "Be")
      const progress = (t - 1.0) / 1.0
      // Smooth cubic ease: easeInOutCubic
      const ease =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2

      searchBarY = -48 + 48 * ease // slides down to 0 (lower-middle)
      searchBarScale = 0.96 + 0.04 * ease

      // Cursor moves smoothly upward toward the search bar
      cursorX = 260 - 40 * ease // moves toward center
      cursorY = 200 - 150 * ease // moves upward to 50px

      // Text clears or shortens to "Be"
      if (progress < 0.5) {
        displayedText = 'Best motio'
      } else if (progress < 0.8) {
        displayedText = 'Bes'
      } else {
        displayedText = 'Be'
      }

      phaseLabel = '00:01 - 00:02 · Repositioning Down & Clearing Text to "Be"'
    } else {
      // Phase 3: 00:02 - 00:04.5 (Typing & Final State)
      searchBarY = 0
      searchBarScale = 1.0
      const typeProgress = Math.min(1, Math.max(0, (t - 2.0) / 2.2))
      const targetLength = FULL_TEXT.length // 23 characters
      const startIndex = 2 // "Be" is length 2
      const currentCharsCount = Math.round(startIndex + (targetLength - startIndex) * typeProgress)
      displayedText = FULL_TEXT.slice(0, currentCharsCount)

      // Cursor rests near or just below search bar
      cursorX = 220 + 20 * Math.sin(typeProgress * Math.PI)
      cursorY = 55 + 25 * typeProgress // settles just below search bar
      cursorOpacity = 0.9

      phaseLabel =
        t < 4.2
          ? '00:02 - 00:04 · Typing character-by-character'
          : '00:04+ · Final settled static state'
    }

    return { searchBarY, searchBarScale, cursorX, cursorY, cursorOpacity, displayedText, phaseLabel }
  }

  const { searchBarY, searchBarScale, cursorX, cursorY, cursorOpacity, displayedText, phaseLabel } =
    calculateMotion(timelineSec)

  // Interactive Live Search filtering
  const queryLower = interactiveQuery.trim().toLowerCase()
  const matchedUsers = queryLower
    ? allUsers.filter((u) => u.name.toLowerCase().includes(queryLower) || u.role.includes(queryLower))
    : allUsers.slice(0, 3)

  const matchedGoals = queryLower
    ? allGoals.filter((g: Goal) => g.title.toLowerCase().includes(queryLower))
    : allGoals.slice(0, 3)

  const handleSelectNav = (path: string) => {
    onClose()
    navigate(path)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md transition-all animate-in fade-in duration-200">
      {/* Outer Modal Container */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#18181b] menu-solid-bg modal-surface rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-700/80 overflow-hidden flex flex-col" role="dialog">
        {/* Top Header Tab Selector & Close Button */}
        <div className="px-5 py-3.5 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-700/80 flex items-center justify-between menu-inner-card">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-slate-200 text-slate-700">
              <Command className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-bold text-slate-900 tracking-tight">PerformIQ Motion Search</span>
            <span className="text-[10px] uppercase font-sans px-2 py-0.5 bg-slate-200 text-slate-700 rounded font-semibold ml-1">
              ESC to close
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch between Motion Animation and Live Workspace Search */}
            <div className="flex p-0.5 bg-slate-200 rounded-lg text-[11px] font-medium">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('motion')
                  restartAnimation()
                }}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeTab === 'motion'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Motion Animation
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('interactive')}
                className={`px-3 py-1 rounded-md transition-all ${
                  activeTab === 'interactive'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Search
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors ml-1"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TAB 1: Smooth Motion Animation Showcase */}
        {activeTab === 'motion' && (
          <div className="p-6 sm:p-8 bg-[#F4F4F4] flex flex-col items-center justify-between min-h-[380px] select-none relative overflow-hidden">
            {/* Timeline Progress Bar & Status Pill */}
            <div className="w-full flex items-center justify-between mb-4 z-20">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/90 backdrop-blur-xs rounded-full border border-slate-200 shadow-2xs text-[11px] text-slate-700 font-medium">
                <span className="font-sans font-bold text-slate-900">
                  {timelineSec.toFixed(2)}s
                </span>
                <span className="text-slate-400">/ {TOTAL_DURATION.toFixed(1)}s</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-600 truncate max-w-[280px]">{phaseLabel}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  <Play className={`w-3 h-3 ${isPlaying ? 'fill-slate-700' : ''}`} />
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type="button"
                  onClick={restartAnimation}
                  className="p-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 shadow-2xs transition-colors"
                  title="Replay from start"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Animation Canvas Area */}
            <div className="relative w-full flex-1 flex items-center justify-center my-4 py-8">
              {/* Animated Search Bar Container */}
              <div
                style={{
                  transform: `translateY(${searchBarY}px) scale(${searchBarScale})`,
                  transition: 'transform 0.1s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className="w-full max-w-md bg-white rounded-full px-5 py-3.5 flex items-center gap-3.5 border border-black/[0.06] shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08),0_4px_12px_-2px_rgba(0,0,0,0.04)] z-10"
              >
                {/* Magnifying Glass Search Icon */}
                <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />

                {/* Animated Text Field */}
                <div className="flex-1 flex items-center text-sm font-medium text-slate-800 tracking-tight overflow-hidden">
                  <span className="truncate">{displayedText}</span>
                  {/* Blinking Typing Caret */}
                  <span className="w-0.5 h-4 bg-slate-700 ml-0.5 animate-[pulse_0.8s_infinite]" />
                </div>
              </div>

              {/* Animated Desktop Pointer Cursor */}
              <div
                style={{
                  transform: `translate(${cursorX - 220}px, ${cursorY - 100}px)`,
                  opacity: cursorOpacity,
                  transition: 'transform 0.08s ease-out, opacity 0.2s',
                }}
                className="absolute pointer-events-none z-30 flex items-start"
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="drop-shadow-[0_3px_5px_rgba(0,0,0,0.28)]"
                >
                  <path
                    d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
                    fill="#1E293B"
                    stroke="#FFFFFF"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Timeline Progress Bar Bottom */}
            <div className="w-full max-w-md mt-auto pt-2 z-20">
              <div className="w-full h-1.5 bg-slate-200/90 rounded-full overflow-hidden shadow-inner">
                <div
                  className="h-full bg-slate-800 rounded-full transition-all duration-75"
                  style={{ width: `${(timelineSec / TOTAL_DURATION) * 100}%` }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-sans mt-1 px-0.5">
                <span>00:00 Initial</span>
                <span>00:02 Reposition & Clear</span>
                <span>00:04 Settle</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Interactive Live Search in PerformIQ Workspace */}
        {activeTab === 'interactive' && (
          <div className="p-6 bg-white min-h-[380px] flex flex-col">
            {/* Live Search Input Field */}
            <div className="relative mb-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder="Type to search goals, people, cycles, and reviews..."
                value={interactiveQuery}
                onChange={(e) => setInteractiveQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 hover:bg-slate-100/60 focus:bg-white rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-800 text-slate-900 placeholder-slate-400 transition-all"
              />
            </div>

            {/* Quick Results */}
            <div className="flex-1 overflow-y-auto space-y-4 max-h-72">
              {/* People Section */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3 h-3" />
                  <span>People & Directory</span>
                </div>
                <div className="space-y-1">
                  {matchedUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectNav('/admin/users')}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between text-xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                          alt={user.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{user.name}</div>
                          <div className="text-[10px] text-slate-400 capitalize">{user.role} · {user.department}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Goals Section */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  <span>Goals & Progress</span>
                </div>
                <div className="space-y-1">
                  {matchedGoals.map((goal: Goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => handleSelectNav('/employee/goals')}
                      className="w-full text-left p-2 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between text-xs group"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{goal.title}</div>
                        <div className="text-[10px] text-slate-400">
                          Weight: {goal.weight}% · Progress: {goal.progress}%
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer Controls */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-sans shadow-2xs">ESC</kbd> to exit
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-sans shadow-2xs">⌘K</kbd> quick shortcut
            </span>
          </div>

          <div className="text-slate-400">
            PerformIQ Workspace Motion System
          </div>
        </div>
      </div>
    </div>
  )
}
