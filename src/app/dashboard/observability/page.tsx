import {
  Activity,
  AlertCircle,
  CircleCheck,
  CircleDashed,
  ExternalLink,
  Workflow,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// This page reads server-only secrets and calls the Langfuse API, so it must
// run in the Node.js runtime and be rendered dynamically.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LangfuseStatus {
  status: "connected" | "disabled" | "error";
  host: string;
  projectName?: string;
  projectId?: string;
  traceCount?: number;
  error?: string;
}

async function getLangfuseStatus(): Promise<LangfuseStatus> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const host =
    process.env.LANGFUSE_HOST ||
    process.env.LANGFUSE_BASEURL ||
    "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    return { status: "disabled", host };
  }

  const baseUrl = host.replace(/\/+$/, "");
  const credentials = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");
  const authHeader = { Authorization: `Basic ${credentials}` };

  try {
    // 1. Verify connection and discover the first project.
    const projectsRes = await fetch(`${baseUrl}/api/public/projects`, {
      headers: authHeader,
      next: { revalidate: 60 },
    });

    if (!projectsRes.ok) {
      return {
        status: "error",
        host,
        error: `Langfuse API returned ${projectsRes.status}`,
      };
    }

    const projectsData = (await projectsRes.json()) as {
      data?: Array<{ id: string; name: string }>;
    };
    const project = projectsData.data?.[0];

    // 2. Get a rough trace count for the project.
    let traceCount: number | undefined;
    if (project?.id) {
      try {
        const tracesRes = await fetch(
          `${baseUrl}/api/public/traces?limit=1`,
          { headers: authHeader, next: { revalidate: 60 } },
        );
        if (tracesRes.ok) {
          const tracesData = (await tracesRes.json()) as {
            meta?: { totalItems?: number; totalCount?: number };
          };
          traceCount =
            tracesData.meta?.totalItems ?? tracesData.meta?.totalCount;
        }
      } catch {
        // Trace count is optional; do not fail the whole status check.
      }
    }

    return {
      status: "connected",
      host,
      projectName: project?.name,
      projectId: project?.id,
      traceCount,
    };
  } catch (err) {
    return {
      status: "error",
      host,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

async function getEvaluationCount(userId: string): Promise<number> {
  try {
    // Use the service client but filter explicitly by user_id so we never
    // expose another tenant's count. RLS on evaluation_logs is a second line
    // of defence; the .eq() here is the primary guard.
    const serviceClient = createServiceClient();
    const { count, error } = await serviceClient
      .from("evaluation_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (error) {
      console.error("[Observability] evaluation_logs count failed:", error);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.error("[Observability] evaluation_logs count failed:", err);
    return 0;
  }
}

function buildTracesUrl(host: string, projectId?: string): string {
  const baseUrl = host.replace(/\/+$/, "");
  if (projectId) {
    return `${baseUrl}/project/${projectId}/traces`;
  }
  return baseUrl;
}

export default async function ObservabilityPage() {
  // Resolve the authenticated user first so we can scope the evaluation count.
  const anonClient = createClient();
  const { data: { user } } = await anonClient.auth.getUser();

  const [status, evaluationCount] = await Promise.all([
    getLangfuseStatus(),
    user ? getEvaluationCount(user.id) : Promise.resolve(0),
  ]);

  const tracesUrl = buildTracesUrl(status.host, status.projectId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Observability</h1>
        <p className="text-muted-foreground">
          Every interaction is traced in Langfuse: one parent trace containing a
          Retrieval span (Supabase), a Generation span (OpenAI), and a
          Ragas-evaluation span.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Langfuse Connection
            </CardTitle>
            {status.status === "connected" ? (
              <CircleCheck className="h-4 w-4 text-emerald-600" />
            ) : status.status === "error" ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
            ) : (
              <CircleDashed className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {status.status === "connected" ? (
              <>
                <Badge variant="success">Connected</Badge>
                {status.projectName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Project: {" "}
                    <span className="font-medium text-foreground">
                      {status.projectName}
                    </span>
                  </p>
                )}
              </>
            ) : status.status === "error" ? (
              <>
                <Badge variant="destructive">Connection error</Badge>
                <p className="mt-2 text-xs text-destructive">
                  {status.error}
                </p>
              </>
            ) : (
              <>
                <Badge variant="secondary">Not configured</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  Add <code>LANGFUSE_PUBLIC_KEY</code> and{" "}
                  <code>LANGFUSE_SECRET_KEY</code> to <code>.env.local</code>.
                </p>
              </>
            )}
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
            <div className="text-2xl font-bold">
              {typeof status.traceCount === "number"
                ? status.traceCount.toLocaleString()
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              Traces visible in Langfuse.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
            <Workflow className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {evaluationCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ragas evaluations logged in Supabase.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trace Hierarchy</CardTitle>
          <CardDescription>
            The shape every RAG interaction records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div className="rounded-md border bg-muted/40 p-3">
              ▸ Parent Trace —{" "}
              <span className="text-muted-foreground">full interaction</span>
            </div>
            <div className="ml-6 rounded-md border bg-muted/40 p-3">
              ├─ Span: Retrieval{" "}
              <span className="text-muted-foreground">(Supabase / pgvector)</span>
            </div>
            <div className="ml-6 rounded-md border bg-muted/40 p-3">
              ├─ Span: Generation{" "}
              <span className="text-muted-foreground">(OpenAI GPT-4o)</span>
            </div>
            <div className="ml-6 rounded-md border bg-muted/40 p-3">
              └─ Span: ragas-evaluation{" "}
              <span className="text-muted-foreground">(LLM-as-a-Judge)</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-4"
            disabled={status.status !== "connected"}
            asChild
          >
            <a
              href={tracesUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in Langfuse
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
