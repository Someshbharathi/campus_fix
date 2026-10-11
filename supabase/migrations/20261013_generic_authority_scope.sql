-- Add explicit authority scope. Existing authority accounts are the generic
-- hackathon account; future department-specific accounts can use assigned_department.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS authority_scope text NOT NULL DEFAULT 'assigned_department';

UPDATE public.profiles
SET authority_scope = 'all_departments'
WHERE role = 'department_authority';

DO $scope_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_authority_scope_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_authority_scope_check
      CHECK (authority_scope IN ('all_departments', 'assigned_department')) NOT VALID;
    ALTER TABLE public.profiles
      VALIDATE CONSTRAINT profiles_authority_scope_check;
  END IF;
END
$scope_constraint$;

CREATE OR REPLACE FUNCTION public.campusfix_authority_issue_fence(
  p_department text,
  p_verification_status text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT public.campusfix_current_role() <> 'department_authority'
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'department_authority'
        AND p_verification_status IN ('pending', 'approved')
        AND p_department IS NOT NULL
        AND (
          p.authority_scope = 'all_departments'
          OR (p.authority_scope = 'assigned_department' AND p.department = p_department)
        )
    )
$function$;

REVOKE ALL ON FUNCTION public.campusfix_authority_issue_fence(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_authority_issue_fence(text, text) TO authenticated;

-- Replace every department-specific permissive policy. The restrictive fence
-- above remains the final authorization check for every operation.
DROP POLICY IF EXISTS campusfix_authority_read_department_queue ON public.issues;
CREATE POLICY campusfix_authority_read_department_queue ON public.issues
  FOR SELECT TO authenticated
  USING (
    public.campusfix_current_role() = 'department_authority'
    AND public.campusfix_authority_issue_fence(assigned_department, verification_status)
  );

DROP POLICY IF EXISTS campusfix_authority_update_department_queue ON public.issues;
CREATE POLICY campusfix_authority_update_department_queue ON public.issues
  FOR UPDATE TO authenticated
  USING (
    public.campusfix_current_role() = 'department_authority'
    AND public.campusfix_authority_issue_fence(assigned_department, verification_status)
  )
  WITH CHECK (
    public.campusfix_current_role() = 'department_authority'
    AND public.campusfix_authority_issue_fence(assigned_department, verification_status)
  );

DROP POLICY IF EXISTS campusfix_history_read ON public.campusfix_issue_status_history;
CREATE POLICY campusfix_history_read ON public.campusfix_issue_status_history
  FOR SELECT TO authenticated USING (
    public.campusfix_current_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.issues i
      WHERE i.id = campusfix_issue_status_history.issue_id
        AND (
          (public.campusfix_current_role() = 'student' AND i.reporter_id = auth.uid())
          OR (public.campusfix_current_role() = 'department_authority'
            AND public.campusfix_authority_issue_fence(i.assigned_department, i.verification_status))
        )
    )
  );

-- Preserve authenticated actor checks, legal transitions, required comments,
-- and the same-transaction status history insert from the existing atomic RPC.
CREATE OR REPLACE FUNCTION public.update_issue_status_atomic(
  p_issue_id uuid,
  p_new_status text,
  p_comment text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_issue public.issues%ROWTYPE;
  v_old_status text;
  v_history public.campusfix_issue_status_history%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_new_status IS NULL OR p_new_status NOT IN ('in_progress', 'resolved') THEN
    RAISE EXCEPTION 'Invalid target status';
  END IF;
  IF p_comment IS NULL OR length(btrim(p_comment)) = 0 THEN
    RAISE EXCEPTION 'A comment is required';
  END IF;
  IF length(p_comment) > 2000 THEN
    RAISE EXCEPTION 'Comment is too long';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'department_authority') THEN
    RAISE EXCEPTION 'Department authority access required';
  END IF;

  SELECT * INTO v_issue FROM public.issues WHERE id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Complaint not found or access denied';
  END IF;
  IF v_issue.verification_status IS NULL OR v_issue.verification_status NOT IN ('pending', 'approved') THEN
    RAISE EXCEPTION 'Complaint is not eligible for department work';
  END IF;
  IF v_role = 'department_authority' AND NOT public.campusfix_authority_issue_fence(
    v_issue.assigned_department, v_issue.verification_status
  ) THEN
    RAISE EXCEPTION 'Department authority access required';
  END IF;
  IF p_new_status = 'in_progress' AND v_issue.status NOT IN ('assigned', 'in_progress') THEN
    RAISE EXCEPTION 'Invalid status transition';
  END IF;
  IF p_new_status = 'resolved' AND v_issue.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Invalid status transition';
  END IF;
  v_old_status := v_issue.status;

  UPDATE public.issues
  SET status = p_new_status,
      updated_at = now(),
      resolved_at = CASE WHEN p_new_status = 'resolved' THEN now() ELSE resolved_at END
  WHERE id = p_issue_id
  RETURNING * INTO v_issue;

  INSERT INTO public.campusfix_issue_status_history(issue_id, actor_id, old_status, new_status, comment)
  VALUES (p_issue_id, auth.uid(), v_old_status, p_new_status, btrim(p_comment))
  RETURNING * INTO v_history;

  RETURN jsonb_build_object('issue', to_jsonb(v_issue), 'history', to_jsonb(v_history));
END
$function$;

REVOKE ALL ON FUNCTION public.update_issue_status_atomic(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_issue_status_atomic(uuid, text, text, uuid) TO authenticated;

COMMIT;

-- Verify after applying:
-- SELECT role, authority_scope, department FROM public.profiles WHERE role = 'department_authority';
-- SELECT policyname, qual, with_check FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('issues', 'campusfix_issue_status_history');
