-- ─────────────────────────────────────────────────────────────
-- EvalLab — Complete Database Schema (Phases 1–12)
-- Run this in the Supabase SQL Editor on a fresh project.
-- Safe to re-run — uses IF NOT EXISTS and DROP/RECREATE for policies.
-- ─────────────────────────────────────────────────────────────

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────
-- DOCUMENTS TABLE (Phase 1)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name         text NOT NULL,
  storage_path text,
  size_bytes   bigint,
  mime_type    text,
  status       text NOT NULL DEFAULT 'uploaded'
                 CHECK (status IN ('uploaded', 'processing', 'indexed', 'failed')),
  chunk_count  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON public.documents (user_id);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own documents"   ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

CREATE POLICY "Users can view their own documents"   ON public.documents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own documents" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON public.documents FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- STORAGE BUCKET + RLS (Phase 2)
-- ─────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own documents"   ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;

CREATE POLICY "Users can upload their own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────
-- DOCUMENT CHUNKS TABLE (Phases 3 & 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  content     text NOT NULL,
  chunk_index integer NOT NULL,
  token_count integer,
  embedding   vector(1536),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON public.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own chunks"   ON public.document_chunks;
DROP POLICY IF EXISTS "Users can insert their own chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete their own chunks" ON public.document_chunks;

CREATE POLICY "Users can view their own chunks"   ON public.document_chunks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chunks" ON public.document_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chunks" ON public.document_chunks FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- MATCH DOCUMENT CHUNKS RPC (Phase 5)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding    vector(1536),
  match_count        int     DEFAULT 3,
  match_threshold    float   DEFAULT 0.3,
  filter_user_id     uuid    DEFAULT NULL,
  filter_chunk_size  integer DEFAULT NULL
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
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─────────────────────────────────────────────────────────────
-- EVALUATION LOGS TABLE (Phase 7)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evaluation_logs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document_id             uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  query_text              text NOT NULL,
  generated_answer        text NOT NULL,
  faithfulness_score      numeric(4,3) NOT NULL,
  answer_relevance_score  numeric(4,3) NOT NULL,
  context_precision_score numeric(4,3) NOT NULL,
  rationale               text NOT NULL,
  retrieved_context       jsonb NOT NULL DEFAULT '[]'::jsonb,
  experiment_id           uuid,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evaluation_logs_user_id_idx     ON public.evaluation_logs (user_id);
CREATE INDEX IF NOT EXISTS evaluation_logs_document_id_idx ON public.evaluation_logs (document_id);
ALTER TABLE public.evaluation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own evaluation logs"   ON public.evaluation_logs;
DROP POLICY IF EXISTS "Users can insert their own evaluation logs" ON public.evaluation_logs;
DROP POLICY IF EXISTS "Users can delete their own evaluation logs" ON public.evaluation_logs;

CREATE POLICY "Users can view their own evaluation logs"   ON public.evaluation_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own evaluation logs" ON public.evaluation_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evaluation logs" ON public.evaluation_logs FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- EXPERIMENT RUNS TABLE (Phase 8)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experiment_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  document_id           uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  configuration_name    text NOT NULL,
  chunk_size            integer NOT NULL,
  chunk_overlap         integer NOT NULL DEFAULT 0,
  prompt_template       text,
  model_name            text NOT NULL DEFAULT 'gpt-4o',
  avg_faithfulness      numeric(4,3) NOT NULL DEFAULT 0,
  avg_answer_relevance  numeric(4,3) NOT NULL DEFAULT 0,
  avg_context_precision numeric(4,3) NOT NULL DEFAULT 0,
  total_queries_tested  integer NOT NULL DEFAULT 0,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiment_runs_user_id_idx     ON public.experiment_runs (user_id);
CREATE INDEX IF NOT EXISTS experiment_runs_document_id_idx ON public.experiment_runs (document_id);
ALTER TABLE public.experiment_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own experiment runs"   ON public.experiment_runs;
DROP POLICY IF EXISTS "Users can insert their own experiment runs" ON public.experiment_runs;
DROP POLICY IF EXISTS "Users can delete their own experiment runs" ON public.experiment_runs;

CREATE POLICY "Users can view their own experiment runs"   ON public.experiment_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own experiment runs" ON public.experiment_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own experiment runs" ON public.experiment_runs FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- CLIENT API KEYS TABLE (Phase 11)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_api_keys (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  api_key    text NOT NULL UNIQUE,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_api_keys_user_id_idx ON public.client_api_keys (user_id);
CREATE INDEX IF NOT EXISTS client_api_keys_api_key_idx ON public.client_api_keys (api_key);
ALTER TABLE public.client_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own API keys"   ON public.client_api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.client_api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.client_api_keys;

CREATE POLICY "Users can view their own API keys"   ON public.client_api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own API keys" ON public.client_api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own API keys" ON public.client_api_keys FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- SEMANTIC CACHE TABLE + RPC (Phase 12)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.semantic_cache (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL,
  question_text      text NOT NULL,
  question_embedding vector(1536) NOT NULL,
  answer             text NOT NULL,
  sources            jsonb NOT NULL,
  chunk_size         integer NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  expires_at         timestamptz NOT NULL DEFAULT now() + interval '7 days'
);

CREATE INDEX IF NOT EXISTS semantic_cache_user_id_idx ON public.semantic_cache (user_id);
CREATE INDEX IF NOT EXISTS semantic_cache_embedding_hnsw_idx
  ON public.semantic_cache USING hnsw (question_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ALTER TABLE public.semantic_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.match_semantic_cache(
  query_embedding  vector(1536),
  match_threshold  float   DEFAULT 0.95,
  match_user_id    uuid    DEFAULT NULL
)
RETURNS TABLE (
  id         uuid,
  answer     text,
  sources    jsonb,
  chunk_size integer,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sc.id,
    sc.answer,
    sc.sources,
    sc.chunk_size,
    1 - (sc.question_embedding <=> query_embedding) AS similarity
  FROM public.semantic_cache sc
  WHERE
    (match_user_id IS NULL OR sc.user_id = match_user_id)
    AND sc.expires_at > now()
    AND (1 - (sc.question_embedding <=> query_embedding)) >= match_threshold
  ORDER BY sc.question_embedding <=> query_embedding
  LIMIT 1;
$$;
-- ─────────────────────────────────────────────────────────────────
-- PUBLIC INTERACTION LOGS TABLE (Phase 13 - Audit Trail)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.public_interaction_logs (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL,
  question   text NOT NULL,
  answer     text NOT NULL,
  sources    jsonb,
  cached     boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS public_interaction_logs_user_created_idx
  ON public.public_interaction_logs (user_id, created_at DESC);

ALTER TABLE public.public_interaction_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own logs" ON public.public_interaction_logs;
CREATE POLICY "Users can view their own logs"
  ON public.public_interaction_logs FOR SELECT
  USING (auth.uid() = user_id);