-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 10.3: Verify / Create HNSW Index
--
-- The schema.sql already declares this index (Phase 4), but given
-- the Phase 10.2 drift discovery where live columns were silently
-- missing despite being in schema.sql, we verify defensively.
--
-- Run this in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1. Check whether the index exists on the live database.
--    If the row below returns a result, the index is already present
--    and the CREATE INDEX below is a safe no-op (IF NOT EXISTS).
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'document_chunks'
  AND indexname = 'document_chunks_embedding_hnsw_idx';

-- 2. Create the HNSW index if it was somehow dropped or never applied.
--    HNSW is vastly superior to IVFFlat for RAG workloads:
--    no training phase required, higher recall at equal speed.
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON public.document_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 3. Verify the index is active by running an EXPLAIN on a sample query.
--    You should see "Index Scan using document_chunks_embedding_hnsw_idx"
--    in the output — NOT "Seq Scan on document_chunks".
EXPLAIN (COSTS OFF)
SELECT id, content, 1 - (embedding <=> '[0.1, 0.2, 0.3]'::vector) AS similarity
FROM public.document_chunks
ORDER BY embedding <=> '[0.1, 0.2, 0.3]'::vector
LIMIT 5;
