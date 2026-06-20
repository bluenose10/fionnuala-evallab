"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, Loader2, Play, Trophy } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExperimentRun = {
  id: string;
  document_id: string;
  configuration_name: string;
  chunk_size: number;
  chunk_overlap: number;
  avg_faithfulness: number;
  avg_answer_relevance: number;
  avg_context_precision: number;
  total_queries_tested: number;
  created_at: string;
};

type IndexedDocument = {
  id: string;
  name: string;
  chunk_count: number;
  created_at: string;
};

type ChartRow = {
  metric: string;
  [configurationName: string]: string | number;
};

const DEFAULT_QUERIES = [
  "What is the main topic of this document?",
  "What are the key requirements or rules described?",
  "Summarize the most important conclusions.",
];

const METRIC_LABELS = [
  { key: "avg_faithfulness", label: "Faithfulness" },
  { key: "avg_answer_relevance", label: "Relevance" },
  { key: "avg_context_precision", label: "Precision" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

// Three-metric composite (faithfulness + relevance + precision) / 3.
// Previously divided by 4 with a fabricated context_recall that aliased
// faithfulness, which silently double-weighted faithfulness in rankings.
function averageScore(run: ExperimentRun): number {
  return (
    (run.avg_faithfulness +
      run.avg_answer_relevance +
      run.avg_context_precision) /
    3
  );
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExperimentLeaderboard() {
  const supabase = createClient();

  const [documents, setDocuments] = useState<IndexedDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [queries, setQueries] = useState<string>(DEFAULT_QUERIES.join("\n"));

  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch indexed documents and existing experiment runs on mount.
  useEffect(() => {
    async function loadData() {
      setLoadingDocs(true);
      setLoadingRuns(true);
      setError(null);

      try {
        const { data: docs, error: docsError } = await supabase
          .from("documents")
          .select("id, name, chunk_count, created_at")
          .eq("status", "indexed")
          .order("created_at", { ascending: false });

        if (docsError) throw docsError;

        const indexedDocs = (docs ?? []) as IndexedDocument[];
        setDocuments(indexedDocs);
        if (indexedDocs.length > 0) {
          setSelectedDocumentId(indexedDocs[0].id);
        }

        const { data: existingRuns, error: runsError } = await supabase
          .from("experiment_runs")
          .select("*")
          .order("created_at", { ascending: false });

        if (runsError) throw runsError;

        setRuns((existingRuns ?? []) as ExperimentRun[]);
      } catch (err) {
        console.error("[ExperimentLeaderboard] Load failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard data",
        );
      } finally {
        setLoadingDocs(false);
        setLoadingRuns(false);
      }
    }

    loadData();
  }, [supabase]);

  async function handleRunExperiment() {
    if (!selectedDocumentId) {
      setError("Please select an indexed document first.");
      return;
    }

    const queryList = queries
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    if (queryList.length === 0) {
      setError("Please provide at least one evaluation query.");
      return;
    }

    setRunning(true);
    setError(null);

    try {
      const res = await fetch("/api/experiments/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDocumentId,
          queries: queryList,
        }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || `Experiment run failed (${res.status})`);
      }

      // Refresh runs after a successful experiment.
      const { data: freshRuns, error: refreshError } = await supabase
        .from("experiment_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (refreshError) throw refreshError;

      setRuns((freshRuns ?? []) as ExperimentRun[]);
    } catch (err) {
      console.error("[ExperimentLeaderboard] Run failed:", err);
      setError(err instanceof Error ? err.message : "Experiment run failed");
    } finally {
      setRunning(false);
    }
  }

  // Limit chart/table to the most recent run per configuration for clarity.
  const latestRunsByConfig = useMemo(() => {
    const seen = new Set<string>();
    return runs.filter((run) => {
      if (seen.has(run.configuration_name)) return false;
      seen.add(run.configuration_name);
      return true;
    });
  }, [runs]);

  const winner = useMemo(() => {
    if (latestRunsByConfig.length === 0) return null;
    return latestRunsByConfig.reduce((best, run) =>
      averageScore(run) > averageScore(best) ? run : best,
    );
  }, [latestRunsByConfig]);

  const chartData: ChartRow[] = useMemo(() => {
    return METRIC_LABELS.map(({ key, label }) => {
      const row: ChartRow = { metric: label };
      latestRunsByConfig.forEach((run) => {
        // Type-safe extraction of the metric value by key.
        // METRIC_LABELS keys are guaranteed to be numeric fields on ExperimentRun.
        const value = run[key as keyof ExperimentRun];
        row[run.configuration_name] = typeof value === "number" ? value : 0;
      });
      return row;
    });
  }, [latestRunsByConfig]);

  const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))"];

  const isLoading = loadingDocs || loadingRuns;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Experiment Leaderboard
        </h1>
        <p className="text-muted-foreground">
          A/B test chunking configurations and rank them by measured Ragas
          quality.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Run Configuration</CardTitle>
          <CardDescription>
            Select an indexed document and optionally edit the evaluation
            queries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingDocs ? (
            <Skeleton className="h-10 w-full" />
          ) : documents.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No indexed documents available. Upload and process a document
              first.
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="document-select">Indexed Document</Label>
              <select
                id="document-select"
                value={selectedDocumentId}
                onChange={(e) => setSelectedDocumentId(e.target.value)}
                disabled={running}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} ({doc.chunk_count} chunks)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="queries">Evaluation Queries</Label>
            <Textarea
              id="queries"
              value={queries}
              onChange={(e) => setQueries(e.target.value)}
              disabled={running}
              rows={4}
              placeholder="Enter one query per line"
            />
          </div>

          <Button
            onClick={handleRunExperiment}
            disabled={running || !selectedDocumentId || documents.length === 0}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Experiment...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run New Experiment
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Request failed</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {running && (
        <Card>
          <CardContent className="space-y-4 py-8">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running experiment — this may take a minute...
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {!isLoading && !running && latestRunsByConfig.length > 0 && winner && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              <span className="font-semibold">Winner:</span>{" "}
              {winner.configuration_name} with an average score of{" "}
              <Badge variant="success">{formatPercent(averageScore(winner))}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on the most recent run per configuration, averaged across
              Faithfulness, Relevance, and Precision.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {!isLoading && !running && latestRunsByConfig.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ragas Score Comparison</CardTitle>
            <CardDescription>
              Radar chart comparing the three core evaluation dimensions
              (Faithfulness, Relevance, Precision).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={chartData} outerRadius="70%">
                  <PolarGrid />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <PolarRadiusAxis domain={[0, 1]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: number) => formatPercent(value)}
                  />
                  <Legend />
                  {latestRunsByConfig.map((run, index) => (
                    <Radar
                      key={run.configuration_name}
                      name={run.configuration_name}
                      dataKey={run.configuration_name}
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                      fillOpacity={0.4}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !running && latestRunsByConfig.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              Raw results ranked by average Ragas score.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Configuration</TableHead>
                  <TableHead>Chunk Size</TableHead>
                  <TableHead>Avg. Score</TableHead>
                  <TableHead>Faithfulness</TableHead>
                  <TableHead>Relevance</TableHead>
                  <TableHead>Precision</TableHead>
                  <TableHead>Queries</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...latestRunsByConfig]
                  .sort((a, b) => averageScore(b) - averageScore(a))
                  .map((run, index) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {index === 0 && (
                          <Trophy className="mr-1 inline h-3 w-3 text-primary" />
                        )}
                        {run.configuration_name}
                      </TableCell>
                      <TableCell>{run.chunk_size}</TableCell>
                      <TableCell>
                        <Badge variant={index === 0 ? "success" : "secondary"}>
                          {formatPercent(averageScore(run))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatPercent(run.avg_faithfulness)}
                      </TableCell>
                      <TableCell>
                        {formatPercent(run.avg_answer_relevance)}
                      </TableCell>
                      <TableCell>
                        {formatPercent(run.avg_context_precision)}
                      </TableCell>
                      <TableCell>{run.total_queries_tested}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(run.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !running && latestRunsByConfig.length === 0 && (
        <Card>
          <CardContent className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>No experiment runs yet.</p>
            <p>Select a document and click "Run New Experiment" to begin.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
