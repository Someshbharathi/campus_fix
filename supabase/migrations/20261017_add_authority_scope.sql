-- Add the authority-scope attribute without changing existing RLS policies,
-- issue assignments, or status RPC behavior. Existing authority profiles get
-- the least-privilege default; assign all_departments only after reviewing
-- which accounts are intended to be generic authorities.
BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS authority_scope text NOT NULL DEFAULT 'assigned_department';

DO $scope_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_authority_scope_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_authority_scope_check
      CHECK (authority_scope IN ('all_departments', 'assigned_department')) NOT VALID;
  END IF;
END
$scope_constraint$;

ALTER TABLE public.profiles
  VALIDATE CONSTRAINT profiles_authority_scope_check;

COMMIT;

-- Read-only verification:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'profiles'
--   AND column_name = 'authority_scope';
-- SELECT conname, convalidated, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.profiles'::regclass
--   AND conname = 'profiles_authority_scope_check';
-- SELECT role, authority_scope, department, count(*)
-- FROM public.profiles
-- GROUP BY role, authority_scope, department
-- ORDER BY role, authority_scope, department;
