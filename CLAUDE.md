# CLAUDE.md: Project Specification & Senior Execution Memory

---

## 0. Session Handoff — 2026-06-19 (Post Phase 10.1 Recall Purge)

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
| Models | OpenAI GPT-4o/5 (Reasoning) + `text-embedding-3-small` (1536-dimensional vectors) |
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
| **Array Batch Limit (Anti-Crash)** | Process embeddings in deterministic batches of exactly **20 elements** to avoid OpenAI 429 errors and DB pool lag. |
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
| 10 | The Experimentation Engine & Portfolio Polish | 🏗️ IN PROGRESS — Backend experiment runner (`/api/experiments/run`) complete and writing to `experiment_runs`; dashboard UI, cost maps, architecture charts, and case studies pending |
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
