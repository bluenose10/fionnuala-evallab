# Technical Reference: Production-Grade AI Knowledge Base & Evaluation Platform

## 1. Executive Architecture Overarching Philosophy

In the current landscape of AI development, there is a significant industry gap between "toy" prototypes and production-ready systems. Most "naive RAG" implementations fail in production because they lack a feedback loop — they are built on the hope that the LLM will find the right information, without any empirical method to prove it.

This platform represents a fundamental shift from a "Document-to-Chat" interface to a **Document-to-Evaluation** architecture. By treating AI development as an engineering discipline rather than a prompting exercise, we replace subjective "vibes" with objective metrics. This approach mimics the rigorous requirements of professional AI teams who prioritise reliability, observability, and systematic optimisation over simple fluency.

### Comparison: Portfolio Projects vs. Production AI Development

| | Standard Portfolio Projects | Production AI Development Platform |
|---|---|---|
| Workflow | Upload → Chat → Answer | Upload → Retrieval → Answer → Evaluation → Metrics → Experimentation → Auto-Winner → Public API |
| Focus | Basic functionality and "chat-like" feel | Reliability, observability, and systematic optimisation |
| Philosophy | Success = a single coherent response | Success = statistical accuracy across thousands of queries |
| Outcome | A standalone toy app | An enterprise-grade data platform with verified deployment |

---

## 2. Vector Database Schema & Type Integrity

The data tier leverages Supabase (PostgreSQL with the `pgvector` extension) to handle multi-dimensional vector space indexing and storage.

### Document Chunks Schema (`public.document_chunks`)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary Key, Default: `gen_random_uuid()` |
| `document_id` | `uuid` | Foreign Key → `public.documents.id` ON DELETE CASCADE |
| `user_id` | `uuid` | Foreign Key → auth user, RLS enforcement |
| `content` | `text` | The exact human-readable text segment parsed from the file |
| `chunk_index` | `integer` | Position of this chunk within the parent document |
| `token_count` | `integer` | Token count of this chunk |
| `embedding` | `vector(1536)` | 1536-dimensional pgvector embedding |
| `created_at` | `timestamptz` | Row creation timestamp |

### System Integrity & Structural Guardrails

1. **Zero-Orphan Database Cascading:** The `document_chunks` table implements strict `ON DELETE CASCADE` mapped to the parent document row. When a document is deleted, PostgreSQL atomically cleans the vector space — preventing stale data from poisoning future semantic retrievals and eliminating hidden cloud storage fees.

2. **Vector Validation Metric:** The `embedding` column relies on a specialised data type from `pgvector`. Traditional array tracking functions such as `array_ndims()` will crash on this format. Production diagnostic scripts must use `vector_dims(embedding)` and confirm exactly **1536 dimensions**.

3. **HNSW Index:** An HNSW index is deployed on the `embedding` column using `vector_cosine_ops` (m=16, ef_construction=64). PostgreSQL uses the index automatically at production scale; at small row counts it correctly chooses a sequential scan as the cheaper path.

---

## 3. The Unified Ingestion Engine & Orchestration Constraints (Phases 3 & 4)

We explicitly reject decoupled, multi-hop asynchronous ingestion worker architectures. This platform enforces a **Unified Ingestion Route (`/api/process`)** executing as a single atomic request transaction window:

```
Fetch Storage File → LlamaIndex Token Chunking → OpenAI Vectorization → Atomic DB Insert
```

### Senior Execution Guardrails

1. **Orchestration Library Lock:** Developers must strictly use LlamaIndex node parsers (specifically `SentenceSplitter` from `@llamaindex/core`) rather than writing custom string slices or splitting by arbitrary character lengths.

2. **The Array Batch Limit (Anti-Crash Loop):** Processing text chunks sequentially creates massive database pool connection lag, while passing an entire large document array into `Promise.all()` simultaneously triggers immediate OpenAI `429 Rate Limit` crashes. The ingestion loop must process embeddings in fixed, deterministic batches of exactly **100 elements** per loop iteration.

3. **Timeout Defence:** All intensive route handlers must declare `export const runtime = "nodejs"` at the top of the file to bypass the standard 15-second serverless execution limit.

---

## 4. Programmatic Retrieval & Matching Function (Phase 5)

