import React, { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { useToast } from '../../components/ui/Toast'
import {
  Bell,
  Search,
  ChevronDown,
  CheckCircle2,
  Calendar,
  Layers,
  Menu,
  RotateCcw,
  Sparkles,
  UserCheck,
  LogOut,
  X,
  Settings,
  ArrowRight,
  Target,
  Check,
  CreditCard,
  Building2,
  Shield,
} from 'lucide-react'
import { CYCLE_STAGE_DETAILS } from '../../lib/formatters'
import { ConfirmDialog } from '../ui/Modal'
import { storageService } from '../../services'
import { Goal } from '../../types'
import { AnimatedSearchBar } from '../ui/AnimatedSearchBar'
import { AnimatedBrandLogo } from '../ui/AnimatedBrandLogo'
import { ThemeToggle } from '../ui/ThemeToggle'

type AppHeaderProps = {
  onToggleSidebar: () => void
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  onToggleSidebar,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const {
    currentUser,
    activeWorkspaceRole,
    activeCycle,
    allCycles,
    allUsers,
    switchUser,
    switchActiveCycle,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    switchWorkspaceRole,
    resetDemoData,
    signOut,
  } = useApp()

  const navigate = useNavigate()
  const location = useLocation()
  const { success } = useToast()

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [goalsList, setGoalsList] = useState<Goal[]>([])

  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Dedicated refs for isolating dropdown scroll from background UI
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const notifDropdownRef = useRef<HTMLDivElement>(null)
  const notifListRef = useRef<HTMLDivElement>(null)
  const searchDropdownRef = useRef<HTMLDivElement>(null)
  const searchListRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setGoalsList(storageService.getState().goals || [])
  }, [])

  // Isolate wheel scrolling inside User Menu: wheeling over dropdown will never scroll background UI
  useEffect(() => {
    if (!showUserMenu) return
    const dropdownEl = userDropdownRef.current
    if (!dropdownEl) return

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation()
    }

    dropdownEl.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      dropdownEl.removeEventListener('wheel', handleWheel)
    }
  }, [showUserMenu])

  // Isolate wheel scrolling inside Notifications Menu
  useEffect(() => {
    if (!showNotifMenu) return
    const dropdownEl = notifDropdownRef.current
    if (!dropdownEl) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (notifListRef.current) {
        notifListRef.current.scrollTop += e.deltaY
      }
    }

    dropdownEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      dropdownEl.removeEventListener('wheel', handleWheel)
    }
  }, [showNotifMenu])

  // Isolate wheel scrolling inside Live Search Quick Results
  useEffect(() => {
    if (!showSearchResults) return
    const dropdownEl = searchDropdownRef.current
    if (!dropdownEl) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (searchListRef.current) {
        searchListRef.current.scrollTop += e.deltaY
      }
    }

    dropdownEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      dropdownEl.removeEventListener('wheel', handleWheel)
    }
  }, [showSearchResults])

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false)
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false)
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(e.target as Node) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(e.target as Node))
      ) {
        setShowSearchResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close mobile search and dropdowns on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchResults(false)
        setIsMobileSearchOpen(false)
        setShowUserMenu(false)
        setShowNotifMenu(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Automatically reset mobile search if screen widens to >= sm
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 640 && isMobileSearchOpen) {
        setIsMobileSearchOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileSearchOpen])

  const handleReset = async () => {
    setIsResetting(true)
    await resetDemoData()
    setIsResetting(false)
    setShowResetDialog(false)
    success('Demo data restored', 'All mock records have been reset to clean fictional state.')
  }

  const stageInfo = CYCLE_STAGE_DETAILS[activeCycle?.stage || 'tracking']

  const queryLower = searchQuery.trim().toLowerCase()
  const matchedPeople = queryLower
    ? allUsers.filter((u) => u.name.toLowerCase().includes(queryLower) || u.department.toLowerCase().includes(queryLower))
    : []
  const matchedGoals = queryLower
    ? goalsList.filter((g) => g.title.toLowerCase().includes(queryLower))
    : []

  const handleSelectPerson = (u: any) => {
    if (currentUser.role === 'admin') {
      navigate('/admin/users')
    } else if (currentUser.role === 'manager') {
      navigate('/manager/approvals')
    } else {
      navigate('/employee/feedback')
    }
    setShowSearchResults(false)
    setIsMobileSearchOpen(false)
    setSearchQuery('')
  }

  const handleSelectGoal = (g: Goal) => {
    if (currentUser.role === 'admin') {
      navigate('/admin/cycles')
    } else if (currentUser.role === 'manager') {
      navigate('/manager/approvals')
    } else {
      navigate(`/employee/goals/${g.id}`)
    }
    setShowSearchResults(false)
    setIsMobileSearchOpen(false)
    setSearchQuery('')
  }

  const renderSearchResults = () => (
    <>
      <div className="px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
        <span>Search Results</span>
        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-normal">
          {matchedPeople.length + matchedGoals.length} results
        </span>
      </div>
      {matchedPeople.length === 0 && matchedGoals.length === 0 ? (
        <div className="px-3 py-4 text-slate-400 dark:text-zinc-500 text-center text-xs">
          No results for "{searchQuery}"
        </div>
      ) : (
        <div
          ref={searchListRef}
          className="divide-y divide-slate-100 dark:divide-zinc-800/80 max-h-64 overflow-y-auto no-scrollbar overscroll-contain"
        >
          {matchedPeople.length > 0 && (
            <div className="p-1.5">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Teammates
              </div>
              {matchedPeople.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  onClick={() => handleSelectPerson(u)}
                  className="flex items-center gap-2.5 p-2 hover:bg-slate-50 dark:hover:bg-zinc-800/70 rounded-xl cursor-pointer transition-colors group"
                >
                  <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-200 dark:ring-zinc-700" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {u.name}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-zinc-400 truncate">{u.designation}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {matchedGoals.length > 0 && (
            <div className="p-1.5">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Goals
              </div>
              {matchedGoals.slice(0, 3).map((g) => (
                <div
                  key={g.id}
                  onClick={() => handleSelectGoal(g)}
                  className="p-2 hover:bg-slate-50 dark:hover:bg-zinc-800/70 rounded-xl cursor-pointer transition-colors group"
                >
                  <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {g.title}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-zinc-400">Progress: {g.progress}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <>
      <header
        className={`fixed top-0 right-0 z-30 h-12 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-b border-[#d6deea] dark:border-white/[0.08] px-3 sm:px-5 flex items-center justify-between shadow-2xs transition-[left] duration-300 ease-in-out left-0 ${
          isCollapsed ? 'lg:left-12' : 'lg:left-60'
        }`}
      >
        {isMobileSearchOpen ? (
          /* Mobile Full-Width Search Input Mode */
          <div className="flex items-center gap-2 w-full animate-in fade-in duration-150" ref={mobileSearchRef}>
            <div className="relative flex-1">
              <AnimatedSearchBar
                value={searchQuery}
                onChangeValue={(val) => {
                  setSearchQuery(val)
                  setShowSearchResults(true)
                }}
                onFocus={() => setShowSearchResults(true)}
                placeholder="Search directory..."
                animatedText="Search directory..."
                variant="pill"
                sizeVariant="sm"
                containerClassName="w-full"
                autoFocus
              />

              {/* Mobile Live Search Quick Results Dropdown */}
              {showSearchResults && queryLower.length > 0 && (
                <div
                  ref={searchDropdownRef}
                  className="fixed left-3 right-3 top-13 bg-white dark:bg-[#18181b] menu-solid-bg rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700/80 py-2 z-50 text-xs text-slate-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 overscroll-contain"
                  role="menu"
                >
                  {renderSearchResults()}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false)
                setShowSearchResults(false)
                setSearchQuery('')
              }}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
              title="Close search"
              aria-label="Close search bar"
            >
              <X className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        ) : (
          <>
            {/* Left: Mobile-only drawer toggle + Project Logo & Brand Name */}
            <div className="flex items-center gap-2 sm:gap-3.5 shrink-0 min-w-max">
              <button
                type="button"
                onClick={onToggleSidebar}
                className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Open navigation menu"
                aria-label="Open navigation sidebar"
              >
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </button>

              {/* Project Name with Logo Symbol: (logo symbol)PerformIQ */}
              <div className="flex items-center shrink-0">
                <AnimatedBrandLogo
                  to={`/${currentUser.role}`}
                  logoSize="w-6 h-6 sm:w-6.5 sm:h-6.5"
                  textSize="text-sm sm:text-base font-bold tracking-tight whitespace-nowrap"
                  showGlow={false}
                  interactive={true}
                />
              </div>
            </div>

            {/* Right Actions: Mobile Search Trigger / Desktop Pill Search Bar + Theme Toggle + Bell 🔔 + Avatar */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Mobile Search Button (visible only below sm breakpoint) */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileSearchOpen(true)
                  setShowSearchResults(true)
                }}
                className="sm:hidden p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
                title="Search directory"
                aria-label="Open search bar"
              >
                <Search className="w-4.5 h-4.5 text-slate-600 dark:text-slate-300" />
              </button>

              {/* Desktop & Tablet Inline Search Bar (visible on sm and up) */}
              <div className="relative hidden sm:block" ref={searchRef}>
                <AnimatedSearchBar
                  value={searchQuery}
                  onChangeValue={(val) => {
                    setSearchQuery(val)
                    setShowSearchResults(true)
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  placeholder="Search directory..."
                  animatedText="Search directory..."
                  variant="pill"
                  sizeVariant="sm"
                  containerClassName="w-36 md:w-48 lg:w-56 focus-within:w-48 md:focus-within:w-56 lg:focus-within:w-64"
                />

                {/* Desktop Live Search Quick Results Dropdown */}
                {showSearchResults && queryLower.length > 0 && (
                  <div
                    ref={searchDropdownRef}
                    className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white dark:bg-[#18181b] menu-solid-bg rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700/80 py-2 z-50 text-xs text-slate-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 overscroll-contain"
                    role="menu"
                  >
                    {renderSearchResults()}
                  </div>
                )}
              </div>

          {/* Dark Mode / White Mode Animated Toggle */}
          <ThemeToggle />

          {/* Notifications Bell 🔔 (Banking App: Cards Motion Trigger & Stack) */}
          <div className="relative" ref={notifMenuRef}>
            <button
              type="button"
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className={`relative p-2 rounded-xl transition-all duration-200 cursor-pointer group active:scale-95 ${
                showNotifMenu
                  ? 'bg-slate-100 dark:bg-zinc-800/90 text-slate-900 dark:text-white ring-2 ring-slate-900/10 dark:ring-white/15'
                  : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100/80 dark:hover:bg-zinc-800/60'
              }`}
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell
                className={`w-4 h-4 transition-transform duration-300 ${
                  showNotifMenu ? 'animate-bell-ring text-slate-900 dark:text-white' : 'group-hover:scale-110'
                }`}
              />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 dark:bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-900 dark:bg-white ring-2 ring-white dark:ring-[#121215]"></span>
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div
                ref={notifDropdownRef}
                className="absolute right-0 mt-2.5 w-[350px] sm:w-[390px] bg-white dark:bg-[#18181b] menu-solid-bg rounded-3xl shadow-2xl border border-slate-200/90 dark:border-zinc-700/80 overflow-hidden z-50 animate-dropdown-entrance overscroll-contain flex flex-col"
                role="dialog"
              >
                {/* Notification Dropdown Header */}
                <div className="px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900 flex items-center justify-between shrink-0 menu-inner-card">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center shadow-xs shrink-0">
                      <Bell className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                          Notifications
                        </span>
                        {unreadNotificationsCount > 0 ? (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-zinc-950 font-bold">
                            {unreadNotificationsCount} NEW
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold">
                            ALL READ
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono tracking-tight mt-0.5">
                        LIVE APPRAISAL FEED
                      </p>
                    </div>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead()}
                      className="text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-zinc-800"
                      title="Mark all as read"
                    >
                      <Check className="w-3 h-3" />
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Staggered Banking Cards Container */}
                <div
                  ref={notifListRef}
                  className="max-h-[390px] overflow-y-auto no-scrollbar overscroll-contain p-3 space-y-3"
                >
                  {notifications.length === 0 ? (
                    <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/30">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-slate-400 dark:text-zinc-500 mb-2.5">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider font-mono">
                        Stack Cleared
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                        All transaction & appraisal cards are up to date.
                      </p>
                    </div>
                  ) : (
                    notifications.map((n, idx) => {
                      const lower = (n.title + ' ' + n.message).toLowerCase()
                      const isKudos = lower.includes('kudo') || lower.includes('praise') || lower.includes('recognition')
                      const isCycle = lower.includes('cycle') || lower.includes('stage') || lower.includes('review') || lower.includes('appraisal')
                      const cardCategory = isKudos ? 'KUDOS CARD' : isCycle ? 'CYCLE EVENT' : 'GOAL TARGET'
                      const CardIcon = isKudos ? Sparkles : isCycle ? Calendar : Target
                      const cardId = n.id ? n.id.slice(-4).toUpperCase() : `${idx + 10}01`

                      return (
                        <div
                          key={n.id}
                          className={`animate-banking-card group relative overflow-hidden rounded-2xl p-3.5 transition-all duration-200 cursor-pointer border ${
                            !n.read
                              ? 'bg-gradient-to-br from-white via-slate-50/95 to-slate-100/90 dark:from-[#27272a] dark:via-[#18181b] dark:to-[#18181b] border-slate-300/90 dark:border-zinc-700/80 shadow-md shadow-slate-200/50 dark:shadow-black/50'
                              : 'bg-white/80 dark:bg-[#18181b]/90 border-slate-200/80 dark:border-zinc-700/80 shadow-xs opacity-85 hover:opacity-100'
                          } hover:-translate-y-0.5 hover:shadow-xs hover:border-slate-400 dark:hover:border-zinc-500`}
                          style={{
                            animationDelay: `${Math.min(idx * 55, 300)}ms`,
                          }}
                          onClick={() => {
                            if (!n.read) markNotificationRead(n.id)
                            setShowNotifMenu(false)
                            if (n.link.startsWith('/admin') && currentUser.role !== 'admin') {
                              navigate(`/${currentUser.role}`)
                            } else if (n.link.startsWith('/manager') && currentUser.role !== 'manager') {
                              navigate(`/${currentUser.role}`)
                            } else if (n.link.startsWith('/employee') && currentUser.role !== 'employee') {
                              navigate(`/${currentUser.role}`)
                            } else {
                              navigate(n.link)
                            }
                          }}
                        >
                          {/* Light sheen reflection sweep across card on hover */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 dark:via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                          {/* Top accent sheen for unread cards */}
                          {!n.read && (
                            <div className="absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-slate-900 dark:via-white to-transparent opacity-80" />
                          )}

                          {/* Card Meta Header */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              {/* EMV Micro Chip Graphic */}
                              <div className="w-5 h-4 rounded-sm bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 dark:from-zinc-700 dark:via-zinc-800 dark:to-zinc-900 border border-slate-400/50 dark:border-zinc-600/70 p-0.5 flex flex-col justify-between shrink-0 shadow-2xs">
                                <div className="w-full h-0.5 bg-slate-500/40 dark:bg-zinc-400/30 rounded-xs" />
                                <div className="w-full h-0.5 bg-slate-500/40 dark:bg-zinc-400/30 rounded-xs" />
                              </div>

                              {/* Category Pill */}
                              <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-slate-600 dark:text-zinc-400 flex items-center gap-1">
                                <CardIcon className="w-2.5 h-2.5" />
                                {cardCategory}
                              </span>
                            </div>

                            {/* Micro Card Number & Unread Pulse */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 tracking-wider">
                                #{cardId}
                              </span>
                              {!n.read && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 dark:bg-white opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-900 dark:bg-white" />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Title & Description */}
                          <div className="pr-1">
                            <h4 className={`text-xs tracking-tight line-clamp-1 ${
                              !n.read
                                ? 'font-bold text-slate-950 dark:text-white'
                                : 'font-semibold text-slate-700 dark:text-zinc-300'
                            }`}>
                              {n.title}
                            </h4>
                            <p className="text-[11px] leading-snug text-slate-600 dark:text-zinc-300 line-clamp-2 mt-1">
                              {n.message}
                            </p>
                          </div>

                          {/* Card Footer: Timestamp + Action Link */}
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60 flex items-center justify-between text-[10px]">
                            <span className="font-mono text-slate-400 dark:text-zinc-500">
                              {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="notif-card-pill inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full transition-all">
                              View Card <ArrowRight className="w-2.5 h-2.5 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Footer Link to Settings */}
                <div className="mt-2 px-2.5 py-1.5 border-t border-slate-200/80 dark:border-zinc-800/80 bg-slate-50 dark:bg-zinc-900 rounded-b-2xl flex items-center justify-between text-[11px] menu-inner-card">
                  <Link
                    to="/settings"
                    onClick={() => setShowNotifMenu(false)}
                    className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 font-medium transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Notification Settings</span>
                  </Link>
                  <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                </div>
              </div>
            )}
          </div>



          {/* User Profile Avatar with Status Dot & Downward Arrow ▼ */}
          <div className="relative pl-1" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors group cursor-pointer"
              aria-label="User profile and role menu"
            >
              <div className="relative">
                <img
                  src={
                    currentUser.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                  }
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-200 dark:ring-zinc-700 group-hover:ring-slate-400 dark:group-hover:ring-zinc-500 transition-all"
                />
                {/* Active status indicator dot */}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-200 transition-transform" />
            </button>

            {/* User Dropdown / Authenticated User Profile */}
            {showUserMenu && (
              <div
                ref={userDropdownRef}
                className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#18181b] menu-solid-bg rounded-2xl shadow-2xl border border-slate-200/90 dark:border-zinc-700/80 p-3 z-50 text-slate-800 dark:text-zinc-200 animate-in fade-in zoom-in-95 text-xs overscroll-contain"
                role="menu"
              >
                {/* Executive Current Identity Card */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900/90 border border-slate-200/80 dark:border-zinc-800/80 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name}
                        className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-200 dark:ring-zinc-700 shadow-xs"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="font-bold text-slate-900 dark:text-zinc-100 truncate text-sm tracking-tight">
                          {currentUser.name}
                        </p>
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                          {currentUser.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                        {currentUser.designation}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate font-mono mt-0.5">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>

                  {/* Profile Metadata Mini Grid */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-200/70 dark:border-zinc-800 text-[11px]">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                      <span className="truncate">{currentUser.department}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-zinc-400 truncate justify-end font-mono">
                      <span className="text-slate-400 dark:text-zinc-500">ID:</span>
                      <span className="truncate">{currentUser.employeeCode}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Navigation Links */}
                <div className="space-y-1">
                  {currentUser.role === 'employee' ? (
                    <Link
                      to="/employee/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-xs font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>My Employee Profile</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                    </Link>
                  ) : currentUser.role === 'manager' ? (
                    <Link
                      to="/manager"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-xs font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Manager Workspace</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                    </Link>
                  ) : (
                    <Link
                      to="/admin"
                      onClick={() => setShowUserMenu(false)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-xs font-medium cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Admin Hub</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                    </Link>
                  )}

                  <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800/80 transition-colors text-xs font-medium cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Settings className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-400" />
                      <span>Account Settings</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                  </Link>

                  <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-zinc-800">
                    <button
                      type="button"
                      onClick={async () => {
                        setShowUserMenu(false)
                        await signOut()
                        navigate('/login')
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-xs font-medium cursor-pointer text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </header>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleReset}
        title="Reset Demo Data to Initial Seeds?"
        message="This will restore all employee goals, reviews, cycles, and calibration ratings back to clean initial seed data."
        confirmText="Reset State"
        variant="warning"
        isLoading={isResetting}
      />
    </>
  )
}
