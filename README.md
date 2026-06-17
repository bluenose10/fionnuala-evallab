# EvalLab — AI Knowledge Base Evaluation Platform

> Accuracy-First AI. A scientific laboratory for **Grounded RAG** — measure
> Faithfulness, Relevance, Precision & Recall instead of guessing. **Not a chatbot.**[cite: 2, 3]

This repo currently contains the **Phase 1 skeleton**: a production-grade Next.js + Supabase shell, ready for the RAG engine in Phase 2+[cite: 2].

## Stack

| Layer | Tech |
| :--- | :--- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind[cite: 2, 3] |
| UI | Shadcn UI (New York / Slate), Recharts[cite: 2, 3] |
| Auth/DB | Supabase (Postgres + pgvector), RLS[cite: 2, 3] |
| RAG Engine | LlamaIndex Orchestration[cite: 3] |
| Models | OpenAI GPT-4o + text-embedding-3-small[cite: 2, 3] |
| Evaluation | Ragas Framework[cite: 2, 3] |
| Tracing | Langfuse Observability[cite: 3] |

---

## Hardened Unified Ingestion (Phases 3 & 4)
Unlike standard tutorial architectures that decouple parsing from vector tracking, EvalLab forces text extraction, LlamaIndex token chunking, OpenAI `text-embedding-3-small` vector calculations, and database insertion to execute within a single unified transaction pipeline (`/api/process`)[cite: 3].

### Why this design is mandatory:
1. **Data Integrity:** Guarantees that a text block is only saved if its 1536-dimensional vector is successfully generated, completely eliminating dead, un-indexable data fragmentation[cite: 3].
2. **Rate-Limit Defenses:** Employs a defensive array batching limit of 20 chunks per loop iteration, avoiding catastrophic OpenAI API 429 errors when ingesting larger assets[cite: 3].
3. **Timeout Avoidance:** Targets a dedicated, long-running Node.js runtime environment to completely insulate execution flows from standard 15-second serverless processing failures[cite: 3].

---

## Getting started

1. **Install dependencies**
```bash
   npm install
   ```[cite: 2]

2. **Configure environment**
```bash
   cp .env.local.example .env.local
   ```[cite: 2]
   Fill in your Supabase project URL + anon key, along with your `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` which are actively required to power the internal background vector ingestion routes[cite: 2]. OpenAI / Langfuse keys can wait until later phases[cite: 2].

3. **Set up the database**
   Open the Supabase SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql)[cite: 2]. This enables `pgvector` and creates the RLS-protected tables, confirming the `embedding` column maps to a `USER-DEFINED` `vector` type[cite: 2].

4. **Run the dev server**
```bash
   npm run dev
   ```[cite: 2]
   Visit http://localhost:3000[cite: 2].

---

## Environment variables

All credentials live in `.env.local` (never committed)[cite: 2]. Copy the example file and fill in the values as you progress through the phases[cite: 2].

| Variable | Required from phase | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Phase 1 → 2 | Supabase project URL[cite: 2] |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Phase 1 → 2 | Supabase anon/public key[cite: 2] |
| `SUPABASE_SERVICE_ROLE_KEY` | Phase 2 | Server-only — never expose to browser[cite: 2] |
| `OPENAI_API_KEY` | Phase 4 | Embeddings + generation[cite: 2] |
| `LANGFUSE_PUBLIC_KEY` | Phase 9 | Observability tracing[cite: 2] |
| `LANGFUSE_SECRET_KEY` | Phase 9 | Observability tracing[cite: 2] |
| `LANGFUSE_HOST` | Phase 9 | e.g. `https://cloud.langfuse.com`[cite: 2] |

> **All values in `.env.local` are currently dummy placeholders.** The app boots and builds, but auth, storage, and AI features will not function until real keys are provided[cite: 2]. Do not attempt to use the dummy keys against live APIs — they cause silent failures and misleading errors[cite: 2].

---

## What's in the skeleton

* **Landing page** — "Accuracy-First AI / Eliminating Hallucinations"[cite: 2].
* **Auth** — `/login` + `/signup` wired to Supabase Auth, with email-confirmation flow and an `/auth/callback` route[cite: 2].
* **Protected dashboard** (`middleware.ts` guards `/dashboard`):[cite: 2]
  * **Overview** — metric cards + 10-phase roadmap[cite: 2].
  * **Document Manager** — file-drop zone + metadata table[cite: 2].
  * **QA & Retrieval Lab** — side-by-side "The AI Answer" vs "Retrieved Chunks"[cite: 2].
  * **Evaluation Hub** — Ragas radar (spider) chart + metric breakdown[cite: 2].
  * **Experiment Leaderboard** — chunk size / retrieval / prompt comparison[cite: 2].
  * **Observability** — Langfuse status + trace hierarchy preview[cite: 2].

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

---

### Windows: TLS certificate verification failure (OpenAI / external HTTPS)

**Symptoms**

Any outbound HTTPS call (OpenAI embeddings, `next/font/google`, etc.) fails
with:
```
unable to verify the first certificate
```
or the OpenAI SDK reports a generic `Connection error`.

**Root cause**

Node.js ships with its own bundled CA certificate store and does **not** use
the Windows system certificate store by default. On some Windows machines a
required intermediate or root CA is missing from Node.js's bundle, causing
all external TLS handshakes to fail.

**Dev workaround applied**

Two files set `NODE_TLS_REJECT_UNAUTHORIZED = '0'` behind a strict
development-only guard:

```javascript
// next.config.mjs  AND  src/app/api/process/route.ts
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}
```

**Production impact: NONE.** `NODE_ENV` is always `'production'` on any
real deployment (Vercel, Railway, etc.) so these lines never execute.

**Dev impact**: In development only, ALL outbound HTTPS connections skip
certificate verification. Acceptable for a local build environment.

**Proper long-term fix** (if you want to remove the workaround):

```bash
# Option A — use Windows' own cert store (Node 22.3+)
node --use-system-ca npm run dev

# Option B — point Node at a PEM bundle containing your corporate/root CA
NODE_EXTRA_CA_CERTS=C:\path\to\ca-bundle.pem npm run dev
```

---

### Windows: System environment variable overriding `.env.local`

**Symptom**

OpenAI returns `401 Incorrect API key` even after updating `.env.local`
with a valid key. The key shown in the OpenAI error (e.g., ending `...Rh4A`)
does not match the key currently in `.env.local`.

**Root cause**

Windows User or System environment variables are read by Node.js **before**
`.env.local`. If an old `OPENAI_API_KEY` (or any other secret) was ever set
in Windows Environment Variables — for example from a previous project or a
global Cursor / VS Code extension — it silently wins over `.env.local` every
time, regardless of how many times you update the file.

**Fix**

1. Open **System Properties** → **Advanced** → **Environment Variables**
   (`Win + R` → `sysdm.cpl` → Advanced tab)
2. Check **both** panels — *User variables* (top) and *System variables*
   (bottom) — for `OPENAI_API_KEY` (or any other credential you suspect)
3. Select the entry → **Delete**
4. **Close all terminals and VS Code completely**, then reopen
5. Verify it is gone:
   ```
   echo %OPENAI_API_KEY%
   ```
   Should print `%OPENAI_API_KEY%` literally (no value resolved)

**Lesson for future debugging**

If an API key is "definitely correct" but the service keeps rejecting it,
run `echo %THE_VAR_NAME%` in a fresh Command Prompt before changing any
code. A stale Windows environment variable is the most common cause of this
exact failure pattern on Windows developer machines.