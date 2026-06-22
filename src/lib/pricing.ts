// ─────────────────────────────────────────────────────────────────────────────
// EvalLab — Phase 10.3: Experiment-Scoped Cost Mapping
//
// Centralised pricing source for OpenAI models used across the experiment
// pipeline.  All rates are per 1,000,000 tokens in USD.
//
// ⚠️ VERIFY against the OpenAI pricing page before treating these as
//    authoritative for production cost display.
// ─────────────────────────────────────────────────────────────────────────────

export type ModelId =
  | "text-embedding-3-small"
  | "gpt-4o"
  | "gpt-4o-mini";

export interface TokenRate {
  /** USD per 1,000,000 input / prompt tokens. */
  inputPerMillion: number;
  /** USD per 1,000,000 output / completion tokens. 0 for embedding-only models. */
  outputPerMillion: number;
}

/**
 * June 2026 baseline rates — VERIFY before production.
 *
 * Split Provider Strategy (Phase 10.3):
 *  - text-embedding-3-small: input-only pricing (embeddings).
 *  - gpt-4o-mini:            high-volume chat generation (≈10× cheaper than gpt-4o).
 *  - gpt-4o:                 Ragas evaluation judge (max JSON fidelity / accuracy).
 */
export const PRICING: Record<ModelId, TokenRate> = {
  "text-embedding-3-small": { inputPerMillion: 0.02, outputPerMillion: 0 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },
};

/**
 * Compute the USD cost for a token pair at a given model's rate.
 * Pure function — no side effects, safe to call anywhere.
 */
export function costForTokens(
  model: ModelId,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = PRICING[model];
  const inputCost = (promptTokens / 1_000_000) * rate.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * rate.outputPerMillion;
  return inputCost + outputCost;
}
