-- ============================================================================
-- PerformIQ — Initial Schema Migration
-- Matches Architecture & Tenancy Requirements in Backend Foundation Brief
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function for auto-updating updated_at timestamp
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_departments_tenant_name UNIQUE (tenant_id, name)
);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  employee_code TEXT,
  role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'admin')),
  designation TEXT NOT NULL DEFAULT 'Specialist',
  department TEXT NOT NULL DEFAULT 'Engineering',
  manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  grade TEXT DEFAULT 'L3',
  avatar TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_profiles_tenant_user UNIQUE (tenant_id, id),
  CONSTRAINT chk_profiles_no_self_manage CHECK (id <> manager_id)
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Competencies Table
CREATE TABLE IF NOT EXISTS public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  level_descriptors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_competencies_tenant_name UNIQUE (tenant_id, name)
);

-- 5. Review Templates Table
CREATE TABLE IF NOT EXISTS public.review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  scale_min NUMERIC NOT NULL DEFAULT 1.0,
  scale_max NUMERIC NOT NULL DEFAULT 5.0,
  weights JSONB NOT NULL DEFAULT '{"goals": 60, "competencies": 30, "values": 10}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_review_templates_tenant_version UNIQUE (tenant_id, name, version)
);

-- 6. Review Cycles Table
CREATE TABLE IF NOT EXISTS public.review_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (
    stage IN ('draft', 'goals_open', 'tracking', 'self_review', 'manager_review', 'calibration', 'released', 'closed')
  ) DEFAULT 'draft',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  template_id UUID REFERENCES public.review_templates(id),
  weights JSONB NOT NULL DEFAULT '{"goals": 60, "competencies": 30, "values": 10}'::jsonb,
  rating_bands JSONB NOT NULL DEFAULT '[
    {"min": 4.5, "max": 5.0, "label": "Outstanding"},
    {"min": 3.5, "max": 4.49, "label": "Exceeds Expectations"},
    {"min": 2.5, "max": 3.49, "label": "Meets Expectations"},
    {"min": 1.5, "max": 2.49, "label": "Needs Improvement"},
    {"min": 1.0, "max": 1.49, "label": "Unsatisfactory"}
  ]'::jsonb,
  dispute_window_days INTEGER NOT NULL DEFAULT 7,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cycles_date_range CHECK (end_date >= start_date)
);

CREATE TRIGGER trg_review_cycles_updated_at
  BEFORE UPDATE ON public.review_cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7. Cycle Participants Table
CREATE TABLE IF NOT EXISTS public.cycle_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cycle_participants UNIQUE (cycle_id, user_id)
);

-- 8. Goals Table
CREATE TABLE IF NOT EXISTS public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Core Role',
  metric TEXT NOT NULL,
  target NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT '%',
  weight INTEGER NOT NULL CHECK (weight >= 5 AND weight <= 100),
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('draft', 'pending_approval', 'approved', 'returned', 'completed', 'cancelled')
  ) DEFAULT 'draft',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. Goal Updates Table (Append-only)
CREATE TABLE IF NOT EXISTS public.goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  note TEXT NOT NULL,
  evidence_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Goal Change Requests
CREATE TABLE IF NOT EXISTS public.goal_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_changes JSONB NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reviewer_id UUID REFERENCES public.profiles(id),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Self Assessments Table
CREATE TABLE IF NOT EXISTS public.self_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_rating NUMERIC CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')) DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_self_assessments UNIQUE (cycle_id, user_id)
);

CREATE TRIGGER trg_self_assessments_updated_at
  BEFORE UPDATE ON public.self_assessments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 12. Manager Reviews Table
CREATE TABLE IF NOT EXISTS public.manager_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  component_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_rating NUMERIC CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
  comments TEXT,
  recommendations JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')) DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_manager_reviews UNIQUE (cycle_id, user_id)
);

CREATE TRIGGER trg_manager_reviews_updated_at
  BEFORE UPDATE ON public.manager_reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 13. Calibrations Table
CREATE TABLE IF NOT EXISTS public.calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  original_score NUMERIC NOT NULL CHECK (original_score >= 1.0 AND original_score <= 5.0),
  adjusted_score NUMERIC NOT NULL CHECK (adjusted_score >= 1.0 AND adjusted_score <= 5.0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) >= 10),
  calibrated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nine_box_quadrant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. Final Results Table
CREATE TABLE IF NOT EXISTS public.final_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES public.review_cycles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  weights JSONB NOT NULL DEFAULT '{}'::jsonb,
  final_score NUMERIC NOT NULL CHECK (final_score >= 1.0 AND final_score <= 5.0),
  rating_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('pending', 'released', 'acknowledged', 'disputed', 'resolved')
  ) DEFAULT 'pending',
  released_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  dispute_reason TEXT,
  disputed_at TIMESTAMPTZ,
  dispute_outcome TEXT,
  dispute_response TEXT,
  dispute_resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_final_results UNIQUE (cycle_id, user_id)
);

CREATE TRIGGER trg_final_results_updated_at
  BEFORE UPDATE ON public.final_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 15. Feedback & Kudos Table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('praise', 'constructive')),
  content TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_private BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. In-App Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. System Audit Logs Table (Append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Fast Query Lookups & Multi-Tenant Partitioning
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_role ON public.profiles(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_manager ON public.profiles(manager_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_cycle ON public.goals(user_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_goals_tenant_status ON public.goals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_goal_updates_goal ON public.goal_updates(goal_id);
CREATE INDEX IF NOT EXISTS idx_self_assessments_cycle_user ON public.self_assessments(cycle_id, user_id);
CREATE INDEX IF NOT EXISTS idx_manager_reviews_reviewer ON public.manager_reviews(reviewer_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_final_results_user_cycle ON public.final_results(user_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON public.audit_logs(tenant_id, created_at DESC);

