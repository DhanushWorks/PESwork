-- ============================================================================
-- PerformIQ — Complete Supabase Database Schema & Setup Script
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auto-update updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. CORE TABLES
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

-- Indexes
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

-- 3. ROW LEVEL SECURITY (RLS)
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

-- Helper functions
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
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

-- RLS Policies
CREATE POLICY "profiles_select_same_tenant" ON public.profiles FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE USING (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE POLICY "review_cycles_select" ON public.review_cycles FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "review_cycles_admin_all" ON public.review_cycles FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE POLICY "review_templates_select" ON public.review_templates FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "review_templates_admin_all" ON public.review_templates FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE POLICY "goals_select" ON public.goals FOR SELECT USING (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_manager_of(user_id) OR public.is_admin()));
CREATE POLICY "goals_insert_own" ON public.goals FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "goals_update_own" ON public.goals FOR UPDATE USING (user_id = auth.uid() AND status IN ('draft', 'returned')) WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "goals_manager_decide" ON public.goals FOR UPDATE USING (public.is_manager_of(user_id)) WITH CHECK (public.is_manager_of(user_id) AND tenant_id = public.current_tenant_id());

CREATE POLICY "goal_updates_select" ON public.goal_updates FOR SELECT USING (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_manager_of(user_id) OR public.is_admin()));
CREATE POLICY "goal_updates_insert_own" ON public.goal_updates FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());

CREATE POLICY "self_assessments_select" ON public.self_assessments FOR SELECT USING (tenant_id = public.current_tenant_id() AND (user_id = auth.uid() OR public.is_manager_of(user_id) OR public.is_admin()));
CREATE POLICY "self_assessments_insert_own" ON public.self_assessments FOR INSERT WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());
CREATE POLICY "self_assessments_update_own" ON public.self_assessments FOR UPDATE USING (user_id = auth.uid() AND status = 'draft') WITH CHECK (user_id = auth.uid() AND tenant_id = public.current_tenant_id());

CREATE POLICY "manager_reviews_select" ON public.manager_reviews FOR SELECT USING (tenant_id = public.current_tenant_id() AND (reviewer_id = auth.uid() OR public.is_admin()));
CREATE POLICY "manager_reviews_write" ON public.manager_reviews FOR ALL USING (tenant_id = public.current_tenant_id() AND ((reviewer_id = auth.uid() AND status = 'draft') OR public.is_admin()));

CREATE POLICY "calibrations_admin_only" ON public.calibrations FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE POLICY "final_results_select" ON public.final_results FOR SELECT USING (tenant_id = public.current_tenant_id() AND ((user_id = auth.uid() AND status <> 'pending') OR public.is_admin() OR (public.is_manager_of(user_id) AND status <> 'pending')));
CREATE POLICY "final_results_admin_write" ON public.final_results FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE POLICY "feedback_select" ON public.feedback FOR SELECT USING (tenant_id = public.current_tenant_id() AND (NOT is_private OR sender_id = auth.uid() OR recipient_id = auth.uid() OR public.is_admin()));
CREATE POLICY "feedback_insert" ON public.feedback FOR INSERT WITH CHECK (sender_id = auth.uid() AND tenant_id = public.current_tenant_id());

CREATE POLICY "notifications_user_access" ON public.notifications FOR ALL USING (user_id = auth.uid() AND tenant_id = public.current_tenant_id());

