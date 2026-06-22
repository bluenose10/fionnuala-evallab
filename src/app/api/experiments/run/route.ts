// Spec requirement: Node.js runtime to bypass the 15-second serverless
// execution limit when re-processing PDFs and running multiple Ragas judges.
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
import { runRagasJudge } from "@/lib/evaluation/judge";
import { CostAccumulator } from "@/lib/cost-accumulator";
import type { CostBreakdown } from "@/lib/cost-accumulator";
import { Document, SentenceSplitter } from "llamaindex";
import pdfParse from "pdf-parse";
import OpenAI from "openai";

// ── TypeScript interfaces ─────────────────────────────────────────────────────

interface ExperimentConfiguration {
  name: string;
  chunkSize: number;
  chunkOverlap: number;
  matchCount?: number;
}

interface ExperimentRunRequest {
  documentId: string;
  queries: string[];
  configurations?: ExperimentConfiguration[];
}

interface ChunkWithEmbedding {
  content: string;
  chunkIndex: number;
  embedding: number[];
}

interface QueryResult {
  query: string;
  answer: string;
  chunks: ChunkWithEmbedding[];
  scores: {
    faithfulness: number;
    answer_relevance: number;
    context_precision: number;
  };
  rationale: string;
}

interface ConfigurationResult {
  configuration: ExperimentConfiguration;
  queryResults: QueryResult[];
  averages: {
    avg_faithfulness: number;
    avg_answer_relevance: number;
    avg_context_precision: number;
  };
  total_queries_tested: number;
  cost: CostBreakdown;
}

const DEFAULT_CONFIGURATIONS: ExperimentConfiguration[] = [
  { name: "Small chunks (256 / 32)", chunkSize: 256, chunkOverlap: 32, matchCount: 5 },
  { name: "Medium chunks (512 / 50)", chunkSize: 512, chunkOverlap: 50, matchCount: 5 },
  // Large config (1024 / 100) restored in Phase 10.3 to complete the
  // "Rule of Three" for stakeholder A/B comparisons. Token-sized chunks.
  { name: "Large chunks (1024 / 100)", chunkSize: 1024, chunkOverlap: 100, matchCount: 5 },
];

// Phase 10.3 scaling fix: bumped 20 → 100. Minimizes network latency,
// avoids OpenAI RPM limits, and ~5× faster ingestion while preserving
// atomic data integrity (1:1 input→output ordering guaranteed by OpenAI).
const EMBEDDING_BATCH_SIZE = 100;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ── Core pipeline ─────────────────────────────────────────────────────────────

