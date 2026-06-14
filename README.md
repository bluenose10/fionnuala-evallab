# EvalLab — AI Knowledge Base Evaluation Platform

> Accuracy-First AI. A scientific laboratory for **Grounded RAG** — measure
> Faithfulness, Relevance, Precision & Recall instead of guessing. **Not a chatbot.**

This repo currently contains the **Phase 1 skeleton**: a production-grade
Next.js + Supabase shell, ready for the RAG engine in Phase 2+.

## Stack

| Layer        | Tech                                              |
| ------------ | ------------------------------------------------- |
| Frontend     | Next.js 14 (App Router), TypeScript, Tailwind     |
| UI           | Shadcn UI (New York / Slate), Recharts            |
| Auth/DB      | Supabase (Postgres + pgvector), RLS               |
| RAG (later)  | LlamaIndex                                        |
| Models       | OpenAI GPT-4o + text-embedding-3-small            |
| Evaluation   | Ragas                                             |
| Tracing      | Langfuse                                          |

## Getting started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   ```
   Fill in your Supabase project URL + anon key (Project Settings → API).
   OpenAI / Langfuse keys can wait until later phases.

3. **Set up the database**
   Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
   This enables `pgvector` and creates the RLS-protected `documents` table.

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000.

## What's in the skeleton

- **Landing page** — "Accuracy-First AI / Eliminating Hallucinations".
- **Auth** — `/login` + `/signup` wired to Supabase Auth, with email-confirmation
  flow and an `/auth/callback` route.
- **Protected dashboard** (`middleware.ts` guards `/dashboard`):
  - **Overview** — metric cards + 10-phase roadmap.
  - **Document Manager** — file-drop zone + metadata table.
  - **QA & Retrieval Lab** — side-by-side "The AI Answer" vs "Retrieved Chunks".
  - **Evaluation Hub** — Ragas radar (spider) chart + metric breakdown.
  - **Experiment Leaderboard** — chunk size / retrieval / prompt comparison.
  - **Observability** — Langfuse status + trace hierarchy preview.

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
    dashboard/                    # sidebar, ragas-radar
  lib/
    supabase/                     # browser + server + middleware clients
    utils.ts
middleware.ts                     # protects /dashboard via Supabase Auth
supabase/schema.sql               # pgvector + documents table + RLS
```

## Roadmap

Phase 1 ✅ Setup · 2 Uploads · 3 Processing · 4 Vectorization · 5 Retrieval ·
6 AI Answers · 7 Evaluation · 8 Experiments · 9 Observability · 10 Polish.
