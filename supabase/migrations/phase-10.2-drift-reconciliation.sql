-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 10.2: Drift Reconciliation
--
-- Forensic re-verification of the live schema against information_schema
-- (2026-06-19) revealed that experiment_runs had drifted from the
-- canonical schema.sql: the `document_id` and `metadata` columns that
-- /api/experiments/run inserts on every POST were missing in the live
-- DB. This broke the experiment runner — every insert would 500.
--
-- This migration restores parity between live state and schema.sql.
-- Run AFTER Phase 10.1 (recall purge) and BEFORE the live smoke test
-- of /api/experiments/run.
--
-- Safety notes:
--   * `add column if not exists` is idempotent — safe to re-run.
--   * `document_id` is added as NULLABLE, not NOT NULL, to avoid
--     failing on any existing rows. The route handler always supplies
--     a value, so nullable-vs-notnull has no effect on the code path.
--     Promote to NOT NULL only after confirming zero NULL rows.
--   * `metadata` is added with a non-null default '{}' so existing
--     rows backfill cleanly.
-- ─────────────────────────────────────────────────────────────

-- 1. experiment_runs: restore document_id (FK to documents, cascade on delete).
--    Required by /api/experiments/run route handler on every insert.
alter table public.experiment_runs
  add column if not exists document_id uuid
  references public.documents (id) on delete cascade;

-- Index to match schema.sql canonical definition.
create index if not exists experiment_runs_document_id_idx
  on public.experiment_runs (document_id);

-- 2. experiment_runs: restore metadata jsonb column.
--    Required by /api/experiments/run — stores per-query scores + rationale.
alter table public.experiment_runs
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 3. Verification query — run AFTER this migration to confirm parity.
--    Expected: experiment_runs shows 14 columns including document_id + metadata.
--    Expected: evaluation_logs still shows 12 columns including experiment_id.
--
--    SELECT table_name, column_name, data_type
--    FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name IN ('evaluation_logs', 'experiment_runs')
--    ORDER BY table_name, ordinal_position;
