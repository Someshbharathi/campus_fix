-- AI embedding and similarity storage only.
-- Does not alter issue columns, issue_updates, status RPCs, existing issue
-- policies, roles, or authority scopes. Only trusted server code using the
-- service_role key may invoke the write RPCs.
BEGIN;

DO $preflight$
DECLARE
  col record;
  relation_row record;
  function_row record;
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.issues') IS NULL
     OR to_regclass('public.issue_updates') IS NULL THEN
    RAISE EXCEPTION 'Expected profiles, issues, and the existing issue_updates history table.';
  END IF;
  IF to_regclass('public.campusfix_issue_status_history') IS NOT NULL THEN
    RAISE EXCEPTION 'campusfix_issue_status_history exists; review the history schema before proceeding.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    RAISE EXCEPTION 'Expected Supabase postgres, authenticated, anon, and service_role roles.';
  END IF;
  IF current_user <> 'postgres' AND NOT pg_has_role(current_user, 'postgres', 'MEMBER') THEN
    RAISE EXCEPTION 'Apply as postgres or a role allowed to assign postgres ownership.';
  END IF;

  FOR col IN
    SELECT * FROM (VALUES
      ('profiles', 'id', 'uuid'),
      ('profiles', 'role', 'text'),
      ('profiles', 'department', 'text'),
      ('profiles', 'authority_scope', 'text'),
      ('issues', 'id', 'uuid'),
      ('issues', 'reporter_id', 'uuid'),
      ('issues', 'assigned_department', 'text'),
      ('issues', 'verification_status', 'text'),
      ('issues', 'ai_category', 'text'),
      ('issues', 'ai_recurrence_count', 'integer'),
      ('issues', 'ai_similarity_score', 'real')
    ) AS expected(table_name, column_name, data_type)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = col.table_name
        AND c.column_name = col.column_name
        AND c.data_type = col.data_type
    ) THEN
      RAISE EXCEPTION 'Missing/incompatible public.%.% (expected %).',
        col.table_name, col.column_name, col.data_type;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'issues'
      AND column_name = 'ai_recurrence_count'
      AND is_nullable = 'NO'
      AND regexp_replace(column_default, '[[:space:]()]|::integer', '', 'g') = '0'
  ) THEN
    RAISE EXCEPTION 'ai_recurrence_count must be integer NOT NULL DEFAULT 0.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role IS NULL OR role NOT IN ('student', 'department_authority', 'admin')
       OR (role = 'department_authority' AND
           (authority_scope IS NULL OR authority_scope NOT IN ('assigned_department', 'all_departments')))
  ) THEN
    RAISE EXCEPTION 'Unexpected profile role or authority_scope value.';
  END IF;

  IF to_regprocedure('public.campusfix_current_role()') IS NULL
     OR to_regprocedure('public.campusfix_authority_issue_fence(text,text)') IS NULL THEN
    RAISE EXCEPTION 'Required authorization helpers are missing.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid IN (
      'public.campusfix_current_role()'::regprocedure,
      'public.campusfix_authority_issue_fence(text,text)'::regprocedure
    )
      AND (NOT p.prosecdef
        OR pg_get_userbyid(p.proowner) <> 'postgres'
        OR NOT ('search_path=public, pg_temp' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))))
  ) THEN
    RAISE EXCEPTION 'Authorization helpers must be postgres-owned SECURITY DEFINER functions with fixed search_path.';
  END IF;
  IF has_function_privilege('anon', 'public.campusfix_current_role()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.campusfix_authority_issue_fence(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.campusfix_current_role()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.campusfix_authority_issue_fence(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Authorization helper grants are not restricted to the expected authenticated access.';
  END IF;

  -- Existing storage objects are accepted only when they are marked by this
  -- exact migration version. This prevents replacing unrelated objects.
  FOR relation_row IN
    SELECT c.relname, c.relkind, obj_description(c.oid, 'pg_class') AS object_comment
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('campusfix_issue_embeddings', 'campusfix_issue_similarity')
  LOOP
    IF relation_row.relkind <> 'r'
       OR relation_row.object_comment IS DISTINCT FROM 'CampusFix AI similarity storage v2' THEN
      RAISE EXCEPTION 'Existing public.% is not this migration''s expected table; inspect it first.', relation_row.relname;
    END IF;
  END LOOP;

  FOR function_row IN
    SELECT p.oid::regprocedure AS signature,
           obj_description(p.oid, 'pg_proc') AS object_comment
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.oid IN (
        to_regprocedure('public.campusfix_link_similar_issues(uuid,real,real,integer)'),
        to_regprocedure('public.campusfix_store_issue_embedding(uuid,text,real[],real,real)')
      )
  LOOP
    IF function_row.object_comment IS DISTINCT FROM 'CampusFix AI similarity storage v2' THEN
      RAISE EXCEPTION 'Existing function % is not this migration''s implementation; inspect it first.', function_row.signature;
    END IF;
  END LOOP;

  IF to_regclass('public.campusfix_issue_similarity') IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_policy pol
    WHERE pol.polrelid = to_regclass('public.campusfix_issue_similarity')
      AND (pol.polname <> 'campusfix_issue_similarity_read_authorized_v2'
        OR obj_description(pol.oid, 'pg_policy') IS DISTINCT FROM 'CampusFix AI similarity read policy v2')
  ) THEN
    RAISE EXCEPTION 'Unreviewed similarity-table policies exist; inspect them before proceeding.';
  END IF;
