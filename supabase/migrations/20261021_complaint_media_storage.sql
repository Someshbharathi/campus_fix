-- Private, single-attachment storage for student complaints.
-- Complaint ownership and the existing issues RLS policies remain authoritative.
BEGIN;

DO $preflight$
DECLARE
  existing_bucket record;
BEGIN
  IF to_regclass('public.issues') IS NULL
     OR to_regclass('public.profiles') IS NULL
     OR to_regclass('storage.objects') IS NULL
     OR to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'Expected public issue/profile tables and Supabase Storage tables.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    WHERE c.oid = 'storage.objects'::regclass AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Supabase Storage RLS must already be enabled on storage.objects.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'image_path' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Expected public.issues.image_path as text; inspect the live schema before applying.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'reporter_id' AND data_type = 'uuid'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'assigned_department'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'verification_status'
  ) THEN
    RAISE EXCEPTION 'Issue ownership, department, or verification fields are incompatible.';
  END IF;
  IF to_regprocedure('public.campusfix_current_role()') IS NULL
     OR to_regprocedure('public.campusfix_authority_issue_fence(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Expected the existing CampusFix role and authority-scope helpers.';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.campusfix_current_role()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.campusfix_authority_issue_fence(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authenticated users need the existing helper EXECUTE grants for storage reads.';
  END IF;

  SELECT b.id, b.public, b.file_size_limit, b.allowed_mime_types
    INTO existing_bucket
  FROM storage.buckets AS b
  WHERE b.id = 'campusfix-complaint-media';
  IF FOUND AND (
    existing_bucket.public IS DISTINCT FROM false
    OR existing_bucket.file_size_limit IS DISTINCT FROM 52428800::bigint
    OR existing_bucket.allowed_mime_types IS DISTINCT FROM ARRAY[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'
    ]::text[]
  ) THEN
    RAISE EXCEPTION 'The complaint media bucket already exists with different settings; inspect it before applying.';
  END IF;

  -- Existing broad policies are ORed with this migration's scoped policies.
  -- Abort if a generic policy could independently grant access to this bucket.
  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname NOT IN (
        'campusfix_complaint_media_read',
        'campusfix_complaint_media_insert',
        'campusfix_complaint_media_delete'
      )
      AND p.roles && ARRAY['public', 'anon', 'authenticated']::name[]
      AND (
        (p.cmd IN ('SELECT', 'ALL') AND (p.qual IS NULL OR
          p.qual NOT ILIKE '%campusfix-complaint-media%'))
        OR (p.cmd IN ('INSERT', 'UPDATE', 'ALL') AND (p.with_check IS NULL OR
          p.with_check NOT ILIKE '%campusfix-complaint-media%'))
        OR (p.cmd = 'DELETE' AND (p.qual IS NULL OR
          p.qual NOT ILIKE '%campusfix-complaint-media%'))
      )
  ) THEN
    RAISE EXCEPTION 'A generic storage.objects policy may grant broader access; inspect Storage policies before applying.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
      AND p.policyname IN (
        'campusfix_complaint_media_read',
        'campusfix_complaint_media_insert',
        'campusfix_complaint_media_delete'
      )
      AND obj_description((SELECT pol.oid FROM pg_policy pol
        WHERE pol.polrelid = 'storage.objects'::regclass AND pol.polname = p.policyname), 'pg_policy')
        IS DISTINCT FROM 'CampusFix private complaint media policy v1'
  ) THEN
    RAISE EXCEPTION 'A CampusFix complaint media policy name is already used by an unreviewed policy.';
  END IF;
END;
$preflight$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campusfix-complaint-media',
  'campusfix-complaint-media',
  false,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DO $policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'campusfix_complaint_media_insert'
  ) THEN
    CREATE POLICY campusfix_complaint_media_insert ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'campusfix-complaint-media'
        AND public.campusfix_current_role() = 'student'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    COMMENT ON POLICY campusfix_complaint_media_insert ON storage.objects
      IS 'CampusFix private complaint media policy v1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'campusfix_complaint_media_delete'
  ) THEN
    CREATE POLICY campusfix_complaint_media_delete ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'campusfix-complaint-media'
        AND public.campusfix_current_role() = 'student'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    COMMENT ON POLICY campusfix_complaint_media_delete ON storage.objects
      IS 'CampusFix private complaint media policy v1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'campusfix_complaint_media_read'
  ) THEN
    CREATE POLICY campusfix_complaint_media_read ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'campusfix-complaint-media'
        AND EXISTS (
          SELECT 1 FROM public.issues i
          WHERE i.image_path = storage.objects.name
            AND (
              public.campusfix_current_role() = 'admin'
              OR (public.campusfix_current_role() = 'student'
                  AND i.reporter_id = auth.uid())
              OR (public.campusfix_current_role() = 'department_authority'
                  AND public.campusfix_authority_issue_fence(
                    i.assigned_department, i.verification_status))
            )
        )
      );
    COMMENT ON POLICY campusfix_complaint_media_read ON storage.objects
      IS 'CampusFix private complaint media policy v1';
  END IF;
END;
$policies$;

COMMIT;

-- Read-only verification after manual application:
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets WHERE id = 'campusfix-complaint-media';
-- SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
-- FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname LIKE 'campusfix_complaint_media_%';
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'issues' AND column_name = 'image_path';