async function processDocument(
  documentId: string,
  userId: string,
  config: ExperimentConfiguration,
  queries: string[],
): Promise<ConfigurationResult> {
  const serviceClient = createServiceClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const cost = new CostAccumulator();

  // 1. Fetch document metadata and storage file.
  const { data: doc, error: docError } = await serviceClient
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docError || !doc) {
    throw new Error(`Document not found or access denied: ${docError?.message}`);
  }

  const { data: fileData, error: dlErr } = await serviceClient.storage
    .from("documents")
    .download(doc.storage_path);

  if (dlErr || !fileData) {
    throw new Error(`Storage download failed: ${dlErr?.message}`);
  }

  // 2. Extract text.
  const buffer = Buffer.from(await fileData.arrayBuffer());
  const pdfData = await pdfParse(buffer);
  const rawText = pdfData.text?.trim();

  if (!rawText) {
    throw new Error("PDF produced no extractable text.");
  }

  // 3. Chunk with LlamaIndex SentenceSplitter using the experiment config.
  const llamaDoc = new Document({ text: rawText });
  const splitter = new SentenceSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
  const nodes = splitter.getNodesFromDocuments([llamaDoc]);

  if (nodes.length === 0) {
    throw new Error("PDF produced zero chunks after splitting.");
  }

  const chunkTexts = nodes.map((n) => n.getText());

  // 4. Embed chunks in defensive batches of 20.
  const embeddings: number[][] = [];
  for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const { data: embedData, usage: embedUsage } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    embeddings.push(...embedData.map((e) => e.embedding));

    // Capture cost at site 1 — chunk embeddings (input-only model).
    cost.record("chunking", "text-embedding-3-small", {
      promptTokens: embedUsage?.prompt_tokens ?? 0,
      completionTokens: 0,
    });
  }

  const chunks: ChunkWithEmbedding[] = chunkTexts.map((content, i) => ({
    content,
    chunkIndex: i,
    embedding: embeddings[i],
  }));

  const matchCount = config.matchCount ?? 5;

  // 5. Run each test query through retrieval + synthesis + evaluation.
  const queryResults: QueryResult[] = [];

  for (const query of queries) {
    const queryTrimmed = query.trim();
    if (!queryTrimmed) continue;

    // Embed query.
    const {
      data: queryEmbedData,
      usage: queryEmbedUsage,
    } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: queryTrimmed,
    });
    const queryEmbedding = queryEmbedData[0].embedding;

    // Capture cost at site 2 — query embedding (input-only model).
    cost.record("query", "text-embedding-3-small", {
      promptTokens: queryEmbedUsage?.prompt_tokens ?? 0,
      completionTokens: 0,
    });

    // Retrieve top-k chunks by cosine similarity.
    const ranked = chunks
      .map((chunk) => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    // Synthesize answer — Split Provider Strategy (Phase 10.3).
    // High-volume answer generation uses gpt-4o-mini (≈10× cheaper), mirroring
    // production /api/chat. The Ragas judge (site 4) retains gpt-4o for accuracy.
    const { messages } = buildRagAnswerPrompt(
      queryTrimmed,
      ranked.map((c) => ({ content: c.content })),
    );

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.0,
      max_tokens: 1024,
    });

    const answer = completion.choices[0]?.message?.content?.trim() ?? "";

    // Capture cost at site 3 — RAG answer completion (gpt-4o-mini, input + output).
    cost.record("answer", "gpt-4o-mini", {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
    });

    // Evaluate with Ragas judge.
    const scores = await runRagasJudge(
      queryTrimmed,
      answer,
      ranked.map((c) => ({
        id: `${config.name}-chunk-${c.chunkIndex}`,
        document_id: documentId,
        content: c.content,
        similarity: c.similarity,
      })),
    );

    // Capture cost at site 4 — Ragas judge completion (gpt-4o, input + output).
    // .usage is returned by the widened runRagasJudge signature (Phase 10.3).
    cost.record("judge", "gpt-4o", scores.usage);

    queryResults.push({
      query: queryTrimmed,
      answer,
      chunks: ranked,
      scores: {
        faithfulness: scores.faithfulness,
        answer_relevance: scores.answer_relevance,
        context_precision: scores.context_precision,
      },
      rationale: scores.rationale,
    });
  }

  // 6. Compute averages.
  const averages = {
    avg_faithfulness: average(queryResults.map((r) => r.scores.faithfulness)),
    avg_answer_relevance: average(queryResults.map((r) => r.scores.answer_relevance)),
    avg_context_precision: average(queryResults.map((r) => r.scores.context_precision)),
  };

  return {
    configuration: config,
    queryResults,
    averages,
    total_queries_tested: queryResults.length,
    cost: cost.snapshot(),
  };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth — verify session via cookie-scoped anon client.
  const anonClient = createClient();
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse and validate request body.
  let body: ExperimentRunRequest;
  try {
    body = await request.json();

    if (
      typeof body.documentId !== "string" ||
      body.documentId.trim().length === 0 ||
      !Array.isArray(body.queries) ||
      body.queries.length === 0 ||
      body.queries.some((q) => typeof q !== "string" || q.trim().length === 0)
    ) {
      throw new Error(
        "Invalid request body — documentId and a non-empty queries array are required.",
      );
    }
  } catch (err) {
    console.error("[/api/experiments/run] Request validation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request body" },
      { status: 400 },
    );
  }

  const { documentId, queries } = body;
  const userId = user.id;
  const configurations =
    body.configurations && body.configurations.length > 0
      ? body.configurations
      : DEFAULT_CONFIGURATIONS;

  // 3. Run the experiment for each configuration.
  const serviceClient = createServiceClient();
  const results: ConfigurationResult[] = [];

  try {
    for (const config of configurations) {
      const result = await processDocument(documentId, userId, config, queries);

      // 4. Persist the result to experiment_runs.
      const { error: insertError } = await serviceClient
        .from("experiment_runs")
        .insert({
          user_id: userId,
          document_id: documentId,
          configuration_name: config.name,
          chunk_size: config.chunkSize,
          chunk_overlap: config.chunkOverlap,
          prompt_template: "default-rag-answer",
          model_name: "gpt-4o-mini",
          avg_faithfulness: result.averages.avg_faithfulness,
          avg_answer_relevance: result.averages.avg_answer_relevance,
          avg_context_precision: result.averages.avg_context_precision,
          total_queries_tested: result.total_queries_tested,
          metadata: {
            match_count: config.matchCount ?? 5,
            queries: result.queryResults.map((r) => ({
              query: r.query,
              scores: r.scores,
              rationale: r.rationale,
            })),
            // Phase 10.3 — folded into the existing JSONB metadata column.
            // No migration: structured cost breakdown for the leaderboard UI.
            cost: result.cost,
          },
        });

      if (insertError) {
        throw new Error(
          `Failed to persist experiment run for "${config.name}": ${insertError.message}`,
        );
      }

      results.push(result);
    }
  } catch (err) {
    console.error("[/api/experiments/run] Experiment failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Experiment failed" },
      { status: 500 },
    );
  }

  // 5. Return comparative summary.
  return NextResponse.json({
    success: true,
    documentId,
    configurationsTested: results.length,
    results: results.map((r) => ({
      name: r.configuration.name,
      chunkSize: r.configuration.chunkSize,
      chunkOverlap: r.configuration.chunkOverlap,
      totalQueries: r.total_queries_tested,
      averages: r.averages,
      costUsd: r.cost.totalUsd,
      costBreakdown: r.cost,
    })),
  });
}
