-- AI category review, spam/recurrence fields, private embeddings and similarity links.
-- Embeddings use real[] to avoid requiring pgvector in projects where its
-- extension is unavailable; each entry is a 384-dimensional MiniLM vector.
BEGIN;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS ai_affected_population smallint,
  ADD COLUMN IF NOT EXISTS ai_spam boolean,
  ADD COLUMN IF NOT EXISTS ai_spam_reason text,
  ADD COLUMN IF NOT EXISTS ai_recurrence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_similarity_score real,
  ADD COLUMN IF NOT EXISTS ai_category_reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS ai_category_reviewed_at timestamptz;

-- Give existing rows a stable label so category totals include the full register.
UPDATE public.issues
SET ai_category = CASE COALESCE(ai_category, category)
  WHEN 'electrical' THEN 'electrical'
  WHEN 'plumbing' THEN 'plumbing_water_supply'
  WHEN 'internet' THEN 'internet_wifi'
  WHEN 'network' THEN 'internet_wifi'
  WHEN 'equipment' THEN 'classroom_lab_equipment'
  WHEN 'classroom' THEN 'classroom_lab_equipment'
  WHEN 'infrastructure' THEN 'furniture_infrastructure'
  WHEN 'cleanliness' THEN 'cleanliness_sanitation'
  WHEN 'hostel' THEN 'hostel_facilities'
  WHEN 'safety' THEN 'security_safety'
  ELSE 'other'
END
WHERE ai_category IS NULL OR ai_category NOT IN (
  'electrical', 'plumbing_water_supply', 'internet_wifi', 'classroom_lab_equipment',
  'furniture_infrastructure', 'cleanliness_sanitation', 'hostel_facilities',
  'canteen_food_services', 'security_safety', 'transportation', 'administrative_services', 'other'
);

CREATE TABLE IF NOT EXISTS public.campusfix_issue_embeddings (
  issue_id uuid PRIMARY KEY REFERENCES public.issues(id) ON DELETE CASCADE,
  model text NOT NULL,
  embedding real[] NOT NULL CHECK (cardinality(embedding) = 384),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campusfix_issue_similarity (
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  similar_issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  related_category text NOT NULL,
  similarity real NOT NULL CHECK (similarity BETWEEN -1 AND 1),
  same_category boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, similar_issue_id),
  CHECK (issue_id <> similar_issue_id)
);

CREATE INDEX IF NOT EXISTS campusfix_issue_similarity_related_idx
  ON public.campusfix_issue_similarity(similar_issue_id);

ALTER TABLE public.campusfix_issue_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campusfix_issue_similarity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campusfix_issue_embeddings FROM anon, authenticated;
REVOKE ALL ON public.campusfix_issue_similarity FROM anon, authenticated;
GRANT SELECT ON public.campusfix_issue_similarity TO authenticated;

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
            AND public.campusfix_authority_issue_fence(source_issue.assigned_department, source_issue.verification_status))
        )
    )
  );

