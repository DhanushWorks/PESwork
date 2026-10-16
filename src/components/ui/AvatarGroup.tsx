import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Users, X, ChevronRight } from 'lucide-react'
import { User } from '../../types'
import { RoleBadge } from './Badge'

type AvatarGroupProps = {
  users: User[]
  max?: number
  size?: 'xs' | 'sm' | 'md' | 'lg'
  onUserClick?: (user: User) => void
  onMoreClick?: () => void
  showTooltip?: boolean
  className?: string
  interactive?: boolean
}

// Deterministic clean neutral palette for initials
function getInitialsColor(name: string): string {
  const colors = [
    'bg-zinc-800 text-zinc-200 border-zinc-700',
    'bg-neutral-800 text-neutral-200 border-neutral-700',
    'bg-stone-800 text-stone-200 border-stone-700',
    'bg-slate-800 text-slate-200 border-slate-700',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  users,
  max = 5,
  size = 'md',
  onUserClick,
  onMoreClick,
  showTooltip = true,
  className = '',
  interactive = true,
}) => {
  const [hoveredUser, setHoveredUser] = useState<User | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; bottom: number } | null>(null)
  const [showAllPopover, setShowAllPopover] = useState(false)
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Comprehensive background scroll lock & global wheel isolation
  useEffect(() => {
    if (!showAllPopover) return

    const originalBodyOverflow = document.body.style.overflow
    const originalHtmlOverflow = document.documentElement.style.overflow
    const originalBodyPaddingRight = document.body.style.paddingRight
    const savedScrollY = window.scrollY

    // Compensate for scrollbar removal to prevent layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    // Hardware lock: snap window position if browser tries to scroll the background
    const handleWindowScroll = () => {
      if (window.scrollY !== savedScrollY) {
        window.scrollTo(0, savedScrollY)
      }
    }

    // Global capture-phase wheel interceptor: ONLY allows the list to scroll, never the page
    const handleCaptureWheel = (e: WheelEvent) => {
      const listEl = listRef.current
      if (!listEl) {
        e.preventDefault()
        return
      }

      // If wheel event occurred outside the roster list (e.g. backdrop, header, or card borders)
      if (!listEl.contains(e.target as Node)) {
        e.preventDefault()
        return
      }

      // If wheel event occurred inside the list:
      const isScrollingUp = e.deltaY < 0
      const isScrollingDown = e.deltaY > 0
      const isAtTop = listEl.scrollTop <= 0
      const isAtBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 1

      // Block boundary chaining when reaching top or bottom limit
      if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
        e.preventDefault()
        return
      }

      // Normal scroll inside list is permitted; stop propagation to window
      e.stopPropagation()
    }

    const handleCaptureTouch = (e: TouchEvent) => {
      const listEl = listRef.current
      if (!listEl || !listEl.contains(e.target as Node)) {
        e.preventDefault()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAllPopover(false)
      }
    }

    const handleResize = () => {
      setShowAllPopover(false)
    }

    window.addEventListener('scroll', handleWindowScroll, { passive: false })
    window.addEventListener('wheel', handleCaptureWheel, { passive: false, capture: true })
    window.addEventListener('touchmove', handleCaptureTouch, { passive: false, capture: true })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', handleResize)

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.documentElement.style.overflow = originalHtmlOverflow
      document.body.style.paddingRight = originalBodyPaddingRight
      window.removeEventListener('scroll', handleWindowScroll)
      window.removeEventListener('wheel', handleCaptureWheel, { capture: true })
      window.removeEventListener('touchmove', handleCaptureTouch, { capture: true })
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [showAllPopover])

  const visibleUsers = users.slice(0, max)
  const remainingCount = Math.max(0, users.length - max)

  const sizeClasses = {
    xs: {
      avatar: 'w-6 h-6 text-[9px]',
      space: '-space-x-1.5',
      ring: 'ring-1.5',
      badge: 'w-6 h-6 text-[9px]',
    },
    sm: {
      avatar: 'w-7 h-7 text-[10px]',
      space: '-space-x-2',
      ring: 'ring-2',
      badge: 'w-7 h-7 text-[10px]',
    },
    md: {
      avatar: 'w-9 h-9 text-xs',
      space: '-space-x-2.5',
      ring: 'ring-2',
      badge: 'w-9 h-9 text-xs',
    },
    lg: {
      avatar: 'w-11 h-11 text-sm',
      space: '-space-x-3',
      ring: 'ring-2',
      badge: 'w-11 h-11 text-xs',
    },
  }[size]

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Overlapping Avatar Stack */}
      <div className={`flex items-center ${sizeClasses.space} isolate`}>
        {visibleUsers.map((u, idx) => {
          const initials = getInitials(u.name)
          const colorClass = getInitialsColor(u.name)

          return (
            <div
              key={u.id}
              className={`relative group/item transition-all duration-150 ${
                interactive
                  ? 'cursor-pointer hover:z-30 hover:-translate-y-0.5 hover:scale-105'
                  : ''
              }`}
              style={{ zIndex: visibleUsers.length - idx }}
              onClick={() => onUserClick?.(u)}
              onMouseEnter={(e) => {
                if (!showTooltip) return
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltipPos({
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                  bottom: rect.bottom,
                })
                setHoveredUser(u)
              }}
              onMouseLeave={() => setHoveredUser(null)}
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt={u.name}
                  className={`${sizeClasses.avatar} rounded-full object-cover ${sizeClasses.ring} ring-white dark:ring-black shadow-xs group-hover/item:ring-zinc-400 dark:group-hover/item:ring-zinc-600 transition-all`}
                />
              ) : (
                <div
                  className={`${sizeClasses.avatar} rounded-full ${colorClass} ${sizeClasses.ring} ring-white dark:ring-black shadow-xs flex items-center justify-center font-medium group-hover/item:ring-zinc-400 dark:group-hover/item:ring-zinc-600 transition-all select-none`}
                >
                  {initials}
                </div>
              )}

              {/* Status pulse dot for active user */}
              {u.active && (
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-indigo-600 dark:bg-emerald-500 ring-1.5 ring-white dark:ring-black" />
              )}
            </div>
          )
        })}

        {/* Counter Badge (+N) */}
        {remainingCount > 0 && (
          <div
            className={`relative transition-all duration-150 ${
              interactive
                ? 'cursor-pointer hover:z-30 hover:-translate-y-0.5 hover:scale-105'
                : ''
            }`}
            style={{ zIndex: 0 }}
            onClick={(e) => {
              if (onMoreClick) {
                onMoreClick()
              } else {
                const rect = e.currentTarget.getBoundingClientRect()
                const popoverWidth = 320
                // Calculate estimated height: header (46px) + items (max ~280px) + footer (34px)
                const estimatedHeight = Math.min(360, 80 + users.length * 48)
                const spaceBelow = window.innerHeight - rect.bottom
                const spaceAbove = rect.top

                let top: number
                // Only flip upward if space below is critically constrained (< 220px) AND space above is ample
                if (spaceBelow < 220 && spaceAbove > estimatedHeight + 16) {
                  top = rect.top - estimatedHeight - 12
                } else {
                  // Position downward below the trigger badge
                  top = rect.bottom + 14
                }

                // Strictly clamp within viewport bounds so it NEVER cuts off or goes off-screen
                top = Math.max(16, Math.min(window.innerHeight - estimatedHeight - 16, top))

                // Shift rightward aligned with the badge with slight offset
                const idealLeft = rect.left - 48
                const left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 20, idealLeft))

                setPopoverPos({ x: left, y: top })
                setShowAllPopover((prev) => !prev)
              }
            }}
            title={`${remainingCount} more employees`}
          >
            <div
              className={`${sizeClasses.badge} rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${sizeClasses.ring} ring-white dark:ring-black shadow-xs flex items-center justify-center font-medium text-slate-700 dark:text-zinc-300 transition-colors select-none`}
            >
              +{remainingCount}
            </div>
          </div>
        )}
      </div>

      {/* Floating Hover Card / Tooltip via Portal */}
      {hoveredUser && tooltipPos && typeof document !== 'undefined' && createPortal(
        (() => {
          const isFlipped = tooltipPos.y < 130
          return (
            <div
              className={`fixed z-[9999] pointer-events-none transform -translate-x-1/2 ${
                isFlipped ? 'translate-y-2' : '-translate-y-full -mt-2'
              } animate-in fade-in zoom-in-95 duration-100`}
              style={{
                left: `${Math.max(120, Math.min(window.innerWidth - 120, tooltipPos.x))}px`,
                top: `${isFlipped ? tooltipPos.bottom : tooltipPos.y}px`,
              }}
            >
              <div className="bg-white dark:bg-black rounded-lg p-3 border border-slate-200 dark:border-zinc-800 shadow-xl min-w-[210px] text-xs space-y-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={
                      hoveredUser.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                    }
                    alt={hoveredUser.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-zinc-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                      <span>{hoveredUser.name}</span>
                      {hoveredUser.active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      {hoveredUser.designation}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <RoleBadge role={hoveredUser.role} />
                  <span className="text-slate-400 dark:text-zinc-500 font-mono text-[10px]">
                    {hoveredUser.employeeCode}
                  </span>
                </div>
              </div>
            </div>
          )
        })(),
        document.body
      )}

      {/* Click-to-View Popover Modal for remaining employees via Portal */}
      {showAllPopover && popoverPos && typeof document !== 'undefined' && createPortal(
        <>
          {/* Explicit CSS to eliminate native scrollbars in any engine */}
          <style>{`
            .popover-scroll-list::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
              background: transparent !important;
            }
            .popover-scroll-list {
              -ms-overflow-style: none !important;
              scrollbar-width: none !important;
            }
          `}</style>

          {/* Transparent click-away backdrop with ZERO background blur */}
          <div
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={() => setShowAllPopover(false)}
            onWheel={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onTouchMove={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          />

          {/* Popover Card - Solid crisp background, zero blur on page */}
          <div
            className="fixed z-[9999] bg-white dark:bg-[#121214] rounded-2xl p-3.5 border border-slate-200/90 dark:border-white/12 shadow-[0_20px_50px_-10px_rgba(15,23,42,0.25)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] w-80 max-h-[min(380px,calc(100vh-24px))] flex flex-col overscroll-contain animate-in fade-in-0 zoom-in-95 duration-150 select-none"
            style={{
              left: `${popoverPos.x}px`,
              top: `${popoverPos.y}px`,
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="font-semibold text-slate-900 dark:text-white text-xs tracking-tight">
                  Team Personnel
                </span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/30">
                  {users.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAllPopover(false)}
                className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable Members List with strict non-chaining wheel trap and no scrollbar */}
            <div
              ref={listRef}
              className="popover-scroll-list overflow-y-auto no-scrollbar scrollbar-none overscroll-contain flex-1 pr-0.5 space-y-1"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              {users.map((u) => {
                const initials = getInitials(u.name)
                const colorClass = getInitialsColor(u.name)

                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      onUserClick?.(u)
                      setShowAllPopover(false)
                    }}
                    className="group flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-100/80 dark:hover:bg-white/[0.06] active:scale-[0.98] transition-all cursor-pointer border border-transparent hover:border-slate-200/60 dark:hover:border-white/10 text-xs"
                  >
                    <div className="relative shrink-0">
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-white/10 ring-1 ring-slate-100 dark:ring-white/5"
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 rounded-full ${colorClass} flex items-center justify-center font-medium text-[11px] ring-1 ring-slate-100 dark:ring-white/5`}
                        >
                          {initials}
                        </div>
                      )}
                      {u.active && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1.5 ring-white dark:ring-[#121214]" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center justify-between gap-1">
                        <span className="truncate">{u.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-zinc-400 capitalize border border-slate-200/60 dark:border-white/10 shrink-0 font-normal">
                          {u.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {u.designation}
                      </div>
                    </div>

                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 font-mono px-0.5">
              <span>{remainingCount > 0 ? `${remainingCount} hidden in stack` : 'All team members'}</span>
              <span>Esc to close</span>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
