-- Add only the issue-level counters required by AI similarity processing.
-- Does not alter status, category, authority, policy, RPC, or history data.
BEGIN;

DO $preflight$
DECLARE
  recurrence_type text;
  similarity_type text;
BEGIN
  IF to_regclass('public.issues') IS NULL THEN
    RAISE EXCEPTION 'Expected public.issues; inspect the live schema before applying.';
  END IF;

  SELECT data_type INTO recurrence_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'issues'
    AND column_name = 'ai_recurrence_count';

  IF recurrence_type IS NOT NULL AND recurrence_type <> 'integer' THEN
    RAISE EXCEPTION 'public.issues.ai_recurrence_count is %, expected integer; no changes applied.',
      recurrence_type;
  END IF;

  SELECT data_type INTO similarity_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'issues'
    AND column_name = 'ai_similarity_score';

  IF similarity_type IS NOT NULL AND similarity_type <> 'real' THEN
    RAISE EXCEPTION 'public.issues.ai_similarity_score is %, expected real; no changes applied.',
      similarity_type;
  END IF;

  -- Record the existing issue constraints for the review log. Neither target
  -- column is expected to be present in the verified live schema.
  RAISE NOTICE 'Existing public.issues constraints: %', (
    SELECT COALESCE(string_agg(conname || ': ' || pg_get_constraintdef(oid), '; '), '(none)')
    FROM pg_constraint
    WHERE conrelid = 'public.issues'::regclass
  );
END
$preflight$;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS ai_recurrence_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.issues
  ALTER COLUMN ai_recurrence_count SET DEFAULT 0,
  ALTER COLUMN ai_recurrence_count SET NOT NULL;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS ai_similarity_score real;

DO $postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'ai_recurrence_count'
      AND data_type = 'integer'
      AND is_nullable = 'NO'
      AND EXISTS (
        SELECT 1
        FROM pg_attribute a
        JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = 'public.issues'::regclass
          AND a.attname = 'ai_recurrence_count'
          AND regexp_replace(
                pg_get_expr(d.adbin, d.adrelid),
                '[[:space:]()]|::integer',
                '',
                'g'
              ) = '0'
      )
  ) THEN
    RAISE EXCEPTION 'ai_recurrence_count did not reach the required integer, NOT NULL, default-zero definition.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'ai_similarity_score'
      AND data_type = 'real'
  ) THEN
    RAISE EXCEPTION 'ai_similarity_score did not reach the required nullable real definition.';
  END IF;
END
$postcheck$;

COMMIT;

-- Read-only verification after manual application:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'issues'
--   AND column_name IN ('ai_recurrence_count', 'ai_similarity_score')
-- ORDER BY column_name;
