-- Phase 10.3: Retrieval threshold tuning
-- Adds match_threshold to match_document_chunks so low-similarity noise is
-- filtered at the database layer. Default Top-K lowered to 3.
--
-- Run this in Supabase SQL Editor before deploying API changes that pass
-- match_threshold: 0.2 from /api/chat and /api/retrieve.

create or replace function match_document_chunks(
  query_embedding    vector(1536),
  match_count        int     default 3,
  match_threshold    float   default 0.2,
  filter_user_id     uuid    default null,
  filter_document_id uuid    default null
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
as $func$
  select
    dc.id,
    dc.document_id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where
    (filter_user_id     is null or dc.user_id     = filter_user_id)
    and
    (filter_document_id is null or dc.document_id = filter_document_id)
    and
    (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$func$
language sql stable;
