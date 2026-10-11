-- Run this read-only script in Supabase SQL Editor and share the result sets.
-- It inspects every issues policy, constraint, required column, and trigger.

-- Every policy on issues is included (not only INSERT), since RESTRICTIVE
-- policies also apply to INSERT and can veto a permissive INSERT policy.
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'issues'
ORDER BY cmd, permissive, policyname;

-- CHECK, primary-key, unique, and foreign-key constraints.
SELECT
  conname,
  contype,
  convalidated,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.issues'::regclass
ORDER BY contype, conname;

-- Required fields and defaults. A missing required value normally yields
-- 23502 (not 42501), but these columns are relevant to INSERT correctness.
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'issues'
ORDER BY ordinal_position;

-- Triggers can rewrite rows before WITH CHECK expressions are evaluated.
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.issues'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- POST /api/issues logs auth.uid(), the verified user ID, and reporter_id
-- during the actual JWT-authenticated request after the migration is applied.
