-- Broaden department-authority visibility for monitoring while retaining the
-- narrower state/department checks for writes. Requires migrations 20261012-14.
BEGIN;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS additional_info_provided text,
  ADD COLUMN IF NOT EXISTS student_resolution_confirmed_at timestamptz;

CREATE OR REPLACE FUNCTION public.campusfix_authority_issue_read_fence(p_department text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'department_authority'
      AND (
        p.authority_scope = 'all_departments'
        OR (p.authority_scope = 'assigned_department' AND p_department = p.department)
      )
  )
$function$;
REVOKE ALL ON FUNCTION public.campusfix_authority_issue_read_fence(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_authority_issue_read_fence(text) TO authenticated;

DROP POLICY IF EXISTS campusfix_authority_department_fence ON public.issues;
DROP POLICY IF EXISTS campusfix_authority_read_scope_fence ON public.issues;
CREATE POLICY campusfix_authority_read_scope_fence ON public.issues
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    public.campusfix_current_role() <> 'department_authority'
    OR public.campusfix_authority_issue_read_fence(assigned_department)
  );
DROP POLICY IF EXISTS campusfix_authority_update_state_fence ON public.issues;
CREATE POLICY campusfix_authority_update_state_fence ON public.issues
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.campusfix_current_role() <> 'department_authority'
    OR public.campusfix_authority_issue_fence(assigned_department, verification_status)
  )
  WITH CHECK (
    public.campusfix_current_role() <> 'department_authority'
    OR public.campusfix_authority_issue_fence(assigned_department, verification_status)
  );

DROP POLICY IF EXISTS campusfix_authority_read_department_queue ON public.issues;
CREATE POLICY campusfix_authority_read_department_queue ON public.issues
  FOR SELECT TO authenticated
  USING (
    public.campusfix_current_role() = 'department_authority'
    AND public.campusfix_authority_issue_read_fence(assigned_department)
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
            AND public.campusfix_authority_issue_read_fence(i.assigned_department))
        )
    )
  );

DROP POLICY IF EXISTS campusfix_issue_similarity_read_authorized ON public.campusfix_issue_similarity;
CREATE POLICY campusfix_issue_similarity_read_authorized ON public.campusfix_issue_similarity
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.issues source_issue
      WHERE source_issue.id = campusfix_issue_similarity.issue_id
        AND (
          public.campusfix_current_role() = 'admin'
          OR (public.campusfix_current_role() = 'student' AND source_issue.reporter_id = auth.uid())
          OR (public.campusfix_current_role() = 'department_authority'
            AND public.campusfix_authority_issue_read_fence(source_issue.assigned_department))
        )
    )
  );

CREATE OR REPLACE FUNCTION public.campusfix_student_complaint_action(
  p_issue_id uuid,
  p_action text,
  p_message text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_issue public.issues%ROWTYPE;
  v_role text;
  v_old_status text;
  v_new_status text;
  v_history public.campusfix_issue_status_history%ROWTYPE;
  v_message text := btrim(COALESCE(p_message, ''));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'student' THEN RAISE EXCEPTION 'Student access required'; END IF;
  SELECT * INTO v_issue FROM public.issues
  WHERE id = p_issue_id AND reporter_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found or access denied'; END IF;
  IF p_action NOT IN ('provide_info', 'confirm_resolution', 'reopen') THEN
    RAISE EXCEPTION 'Invalid student complaint action';
  END IF;
  IF length(v_message) > 2000 THEN RAISE EXCEPTION 'Message is too long'; END IF;

  v_old_status := v_issue.status;
  v_new_status := v_issue.status;
  IF p_action = 'provide_info' THEN
    IF v_issue.verification_status <> 'needs_clarification' OR length(v_message) = 0 THEN
      RAISE EXCEPTION 'Additional information is not currently requested';
    END IF;
    UPDATE public.issues
    SET additional_info_provided = v_message,
        verification_status = 'pending',
        updated_at = now()
    WHERE id = p_issue_id
    RETURNING * INTO v_issue;
    INSERT INTO public.campusfix_issue_status_history(issue_id, actor_id, old_status, new_status, comment)
    VALUES (p_issue_id, auth.uid(), v_old_status, v_new_status, 'Student provided additional information: ' || v_message)
    RETURNING * INTO v_history;
  ELSIF p_action = 'confirm_resolution' THEN
    IF v_issue.status <> 'resolved' THEN RAISE EXCEPTION 'Only resolved complaints can be confirmed'; END IF;
    UPDATE public.issues SET student_resolution_confirmed_at = now(), updated_at = now()
    WHERE id = p_issue_id RETURNING * INTO v_issue;
    INSERT INTO public.campusfix_issue_status_history(issue_id, actor_id, old_status, new_status, comment)
    VALUES (p_issue_id, auth.uid(), v_old_status, v_new_status, 'Student confirmed resolution: The repair is satisfactory.')
    RETURNING * INTO v_history;
  ELSE
    IF v_issue.status <> 'resolved' OR length(v_message) = 0 THEN
      RAISE EXCEPTION 'Only resolved complaints can be reopened; a reason is required';
    END IF;
    v_new_status := CASE WHEN v_issue.assigned_department IS NULL THEN 'reported' ELSE 'assigned' END;
    UPDATE public.issues SET status = v_new_status, resolved_at = NULL, updated_at = now()
    WHERE id = p_issue_id RETURNING * INTO v_issue;
    INSERT INTO public.campusfix_issue_status_history(issue_id, actor_id, old_status, new_status, comment)
    VALUES (p_issue_id, auth.uid(), v_old_status, v_new_status, 'Student reopened complaint: ' || v_message)
    RETURNING * INTO v_history;
  END IF;

  RETURN jsonb_build_object('issue', to_jsonb(v_issue), 'history', to_jsonb(v_history));
END
$function$;
REVOKE ALL ON FUNCTION public.campusfix_student_complaint_action(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.campusfix_student_complaint_action(uuid, text, text) TO authenticated;

-- Add only supported tables to Supabase Realtime; authenticated APIs remain
-- the polling fallback if the publication is unavailable in this project.
DO $publication$
DECLARE
  table_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH table_name IN ARRAY ARRAY['issues', 'campusfix_issue_status_history'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END IF;
    END LOOP;
  ELSE
    RAISE NOTICE 'supabase_realtime publication not found; authenticated polling remains available.';
  END IF;
END
$publication$;

COMMIT;

-- Verify publication membership and authority policies after applying:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
-- SELECT policyname, cmd, permissive, qual, with_check FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('issues', 'campusfix_issue_status_history');
