# CLAUDE.md: Project Specification & Senior Execution Memory

---

## 0. Session Handoff — 2026-06-19 (Phase 10.1 + 10.2 Verification & Commit)

### COMPLETED THIS SESSION
- **Phase 10.1 (Recall Purge) — verified in production DB:** User ran `supabase/migrations/phase-10.1-drop-context-recall.sql` in Supabase SQL Editor. Raw `information_schema` output confirmed `context_recall_score` removed from `evaluation_logs` and `avg_context_recall` removed from `experiment_runs`.
- **Phase 10.2 (Drift Reconciliation) — discovered via forensic re-verification:** The raw column query revealed the live `experiment_runs` table had drifted from `schema.sql`: `document_id` (FK to documents) and `metadata` (jsonb) were **missing**, despite being inserted by `/api/experiments/run` on every POST. This silently broke the experiment runner — every insert would 500. The earlier handoff's "PENDING: trigger a test experiment" step could not have passed in that state.
- **Drift fix applied:** User ran `supabase/migrations/phase-10.2-drift-reconciliation.sql` in Supabase. `information_schema` re-verification confirmed `evaluation_logs` = 12 columns (incl. orphan `experiment_id`, now documented in `schema.sql`), `experiment_runs` = 14 columns (incl. restored `document_id` + `metadata`).
- **Live smoke test — PASS:** POST `/api/experiments/run` against the reconciled schema inserted 2 configs cleanly ("Small chunks 256/32", "Medium chunks 512/50") with populated `document_id` (UUID `74aa652b-...`), populated `metadata` JSONB (per-query scores + rationale + match_count: 5), and real Ragas averages (`avg_faithfulness` 0.933 / 1.000). No `context_recall` anywhere in payload.
- **UI ghost fix:** `ExperimentLeaderboard.tsx:378` radar description "four core evaluation dimensions" → "three core evaluation dimensions (Faithfulness, Relevance, Precision)". Last recall-purge ghost.
- **Build gate:** `tsc --noEmit` EXIT 0 | `npm run build` EXIT 0 | 20/20 routes.
- **Committed & pushed:** Commit `c28ee06` on branch `phase-10.1-recall-purge`, 38 files (+4,234 / −639). Covers Phases 6–10.2 as a single audited unit (the working tree had accumulated through these phases without intermediate commits). PR pending user opening it via https://github.com/bluenose10/ai-eval-platform/pull/new/phase-10.1-recall-purge (`gh` CLI not available in dev env).

### NOTE ON PRIOR §0 HANDOFF
The earlier "Post Phase 10.1 Recall Purge" handoff (below) is preserved for audit trail. Its "PENDING — USER MUST DO" steps have now been executed and verified; its "KNOWN GHOST METRICS" note on Harmfulness remains valid (still static 0, still deferred).

### CURRENT TRUTH (authoritative as of 2026-06-19 EOD)
- **Live schema matches `schema.sql`.** Both tables reconciled. No known drift.
- **`/api/experiments/run` is functional in production.** Verified by live insert.
- **Metrics are exclusively Faithfulness, Relevance, Precision.** No ghost metrics remain in the data path. Harmfulness is a known static placeholder (chart-only), not a ghost.
- **Branch `phase-10.1-recall-purge` is pushed but NOT yet merged to `main`.** Local `main` still points at Phase 5 commit `923ed30` until the PR is merged.

### REMAINING — NEXT SESSION
- **User:** Open + review + merge the PR (`phase-10.1-recall-purge` → `main`).
- **Then:** Phase 10 presentation layer — cost maps, architecture charts, case studies.
- **Deferred:** Phase 11 (True Context Recall) — requires reference-answer schema + second judge pass.

---

## 0a. Session Handoff — 2026-06-19 (Post Phase 10.1 Recall Purge)

