# PerformIQ — Enterprise Performance Evaluation System

> A modern, premium enterprise SaaS performance evaluation, goal tracking, and calibrated appraisal workspace.

Built with **React 19**, **TypeScript**, **Vite**, **Tailwind CSS**, and **React Router**.

---

## 🌟 Key Product Features

### 1. Three Core Enterprise Workspaces
- **Individual Contributor (Employee):**
  - **Dashboard:** Cycle countdown, next action guide, goal summary, recent peer feedback.
  - **My Goals:** Goal drafting, 100% weight meter validation, 3–7 goal bounds check, progress checkpoint logging with evidence file references.
  - **Self-Review:** Multi-step reflection on accomplishments, core competencies, and company values with autosave and submission lock.
  - **Peer Feedback:** Kudos recognition and constructive coaching with recipient competency tagging.
  - **Evaluation Results:** Privacy-enforced unreleased view (results remain hidden until official cycle release); full weighted score breakdown, manager feedback, formal receipt acknowledgement, and dispute filing once released.
  - **Growth & Development:** Technical skills matrix, agreed growth milestones with interactive status toggles, and curated leadership coursework.
  - **Profile:** Department, designation, corporate email, employee code, and reporting line.

- **People Manager:**
  - **Team Overview:** Direct reports appraisal roster, review completion rates, and quick action shortcuts.
  - **Goal Approvals:** Review team members' submitted performance targets. Single-click "Approve All" or per-goal "Approve" / "Return for Revision" with mandatory comments.
  - **Manager Review Workspace (`/manager/reviews/:employeeId`):** Split-screen layout.
    - *Left side (Evidence):* Employee's approved goals and checkpoint logs, submitted self-review reflection, and peer feedback quotes (with $\ge 3$ response anonymity safeguard).
    - *Right side (Evaluation):* Numerical rating inputs for Goals, Competencies, and Values (1.0–5.0), narrative comments, promotion/bonus/increment recommendations, and **real-time live weighted composite scoring**.
  - **Team Analytics:** Gaussian rating distribution curve, goal completion rates by team member, and competency strength indicators.
  - **1-on-1 Discussions:** Structured check-in agendas linked to performance targets.
  - **Workspace Toggle:** Managers can switch to their own Employee View to manage their personal goals and self-reviews.

- **People Operations (Admin):**
  - **Executive Overview:** Company-wide completion rates, department performance comparisons, calibration timeline status.
  - **People Directory:** Filterable employee directory (role, department, status), user creation, editing, and active status toggling.
  - **Review Cycles:** Manage appraisal cycles, configure component weights (Goals / Competencies / Values) with 100% total validation.
  - **Cycle Stage Advancement (`/admin/cycles/:cycleId`):** Step-by-step sequential cycle advancement (`Draft → Goals open → Tracking → Self-review → Manager review → Calibration → Released → Closed`) with confirmation safeguards.
  - **Calibration Hub:** Calibrate manager scores across departments with mandatory justification reasons; **Simulate Release** action that publishes results immediately to employees.
  - **Reports & Analytics:** Department performance comparisons and Gaussian quota compliance charts.
  - **Audit Trail:** Immutable event log tracking administrative actions and evaluation adjustments.

---

## 🚀 Quick Start / Local Run Instructions

### Prerequisites
- Node.js `v18+` or `v20+` or `v24+`
- npm `v9+` or `v10+` or `v11+`

### Installation & Run
```bash
# 1. Clone repository and navigate to folder
cd PES

# 2. Install dependencies (if not already installed)
npm install

# 3. Start local development server
npm run dev

# 4. Open in browser
# http://localhost:5173
```

### Production Build
```bash
npm run build
npm run preview
```

---

## 👥 Fictional Sample Identities & Role Switcher

Use the persistent banner at the top of the interface or the `/login` screen to instantly switch between personas:

| Role | Name | Title | Department |
| :--- | :--- | :--- | :--- |
| **Admin** | Eleanor Vance | VP of People & Operations | People Operations |
| **Manager** | Marcus Chen | Director of Engineering | Engineering |
| **Manager** | Sarah Jenkins | VP of Product & Experience | Product & Design |
| **Employee** | Alex Rivera | Staff Frontend Engineer | Engineering (Reports to Marcus) |
| **Employee** | Priya Patel | Senior Backend Systems Engineer | Engineering (Reports to Marcus) |
| **Employee** | Jordan Hayes | Senior QA Automation Lead | Engineering (Reports to Marcus) |
| **Employee** | Liam Torres | Principal Product Designer | Product & Design (Reports to Sarah) |
| **Employee** | Maya Lin | Lead Technical Product Manager | Product & Design (Reports to Sarah) |
| **Employee** | Chloe Bennett | Senior Product Analytics Specialist | Product & Design (Reports to Sarah) |

---

## 🏗️ Architecture & Technology Stack

```
src/
  app/                 AppContext, Providers, Router configuration
  components/
    shell/             AppLayout, AppHeader, AppSidebar, DemoBanner
    ui/                Modal, ConfirmDialog, Toast, Badge, MetricCard, ProgressBar,
                       StageStepper, RatingInput, ScorePreviewCard, EmptyState
  data/                seedData.ts (Realistic enterprise sample data)
  lib/                 scoring.ts (Formulas & bands), validation.ts, formatters.ts
  pages/
    employee/          Dashboard, Goals, GoalDetail, SelfReview, Feedback, Results, Development, Profile
    manager/           Dashboard, Approvals, ReviewWorkspace, Analytics, OneOnOnes
    admin/             Overview, Users, Cycles, CycleDetail, Calibration, Reports, Audit
    Login.tsx, Forbidden.tsx
  services/
    mock/              Typed service implementations with localStorage persistence
    index.ts           Unified service seam (ready for Supabase plug-in)
  types/               index.ts (Shared frontend models)
```

---

## 🔒 Scoring Formula & Calibration Rules

- **Composite Weighted Score:**
  $$\text{Composite Score} = \frac{\text{Goals} \times W_{\text{goals}} + \text{Competencies} \times W_{\text{comp}} + \text{Values} \times W_{\text{values}}}{100}$$
- **Rating Bands:**
  - **Band 5:** 4.50 – 5.00 (*Outstanding Performance*)
  - **Band 4:** 3.75 – 4.49 (*Exceeds Expectations*)
  - **Band 3:** 2.75 – 3.74 (*Meets Expectations*)
  - **Band 2:** 2.00 – 2.74 (*Needs Improvement*)
  - **Band 1:** 1.00 – 1.99 (*Unsatisfactory*)