END;
$preflight$;

CREATE TABLE IF NOT EXISTS public.campusfix_issue_embeddings (
  issue_id uuid PRIMARY KEY REFERENCES public.issues(id) ON DELETE CASCADE,
  model text NOT NULL,
  embedding real[] NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campusfix_issue_embeddings_vector_shape
    CHECK (array_ndims(embedding) = 1 AND array_lower(embedding, 1) = 1
           AND cardinality(embedding) = 384)
);
COMMENT ON TABLE public.campusfix_issue_embeddings IS 'CampusFix AI similarity storage v2';

CREATE TABLE IF NOT EXISTS public.campusfix_issue_similarity (
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  similar_issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  related_category text NOT NULL,
  similarity real NOT NULL,
  same_category boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, similar_issue_id),
  CONSTRAINT campusfix_issue_similarity_score_range CHECK (similarity BETWEEN -1 AND 1),
  CONSTRAINT campusfix_issue_similarity_no_self_link CHECK (issue_id <> similar_issue_id)
);
COMMENT ON TABLE public.campusfix_issue_similarity IS 'CampusFix AI similarity storage v2';

-- Directed top-match rows: the primary key supports source lookups; this
-- reverse index supports FK cleanup and incoming-link inspection. The real[]
-- representation has no cosine ANN index, so candidate scoring is exact scan.
CREATE INDEX IF NOT EXISTS campusfix_issue_similarity_similar_id_idx
  ON public.campusfix_issue_similarity USING btree (similar_issue_id);

ALTER TABLE public.campusfix_issue_embeddings OWNER TO postgres;
ALTER TABLE public.campusfix_issue_similarity OWNER TO postgres;
ALTER TABLE public.campusfix_issue_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campusfix_issue_similarity ENABLE ROW LEVEL SECURITY;