### COMPLETED THIS SESSION
- **Forensic Audit:** Discovered `context_recall` was a fabricated metric across the entire stack. The judge prompt (`src/lib/evaluation/judge.ts`) never computed Recall — every value was an aliased copy of `faithfulness`.
- **Phase 10.1 Purge:** Removed `context_recall` from all API routes (`/api/evaluate`, `/api/experiments/run`, `/api/experiments`), interfaces, UI components (`ExperimentLeaderboard.tsx`, `ragas-radar.tsx`, `evaluation/page.tsx`), and documentation (`README.md`, `CLAUDE.md`, `Playbook.md`, `layout.tsx`, `page.tsx`).
- **Ranking Bias Fix:** Leaderboard composite score renormalized from `(F+R+P+Recall)/4` to `(F+R+P)/3`. Recall was faithfulness in disguise, so faithfulness was silently double-weighted. Now corrected.
- **Latent Type Bug Fix:** Replaced unsafe `(run as Record<string, number>)` cast in `ExperimentLeaderboard.tsx:231` with type-safe `keyof ExperimentRun` accessor.
- **Harmfulness TODO:** Added TODO marker in `ragas-radar.tsx` — Harmfulness axis is a static placeholder (score: 0), not computed. Retained for chart stability; deferred to Phase 11.
- **Schema Fresh-Install:** Removed `context_recall_score` and `avg_context_recall` column definitions from `supabase/schema.sql`.
- **Migration SQL:** Drafted at `supabase/migrations/phase-10.1-drop-context-recall.sql` — `ALTER TABLE ... DROP COLUMN` for both tables.
- **Verification:** `tsc --noEmit` EXIT 0 | `npm run build` EXIT 0 | 20/20 routes compiled.

### PENDING — USER MUST DO (AI CANNOT EXECUTE THESE)
1. Deploy code to hosting (Netlify).
2. Run the migration in Supabase SQL Editor (`supabase/migrations/phase-10.1-drop-context-recall.sql`). **Must run AFTER code deploy** — dropping columns before the code stops referencing them will cause live 500s.
3. Verify `/dashboard/experiments` renders with 3-metric table (no Recall column) and 3-axis radar (Faithfulness, Relevance, Precision + Harmfulness placeholder).
4. Trigger a test experiment via `/api/experiments/run`, inspect `experiment_runs` table — confirm no `avg_context_recall` column exists and inserts succeed cleanly.

### FILES MODIFIED THIS SESSION
- `src/app/api/evaluate/route.ts` — 2 interfaces stripped, 5 aliasing sites removed
- `src/app/api/experiments/run/route.ts` — 2 interfaces stripped, alias + average + insert removed
- `src/app/api/experiments/route.ts` — destructure + insert field removed
- `supabase/schema.sql` — 2 column definitions removed
- `src/components/dashboard/ExperimentLeaderboard.tsx` — type, METRIC_LABELS, composite /3, table header/cell, copy, latent cast bug fixed
- `src/components/dashboard/ragas-radar.tsx` — Recall axis removed, Harmfulness TODO added
- `src/app/dashboard/evaluation/page.tsx` — Context Recall metric card removed
- `src/app/layout.tsx` — SEO meta: "& Recall" removed
- `src/app/page.tsx` — Landing copy: "& Recall" removed
- `CLAUDE.md` — Phase 7 claim fixed, Phase 11 roadmap entry added, this handoff added
- `docs/AI Knowledge Base Playbook.md` — Phase 7 claim updated

### FILES CREATED THIS SESSION
- `supabase/migrations/phase-10.1-drop-context-recall.sql`
- `src/app/dashboard/experiments/page.tsx` — Rewritten to render live ExperimentLeaderboard (was placeholder)

### DOCUMENTATION CONSOLIDATION (same session)
- **README.md** — Stripped duplicate env-var table, roadmap, technical defenses, and Windows dev notes. All replaced with a single pointer to CLAUDE.md.
- **KIMI.md** — Stripped phase gate table and status section. Replaced with CLAUDE.md pointer.
- **Playbook.md** — Stripped credentials map and 10-phase checklist. Converted to pure philosophy document (mission, stack summary, engineering principles) with CLAUDE.md pointer.
- **CLAUDE.md** — Now the sole Master Ledger for technical status, phase progress, credentials, and guardrails.

### REMAINING PHASE 10 WORK
- Cost maps, architecture charts, case studies (presentation layer)
- Experiment Leaderboard is now live (replaced hardcoded placeholder)

### KNOWN GHOST METRICS (NOT YET ADDRESSED)
- **Harmfulness** in `ragas-radar.tsx` — static 0, not computed. Marked with TODO. Out of scope until safety scoring infrastructure exists.

