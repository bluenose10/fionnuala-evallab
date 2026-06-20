"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

// Phase 7 originally rendered this radar with hardcoded placeholder scores.
// It is now driven by real averaged Ragas data passed from the Evaluation Hub
// server component (which reads evaluation_logs).
//
// Harmfulness axis: previously a static `score: 0` placeholder retained "for
// chart stability during Phase 10". Removed when the Evaluation Hub was wired
// to live data — keeping a fabricated 4th axis contradicts the 3-metric truth
// enforced platform-wide after the Phase 10.1 recall purge. Restore this axis
// ONLY when real safety scoring ships (deferred to Phase 11).

interface RagasRadarProps {
  /** Averaged faithfulness score, 0–1. */
  faithfulness: number;
  /** Averaged answer relevance score, 0–1. */
  answerRelevance: number;
  /** Averaged context precision score, 0–1. */
  contextPrecision: number;
  /** Number of evaluations the averages were computed over (for subtitle). */
  evaluationCount: number;
}

export function RagasRadar({
  faithfulness,
  answerRelevance,
  contextPrecision,
  evaluationCount,
}: RagasRadarProps) {
  const data = [
    { metric: "Faithfulness", score: faithfulness },
    { metric: "Answer Relevance", score: answerRelevance },
    { metric: "Context Precision", score: contextPrecision },
  ];

  // Empty state: no evaluations yet. Render a muted radar at 0 rather than
  // implying data exists.
  if (evaluationCount === 0) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No evaluations yet. Ask a question in the Lab to generate Ragas
          scores.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value: number) => value.toFixed(3)} />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.5}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