CREATE OR REPLACE FUNCTION public.campusfix_link_similar_issues(
  p_issue_id uuid,
  p_same_category_threshold real DEFAULT 0.78,
  p_cross_category_threshold real DEFAULT 0.70,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(similar_issue_id uuid, related_category text, similarity real, same_category boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_reporter uuid;
  v_department text;
  v_verification text;
  v_category text;
  v_embedding real[];
  v_match record;
  v_count integer := 0;
  v_max_similarity real;
  v_previous_ids uuid[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_same_category_threshold < 0 OR p_same_category_threshold > 1
    OR p_cross_category_threshold < 0 OR p_cross_category_threshold > 1
    OR p_limit < 1 OR p_limit > 20 THEN
    RAISE EXCEPTION 'Invalid similarity search configuration';
  END IF;

  SELECT reporter_id, assigned_department, verification_status, ai_category
    INTO v_reporter, v_department, v_verification, v_category
  FROM public.issues WHERE id = p_issue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found or access denied'; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF v_role IS NULL OR v_role NOT IN ('student', 'admin', 'department_authority') THEN
      RAISE EXCEPTION 'Complaint access required';
    ELSIF v_role = 'student' AND v_reporter IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Complaint not found or access denied';
    ELSIF v_role = 'department_authority' AND NOT public.campusfix_authority_issue_fence(v_department, v_verification) THEN
      RAISE EXCEPTION 'Department authority access required';
    END IF;
  END IF;

  SELECT embedding INTO v_embedding FROM public.campusfix_issue_embeddings WHERE issue_id = p_issue_id;
  IF v_embedding IS NULL THEN RETURN; END IF;

  SELECT array_agg(DISTINCT CASE WHEN issue_id = p_issue_id THEN similar_issue_id ELSE issue_id END)
    INTO v_previous_ids
  FROM public.campusfix_issue_similarity
  WHERE issue_id = p_issue_id OR similar_issue_id = p_issue_id;
  DELETE FROM public.campusfix_issue_similarity
  WHERE issue_id = p_issue_id OR similar_issue_id = p_issue_id;
  IF v_previous_ids IS NOT NULL THEN
    UPDATE public.issues SET ai_recurrence_count = 0, ai_similarity_score = NULL
    WHERE id = ANY(v_previous_ids);
  END IF;

  FOR v_match IN
    SELECT candidate.issue_id,
           candidate.ai_category,
           candidate.score,
           candidate.ai_category = v_category AS category_match
    FROM (
      SELECT e.issue_id,
             i.ai_category,
             COALESCE((
               SELECT sum(e.embedding[dimension.index] * v_embedding[dimension.index]) /
                 NULLIF(sqrt(sum(e.embedding[dimension.index] * e.embedding[dimension.index]) * sum(v_embedding[dimension.index] * v_embedding[dimension.index])), 0)
               FROM generate_subscripts(e.embedding, 1) AS dimension(index)
             ), 0)::real AS score
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
    INSERT INTO public.campusfix_issue_similarity(issue_id, similar_issue_id, related_category, similarity, same_category)
    VALUES (p_issue_id, v_match.issue_id, COALESCE(v_match.ai_category, 'other'), v_match.score, v_match.category_match)
    ON CONFLICT (issue_id, similar_issue_id) DO UPDATE SET
      related_category = EXCLUDED.related_category,
      similarity = EXCLUDED.similarity,
      same_category = EXCLUDED.same_category,
      created_at = now();

    INSERT INTO public.campusfix_issue_similarity(issue_id, similar_issue_id, related_category, similarity, same_category)
    VALUES (v_match.issue_id, p_issue_id, COALESCE(v_category, 'other'), v_match.score, v_match.category_match)
    ON CONFLICT (issue_id, similar_issue_id) DO UPDATE SET
      related_category = EXCLUDED.related_category,
      similarity = EXCLUDED.similarity,
      same_category = EXCLUDED.same_category,
      created_at = now();

    v_count := v_count + 1;
    v_max_similarity := greatest(v_max_similarity, v_match.score);
  END LOOP;

  UPDATE public.issues
  SET ai_recurrence_count = v_count,
      ai_similarity_score = v_max_similarity
  WHERE id = p_issue_id;

  UPDATE public.issues old_issue
  SET ai_recurrence_count = related_counts.match_count,
      ai_similarity_score = related_counts.max_similarity
  FROM (
    SELECT links.issue_id, count(*)::integer AS match_count, max(links.similarity)::real AS max_similarity
    FROM public.campusfix_issue_similarity links
    WHERE links.issue_id IN (
      SELECT l.similar_issue_id FROM public.campusfix_issue_similarity l WHERE l.issue_id = p_issue_id
    )
    GROUP BY links.issue_id
  ) AS related_counts
  WHERE old_issue.id = related_counts.issue_id;

  RETURN QUERY
  SELECT links.similar_issue_id, links.related_category, links.similarity, links.same_category
  FROM public.campusfix_issue_similarity links
  WHERE links.issue_id = p_issue_id
  ORDER BY links.same_category DESC, links.similarity DESC;
END
$function$;

ALTER FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campusfix_link_similar_issues(uuid, real, real, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.campusfix_store_issue_embedding(
  p_issue_id uuid,
  p_model text,
  p_embedding real[],
  p_same_category_threshold real DEFAULT 0.78,
  p_cross_category_threshold real DEFAULT 0.70
)
RETURNS TABLE(similar_issue_id uuid, related_category text, similarity real, same_category boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_role text;
  v_reporter uuid;
  v_department text;
  v_verification text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_model <> 'sentence-transformers/all-MiniLM-L6-v2'
    OR p_embedding IS NULL OR cardinality(p_embedding) <> 384 THEN
    RAISE EXCEPTION 'Invalid complaint embedding';
  END IF;
  SELECT reporter_id, assigned_department, verification_status
    INTO v_reporter, v_department, v_verification
  FROM public.issues WHERE id = p_issue_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found or access denied'; END IF;
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    IF v_role IS NULL OR v_role NOT IN ('student', 'admin', 'department_authority') THEN
      RAISE EXCEPTION 'Complaint access required';
    ELSIF v_role = 'student' AND v_reporter IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Complaint not found or access denied';
    ELSIF v_role = 'department_authority' AND NOT public.campusfix_authority_issue_fence(v_department, v_verification) THEN
      RAISE EXCEPTION 'Department authority access required';
    END IF;
  END IF;

  INSERT INTO public.campusfix_issue_embeddings(issue_id, model, embedding)
  VALUES (p_issue_id, p_model, p_embedding)
  ON CONFLICT (issue_id) DO UPDATE SET model = EXCLUDED.model, embedding = EXCLUDED.embedding, created_at = now();

  RETURN QUERY SELECT * FROM public.campusfix_link_similar_issues(
    p_issue_id, p_same_category_threshold, p_cross_category_threshold, 5
  );
END
$function$;

ALTER FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campusfix_store_issue_embedding(uuid, text, real[], real, real) TO service_role;

COMMIT;

-- Verify: every embedding has 384 values; similarity rows never replace complaint rows.
-- SELECT count(*) FROM public.issues WHERE ai_category IS NOT NULL;
-- SELECT count(*) FROM public.campusfix_issue_embeddings;
-- SELECT count(*) FROM public.campusfix_issue_similarity;
