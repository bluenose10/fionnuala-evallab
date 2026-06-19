// Spec requirement: Node.js runtime to bypass the 15-second serverless
// execution limit when running the LLM-as-a-Judge Ragas pipeline.
export const runtime = "nodejs";

// Windows dev: this machine cannot verify external TLS certs.
// Guard ensures this never runs in production.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { langfuse, flushLangfuse } from "@/lib/langfuse";
import {
  runRagasJudge,
  type RetrievedChunk,
  type EvaluationScores,
} from "@/lib/evaluation/judge";

// ── TypeScript interfaces ─────────────────────────────────────────────────────

interface EvaluateRequest {
  /** Langfuse trace ID produced by /api/chat. */
  traceId: string;
  /** Optional: override document id. If omitted, the route tries to infer it from the trace. */
  documentId?: string;
  /** Optional: override user id. If omitted, the route tries to infer it from the trace. */
  userId?: string;
  /** Optional: override query text. */
  queryText?: string;
  /** Optional: override generated answer. */
  generatedAnswer?: string;
  /** Optional: override retrieved chunks. */
  retrievedChunks?: RetrievedChunk[];
  /** When true, the route returns 202 immediately and evaluates in the background. */
  async?: boolean;
}

interface EvaluationResult {
  success: boolean;
  scores: {
    faithfulness: number;
    answer_relevance: number;
    context_precision: number;
  };
  rationale: string;
  evaluationId?: string;
}

interface EvaluationLogRow {
  user_id: string;
  document_id: string;
  query_text: string;
  generated_answer: string;
  faithfulness_score: number;
  answer_relevance_score: number;
  context_precision_score: number;
  rationale: string;
  retrieved_context: RetrievedChunk[];
}

interface LangfuseTrace {
  id: string;
  userId?: string;
  input?: {
    query?: string;
    matchCount?: number;
    documentId?: string;
  };
  output?: {
    answer?: string;
    chunksRetrieved?: number;
  };
  observations?: Array<{
    name: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  }>;
}

// ── Langfuse trace fetcher ────────────────────────────────────────────────────

