# EvalLab — AI Knowledge Base Evaluation Platform

> Accuracy-First AI. A scientific laboratory for **Grounded RAG** — measure
> Faithfulness, Relevance & Precision instead of guessing. **Not a chatbot.**

This repo contains a production-grade Next.js + Supabase RAG evaluation platform. Phases 1–11 are implemented, including the unified ingestion engine, retrieval, grounded synthesis, Ragas evaluation, Langfuse manual tracing, OpenTelemetry auto-instrumentation, the Experimentation Engine with experiment-scoped cost mapping, and the Deployment Bridge with public API keys and a RAG-based public chatbot endpoint.

## Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind |
| UI | Shadcn UI (New York / Slate), Recharts |
| Auth/DB | Supabase (Postgres + pgvector), RLS |
| RAG Engine | LlamaIndex Orchestration |
| Models | Split Provider Strategy: gpt-4o-mini (Chat) + gpt-4o (Judge) + text-embedding-3-small (Embeddings) |
| Evaluation | Ragas Framework — 3 Core Metrics (Faithfulness, Relevance, Context Precision) |
| Tracing | Langfuse Observability (SDK + OpenTelemetry) |

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
   Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql). This enables `pgvector` and creates the RLS-protected tables, confirming the `embedding` column maps to a `USER-DEFINED` `vector` type.

4. **Run the dev server**
```bash
npm run dev
```
Visit http://localhost:3000.

---

## What's in the platform

* **Landing page** — "Accuracy-First AI / Eliminating Hallucinations".
* **Auth** — `/login` + `/signup` wired to Supabase Auth, with email-confirmation flow and an `/auth/callback` route.
* **Protected dashboard** (`middleware.ts` guards `/dashboard`):
  * **Overview** — metric cards.
  * **Document Manager** — file-drop zone + metadata table with real-time filename search.
  * **QA & Retrieval Lab** — side-by-side "The AI Answer" vs "Retrieved Chunks" with Ragas scoring.
  * **Evaluation Hub** — Ragas radar chart + metric breakdown.
  * **Experiment Leaderboard** — live A/B comparison of chunk configurations (256/32, 512/50, 1024/100) ranked by Ragas scores and cost. Auto-winner logic promotes the best-performing config to the live endpoint automatically.
  * **Observability** — Langfuse live tracing with parent-child spans, plus OpenTelemetry auto-instrumentation.
  * **Deploy** — Public API key management. Clients embed a single API key to connect their website or CRM to the RAG endpoint.

* **Public RAG endpoint** — `/api/public/chat` authenticates via `client_api_keys`, retrieves the auto-winner config from experiment data, and returns grounded answers + source chunks. No Supabase Auth required on the client side.

---

## Project structure

```
src/
  app/
    (auth)/login, (auth)/signup   # auth pages
    auth/callback, auth/signout   # auth route handlers
    api/public/chat               # public RAG chatbot endpoint (API key auth)
    dashboard/                    # protected app shell + feature pages
    layout.tsx, page.tsx          # root layout + landing page
  components/
    ui/                           # shadcn primitives
    dashboard/                    # sidebar, ragas-radar, leaderboard
  lib/
    supabase/                     # browser + server + middleware clients
    evaluation/                   # Ragas judge + scoring
    langfuse.ts                   # observability client (with no-op fallback)
    pricing.ts                    # centralised OpenAI token rate constants
  middleware.ts                   # protects /dashboard via Supabase Auth
supabase/
  schema.sql                      # pgvector + tables + RLS + RPCs
  migrations/                     # incremental migration scripts
```

---

> **Technical status, phase progress, environment credentials, execution guardrails, and session handoff notes are maintained in [CLAUDE.md](CLAUDE.md).**
