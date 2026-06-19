-- ─────────────────────────────────────────────────────────────
-- EvalLab — Phase 10.1: Integrity Restoration (The Recall Purge)
--
-- Removes the fabricated context_recall metric from the database.
-- A forensic audit confirmed that every context_recall value in the
-- system was an aliased copy of faithfulness — the judge prompt
-- (src/lib/evaluation/judge.ts) never computed a real Recall score.
--
-- IMPORTANT: Run this migration ONLY after deploying the code changes
-- that strip all context_recall references from the API routes and UI.
-- If you drop these columns first, the old code will fail on INSERT
-- because the NOT NULL constraint disappears mid-flight.
-- ─────────────────────────────────────────────────────────────

-- 1. evaluation_logs: drop the aliased context_recall_score column.
--    Was NOT NULL, always populated with a copy of faithfulness_score.
alter table public.evaluation_logs
  drop column if exists context_recall_score;

-- 2. experiment_runs: drop the aliased avg_context_recall column.
--    Was NOT NULL default 0, populated via faithfulness aliasing.
alter table public.experiment_runs
  drop column if exists avg_context_recall;
