import { DollarSign, FileText, FlaskConical, Target } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CostBreakdown } from "@/lib/cost-accumulator";

function formatFaithfulness(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  return `$${usd.toFixed(2)}`;
}

async function fetchOverviewMetrics() {
  const supabase = createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    { count: documentsIndexed },
    { data: evalRows },
    { count: experimentsRun },
    { data: experimentRows },
  ] = await Promise.all([
    supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("status", "indexed"),
    supabase.from("evaluation_logs").select("faithfulness_score"),
    supabase
      .from("experiment_runs")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("experiment_runs")
      .select("metadata, created_at")
      .gte("created_at", monthStart.toISOString()),
  ]);

  const faithfulnessScores = (evalRows ?? [])
    .map((row) => Number(row.faithfulness_score))
    .filter((score) => Number.isFinite(score));

  const avgFaithfulness =
    faithfulnessScores.length > 0
      ? faithfulnessScores.reduce((sum, score) => sum + score, 0) /
        faithfulnessScores.length
      : null;

  const monthlyCostUsd = (experimentRows ?? []).reduce((sum, row) => {
    const metadata = row.metadata as { cost?: CostBreakdown } | null;
    const totalUsd = metadata?.cost?.totalUsd;
    return sum + (typeof totalUsd === "number" ? totalUsd : 0);
  }, 0);

  return {
    documentsIndexed: documentsIndexed ?? 0,
    avgFaithfulness,
    experimentsRun: experimentsRun ?? 0,
    monthlyCostUsd,
  };
}

export default async function DashboardOverview() {
  const metrics = await fetchOverviewMetrics();

  const stats = [
    {
      title: "Documents Indexed",
      value: String(metrics.documentsIndexed),
      hint: "Ready for retrieval",
      icon: FileText,
    },
    {
      title: "Avg. Faithfulness",
      value: formatFaithfulness(metrics.avgFaithfulness),
      hint: "Across QA evaluations",
      icon: Target,
    },
    {
      title: "Experiments Run",
      value: String(metrics.experimentsRun),
      hint: "Configuration comparisons",
      icon: FlaskConical,
    },
    {
      title: "Monthly Cost (USD)",
      value: formatCost(metrics.monthlyCostUsd),
      hint: "Experiment spend this month",
      icon: DollarSign,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Monitor document coverage, evaluation quality, and platform usage at
          a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
