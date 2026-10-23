export type Role = 'employee' | 'manager' | 'admin'

export type CycleStage =
  | 'draft'
  | 'goals_open'
  | 'tracking'
  | 'self_review'
  | 'manager_review'
  | 'calibration'
  | 'released'
  | 'closed'

export type GoalStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'returned'
  | 'completed'
  | 'cancelled'

export type ProgressLog = {
  id: string
  date: string
  percentage: number
  note: string
  evidenceFileName?: string
  evidenceUrl?: string
  evidenceFileSize?: string
}

export type Goal = {
  id: string
  userId: string
  cycleId: string
  title: string
  description: string
  metric: string
  target: number
  current: number
  unit: string
  weight: number // percentage e.g. 25
  progress: number // percentage 0 - 100
  dueDate: string
  status: GoalStatus
  returnReason?: string
  evidenceFileName?: string
  evidenceUrl?: string
  evidenceFileSize?: string
  progressHistory: ProgressLog[]
  createdAt: string
  updatedAt: string
}

export type User = {
  id: string
  name: string
  email: string
  role: Role
  department: string
  designation: string
  managerId?: string
  avatar?: string
  active: boolean
  employeeCode: string
  joinedDate: string
}

export type CycleWeights = {
  goals: number // e.g. 50
  competencies: number // e.g. 30
  values: number // e.g. 20
}

export type ReviewCycle = {
  id: string
  name: string
  stage: CycleStage
  startDate: string
  endDate: string
  description: string
  weights: CycleWeights
  deadlines: {
    goalsDue: string
    selfReviewDue: string
    managerReviewDue: string
    calibrationDue: string
    releaseDate: string
  }
  participantIds?: string[]
}

export type RatingCategory = {
  id: string
  name: string
  description: string
}

export type SelfReview = {
  id: string
  userId: string
  cycleId: string
  status: 'draft' | 'submitted'
  submittedAt?: string
  lastSavedAt: string
  overallRating: number // 1.0 - 5.0
  overallReflection: string
  achievements: string
  challenges: string
  developmentNeeds: string
  competencyRatings: Record<string, { rating: number; comment: string }>
  valueRatings: Record<string, { rating: number; comment: string }>
}

export type ManagerReview = {
  id: string
  employeeId: string
  managerId: string
  cycleId: string
  status: 'draft' | 'submitted'
  submittedAt?: string
  lastSavedAt: string
  goalsScore: number // 1.0 - 5.0
  competenciesScore: number // 1.0 - 5.0
  valuesScore: number // 1.0 - 5.0
  compositeScore: number // calculated weighted
  overallComments: string
  strengths: string
  growthAreas: string
  recommendations: {
    promotion: boolean
    increment: boolean
    bonus: boolean
    training: boolean
    notes: string
  }
}

export type CalibrationRecord = {
  id: string
  cycleId: string
  employeeId: string
  originalScore: number
  adjustedScore: number
  reason: string
  calibratedBy: string
  calibratedAt: string
  adminApproved?: boolean
  adminApprovedAt?: string
  status?: 'pending_admin_approval' | 'approved'
}

export type EvaluationResult = {
  id: string
  cycleId: string
  employeeId: string
  managerId: string
  compositeScore: number
  finalRatingLabel: string
  ratingBand: string
  goalsScore: number
  competenciesScore: number
  valuesScore: number
  managerComments: string
  agreedActions: string[]
  acknowledged: boolean
  acknowledgedAt?: string
  disputeStatus: 'none' | 'disputed' | 'resolved'
  disputeReason?: string
  disputeSubmittedAt?: string
}

export type FeedbackItem = {
  id: string
  fromUserId: string
  toUserId: string
  type: 'kudos' | 'constructive'
  competency: string
  message: string
  createdAt: string
  isPublic: boolean
}

export type GrowthAction = {
  id: string
  title: string
  targetDate: string
  status: 'not_started' | 'in_progress' | 'completed'
}

export type RecommendedCourse = {
  id: string
  title: string
  provider: string
  duration: string
  status: 'enrolled' | 'recommended' | 'completed'
}

export type DevelopmentPlan = {
  id: string
  userId: string
  skills: Array<{ name: string; currentLevel: number; targetLevel: number }>
  agreedActions: GrowthAction[]
  recommendedCourses: RecommendedCourse[]
}

export type AuditLog = {
  id: string
  actorId: string
  actorName: string
  action: string
  entity: string
  entityId: string
  timestamp: string
  details: string
}

export type Notification = {
  id: string
  userId: string
  title: string
  message: string
  link: string
  read: boolean
  createdAt: string
  type: 'action' | 'info' | 'success' | 'warning'
}

