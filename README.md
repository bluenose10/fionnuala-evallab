# fionnuala — fionnuala AI Knowledge Base

> Accuracy-First AI. A scientific laboratory for **Grounded RAG** — measure
> Faithfulness, Relevance & Precision instead of guessing. **Not a chatbot.**

This repo contains a production-grade Next.js + Supabase RAG evaluation platform. All 12 phases are implemented, including the unified ingestion engine, retrieval, grounded synthesis, Ragas evaluation, Langfuse tracing, OpenTelemetry auto-instrumentation, the Experimentation Engine with experiment-scoped cost mapping, the Deployment Bridge with public API keys, and Phase 12 Semantic Caching for zero-cost repeat query serving.

## Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind |
| UI | Shadcn UI (dark green theme), Recharts |
| Auth/DB | Supabase (Postgres + pgvector), RLS |
| RAG Engine | LlamaIndex Orchestration |
| Models | Split Provider Strategy: gpt-4o-mini (Chat) + gpt-4o (Judge) + text-embedding-3-small (Embeddings) |
| Evaluation | Ragas Framework — 3 Core Metrics (Faithfulness, Relevance, Context Precision) |
| Tracing | Langfuse Observability (SDK + OpenTelemetry) |
| Caching | Semantic cache via pgvector cosine similarity (HNSW indexed, 7-day TTL) |

---

## Getting started

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.local.example .env.local
```
Fill in your Supabase project URL + anon key, along with your `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY`. Langfuse credentials (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`) are required to enable observability; without them the app boots safely with tracing disabled.

3. **Set up the database**
   Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). This enables `pgvector` and creates all RLS-protected tables including `semantic_cache`.

4. **Create the first user**
   There is no self-serve signup. Create the client's account manually in Supabase Auth (Authentication → Users → Add user). The homepage login screen is the only entry point.

5. **Run the dev server**
```bash
npm run dev
```
Visit http://localhost:3000.

---

## What's in the platform

* **Homepage** — Dark glassmorphism login screen. Authenticates via Supabase Auth and redirects to `/dashboard`. No marketing page, no signup, no forgot password — per-client deployment model.
* **Protected dashboard** (`middleware.ts` guards `/dashboard`):
  * **Overview** — metric cards: Documents Indexed, Avg Faithfulness, Experiments Run, Monthly Cost.
  * **Document Manager** — multi-file drag & drop with auto-chunking queue. Files are uploaded, chunked, and vectorised sequentially with a progress indicator. Real-time filename search.
  * **QA & Retrieval Lab** — ask questions against the knowledge base, inspect grounded answers and collapsible retrieved chunks.
  * **Experiment Leaderboard** — live A/B comparison of chunk configurations (256/32, 512/50, 1024/100) ranked by Ragas scores and cost. Auto-winner logic promotes the best-performing config to the live endpoint automatically.
  * **Observability** — Langfuse live tracing with parent-child spans, plus OpenTelemetry auto-instrumentation.
  * **Deploy** — Public API key management. Clients embed a single API key to connect their website or CRM to the RAG endpoint.

* **Public RAG endpoint** — `/api/public/chat` authenticates via `client_api_keys`, checks the semantic cache first (instant return at similarity ≥ 0.95), falls back to full RAG pipeline on cache miss. Auto-winner config ensures answers come from the experiment-verified best configuration. Cache entries expire after 7 days.

---

## Deployment model

fionnuala is deployed as a **per-client installation** — each client gets their own Vercel project, Supabase project, API key, and login credentials. There is no shared multi-tenant SaaS infrastructure. Accounts are created manually by the administrator in Supabase Auth.

---

## Project structure

```
src/
  app/
    auth/callback, auth/signout   # auth route handlers
    api/public/chat               # public RAG chatbot endpoint (API key auth + semantic cache)
    dashboard/                    # protected app shell + feature pages
    layout.tsx                    # root layout (dark theme)
    page.tsx                      # homepage login screen
  components/
    ui/                           # shadcn primitives
    dashboard/                    # sidebar, ragas-radar, leaderboard, lab-interface
  lib/
    supabase/                     # browser + server + middleware clients
    evaluation/                   # Ragas judge + scoring
    langfuse.ts                   # observability client (with no-op fallback)
    pricing.ts                    # centralised OpenAI token rate constants
  middleware.ts                   # protects /dashboard via Supabase Auth
supabase/
  schema.sql                      # pgvector + tables + RLS + RPCs + semantic_cache
  migrations/                     # incremental migration scripts
```

---

> **Technical status, phase progress, environment credentials, execution guardrails, and session handoff notes are maintained in [CLAUDE.md](CLAUDE.md).**
