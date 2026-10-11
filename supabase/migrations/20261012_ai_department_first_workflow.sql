-- Additive CampusFix workflow/AI fields and explicit row access policies.
-- Review the actual status RPC before applying: its definition/history schema
-- are not present in this repository, and this migration does not replace it.
-- Preflight also confirm public.issues.id is UUID and assigned_department exists.

BEGIN;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS priority_level text,
  ADD COLUMN IF NOT EXISTS priority_score integer,
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_safety smallint,
  ADD COLUMN IF NOT EXISTS ai_severity smallint,
  ADD COLUMN IF NOT EXISTS ai_urgency smallint,
  ADD COLUMN IF NOT EXISTS ai_frequency smallint,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS routing_exception boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

ALTER TABLE public.issues ALTER COLUMN assigned_department DROP NOT NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_priority_score_range') THEN
    ALTER TABLE public.issues ADD CONSTRAINT issues_priority_score_range
      CHECK (priority_score IS NULL OR priority_score BETWEEN 0 AND 100) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_priority_level_values') THEN
    ALTER TABLE public.issues ADD CONSTRAINT issues_priority_level_values
      CHECK (priority_level IS NULL OR priority_level IN ('low', 'medium', 'high', 'critical')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_ai_factors_range') THEN
    ALTER TABLE public.issues ADD CONSTRAINT issues_ai_factors_range CHECK (
      (ai_safety IS NULL OR ai_safety BETWEEN 0 AND 5) AND
      (ai_severity IS NULL OR ai_severity BETWEEN 0 AND 5) AND
      (ai_urgency IS NULL OR ai_urgency BETWEEN 0 AND 5) AND
      (ai_frequency IS NULL OR ai_frequency BETWEEN 0 AND 5)
    ) NOT VALID;
  END IF;
END
$constraints$;

-- The initial automatic assignment date equals creation time for existing
-- assigned work; newly created routed issues set it explicitly in API code.
UPDATE public.issues
SET assigned_at = created_at
WHERE assigned_department IS NOT NULL AND assigned_at IS NULL;
UPDATE public.issues SET priority_level = priority WHERE priority_level IS NULL;
UPDATE public.issues SET resolved_at = updated_at WHERE status = 'resolved' AND resolved_at IS NULL;

-- Recompute routing on every insert so direct client requests cannot choose a
-- department. Invalid category submissions are explicitly left unassigned.
CREATE OR REPLACE FUNCTION public.campusfix_route_issue_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF public.campusfix_current_role() IS DISTINCT FROM 'student' OR NEW.reporter_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only students may submit complaints for their own account.';
  END IF;

  IF NEW.routing_exception THEN
    NEW.assigned_department := NULL;
    NEW.assigned_at := NULL;
    NEW.status := 'reported';
  ELSE
    NEW.assigned_department := CASE NEW.category
      WHEN 'electrical' THEN 'Electrical'
      WHEN 'plumbing' THEN 'Plumbing'
      WHEN 'cleanliness' THEN 'Cleanliness'
      WHEN 'infrastructure' THEN 'Infrastructure'
      WHEN 'internet' THEN 'IT Support'
      WHEN 'equipment' THEN 'Equipment'
      WHEN 'other' THEN 'General Maintenance'
      ELSE NULL
    END;
    IF NEW.assigned_department IS NULL THEN
      NEW.routing_exception := true;
      NEW.assigned_at := NULL;
      NEW.status := 'reported';
    ELSE
      NEW.assigned_at := now();
      NEW.status := 'assigned';
    END IF;
  END IF;
  NEW.verification_status := 'pending';
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS campusfix_route_issue_on_insert ON public.issues;
CREATE TRIGGER campusfix_route_issue_on_insert
  BEFORE INSERT ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.campusfix_route_issue_on_insert();

CREATE OR REPLACE FUNCTION public.campusfix_current_department()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT department FROM public.profiles WHERE id = auth.uid()
$function$;

REVOKE ALL ON FUNCTION public.campusfix_current_department() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_current_department() TO authenticated;

-- Explicit permissive policies provide student-owned reads, department queue
-- reads, and campus-wide admin oversight. Restrictive fencing from the prior
-- migration keeps department authorities within their own pending/approved
-- queue even if an older permissive policy remains.
DROP POLICY IF EXISTS campusfix_student_read_own_issues ON public.issues;
CREATE POLICY campusfix_student_read_own_issues ON public.issues
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() AND public.campusfix_current_role() = 'student');

