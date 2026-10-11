-- Allow authenticated students to create an issue only for their own profile.
-- This is intentionally narrow: it does not grant students update/delete access
-- or change department-authority/admin policies.

BEGIN;

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- This returns only the caller's own JWT subject. The API uses it to verify
-- that the PostgREST request sees the same auth.uid() as Supabase Auth.
CREATE OR REPLACE FUNCTION public.campusfix_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT auth.uid()
$function$;
REVOKE ALL ON FUNCTION public.campusfix_current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_current_user_id() TO authenticated;

-- Read the caller's role without depending on profiles SELECT policies. The
-- function is pinned to a safe search_path and returns only the caller's role.
CREATE OR REPLACE FUNCTION public.campusfix_current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$function$;
REVOKE ALL ON FUNCTION public.campusfix_current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_current_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.campusfix_current_department()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT department FROM public.profiles WHERE id = auth.uid()
$function$;
REVOKE ALL ON FUNCTION public.campusfix_current_department() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_current_department() TO authenticated;

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
  SELECT CASE
    WHEN public.campusfix_current_role() = 'department_authority' THEN EXISTS (
      SELECT 1 FROM public.profiles AS authority_profile
      WHERE authority_profile.id = auth.uid()
        AND authority_profile.role = 'department_authority'
        AND authority_profile.department = p_department
        AND p_verification_status IN ('pending', 'approved')
    )
    ELSE public.campusfix_current_role() IN ('student', 'admin')
  END
$function$;
REVOKE ALL ON FUNCTION public.campusfix_authority_issue_fence(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_authority_issue_fence(text, text) TO authenticated;

-- Students can read only their own rows. INSERT ... RETURNING also requires a
-- SELECT policy on the returned row, which is why this accompanies INSERT.
DROP POLICY IF EXISTS campusfix_student_read_own_issues ON public.issues;
CREATE POLICY campusfix_student_read_own_issues
  ON public.issues
  FOR SELECT
  TO authenticated
  USING (
    reporter_id = (SELECT auth.uid())
    AND public.campusfix_current_role() = 'student'
  );

-- Replace only the policy with this migration's known name. Other existing
-- policies (including restrictive policies) remain in place.
DROP POLICY IF EXISTS campusfix_student_create_own_issues ON public.issues;

CREATE POLICY campusfix_student_create_own_issues
  ON public.issues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reporter_id = (SELECT auth.uid())
    AND public.campusfix_current_role() = 'student'
  );

-- Restrictive fencing prevents a broader legacy permissive policy from
-- exposing another department's complaints or sensitive/rejected rows.
DROP POLICY IF EXISTS campusfix_authority_department_fence ON public.issues;
CREATE POLICY campusfix_authority_department_fence
  ON public.issues
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (public.campusfix_authority_issue_fence(assigned_department, verification_status))
  WITH CHECK (public.campusfix_authority_issue_fence(assigned_department, verification_status));

DROP POLICY IF EXISTS campusfix_authority_read_department_queue ON public.issues;
CREATE POLICY campusfix_authority_read_department_queue
  ON public.issues
  FOR SELECT
  TO authenticated
  USING (
    public.campusfix_current_role() = 'department_authority'
    AND assigned_department = public.campusfix_current_department()
    AND verification_status IN ('pending', 'approved')
  );

DROP POLICY IF EXISTS campusfix_admin_read_all_issues ON public.issues;
CREATE POLICY campusfix_admin_read_all_issues
  ON public.issues
  FOR SELECT
  TO authenticated
  USING (public.campusfix_current_role() = 'admin');

COMMIT;

-- Verify the policy definition after applying:
-- SELECT policyname, permissive, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename = 'issues'
-- ORDER BY policyname;
--
-- Inspect all issue constraints, including CHECK and FOREIGN KEY constraints:
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.issues'::regclass
-- ORDER BY contype, conname;
--
-- Inspect NOT NULL columns and their defaults:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'issues'
-- ORDER BY ordinal_position;
--
-- Inspect triggers that may rewrite/validate inserted rows:
-- SELECT tgname, pg_get_triggerdef(oid)
-- FROM pg_trigger
-- WHERE tgrelid = 'public.issues'::regclass AND NOT tgisinternal
-- ORDER BY tgname;
