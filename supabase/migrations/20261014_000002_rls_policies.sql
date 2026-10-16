-- ============================================================================
-- PerformIQ — Row Level Security (RLS) Migration
-- Enforces Strict Tenant Isolation & Role Hierarchy
-- ============================================================================

-- Enable RLS across all tables
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

-- ----------------------------------------------------------------------------
-- Security Helper Functions (SECURITY DEFINER with fixed search_path)
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- 1. Profiles Policies
-- ----------------------------------------------------------------------------
-- Users can read profiles in the same tenant (directory view)
CREATE POLICY "profiles_select_same_tenant" ON public.profiles
  FOR SELECT USING (tenant_id = public.current_tenant_id());

-- Users can update their own display fields
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND tenant_id = public.current_tenant_id());

-- Admins can update any profile in their tenant
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.is_admin() AND tenant_id = public.current_tenant_id());

-- ----------------------------------------------------------------------------
-- 2. Review Cycles & Templates Policies
-- ----------------------------------------------------------------------------
-- Any employee in the tenant can view cycles and templates
CREATE POLICY "review_cycles_select" ON public.review_cycles
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "review_cycles_admin_all" ON public.review_cycles
  FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());

CREATE POLICY "review_templates_select" ON public.review_templates
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "review_templates_admin_all" ON public.review_templates
  FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());

-- ----------------------------------------------------------------------------
-- 3. Goals Policies
-- ----------------------------------------------------------------------------
-- Employees can view their own goals; Managers can view their direct reports' goals; Admins can view all
CREATE POLICY "goals_select" ON public.goals
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND (
      user_id = auth.uid() OR
      public.is_manager_of(user_id) OR
      public.is_admin()
    )
  );

-- Employees can insert/update their own goals if draft or returned
CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    tenant_id = public.current_tenant_id()
  );

CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE USING (
    user_id = auth.uid() AND status IN ('draft', 'returned')
  ) WITH CHECK (
    user_id = auth.uid() AND tenant_id = public.current_tenant_id()
  );

-- Managers can update goal status (approve/return)
CREATE POLICY "goals_manager_decide" ON public.goals
  FOR UPDATE USING (
    public.is_manager_of(user_id)
  ) WITH CHECK (
    public.is_manager_of(user_id) AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 4. Goal Updates Policies (Progress logs)
-- ----------------------------------------------------------------------------
CREATE POLICY "goal_updates_select" ON public.goal_updates
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND (
      user_id = auth.uid() OR
      public.is_manager_of(user_id) OR
      public.is_admin()
    )
  );

CREATE POLICY "goal_updates_insert_own" ON public.goal_updates
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 5. Self Assessments Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "self_assessments_select" ON public.self_assessments
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND (
      user_id = auth.uid() OR
      public.is_manager_of(user_id) OR
      public.is_admin()
    )
  );

CREATE POLICY "self_assessments_insert_own" ON public.self_assessments
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY "self_assessments_update_own" ON public.self_assessments
  FOR UPDATE USING (
    user_id = auth.uid() AND status = 'draft'
  ) WITH CHECK (
    user_id = auth.uid() AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 6. Manager Reviews Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "manager_reviews_select" ON public.manager_reviews
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND (
      reviewer_id = auth.uid() OR
      public.is_admin()
    )
  );

CREATE POLICY "manager_reviews_write" ON public.manager_reviews
  FOR ALL USING (
    tenant_id = public.current_tenant_id() AND (
      (reviewer_id = auth.uid() AND status = 'draft') OR
      public.is_admin()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Calibrations Policies (Admin Only)
-- ----------------------------------------------------------------------------
CREATE POLICY "calibrations_admin_only" ON public.calibrations
  FOR ALL USING (
    public.is_admin() AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 8. Final Results Policies (Barrier to unreleased scores)
-- ----------------------------------------------------------------------------
CREATE POLICY "final_results_select" ON public.final_results
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND (
      (user_id = auth.uid() AND status <> 'pending') OR
      public.is_admin() OR
      (public.is_manager_of(user_id) AND status <> 'pending')
    )
  );

CREATE POLICY "final_results_admin_write" ON public.final_results
  FOR ALL USING (
    public.is_admin() AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 9. Feedback & Kudos Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "feedback_select" ON public.feedback
  FOR SELECT USING (
    tenant_id = public.current_tenant_id() AND (
      NOT is_private OR
      sender_id = auth.uid() OR
      recipient_id = auth.uid() OR
      public.is_admin()
    )
  );

CREATE POLICY "feedback_insert" ON public.feedback
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 10. Notifications Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "notifications_user_access" ON public.notifications
  FOR ALL USING (
    user_id = auth.uid() AND tenant_id = public.current_tenant_id()
  );

-- ----------------------------------------------------------------------------
-- 11. Audit Logs Policies (Append-only, Admin read-only)
-- ----------------------------------------------------------------------------
CREATE POLICY "audit_logs_admin_select" ON public.audit_logs
  FOR SELECT USING (
    public.is_admin() AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY "audit_logs_insert_system" ON public.audit_logs
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

