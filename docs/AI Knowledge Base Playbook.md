# AI Knowledge Base Playbook: Engineering Principles

## 1. Project Foundation and Strategic Objective

### The Core Mission
The objective of this project is to architect a production-grade AI system that meets the rigorous engineering standards of the modern job market. We are moving beyond the saturated market of "simple chatbots" to build a sophisticated evaluation platform. The mission is to provide users with a system that not only answers questions from uploaded documents but systematically measures and optimizes the accuracy, reliability, and performance of those answers. This mimics the high-stakes workflows used by professional AI teams to maintain enterprise-level RAG (Retrieval-Augmented Generation) systems.

### Contrast: Production vs. Portfolio
To distinguish your work for senior-level recruiters, this project avoids the "Upload-Chat-Hope" anti-pattern in favor of a data-driven engineering cycle.
* **Standard Portfolio Project (Entry-Level):** Document Upload → AI Answer. (Relies entirely on subjective, fragile "vibe checks.")
* **Production-Grade Platform (Senior-Level):** Document Upload → Structured Retrieval → AI Answer → Automated Evaluation → Performance Metrics → Iterative Experimentation. (Relies on objective data and mathematical verification.)

### Core Platform Quality Metrics
* **The Target Benchmark:** The primary metric for our RAG systems is achieving a minimum **90%+ Faithfulness score** via the automated Ragas framework before an engine configuration can be promoted to production status.
* **Design Transparency:** The user interface must cleanly split "The AI Answer" away from "The Evaluation of the Answer" and its source chunks. This exposes the entire data lineage and proves to stakeholders that the output is grounded.

### The 3 Core Metrics
The platform evaluates RAG configurations using three Ragas metrics:
* **Faithfulness** — Is the generated answer supported by the retrieved context?
* **Answer Relevance** — Does the answer actually address the user's question?
* **Context Precision** — Are the retrieved chunks relevant (signal vs. noise)?

> **Note:** "Context Recall" was removed in Phase 10.1 after a forensic audit determined it was not being computed by the evaluation judge — every value was an aliased copy of Faithfulness. True Context Recall requires ground-truth reference answers and is deferred to Phase 11.

---

## 2. Technical Stack Summary

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn UI |
| Backend / Database | Supabase (PostgreSQL + pgvector), Auth, Storage, RLS |
| RAG Orchestration | LlamaIndex — `SentenceSplitter` (mandatory) |
| Models | OpenAI GPT-4o (Reasoning) + `text-embedding-3-small` (1536 dims) |
| Evaluation | Ragas Framework — 3 Core Metrics |
| Observability | Langfuse (SDK + OpenTelemetry) |

---

## 3. Engineering Philosophy

### Multi-Tenant Data Isolation
All tables enforce Supabase Row Level Security (RLS). Direct data reads are restricted via `auth.uid() = user_id`. Background ingestion and evaluation tasks use a privileged `supabaseAdmin` client via `SUPABASE_SERVICE_ROLE_KEY`.

### Unified Ingestion (Atomic Transaction)
Document processing executes in a single atomic pipeline: Fetch Storage File → LlamaIndex Token Chunking → OpenAI Vectorization → Atomic DB Insert. No decoupled, multi-hop asynchronous architectures. Embeddings are batched at exactly 20 chunks to avoid OpenAI 429 rate-limit errors.

### Observability Without Pollution
OpenTelemetry and Langfuse instrumentation live exclusively in `instrumentation.ts` and `src/lib/langfuse.ts`. Tracing code must never be inlined inside business logic (`/api/process`, `/api/retrieve`, `/api/chat`, `/api/evaluate`).

> **Technical status, phase progress, environment credentials, execution guardrails, and Windows development notes are maintained in [CLAUDE.md](../../CLAUDE.md).**