async function fetchTraceFromLangfuse(
  traceId: string,
): Promise<{
  queryText: string;
  generatedAnswer: string;
  retrievedChunks: RetrievedChunk[];
  userId?: string;
  documentId?: string;
}> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host =
    process.env.LANGFUSE_HOST ||
    process.env.LANGFUSE_BASEURL ||
    "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    throw new Error("LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY is not configured.");
  }

  const baseUrl = host.replace(/\/+$/, "");
  const credentials = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");

  const res = await fetch(`${baseUrl}/api/public/traces/${traceId}`, {
    headers: { Authorization: `Basic ${credentials}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`Langfuse trace fetch failed: ${res.status} ${res.statusText}`);
  }

  const trace = (await res.json()) as LangfuseTrace;

  // Extract query from trace input.
  const queryText = trace.input?.query ?? "";

  // Walk observations to find the synthesis (answer) and retrieval (chunks) spans.
  let generatedAnswer = trace.output?.answer ?? "";
  const retrievedChunks: RetrievedChunk[] = [];

  for (const obs of trace.observations ?? []) {
    if (obs.name === "synthesis" && typeof obs.output?.answer === "string") {
      generatedAnswer = obs.output.answer;
    }
    if (obs.name === "retrieval" && Array.isArray(obs.output?.chunks)) {
      retrievedChunks.push(...(obs.output.chunks as RetrievedChunk[]));
    }
  }

  return {
    queryText,
    generatedAnswer,
    retrievedChunks,
    userId: trace.userId,
    documentId: trace.input?.documentId,
  };
}

// ── Ragas judge ───────────────────────────────────────────────────────────────

// ── Core evaluation pipeline ──────────────────────────────────────────────────

async function runEvaluation(params: {
  traceId: string;
  queryText: string;
  generatedAnswer: string;
  retrievedChunks: RetrievedChunk[];
  documentId: string;
  userId: string;
}): Promise<EvaluationResult> {
  const {
    traceId,
    queryText,
    generatedAnswer,
    retrievedChunks,
    documentId,
    userId,
  } = params;

  // 1. Run the LLM-as-a-Judge evaluation.
  const scores = await runRagasJudge(queryText, generatedAnswer, retrievedChunks);

  // 2. Persist the record of truth to evaluation_logs (multi-tenant by user_id).
  const serviceClient = createServiceClient();

  const row: EvaluationLogRow = {
    user_id: userId,
    document_id: documentId,
    query_text: queryText.trim(),
    generated_answer: generatedAnswer.trim(),
    faithfulness_score: scores.faithfulness,
    answer_relevance_score: scores.answer_relevance,
    context_precision_score: scores.context_precision,
    rationale: scores.rationale,
    retrieved_context: retrievedChunks,
  };

  const { data: inserted, error: insertError } = await serviceClient
    .from("evaluation_logs")
    .insert(row)
    .select("id")
    .single();

  if (insertError) {
    throw new Error(`Supabase insert failed: ${insertError.message}`);
  }

  // 3. Attach Ragas metrics to the original generation trace.
  try {
    const trace = langfuse.trace({ id: traceId });
    const evaluationSpan = trace.span({
      name: "ragas-evaluation",
      input: { queryText, generatedAnswer, retrievedChunks },
    });

    evaluationSpan.score({
      name: "faithfulness",
      value: scores.faithfulness,
      comment: scores.rationale,
    });
    evaluationSpan.score({
      name: "answer_relevance",
      value: scores.answer_relevance,
    });
    evaluationSpan.score({
      name: "context_precision",
      value: scores.context_precision,
    });

    evaluationSpan.end({
      output: {
        scores: {
          faithfulness: scores.faithfulness,
          answer_relevance: scores.answer_relevance,
          context_precision: scores.context_precision,
        },
        rationale: scores.rationale,
      },
    });

    trace.update({
      metadata: { evaluated: true, judgeRationale: scores.rationale },
    });
  } catch (traceErr) {
    console.error(
      "[/api/evaluate] Failed to append evaluation to Langfuse trace:",
      traceErr,
    );
  }

  await flushLangfuse();

  return {
    success: true,
    scores: {
      faithfulness: scores.faithfulness,
      answer_relevance: scores.answer_relevance,
      context_precision: scores.context_precision,
    },
    rationale: scores.rationale,
    evaluationId: inserted?.id,
  };
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── 1. Parse and validate inbound data contract ─────────────────────────────
  let body: EvaluateRequest;
  try {
    body = await request.json();

    if (typeof body.traceId !== "string" || body.traceId.trim().length === 0) {
      throw new Error("traceId is required.");
    }
  } catch (err) {
    console.error("[EVALUATION_ENGINE_ERROR] Request validation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    traceId,
    documentId: providedDocumentId,
    userId: providedUserId,
    queryText: providedQueryText,
    generatedAnswer: providedGeneratedAnswer,
    retrievedChunks: providedRetrievedChunks,
    async: asyncMode,
  } = body;

  // ── 2. Hydrate evaluation inputs from Langfuse when overrides are missing ────
  let queryText = providedQueryText ?? "";
  let generatedAnswer = providedGeneratedAnswer ?? "";
  let retrievedChunks = providedRetrievedChunks ?? [];
  let userId = providedUserId;
  let documentId = providedDocumentId;

  const needsHydration =
    !queryText ||
    !generatedAnswer ||
    retrievedChunks.length === 0 ||
    !userId ||
    !documentId;

  if (needsHydration) {
    try {
      const traceData = await fetchTraceFromLangfuse(traceId);
      queryText = queryText || traceData.queryText;
      generatedAnswer = generatedAnswer || traceData.generatedAnswer;
      retrievedChunks =
        retrievedChunks.length > 0 ? retrievedChunks : traceData.retrievedChunks;
      userId = userId || traceData.userId;
      documentId = documentId || traceData.documentId;
    } catch (err) {
      console.error("[EVALUATION_ENGINE_ERROR] Trace hydration failed:", err);
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Failed to hydrate evaluation from Langfuse trace",
        },
        { status: 500 },
      );
    }
  }

  // ── 3. Validate required fields before evaluation ────────────────────────────
  if (
    !queryText.trim() ||
    !generatedAnswer.trim() ||
    retrievedChunks.length === 0 ||
    !documentId ||
    !userId
  ) {
    return NextResponse.json(
      {
        error:
          "Missing required evaluation fields. Provide queryText, generatedAnswer, retrievedChunks, documentId, and userId, or ensure the Langfuse trace contains them.",
      },
      { status: 400 },
    );
  }

  // ── 4. Run synchronously or return 202 and continue in the background ────────
  if (asyncMode) {
    Promise.resolve().then(async () => {
      try {
        await runEvaluation({
          traceId,
          queryText,
          generatedAnswer,
          retrievedChunks,
          documentId,
          userId,
        });
      } catch (err) {
        console.error("[/api/evaluate] Background evaluation failed:", err);
      }
    });

    return NextResponse.json(
      { accepted: true, traceId, message: "Evaluation queued" },
      { status: 202 },
    );
  }

  try {
    const result = await runEvaluation({
      traceId,
      queryText,
      generatedAnswer,
      retrievedChunks,
      documentId,
      userId,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[EVALUATION_ENGINE_ERROR] Evaluation failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Evaluation failed" },
      { status: 500 },
    );
  }
}

