import {
  Activity,
  CheckCircle2,
  FileText,
  Target,
  TrendingUp,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
  {
    title: "Documents Indexed",
    value: "—",
    hint: "Phase 2: ingestion",
    icon: FileText,
  },
  {
    title: "Avg. Faithfulness",
    value: "—",
    hint: "Phase 7: Ragas",
    icon: Target,
  },
  {
    title: "Experiments Run",
    value: "—",
    hint: "Phase 10: leaderboard",
    icon: TrendingUp,
  },
  {
    title: "Traces Captured",
    value: "—",
    hint: "Phase 9: Langfuse OTel",
    icon: Activity,
  },
];

const roadmap = [
  { phase: 1, title: "Project Setup", status: "done" },
  { phase: 2, title: "File Uploads", status: "done" },
  { phase: 3, title: "Document Processing", status: "done" },
  { phase: 4, title: "Vectorization", status: "done" },
  { phase: 5, title: "Retrieval", status: "done" },
  { phase: 6, title: "AI Answers", status: "done" },
  { phase: 7, title: "Evaluation System", status: "done" },
  { phase: 8, title: "Observability (Langfuse SDK)", status: "done" },
  { phase: 9, title: "Observability & Tracing (OpenTelemetry)", status: "done" },
  { phase: 10, title: "Experiments & Portfolio Polish", status: "current" },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Your AI evaluation workspace. Metrics populate as you progress
          through the build.
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

      <Card>
        <CardHeader>
          <CardTitle>Build Roadmap</CardTitle>
          <CardDescription>
            10-phase plan from skeleton to scientific RAG platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {roadmap.map((item) => (
            <div
              key={item.phase}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {item.phase}
                </span>
                <span className="text-sm font-medium">{item.title}</span>
              </div>
              {item.status === "done" ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Done
                </Badge>
              ) : item.status === "current" ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Current
                </Badge>
              ) : (
                <Badge variant="secondary">Planned</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
