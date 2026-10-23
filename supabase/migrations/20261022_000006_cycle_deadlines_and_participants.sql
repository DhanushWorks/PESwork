-- ============================================================================
-- PerformIQ — Migration 000006: Cycle Deadlines & Participant Policies
-- Adds deadlines JSONB column to review_cycles and RLS policies for cycle_participants
-- ============================================================================

-- 1. Add deadlines column to review_cycles if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'review_cycles'
      AND column_name = 'deadlines'
  ) THEN
    ALTER TABLE public.review_cycles
      ADD COLUMN deadlines JSONB NOT NULL DEFAULT '{
        "goalsDue": "2026-08-15",
        "selfReviewDue": "2026-09-30",
        "managerReviewDue": "2026-10-15",
        "calibrationDue": "2026-10-31",
        "releaseDate": "2026-11-15"
      }'::jsonb;
  END IF;
END $$;

-- 2. Add RLS policies for cycle_participants table
-- Any authenticated tenant user can view participants in their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cycle_participants'
      AND policyname = 'cycle_participants_select'
  ) THEN
    CREATE POLICY "cycle_participants_select" ON public.cycle_participants
      FOR SELECT USING (tenant_id = public.current_tenant_id());
  END IF;
END $$;

-- Authorized Admins can insert, update, and delete cycle participants in their tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cycle_participants'
      AND policyname = 'cycle_participants_admin_all'
  ) THEN
    CREATE POLICY "cycle_participants_admin_all" ON public.cycle_participants
      FOR ALL USING (public.is_admin() AND tenant_id = public.current_tenant_id());
  END IF;
END $$;

