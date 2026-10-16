# PerformIQ — Developer & Agent Instructions

## Phase 1: Frontend-First Foundation (Completed)

PerformIQ is architected with a strict separation between UI page components and the typed data layer.

### Architecture Highlights:
- **Typed Service Seam (`src/services/`):** Page components never access `localStorage` or backend databases directly. All data requests and mutations go through typed, Promise-returning services:
  - `peopleService`: Employee records, direct reports, profile updates
  - `cycleService`: Appraisal cycles, timeline management, stage advancement
  - `goalService`: Goal drafting, validation (3-7 goals, 100% weight), approvals, checkpoints
  - `reviewService`: Self-review drafts, submission locking, manager appraisals, scoring
  - `calibrationService`: Score adjustment, committee rationale, cycle release
  - `resultService`: Outcome publication barrier (unreleased vs released), acknowledgement, dispute
  - `feedbackService`: Kudos and constructive feedback with anonymity safeguards
  - `developmentService`: Skills matrix and growth milestone tracking
  - `auditService`: Traceability log for administrative and manager events
  - `notificationService`: In-app event prompts

- **Browser Persistence:** State is persisted in `localStorage` under `performiq_demo_state_v1`. The persistent top banner includes a "Reset Demo Data" action to revert to clean fictional seed data at any time.

- **Role Simulation:** The UI supports 3 primary roles (Employee, Manager, Admin) plus multi-role workspace switching (Managers and Admins can switch to their own Employee view). This is strictly for prototype demonstration and is labeled as preview behavior.

## Phase 2: Backend Integration Blueprint (Upcoming)

When backend implementation begins:
1. Preserve the frontend models in `src/types/index.ts`.
2. Implement Supabase client and replace `src/services/mock/*` with Supabase query functions.
3. Replace the client-side role simulator with Supabase Auth session tokens.
4. Enforce Row Level Security (RLS) on Postgres tables for tenant isolation.
5. Author PostgreSQL RPC functions or Edge Functions for atomic operations (such as cycle release and stage advancement).

