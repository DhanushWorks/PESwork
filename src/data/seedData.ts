import {
  SEED_USERS,
  SEED_CYCLES as FULL_SEED_CYCLES,
  SEED_GOALS as FULL_SEED_GOALS,
  SEED_SELF_REVIEWS as FULL_SEED_SELF_REVIEWS,
  SEED_MANAGER_REVIEWS as FULL_SEED_MANAGER_REVIEWS,
  SEED_CALIBRATIONS as FULL_SEED_CALIBRATIONS,
  SEED_RESULTS as FULL_SEED_RESULTS,
  SEED_FEEDBACK as FULL_SEED_FEEDBACK,
  SEED_DEVELOPMENT_PLANS as FULL_SEED_DEVELOPMENT_PLANS,
  SEED_AUDIT_LOGS as FULL_SEED_AUDIT_LOGS,
  SEED_NOTIFICATIONS as FULL_SEED_NOTIFICATIONS,
} from './seedDataFull'
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
} from '../types'

// Re-export user profiles so Admin (Eleanor), Manager (Marcus), Employee (Alex) always exist
export {
  SEED_USERS,
  SEED_USERS as FULL_SEED_USERS,
  FULL_SEED_CYCLES,
  FULL_SEED_GOALS,
  FULL_SEED_SELF_REVIEWS,
  FULL_SEED_MANAGER_REVIEWS,
  FULL_SEED_CALIBRATIONS,
  FULL_SEED_RESULTS,
  FULL_SEED_FEEDBACK,
  FULL_SEED_DEVELOPMENT_PLANS,
  FULL_SEED_AUDIT_LOGS,
  FULL_SEED_NOTIFICATIONS,
}

// Clean initial baseline: 0 review cycles and 0 operational records
// User starts workflow testing from scratch (Create Cycle -> Add Goals -> Submit -> Review -> Calibrate -> Results)
export const SEED_CYCLES: ReviewCycle[] = []
export const SEED_GOALS: Goal[] = []
export const SEED_SELF_REVIEWS: SelfReview[] = []
export const SEED_MANAGER_REVIEWS: ManagerReview[] = []
export const SEED_CALIBRATIONS: CalibrationRecord[] = []
export const SEED_RESULTS: EvaluationResult[] = []
export const SEED_FEEDBACK: FeedbackItem[] = []
export const SEED_DEVELOPMENT_PLANS: Record<string, DevelopmentPlan> = {}
export const SEED_AUDIT_LOGS: AuditLog[] = []
export const SEED_NOTIFICATIONS: Notification[] = []
