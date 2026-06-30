# EvalLab — Client Onboarding Checklist

> Complete this checklist in order for every new client deployment.
> Each client gets their own isolated clone, Supabase project, and Vercel deployment.
> No client data ever touches another client's environment.

---

## Pre-flight — Gather Client Credentials

Before starting, collect or create the following. Store them securely (password manager).

| Item | Where to find it | Status |
|---|---|---|
| Client business name | — | ☐ |
| Short slug (no spaces) | You decide e.g. `smithco` | ☐ |
| Client website domain | e.g. `smithco.co.uk` | ☐ |
| Supabase project URL | Supabase → Settings → API | ☐ |
| Supabase anon key | Supabase → Settings → API | ☐ |
| Supabase service role key | Supabase → Settings → API | ☐ |
| OpenAI API key | platform.openai.com → API Keys | ☐ |
| Langfuse public key | cloud.langfuse.com → Settings → API Keys → Create new | ☐ |
| Langfuse secret key | cloud.langfuse.com → Settings → API Keys → Create new | ☐ |

> **Note:** If the client is providing their own accounts, send them this list and ask them to create accounts at supabase.com, platform.openai.com, and vercel.com before your onboarding session.

---

## Step 0 — Verify the Canonical Repo Is Healthy (one-off, but check periodically)

Before cloning, confirm the canonical `ai-eval-platform` repo itself is clean:

```powershell
cd C:\Users\User\Desktop\AI Eval Platform
git ls-files | findstr gitignore
```

This must return `.gitignore` (with the leading dot). If it returns nothing, the ignore file is either missing or was saved without its leading dot (e.g. as `gitignore` instead of `.gitignore`) — fix that first, or every future clone will leak `.env.local` and other secrets straight into git history.

```powershell
Get-ChildItem -Force | findstr gitignore
```

Confirms the exact filename on disk. It must read exactly `.gitignore`, not `gitignore` or `_gitignore`.

☐ Verified

---

## Step 1 — Create a Fresh Clone

