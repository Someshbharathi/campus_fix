-- Minimal prerequisites for the AI category/similarity migration.
-- This migration deliberately does not modify issue policies, status RPCs,
-- issue_updates, or authority_scope values. It does not create history tables.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.issues') IS NULL THEN
    RAISE EXCEPTION 'Expected public.profiles and public.issues; inspect the live schema first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'authority_scope' AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'Expected text public.profiles.authority_scope; apply/review its migration first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name = 'department'
  ) THEN
    RAISE EXCEPTION 'Expected public.profiles.department; inspect the live schema first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'assigned_department'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'verification_status'
  ) THEN
    RAISE EXCEPTION 'Expected issue department and verification columns; inspect the live schema first.';
  END IF;
  IF to_regprocedure('public.campusfix_current_role()') IS NOT NULL
     OR to_regprocedure('public.campusfix_authority_issue_fence(text,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'A helper already exists; inspect its complete definition and grants before changing it.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    RAISE EXCEPTION 'Expected the trusted Supabase postgres role for SECURITY DEFINER ownership.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'ai_category'
  ) THEN
    RAISE EXCEPTION 'ai_category already exists; inspect its type, constraints, and data before proceeding.';
  END IF;
END
$preflight$;

-- Add the rich AI category ID separately from the existing canonical category.
-- Migration 20261014 supplies the controlled mapping/backfill.
ALTER TABLE public.issues
  ADD COLUMN ai_category text;

-- Read only the caller's role from the authoritative profile row.
CREATE FUNCTION public.campusfix_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
$function$;

ALTER FUNCTION public.campusfix_current_role() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.campusfix_current_role() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.campusfix_current_role() TO authenticated;

-- The helper permits a non-authority through so callers can combine it with
-- role-specific checks. For department authorities it requires an eligible
-- verification state, non-null issue department, and the stored scope rule.
CREATE FUNCTION public.campusfix_authority_issue_fence(
  p_department text,
  p_verification_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.campusfix_current_role() = 'admin' THEN true
    -- The student pass-through is only for restrictive issue fences; the
    -- caller's student-specific permissive policy must still limit rows to
    -- reporter_id = auth.uid().
    WHEN public.campusfix_current_role() = 'student' THEN true
    WHEN public.campusfix_current_role() = 'department_authority' THEN EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.role = 'department_authority'
        AND p_verification_status IN ('pending', 'approved')
        AND p_department IS NOT NULL
        AND (
          p.authority_scope = 'all_departments'
          OR (p.authority_scope = 'assigned_department'
              AND p.department = p_department)
        )
    )
    ELSE false
  END
$function$;

ALTER FUNCTION public.campusfix_authority_issue_fence(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.campusfix_authority_issue_fence(text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.campusfix_authority_issue_fence(text, text)
  TO authenticated;

COMMIT;

-- Read-only verification after manual application:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'issues'
--   AND column_name = 'ai_category';
-- SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
--        pg_get_userbyid(p.proowner) AS owner,
--        p.proconfig AS settings, p.proacl AS acl,
--        pg_get_functiondef(p.oid) AS definition
-- FROM pg_proc AS p
-- JOIN pg_namespace AS n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('campusfix_current_role', 'campusfix_authority_issue_fence')
-- ORDER BY p.proname;
-- SELECT role, authority_scope, department, count(*) AS profile_count
-- FROM public.profiles
-- GROUP BY role, authority_scope, department
-- ORDER BY role, authority_scope, department;
-- SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
-- FROM pg_constraint AS c
-- WHERE c.conrelid = 'public.profiles'::regclass
--   AND c.conname = 'profiles_authority_scope_check';