CREATE POLICY "audit_logs_admin_select" ON public.audit_logs FOR SELECT USING (public.is_admin() AND tenant_id = public.current_tenant_id());
CREATE POLICY "audit_logs_insert_system" ON public.audit_logs FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. ATOMIC RPC FUNCTIONS
CREATE OR REPLACE FUNCTION public.submit_goals(p_cycle_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_cycle_stage TEXT;
  v_goal_count INTEGER;
  v_total_weight INTEGER;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_user_id;
  IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'User profile not found.'; END IF;

  SELECT stage INTO v_cycle_stage FROM public.review_cycles WHERE id = p_cycle_id AND tenant_id = v_tenant_id;
  IF v_cycle_stage IS NULL THEN RAISE EXCEPTION 'Review cycle not found.'; END IF;
  IF v_cycle_stage <> 'goals_open' THEN
    RAISE EXCEPTION 'Goal submission is only allowed during the Goals Open stage (current: %).', v_cycle_stage;
  END IF;

  SELECT COUNT(*), COALESCE(SUM(weight), 0) INTO v_goal_count, v_total_weight
  FROM public.goals WHERE cycle_id = p_cycle_id AND user_id = v_user_id AND status IN ('draft', 'returned');

  IF v_goal_count < 3 OR v_goal_count > 7 THEN
    RAISE EXCEPTION 'Goal validation failed: You must have between 3 and 7 goals (currently %).', v_goal_count;
  END IF;

  IF v_total_weight <> 100 THEN
    RAISE EXCEPTION 'Goal validation failed: Goal weights must total exactly 100 percent (currently % percent).', v_total_weight;
  END IF;

  UPDATE public.goals SET status = 'pending_approval', updated_at = NOW()
  WHERE cycle_id = p_cycle_id AND user_id = v_user_id AND status IN ('draft', 'returned');

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (v_tenant_id, v_user_id, 'SUBMIT_GOALS', 'goals', p_cycle_id, jsonb_build_object('goal_count', v_goal_count, 'total_weight', v_total_weight));

  RETURN jsonb_build_object('success', true, 'goal_count', v_goal_count, 'total_weight', v_total_weight, 'status', 'pending_approval');
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_review_cycle(p_cycle_id UUID, p_target_stage TEXT, p_reason TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tenant_id UUID;
  v_current_stage TEXT;
  v_valid_next TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Only admins can advance review cycle stages.'; END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_admin_id;
  SELECT stage INTO v_current_stage FROM public.review_cycles WHERE id = p_cycle_id AND tenant_id = v_tenant_id;
  IF v_current_stage IS NULL THEN RAISE EXCEPTION 'Review cycle not found.'; END IF;

  v_valid_next := CASE v_current_stage
    WHEN 'draft' THEN 'goals_open'
    WHEN 'goals_open' THEN 'tracking'
    WHEN 'tracking' THEN 'self_review'
    WHEN 'self_review' THEN 'manager_review'
    WHEN 'manager_review' THEN 'calibration'
    WHEN 'calibration' THEN 'released'
    WHEN 'released' THEN 'closed'
    ELSE NULL
  END;

  IF v_valid_next IS NULL OR v_valid_next <> p_target_stage THEN
    RAISE EXCEPTION 'Illegal stage transition from % to %. Next valid stage is %.', v_current_stage, p_target_stage, COALESCE(v_valid_next, 'none');
  END IF;

  UPDATE public.review_cycles
  SET stage = p_target_stage, released_at = CASE WHEN p_target_stage = 'released' THEN NOW() ELSE released_at END, updated_at = NOW()
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (v_tenant_id, v_admin_id, 'STAGE_TRANSITION', 'review_cycles', p_cycle_id, jsonb_build_object('previous_stage', v_current_stage, 'new_stage', p_target_stage, 'reason', p_reason));

  RETURN jsonb_build_object('success', true, 'cycle_id', p_cycle_id, 'previous_stage', v_current_stage, 'stage', p_target_stage);
END;
$$;

CREATE OR REPLACE FUNCTION public.calibrate_review(p_cycle_id UUID, p_user_id UUID, p_score NUMERIC, p_reason TEXT, p_nine_box TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tenant_id UUID;
  v_current_stage TEXT;
  v_original_score NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Only committee admins can calibrate scores.'; END IF;
  IF p_score < 1.0 OR p_score > 5.0 THEN RAISE EXCEPTION 'Calibrated score must be between 1.0 and 5.0.'; END IF;
  IF length(trim(p_reason)) < 10 THEN RAISE EXCEPTION 'Calibration rationale must be at least 10 characters.'; END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_admin_id;
  SELECT stage INTO v_current_stage FROM public.review_cycles WHERE id = p_cycle_id AND tenant_id = v_tenant_id;
  IF v_current_stage <> 'calibration' THEN RAISE EXCEPTION 'Cycle must be in Calibration stage.'; END IF;

  SELECT overall_rating INTO v_original_score FROM public.manager_reviews WHERE cycle_id = p_cycle_id AND user_id = p_user_id AND tenant_id = v_tenant_id;
  IF v_original_score IS NULL THEN v_original_score := p_score; END IF;

  INSERT INTO public.calibrations (tenant_id, cycle_id, user_id, original_score, adjusted_score, reason, calibrated_by, nine_box_quadrant)
  VALUES (v_tenant_id, p_cycle_id, p_user_id, v_original_score, p_score, trim(p_reason), v_admin_id, p_nine_box);

  INSERT INTO public.final_results (tenant_id, cycle_id, user_id, final_score, rating_label, status)
  VALUES (
    v_tenant_id, p_cycle_id, p_user_id, p_score,
    CASE WHEN p_score >= 4.5 THEN 'Outstanding' WHEN p_score >= 3.5 THEN 'Exceeds Expectations' WHEN p_score >= 2.5 THEN 'Meets Expectations' WHEN p_score >= 1.5 THEN 'Needs Improvement' ELSE 'Unsatisfactory' END,
    'pending'
  )
  ON CONFLICT (cycle_id, user_id) DO UPDATE SET final_score = EXCLUDED.final_score, rating_label = EXCLUDED.rating_label, updated_at = NOW();

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (v_tenant_id, v_admin_id, 'CALIBRATION_ADJUSTMENT', 'calibrations', p_user_id, jsonb_build_object('cycle_id', p_cycle_id, 'original_score', v_original_score, 'adjusted_score', p_score, 'reason', trim(p_reason)));

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'original_score', v_original_score, 'adjusted_score', p_score);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_cycle(p_cycle_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_tenant_id UUID;
  v_current_stage TEXT;
  v_released_count INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized: Only admins can publish review cycle outcomes.'; END IF;

  SELECT tenant_id INTO v_tenant_id FROM public.profiles WHERE id = v_admin_id;
  SELECT stage INTO v_current_stage FROM public.review_cycles WHERE id = p_cycle_id AND tenant_id = v_tenant_id;
  IF v_current_stage <> 'calibration' THEN RAISE EXCEPTION 'Cycle must be in Calibration stage to release outcomes.'; END IF;

  UPDATE public.final_results SET status = 'released', released_at = NOW(), updated_at = NOW()
  WHERE cycle_id = p_cycle_id AND tenant_id = v_tenant_id;
  GET DIAGNOSTICS v_released_count = ROW_COUNT;

  UPDATE public.review_cycles SET stage = 'released', released_at = NOW(), updated_at = NOW()
  WHERE id = p_cycle_id AND tenant_id = v_tenant_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, details)
  VALUES (v_tenant_id, v_admin_id, 'CYCLE_RELEASE', 'review_cycles', p_cycle_id, jsonb_build_object('released_results_count', v_released_count));

  RETURN jsonb_build_object('success', true, 'cycle_id', p_cycle_id, 'released_results_count', v_released_count, 'stage', 'released');
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_result(p_result_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  UPDATE public.final_results SET status = 'acknowledged', acknowledged_at = NOW(), updated_at = NOW()
  WHERE id = p_result_id AND user_id = v_user_id AND status = 'released';

  IF NOT FOUND THEN RAISE EXCEPTION 'Result not found or not in released status.'; END IF;
  RETURN jsonb_build_object('success', true, 'status', 'acknowledged');
END;
$$;

CREATE OR REPLACE FUNCTION public.dispute_result(p_result_id UUID, p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_released_at TIMESTAMPTZ;
  v_dispute_window INTEGER;
BEGIN
  IF length(trim(p_reason)) < 10 THEN RAISE EXCEPTION 'Dispute reason must be at least 10 characters.'; END IF;

  SELECT r.released_at, c.dispute_window_days INTO v_released_at, v_dispute_window
  FROM public.final_results r JOIN public.review_cycles c ON c.id = r.cycle_id
  WHERE r.id = p_result_id AND r.user_id = v_user_id AND r.status = 'released';

  IF v_released_at IS NULL THEN RAISE EXCEPTION 'Result not found or not in released status.'; END IF;
  IF NOW() > (v_released_at + (v_dispute_window || ' days')::INTERVAL) THEN
    RAISE EXCEPTION 'The % day dispute window for this appraisal cycle has expired.', v_dispute_window;
  END IF;

  UPDATE public.final_results SET status = 'disputed', dispute_reason = trim(p_reason), disputed_at = NOW(), updated_at = NOW()
  WHERE id = p_result_id AND user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'status', 'disputed');
END;
$$;

-- 5. INITIAL SEED DATA
INSERT INTO public.tenants (id, name, slug, settings)
VALUES ('00000000-0000-0000-0000-000000000001', 'PerformIQ Enterprise', 'performiq-corp', '{"enforce_mfa": false, "dispute_window_days": 7}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (id, tenant_id, name)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Engineering'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'People Operations'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Product Management'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Design & UX')
ON CONFLICT DO NOTHING;

INSERT INTO public.review_templates (id, tenant_id, name, version, scale_min, scale_max, weights)
VALUES ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Standard Enterprise Performance Template (60/30/10)', 1, 1.0, 5.0, '{"goals": 60, "competencies": 30, "values": 10}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.review_cycles (id, tenant_id, name, stage, start_date, end_date, template_id, weights)
VALUES 
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2026-H1 Annual Performance & Growth Review', 'calibration', '2026-01-01', '2026-06-30', '20000000-0000-0000-0000-000000000001', '{"goals": 60, "competencies": 30, "values": 10}'::jsonb),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2025-H2 Year-End Appraisal Cycle', 'released', '2025-07-01', '2025-12-31', '20000000-0000-0000-0000-000000000001', '{"goals": 60, "competencies": 30, "values": 10}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.competencies (tenant_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Technical Execution & Architecture', 'Delivers robust, secure, and maintainable systems aligned with technical standards.'),
  ('00000000-0000-0000-0000-000000000001', 'Ownership & Reliability', 'Takes proactive responsibility for end-to-end delivery and system quality.'),
  ('00000000-0000-0000-0000-000000000001', 'Collaboration & Team Multiplier', 'Elevates team velocity, mentors peers, and fosters an inclusive environment.'),
  ('00000000-0000-0000-0000-000000000001', 'Customer Focus & Business Impact', 'Prioritizes value delivery and user experience in every technical decision.')
ON CONFLICT DO NOTHING;

