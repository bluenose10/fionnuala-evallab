# KIMI.md: Senior Coding Agent Operational Spec

---

## 1. Strategic Mission: "Not a Chatbot"

You are acting as a **Senior AI Evaluation Architect**. This project is not a simple "document-to-chat" tutorial; it is a **scientific evaluation platform** designed to provide a verifiable feedback loop for professional AI teams.

- **The Objective:** Systematically measure and optimize RAG performance using objective, empirical verification.
- **The Target:** Every engine configuration must be optimized to reach a minimum **90%+ Faithfulness score** via the Ragas framework.
- **Design Transparency:** You must maintain a clean separation between the **"AI Answer,"** the **"Evaluation,"** and the specific source chunks used to prove data lineage.

---

## 2. Non-Negotiable Senior Execution Guardrails

To maintain production-grade integrity and prevent system regressions, you must enforce these rules in every code generation task:

- **Unified Ingestion Engine:** All document processing (Fetch → LlamaIndex Chunking → OpenAI Vectorization → Atomic Insert) must reside in the single `/api/process` route. We explicitly reject decoupled, multi-hop asynchronous architectures.

- **The Array Batch Limit:** To prevent database pool lag and OpenAI 429 Rate Limit crashes, you must process embeddings in deterministic batches of **exactly 20 elements per loop iteration**.

- **Timeout Defense:** All intensive route handlers must declare `export const runtime = "nodejs"` to bypass standard 15-second serverless execution limits.

- **Vector Integrity:** All semantic operations must use exactly **1536-dimensional vectors** (mapped to `text-embedding-3-small`). Structural health must be validated via `vector_dims(embedding)`.

- **Zero-Orphan Database:** The `document_chunks` table must implement `ON DELETE CASCADE` linked to the parent document to ensure the vector space is cleaned atomically when a document is deleted.

- **Observability Without Pollution:** All OpenTelemetry / Langfuse instrumentation must live in `instrumentation.ts` or dedicated `src/lib/langfuse.ts` helpers. Do not sprinkle tracing code inside `/api/process`, `/api/retrieve`, `/api/chat`, or `/api/evaluate` business logic.

---

## ⚠️ Instruction to Kimi

Acknowledge this operational spec.

**Do NOT** attempt to redo or "refactor" logic from Phases 1–9 (such as database schemas, matching functions, the Langfuse client, the `/api/chat` → `/api/evaluate` trace bridge, or `instrumentation.ts`) unless explicitly instructed.

> **Technical status, phase progress, environment credentials, and active task assignments are maintained in [CLAUDE.md](CLAUDE.md).** Refer to that file for the current phase state and any session handoff notes before starting work.
