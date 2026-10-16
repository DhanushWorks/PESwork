-- ============================================================================
-- PerformIQ — Supabase Auth User Profile Creation Trigger
-- Automatically syncs auth.users registrations to public.profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tenant_id UUID;
  v_role TEXT;
  v_name TEXT;
  v_department TEXT;
  v_designation TEXT;
BEGIN
  -- Default to first tenant
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN
    v_tenant_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

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

-- Drop existing trigger if any, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

