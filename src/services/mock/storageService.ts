import {
  AuditLog,
  CalibrationRecord,
  DevelopmentPlan,
  EvaluationResult,
  FeedbackItem,
  Goal,
  ManagerReview,
  Notification,
  ReviewCycle,
  SelfReview,
  User,
} from '../../types'
import { matchesCycle } from '../../lib/workflow'
import {
  SEED_AUDIT_LOGS,
  SEED_CALIBRATIONS,
  SEED_CYCLES,
  SEED_DEVELOPMENT_PLANS,
  SEED_FEEDBACK,
  SEED_GOALS,
  SEED_MANAGER_REVIEWS,
  SEED_NOTIFICATIONS,
  SEED_RESULTS,
  SEED_SELF_REVIEWS,
  SEED_USERS,
  FULL_SEED_AUDIT_LOGS,
  FULL_SEED_CALIBRATIONS,
  FULL_SEED_CYCLES,
  FULL_SEED_DEVELOPMENT_PLANS,
  FULL_SEED_FEEDBACK,
  FULL_SEED_GOALS,
  FULL_SEED_MANAGER_REVIEWS,
  FULL_SEED_NOTIFICATIONS,
  FULL_SEED_RESULTS,
  FULL_SEED_SELF_REVIEWS,
  FULL_SEED_USERS,
} from '../../data/seedData'

export type DemoState = {
  dataMode: 'clean' | 'full'
  users: User[]
  cycles: ReviewCycle[]
  activeCycleId: string
  currentUserId: string
  goals: Goal[]
  selfReviews: SelfReview[]
  managerReviews: ManagerReview[]
  calibrations: CalibrationRecord[]
  results: EvaluationResult[]
  feedback: FeedbackItem[]
  developmentPlans: Record<string, DevelopmentPlan>
  auditLogs: AuditLog[]
  notifications: Notification[]
}

const STORAGE_KEY = 'performiq_clean_workflow_v1'

const BASELINE_CYCLE: ReviewCycle = {
  id: 'bf21ac37-1801-47df-b9ba-b1d05a0d6832',
  name: 'FY 2026 H2 Performance Review',
  stage: 'closed',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  description: 'Evaluation cycle for FY 2026 H2 Performance Review',
  weights: { goals: 50, competencies: 30, values: 20 },
  deadlines: {
    goalsDue: '2026-10-31',
    selfReviewDue: '2026-11-15',
    managerReviewDue: '2026-12-05',
    calibrationDue: '2026-12-15',
    releaseDate: '2026-12-20',
  },
  participantIds: ['11111111-1111-1111-1111-111111111101', 'u-emp-1'],
}

export function getCleanState(): DemoState {
  return {
    dataMode: 'clean',
    users: [...SEED_USERS],
    cycles: [BASELINE_CYCLE],
    activeCycleId: BASELINE_CYCLE.id,
    currentUserId: 'u-emp-1', // Default to Alex Rivera (Employee)
    goals: [],
    selfReviews: [],
    managerReviews: [],
    calibrations: [],
    results: [],
    feedback: [],
    developmentPlans: { ...FULL_SEED_DEVELOPMENT_PLANS },
    auditLogs: [],
    notifications: [],
  }
}

export function getFullState(): DemoState {
  return {
    dataMode: 'full',
    users: [...FULL_SEED_USERS],
    cycles: [...FULL_SEED_CYCLES],
    activeCycleId: FULL_SEED_CYCLES[0]?.id || '',
    currentUserId: 'u-emp-1',
    goals: [...FULL_SEED_GOALS],
    selfReviews: [...FULL_SEED_SELF_REVIEWS],
    managerReviews: [...FULL_SEED_MANAGER_REVIEWS],
    calibrations: [...FULL_SEED_CALIBRATIONS],
    results: [...FULL_SEED_RESULTS],
    feedback: [...FULL_SEED_FEEDBACK],
    developmentPlans: { ...FULL_SEED_DEVELOPMENT_PLANS },
    auditLogs: [...FULL_SEED_AUDIT_LOGS],
    notifications: [...FULL_SEED_NOTIFICATIONS],
  }
}

class StorageService {
  private state: DemoState

  constructor() {
    this.state = this.load()
  }