Open PowerShell and run (replace `CLIENTSLUG` with the client's actual slug, e.g. `smithco`):

```powershell
cd C:\Users\User\Desktop
git clone https://github.com/bluenose10/ai-eval-platform.git CLIENTSLUG-evallab
cd CLIENTSLUG-evallab
```

> Always clone from the canonical `ai-eval-platform` repo — never from a previously branded client clone. Each client starts from clean source code.

☐ Done

---

## Step 2 — Fix PowerShell Execution Policy (first time only)

If you've never run a local script on this machine before:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope CurrentUser
```

Type `Y` to confirm.

☐ Done (skip if already set)

---

## Step 3 — Run the Provisioning Script

```powershell
.\setup-client.ps1
```

Answer all prompts:
- Client business name
- Short slug
- Client domain
- Vercel deployment URL (use a placeholder like `https://CLIENTSLUG-evallab.vercel.app` if not deployed yet — you can fix it later)
- Supabase URL, anon key, service role key
- OpenAI API key
- Langfuse keys (press Enter to skip if not using)

The script will:
- Replace EvalLab branding with the client's name — **word-boundary safe**, so it will not corrupt code identifiers like `RetrievalLabPage` or `window.EvalLabConfig`
- Skip `CLIENT_ONBOARDING.md` and `setup-client.ps1` itself (these are templates, not branded UI)
- Generate a fresh `.env.local` with all credentials pre-filled
- Print the remaining manual steps

> **After running:** spot-check `src/app/dashboard/lab/page.tsx` and `src/app/dashboard/deploy/page.tsx` to confirm function names and `window.EvalLabConfig` are intact before deploying.

☐ Done

---

## Step 4 — Confirm .env.local Is Not Tracked

Immediately after the script runs, before any commit:

```powershell
git status
```

`.env.local` must appear under **Untracked files**, not staged. If `git status` shows nothing at all (no untracked files listed), that almost certainly means `.gitignore` is missing or misnamed in this clone — go back to Step 0 and fix the canonical repo, then re-clone.

This single check would have caught the OpenAI key leak that happened during the smithco-evallab2 build. Never skip it.

☐ Verified

---

## Step 5 — Run schema.sql in Client's Supabase

1. Log into the client's Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** (left sidebar)
3. Open `supabase/schema.sql` from the cloned repo
4. Copy the **entire contents** and paste into the SQL Editor
5. Click **Run**

This creates:
- `documents` table with RLS
- `document_chunks` table with `vector(1536)` column + HNSW index + RLS
- `evaluation_logs` table with RLS
- `experiment_runs` table with RLS
- `client_api_keys` table with RLS
- `semantic_cache` table with HNSW index + RLS
- `match_document_chunks` RPC
- `match_semantic_cache` RPC
- All `ON DELETE CASCADE` rules

> If you're unsure whether the project already has tables, run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';` first — "Success. No rows returned" confirms it's empty and safe to run schema.sql fresh.

☐ Done

---

## Step 6 — Create Client Login in Supabase Auth

1. In the client's Supabase project go to **Authentication → Users**
2. Click **Add user**
3. Enter email and a strong password
4. Send credentials to client **securely** (not plain email — use a password manager share or Signal)

☐ Done

---

## Step 7 — Push to GitHub and Deploy to Vercel

Create a new private GitHub repo for this client first (github.com → New repository → Private → do NOT initialise with README), then:

```powershell
git remote set-url origin https://github.com/bluenose10/CLIENTSLUG-evallab.git
git add -A
git status
```

> **Check the output of `git status` / the staged file list before committing.** `.env.local` must NOT appear in the list of files to be committed. If it does, stop — run `git rm --cached .env.local` before committing.

```powershell
git commit -m "Client: CLIENTNAME provisioning"
git push origin main
```

Then in Vercel — **two valid paths depending on what the UI gives you:**

**Path A (normal import flow):**
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import the new GitHub repo
3. **Before clicking Deploy** — go to **Environment Variables**
4. Add every variable from `.env.local`
5. Click **Deploy**

**Path B (if Vercel only offers "Create Empty Project" with no repo import option visible):**
1. Click **Create Empty Project**
2. Go to **Settings → Environment Variables** and add every variable from `.env.local`
3. Go to **Settings → General → Build & Development Settings** and explicitly set **Framework Preset** to **Next.js** (an empty project sometimes defaults to a static site config, which fails with "No Output Directory named public" — Next.js apps do not use a `public` build output directory)
4. Go to **Settings → Git** and connect the GitHub repo
5. Trigger a deploy:
   ```powershell
   git commit --allow-empty -m "Trigger deploy with env vars"
   git push origin main
   ```

> **Critical:** add all env vars BEFORE the first real deploy regardless of which path you use. Deploying first and adding env vars after causes build/runtime failures that look like code bugs but are actually just missing config.

6. Note the Vercel URL it assigns (it may not match your client slug exactly — Vercel sometimes auto-generates a random project name like `project-nqcro.vercel.app`; that's fine, just use whatever it gives you consistently in the next steps)

☐ Done

---

## Step 8 — Set Supabase Auth Redirect URLs

1. In the client's Supabase project go to **Authentication → URL Configuration**
2. Set **Site URL** to the actual Vercel URL from Step 7
3. Add **Redirect URL**: same URL + `/auth/callback`
4. Save

☐ Done

---

## Step 9 — Generate the API Key (manual, does not happen automatically)

1. Log into the deployed site
2. Go to **Deploy** in the dashboard
3. Click **Generate API Key**
4. This writes a row into `client_api_keys` in Supabase — it will not exist until you do this

> **If you see 400/406/404 console errors when loading the Deploy page:** this is a known recurring bug if `src/app/dashboard/deploy/page.tsx` reverts to an old broken version (using `.single()` instead of `.maybeSingle()`, or inserting a `label` field instead of `name`). This has happened on multiple fresh clones because the fix was applied to a client clone but not pushed back to the canonical `ai-eval-platform` repo. **Always verify the fix is live in the canonical repo, not just the most recent client clone**, by checking `deploy/page.tsx` uses `.maybeSingle()` before cloning for a new client.

☐ Done

---

## Step 10 — Smoke Test

Visit the live Vercel URL and verify:

| Test | Expected result | Status |
|---|---|---|
| Homepage loads | Dark green login screen | ☐ |
| Login works | Redirects to dashboard | ☐ |
| Upload a test PDF | Auto-chunks and shows Indexed | ☐ |
| QA Lab question | Returns grounded answer | ☐ |
| Run experiment | Leaderboard shows scores | ☐ |
| Deploy page | Shows generated API key, no console errors | ☐ |
| Public chatbot (external test site) | Returns answer via API key | ☐ |
| Sign out | Returns to homepage | ☐ |

> **Warm-up note:** a brand new Vercel + Supabase pairing can take up to an hour to fully connect on first use. If the public chatbot 401s or times out immediately after deploy, wait and retry before debugging further — it is very likely just propagation delay, not a real bug.

☐ All tests passed

---

## Step 11 — Hand Over to Client

Send the client:

1. **Login URL** — their Vercel deployment URL
2. **Email and password** — created in Step 6
3. **API key** — from the Deploy page in their dashboard
4. **Embed snippet** — from the Deploy page (for their website developer)
5. **Document naming convention** — agree a standard before they upload anything:

```
FORSALE_14-Maple-Court_LS1-2AB.pdf
RENTAL_Flat4-Victoria-House_M1-3CD.pdf
COMPLIANCE_EPC-Guide-2024.pdf
LEASE_22-Park-Lane_Tenant-Smith.pdf
```

☐ Done

---

## Ongoing — Monthly Maintenance (Retainer)

| Task | Frequency |
|---|---|
| Run experiments after major document uploads | Per batch |
| Check Faithfulness score still above 90% | Monthly |
| Review Langfuse traces for errors | Monthly |
| Clear expired semantic cache if needed | Monthly |
| Update documents when properties sell / cases close | As needed |

---

## Troubleshooting Quick Reference

| Problem | Fix |
|---|---|
| `.env.local` got committed / GitHub push protection blocks a push citing a secret | `git rm --cached .env.local`, commit, and if the secret is in a prior commit too: `git reset --soft HEAD~N`, re-stage without the file, recommit, push. Root cause is almost always a missing or misnamed `.gitignore` — fix the canonical repo (Step 0) so this stops recurring |
| `git status` shows no untracked files after running setup-client.ps1 | `.gitignore` is missing or misnamed in this clone. Check `Get-ChildItem -Force | findstr gitignore` shows exactly `.gitignore` |
| Build fails on Vercel with a syntax error in a page that wasn't touched manually | The provisioning script mangled a code identifier — check `lab/page.tsx`, `deploy/page.tsx`, and `sidebar.tsx` function names. Should not happen with the word-boundary-safe script version, but verify |
| Build fails on Vercel — env var related | Check env vars are all set in Vercel settings, set BEFORE first deploy |
| Vercel build fails: "No Output Directory named public found" | Project Framework Preset is set to something other than Next.js — go to Settings → General → Build & Development Settings and set it to Next.js explicitly |
| Login redirects to wrong URL | Check Supabase Auth redirect URLs (Step 8) match the actual Vercel URL exactly |
| Documents not chunking | Check `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` in env vars |
| Chatbot returns "not enough information" | Upload and index documents first, then run experiments |
| Chatbot returns 401 Invalid API Key right after first deploy | Likely warm-up delay — wait up to an hour and retry before debugging |
| Deploy page shows 400/406/404 console errors, no API key generates | `deploy/page.tsx` has reverted to the old broken version (`.single()` instead of `.maybeSingle()`, `label` instead of `name`). Fix it in the canonical repo, not just this client clone |
| No row in `client_api_keys` table | Key generation is manual — log in and click "Generate API Key" on the Deploy page |
| Semantic cache not hitting | Check `match_semantic_cache` RPC exists in Supabase |
| Experiment scores missing | Check `LANGFUSE_*` keys if using observability |
| Netlify/frontend build fails with "secrets scanning found secrets" | Remove real API key values from `.env.example` — use placeholders only, never commit real keys |

---

> **Schema file location:** `supabase/schema.sql`
> **Provisioning script:** `setup-client.ps1`
> **Technical reference:** `CLAUDE.md` and `Technical_Reference.md`
> **Golden rule:** any bug fix discovered while working on a client clone must be pushed back to the canonical `ai-eval-platform` repo, not just the client repo. Otherwise the same bug reappears on the next clone.
