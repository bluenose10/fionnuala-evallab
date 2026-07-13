-- ─────────────────────────────────────────────────────────────
-- Migration: add a genuinely working filter_document_id parameter
-- to match_document_chunks.
--
-- BACKGROUND: the app code (QA Lab "Search within" dropdown) has been
-- calling this RPC with a filter_document_id parameter since early phases,
-- but the SQL function never actually had that parameter — it was silently
-- ignored, so scoping to a single document never worked. The dropdown UI
-- always searched across ALL of a user's documents regardless of selection.
--
-- SAFE TO RE-RUN: explicitly drops the old 5-argument signature first, then
-- creates the single canonical 6-argument version. This avoids the
-- "multiple overloaded versions" trap flagged in KIMI.md — CREATE OR REPLACE
-- alone would NOT replace this function, since changing the argument list
-- creates a second overloaded function instead of replacing the first.
-- ─────────────────────────────────────────────────────────────

-- 1. Confirm what currently exists (informational — run this first and look
--    at the output before proceeding, especially if this project has ever
--    had ad-hoc function edits applied outside of schema.sql).
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'match_document_chunks';

-- 2. Drop the old 5-argument version explicitly by its exact signature.
DROP FUNCTION IF EXISTS public.match_document_chunks(
  vector, int, float, uuid, integer
);

-- 3. Create the single canonical version with the new parameter added.
--    filter_document_id defaults to NULL, so every existing caller that
--    doesn't pass it (there shouldn't be any after this migration, but just
--    in case) continues to search across all documents, unchanged.
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding     vector(1536),
  match_count         int     DEFAULT 3,
  match_threshold     float   DEFAULT 0.3,
  filter_user_id      uuid    DEFAULT NULL,
  filter_chunk_size   integer DEFAULT NULL,
  filter_document_id  uuid    DEFAULT NULL
)
RETURNS TABLE (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE
    (filter_user_id IS NULL OR dc.user_id = filter_user_id)
    AND (filter_document_id IS NULL OR dc.document_id = filter_document_id)
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 4. Verify: exactly ONE version of this function should exist after this
--    migration runs. Run this and confirm a single row comes back:
--    SELECT proname, pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'match_document_chunks';
--    Expected output:
--    query_embedding vector, match_count integer, match_threshold double
--    precision, filter_user_id uuid, filter_chunk_size integer,
--    filter_document_id uuid