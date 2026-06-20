import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RagasRadar } from "@/components/dashboard/ragas-radar";
import { Activity } from "lucide-react";

// ── Helpers ─────────────────────────────────────────────────────────────────────

function formatScore(value: number): string {
  return value.toFixed(3);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

// ── Metrics metadata ────────────────────────────────────────────────────────────

const metrics = [
  {
    key: "faithfulness",
    name: "Faithfulness",
    description: "Is the answer supported by the retrieved context?",
  },
  {
    key: "answerRelevance",
    name: "Answer Relevance",
    description: "Does the answer actually address the question?",
  },
  {
    key: "contextPrecision",
    name: "Context Precision",
    description: "Are the retrieved chunks relevant (signal vs. noise)?",
  },
] as const;

type MetricKey = (typeof metrics)[number]["key"];

interface EvaluationRow {
  faithfulness_score: number;
  answer_relevance_score: number;
  context_precision_score: number;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function EvaluationHubPage() {
  // Auth — mirror the lab/page.tsx pattern (cookie-scoped, RLS-respecting).
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive fallback; middleware already guards this route.
  if (!user) {
    redirect("/login");
  }

  // Fetch the user's own evaluations. RLS policy ensures isolation
  // (auth.uid() = user_id). Rolling window of last 50 evaluations.
  const { data: evals } = await supabase
    .from("evaluation_logs")
    .select(
      "faithfulness_score, answer_relevance_score, context_precision_score",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (evals ?? []) as EvaluationRow[];
  const evaluationCount = rows.length;

  // Compute averages across the rolling window.
  const avgFaithfulness = average(rows.map((r) => r.faithfulness_score));
  const avgAnswerRelevance = average(
    rows.map((r) => r.answer_relevance_score),
  );
  const avgContextPrecision = average(
    rows.map((r) => r.context_precision_score),
  );

  const averages: Record<MetricKey, number> = {
    faithfulness: avgFaithfulness,
    answerRelevance: avgAnswerRelevance,
    contextPrecision: avgContextPrecision,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluation Hub</h1>
        <p className="text-muted-foreground">
          Objective Ragas scoring across your{" "}
          {evaluationCount > 0 ? (
            <strong>{evaluationCount} most recent</strong>
          ) : (
            "upcoming"
          )}{" "}
          evaluations — not a vibe check.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Ragas Score Profile</CardTitle>
            </div>
            <CardDescription>
              Radar chart across the three core evaluation dimensions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RagasRadar
              faithfulness={avgFaithfulness}
              answerRelevance={avgAnswerRelevance}
              contextPrecision={avgContextPrecision}
              evaluationCount={evaluationCount}
            />
          </CardContent>
        </Card>

        {/* Metric Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Metric Breakdown</CardTitle>
            <CardDescription>
              Each dimension scored 0.0 – 1.0 per evaluated answer.
              {evaluationCount > 0 && (
                <span className="ml-1 text-muted-foreground">
                  (averaged across {evaluationCount} evaluations)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.map((metric) => {
              const value = averages[metric.key];
              return (
                <div key={metric.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{metric.name}</span>
                    <Badge variant={value >= 0.8 ? "success" : "secondary"}>
                      {evaluationCount > 0
                        ? `${formatScore(value)} / 1.0`
                        : `— / 1.0`}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.round(value * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
