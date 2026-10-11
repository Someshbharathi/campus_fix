-- Correct only the stale faculty role check in the existing atomic status RPC.
-- pg_get_functiondef preserves its parameters, validation, locking, department
-- checks, transitions, history insert, security mode, owner, and ACLs.
-- Apply manually only after reviewing the matching function in this database.
BEGIN;

DO $migration$
DECLARE
  function_row record;
  function_definition text;
  corrected_definition text;
  matched_functions integer := 0;
BEGIN
  FOR function_row IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'update_issue_status_atomic'
      AND p.prokind = 'f'
  LOOP
    function_definition := pg_get_functiondef(function_row.oid);

    IF position('Require an authenticated faculty authority.' IN function_definition) > 0
       AND position('AND role = ''faculty'';' IN function_definition) > 0 THEN
      matched_functions := matched_functions + 1;
      corrected_definition := replace(
        function_definition,
        'Require an authenticated faculty authority.',
        'Require an authenticated department authority.'
      );
      corrected_definition := replace(
        corrected_definition,
        'AND role = ''faculty'';',
        'AND role = ''department_authority'';'
      );

      IF position('AND role = ''faculty'';' IN corrected_definition) > 0 THEN
        RAISE EXCEPTION 'Legacy faculty predicate remains in update_issue_status_atomic; no change applied.';
      END IF;

      EXECUTE corrected_definition;
    END IF;
  END LOOP;

  IF matched_functions <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one update_issue_status_atomic definition with the confirmed faculty predicate; found %. Review pg_get_functiondef before applying.',
      matched_functions;
  END IF;
END
$migration$;

COMMIT;

-- CREATE OR REPLACE preserves the function ACL. This migration deliberately
-- does not change SECURITY INVOKER/DEFINER or grant/revoke EXECUTE privileges.
