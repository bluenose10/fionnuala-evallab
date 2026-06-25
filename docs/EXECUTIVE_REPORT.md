# Executive Project Report: Transitioning from Naive RAG to Evaluation-Driven Engineering

## 1. Strategic Vision and Mission

The current AI landscape is characterised by a significant industry gap: the distance between "naive RAG" prototypes and production-grade engineering. While standard implementations focus on a "Document-to-Chat" interface — often relying on fragile "vibe checks" and hope — enterprise-ready systems require a "Document-to-Evaluation" architecture.

This project shifts the focus from subjective fluency to objective, empirical verification. By treating AI development as a rigorous engineering discipline, we replace experimental prompting with a system designed for reliability, observability, and systematic optimisation.

**Core Mission:** To architect a production-grade AI evaluation platform that systematically measures and optimises RAG performance, targeting a minimum **90%+ Faithfulness score** via the Ragas framework before any configuration is promoted to production.

---

## 2. Comparative Analysis: Standard vs. Production Workflows

| Feature | Standard Portfolio Projects | Production AI Development Platform |
|---|---|---|
| Workflow | Upload → Chat → Answer | Upload → Retrieval → Answer → Evaluation → Metrics → Experimentation → Auto-Winner → Public API |
| Focus | Basic functionality; "chat-like" feel | Reliability, observability, and systematic optimisation |
| Philosophy | Success = a single coherent response (Subjective) | Success = statistical accuracy across thousands of queries (Objective) |
| Outcome | Standalone "toy" application | Enterprise-grade data platform with verified deployment |

---

## 3. The Philosophy of Evaluation-Driven Development (EDD)

EDD mandates that AI systems be constructed with the same rigour as mission-critical software, requiring high standards for observability and structural integrity.

**Design Transparency:** The platform enforces a clean separation between the "AI Answer," the "Evaluation of the Answer," and the specific source chunks used for context. Exposing this lineage proves to stakeholders that output is grounded in truth, not LLM hallucination.

**Zero-Orphan Database Philosophy:** Strict ON DELETE CASCADE rules ensure that when a document is expunged, PostgreSQL atomically cleans the vector space — preventing stale data from poisoning future retrievals and eliminating hidden cloud storage fees from orphaned embeddings.

**Auto-Winner Promotion:** The Experiment Leaderboard A/B tests three chunk configurations and scores each with Ragas. The configuration with the highest verified Faithfulness score is automatically promoted to the live public endpoint — replacing subjective configuration decisions with empirically verified performance data.

---

## 4. Technical Architecture: Data Tier and Vector Integrity

The data tier is built on Supabase, utilising PostgreSQL with the pgvector extension and the `text-embedding-3-small` model for high-efficiency embeddings.

**Schema Definition:** The `public.document_chunks` table is configured with a `vector(1536)` embedding column, explicitly mapped to `text-embedding-3-small` output. Columns: `id`, `document_id`, `user_id`, `content`, `chunk_index`, `token_count`, `embedding`, `created_at`.

**Vector Validation:** Structural health confirmed via `vector_dims(embedding)` — enforcing exactly 1536 dimensions to prevent indexing failures.

**HNSW Index:** An HNSW index (`vector_cosine_ops`, m=16, ef_construction=64) is deployed on the `embedding` column for sub-linear similarity search at production scale.

**Security Architecture:**
- **Row Level Security (RLS):** Enabled on all user-facing tables for multi-tenant isolation (`auth.uid() = user_id`).
- **Administrative Bypass:** Background ingestion and evaluation tasks use a privileged `supabaseAdmin` client via `SUPABASE_SERVICE_ROLE_KEY`, operating safely across data boundaries without compromising client-side security.

---

## 5. The Unified Ingestion Engine (Phases 3 & 4)

We have rejected decoupled, multi-hop asynchronous architectures in favour of a Unified Ingestion Route (`/api/process`) that executes as a single atomic transaction window:

```
Fetch Storage File → LlamaIndex Token Chunking → OpenAI Vectorization (text-embedding-3-small) → Atomic DB Insert
```

**Senior Execution Guardrails:**
- **Orchestration Library Lock:** LlamaIndex node parsers (specifically `SentenceSplitter` from `@llamaindex/core`) ensure uniform chunk mapping across vector maps.
- **The Array Batch Limit:** Embeddings are processed in deterministic batches of exactly 100 elements per iteration to prevent database pool lag and OpenAI 429 Rate Limit crashes.
- **Timeout Defence:** All intensive route handlers declare `export const runtime = "nodejs"` to bypass the standard 15-second serverless execution limit.

---

## 6. Programmatic Retrieval and Matching Logic

Phase 5 pushes vector searching into a compiled PostgreSQL stored procedure, maximising processing speed and minimising cold-start query latency.

**Cosine Similarity Engine:** Matches calculated using the pgvector cosine distance operator (`<=>`). Subtracting the distance from 1 produces the similarity score used for ranking:

```
Similarity = 1 − (document_chunks.embedding <=> query_embedding)
```

User-facing retrieval routes are locked with RLS to prevent horizontal data exposure, while the `supabaseAdmin` client handles high-privilege background evaluation and metric generation.

---

## 7. The 11-Phase Roadmap and Current Project Status

| # | Phase | Status |
|---|---|---|
| 1 | Project Setup — Next.js skeleton with live Supabase Auth and verified middleware | ✅ COMPLETE |
| 2 | File Management — Ingestion hooks wired to Storage with metadata logging and UI feedback | ✅ COMPLETE |
| 3 | Processing — Unified data pipelines turning inputs into atomic text streams | ✅ COMPLETE |
| 4 | Embeddings — Generating 1536-dimensional coordinates via `text-embedding-3-small` | ✅ COMPLETE |
| 5 | Retrieval — `match_document_chunks` RPC with cosine similarity and RLS | ✅ COMPLETE |
| 6 | AI Answers — Grounded prompt execution via `gpt-4o-mini` (Split Provider Strategy) | ✅ COMPLETE |
| 7 | Evaluation — Automated Ragas scoring (Faithfulness, Relevance, Precision) via `gpt-4o` judge | ✅ COMPLETE |
| 8 | Experimentation — Leaderboard with Rule of Three configs (256/32, 512/50, 1024/100), cost mapping, Cheapest Config card | ✅ COMPLETE |
| 9 | Observability — Full-stack tracing via hierarchical parent-child spans in Langfuse + OpenTelemetry | ✅ COMPLETE |
| 10 | Portfolio Polish — Architecture diagram, case studies, pricing verification, HNSW index verification | ✅ COMPLETE |
| 11 | Deployment Bridge — Public API key system, `/api/public/chat` endpoint, auto-winner config promotion, document search | ✅ COMPLETE |
| 12 | Semantic Caching | 📋 DEFERRED |

---

## 8. System Credentials and Security Hydration

| Variable | Status | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ ACTIVE | Core Database/Storage URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ ACTIVE | Client-side access |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ ACTIVE | Server-side ingestion bypass (Phase 3+) |
| `OPENAI_API_KEY` | ✅ ACTIVE | `text-embedding-3-small` and Inference |
| `LANGFUSE_PUBLIC_KEY` | ✅ ACTIVE | Langfuse observability public key |
| `LANGFUSE_SECRET_KEY` | ✅ ACTIVE | Langfuse observability secret key |
| `LANGFUSE_HOST` | ✅ ACTIVE | Langfuse host URL |

**Storage & Isolation Boundaries:** Security is enforced through three primary Supabase storage policies (Upload, Read, and Delete). Data is strictly isolated by `auth.uid()`, ensuring users can only interact with files stored within their unique folder (`{user_id}/{timestamp}_{name}`).
