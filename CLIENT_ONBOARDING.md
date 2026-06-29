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
| Langfuse public key | cloud.langfuse.com → Settings | ☐ |
| Langfuse secret key | cloud.langfuse.com → Settings | ☐ |

> **Note:** If the client is providing their own accounts, send them this list and ask them to create accounts at supabase.com, platform.openai.com, and vercel.com before your onboarding session.

---

## Step 1 — Create a Fresh Clone

Open PowerShell and run:

```powershell
cd C:\Users\User\Desktop
git clone https://github.com/bluenose10/ai-eval-platform.git CLIENTSLUG-evallab
cd CLIENTSLUG-evallab
```

Replace `CLIENTSLUG` with the client's slug e.g. `smithco-evallab`.

☐ Done

---

## Step 2 — Run the Provisioning Script

```powershell
.\setup-client.ps1
```

Answer all prompts:
- Client business name
- Short slug
- Client domain
- Vercel deployment URL (you can add this later if not known yet — use a placeholder)
- Supabase URL, anon key, service role key
- OpenAI API key
- Langfuse keys (press Enter to skip if not using)

The script will:
- Replace all EvalLab branding with the client's name across every file
- Generate a fresh `.env.local` with all credentials pre-filled
- Print the remaining manual steps

☐ Done

---

## Step 3 — Run schema.sql in Client's Supabase

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

☐ Done

---

## Step 4 — Create Client Login in Supabase Auth

1. In the client's Supabase project go to **Authentication → Users**
2. Click **Add user**
3. Enter email and a strong password
4. Send credentials to client **securely** (not plain email — use a password manager share or Signal)

☐ Done

---

## Step 5 — Push to GitHub and Deploy to Vercel

Create a new private GitHub repo for this client, then:

```powershell
git remote set-url origin https://github.com/bluenose10/CLIENTSLUG-evallab.git
git add -A
git commit -m "Client: CLIENTNAME provisioning"
git push origin main
```

Then in Vercel:
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import the new GitHub repo
3. Go to **Settings → Environment Variables**
4. Add every variable from `.env.local` (copy each one)
5. Click **Deploy**
6. Note the Vercel URL (e.g. `https://smithco-evallab.vercel.app`)

☐ Done

---

## Step 6 — Set Supabase Auth Redirect URLs

1. In the client's Supabase project go to **Authentication → URL Configuration**
2. Set **Site URL** to: `https://CLIENTSLUG-evallab.vercel.app`
3. Add **Redirect URL**: `https://CLIENTSLUG-evallab.vercel.app/auth/callback`
4. Save

☐ Done

---

## Step 7 — Smoke Test

Visit the live Vercel URL and verify:

| Test | Expected result | Status |
|---|---|---|
| Homepage loads | Dark green login screen | ☐ |
| Login works | Redirects to dashboard | ☐ |
| Upload a test PDF | Auto-chunks and shows Indexed | ☐ |
| QA Lab question | Returns grounded answer | ☐ |
| Run experiment | Leaderboard shows scores | ☐ |
| Public chatbot | Returns answer via API key | ☐ |
| Sign out | Returns to homepage | ☐ |

☐ All tests passed

---

## Step 8 — Hand Over to Client

Send the client:

1. **Login URL** — their Vercel deployment URL
2. **Email and password** — created in Step 4
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
| Build fails on Vercel | Check env vars are all set in Vercel settings |
| Login redirects to wrong URL | Check Supabase Auth redirect URLs (Step 6) |
| Documents not chunking | Check `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` in env vars |
| Chatbot returns "not enough information" | Upload and index documents first, then run experiments |
| Semantic cache not hitting | Check `match_semantic_cache` RPC exists in Supabase |
| Experiment scores missing | Check `LANGFUSE_*` keys if using observability |

---

> **Schema file location:** `supabase/schema.sql`
> **Provisioning script:** `setup-client.ps1`
> **Technical reference:** `CLAUDE.md` and `Technical_Reference.md`