### WINDOWS LOAD-BEARING DEBT (DO NOT REMOVE)
- `next.config.mjs`: WindowsPathCasingFix webpack plugin + `cache: memory` + pinned `resolve.modules`. Required on NTFS.
- `NODE_TLS_REJECT_UNAUTHORIZED='0'` in dev only. Prod-safe. Long-term migrate to `--use-system-ca` / `NODE_EXTRA_CA_CERTS`.
- System-level env vars can shadow `.env.local`. If API keys fail despite valid `.env.local`, run `echo %VAR_NAME%` to check.

---

## 1. Knowledge Base Hierarchy (CRITICAL)

This project uses a dual-layer memory system. AI assistants must prioritise information as follows:

- **PDF Sources (The Strategic Compass):** Use these to maintain the Senior AI Architect persona. They define the "why" — moving from a "toy" chatbot to a Document-to-Evaluation architecture targeting a **90%+ Faithfulness score**.
- **Markdown Sources (The Technical Blueprints):** Use these for immediate technical reality. They store the current phase status, strict database schemas (1536-vectors), and mandatory execution guardrails.

---

## 2. Strategic Objective: "Not a Chatbot"

The objective is to architect a production-grade AI system that moves beyond the **"Upload-Chat-Hope" anti-pattern**. This is a scientific laboratory for AI that prioritises **Grounded AI**, **Empirical Evaluation**, and **Observability**.

- **The Mission:** Systematically measure and optimise RAG performance, targeting a minimum **90%+ Faithfulness score** via Ragas before any configuration is promoted.
- **Design Transparency:** The UI must clearly split "The AI Answer" from "The Evaluation" and its source chunks to prove data lineage.

---

## 3. Technical Stack & Ingestion Pipeline

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI |
| Backend / Database | Supabase (PostgreSQL + pgvector), Auth, and Storage |
| RAG Orchestration | LlamaIndex — **Mandatory:** use `SentenceSplitter` from `@llamaindex/core` |
| Models | Split Provider Strategy: `text-embedding-3-small` (1536-dimensional vectors), `gpt-4o-mini` (Chat Generation — high-volume, low-cost), `gpt-4o` (Ragas Evaluation Judge — maximum JSON fidelity / accuracy) |
| Evaluation & Tracing | Ragas Framework + Langfuse (SDK + OpenTelemetry) |

---

## 4. The Unified Ingestion Engine (`/api/process`)

Decoupled, multi-hop asynchronous architectures are explicitly rejected. The system enforces a **single atomic transaction**:

```
Fetch Storage File → LlamaIndex Token Chunking → OpenAI Vectorization → Atomic DB Insert
```

### Senior Execution Guardrails

| Guardrail | Rule |
|---|---|
| **Orchestration Library Lock** | Strictly use LlamaIndex node parsers (`SentenceSplitter`). No custom string slicing. |
| **Array Batch Limit (Anti-Crash)** | Process embeddings in deterministic batches of exactly **100 elements** to minimize network latency, avoid OpenAI RPM limits, and optimize ingestion speed while preserving atomic data integrity. |
| **Timeout Defence** | All route handlers must declare `export const runtime = "nodejs"` to bypass the 15-second serverless limit. |
| **Data Integrity** | A text block is only saved if its 1536-dimensional vector is successfully generated. |

---

## 5. Database Schema & Vector Integrity

- **Zero-Orphan Philosophy:** `document_chunks` implements `ON DELETE CASCADE` linked to the parent document. Deleting a document atomically cleans the vector space — preventing stale data and hidden cloud fees.
- **Vector Validation:** Structural health is confirmed via `vector_dims(embedding)`. The system enforces exactly **1536 dimensions**.
- **Cosine Similarity Engine:** Matches calculated via the `match_document_chunks` RPC using the `<=>` operator:

```
Similarity = 1 - (embedding <=> query_embedding)
```

---

## 6. Security & Isolation Boundaries

- **Multi-Tenant Isolation:** Row Level Security (RLS) enabled on all tables. Direct data reads restricted via `auth.uid() = user_id`.
- **Administrative Bypass:** Background ingestion and evaluation tasks use a privileged `supabaseAdmin` client via `SUPABASE_SERVICE_ROLE_KEY`.

