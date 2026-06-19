# Technical Reference: Production-Grade AI Knowledge Base & Evaluation Platform

## 1. Executive Architecture Overarching Philosophy
In the current landscape of AI development, there is a significant industry gap between "toy" prototypes and production-ready systems. Most "naive RAG" (Retrieval-Augmented Generation) implementations fail in production because they lack a feedback loop; they are built on the hope that the LLM will find the right information, without any empirical method to prove it. This platform represents a fundamental shift from a "Document-to-Chat" interface to a Document-to-Evaluation architecture. By treating AI development as an engineering discipline rather than a prompting exercise, we replace subjective "vibes" with objective metrics. This approach mimics the rigorous requirements of professional AI teams who prioritize reliability, observability, and systematic optimization over simple fluency.

### Comparison: Portfolio Projects vs. Production AI Development
* **Standard Portfolio Projects:** Workflow: Upload -> Chat -> Answer. Focus: Basic functionality and "chat-like" feel. Philosophy: Success is measured by a single coherent response. Outcome: A standalone toy app.
* **Production AI Development Platform:** Workflow: Upload -> Retrieval -> Answer -> Evaluation -> Metrics -> Experimentation. Focus: Reliability, observability, and systematic optimization. Philosophy: Success is measured by statistical accuracy across thousands of queries. Outcome: An enterprise-grade data platform.

---

## 2. Vector Database Schema & Type Integrity
The data tier leverages Supabase (PostgreSQL with the `pgvector` extension) to handle multi-dimensional vector space indexing and storage. All table structures map explicitly to our strict isolation boundaries.

### Document Chunks Schema (`public.document_chunks`)
* **`id`**: `uuid` (Primary Key, Default: `gen_random_uuid()`)
* **`document_id`**: `uuid` (Foreign Key referencing `public.documents.id` with strict ON DELETE CASCADE rules)
* **`content`**: `text` (The exact human-readable text segment parsed from the file)
* **`embedding`**: `USER-DEFINED` (`vector(1536)`)
* **`metadata`**: `jsonb` (Stores execution parameters, token metrics, and chunk size indices)

### System Integrity & Structural Guardrails
1.  **Zero-Orphan Database Cascading:** The `document_chunks` table must implement a strict `ON DELETE CASCADE` rule mapped to the parent file row. When a document asset is expunged by a user, PostgreSQL must instantly and atomically clean the vector space. This prevents stale text data from poisoning future semantic retrieval calculations and eliminates hidden cloud database storage fees.
2.  **Vector Validation Metric:** The `embedding` column relies on a specialized data type from `pgvector`. Traditional array tracking functions such as `array_ndims()` will crash on this format. Production diagnostic scripts must natively leverage `vector_dims(embedding)` and look for a validated metric of exactly **1536 dimensions** to confirm structural health.

---

## 3. The Unified Ingestion Engine & Orchestration Constraints (Phases 3 & 4)
We explicitly reject decoupled, multi-hop asynchronous ingestion worker architectures where text parsing and vector operations occur across independent network ticks. This platform enforces a **Unified Ingestion Route (`/api/process`)** executing as a single atomic request transaction window:

$$\text{Fetch Storage File} \longrightarrow \text{LlamaIndex Token Chunking} \longrightarrow \text{OpenAI Vectorization} \longrightarrow \text{Atomic DB Insert}$$

### Senior Execution Guardrails
1.  **Orchestration Library Lock:** To guarantee structural consistency across our vector maps, developers must strictly use LlamaIndex node parsers (specifically `SentenceSplitter` from the native `@llamaindex/core` or `llamaindex` package) rather than writing custom string slices or splitting by arbitrary character lengths.
2.  **The Array Batch Limit (Anti-Crash Loop):** Processing text chunks sequentially creates massive database pool connection lag, while passing an entire large document array into `Promise.all()` simultaneously triggers immediate OpenAI `429 Rate Limit` crashes. The ingestion loop must process embeddings in fixed, deterministic batches of exactly **20 elements** per loop iteration.
3.  **Timeout Defense:** To protect intensive document text extractions from being cut off by standard serverless limits, the route handler must explicitly declare `export const runtime = "nodejs";` at the top of the file to run within a dedicated long-running Node.js execution layer.

---

## 4. Programmatic Retrieval & Matching Function (Phase 5)
Vector searching is pushed down into the database engine via a compiled PostgreSQL stored procedure to maximize processing speed, minimize cold-start query latency, and preserve Row Level Security (RLS) policies.

### Cosine Similarity Engine (`match_document_chunks`)
The query vector is processed against the document space using native `pgvector` operators to calculate cosine distances:
$$\text{Similarity} = 1 - (\text{document\_chunks.embedding} \Leftrightarrow \text{query\_embedding})$$

### RLS Administrative Bypass
While user-facing routes are locked tight with active Row Level Security (`ALTER TABLE documents ENABLE ROW LEVEL SECURITY; USING (auth.uid() = user_id);`), the background ingestion processing pipeline leverages a privileged `supabaseAdmin` client running on the server side using the secure `SUPABASE_SERVICE_ROLE_KEY` to safely perform operations across background user data boundaries.

---

## 5. Summary Matrix of Technical Pipeline Stages
1.  **Project Setup:** Next.js framework deployment with live Supabase authentication layers.
2.  **File Management:** Secure file storage tracking paths within Supabase Object Storage buckets.
3.  **Processing & Text Extraction:** Unified data pipelines turning document inputs into text streams.
4.  **Embeddings:** Generating 1536-dimensional coordinates using OpenAI `text-embedding-3-small`.
5.  **Retrieval:** Executing compiled database RPC matches using cosine similarity algorithms.
6.  **AI Answers:** Grounded prompt execution parsing context arrays into user answers.
7.  **Evaluation:** Automatic parsing of outputs through the Ragas mathematical framework.
8.  **Experimentation:** System dashboards evaluating multi-tenant chunk configurations.
9.  **Observability:** Full-stack tracing via hierarchical parent-child spans in Langfuse.
10. **Portfolio Polish:** Compiling production case studies showing metrics, cost maps, and architecture charts. 


