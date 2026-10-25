# PerformIQ — Project Progress

This document summarizes the implementation present in the repository as inspected on **October 24, 2026**. It describes the current codebase rather than a dated sequence of changes.

## Project Goal

PerformIQ is a performance-management application for planning review cycles, setting and tracking goals, collecting reviews, calibrating outcomes, and sharing released results. The application is a React single-page app, with a Supabase backend integration and a local demo-data mode.

## Work Completed

### Application foundation

- Set up a **React 19 + TypeScript + Vite** application with Tailwind CSS, React Router, and shared styling.
- Added a common application shell with navigation, role-aware workspaces, theme controls, notifications, and demo-data controls.
- Defined shared TypeScript models for users, cycles, goals, reviews, calibration, results, feedback, development plans, audit events, and notifications in [`src/types/index.ts`](./src/types/index.ts).
- Configured role-specific routes for employees, managers, and administrators, with role guards and not-found/forbidden handling.
- Built reusable UI components for metrics, ratings, progress, dialogs, date selection, PDF viewing, search, and other dashboard interactions.

### Employee workspace

- Created employee dashboards and profile pages.
- Implemented goal creation and editing, weighted goal sets, manager approval status, progress updates, and evidence attachments.
- Added multi-part self-reviews with draft/submission states.
- Added peer feedback, development plans, and evaluation result views.
- Included acknowledgement and dispute workflows for published results.

### Manager workspace

- Created team overview and review-completion dashboards.
- Implemented goal approval and return-for-revision workflows.
- Added an employee review workspace with goal evidence, self-review information, peer feedback, ratings, comments, and recommendations.
- Added team analytics and 1-on-1 check-in pages.

### People Operations / administrator workspace

- Created executive overview, people directory, cycle management, cycle detail, calibration, reporting, and audit pages.
- Implemented cycle stages from draft through release and closure, with sequential workflow handling.
- Added cycle component weights and validation, manager score calibration, and result release functionality.

### Domain logic and workflow rules

- Added weighted composite score calculation, score bounds, and five rating bands in [`src/lib/scoring.ts`](./src/lib/scoring.ts).
- Added goal-set, cycle-weight, score-range, and justification validation in [`src/lib/validation.ts`](./src/lib/validation.ts).
- Added cycle deadline generation and date-sequence validation in [`src/lib/deadlines.ts`](./src/lib/deadlines.ts).
- Added shared workflow-state calculations for employee, manager, and administrator views in [`src/lib/workflow.ts`](./src/lib/workflow.ts).
- Added realistic fictional seed datasets for demo workflows.

### Data services and persistence

- Created a typed service layer for people, cycles, goals, reviews, calibration, results, feedback, development plans, audit events, and notifications.
- Added local browser persistence through `localStorage`, with clean/full demo data reset paths and cross-tab storage notifications.
- Added Supabase service implementations and wired them through [`src/services/index.ts`](./src/services/index.ts).
- Added Supabase Auth session handling and notification synchronization. Supabase requests use an offline/retry fallback to the local mock services when the service is not configured or is unreachable.

### Supabase backend assets

- Added SQL schema, row-level-security policies, RPC functions, fictional seed data, and an auth profile trigger.
- Added migrations for the initial schema and policies, database functions, seed data, auth profile creation, and cycle deadlines/participants.
- Added an environment-variable template in [`.env.example`](./.env.example). A live Supabase connection and migration application were not verified as part of this review.

## Tests and Validation

The repository contains tests and verification scripts covering scoring, deadlines, evidence, workflow synchronization, calibration, notifications, and reports. The `PESwork` package does not currently define a `test` script, so these checks were not run through a standard project test command.

| Check | Result |
|---|---|
| `npm run build` from the repository root | **Passed** — TypeScript compilation and Vite production build completed. |
| Production bundle | **Built with a warning** — the main JavaScript bundle is about 1.36 MB before gzip, above Vite's 500 kB advisory threshold. |
| `npm --prefix PESwork run lint` | **Failed** — Oxlint reports 3 errors and 245 warnings. The errors are conditional `useApp` hook calls in [`src/pages/Forbidden.tsx`](./src/pages/Forbidden.tsx). |
| Standard test command | **Not configured** — no `test` script is present in [`package.json`](./package.json). |

## Remaining Work / Recommended Next Steps

1. Fix the three conditional-hook errors in `src/pages/Forbidden.tsx`, then review and reduce the lint warnings.
2. Add a supported test command and run the existing unit/verification tests consistently.
3. Configure and verify the Supabase project, apply migrations in order, and exercise authentication, RLS, RPC, and realtime behavior against that project.
4. Review the large production bundle and split code where it improves loading performance.
5. Bring [`README.md`](./README.md) and [`AGENTS.md`](./AGENTS.md) up to date: the latter describes backend integration as upcoming, while the current service layer already contains Supabase implementations.

## Repository Notes

- The runnable application is under [`PESwork/`](./), with root-level npm scripts delegating to that package.
- The current Git branch has no commits, so this report cannot establish the chronology of the work or attribute particular changes to a specific date. It is a summary of the code present in the working tree.

### Real-Time Workflow Synchronization & Stage Tracking (October 26, 2026)

- **Global Cycle State Reactivity:** Enhanced `AppContext` storage subscription to update `activeCycle` and `allCycles` in real time when any cycle's stage is advanced, calibrated, released, or closed.
- **Workflow State Engine (`workflow.ts`):** 
  - Aligned `getAdminWorkflowState` to immediately advance to Stage 7 (`Results Released`) upon formal Admin release permission or published results.
  - Aligned stage advancement to Stage 8 (`Cycle Closed`) when the cycle is marked as closed, cleanly completing all steps 1–8 with 100% progress and checkmarks in `StageStepper`.
  - Added cycle aliases (including `cycle-2026-h2`) to `matchesCycle` to guarantee deterministic identification regardless of ID generation method.
- **Service Layer Resiliency:**
  - Updated `resultService.getAllResults` and `supabaseReviewService` to use `matchesCycle`.
  - Updated `cycleService.setStage` and `cycleService.advanceStage` to locate cycles via `matchesCycle` and return the updated cycle.
- **Admin Overview & Roster Accuracy:**
  - Resolved dynamic `currentCycle` in `Overview.tsx` to prevent stale stage display.
  - Enhanced `renderEmployeeCard` to match reviews, calibrations, and evaluation results using `matchesUser` and `matchesCycle`.
  - Accurately renders `Calibrated: Done` and `Released: 4.0` badges for calibrated/released staff without reverting to pending states.
- **Cycle Detail Sync:**
  - Updated `CycleDetail.tsx` evaluation state filters to use `matchesCycle`.
