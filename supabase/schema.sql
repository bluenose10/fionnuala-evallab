-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 1 database foundation
-- Run this in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1. Enable pgvector (required for embeddings in Phase 4).
create extension if not exists vector;

-- 2. Documents table — tracks every uploaded source file.
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  storage_path text,
  size_bytes  bigint,
  mime_type   text,
  status      text not null default 'uploaded'
                check (status in ('uploaded', 'processing', 'indexed', 'failed')),
  chunk_count integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists documents_user_id_idx on public.documents (user_id);

-- 3. Row Level Security — isolate every user's data (Phase 1 requirement).
alter table public.documents enable row level security;

-- drop-then-recreate makes these policies safe to re-run.
drop policy if exists "Users can view their own documents"   on public.documents;
drop policy if exists "Users can insert their own documents" on public.documents;
drop policy if exists "Users can update their own documents" on public.documents;
drop policy if exists "Users can delete their own documents" on public.documents;

-- A user can only see their own documents.
create policy "Users can view their own documents"
  on public.documents for select
  using (auth.uid() = user_id);

-- A user can only insert documents owned by themselves.
create policy "Users can insert their own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

-- A user can only update their own documents.
create policy "Users can update their own documents"
  on public.documents for update
  using (auth.uid() = user_id);

-- A user can only delete their own documents.
create policy "Users can delete their own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- NOTE: The `document_chunks` table with a `vector` column and the
-- ivfflat / hnsw index arrives in Phase 4 (Vectorization).
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 2: Supabase Storage bucket + RLS
-- Paste this block into the Supabase SQL Editor and run it.
-- ─────────────────────────────────────────────────────────────

-- 1. Create a private storage bucket for uploaded PDFs.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- 2. Storage RLS — users may only access their own folder.
--    Path convention: {user_id}/{timestamp}_{filename}
--    The first path segment must equal the authenticated user's UUID.
--    drop-then-recreate makes this block safe to re-run.

drop policy if exists "Users can upload their own documents" on storage.objects;
drop policy if exists "Users can read their own documents"   on storage.objects;
drop policy if exists "Users can delete their own documents" on storage.objects;

create policy "Users can upload their own documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read their own documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own documents"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 3+4: document_chunks table + RLS + hnsw index
-- Append this block and run in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- 1. document_chunks — stores parsed text and its pgvector embedding.
create table if not exists public.document_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  content      text not null,
  chunk_index  integer not null,
  token_count  integer,
  embedding    vector(1536),
  created_at   timestamptz not null default now()
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

-- 2. RLS — users see only their own chunks.
alter table public.document_chunks enable row level security;

drop policy if exists "Users can view their own chunks"   on public.document_chunks;
drop policy if exists "Users can insert their own chunks" on public.document_chunks;
drop policy if exists "Users can delete their own chunks" on public.document_chunks;

create policy "Users can view their own chunks"
  on public.document_chunks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own chunks"
  on public.document_chunks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own chunks"
  on public.document_chunks for delete
  using (auth.uid() = user_id);

-- 3. hnsw index for cosine similarity search (Phase 5 retrieval).
--    on delete cascade on document_id means deleting a document
--    auto-deletes all its chunks.
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 5: match_document_chunks RPC
-- Append this block and run in the Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────

-- Cosine similarity search over document_chunks.
-- Returns the top match_count chunks closest to query_embedding.
-- User isolation is enforced at the function level via filter_user_id
-- (defence-in-depth on top of the service-role client that calls it).
create or replace function match_document_chunks(
  query_embedding    vector(1536),
  match_count        int     default 5,
  filter_user_id     uuid    default null,
  filter_document_id uuid    default null
)
returns table (
  id          uuid,
  document_id uuid,
  content     text,
  similarity  float
)
as $$
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
  order by dc.embedding <=> query_embedding
  limit match_count;
$$
language sql stable;