Vector searching is pushed down into the database engine via a compiled PostgreSQL stored procedure (`match_document_chunks`) to maximise processing speed, minimise cold-start query latency, and preserve RLS policies.

### Cosine Similarity Engine

```sql
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  query_embedding vector,
  match_count integer DEFAULT 3,
  match_threshold double precision DEFAULT 0.3,
  filter_user_id uuid DEFAULT NULL,
  filter_chunk_size integer DEFAULT NULL
)
RETURNS TABLE(id uuid, document_id uuid, content text, similarity double precision)
```

The similarity score is calculated as:

```
Similarity = 1 - (document_chunks.embedding <=> query_embedding)
```

**Important:** Only one canonical version of this function should exist in Supabase. Multiple overloaded versions cause PostgreSQL to resolve to the wrong signature silently. If overloads are detected, drop all versions and recreate the single canonical function.

### RLS Administrative Bypass

User-facing routes are locked with active Row Level Security. The background ingestion and evaluation pipeline uses a privileged `supabaseAdmin` client via `SUPABASE_SERVICE_ROLE_KEY` to safely perform operations across user data boundaries.

---

## 5. Auto-Winner Promotion & Public API (Phase 11)

### Auto-Winner Logic

The `/api/public/chat` endpoint resolves the best-performing RAG configuration for each client automatically:

1. Query `experiment_runs` for the client's runs with ≥3 queries, ordered by `avg_faithfulness` descending.
2. Use the winning `chunk_size` for retrieval. Fall back to chunk_size=512 if no experiment data exists.
3. Retrieve chunks via `match_document_chunks` RPC filtered by `filter_user_id`.
4. Generate answer via `gpt-4o-mini` using retrieved context.
5. Return `{ answer, sources, config }` — config reveals which auto-winner was applied.

### Public API Authentication

Clients authenticate via API key stored in `client_api_keys` table (`api_key`, `user_id`). The endpoint resolves the client's `user_id` from the key and uses it to scope all retrieval to that client's documents only.

---

## 6. Experiment-Scoped Cost Mapping (Phase 10.3)

### Split Provider Strategy

| Model | Role | Rationale |
|---|---|---|
| `text-embedding-3-small` | Embeddings | 1536-dim, $0.02/1M tokens |
| `gpt-4o-mini` | Chat generation | High-volume, low-cost ($0.15/$0.60 per 1M tokens) |
| `gpt-4o` | Ragas evaluation judge | Maximum JSON fidelity ($2.50/$10.00 per 1M tokens) |

### Rule of Three Configurations

| Config | Chunk Size | Overlap | Typical Score Range |
|---|---|---|---|
| Small | 256 tokens | 32 tokens | 93–96% avg |
| Medium | 512 tokens | 50 tokens | 87–94% avg |
| Large | 1024 tokens | 100 tokens | 87–89% avg |

Scores vary by document type. Shorter, denser documents tend to favour smaller chunks. The auto-winner selects the empirically best config per client rather than assuming one size fits all.

---

## 7. Summary Matrix of Technical Pipeline Stages

| Stage | Description |
|---|---|
| 1. Project Setup | Next.js framework with live Supabase authentication |
| 2. File Management | Secure PDF storage with metadata tracking in Supabase Storage |
| 3. Processing & Text Extraction | Unified atomic ingestion pipeline |
| 4. Embeddings | 1536-dimensional coordinates via `text-embedding-3-small` |
| 5. Retrieval | `match_document_chunks` RPC with cosine similarity and HNSW index |
| 6. AI Answers | Grounded prompt execution via `gpt-4o-mini` (Split Provider Strategy) |
| 7. Evaluation | Automated Ragas scoring (Faithfulness, Relevance, Precision) via `gpt-4o` judge |
| 8. Experimentation | A/B Leaderboard with Rule of Three configs, cost mapping, Cheapest Config card |
| 9. Observability | Full-stack tracing via Langfuse parent-child spans + OpenTelemetry |
| 10. Portfolio Polish | Architecture diagram, case studies, pricing verification, HNSW verification |
| 11. Deployment Bridge | Public API key system, `/api/public/chat` endpoint, auto-winner promotion, document search |
| 12. Semantic Caching | 📋 DEFERRED — vector-based FAQ matching to reduce OpenAI costs at scale |
