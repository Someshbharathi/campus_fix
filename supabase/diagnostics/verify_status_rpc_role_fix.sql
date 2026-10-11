-- Read-only verification after manually applying 20261016_fix_legacy_status_role.sql.

-- Review the complete installed definition, security mode, and existing ACL.
SELECT
  p.oid::regprocedure AS signature,
  CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security_mode,
  p.proacl AS function_acl,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_issue_status_atomic';

-- A compact checklist. Every column should be true after the fix.
WITH rpc AS (
  SELECT lower(pg_get_functiondef(p.oid)) AS definition
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'update_issue_status_atomic'
)
SELECT
  position('role = ''department_authority''' IN definition) > 0 AS checks_canonical_authority_role,
  position('and role = ''faculty'';' IN definition) = 0 AS no_legacy_faculty_predicate,
  position('auth.uid()' IN definition) > 0 AS checks_authenticated_actor,
  position('p_new_status' IN definition) > 0
    AND position('in_progress' IN definition) > 0
    AND position('resolved' IN definition) > 0 AS retains_status_transition_checks,
  position('verification_status' IN definition) > 0
    AND position('approved' IN definition) > 0 AS retains_verification_eligibility_check,
  position('assigned_department' IN definition) > 0
    AND position('department' IN definition) > 0 AS retains_department_check,
  position('p_comment' IN definition) > 0
    AND position('btrim' IN definition) > 0 AS retains_required_comment_check,
  position('update public.issues' IN definition) > 0 AS updates_issue_row,
  position('insert into public.campusfix_issue_status_history' IN definition) > 0 AS inserts_history_in_same_function
FROM rpc;

-- Inspect access and RLS relevant to an INVOKER implementation. The local
-- migrations grant authenticated SELECT, but not INSERT, on the history table;
-- therefore the current SECURITY DEFINER mode may be required for atomic
-- history insertion unless the live database has a reviewed INSERT grant/policy.
SELECT
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_table_privilege('authenticated', 'public.issues', 'UPDATE') AS authenticated_has_issue_update_grant,
  has_table_privilege('authenticated', 'public.campusfix_issue_status_history', 'INSERT') AS authenticated_has_history_insert_grant
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_issue_status_atomic';

SELECT policyname, permissive, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('issues', 'campusfix_issue_status_history')
ORDER BY tablename, cmd, policyname;
