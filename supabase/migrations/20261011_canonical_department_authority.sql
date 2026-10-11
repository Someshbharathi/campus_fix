-- CampusFix role normalization. Review the preflight query below before running
-- the migration. This script intentionally does not execute the status RPC.
-- Its implementation/history table are not represented in this repository.

-- PREFLIGHT (run separately in Supabase SQL Editor and inspect the results):
-- SELECT table_name, column_name, data_type, udt_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('profiles', 'issues');
-- SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid)
-- FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public';
-- SELECT p.oid::regprocedure AS signature, pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'update_issue_status_atomic';

BEGIN;

DO $migration$
DECLARE
  role_type text;
  constraint_row record;
BEGIN
  SELECT data_type INTO role_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role';

  IF role_type IS NULL THEN
    RAISE EXCEPTION 'Expected public.profiles.role; inspect the schema before applying.';
  END IF;
  IF role_type <> 'text' AND role_type <> 'character varying' THEN
    RAISE EXCEPTION 'profiles.role is %, not text. Convert its enum/type with a reviewed migration first.', role_type;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass AND c.contype = 'c'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND a.attname = 'role'
      )
      AND cardinality(c.conkey) <> 1
  ) THEN
    RAISE EXCEPTION 'A CHECK constraint combines role with other columns. Review and migrate that constraint manually.';
  END IF;

  -- Replace only CHECK constraints that validate the role column.
  FOR constraint_row IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'c'
      AND a.attname = 'role'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;

  -- Convert legacy names after removing the old role check, then constrain the
  -- canonical values. IDs, departments, and all other profile fields survive.
  UPDATE public.profiles
  SET role = 'department_authority'
  WHERE role IN ('faculty', 'authority');

  UPDATE public.profiles
  SET department = CASE department
    WHEN 'Electrical Maintenance' THEN 'Electrical'
    WHEN 'Plumbing & Water Works' THEN 'Plumbing'
    WHEN 'Cleanliness & Sanitation' THEN 'Cleanliness'
    WHEN 'Infrastructure & Civil Maintenance' THEN 'Infrastructure'
    WHEN 'IT & Network Support' THEN 'IT Support'
    WHEN 'Equipment & Laboratory Maintenance' THEN 'Equipment'
    ELSE department END
  WHERE role = 'department_authority';

  UPDATE public.issues
  SET assigned_department = CASE assigned_department
    WHEN 'Electrical Maintenance' THEN 'Electrical'
    WHEN 'Plumbing & Water Works' THEN 'Plumbing'
    WHEN 'Cleanliness & Sanitation' THEN 'Cleanliness'
    WHEN 'Infrastructure & Civil Maintenance' THEN 'Infrastructure'
    WHEN 'IT & Network Support' THEN 'IT Support'
    WHEN 'Equipment & Laboratory Maintenance' THEN 'Equipment'
    ELSE assigned_department END
  WHERE assigned_department IN (
    'Electrical Maintenance', 'Plumbing & Water Works', 'Cleanliness & Sanitation',
    'Infrastructure & Civil Maintenance', 'IT & Network Support',
    'Equipment & Laboratory Maintenance'
  );

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_canonical_check
    CHECK (role IN ('student', 'department_authority', 'admin')) NOT VALID;
  ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_role_canonical_check;
END
$migration$;

-- Rewrite role-name references in policies in place, retaining their target,
-- command, permissive mode, roles, and predicates. Policies with expressions
-- that cannot be safely reconstructed will abort the transaction for review.
DO $policies$
DECLARE
  p record;
  cmd text;
  roles_sql text;
  qual_sql text;
  check_sql text;
BEGIN
  FOR p IN
    SELECT * FROM pg_policies
    WHERE schemaname = 'public'
      AND concat_ws(' ', qual, with_check) ~* '''(faculty|authority)'''
  LOOP
    roles_sql := array_to_string(ARRAY(
      SELECT CASE WHEN r = 'PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r) END
      FROM unnest(p.roles) AS r
    ), ', ');
    cmd := CASE p.cmd WHEN 'ALL' THEN 'ALL' WHEN 'SELECT' THEN 'SELECT'
      WHEN 'INSERT' THEN 'INSERT' WHEN 'UPDATE' THEN 'UPDATE' WHEN 'DELETE' THEN 'DELETE'
      ELSE NULL END;
    IF cmd IS NULL OR roles_sql IS NULL THEN
      RAISE EXCEPTION 'Cannot safely reconstruct policy %.%', p.tablename, p.policyname;
    END IF;
    qual_sql := CASE WHEN p.qual IS NULL THEN NULL
      ELSE replace(replace(p.qual, '''faculty''', '''department_authority'''), '''authority''', '''department_authority''') END;
    check_sql := CASE WHEN p.with_check IS NULL THEN NULL
      ELSE replace(replace(p.with_check, '''faculty''', '''department_authority'''), '''authority''', '''department_authority''') END;
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname, p.schemaname, p.tablename,
      CASE WHEN p.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd, roles_sql,
      CASE WHEN qual_sql IS NULL THEN '' ELSE format(' USING (%s)', qual_sql) END,
      CASE WHEN check_sql IS NULL THEN '' ELSE format(' WITH CHECK (%s)', check_sql) END);
  END LOOP;
END
$policies$;

-- Update role comparisons in public SQL functions while preserving their
-- signatures, security mode, and all other function logic.
DO $functions$
DECLARE f record; definition text; rewritten text;
BEGIN
  FOR f IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind IN ('f', 'p', 'w')
      AND pg_get_functiondef(p.oid) ~* '''(faculty|authority)'''
  LOOP
    definition := pg_get_functiondef(f.oid);
    rewritten := replace(replace(definition, '''faculty''', '''department_authority'''), '''authority''', '''department_authority''');
    EXECUTE rewritten;
  END LOOP;
END
$functions$;

-- A RESTRICTIVE policy adds a department and verification fence even when an
-- older permissive issue policy is broader. Admin and student policies retain
-- their existing behavior; a department authority can access only approved
-- issues assigned to their own profile department.
CREATE OR REPLACE FUNCTION public.campusfix_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION public.campusfix_authority_issue_fence(
  p_department text,
  p_verification_status text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT public.campusfix_current_role() <> 'department_authority'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'department_authority'
        AND p.department = p_department
        AND p_verification_status IN ('pending', 'approved')
    )
$function$;

REVOKE ALL ON FUNCTION public.campusfix_current_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.campusfix_authority_issue_fence(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.campusfix_authority_issue_fence(text, text) TO authenticated;

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS campusfix_authority_department_fence ON public.issues;
CREATE POLICY campusfix_authority_department_fence ON public.issues
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.campusfix_authority_issue_fence(assigned_department, verification_status))
  WITH CHECK (public.campusfix_authority_issue_fence(assigned_department, verification_status));

COMMIT;

-- POSTCHECK:
-- SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY role;
-- SELECT schemaname, tablename, policyname, qual, with_check
-- FROM pg_policies WHERE schemaname = 'public';
-- Re-run the function definition query above and review
-- update_issue_status_atomic for auth.uid(), department equality, and approved
-- or pending nonsensitive issues in the department-first queue
-- verification state, legal transitions, and atomic history insertion before
-- enabling department-authority status updates.
