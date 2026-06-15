Project Specification: AI Knowledge Base Evaluation Platform
1. Strategic Objective: "Not a Chatbot"
The objective is to architect a production-grade AI system that moves beyond the "Upload-Chat-Hope" anti-pattern
. Instead of a simple chatbot, this is a scientific laboratory for AI that prioritizes Grounded AI, Empirical Evaluation, and Observability
.
Core Engineering Differentiators:
Scientific RAG: Transitioning from subjective "vibe checks" to objective data
.
Evaluation Engine: Using Ragas to calculate Faithfulness, Relevance, Precision, and Recall
.
Experimentation: A/B testing chunk sizes, prompt variations (Simple vs. Chain-of-Thought), and retrieval methods
.
Full Observability: Using Langfuse to trace every interaction from retrieval to evaluation
.
2. Technical Stack
Frontend: Next.js 14+ (App Router), TypeScript, Tailwind CSS
.
UI Components: Shadcn UI (for an "Enterprise SaaS" aesthetic)
.
Backend/Database: Supabase (PostgreSQL + pgvector for vector storage)
.
RAG Orchestration: LlamaIndex (chosen for specialized indexing and retrieval)
.
Models: OpenAI GPT-4o/5 (Reasoning) and text-embedding-3-small (Embeddings)
.
Evaluation: Ragas Framework
.
Tracing: Langfuse
.
3. The 10-Phase Development Roadmap
Project Setup: ✅ FUNCTIONAL — Next.js skeleton with live Supabase Auth
.
File Uploads: ✅ FUNCTIONAL — Secure PDF ingestion to Supabase Storage with metadata tracking
.
Document Processing: ✅ FUNCTIONAL — LlamaIndex SentenceSplitter parsing and semantic chunking
.
Vectorization: ✅ FUNCTIONAL — OpenAI text-embedding-3-small stored in pgvector
.
Retrieval: Implementing semantic search interfaces
.
AI Answers: Grounded RAG response generation using prompt templates
.
Evaluation System: Automated Ragas scoring stored in Supabase
.
Experiment Engine: Leaderboard comparing chunk sizes, hybrid search, and prompts
.
Observability: Langfuse integration for real-time trace/span recording
.
Portfolio Polish: Case study, architecture diagrams, and metrics dashboard
.
4. Advanced Engineering Requirements (Chat-Exclusive)
To achieve "Senior Engineer" status, the system must include:
Hybrid Retrieval: Combine Vector Search with BM25 Keyword Search to ensure exact-match accuracy for names and technical terms
.
Chain-of-Thought (CoT) Prompting: An experiment comparing a "Simple" prompt against an "Expert Analyst" persona that thinks step-by-step to improve Faithfulness scores
.
Production Security (RLS): Strict Supabase Row Level Security to isolate data: ALTER TABLE documents ENABLE ROW LEVEL SECURITY; USING (auth.uid() = user_id);
.
Tracing Hierarchy: Langfuse must log the Parent Trace (full interaction) containing individual Spans for Retrieval (Supabase) and Generation (OpenAI)
.
5. Master Frontend Prompt for AI Builders (Claude/v0/Bolt)
"I am building a production-grade AI Knowledge Base Evaluation Platform (not a basic chatbot) using Next.js, Tailwind CSS, and Shadcn UI. The backend is powered by Supabase for database, authentication, and storage. Please build a professional, clean, and high-quality frontend skeleton with the following:
Landing Page: Highlights 'Accuracy-First AI' and 'Eliminating Hallucinations.'
Auth Pages: Modern login/signup for Supabase Auth.
Main Dashboard: Sidebar layout with:
Document Manager: Route /dashboard/upload with a Shadcn UI file-drop zone and metadata table.
QA & Retrieval Lab: Interface to see AI answers side-by-side with retrieved chunks.
Evaluation Hub: Placeholders for Ragas metrics and a Radar Chart (Spider Chart) using Recharts.
Experiment Leaderboard: Table comparing 'Chunk Size: 200' vs 'Chunk Size: 500' and 'Hybrid Search' vs 'Vector Only.'
Observability Summary: Status icons for 'Traces' that will link to Langfuse.
Design: Modern 'Enterprise SaaS' aesthetic. Differentiate between 'The AI Answer' and 'The Evaluation of the Answer' to show engineering depth."
.
6. Phase 1 Technical Checklist
Initialize Next.js with TypeScript and App Router
.
Install Shadcn UI and initialize with 'Slate'/'New York' styles
.
Enable pgvector in the Supabase SQL Editor
.
Implement middleware.ts to protect dashboard routes using Supabase Auth
.
Connect .env.local with Supabase project keys
.
7. Secrets & Hydration
IMPORTANT — Current status of all credentials as of Phase 1:

| Secret                          | Variable                          | Status  | Required from Phase |
|---------------------------------|-----------------------------------|---------|---------------------|
| Supabase Project URL            | NEXT_PUBLIC_SUPABASE_URL          | ✅ ACTIVE | Phase 1 → Phase 2   |
| Supabase Anon Key               | NEXT_PUBLIC_SUPABASE_ANON_KEY     | ✅ ACTIVE | Phase 1 → Phase 2   |
| Supabase Service Role Key       | SUPABASE_SERVICE_ROLE_KEY         | ✅ ACTIVE | Phase 2 (ingestion) |
| OpenAI API Key                  | OPENAI_API_KEY                    | ✅ ACTIVE | Phase 3+4 (processing + embeddings)|
| Langfuse Public Key             | LANGFUSE_PUBLIC_KEY               | PENDING | Phase 9 (tracing)   |
| Langfuse Secret Key             | LANGFUSE_SECRET_KEY               | PENDING | Phase 9 (tracing)   |
| Langfuse Host                   | LANGFUSE_HOST                     | PENDING | Phase 9 (tracing)   |

Supabase credentials are real and active. Auth, RLS, documents table, and
document_chunks table (with pgvector embeddings) are all live.
OpenAI key is active. Langfuse keys remain as placeholders until Phase 9.

REMINDER TO CLAUDE: Phases 1–4 are complete. Do NOT prompt the user for
Supabase or OpenAI credentials again — all are confirmed ACTIVE.
The /api/process Route Handler is operational (pdf-parse + LlamaIndex
SentenceSplitter + OpenAI text-embedding-3-small → pgvector).

Do not proceed with Langfuse features until those keys are confirmed real.