---

## 7. 10-Phase Development Roadmap

| Phase | Name | Status |
|---|---|---|
| 1 | Project Setup | ✅ COMPLETE — Next.js skeleton with live Supabase Auth |
| 2 | File Management | ✅ COMPLETE — Secure PDF ingestion to Storage with metadata tracking |
| 3 | Processing & Text Extraction | ✅ COMPLETE — Unified pipelines turning inputs into text streams |
| 4 | Embeddings | ✅ COMPLETE — 1536-dimensional coordinates via `text-embedding-3-small` |
| 5 | Retrieval Engine | ✅ COMPLETE — `match_document_chunks` RPC verified in Supabase SQL Editor |
| 6 | AI Answers | ✅ COMPLETE — Grounded prompt execution parsing context arrays into responses |
| 7 | Automated Evaluation Engine (Ragas Framework & Telemetry Setup) | ✅ COMPLETE — Automated scoring via Ragas (Faithfulness, Relevance & Precision) |
| 8 | Advanced Observability & Deep Tracing (Langfuse SDK Integration) | ✅ COMPLETE — Full-stack tracing via parent-child spans in Langfuse |
| 9 | Observability & Tracing (OpenTelemetry Instrumentation & Live Dashboard) | ✅ COMPLETE — `instrumentation.ts` hook, OpenAI auto-instrumentation, live Langfuse connection status dashboard |
| 10 | The Experimentation Engine & Portfolio Polish | 🏗️ IN PROGRESS — Phase 10.3 (Cost Mapping + Split Provider Strategy) complete: CostAccumulator threaded through all 4 OpenAI sites, Cost column + Cheapest Config card on Leaderboard; gpt-4o-mini for chat generation, gpt-4o for Ragas judge; batch size 100; "Rule of Three" configs restored (256/32, 512/50, 1024/100). Architecture charts and case studies (presentation layer) still pending. |
| 11 | True Context Recall (Proposed) | 📋 DEFERRED — Ground-truth/reference-answer-dependent metric. Requires a new schema for reference answers per query + a second judge pass. Fabricated `avg_context_recall` column purged in Phase 10.1 integrity restoration. Out of scope until reference-answer infrastructure is built. |

---

## 8. Environment Credentials Status

| Variable | Status | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ ACTIVE | Core Database/Storage URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ ACTIVE | Client-side access |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ ACTIVE | Server-side ingestion bypass |
| `OPENAI_API_KEY` | ✅ ACTIVE | Embeddings & Generation Inference |
| `LANGFUSE_PUBLIC_KEY` | ✅ ACTIVE | Langfuse observability public key |
| `LANGFUSE_SECRET_KEY` | ✅ ACTIVE | Langfuse observability secret key |
| `LANGFUSE_HOST` | ✅ ACTIVE | Langfuse host (default: `https://cloud.langfuse.com`) — used by `instrumentation.ts` and accepted as alias by `src/lib/langfuse.ts` |
| `LANGFUSE_BASEURL` | ✅ ACTIVE | Legacy alias for `LANGFUSE_HOST` |

---

## 9. Technical Defenses Deployed (Phases 8 & 9)

- **Trace Context Propagation:** Wired `/api/chat` parent trace generation to pass `traceId` down to the UI, which seamlessly hydrates the `/api/evaluate` payload so Ragas scores and judge rationale are attached to the same unified trace.
- **Ingestion Idempotency & No-Op Client:** Built safe placeholder detection in `src/lib/langfuse.ts` to prevent backend app crashes when API keys are absent, empty, or contain dummy values. The no-op client mirrors the Langfuse surface used by API routes so tracing becomes transparently optional.
- **OpenTelemetry Hook Isolation:** `instrumentation.ts` is gated to `process.env.NEXT_RUNTIME === "nodejs"` and loads heavy OTel packages dynamically. It never interferes with the atomic ingestion or retrieval transactions.
- **Server-Only Secret Handling:** The observability dashboard page declares `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` so Langfuse credentials are read server-side and the live connection status is refreshed per request.
 
 
 Phase 12: Semantic Caching (Vector-based FAQ matching to reduce OpenAI costs for high-traffic B2B clients)." This ensures you don't forget this brilliant idea when you are ready to build it.