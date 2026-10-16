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
} from '../../data/seedData'

export type DemoState = {
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

const STORAGE_KEY = 'performiq_demo_state_v4'

function getInitialState(): DemoState {
  return {
    users: [...SEED_USERS],
    cycles: [...SEED_CYCLES],
    activeCycleId: 'cycle-2026-h1',
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

class StorageService {
  private state: DemoState

  constructor() {
    this.state = this.load()
  }

  private load(): DemoState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as DemoState
        // Safety check to ensure parsed data has expected arrays
        if (parsed.users && parsed.cycles && parsed.goals) {
          return {
            ...getInitialState(),
            ...parsed,
            developmentPlans: {
              ...SEED_DEVELOPMENT_PLANS,
              ...(parsed.developmentPlans || {}),
            },
          }
        }
      }
    } catch {
      // LocalStorage unavailable or corrupt
    }
    const fresh = getInitialState()
    this.persist(fresh)
    return fresh
  }

  private persist(state: DemoState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch (e) {
      console.warn('PerformIQ localStorage persist failed', e)
    }
  }

  public getState(): DemoState {
    return this.state
  }

  public updateState(updater: (state: DemoState) => Partial<DemoState>): DemoState {
    const changes = updater(this.state)
    this.state = { ...this.state, ...changes }
    this.persist(this.state)
    return this.state
  }

  public resetDemoData(): DemoState {
    const fresh = getInitialState()
    this.state = fresh
    this.persist(fresh)
    return fresh
  }
}

export const storageService = new StorageService()

