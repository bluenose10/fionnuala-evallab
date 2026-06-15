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