DO $schema_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campusfix_issue_embeddings'
      AND column_name = 'embedding' AND data_type = 'ARRAY' AND udt_name = '_float4'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campusfix_issue_embeddings'
      AND column_name = 'issue_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campusfix_issue_similarity'
      AND column_name = 'issue_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campusfix_issue_similarity'
      AND column_name = 'similar_issue_id' AND data_type = 'uuid' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campusfix_issue_similarity'
      AND column_name = 'related_category' AND data_type = 'text' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campusfix_issue_similarity'
      AND column_name = 'similarity' AND data_type = 'real' AND is_nullable = 'NO'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campusfix_issue_embeddings'::regclass
      AND conname = 'campusfix_issue_embeddings_vector_shape'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campusfix_issue_similarity'::regclass
      AND conname = 'campusfix_issue_similarity_no_self_link'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campusfix_issue_similarity'::regclass
      AND conname = 'campusfix_issue_similarity_score_range'
  ) THEN
    RAISE EXCEPTION 'AI storage tables have incompatible columns or required constraints are missing.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campusfix_issue_embeddings'::regclass AND contype = 'p'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campusfix_issue_embeddings'::regclass AND contype = 'f'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.campusfix_issue_similarity'::regclass AND contype = 'p'
  ) OR (SELECT count(*) FROM pg_constraint
        WHERE conrelid = 'public.campusfix_issue_similarity'::regclass
          AND contype = 'f') <> 2 THEN
    RAISE EXCEPTION 'AI storage tables are missing primary-key or issue foreign-key constraints.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.campusfix_issue_embeddings e
    WHERE array_ndims(e.embedding) IS DISTINCT FROM 1
       OR array_lower(e.embedding, 1) IS DISTINCT FROM 1
       OR cardinality(e.embedding) <> 384
       OR EXISTS (
         SELECT 1 FROM unnest(e.embedding) AS component(value)
         WHERE component.value IS NULL
            OR component.value IN ('NaN'::real, 'Infinity'::real, '-Infinity'::real)
       )
  ) THEN
    RAISE EXCEPTION 'Existing embeddings must contain 384 finite values.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'campusfix_issue_similarity_similar_id_idx'
      AND indexdef ~* 'USING btree \(similar_issue_id\)'
  ) THEN
    RAISE EXCEPTION 'Expected the reverse-link B-tree index on similar_issue_id.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'campusfix_issue_embeddings'
      AND c.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'campusfix_issue_similarity'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on both AI storage tables.';
  END IF;
END;
$schema_check$;

REVOKE ALL ON public.campusfix_issue_embeddings FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON public.campusfix_issue_similarity FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.campusfix_issue_similarity TO authenticated;

DO $policy$
DECLARE
  existing_policy oid;
BEGIN
  SELECT pol.oid INTO existing_policy
  FROM pg_policy pol
  WHERE pol.polrelid = 'public.campusfix_issue_similarity'::regclass
    AND pol.polname = 'campusfix_issue_similarity_read_authorized_v2';

  IF existing_policy IS NULL THEN
    EXECUTE $create_policy$
      CREATE POLICY campusfix_issue_similarity_read_authorized_v2
      ON public.campusfix_issue_similarity
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.issues AS source_issue
          JOIN public.issues AS target_issue
            ON target_issue.id = campusfix_issue_similarity.similar_issue_id
          WHERE source_issue.id = campusfix_issue_similarity.issue_id
            AND (
              public.campusfix_current_role() = 'admin'
              OR (public.campusfix_current_role() = 'student'
                  AND source_issue.reporter_id = auth.uid()
                  AND target_issue.reporter_id = auth.uid())
              OR (public.campusfix_current_role() = 'department_authority'
                  AND public.campusfix_authority_issue_fence(
                    source_issue.assigned_department, source_issue.verification_status)
                  AND public.campusfix_authority_issue_fence(
                    target_issue.assigned_department, target_issue.verification_status))
            )
        )
      )
    $create_policy$;
    EXECUTE 'COMMENT ON POLICY campusfix_issue_similarity_read_authorized_v2 ON public.campusfix_issue_similarity IS ''CampusFix AI similarity read policy v2''';
  ELSIF obj_description(existing_policy, 'pg_policy') IS DISTINCT FROM 'CampusFix AI similarity read policy v2' THEN
    RAISE EXCEPTION 'The named similarity policy exists without this migration''s marker.';
  END IF;
END;
$policy$;

