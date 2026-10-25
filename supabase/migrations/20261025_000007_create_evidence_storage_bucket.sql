-- ============================================================================
-- PerformIQ — Migration 20261025_000007: Evidence Storage Bucket Setup
-- Purpose: Ensures the 'evidence' storage bucket and public/authenticated policies exist.
-- ============================================================================

-- 1. Create or update the 'evidence' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence',
  'evidence',
  true,
  20971520, -- 20MB limit
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520;

-- 2. Drop existing policies to prevent conflicts if re-run
DROP POLICY IF EXISTS "Public Read Evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload Evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update Evidence" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete Evidence" ON storage.objects;

-- 3. Storage Policies
CREATE POLICY "Public Read Evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'evidence');

CREATE POLICY "Allow Upload Evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'evidence');

CREATE POLICY "Allow Update Evidence"
ON storage.objects FOR UPDATE
USING (bucket_id = 'evidence');

CREATE POLICY "Allow Delete Evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'evidence');

