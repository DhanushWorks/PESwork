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

const STORAGE_KEY = 'performiq_presentation_demo_v2'

export function getCleanState(): DemoState {
  return {
    dataMode: 'clean',
    users: [...SEED_USERS],
    cycles: [...SEED_CYCLES],
    activeCycleId: SEED_CYCLES[0]?.id || 'cycle-2026-h1',
    currentUserId: 'u-emp-1', // Default to Alex Rivera (Employee)
    goals: [...SEED_GOALS],
    selfReviews: [...SEED_SELF_REVIEWS],
    managerReviews: [...SEED_MANAGER_REVIEWS],
    calibrations: [...SEED_CALIBRATIONS],
    results: [...SEED_RESULTS],
    feedback: [...SEED_FEEDBACK],
    developmentPlans: { ...SEED_DEVELOPMENT_PLANS },
    auditLogs: [...SEED_AUDIT_LOGS],
    notifications: [...SEED_NOTIFICATIONS],
  }
}

export function getFullState(): DemoState {
  return getCleanState()
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
        localStorage.removeItem('performiq_1on1_checkins_v1')
        localStorage.removeItem('performiq_1on1_checkins_v2')
      }
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
      if (stored) {
        const parsed = JSON.parse(stored) as DemoState
        return {
          ...getCleanState(),
          ...parsed,
          users: (parsed.users && parsed.users.length > 0) ? parsed.users : [...SEED_USERS],
          cycles: Array.isArray(parsed.cycles) ? parsed.cycles : [...SEED_CYCLES],
          goals: Array.isArray(parsed.goals) ? parsed.goals : [...SEED_GOALS],
          selfReviews: Array.isArray(parsed.selfReviews) ? parsed.selfReviews : [...SEED_SELF_REVIEWS],
          managerReviews: Array.isArray(parsed.managerReviews) ? parsed.managerReviews : [...SEED_MANAGER_REVIEWS],
          calibrations: Array.isArray(parsed.calibrations) ? parsed.calibrations : [...SEED_CALIBRATIONS],
          results: Array.isArray(parsed.results) ? parsed.results : [...SEED_RESULTS],
          feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [...SEED_FEEDBACK],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [...SEED_AUDIT_LOGS],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [...SEED_NOTIFICATIONS],
        }
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