  private load(): DemoState {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('performiq_pure_clean_v1')
        localStorage.removeItem('performiq_demo_state_v1')
        localStorage.removeItem('performiq_demo_state_v2')
        localStorage.removeItem('performiq_demo_state_v3')
        localStorage.removeItem('performiq_demo_state_v4')
        localStorage.removeItem('performiq_demo_state_v5')
        localStorage.removeItem('performiq_demo_state_v6')
        localStorage.removeItem('performiq_presentation_demo_v1')
        localStorage.removeItem('performiq_presentation_demo_v2')
        localStorage.removeItem('performiq_presentation_demo_v3')
        localStorage.removeItem('performiq_presentation_demo_v4')
        localStorage.removeItem('performiq_1on1_checkins_v1')
        localStorage.removeItem('performiq_1on1_checkins_v2')
        localStorage.removeItem('performiq_1on1_checkins_v3')
      }
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (stored) {
        const parsed = JSON.parse(stored) as DemoState

        // Sanitize users: purge any spurious custom employee accounts created for demo personas
        const rawUsers = parsed.users && parsed.users.length > 0 ? parsed.users : [...SEED_USERS]
        const sanitizedUsers: User[] = rawUsers
          .filter((u: User) => {
            // Remove spurious custom employee entries created for Eleanor Vance
            if (
              u.id.startsWith('u-custom-') &&
              (u.email?.toLowerCase().includes('eleanor') ||
                u.name?.toLowerCase().includes('eleanor') ||
                u.email?.toLowerCase() === 'admin@performiq.internal')
            ) {
              return false
            }
            return true
          })
          .map((u: User) => {
            // Guarantee Eleanor Vance is strictly Admin
            if (
              u.id === 'u-admin' ||
              u.id === '11111111-1111-1111-1111-111111111103' ||
              u.email?.toLowerCase() === 'eleanor.vance@performiq.internal' ||
              u.email?.toLowerCase() === 'admin@performiq.internal' ||
              u.name === 'Eleanor Vance'
            ) {
              return {
                ...u,
                id: u.id || 'u-admin',
                name: 'Eleanor Vance',
                email: 'eleanor.vance@performiq.internal',
                role: 'admin' as const,
              }
            }
            // Guarantee Marcus Chen is strictly Manager
            if (
              u.id === 'u-mgr-1' ||
              u.id === '11111111-1111-1111-1111-111111111102' ||
              u.email?.toLowerCase() === 'marcus.chen@performiq.internal' ||
              u.name === 'Marcus Chen'
            ) {
              return {
                ...u,
                role: 'manager' as const,
              }
            }
            return u
          })

        // Ensure baseline admin Eleanor Vance always exists
        if (!sanitizedUsers.some((u) => u.id === 'u-admin' || u.id === '11111111-1111-1111-1111-111111111103')) {
          const defaultAdmin = SEED_USERS.find((u) => u.id === 'u-admin')
          if (defaultAdmin) sanitizedUsers.unshift(defaultAdmin)
        }

        let currentUserId = parsed.currentUserId
        if (!sanitizedUsers.some((u) => u.id === currentUserId)) {
          currentUserId = sanitizedUsers[0]?.id || 'u-admin'
        }

        const state: DemoState = {
          ...getCleanState(),
          ...parsed,
          currentUserId,
          users: sanitizedUsers,
          cycles: Array.isArray(parsed.cycles) ? parsed.cycles : [...SEED_CYCLES],
          goals: Array.isArray(parsed.goals) ? parsed.goals : [...SEED_GOALS],
          selfReviews: Array.isArray(parsed.selfReviews) ? parsed.selfReviews : [...SEED_SELF_REVIEWS],
          managerReviews: Array.isArray(parsed.managerReviews) ? parsed.managerReviews : [...SEED_MANAGER_REVIEWS],
          calibrations: Array.isArray(parsed.calibrations) ? parsed.calibrations : [...SEED_CALIBRATIONS],
          results: Array.isArray(parsed.results) ? parsed.results : [...SEED_RESULTS],
          feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [...SEED_FEEDBACK],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [...SEED_AUDIT_LOGS],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [...SEED_NOTIFICATIONS],
          developmentPlans:
            parsed.developmentPlans &&
            Object.keys(parsed.developmentPlans).length > 0 &&
            Object.values(parsed.developmentPlans).some((p) => p.skills && p.skills.length > 0)
              ? parsed.developmentPlans
              : { ...FULL_SEED_DEVELOPMENT_PLANS },
        }

        // Preserve explicit cycle stage: never overwrite or revert user-set stages
        state.cycles = state.cycles.map((c) => {
          return c
        })

        this.persist(state)
        return state
      }
    } catch {
      // LocalStorage unavailable
    }

    const fresh = getCleanState()
    this.persist(fresh)
    return fresh
  }

  private persist(state: DemoState) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('PerformIQ localStorage persist failed', e)
    }
  }

  private notifyListeners() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('performiq_state_change', { detail: this.state }))
    }
  }

  public getState(): DemoState {
    return this.state
  }

  public updateState(updater: (state: DemoState) => Partial<DemoState>): DemoState {
    const changes = updater(this.state)
    this.state = { ...this.state, ...changes }
    this.persist(this.state)
    this.notifyListeners()
    return this.state
  }

  public subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => {}
    const handler = () => listener()
    window.addEventListener('performiq_state_change', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('performiq_state_change', handler)
      window.removeEventListener('storage', handler)
    }
  }

  /**
   * Reset to clean 3-user workflow state (0 records)
   */
  public resetCleanWorkflow(): DemoState {
    const clean = getCleanState()
    this.state = clean
    this.persist(clean)
    try {
      localStorage.removeItem('performiq_1on1_checkins_v2')
    } catch {}
    this.notifyListeners()
    return clean
  }

  /**
   * Revert to full demo dataset (13 users, all historical records)
   */
  public revertToFullDemoData(): DemoState {
    const full = getFullState()
    this.state = full
    this.persist(full)
    this.notifyListeners()
    return full
  }

  /**
   * Reset data according to target mode
   */
  public resetDemoData(mode?: 'clean' | 'full'): DemoState {
    if (mode === 'full') {
      return this.revertToFullDemoData()
    }
    return this.resetCleanWorkflow()
  }
}

export const storageService = new StorageService()
