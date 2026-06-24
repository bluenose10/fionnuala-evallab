// src/app/api/public/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { question, apiKey } = await req.json();

    if (!question || !apiKey) {
      return NextResponse.json({ error: "Missing question or apiKey" }, { status: 400 });
    }

    // 1. Identity Verification (Resolve Client via API Key)
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("client_api_keys")
      .select("user_id")
      .eq("api_key", apiKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    const clientId = keyData.user_id;
    console.log("[DEBUG] Resolved clientId:", clientId);

    // 2. Auto-Winner Configuration Lookup
    const { data: winnerConfig } = await supabaseAdmin
      .from("experiment_runs")
      .select("chunk_size, metadata")
      .eq("user_id", clientId)
      .gte("metadata->>query_count", "5")
      .order("(avg_faithfulness + avg_relevance + avg_precision) / 3 DESC", { ascending: false })
      .limit(1)
      .single();

    const chunkSize = winnerConfig?.chunk_size ?? 512;
    const topK = winnerConfig?.metadata?.top_k ?? 3;
    const threshold = winnerConfig?.metadata?.threshold ?? 0.5;
    console.log("[DEBUG] Config:", { chunkSize, topK, threshold });

    // 3. Embed the User's Question
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 4. Filtered Retrieval
    let { data: chunks, error: rpcError } = await supabaseAdmin.rpc("match_document_chunks", {
      match_embedding: queryEmbedding,
      match_count: topK,
      match_threshold: threshold,
      filter_user_id: clientId,
      filter_chunk_size: chunkSize,
    });

    if (rpcError) console.error("[RPC ERROR]", rpcError);
    console.log("[DEBUG] Chunks from primary search:", chunks?.length ?? 0);

    // FALLBACK: If no chunks found, try without strict filter
    if (!chunks || chunks.length === 0) {
      console.log("[DEBUG] Trying fallback search...");
      const { data: fallbackChunks, error: fallbackError } = await supabaseAdmin.rpc("match_document_chunks", {
        match_embedding: queryEmbedding,
        match_count: topK,
        match_threshold: 0.3,
        filter_user_id: clientId,
        filter_chunk_size: null,
      });

      if (fallbackError) console.error("[FALLBACK RPC ERROR]", fallbackError);
      console.log("[DEBUG] Chunks from fallback search:", fallbackChunks?.length ?? 0);
      chunks = fallbackChunks;
    }

    if (!chunks || chunks.length === 0) {
      console.log("[DEBUG] No chunks found for clientId:", clientId);
      return NextResponse.json({ answer: "I don't have enough information to answer that." });
    }

    // 5. Generate Answer
    const contextText = chunks.map((c: any) => c.content).join("\n\n");
    const prompt = `You are a helpful AI assistant. Answer the user's question strictly using the provided context. Do not make up information.\n\nContext: ${contextText}\n\nQuestion: ${question}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const answer = completion.choices[0].message.content;

    return NextResponse.json({ answer, sources: chunks });

  } catch (error: any) {
    console.error("[PUBLIC CHAT ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}