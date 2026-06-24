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

    // 2. Auto-Winner Configuration Lookup
    // NotebookLM's Guardrail: Only look at runs with a statistically significant sample (e.g., >= 5 queries)
    const { data: winnerConfig } = await supabaseAdmin
      .from("experiment_runs")
      .select("chunk_size, metadata")
      .eq("user_id", clientId)
      .gte("metadata->>query_count", "5") // The statistical guardrail
      .order("(avg_faithfulness + avg_relevance + avg_precision) / 3 DESC", { ascending: false })
      .limit(1)
      .single();

    // Fallback if no experiments have been run yet
    const chunkSize = winnerConfig?.chunk_size ?? 512;
    const topK = winnerConfig?.metadata?.top_k ?? 3;
    const threshold = winnerConfig?.metadata?.threshold ?? 0.5;

    // 3. Embed the User's Question
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 4. Filtered Retrieval (Strictly using the winning chunk_size)
    const { data: chunks } = await supabaseAdmin.rpc("match_document_chunks", {
      match_embedding: queryEmbedding,
      match_count: topK,
      match_threshold: threshold,
      filter_user_id: clientId,
      filter_chunk_size: chunkSize, // Crucial: Only retrieve chunks from the winning config
    });

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ answer: "I don't have enough information to answer that." });
    }

    // 5. Split Provider Synthesis (gpt-4o-mini for speed/cost)
    const contextText = chunks.map((c: any) => c.content).join("\n\n");
    const prompt = `You are a helpful AI assistant. Answer the user's question strictly using the provided context. Do not make up information.\n\nContext: ${contextText}\n\nQuestion: ${question}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const answer = completion.choices[0].message.content;

    // Note: At this point, you would also fire off an async request to /api/evaluate 
    // and log to Langfuse, but we will keep this route fast for the website user.

    return NextResponse.json({ answer, sources: chunks });

  } catch (error: any) {
    console.error("[PUBLIC CHAT ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}