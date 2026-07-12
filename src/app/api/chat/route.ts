// Spec requirement: Node.js runtime to bypass the 15-second serverless
// execution limit during retrieval + chat generation.
export const runtime = "nodejs";

// Windows dev: this machine cannot verify external TLS certs.
// Guard ensures this never runs in production.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { buildRagAnswerPrompt } from "@/lib/prompts/rag-answer";
import { langfuse, flushLangfuse } from "@/lib/langfuse";
import OpenAI from "openai";

// ── TypeScript interfaces ─────────────────────────────────────────────────────

interface ChatRequest {
  /** The user's natural-language question. */
  query: string;
  /** Number of chunks to retrieve. Default: 5. */
  matchCount?: number;
  /** Optional: scope retrieval to a single document by UUID. */
  document_id?: string;
}

interface SourceChunk {
  id: string;
  document_id: string;
  /** Human-readable source filename, resolved after retrieval. Falls back
   *  to the raw document_id if the lookup fails or the document has no name. */
  document_name: string;
  content: string;
  similarity: number;
}

interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  meta: {
    model: string;
    chunksRetrieved: number;
    query: string;
  };
  traceId: string;
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Auth — verify session via cookie-scoped anon client ──────────────────
  const anonClient = createClient();
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse and validate request body ─────────────────────────────────────
  let body: ChatRequest;
  try {
    body = await request.json();
    if (!body.query?.trim()) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body — query string is required" },
      { status: 400 },
    );
  }

  const { query, matchCount = 3, document_id: documentId } = body;

  // ── 3. Initialize unified parent trace for the full RAG lifecycle ───────────
  //    This trace is propagated to /api/evaluate via traceId so Ragas scores
  //    attach to the same parent trace in Langfuse.
  const trace = langfuse.trace({
    name: "rag-qa-generation",
    userId: user.id,
    input: { query, matchCount, documentId },
    metadata: {
      embeddingModel: "text-embedding-3-small",
      // Split Provider Strategy (Phase 10.3): high-volume chat generation
      // uses gpt-4o-mini for cost efficiency; the Ragas judge (separate
      // call path in /api/evaluate) retains gpt-4o for max accuracy.
      generationModel: "gpt-4o-mini",
    },
  });

  // ── 4. Embed the query with text-embedding-3-small (1536-dim) ───────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let queryEmbedding: number[];

  try {
    const embResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query.trim(),
    });
    queryEmbedding = embResponse.data[0].embedding;
  } catch (err) {
    console.error("[/api/chat] OpenAI embedding error:", err);
    trace.update({
      metadata: {
        error: err instanceof Error ? err.message : "Embedding failed",
        stage: "embedding",
      },
    });
    await flushLangfuse();
    return NextResponse.json(
      { error: "Failed to generate query embedding" },
      { status: 500 },
    );
  }

  // ── 5. Retrieve relevant chunks via match_document_chunks RPC ──────────────
  //    Service client bypasses RLS; user isolation is enforced by passing
  //    filter_user_id into the SQL function (defence-in-depth).
  //    NOTE: single-document scoping (documentId) is not supported by the
  //    canonical match_document_chunks RPC (no filter_document_id parameter
  //    exists on the function) — retrieval always searches across all of the
  //    user's documents. See KIMI.md if single-document filtering is ever
  //    added as a real feature.
  const serviceClient = createServiceClient();

  const rpcParams: Record<string, unknown> = {
    query_embedding: queryEmbedding,
    match_count: 3,
    match_threshold: 0.0,
    filter_user_id: user.id,
  };

  const retrievalSpan = trace.span({ name: "retrieval", input: rpcParams });

  const { data: chunksRaw, error: rpcError } = await serviceClient.rpc(
    "match_document_chunks",
    rpcParams,
  );

  if (rpcError) {
    console.error("[/api/chat] RPC error:", rpcError);
    trace.update({
      metadata: { error: rpcError.message, stage: "retrieval" },
    });
    await flushLangfuse();
    return NextResponse.json(
      { error: `Retrieval failed: ${rpcError.message}` },
      { status: 500 },
    );
  }

  const rawChunks = (chunksRaw ?? []) as Omit<SourceChunk, "document_name">[];

  // ── 5b. Resolve document_id → filename for display ───────────────────────
  //    match_document_chunks only returns document_id (uuid). The QA Lab UI
  //    previously showed this raw uuid with no way to tell which source file
  //    a chunk came from — especially confusing when searching "All Documents"
  //    and getting chunks back from several different files at once.
  let chunks: SourceChunk[] = rawChunks.map((c) => ({
    ...c,
    document_name: c.document_id, // fallback if lookup below misses this id
  }));

  const uniqueDocIds = Array.from(new Set(rawChunks.map((c) => c.document_id)));

  if (uniqueDocIds.length > 0) {
    const { data: docRows, error: docLookupError } = await serviceClient
      .from("documents")
      .select("id, name")
      .in("id", uniqueDocIds)
      .eq("user_id", user.id);

    if (docLookupError) {
      // Non-fatal — the answer/chunks are still valid, we just fall back to
      // showing the raw uuid for document_name on every chunk.
      console.error("[/api/chat] Document name lookup failed:", docLookupError);
    } else {
      const nameById = new Map((docRows ?? []).map((d) => [d.id, d.name]));
      chunks = rawChunks.map((c) => ({
        ...c,
        document_name: nameById.get(c.document_id) ?? c.document_id,
      }));
    }
  }

  retrievalSpan.end({
    output: {
      chunksRetrieved: chunks.length,
      chunks: chunks.map((c) => ({
        id: c.id,
        document_id: c.document_id,
        document_name: c.document_name,
        similarity: c.similarity,
      })),
    },
  });

  // ── 6. Build the grounded prompt with retrieved context ────────────────────
  const { messages } = buildRagAnswerPrompt(query, chunks);

  // ── 7. Generate the answer with gpt-4o-mini ────────────────────────────────
  // Split Provider Strategy: high-volume user-facing chat generation uses
  // gpt-4o-mini (≈10× cheaper than gpt-4o) while staying capable of grounded
  // RAG answers. The Ragas judge path (/api/evaluate) keeps gpt-4o.
  const synthesisSpan = trace.span({ name: "synthesis", input: { messages } });
  let answer: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.0, // Deterministic output for repeatable Ragas evaluation.
      max_tokens: 1024,
    });

    answer = completion.choices[0]?.message?.content?.trim() ?? "";
    synthesisSpan.end({ output: { answer, model: "gpt-4o-mini" } });
  } catch (err) {
    console.error("[/api/chat] OpenAI generation error:", err);
    trace.update({
      metadata: {
        error: err instanceof Error ? err.message : "Generation failed",
        stage: "synthesis",
      },
    });
    await flushLangfuse();
    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 500 },
    );
  }

  // ── 8. Return answer, source chunks, and the trace ID for evaluation ───────
  trace.update({
    output: { answer, chunksRetrieved: chunks.length },
    metadata: { completed: true },
  });

  const response: ChatResponse = {
    answer,
    sources: chunks,
    meta: {
      model: "gpt-4o-mini",
      chunksRetrieved: chunks.length,
      query,
    },
    traceId: trace.id,
  };

  await flushLangfuse();
  return NextResponse.json(response);
}
