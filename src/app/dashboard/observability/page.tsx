import { Activity, CircleDashed, ExternalLink, Workflow } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function ObservabilityPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Observability</h1>
        <p className="text-muted-foreground">
          Every interaction is traced in Langfuse: one parent trace containing
          a Retrieval span (Supabase) and a Generation span (OpenAI).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Langfuse Connection
            </CardTitle>
            <CircleDashed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge variant="warning">Not configured</Badge>
            <p className="mt-2 text-xs text-muted-foreground">
              Add keys in <code>.env.local</code> — wired in Phase 9.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Traces Captured
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Parent traces logged.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spans</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">
              Retrieval + Generation spans.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trace Hierarchy</CardTitle>
          <CardDescription>
            The shape every interaction will record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div className="rounded-md border bg-muted/40 p-3">
              ▸ Parent Trace — <span className="text-muted-foreground">full interaction</span>
            </div>
            <div className="ml-6 rounded-md border bg-muted/40 p-3">
              ├─ Span: Retrieval{" "}
              <span className="text-muted-foreground">(Supabase / pgvector)</span>
            </div>
            <div className="ml-6 rounded-md border bg-muted/40 p-3">
              └─ Span: Generation{" "}
              <span className="text-muted-foreground">(OpenAI GPT-4o)</span>
            </div>
          </div>
          <Button variant="outline" className="mt-4" disabled>
            <ExternalLink className="h-4 w-4" />
            Open in Langfuse
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
