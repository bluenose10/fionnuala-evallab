export const runtime = "nodejs";

// Windows dev: this machine cannot verify external TLS certs.
// Guard ensures this never runs in production.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import OpenAI from "openai";

// ── TypeScript interfaces ─────────────────────────────────────────────────────

interface RetrieveRequest {
  /** The natural-language question to search for. */
  query: string;
  /** How many chunks to return. Default: 5. */
  matchCount?: number;
  /** Optional: scope search to a single document by UUID. */
  documentId?: string;
}

interface ChunkMatch {
  id:          string;
  document_id: string;
  content:     string;
  similarity:  number;
}

interface RetrieveResponse {
  chunks:     ChunkMatch[];
  query:      string;
  matchCount: number;
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
  let body: RetrieveRequest;
  try {
    body = await request.json();
    if (!body.query?.trim()) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body — query string is required" },
      { status: 400 },
    );
  }

  const { query, matchCount = 3, documentId } = body;

  // ── 3. Embed the query via OpenAI text-embedding-3-small ────────────────────
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let queryEmbedding: number[];

  try {
    const embResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query.trim(),
    });
    queryEmbedding = embResponse.data[0].embedding;
  } catch (err) {
    console.error("[/api/retrieve] OpenAI embedding error:", err);
    return NextResponse.json(
      { error: "Failed to generate query embedding" },
      { status: 500 },
    );
  }

  // ── 4. Call match_document_chunks RPC via service client ────────────────────
  //    The service client bypasses RLS; user isolation is enforced by passing
  //    filter_user_id into the SQL function (defence-in-depth).
  const serviceClient = createServiceClient();

  const rpcParams: Record<string, unknown> = {
    query_embedding: queryEmbedding,
    match_count:     3,
    match_threshold: 0.2,
    filter_user_id:  user.id,
  };
  if (documentId) {
    rpcParams.filter_document_id = documentId;
  }

  const { data: chunks, error: rpcError } = await serviceClient.rpc(
    "match_document_chunks",
    rpcParams,
  );

  if (rpcError) {
    console.error("[/api/retrieve] RPC error:", rpcError);
    return NextResponse.json(
      { error: `Retrieval failed: ${rpcError.message}` },
      { status: 500 },
    );
  }

  const response: RetrieveResponse = {
    chunks:     (chunks ?? []) as ChunkMatch[],
    query,
    matchCount: (chunks ?? []).length,
  };

  return NextResponse.json(response);
}
