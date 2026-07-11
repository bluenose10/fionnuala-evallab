// ─────────────────────────────────────────────────────────────────────────────
// fionnuala — Phase 10.3: Experiment-Scoped Cost Mapping
//
// CostAccumulator: one instance per experiment configuration, threaded
// through processDocument() to capture OpenAI .usage at all 4 sites.
// The final snapshot is folded into experiment_runs.metadata.cost (JSONB).
// ─────────────────────────────────────────────────────────────────────────────

import type { ModelId } from "@/lib/pricing";
import { costForTokens } from "@/lib/pricing";

/** The four OpenAI call sites in a single configuration run. */
export type CostSite = "chunking" | "query" | "answer" | "judge";

/** Mirrors the OpenAI SDK `.usage` object we capture at each call site. */
export interface UsageSnapshot {
  promptTokens: number;
  completionTokens: number;
}

/** One atomic record — kept individually for full auditability in metadata. */
export interface CostEntry {
  site: CostSite;
  model: ModelId;
  promptTokens: number;
  completionTokens: number;
  usd: number;
}

/**
 * Per-site roll-up used inside the CostBreakdown.
 * Separate from CostEntry so the UI can show summary rows without iterating entries.
 */
export interface SiteSummary {
  usd: number;
  promptTokens: number;
  completionTokens: number;
}

/** Per-model roll-up for the breakdown. */
export interface ModelSummary {
  usd: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Serializable block folded into experiment_runs.metadata.cost.
 * No new migration — rides the existing JSONB column.
 */
export interface CostBreakdown {
  totalUsd: number;
  bySite: Record<CostSite, SiteSummary>;
  byModel: Record<ModelId, ModelSummary>;
  entries: CostEntry[];
}

/** Seed for the four sites — all zeroes. */
const EMPTY_SITE_SUMMARY: SiteSummary = {
  usd: 0,
  promptTokens: 0,
  completionTokens: 0,
};

/** Seed for both models — all zeroes. */
const EMPTY_MODEL_SUMMARY: ModelSummary = {
  usd: 0,
  promptTokens: 0,
  completionTokens: 0,
};

/**
 * Threaded through processDocument(); one instance per configuration.
 * Call .record() at each OpenAI site, then .snapshot() to get the
 * CostBreakdown ready for JSONB persistence.
 */
export class CostAccumulator {
  private entries: CostEntry[] = [];
  private _totalUsd = 0;

  /**
   * Record a single OpenAI `.usage` event at a named site.
   * Idempotent-safe — can be called multiple times (e.g. chunking has
   * multiple batch calls).
   */
  record(site: CostSite, model: ModelId, usage: UsageSnapshot): void {
    const usd = costForTokens(model, usage.promptTokens, usage.completionTokens);

    this.entries.push({
      site,
      model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      usd,
    });

    this._totalUsd += usd;
  }

  /** Running USD total — useful for logging mid-run. */
  get totalUsd(): number {
    return this._totalUsd;
  }

  /**
   * Structured snapshot for JSONB persistence + UI rendering.
   * Aggregates all recorded entries into bySite + byModel roll-ups.
   */
  snapshot(): CostBreakdown {
    const bySite: Record<CostSite, SiteSummary> = {
      chunking: { ...EMPTY_SITE_SUMMARY },
      query: { ...EMPTY_SITE_SUMMARY },
      answer: { ...EMPTY_SITE_SUMMARY },
      judge: { ...EMPTY_SITE_SUMMARY },
    };

    const byModel: Record<ModelId, ModelSummary> = {
      "text-embedding-3-small": { ...EMPTY_MODEL_SUMMARY },
      "gpt-4o": { ...EMPTY_MODEL_SUMMARY },
      "gpt-4o-mini": { ...EMPTY_MODEL_SUMMARY },
    };

    for (const entry of this.entries) {
      // Aggregate by site.
      const site = bySite[entry.site];
      site.usd += entry.usd;
      site.promptTokens += entry.promptTokens;
      site.completionTokens += entry.completionTokens;

      // Aggregate by model.
      const model = byModel[entry.model];
      model.usd += entry.usd;
      model.promptTokens += entry.promptTokens;
      model.completionTokens += entry.completionTokens;
    }

    return {
      totalUsd: this._totalUsd,
      bySite,
      byModel,
      entries: [...this.entries],
    };
  }

  /**
   * Reset all accumulators — reuse the instance across the next
   * configuration run without allocating a new object.
   */
  reset(): void {
    this.entries = [];
    this._totalUsd = 0;
  }
}
