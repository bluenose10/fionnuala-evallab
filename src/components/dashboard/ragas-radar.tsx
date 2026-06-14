"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

// Placeholder Ragas metrics — replaced with real scores in Phase 7.
const data = [
  { metric: "Faithfulness", score: 0 },
  { metric: "Answer Relevance", score: 0 },
  { metric: "Context Precision", score: 0 },
  { metric: "Context Recall", score: 0 },
  { metric: "Harmfulness", score: 0 },
];

export function RagasRadar() {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid />
        <PolarAngleAxis
          dataKey="metric"
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
        />
        <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
        <Radar
          name="Score"
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
