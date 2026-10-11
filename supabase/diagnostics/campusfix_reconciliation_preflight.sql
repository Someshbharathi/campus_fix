-- Read-only preflight for manual Supabase SQL Editor use. No data is changed.

-- Public tables and columns, including the actual issue history table.
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- All constraints on the live profile, issue, and issue_updates tables.
SELECT c.conrelid::regclass AS table_name, c.conname, c.contype,
       c.convalidated, pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.connamespace = 'public'::regnamespace
  AND c.conrelid::regclass::text IN ('profiles', 'issues', 'issue_updates',
                                    'campusfix_issue_status_history',
                                    'campusfix_issue_embeddings',
                                    'campusfix_issue_similarity')
ORDER BY table_name::text, c.contype, c.conname;

-- Exact category and verification CHECK definitions.
SELECT c.conrelid::regclass AS table_name, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.conrelid = 'public.issues'::regclass
  AND c.contype = 'c'
  AND pg_get_constraintdef(c.oid) ~* '(category|verification_status)'
ORDER BY c.conname;

-- Actual stored category/verification values (counts, no complaint text).
SELECT category, count(*) AS row_count
FROM public.issues GROUP BY category ORDER BY category;
SELECT verification_status, count(*) AS row_count
FROM public.issues GROUP BY verification_status ORDER BY verification_status;

-- Scope is intentionally not referenced here because it is confirmed absent.
-- After applying 20261017_add_authority_scope.sql, use its verification query
-- to review scope and department counts without exposing profile names/emails.

-- Every issue policy, including restrictive/permissive mode and predicates.
SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Status RPC implementations, execution mode, owner and ACL.
SELECT p.oid::regprocedure AS signature,
       p.prosecdef AS security_definer,
       pg_get_userbyid(p.proowner) AS owner,
       p.proacl AS acl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'update_issue_status_atomic';

-- AI helper functions and their execution ACLs.
SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
       p.proacl AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('campusfix_store_issue_embedding',
                    'campusfix_link_similar_issues');

-- Realtime publication membership relevant to issue and history updates.
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE schemaname = 'public'
  AND tablename IN ('issues', 'issue_updates', 'campusfix_issue_status_history')
ORDER BY pubname, tablename;