CREATE OR REPLACE FUNCTION public.campusfix_link_similar_issues(
  p_issue_id uuid,
  p_same_category_threshold real DEFAULT 0.78,
  p_cross_category_threshold real DEFAULT 0.70,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(similar_issue_id uuid, related_category text, similarity real, same_category boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_category text;
  v_embedding real[];
  v_match record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_issue_id IS NULL
     OR p_same_category_threshold IS NULL
     OR p_cross_category_threshold IS NULL
     OR p_limit IS NULL
     OR p_same_category_threshold < 0 OR p_same_category_threshold > 1
     OR p_cross_category_threshold < 0 OR p_cross_category_threshold > 1
     OR p_limit < 1 OR p_limit > 20 THEN
    RAISE EXCEPTION 'Invalid similarity search configuration';
  END IF;

  -- Lock order is consistent in both RPCs: per-issue advisory lock, then row
  -- lock. Links are directed, so rebuilding one issue never changes another
  -- issue's top-match list or counters.
  PERFORM pg_advisory_xact_lock(20261019, hashtext(p_issue_id::text));

  SELECT COALESCE(i.ai_category, 'other') INTO v_category
  FROM public.issues i WHERE i.id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found'; END IF;

  SELECT e.embedding INTO v_embedding
  FROM public.campusfix_issue_embeddings e
  WHERE e.issue_id = p_issue_id;

  DELETE FROM public.campusfix_issue_similarity s
  WHERE s.issue_id = p_issue_id;

  IF v_embedding IS NOT NULL THEN
    FOR v_match IN
      SELECT candidate.issue_id, candidate.ai_category, candidate.score,
             candidate.ai_category = v_category AS category_match
      FROM (
        SELECT e.issue_id,
               COALESCE(i.ai_category, 'other') AS ai_category,
               COALESCE((
                 SELECT CASE
                   WHEN norms.denominator = 0 THEN 0::double precision
                   ELSE LEAST(1::double precision, GREATEST(-1::double precision,
                     norms.dot_product / norms.denominator))
                 END
                 FROM (
                   SELECT sum(e.embedding[d.idx]::double precision * v_embedding[d.idx]::double precision) AS dot_product,
                          sqrt(sum(e.embedding[d.idx]::double precision * e.embedding[d.idx]::double precision) *
                               sum(v_embedding[d.idx]::double precision * v_embedding[d.idx]::double precision)) AS denominator
                   FROM generate_subscripts(e.embedding, 1) AS d(idx)
                 ) AS norms
               ), 0::double precision)::real AS score
        FROM public.campusfix_issue_embeddings e
        JOIN public.issues i ON i.id = e.issue_id
        WHERE e.issue_id <> p_issue_id
      ) AS candidate
      WHERE candidate.score >= CASE
        WHEN candidate.ai_category = v_category THEN p_same_category_threshold
        ELSE p_cross_category_threshold
      END
      ORDER BY (candidate.ai_category = v_category) DESC, candidate.score DESC
      LIMIT p_limit
    LOOP
      INSERT INTO public.campusfix_issue_similarity
        (issue_id, similar_issue_id, related_category, similarity, same_category)
      VALUES (p_issue_id, v_match.issue_id, v_match.ai_category,
              v_match.score, v_match.category_match);
    END LOOP;
  END IF;

  -- Do not write global match aggregates to public.issues: row-level readers
  -- could infer matches outside their authorized scope. API callers derive
  -- counts and scores from similarity rows visible under their own RLS.

  -- Return no complaint IDs through the service-role RPC. Authorized callers
  -- retrieve visible links through the RLS-protected SELECT policy above.
  RETURN;
END;
$function$;

ALTER FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer) OWNER TO postgres;
COMMENT ON FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer)
  IS 'CampusFix AI similarity storage v2';
