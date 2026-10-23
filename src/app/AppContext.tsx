import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { Notification, ReviewCycle, Role, User } from '../types'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  cycleService,
  notificationService,
  peopleService,
  storageService,
  supabaseAuthService,
} from '../services'

type AppContextType = {
  currentUser: User
  currentRole: Role
  activeWorkspaceRole: Role
  activeCycle: ReviewCycle
  allUsers: User[]
  allCycles: ReviewCycle[]
  notifications: Notification[]
  unreadNotificationsCount: number
  theme: 'light' | 'dark'
  toggleTheme: () => void
  switchUser: (userId: string) => Promise<void>
  switchWorkspaceRole: (role: Role) => void
  switchActiveCycle: (cycleId: string) => Promise<void>
  isLiveAuth: boolean
  signOut: () => Promise<void>
  refreshData: () => Promise<void>
  dataMode: 'clean' | 'full'
  resetDemoData: (mode?: 'clean' | 'full') => Promise<void>
  revertToFullDemoData: () => Promise<void>
  resetCleanWorkflow: () => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
}

export const EMPTY_CYCLE: ReviewCycle = {
  id: '',
  name: 'No Active Cycle',
  stage: 'draft',
  startDate: '',
  endDate: '',
  description: 'No appraisal cycle created yet.',
  weights: { goals: 60, competencies: 30, values: 10 },
  deadlines: {
    goalsDue: '',
    selfReviewDue: '',
    managerReviewDue: '',
    calibrationDue: '',
    releaseDate: '',
  },
  participantIds: [],
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const state = storageService.getState()
    return state.users.find((u) => u.id === state.currentUserId) || state.users[0]
  })

  const [activeWorkspaceRole, setActiveWorkspaceRole] = useState<Role>(() => {
    const state = storageService.getState()
    const user = state.users.find((u) => u.id === state.currentUserId) || state.users[0]
    return user.role
  })

  const [activeCycle, setActiveCycle] = useState<ReviewCycle>(() => {
    const state = storageService.getState()
    return state.cycles.find((c) => c.id === state.activeCycleId) || state.cycles[0] || EMPTY_CYCLE
  })

  const [allUsers, setAllUsers] = useState<User[]>([])
  const [allCycles, setAllCycles] = useState<ReviewCycle[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLiveAuth, setIsLiveAuth] = useState(false)
  const [dataMode, setDataMode] = useState<'clean' | 'full'>(() => storageService.getState().dataMode || 'clean')
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('performiq_theme')
      if (saved === 'dark' || saved === 'light') return saved
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })

  // Synchronize 'dark' class on <html> document element with zero-transition paint thrashing
  const applyThemeWithNoTransition = (newTheme: 'light' | 'dark') => {
    // 1. Temporarily disable all CSS transitions across the entire DOM during the flip
    const css = document.createElement('style')
    css.appendChild(
      document.createTextNode(
        `*, *::before, *::after {
          -webkit-transition: none !important;
          -moz-transition: none !important;
          -o-transition: none !important;
          -ms-transition: none !important;
          transition: none !important;
        }`
      )
    )
    document.head.appendChild(css)

    // 2. Synchronously toggle 'dark' on <html>
    const root = document.documentElement
    if (newTheme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }

    try {
      localStorage.setItem('performiq_theme', newTheme)
    } catch (e) {
      console.warn('Failed to save theme in localStorage', e)
    }

    // 3. Force reflow so the style is applied instantaneously in a single paint
    window.getComputedStyle(css).opacity

    // 4. Safely clean up in next frame so interactive button/hover transitions resume
    requestAnimationFrame(() => {
      if (document.head.contains(css)) {
        document.head.removeChild(css)
      }
    })
  }

  // Initial sync on mount
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      applyThemeWithNoTransition(next)
      return next
    })
  }, [])

  const loadAll = useCallback(async () => {
    const users = await peopleService.list()
    const cycles = await cycleService.list()
    const currentActiveCycle = (await cycleService.getActiveCycle()) || cycles[0] || EMPTY_CYCLE
    const state = storageService.getState()

    // 1. Inspect live Supabase session (only if backend is configured)
    let foundUser: User
    if (isSupabaseConfigured) {
      const { session, user: authUser } = await supabaseAuthService.getSession()
      if (session && authUser) {
        setIsLiveAuth(true)
        foundUser = authUser
        if (!users.some((u) => u.id === authUser.id)) {
          users.unshift(authUser)
        }
      } else {
        setIsLiveAuth(false)
        foundUser = users.find((u) => u.id === state.currentUserId) || users[0]
      }
    } else {
      setIsLiveAuth(false)
      foundUser = users.find((u) => u.id === state.currentUserId) || users[0]
    }

    setAllUsers(users)
    setAllCycles(cycles)
    setActiveCycle(currentActiveCycle)
    setCurrentUser(foundUser)
    setActiveWorkspaceRole(foundUser.role)
    setDataMode(state.dataMode || 'clean')

    const notifs = await notificationService.list(foundUser.id)
    setNotifications(notifs)
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Listen to Supabase Auth state transitions in real time
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const subscription = supabaseAuthService.onAuthStateChange(async (session, authUser) => {
      if (session && authUser) {
        setIsLiveAuth(true)
        setCurrentUser(authUser)
        setActiveWorkspaceRole(authUser.role)
        setAllUsers((prev) => {
          if (!prev.some((u) => u.id === authUser.id)) {
            return [authUser, ...prev]
          }
          return prev.map((u) => (u.id === authUser.id ? authUser : u))
        })
      } else {
        setIsLiveAuth(false)
      }
    })

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Real-time synchronization for In-App Notifications
  useEffect(() => {
    if (!currentUser?.id) return

    let isMounted = true
    const reloadNotifs = async () => {
      try {
        const notifs = await notificationService.list(currentUser.id)
        if (isMounted) {
          setNotifications(notifs)
        }
      } catch (err) {
        console.warn('Notice reloading notifications:', err)
      }
    }

    // 1. Storage subscription (instant updates across tabs and role actions)
    const unsubStorage = storageService.subscribe(() => {
      reloadNotifs()
    })

    // 2. Supabase Realtime channel subscription if configured
    const unsubSupabase =
      isSupabaseConfigured && typeof (notificationService as any).subscribeToUserNotifications === 'function'
        ? (notificationService as any).subscribeToUserNotifications(currentUser.id, reloadNotifs)
        : () => {}

    return () => {
      isMounted = false
      unsubStorage()
      unsubSupabase()
    }
  }, [currentUser?.id])

  const switchUser = useCallback(
    async (userId: string) => {
      const targetUser = await peopleService.getById(userId)
      if (!targetUser) return

      storageService.updateState(() => ({ currentUserId: userId }))
      setCurrentUser(targetUser)
      setActiveWorkspaceRole(targetUser.role)

      const notifs = await notificationService.list(userId)
      setNotifications(notifs)
    },
    []
  )

  const switchWorkspaceRole = useCallback((role: Role) => {
    setActiveWorkspaceRole(role)
  }, [])

  const switchActiveCycle = useCallback(async (cycleId: string) => {
    const cycle = await cycleService.setActiveCycle(cycleId)
    setActiveCycle(cycle)
  }, [])

  const refreshData = useCallback(async () => {
    await loadAll()
  }, [loadAll])

  const resetCleanWorkflow = useCallback(async () => {
    storageService.resetCleanWorkflow()
    setDataMode('clean')
    await loadAll()
  }, [loadAll])

  const revertToFullDemoData = useCallback(async () => {
    storageService.revertToFullDemoData()
    setDataMode('full')
    await loadAll()
  }, [loadAll])

  const resetDemoData = useCallback(async (mode?: 'clean' | 'full') => {
    if (mode === 'full') {
      await revertToFullDemoData()
    } else {
      await resetCleanWorkflow()
    }
  }, [revertToFullDemoData, resetCleanWorkflow])

  const markNotificationRead = useCallback(async (id: string) => {
    await notificationService.markRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const markAllNotificationsRead = useCallback(async () => {
    await notificationService.markAllRead(currentUser.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [currentUser.id])

  const signOut = useCallback(async () => {
    await supabaseAuthService.signOut()
    setIsLiveAuth(false)
    const state = storageService.getState()
    const fallback = state.users.find((u) => u.id === state.currentUserId) || state.users[0]
    if (fallback) {
      setCurrentUser(fallback)
      setActiveWorkspaceRole(fallback.role)
    }
  }, [])

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length

  const contextValue = useMemo(
    () => ({
      currentUser,
      currentRole: currentUser.role,
      activeWorkspaceRole,
      activeCycle,
      allUsers,
      allCycles,
      notifications,
      unreadNotificationsCount,
      theme,
      toggleTheme,
      switchUser,
      switchWorkspaceRole,
      switchActiveCycle,
      isLiveAuth,
      signOut,
      refreshData,
      dataMode,
      resetDemoData,
      revertToFullDemoData,
      resetCleanWorkflow,
      markNotificationRead,
      markAllNotificationsRead,
    }),
    [
      currentUser,
      activeWorkspaceRole,
      activeCycle,
      allUsers,
      allCycles,
      notifications,
      unreadNotificationsCount,
      theme,
      toggleTheme,
      switchUser,
      switchWorkspaceRole,
      switchActiveCycle,
      isLiveAuth,
      signOut,
      refreshData,
      resetDemoData,
      markNotificationRead,
      markAllNotificationsRead,
    ]
  )

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
