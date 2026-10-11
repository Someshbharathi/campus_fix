-- Read-only diagnostics for the prior SQLSTATE 23514 during role migration.
-- Run in Supabase SQL Editor and inspect every result before changing schema.

-- Confirm the role and scope column types/defaults without exposing profile PII.
SELECT column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('id', 'role', 'department', 'authority_scope')
ORDER BY ordinal_position;

-- Show CHECK constraints and their exact predicates. A 23514 report names the
-- failing constraint; compare that name to this result before editing anything.
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass
  AND contype = 'c'
ORDER BY conname;

-- Enum constraints, if role is not text in this database.
SELECT t.typname AS type_name, e.enumlabel AS allowed_value
FROM pg_attribute a
JOIN pg_type t ON t.oid = a.atttypid
LEFT JOIN pg_enum e ON e.enumtypid = t.oid
WHERE a.attrelid = 'public.profiles'::regclass
  AND a.attname = 'role'
  AND NOT a.attisdropped
ORDER BY e.enumsortorder;

-- Counts only; this does not expose names, email addresses, or user IDs.
SELECT role, count(*) AS profile_count
FROM public.profiles
GROUP BY role
ORDER BY role;