REVOKE ALL ON FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.campusfix_store_issue_embedding(
  p_issue_id uuid,
  p_model text,
  p_embedding real[],
  p_same_category_threshold real DEFAULT 0.78,
  p_cross_category_threshold real DEFAULT 0.70
)
RETURNS TABLE(similar_issue_id uuid, related_category text, similarity real, same_category boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_issue_id IS NULL
     OR p_model IS DISTINCT FROM 'sentence-transformers/all-MiniLM-L6-v2'
     OR p_embedding IS NULL
     OR array_ndims(p_embedding) IS DISTINCT FROM 1
     OR array_lower(p_embedding, 1) IS DISTINCT FROM 1
     OR cardinality(p_embedding) <> 384
     OR EXISTS (
       SELECT 1 FROM unnest(p_embedding) AS component(value)
       WHERE component.value IS NULL
          OR component.value IN ('NaN'::real, 'Infinity'::real, '-Infinity'::real)
     )
     OR p_same_category_threshold IS NULL
     OR p_cross_category_threshold IS NULL
     OR p_same_category_threshold < 0 OR p_same_category_threshold > 1
     OR p_cross_category_threshold < 0 OR p_cross_category_threshold > 1 THEN
    RAISE EXCEPTION 'Invalid embedding or similarity configuration';
  END IF;

  PERFORM pg_advisory_xact_lock(20261019, hashtext(p_issue_id::text));
  PERFORM 1 FROM public.issues i WHERE i.id = p_issue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found'; END IF;

  INSERT INTO public.campusfix_issue_embeddings(issue_id, model, embedding)
  VALUES (p_issue_id, p_model, p_embedding)
  ON CONFLICT (issue_id) DO UPDATE
    SET model = EXCLUDED.model,
        embedding = EXCLUDED.embedding,
        created_at = now();

  RETURN QUERY
  SELECT * FROM public.campusfix_link_similar_issues(
    p_issue_id, p_same_category_threshold, p_cross_category_threshold, 5
  );
END;
$function$;

ALTER FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real) OWNER TO postgres;
COMMENT ON FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real)
  IS 'CampusFix AI similarity storage v2';
REVOKE ALL ON FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real)
  TO service_role;

DO $postcheck$
BEGIN
  IF NOT has_function_privilege('service_role',
       'public.campusfix_link_similar_issues(uuid,real,real,integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.campusfix_store_issue_embedding(uuid,text,real[],real,real)', 'EXECUTE')
     OR has_function_privilege('anon',
       'public.campusfix_link_similar_issues(uuid,real,real,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.campusfix_link_similar_issues(uuid,real,real,integer)', 'EXECUTE')
     OR has_function_privilege('anon',
       'public.campusfix_store_issue_embedding(uuid,text,real[],real,real)', 'EXECUTE')
     OR has_function_privilege('authenticated',
       'public.campusfix_store_issue_embedding(uuid,text,real[],real,real)', 'EXECUTE') THEN
    RAISE EXCEPTION 'AI RPC EXECUTE grants are not service_role-only.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid IN (
      'public.campusfix_link_similar_issues(uuid,real,real,integer)'::regprocedure,
      'public.campusfix_store_issue_embedding(uuid,text,real[],real,real)'::regprocedure
    )
      AND (NOT p.prosecdef
        OR pg_get_userbyid(p.proowner) <> 'postgres'
        OR NOT ('search_path=public, pg_temp' = ANY(COALESCE(p.proconfig, ARRAY[]::text[]))))
  ) THEN
    RAISE EXCEPTION 'AI RPCs must be postgres-owned SECURITY DEFINER functions with fixed search_path.';
  END IF;
END;
$postcheck$;

COMMIT;

-- Read-only verification after manual application:
-- SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
--        pg_get_userbyid(c.relowner) AS owner
-- FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND c.relname IN ('campusfix_issue_embeddings', 'campusfix_issue_similarity');
-- SELECT c.conrelid::regclass AS table_name, c.conname, c.contype,
--        pg_get_constraintdef(c.oid) AS definition
-- FROM pg_constraint c
-- WHERE c.conrelid IN ('public.campusfix_issue_embeddings'::regclass,
--                      'public.campusfix_issue_similarity'::regclass)
-- ORDER BY c.conrelid::regclass::text, c.conname;
-- SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
--        pg_get_userbyid(p.proowner) AS owner, p.proconfig AS settings,
--        p.proacl AS acl, pg_get_functiondef(p.oid) AS definition
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN ('campusfix_link_similar_issues', 'campusfix_store_issue_embedding');
-- SELECT schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('campusfix_issue_embeddings', 'campusfix_issue_similarity');
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('campusfix_issue_embeddings', 'campusfix_issue_similarity');
-- SELECT count(*) AS embedding_count,
--        count(*) FILTER (WHERE array_ndims(embedding) = 1
--                         AND array_lower(embedding, 1) = 1
--                         AND cardinality(embedding) = 384) AS valid_384_vectors
-- FROM public.campusfix_issue_embeddings;
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('issue_updates', 'campusfix_issue_status_history');
