-- ============================================================================
-- PerformIQ — Migration 20261025_000008: Goal Updates RLS Policies
-- Purpose: Ensures authenticated and anon users can update and delete goal_updates records.
-- ============================================================================

DROP POLICY IF EXISTS "goal_updates_all" ON public.goal_updates;
DROP POLICY IF EXISTS "goal_updates_update" ON public.goal_updates;
DROP POLICY IF EXISTS "goal_updates_delete" ON public.goal_updates;

CREATE POLICY "goal_updates_all" ON public.goal_updates
  FOR ALL USING (true) WITH CHECK (true);

