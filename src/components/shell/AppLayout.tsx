import React, { useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../app/AppContext'
import { DemoBanner } from './DemoBanner'
import { AppHeader } from './AppHeader'
import { AppSidebar } from './AppSidebar'

export const AppLayout: React.FC = () => {
  const { currentUser } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('performiq_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  // Strict RBAC synchronization: automatically redirect to the user's role workspace if navigating outside their authorized domain
  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/admin') && currentUser.role !== 'admin') {
      navigate(`/${currentUser.role}`, { replace: true })
    } else if (path.startsWith('/manager') && currentUser.role !== 'manager') {
      navigate(`/${currentUser.role}`, { replace: true })
    } else if (path.startsWith('/employee') && currentUser.role !== 'employee') {
      navigate(`/${currentUser.role}`, { replace: true })
    }
  }, [currentUser.role, location.pathname, navigate])

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('performiq_sidebar_collapsed', String(next))
      } catch (e) {
        console.warn('LocalStorage save failed', e)
      }
      return next
    })
  }

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapse()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-[#000000] flex flex-col font-sans text-slate-900 dark:text-[#EEF1F7] relative selection:bg-indigo-100 dark:selection:bg-indigo-950/70 selection:text-indigo-900 dark:selection:text-indigo-300 overflow-x-hidden">
      {/* Crisp subtle micro-texture for pure black UI - zero blue glow */}
      <div className="hidden dark:block pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,#000_0%,transparent_85%)]" />
      </div>

      {/* Persistent preview disclaimer banner */}
      <div className="relative z-40">
        <DemoBanner />
      </div>

      <div className="flex-1 flex relative z-10">
        {/* Collapsible Sidebar / Mobile Drawer */}
        <AppSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        {/* Main Content Area: adjusts left padding based on collapsed state in lockstep */}
        <div
          className={`flex-1 flex flex-col min-w-0 pt-12 transition-[padding] duration-300 ease-in-out ${
            isCollapsed ? 'lg:pl-12' : 'lg:pl-60'
          }`}
        >
          <AppHeader
            onToggleSidebar={() => setSidebarOpen(true)}
            isCollapsed={isCollapsed}
            onToggleCollapse={toggleCollapse}
          />

          <main className="flex-1 px-4 sm:px-6 lg:px-8 pt-4 pb-12 w-full">
            <div key={location.pathname} className="page-transition-enter w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
