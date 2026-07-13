// src/app/api/public/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { buildRagAnswerPrompt } from "@/lib/prompts/rag-answer";

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
      .maybeSingle();

    if (keyError) {
      console.error("[Public Chat] API key lookup failed:", keyError);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    if (!keyData) {
      return NextResponse.json(
        { error: "Invalid API Key" },
        { status: 401 }
      );
    }

    const clientId = keyData.user_id;

    // 2. Auto-Winner Configuration Lookup
    const { data: winnerConfig, error } = await supabaseAdmin
      .from("experiment_runs")
      .select("chunk_size, avg_faithfulness, avg_relevance, avg_precision")
      .eq("user_id", clientId)
      .gte("query_count", 3)
      .order("avg_faithfulness", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch winner config", error);
    }

    const chunkSize = winnerConfig?.chunk_size ?? 512;
    const topK = 3;
    const threshold = 0.3;

    // 3. Embed the question
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 4. Semantic cache lookup
    const { data: cacheHit } = await supabaseAdmin.rpc("match_semantic_cache", {
      query_embedding: queryEmbedding,
      match_threshold: CACHE_SIMILARITY_THRESHOLD,
      match_user_id: clientId,
    });

    if (cacheHit && cacheHit.length > 0) {
      console.log("[CACHE HIT] Returning cached answer, similarity:", cacheHit[0].similarity);

      // Log cached interaction to audit trail (fire and forget)
      supabaseAdmin.from("public_interaction_logs").insert({
        user_id: clientId,
        question,
        answer: cacheHit[0].answer,
        sources: cacheHit[0].sources,
        cached: true,
      }).then(({ error }) => {
        if (error) console.error("[AUDIT LOG ERROR - cache hit]", error);
      });

      return NextResponse.json({
        answer: cacheHit[0].answer,
        sources: cacheHit[0].sources,
        config: { chunkSize, topK, threshold },
        cached: true,
      });
    }

    console.log("[CACHE MISS] Running full RAG pipeline");

    // 5. Retrieve relevant chunks
    let { data: chunksRaw, error: rpcError } = await supabaseAdmin.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_count: topK,
      match_threshold: threshold,
      filter_user_id: clientId,
      filter_chunk_size: null,
    });

    if (rpcError) console.error("[RPC ERROR]", rpcError);
    console.log("[DEBUG] Chunks found:", chunksRaw?.length ?? 0);

    // No chunks — do NOT log or cache
    if (!chunksRaw || chunksRaw.length === 0) {
      return NextResponse.json({ answer: "I don't have enough information to answer that." });
    }

    // 5b. Resolve document_id → filename for audit trail / citation display.
    let allChunks = chunksRaw.map((c: any) => ({
      ...c,
      document_name: c.document_id, // fallback if lookup below misses this id
    }));

    const uniqueDocIds = Array.from(new Set(chunksRaw.map((c: any) => c.document_id)));

    if (uniqueDocIds.length > 0) {
      const { data: docRows, error: docLookupError } = await supabaseAdmin
        .from("documents")
        .select("id, name")
        .in("id", uniqueDocIds)
        .eq("user_id", clientId);

      if (docLookupError) {
        console.error("[Public Chat] Document name lookup failed:", docLookupError);
      } else {
        const nameById = new Map((docRows ?? []).map((d) => [d.id, d.name]));
        allChunks = chunksRaw.map((c: any) => ({
          ...c,
          document_name: nameById.get(c.document_id) ?? c.document_id,
        }));
      }
    }

    // 6. Generate answer using the same citation-aware prompt as the
    //    internal QA Lab (/api/chat), instead of the previous plain prompt
    //    with no citations. This is what lets us know which retrieved
    //    chunks the model actually used to build the answer, rather than
    //    just which chunks were retrieved as candidates. Chunks are numbered
    //    [1], [2], [3] in retrieval order — same numbering the model is
    //    instructed to cite with.
    const { messages } = buildRagAnswerPrompt(
      question,
      allChunks.map((c: any) => ({ content: c.content })),
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const answer = completion.choices[0].message.content ?? "";

    // 6b. Determine which chunks were actually cited in the answer.
    //    buildRagAnswerPrompt numbers chunks starting at [1], matching
    //    allChunks[0]. If the model didn't cite anything (e.g. it declined
    //    to answer, or ignored the citation instruction), fall back to
    //    treating every retrieved chunk as a source rather than showing
    //    nothing — better to over-disclose than under-disclose here.
    const citedIndices = Array.from(
      new Set(
        [...answer.matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1], 10)),
      ),
    );
    const citedChunks =
      citedIndices.length > 0
        ? citedIndices
            .map((i) => allChunks[i - 1])
            .filter((c): c is (typeof allChunks)[number] => Boolean(c))
        : allChunks;

    // Everything downstream (cache + audit log) stores only the chunks the
    // answer actually cited, so "Sources" in the dashboard reflects what was
    // really used — not just what was retrieved as a candidate.
    const chunks = citedChunks;

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

    // 8. Log to permanent audit trail (fire and forget — no judge, just the transcript)
    supabaseAdmin.from("public_interaction_logs").insert({
      user_id: clientId,
      question,
      answer,
      sources: chunks,
      cached: false,
    }).then(({ error }) => {
      if (error) console.error("[AUDIT LOG ERROR]", error);
      else console.log("[AUDIT LOG] Interaction logged");
    });

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