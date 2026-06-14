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

## Environment variables

All credentials live in `.env.local` (never committed). Copy the example
file and fill in the values as you progress through the phases.

| Variable                        | Required from phase | Notes                              |
|---------------------------------|---------------------|------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`      | Phase 1 → 2         | Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Phase 1 → 2         | Supabase anon/public key           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Phase 2             | Server-only — never expose to browser |
| `OPENAI_API_KEY`                | Phase 4             | Embeddings + generation            |
| `LANGFUSE_PUBLIC_KEY`           | Phase 9             | Observability tracing              |
| `LANGFUSE_SECRET_KEY`           | Phase 9             | Observability tracing              |
| `LANGFUSE_HOST`                 | Phase 9             | e.g. `https://cloud.langfuse.com`  |

> **All values in `.env.local` are currently dummy placeholders.** The app
> boots and builds, but auth, storage, and AI features will not function
> until real keys are provided. Do not attempt to use the dummy keys against
> live APIs — they cause silent failures and misleading errors.

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

---

## Developer Notes

### Windows: "Invariant: Missing ActionQueueContext" on `npm run dev`

**Symptoms**

Running `npm run dev` on Windows produced two sets of errors:

1. Webpack warnings in the terminal:
   ```
   There are multiple modules with names that only differ in casing.
   C:\Users\User\Desktop\AI Eval Platform\node_modules\next\...
   C:\Users\User\desktop\AI Eval Platform\node_modules\next\...
   ```

2. A fatal hydration error in the browser console:
   ```
   Uncaught Error: Invariant: Missing ActionQueueContext
   ```
   followed by the entire page falling back to client rendering.

**Root cause**

Windows NTFS is case-insensitive but case-preserving. Somewhere inside
Next.js's webpack setup, module paths were being constructed
programmatically with the wrong casing (`desktop` instead of `Desktop`).
Because those paths were built as strings rather than looked up from the
filesystem, the normal resolver never corrected them.

Webpack uses the resolved resource path as a module's unique ID. When the
same file appeared under two differently-cased paths, webpack created two
separate module instances. React's context system is instance-based, so
the `ActionQueueContext` provider from one instance was invisible to the
consumer in the other — hence the "Missing ActionQueueContext" error.

**Fix — `next.config.mjs`**

The fix hooks into webpack's `NormalModuleFactory.afterResolve` stage,
which fires just before webpack generates a module's ID. At that point we
rewrite any path field that case-insensitively matches the project root to
the canonical on-disk casing (obtained via `fs.realpathSync`). This
guarantees every file has exactly one module instance, regardless of how
webpack constructed the path string internally.

Two supporting changes are also in place:
- `config.cache = { type: 'memory' }` in dev mode — stops the filesystem
  cache from persisting mismatched path strings across restarts.
- `config.resolve.modules` pinned to the canonical `node_modules` path —
  ensures bare-name imports (`import x from 'react'`) always resolve
  through the same path.

All three changes live in the `webpack()` function in `next.config.mjs`.
Do not remove them — the hydration error will return on Windows.

**If you see it again**

1. Stop the dev server.
2. Delete the `.next` folder: `rm -rf .next`
3. Restart: `npm run dev`

If the error persists after that, check that `next.config.mjs` still
contains the `WindowsPathCasingFix` plugin class and that it is pushed
into `config.plugins`.
