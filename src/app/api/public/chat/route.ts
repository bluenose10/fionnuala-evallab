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
    console.log("[DEBUG] Resolved clientId:", clientId);

    // 2. Embed the question
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 3. Retrieve relevant chunks
    let { data: chunks, error: rpcError } = await supabaseAdmin.rpc("match_document_chunks", {
      match_embedding: queryEmbedding,
      match_count: 3,
      match_threshold: 0.3,
      filter_user_id: clientId,
      filter_chunk_size: null,
    });

    if (rpcError) console.error("[RPC ERROR]", rpcError);
    console.log("[DEBUG] Chunks found:", chunks?.length ?? 0);

    if (!chunks || chunks.length === 0) {
      return NextResponse.json({ answer: "I don't have enough information to answer that." });
    }

    // 4. Generate answer
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