DROP POLICY IF EXISTS campusfix_student_create_own_issues ON public.issues;
CREATE POLICY campusfix_student_create_own_issues ON public.issues
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND public.campusfix_current_role() = 'student');

DROP POLICY IF EXISTS campusfix_authority_read_department_queue ON public.issues;
CREATE POLICY campusfix_authority_read_department_queue ON public.issues
  FOR SELECT TO authenticated
  USING (
    public.campusfix_current_role() = 'department_authority'
    AND assigned_department = public.campusfix_current_department()
    AND verification_status IN ('pending', 'approved')
  );

DROP POLICY IF EXISTS campusfix_authority_update_department_queue ON public.issues;
CREATE POLICY campusfix_authority_update_department_queue ON public.issues
  FOR UPDATE TO authenticated
  USING (
    public.campusfix_current_role() = 'department_authority'
    AND assigned_department = public.campusfix_current_department()
    AND verification_status IN ('pending', 'approved')
  )
  WITH CHECK (
    public.campusfix_current_role() = 'department_authority'
    AND assigned_department = public.campusfix_current_department()
    AND verification_status IN ('pending', 'approved')
  );

DROP POLICY IF EXISTS campusfix_admin_all_issues ON public.issues;
CREATE POLICY campusfix_admin_all_issues ON public.issues
  FOR ALL TO authenticated
  USING (public.campusfix_current_role() = 'admin')
  WITH CHECK (public.campusfix_current_role() = 'admin');

-- Authorities may update workflow fields, but cannot edit ownership, routing,
-- or priority. Those actions remain administrator-only.
CREATE OR REPLACE FUNCTION public.campusfix_protect_issue_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF public.campusfix_current_role() = 'department_authority' AND (
    NEW.reporter_id IS DISTINCT FROM OLD.reporter_id OR
    NEW.assigned_department IS DISTINCT FROM OLD.assigned_department OR
    NEW.priority IS DISTINCT FROM OLD.priority OR
    NEW.priority_score IS DISTINCT FROM OLD.priority_score OR
    NEW.category IS DISTINCT FROM OLD.category OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.description IS DISTINCT FROM OLD.description OR
    NEW.location IS DISTINCT FROM OLD.location
  ) THEN
    RAISE EXCEPTION 'Department authorities cannot edit complaint ownership, routing, content, or priority.';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS campusfix_protect_issue_fields ON public.issues;
CREATE TRIGGER campusfix_protect_issue_fields
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.campusfix_protect_issue_fields();

-- Keep the existing three-argument RPC intact for compatibility. This
-- four-argument overload is the endpoint used by the updated APIs and logs the
-- status change in the same transaction as the issue update.
CREATE TABLE IF NOT EXISTS public.campusfix_issue_status_history (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  old_status text NOT NULL,
  new_status text NOT NULL,
  comment text NOT NULL CHECK (length(btrim(comment)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campusfix_issue_status_history ENABLE ROW LEVEL SECURITY;
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
            AND i.assigned_department = public.campusfix_current_department())
        )
    )
  );
REVOKE ALL ON public.campusfix_issue_status_history FROM anon, authenticated;
GRANT SELECT ON public.campusfix_issue_status_history TO authenticated;

DO $rpc_guard$
BEGIN
  IF to_regprocedure('public.update_issue_status_atomic(uuid,text,text,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'A four-argument update_issue_status_atomic already exists. Review its definition before applying this migration.';
  END IF;
END
$rpc_guard$;

CREATE FUNCTION public.update_issue_status_atomic(
  p_issue_id uuid,
  p_new_status text,
  p_comment text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_department text;
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

  SELECT role, department INTO v_role, v_department
  FROM public.profiles WHERE id = auth.uid();
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
  IF v_role = 'department_authority' AND (
    v_issue.assigned_department IS DISTINCT FROM v_department OR v_department IS NULL
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

-- Post-apply verification:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='issues';
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('issues', 'campusfix_issue_status_history');
-- Test student-own reads, authority same/other department reads and writes,
-- admin global reads/reassignment/priority, and status RPC history atomically.
