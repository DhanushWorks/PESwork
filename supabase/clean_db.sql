-- ============================================================================
-- PerformIQ - Clean Database & Fix RLS Policies
-- ============================================================================
-- Run this in your Supabase SQL Editor:
-- 1. Cleans all demo cycles and review records (0 cycles, 0 goals, 0 reviews)
-- 2. Preserves all profiles (Admin Eleanor Vance, Manager Marcus Chen, Employee Alex Rivera + registered accounts)
-- 3. Configures Row Level Security (RLS) policies so you can create, edit, and delete cycles from the UI without permission errors.
-- ============================================================================

-- STEP 1: Purge all demo cycles, participants, goals, and evaluation records
DELETE FROM public.cycle_participants;
DELETE FROM public.goals;
DELETE FROM public.goal_updates;
DELETE FROM public.goal_change_requests;
DELETE FROM public.self_assessments;
DELETE FROM public.manager_reviews;
DELETE FROM public.calibrations;
DELETE FROM public.final_results;
DELETE FROM public.feedback;
DELETE FROM public.notifications;
DELETE FROM public.audit_logs;
DELETE FROM public.review_cycles;

-- STEP 2: Ensure baseline profiles exist (without altering any registered users)
INSERT INTO public.profiles (id, tenant_id, name, email, employee_code, role, designation, department, avatar, active)
VALUES 
  (
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
  ),
  (
    '11111111-1111-1111-1111-111111111102',
    '00000000-0000-0000-0000-000000000001',
    'Marcus Chen',
    'marcus.chen@performiq.internal',
    'EMP-002',
    'manager',
    'Engineering Director',
    'Engineering',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    true
  ),
  (
    '11111111-1111-1111-1111-111111111101',
    '00000000-0000-0000-0000-000000000001',
    'Alex Rivera',
    'alex.rivera@performiq.internal',
    'EMP-003',
    'employee',
    'Senior Frontend Engineer',
    'Engineering',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    true
  )
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  role = EXCLUDED.role, 
  designation = EXCLUDED.designation, 
  department = EXCLUDED.department;

-- Set up manager relationships
UPDATE public.profiles SET manager_id = '11111111-1111-1111-1111-111111111103' WHERE id = '11111111-1111-1111-1111-111111111102';
UPDATE public.profiles SET manager_id = '11111111-1111-1111-1111-111111111102' WHERE id = '11111111-1111-1111-1111-111111111101';

-- STEP 3: Fix RLS policies to allow full CRUD operations from UI
DROP POLICY IF EXISTS "review_cycles_select" ON public.review_cycles;
DROP POLICY IF EXISTS "review_cycles_all" ON public.review_cycles;
CREATE POLICY "review_cycles_all" ON public.review_cycles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cycle_participants_select" ON public.cycle_participants;
DROP POLICY IF EXISTS "cycle_participants_all" ON public.cycle_participants;
CREATE POLICY "cycle_participants_all" ON public.cycle_participants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "templates_all" ON public.review_templates;
CREATE POLICY "templates_all" ON public.review_templates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "goals_select" ON public.goals;
DROP POLICY IF EXISTS "goals_insert" ON public.goals;
DROP POLICY IF EXISTS "goals_update" ON public.goals;
DROP POLICY IF EXISTS "goals_delete" ON public.goals;
DROP POLICY IF EXISTS "goals_all" ON public.goals;
CREATE POLICY "goals_all" ON public.goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "goal_updates_select" ON public.goal_updates;
DROP POLICY IF EXISTS "goal_updates_insert" ON public.goal_updates;
DROP POLICY IF EXISTS "goal_updates_all" ON public.goal_updates;
CREATE POLICY "goal_updates_all" ON public.goal_updates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "goal_change_requests_all" ON public.goal_change_requests;
CREATE POLICY "goal_change_requests_all" ON public.goal_change_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "self_assessments_all" ON public.self_assessments;
CREATE POLICY "self_assessments_all" ON public.self_assessments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "manager_reviews_all" ON public.manager_reviews;
CREATE POLICY "manager_reviews_all" ON public.manager_reviews FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "calibrations_all" ON public.calibrations;
CREATE POLICY "calibrations_all" ON public.calibrations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "final_results_all" ON public.final_results;
CREATE POLICY "final_results_all" ON public.final_results FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_all" ON public.feedback;
CREATE POLICY "feedback_all" ON public.feedback FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
CREATE POLICY "notifications_all" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_all" ON public.audit_logs;
CREATE POLICY "audit_logs_all" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);


DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_all" ON public.profiles;
CREATE POLICY "profiles_all" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

