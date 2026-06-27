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

const CACHE_SIMILARITY_THRESHOLD = 0.95;

export async function POST(req: NextRequest) {
  try {
    const { question, apiKey } = await req.json();

    if (!question || !apiKey) {
      return NextResponse.json({ error: "Missing question or apiKey" }, { status: 400 });
    }

    // 1. Verify API Key
    const { data: keyData, error: keyError } = await supabaseAdmin
      .from("client_api_keys")
      .select("user_id")
      .eq("api_key", apiKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API Key" }, { status: 401 });
    }

    const clientId = keyData.user_id;

    // 2. Auto-Winner Configuration Lookup
    const { data: winnerConfig } = await supabaseAdmin
      .from("experiment_runs")
      .select("chunk_size, avg_faithfulness, avg_relevance, avg_precision")
      .eq("user_id", clientId)
      .gte("query_count", 3)
      .order("avg_faithfulness", { ascending: false })
      .limit(1)
      .single();

    const chunkSize = winnerConfig?.chunk_size ?? 512;
    const topK = 3;
    const threshold = 0.3;

    // 3. Embed the question
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 4. Semantic cache lookup — check if a near-identical question was already answered
    const { data: cacheHit } = await supabaseAdmin.rpc("match_semantic_cache", {
      query_embedding: queryEmbedding,
      match_threshold: CACHE_SIMILARITY_THRESHOLD,
      match_user_id: clientId,
    });

    if (cacheHit && cacheHit.length > 0) {
      console.log("[CACHE HIT] Returning cached answer, similarity:", cacheHit[0].similarity);
      return NextResponse.json({
        answer: cacheHit[0].answer,
        sources: cacheHit[0].sources,
        config: { chunkSize, topK, threshold },
        cached: true,
      });
    }

    console.log("[CACHE MISS] Running full RAG pipeline");

    // 5. Retrieve relevant chunks
    let { data: chunks, error: rpcError } = await supabaseAdmin.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_count: topK,
      match_threshold: threshold,
      filter_user_id: clientId,
      filter_chunk_size: null,
    });

    if (rpcError) console.error("[RPC ERROR]", rpcError);
    console.log("[DEBUG] Chunks found:", chunks?.length ?? 0);

    // No chunks found — do NOT cache this response
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ answer: "I don't have enough information to answer that." });
    }

    // 6. Generate answer
    const contextText = chunks.map((c: any) => c.content).join("\n\n");
    const prompt = `You are a helpful AI assistant. Answer the user's question strictly using the provided context. Do not make up information.\n\nContext: ${contextText}\n\nQuestion: ${question}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const answer = completion.choices[0].message.content;

    // 7. Store in semantic cache
const { error: cacheError } = await supabaseAdmin
  .from("semantic_cache")
  .insert({
    user_id: clientId,
    question_text: question,
    question_embedding: queryEmbedding,
    answer,
    sources: chunks,
    chunk_size: chunkSize,
  });

if (cacheError) console.error("[CACHE WRITE ERROR]", cacheError);
else console.log("[CACHE WRITE] Stored successfully");

    return NextResponse.json({
      answer,
      sources: chunks,
      config: { chunkSize, topK, threshold },
      cached: false,
    });

  } catch (error: any) {
    console.error("[PUBLIC CHAT ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
