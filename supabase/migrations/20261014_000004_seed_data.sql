-- ============================================================================
-- PerformIQ — Fictional Enterprise Seed Data
-- ============================================================================

-- 1. Insert Default Tenant
INSERT INTO public.tenants (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PerformIQ Enterprise',
  'performiq-corp',
  '{"enforce_mfa": false, "dispute_window_days": 7}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Departments
INSERT INTO public.departments (id, tenant_id, name)
VALUES 
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Engineering'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'People Operations'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Product Management'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Design & UX')
ON CONFLICT DO NOTHING;

-- 3. Insert Review Template
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

-- 4. Insert Review Cycles
INSERT INTO public.review_cycles (id, tenant_id, name, stage, start_date, end_date, template_id, weights)
VALUES 
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '2026-H1 Annual Performance & Growth Review',
    'calibration',
    '2026-01-01',
    '2026-06-30',
    '20000000-0000-0000-0000-000000000001',
    '{"goals": 60, "competencies": 30, "values": 10}'::jsonb
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '2025-H2 Year-End Appraisal Cycle',
    'released',
    '2025-07-01',
    '2025-12-31',
    '20000000-0000-0000-0000-000000000001',
    '{"goals": 60, "competencies": 30, "values": 10}'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Core Competencies
INSERT INTO public.competencies (tenant_id, name, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Technical Execution & Architecture', 'Delivers robust, secure, and maintainable systems aligned with technical standards.'),
  ('00000000-0000-0000-0000-000000000001', 'Ownership & Reliability', 'Takes proactive responsibility for end-to-end delivery and system quality.'),
  ('00000000-0000-0000-0000-000000000001', 'Collaboration & Team Multiplier', 'Elevates team velocity, mentors peers, and fosters an inclusive environment.'),
  ('00000000-0000-0000-0000-000000000001', 'Customer Focus & Business Impact', 'Prioritizes value delivery and user experience in every technical decision.')
ON CONFLICT DO NOTHING;

