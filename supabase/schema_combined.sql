-- ============================================================================
-- PerformIQ — Clean Complete Supabase Database Schema & Setup Script
-- Safe to run repeatedly. Drops old tables and rebuilds from scratch.
-- Run in: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. CLEAN RESET: DROP EXISTING OBJECTS (CASCADE)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.submit_goals(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.advance_review_cycle(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.calibrate_review(UUID, UUID, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.release_cycle(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.acknowledge_result(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.dispute_result(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.current_tenant_id() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_role() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_manager_of(UUID) CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;

DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.final_results CASCADE;
DROP TABLE IF EXISTS public.calibrations CASCADE;
DROP TABLE IF EXISTS public.manager_reviews CASCADE;
DROP TABLE IF EXISTS public.self_assessments CASCADE;
DROP TABLE IF EXISTS public.goal_change_requests CASCADE;
DROP TABLE IF EXISTS public.goal_updates CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.cycle_participants CASCADE;
DROP TABLE IF EXISTS public.review_cycles CASCADE;
DROP TABLE IF EXISTS public.review_templates CASCADE;
DROP TABLE IF EXISTS public.competencies CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS & COMMON TRIGGERS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 2. CORE SYSTEM TABLES
-- ----------------------------------------------------------------------------

-- 2.1 Tenants (Organizations)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{"enforce_mfa": false, "dispute_window_days": 7}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2.2 Departments
CREATE TABLE public.departments (
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

-- 2.3 User Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 2.4 Core Competencies
CREATE TABLE public.competencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  level_descriptors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_competencies_tenant_name UNIQUE (tenant_id, name)
);

-- 2.5 Review Templates
CREATE TABLE public.review_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  scale_min NUMERIC NOT NULL DEFAULT 1.0,
  scale_max NUMERIC NOT NULL DEFAULT 5.0,
  weights JSONB NOT NULL DEFAULT '{"goals": 60, "competencies": 30, "values": 10}'::jsonb,
  deadlines JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_review_templates_tenant_version UNIQUE (tenant_id, name, version)
);

-- 2.6 Appraisal Review Cycles
CREATE TABLE public.review_cycles (
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
  deadlines JSONB NOT NULL DEFAULT '{}'::jsonb,
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

-- 2.7 Cycle Participants
CREATE TABLE public.cycle_participants (
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

-- 2.8 Goals
CREATE TABLE public.goals (
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

-- 2.9 Goal Progress Updates & Evidence
CREATE TABLE public.goal_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL CHECK (progress >= 0 AND progress <= 100),
  note TEXT NOT NULL,
  evidence_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 Goal Change Requests
CREATE TABLE public.goal_change_requests (
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

-- 2.11 Employee Self Assessments
CREATE TABLE public.self_assessments (
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

-- 2.12 Manager Evaluations
CREATE TABLE public.manager_reviews (
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

-- 2.13 Calibration Records
CREATE TABLE public.calibrations (
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

-- 2.14 Final Released Results
CREATE TABLE public.final_results (
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

-- 2.15 Continuous Feedback & Kudos
CREATE TABLE public.feedback (
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

-- 2.16 System Notifications
CREATE TABLE public.notifications (
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

-- 2.17 Immutable Enterprise Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ----------------------------------------------------------------------------
CREATE INDEX idx_profiles_tenant_role ON public.profiles(tenant_id, role);
CREATE INDEX idx_profiles_manager ON public.profiles(manager_id);
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_goals_user_cycle ON public.goals(user_id, cycle_id);
CREATE INDEX idx_goals_tenant_status ON public.goals(tenant_id, status);
CREATE INDEX idx_goal_updates_goal ON public.goal_updates(goal_id);
CREATE INDEX idx_self_assessments_cycle_user ON public.self_assessments(cycle_id, user_id);
CREATE INDEX idx_manager_reviews_reviewer ON public.manager_reviews(reviewer_id, cycle_id);
CREATE INDEX idx_final_results_user_cycle ON public.final_results(user_id, cycle_id);
CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX idx_audit_logs_tenant_time ON public.audit_logs(tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.self_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE(
    (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT COALESCE((SELECT role FROM public.profiles WHERE id = auth.uid()), 'employee');
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_manager_of(employee_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = employee_id AND manager_id = auth.uid()
  );
$$;

-- Global Read Policies for Base Metadata
CREATE POLICY "tenants_public_select" ON public.tenants FOR SELECT USING (true);
CREATE POLICY "departments_public_select" ON public.departments FOR SELECT USING (true);
CREATE POLICY "competencies_public_select" ON public.competencies FOR SELECT USING (true);
CREATE POLICY "templates_all" ON public.review_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "review_cycles_all" ON public.review_cycles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cycle_participants_all" ON public.cycle_participants FOR ALL USING (true) WITH CHECK (true);

-- Profiles
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_all" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (
  id = auth.uid() OR public.is_admin()
) WITH CHECK (
  id = auth.uid() OR public.is_admin()
);

-- Goals & Updates
CREATE POLICY "goals_select" ON public.goals FOR SELECT USING (
  user_id = auth.uid() OR public.is_manager_of(user_id) OR public.is_admin() OR auth.uid() IS NULL
);
CREATE POLICY "goals_insert" ON public.goals FOR INSERT WITH CHECK (
  user_id = auth.uid() OR auth.uid() IS NULL OR public.is_admin()
);
CREATE POLICY "goals_update" ON public.goals FOR UPDATE USING (
  user_id = auth.uid() OR public.is_manager_of(user_id) OR public.is_admin() OR auth.uid() IS NULL
);
CREATE POLICY "goals_delete" ON public.goals FOR DELETE USING (
  user_id = auth.uid() OR public.is_admin() OR auth.uid() IS NULL
);

CREATE POLICY "goal_updates_select" ON public.goal_updates FOR SELECT USING (true);
CREATE POLICY "goal_updates_insert" ON public.goal_updates FOR INSERT WITH CHECK (true);
CREATE POLICY "goal_change_requests_all" ON public.goal_change_requests FOR ALL USING (true);

-- Self Reviews & Manager Reviews
CREATE POLICY "self_assessments_all" ON public.self_assessments FOR ALL USING (true);
CREATE POLICY "manager_reviews_all" ON public.manager_reviews FOR ALL USING (true);
CREATE POLICY "calibrations_all" ON public.calibrations FOR ALL USING (true);
CREATE POLICY "final_results_all" ON public.final_results FOR ALL USING (true);

-- Feedback, Notifications & Audit
CREATE POLICY "feedback_all" ON public.feedback FOR ALL USING (true);
CREATE POLICY "notifications_all" ON public.notifications FOR ALL USING (true);
CREATE POLICY "audit_logs_all" ON public.audit_logs FOR ALL USING (true);

-- ----------------------------------------------------------------------------
-- 5. ATOMIC RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- 5.1 Goal Submission Validation
CREATE OR REPLACE FUNCTION public.submit_goals(p_cycle_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_goal_count INTEGER;
  v_total_weight INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id FROM public.profiles WHERE role = 'employee' LIMIT 1;
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id;
  IF v_tenant_id IS NULL THEN v_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid; END IF;

  SELECT COUNT(*), COALESCE(SUM(weight), 0) INTO v_goal_count, v_total_weight
  FROM public.goals WHERE cycle_id = p_cycle_id AND user_id = v_user_id AND status IN ('draft', 'returned');

  UPDATE public.goals SET status = 'pending_approval', updated_at = NOW()
  WHERE cycle_id = p_cycle_id AND user_id = v_user_id AND status IN ('draft', 'returned');

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (v_tenant_id, v_user_id, 'SUBMIT_GOALS', 'goals', p_cycle_id, jsonb_build_object('goal_count', v_goal_count, 'total_weight', v_total_weight));

  RETURN jsonb_build_object('success', true, 'goal_count', v_goal_count, 'total_weight', v_total_weight, 'status', 'pending_approval');
END;
$$;

-- 5.2 Result Acknowledgement
CREATE OR REPLACE FUNCTION public.acknowledge_result(p_result_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE public.final_results SET status = 'acknowledged', acknowledged_at = NOW(), updated_at = NOW()
  WHERE id = p_result_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Result record not found.'; END IF;
  RETURN jsonb_build_object('success', true, 'status', 'acknowledged');
END;
$$;

-- 5.3 Result Dispute
CREATE OR REPLACE FUNCTION public.dispute_result(p_result_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF length(trim(p_reason)) < 5 THEN RAISE EXCEPTION 'Dispute reason must be at least 5 characters.'; END IF;

  UPDATE public.final_results SET status = 'disputed', dispute_reason = trim(p_reason), disputed_at = NOW(), updated_at = NOW()
  WHERE id = p_result_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Result record not found.'; END IF;
  RETURN jsonb_build_object('success', true, 'status', 'disputed');
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. SUPABASE AUTH SYNC TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
  v_role TEXT;
  v_name TEXT;
  v_department TEXT;
  v_designation TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');
  IF v_role NOT IN ('employee', 'manager', 'admin') THEN
    v_role := 'employee';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  v_department := COALESCE(NEW.raw_user_meta_data->>'department', 'Engineering');
  v_designation := COALESCE(NEW.raw_user_meta_data->>'designation', 'Specialist');

  INSERT INTO public.profiles (
    id,
    tenant_id,
    name,
    email,
    role,
    department,
    designation,
    avatar,
    active
  ) VALUES (
    NEW.id,
    v_tenant_id,
    v_name,
    NEW.email,
    v_role,
    v_department,
    v_designation,
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 7. CLEAN SEED DATA (Default Baseline Setup)
-- ----------------------------------------------------------------------------

-- 7.1 Default Tenant
INSERT INTO public.tenants (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PerformIQ Enterprise',
  'performiq-corp',
  '{"enforce_mfa": false, "dispute_window_days": 7}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 7.2 Departments
INSERT INTO public.departments (id, tenant_id, name)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Engineering'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'People Operations'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Product Management'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Design & UX')
ON CONFLICT DO NOTHING;

-- 7.3 Review Template
INSERT INTO public.review_templates (id, tenant_id, name, version, scale_min, scale_max, weights)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Standard Enterprise Performance Template (60/30/10)',
  1,
  1.0,
  5.0,
  '{"goals": 60, "competencies": 30, "values": 10}'::jsonb
)
ON CONFLICT DO NOTHING;

-- 7.4 Core Competencies
INSERT INTO public.competencies (tenant_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Technical Execution & Architecture', 'Delivers robust, secure, and maintainable systems aligned with technical standards.'),
  ('00000000-0000-0000-0000-000000000001', 'Ownership & Reliability', 'Takes proactive responsibility for end-to-end delivery and system quality.'),
  ('00000000-0000-0000-0000-000000000001', 'Collaboration & Team Multiplier', 'Elevates team velocity, mentors peers, and fosters an inclusive environment.'),
  ('00000000-0000-0000-0000-000000000001', 'Customer Focus & Business Impact', 'Prioritizes value delivery and user experience in every technical decision.')
ON CONFLICT DO NOTHING;

-- 7.5 Baseline Users (Admin, Manager, Employee)
-- Admin: Eleanor Vance
INSERT INTO public.profiles (id, tenant_id, name, email, employee_code, role, designation, department, avatar, active)
VALUES (
  '11111111-1111-1111-1111-111111111103',
  '00000000-0000-0000-0000-000000000001',
  'Eleanor Vance',
  'admin@performiq.internal',
  'EMP-001',
  'admin',
  'Head of People Operations',
  'People Operations',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  true
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role;

-- Manager: Marcus Chen (Reports to Eleanor)
INSERT INTO public.profiles (id, tenant_id, name, email, employee_code, role, designation, department, manager_id, avatar, active)
VALUES (
  '11111111-1111-1111-1111-111111111102',
  '00000000-0000-0000-0000-000000000001',
  'Marcus Chen',
  'marcus.chen@performiq.internal',
  'EMP-002',
  'manager',
  'Engineering Director',
  'Engineering',
  '11111111-1111-1111-1111-111111111103',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  true
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, manager_id = EXCLUDED.manager_id;

-- Employee: Alex Rivera (Reports to Marcus)
INSERT INTO public.profiles (id, tenant_id, name, email, employee_code, role, designation, department, manager_id, avatar, active)
VALUES (
  '11111111-1111-1111-1111-111111111101',
  '00000000-0000-0000-0000-000000000001',
  'Alex Rivera',
  'alex.rivera@performiq.internal',
  'EMP-003',
  'employee',
  'Senior Frontend Engineer',
  'Engineering',
  '11111111-1111-1111-1111-111111111102',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  true
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, manager_id = EXCLUDED.manager_id;


