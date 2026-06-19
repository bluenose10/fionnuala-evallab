# EvalLab — AI Knowledge Base Evaluation Platform

> Accuracy-First AI. A scientific laboratory for **Grounded RAG** — measure
> Faithfulness, Relevance & Precision instead of guessing. **Not a chatbot.**

This repo contains a production-grade Next.js + Supabase RAG evaluation platform. Phases 1–9 are implemented, including the unified ingestion engine, retrieval, grounded synthesis, Ragas evaluation, Langfuse manual tracing, and OpenTelemetry auto-instrumentation.

## Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind |
| UI | Shadcn UI (New York / Slate), Recharts |
| Auth/DB | Supabase (Postgres + pgvector), RLS |
| RAG Engine | LlamaIndex Orchestration |
| Models | OpenAI GPT-4o + text-embedding-3-small |
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

## What's in the skeleton

* **Landing page** — "Accuracy-First AI / Eliminating Hallucinations".
* **Auth** — `/login` + `/signup` wired to Supabase Auth, with email-confirmation flow and an `/auth/callback` route.
* **Protected dashboard** (`middleware.ts` guards `/dashboard`):
  * **Overview** — metric cards.
  * **Document Manager** — file-drop zone + metadata table.
  * **QA & Retrieval Lab** — side-by-side "The AI Answer" vs "Retrieved Chunks".
  * **Evaluation Hub** — Ragas radar chart + metric breakdown.
  * **Experiment Leaderboard** — live comparison of chunk sizes, retrieval strategies, and prompt templates backed by Ragas scores.
  * **Observability** — Langfuse live tracing with parent-child spans, plus OpenTelemetry auto-instrumentation.

---

## Project structure

```
src/
  app/
    (auth)/login, (auth)/signup   # auth pages
    auth/callback, auth/signout   # auth route handlers
    dashboard/                    # protected app shell + feature pages
    layout.tsx, page.tsx          # root layout + landing page
  components/
    ui/                           # shadcn primitives
    dashboard/                    # sidebar, ragas-radar, leaderboard
  lib/
    supabase/                     # browser + server + middleware clients
    evaluation/                   # Ragas judge + scoring
    langfuse.ts                   # observability client (with no-op fallback)
  middleware.ts                   # protects /dashboard via Supabase Auth
supabase/
  schema.sql                      # pgvector + tables + RLS + RPCs
  migrations/                     # incremental migration scripts
```

---

> **Technical status, phase progress, environment credentials, execution guardrails, and Windows development notes are maintained in [CLAUDE.md](CLAUDE.md).**
