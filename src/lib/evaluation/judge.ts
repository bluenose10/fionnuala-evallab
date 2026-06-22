import OpenAI from "openai";

export interface RetrievedChunk {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
}

export interface EvaluationScores {
  faithfulness: number;
  answer_relevance: number;
  context_precision: number;
  rationale: string;
}

/** OpenAI token usage captured from the judge completion. */
export interface JudgeUsage {
  promptTokens: number;
  completionTokens: number;
}

/** Extended return type including token usage for cost tracking (Phase 10.3). */
export interface JudgeResult extends EvaluationScores {
  usage: JudgeUsage;
}

const JUDGE_SYSTEM_PROMPT = `You are an objective LLM-as-a-Judge compliance auditor for a RAG evaluation platform.
Your task is to evaluate a retrieval-augmented generation interaction and return a single JSON object.

You will receive:
1. queryText — the original user question.
2. generatedAnswer — the answer produced by the RAG pipeline.
3. retrievedChunks — an ordered array of source chunks returned by the retriever.

Evaluate across exactly three data vectors:

1. FAITHFULNESS (score 0.000 to 1.000)
   - Segment the generatedAnswer into discrete factual claims.
   - For each claim, determine whether it is explicitly supported by the retrievedChunks.
   - Score = (number of supported claims) / (total number of claims).
   - If the answer contains no factual claims, score 1.000 only if it appropriately states that the context is insufficient; otherwise score 0.000.

2. ANSWER RELEVANCE (score 0.000 to 1.000)
   - Grade how directly and completely the generatedAnswer addresses the queryText.
   - Penalize irrelevant digressions, generic fluff, or answers that dodge the user's intent.
   - A perfect answer receives 1.000; a completely off-topic answer receives 0.000.

3. CONTEXT PRECISION (score 0.000 to 1.000)
   - Evaluate the quality of the retrievedChunks ordering.
   - High-quality chunks (directly relevant, information-dense) should appear first.
   - Score based on the proportion of top-ranked chunks that are genuinely useful for answering the queryText.

Return ONLY a valid JSON object matching this schema exactly. Do not wrap the output in markdown code blocks. Do not include any explanatory text outside the JSON object.

{
  "faithfulness": 0.000,
  "answer_relevance": 0.000,
  "context_precision": 0.000,
  "rationale": "Concise engineering explanation of why these scores were assigned."
}`;

function buildJudgeMessages(
  queryText: string,
  generatedAnswer: string,
  retrievedChunks: RetrievedChunk[],
) {
  const userPrompt = `Evaluate the following RAG interaction.

---
queryText:
${queryText}

---
generatedAnswer:
${generatedAnswer}

---
retrievedChunks (in retrieval order):
${JSON.stringify(retrievedChunks, null, 2)}

---
Return ONLY the required JSON object.`;

  return [
    { role: "system" as const, content: JUDGE_SYSTEM_PROMPT },
    { role: "user" as const, content: userPrompt },
  ];
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Run the LLM-as-a-Judge Ragas evaluation.
 *
 * This helper is shared by /api/evaluate and /api/experiments/run so the
 * judge prompt, schema validation, and score clamping are kept in one place.
 */
export async function runRagasJudge(
  queryText: string,
  generatedAnswer: string,
  retrievedChunks: RetrievedChunk[],
  openaiApiKey?: string,
): Promise<JudgeResult> {
  const openai = new OpenAI({
    apiKey: openaiApiKey ?? process.env.OPENAI_API_KEY,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: buildJudgeMessages(queryText, generatedAnswer, retrievedChunks),
    temperature: 0.0,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });

  const rawContent = completion.choices[0]?.message?.content?.trim() ?? "";
  if (!rawContent) {
    throw new Error("Judge model returned empty content.");
  }

  const parsed = JSON.parse(rawContent) as Partial<EvaluationScores>;

  if (
    typeof parsed.faithfulness !== "number" ||
    typeof parsed.answer_relevance !== "number" ||
    typeof parsed.context_precision !== "number" ||
    typeof parsed.rationale !== "string"
  ) {
    throw new Error(
      "Judge response schema mismatch — required numeric scores or rationale missing.",
    );
  }

  // Capture OpenAI usage for cost tracking (Phase 10.3).
  const usage = {
    promptTokens: completion.usage?.prompt_tokens ?? 0,
    completionTokens: completion.usage?.completion_tokens ?? 0,
  };

  return {
    faithfulness: clampScore(parsed.faithfulness),
    answer_relevance: clampScore(parsed.answer_relevance),
    context_precision: clampScore(parsed.context_precision),
    rationale: parsed.rationale,
    usage,
  };
}
