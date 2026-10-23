import React, { useState } from 'react'
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import {
  BarChart3,
  Calendar,
  CheckSquare,
  History,
  LayoutDashboard,
  MessageSquareHeart,
  MessagesSquare,
  PieChart,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  PanelLeft,
  Compass,
  FolderArchive,
  ClipboardList,
} from 'lucide-react'

import { STAGE_ORDER } from '../../lib/formatters'

type AppSidebarProps = {
  isOpen: boolean
  onClose: () => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
}) => {
  const { currentUser, activeWorkspaceRole, switchWorkspaceRole, activeCycle } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  // Navigation labels with 'Dashboard' (KPI and People & Profile removed as requested)
  const employeeNav = [
    { label: 'Dashboard', path: '/employee', icon: LayoutDashboard },
    { label: 'Progress Tracking', path: '/employee/goals', icon: Target },
    { label: 'Forms & Review', path: '/employee/self-review', icon: ClipboardList },
    { label: 'Peer Feedback', path: '/employee/feedback', icon: MessageSquareHeart },
    { label: 'Portfolio & Results', path: '/employee/results', icon: FolderArchive },
    { label: 'Talent Map', path: '/employee/development', icon: TrendingUp },
  ]

  const managerNav = [
    { label: 'Dashboard', path: '/manager', icon: LayoutDashboard },
    { label: 'Goal Approvals', path: '/manager/approvals', icon: CheckSquare },
    { label: 'Chart & Analytics', path: '/manager/analytics', icon: BarChart3 },
    { label: '1-on-1 Discussions', path: '/manager/one-on-ones', icon: MessagesSquare },
  ]

  const adminNav = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'People Directory', path: '/admin/users', icon: Users },
    { label: 'Review Cycles', path: '/admin/cycles', icon: RefreshCw },
    { label: 'Calibration Hub', path: '/admin/calibration', icon: Sliders },
    { label: 'Chart & Reports', path: '/admin/reports', icon: PieChart },
    { label: 'Audit Trail', path: '/admin/audit', icon: History },
  ]

  const currentNav =
    currentUser.role === 'admin'
      ? adminNav
      : currentUser.role === 'manager'
      ? managerNav
      : employeeNav

  // Exact matching for root role dashboards, startsWith for subroutes
  const activeIndex = currentNav.findIndex((item) => {
    if (item.path === '/employee' || item.path === '/manager' || item.path === '/admin') {
      return location.pathname === item.path
    }
    return location.pathname.startsWith(item.path)
  })

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: White in White Mode and Executive Deep Obsidian in Dark Mode */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md text-slate-800 dark:text-zinc-200 flex flex-col border-r border-[#d6deea] dark:border-white/[0.08] transition-[width,transform] duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-12 lg:overflow-visible' : 'lg:w-60'} w-64 sm:w-72 shadow-2xl`}
      >
        {/* Top Header Bar with Company Name & Logo (Left) and Close Button (Mobile) / Collapse Button (Desktop) */}
        <div
          className={`h-12 flex items-center border-b border-[#d6deea] dark:border-white/[0.08] shrink-0 relative transition-all duration-200 ${
            isCollapsed ? 'justify-between px-3.5 lg:justify-center lg:px-2' : 'justify-between px-3.5'
          }`}
        >
          {/* Company Name and Logo on Left - Always visible on mobile drawer; on desktop visible when expanded */}
          <Link
            to={`/${currentUser.role}`}
            className={`items-center gap-2 font-semibold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white hover:opacity-85 transition-opacity select-none truncate ${
              isCollapsed ? 'flex lg:hidden' : 'flex'
            }`}
            title="PerformIQ Dashboard"
          >
            <img
              src="/logo.png"
              alt="PerformIQ Logo"
              className="w-5 h-5 object-contain dark:hidden shrink-0"
            />
            <img
              src="/logo-white.png"
              alt="PerformIQ Logo"
              className="w-5 h-5 object-contain hidden dark:block shrink-0"
            />
            <span className="truncate">PerformIQ</span>
          </Link>

          {/* Desktop Collapse Button - only rendered on desktop (lg:flex) */}
          <button
            type="button"
            onClick={onToggleCollapse}
            onMouseEnter={() => isCollapsed && setActiveTooltip('Toggle Sidebar')}
            onMouseLeave={() => isCollapsed && setActiveTooltip(null)}
            onFocus={() => isCollapsed && setActiveTooltip('Toggle Sidebar')}
            onBlur={() => isCollapsed && setActiveTooltip(null)}
            className="hidden lg:flex w-8 h-8 items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.08] active:scale-95 rounded-lg transition-all duration-200 cursor-pointer shrink-0 group"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle navigation sidebar"
          >
            <PanelLeft className="w-4.5 h-4.5 text-slate-500 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-white transition-colors" />
            {isCollapsed && (
              <div
                className={`hidden lg:block absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white dark:bg-[#18181b] dark:text-zinc-100 text-[11px] font-medium rounded-md shadow-2xl border border-slate-800 dark:border-zinc-700/80 whitespace-nowrap pointer-events-none transition-all duration-150 z-50 ${
                  activeTooltip === 'Toggle Sidebar'
                    ? 'opacity-100 translate-x-1'
                    : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-focus-visible:opacity-100 group-focus-visible:translate-x-1'
                }`}
              >
                Expand sidebar
              </div>
            )}
          </button>

          {/* Mobile Close Button - clean, even, far right on mobile drawer */}
          <button
            type="button"
            onClick={onClose}
            className="flex lg:hidden w-8 h-8 items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white rounded-lg dark:hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
            aria-label="Close sidebar"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Navigation Items - Consistent px-2 container so icons never jump horizontally */}
        <nav
          className={`flex-1 pt-2 pb-1 px-2 overflow-y-auto overflow-x-hidden ${
            isCollapsed ? 'lg:overflow-visible' : 'lg:overflow-y-auto'
          }`}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <div className="relative flex flex-col gap-1">
            {/* Smooth Gliding Active Pill with Momentum Spring physics */}
            {activeIndex !== -1 && (
              <div
                className="absolute left-0 right-0 h-9 rounded-xl pointer-events-none transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1.15)] z-0"
                style={{
                  transform: `translateY(${activeIndex * 40}px)`,
                }}
              >
                <div className="w-full h-full rounded-xl bg-slate-900/[0.06] border border-slate-900/[0.08] dark:bg-white/[0.09] dark:border-white/[0.12] shadow-xs dark:shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xs relative overflow-hidden">
                  {/* Subtle ambient light gradient */}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-900/[0.03] dark:from-white/[0.04] via-transparent to-transparent pointer-events-none" />
                </div>
              </div>
            )}

            {/* Smooth Gliding Hover Pill */}
            {hoveredIndex !== null && hoveredIndex !== activeIndex && (
              <div
                className="absolute left-0 right-0 h-9 rounded-xl pointer-events-none transition-transform duration-200 ease-out z-0"
                style={{
                  transform: `translateY(${hoveredIndex * 40}px)`,
                }}
              >
                <div className="w-full h-full rounded-xl bg-slate-900/[0.03] border border-slate-900/[0.04] dark:bg-white/[0.04] dark:border-white/[0.04] transition-opacity duration-150" />
              </div>
            )}

            {currentNav.map((item, idx) => {
              const Icon = item.icon
              const isCurrentActive = activeIndex === idx

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/employee' || item.path === '/manager' || item.path === '/admin'}
                  onClick={onClose}
                  onMouseEnter={() => {
                    setHoveredIndex(idx)
                    if (isCollapsed) setActiveTooltip(item.label)
                  }}
                  onMouseLeave={() => {
                    if (isCollapsed) setActiveTooltip(null)
                  }}
                  onFocus={() => {
                    setHoveredIndex(idx)
                    if (isCollapsed) setActiveTooltip(item.label)
                  }}
                  onBlur={() => {
                    setHoveredIndex(null)
                    if (isCollapsed) setActiveTooltip(null)
                  }}
                  onTouchStart={() => isCollapsed && setActiveTooltip(item.label)}
                  className={`relative z-10 flex items-center h-9 px-0 rounded-xl text-xs font-medium cursor-pointer transition-all duration-200 ease-out select-none group active:scale-[0.98] ${
                    isCollapsed ? 'lg:overflow-visible overflow-hidden' : 'overflow-hidden'
                  } ${
                    isCurrentActive
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {/* Fixed 32x32px Icon container - Anchored in place, zero horizontal jumping */}
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <Icon
                      className={`w-4 h-4 transition-colors duration-150 ${
                        isCurrentActive
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-100'
                      }`}
                    />
                  </div>

                  {/* Smooth expanding/collapsing label - Always fully visible on mobile drawer */}
                  <span
                    className={`whitespace-nowrap transition-all duration-200 ease-in-out font-medium overflow-hidden ${
                      isCollapsed
                        ? 'opacity-100 max-w-full translate-x-0 ml-2.5 lg:opacity-0 lg:max-w-0 lg:-translate-x-2 lg:pointer-events-none'
                        : 'opacity-100 max-w-full translate-x-0 ml-2.5'
                    } ${
                      isCurrentActive
                        ? 'text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100 group-hover:translate-x-0.5'
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Floating smooth tooltip pill when collapsed - desktop only */}
                  {isCollapsed && (
                    <div
                      className={`hidden lg:block absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white dark:bg-[#18181b] dark:text-zinc-100 text-[11px] font-medium rounded-md shadow-2xl border border-slate-800 dark:border-zinc-700/80 whitespace-nowrap pointer-events-none transition-all duration-150 z-50 ${
                        activeTooltip === item.label
                          ? 'opacity-100 translate-x-1'
                          : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-focus-visible:opacity-100 group-focus-visible:translate-x-1'
                      }`}
                    >
                      {item.label}
                    </div>
                  )}
                </NavLink>
              )
            })}
          </div>
        </nav>

        {/* Bottom Left Settings NavLink */}
        <div className="border-t border-slate-200/90 dark:border-white/[0.08] p-2">
          <NavLink
            to="/settings"
            onClick={onClose}
            onMouseEnter={() => isCollapsed && setActiveTooltip('Settings')}
            onMouseLeave={() => isCollapsed && setActiveTooltip(null)}
            onFocus={() => isCollapsed && setActiveTooltip('Settings')}
            onBlur={() => isCollapsed && setActiveTooltip(null)}
            onTouchStart={() => isCollapsed && setActiveTooltip('Settings')}
            className={({ isActive }) =>
              `relative w-full flex items-center h-9 px-0 rounded-xl text-xs font-medium cursor-pointer transition-all duration-200 ease-out active:scale-[0.98] group select-none ${
                isCollapsed ? 'lg:overflow-visible overflow-hidden' : 'overflow-hidden'
              } ${
                isActive
                  ? 'bg-slate-900/[0.06] text-slate-900 dark:bg-white/[0.08] dark:text-white font-semibold border border-slate-900/[0.08] dark:border-white/[0.1] shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/[0.05] border border-transparent hover:border-slate-200/80 dark:hover:border-white/[0.06]'
              }`
            }
            aria-label="Settings"
          >
            {({ isActive }) => (
              <>
                <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                  <Settings
                    className={`w-4 h-4 transition-colors duration-150 ${
                      isActive
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 group-hover:text-slate-900 dark:text-zinc-400 dark:group-hover:text-zinc-100'
                    }`}
                  />
                </div>
                <span
                  className={`whitespace-nowrap transition-all duration-200 ease-in-out font-medium overflow-hidden ${
                    isCollapsed
                      ? 'opacity-100 max-w-full translate-x-0 ml-2.5 lg:opacity-0 lg:max-w-0 lg:-translate-x-2 lg:pointer-events-none'
                      : 'opacity-100 max-w-full translate-x-0 ml-2.5'
                  } ${
                    isActive
                      ? 'text-slate-900 dark:text-white font-semibold'
                      : 'text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100 group-hover:translate-x-0.5'
                  }`}
                >
                  Settings
                </span>

                {/* Floating tooltip when collapsed - desktop only */}
                {isCollapsed && (
                  <div
                    className={`hidden lg:block absolute left-full ml-3 px-2.5 py-1 bg-slate-900 text-white dark:bg-[#18181b] dark:text-zinc-100 text-[11px] font-medium rounded-md shadow-2xl border border-slate-800 dark:border-zinc-700/80 whitespace-nowrap pointer-events-none transition-all duration-150 z-50 ${
                      activeTooltip === 'Settings'
                        ? 'opacity-100 translate-x-1'
                        : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-focus-visible:opacity-100 group-focus-visible:translate-x-1'
                    }`}
                  >
                    Settings
                  </div>
                )}
              </>
            )}
          </NavLink>
        </div>
      </aside>
    </>
  )
}
