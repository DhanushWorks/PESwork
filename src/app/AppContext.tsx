import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { isSupabaseConfigured, isSupabaseOnline } from '../lib/supabase'
import { Notification, ReviewCycle, Role, User } from '../types'
import { matchesUser, matchesCycle, isUserCycleParticipant } from '../lib/workflow'
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
  isAuthenticated: boolean
  setIsAuthenticated: (val: boolean) => void
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
    return (
      state.users.find((u) => u.id === state.currentUserId || matchesUser(u.id, state.currentUserId)) ||
      state.users[0]
    )
  })

  const [activeWorkspaceRole, setActiveWorkspaceRole] = useState<Role>(() => {
    const state = storageService.getState()
    const user =
      state.users.find((u) => u.id === state.currentUserId || matchesUser(u.id, state.currentUserId)) ||
      state.users[0]
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
  const [isAuthenticated, setIsAuthenticatedState] = useState<boolean>(() => {
    try {
      return (
        localStorage.getItem('performiq_authenticated') === 'true' ||
        sessionStorage.getItem('performiq_authenticated') === 'true'
      )
    } catch {
      return false
    }
  })

  const setIsAuthenticated = useCallback((val: boolean) => {
    setIsAuthenticatedState(val)
    try {
      if (val) {
        localStorage.setItem('performiq_authenticated', 'true')
        sessionStorage.setItem('performiq_authenticated', 'true')
      } else {
        localStorage.removeItem('performiq_authenticated')
        sessionStorage.removeItem('performiq_authenticated')
      }
    } catch (e) {
      console.warn('Storage set error:', e)
    }
  }, [])
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

  const loadSeqRef = useRef(0)
  const currentUserRef = useRef(currentUser)
  currentUserRef.current = currentUser

  const loadAll = useCallback(async () => {
    try {
      const seq = ++loadSeqRef.current

      const users = await peopleService.list()
      const cycles = await cycleService.list()
      const currentActiveCycle = (await cycleService.getActiveCycle()) || cycles[0] || EMPTY_CYCLE
      const state = storageService.getState()

      // 1. Inspect live Supabase session ONLY if Supabase is online
      let session = null
      let authUser = null
      if (isSupabaseConfigured && isSupabaseOnline()) {
        try {
          const res = await supabaseAuthService.getSession()
          session = res.session
          authUser = res.user
        } catch {}
      }

      // Invalidate stale async load if a switchUser or newer load occurred
      if (seq !== loadSeqRef.current) {
        return
      }

      const activeUserId = state.currentUserId
      let foundUser: User | undefined

      if (session && authUser) {
        setIsLiveAuth(true)
        setIsAuthenticated(true)
        foundUser = authUser
        if (!users.some((u) => u.id === authUser.id)) {
          users.unshift(authUser)
        }
      } else {
        setIsLiveAuth(false)
        // 1. First check if activeUserId matches any fetched user
        foundUser = users.find((u) => u.id === activeUserId || matchesUser(u.id, activeUserId))
        // 2. If not found in fetched users, check local storageState users (includes custom created users!)
        if (!foundUser) {
          foundUser = state.users.find((u) => u.id === activeUserId || matchesUser(u.id, activeUserId))
        }
        // 3. If still not found, preserve the currently active user if valid
        if (!foundUser && currentUserRef.current && currentUserRef.current.id) {
          foundUser = currentUserRef.current
        }
        // 4. As absolute last resort only, fallback to the first user
        if (!foundUser) {
          foundUser = users[0] || state.users[0]
        }
      }

      // Determine the best activeCycle for this user: prioritize enrolled open cycles
      let cycleToSet = currentActiveCycle
      if (foundUser?.id && cycles && cycles.length > 0) {
        const userEnrolledOpenCycle = cycles.find(
          (c) => c.stage !== 'closed' && isUserCycleParticipant(c, foundUser?.id)
        )
        if (userEnrolledOpenCycle) {
          cycleToSet = userEnrolledOpenCycle
        } else if (cycleToSet.stage === 'closed') {
          const anyOpenCycle = cycles.find((c) => c.stage !== 'closed')
          if (anyOpenCycle) {
            cycleToSet = anyOpenCycle
          }
        }
      }

      setAllUsers(users)
      setAllCycles(cycles)
      setActiveCycle(cycleToSet)
      setCurrentUser((prev) => {
        if (
          prev &&
          prev.id === foundUser!.id &&
          prev.role === foundUser!.role &&
          prev.avatar === foundUser!.avatar &&
          prev.name === foundUser!.name &&
          prev.designation === foundUser!.designation &&
          prev.department === foundUser!.department
        ) {
          return prev
        }
        return foundUser!
      })
      setActiveWorkspaceRole((prev) => {
        if (prev === foundUser!.role) return prev
        return foundUser!.role
      })
      setDataMode(state.dataMode || 'clean')

      if (foundUser?.id) {
        const notifs = await notificationService.list(foundUser.id)
        if (seq === loadSeqRef.current) {
          setNotifications(notifs)
        }
      }
    } catch (err) {
      console.warn('Notice in AppContext.loadAll:', err)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Listen to Supabase Auth state transitions in real time (only when Supabase is online)
  useEffect(() => {
    if (!isSupabaseOnline()) return

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
      const state = storageService.getState()
      if (state.cycles && state.cycles.length > 0) {
        setAllCycles(state.cycles)
        const activeUserId = currentUserRef.current?.id
        const userEnrolled = state.cycles.find(
          (c) => c.stage !== 'closed' && isUserCycleParticipant(c, activeUserId)
        )
        const targetId = userEnrolled ? userEnrolled.id : state.activeCycleId
        const current =
          state.cycles.find((c) => c.id === targetId || matchesCycle(c.id, targetId)) ||
          state.cycles.find((c) => c.stage !== 'closed') ||
          state.cycles[0]
        if (current) {
          setActiveCycle((prev) => {
            if (prev.id === current.id && prev.stage === current.stage && prev.name === current.name) return prev
            return current
          })
        }
      }
      if (state.users && state.users.length > 0) {
        setAllUsers(state.users)
        const activeId = currentUserRef.current?.id
        const matched = state.users.find((u) => u.id === activeId || matchesUser(u.id, activeId))
        if (matched) {
          setCurrentUser((prev) => {
            if (
              prev &&
              prev.id === matched.id &&
              prev.role === matched.role &&
              prev.avatar === matched.avatar &&
              prev.name === matched.name &&
              prev.designation === matched.designation &&
              prev.department === matched.department
            ) {
              return prev
            }
            return matched
          })
        }
      }
    })

    // 2. Supabase Realtime channel subscription if configured
    const unsubSupabase =
      typeof (notificationService as any).subscribeToUserNotifications === 'function'
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
      // Invalidate any background loadAll
      loadSeqRef.current++

      const targetUser = await peopleService.getById(userId)
      if (!targetUser) return

      storageService.updateState(() => ({ currentUserId: userId }))
      setCurrentUser(targetUser)
      setActiveWorkspaceRole(targetUser.role)

      try {
        const cycles = await cycleService.list()
        const enrolledOpen = cycles.find((c) => c.stage !== 'closed' && isUserCycleParticipant(c, userId))
        if (enrolledOpen) {
          await cycleService.setActiveCycle(enrolledOpen.id)
          setActiveCycle(enrolledOpen)
        } else {
          const anyOpen = cycles.find((c) => c.stage !== 'closed')
          if (anyOpen && activeCycle.stage === 'closed') {
            await cycleService.setActiveCycle(anyOpen.id)
            setActiveCycle(anyOpen)
          }
        }
      } catch (e) {
        console.warn('Switch user active cycle alignment notice:', e)
      }

      const notifs = await notificationService.list(userId)
      setNotifications(notifs)
    },
    [activeCycle.stage]
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
    setIsAuthenticated(false)
    const state = storageService.getState()
    const fallback = state.users.find((u) => u.id === state.currentUserId) || state.users[0]
    if (fallback) {
      setCurrentUser(fallback)
      setActiveWorkspaceRole(fallback.role)
    }
  }, [setIsAuthenticated])

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
      isAuthenticated,
      setIsAuthenticated,
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
      isAuthenticated,
      setIsAuthenticated,
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

export function useOptionalApp() {
  return useContext(AppContext)
}
