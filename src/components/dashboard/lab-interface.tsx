"use client";

import { useState } from "react";
import {
  Search,
  Sparkles,
  FileSearch,
  AlertCircle,
  Loader2,
  Scale,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SourceChunk {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
}

interface ChatResponse {
  answer: string;
  sources: SourceChunk[];
  meta: {
    model: string;
    chunksRetrieved: number;
    query: string;
  };
  traceId: string;
}

interface LabInterfaceProps {
  userId: string;
}

/**
 * Highlight inline bracketed citations such as [1], [2], [3] in the grounded
 * synthesis so they stand out visually.
 */
function renderCitedAnswer(text: string) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, index) => {
    if (/^\[\d+\]$/.test(part)) {
      return (
        <span
          key={index}
          className="mx-0.5 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary"
        >
          {part}
        </span>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

export function LabInterface({ userId }: LabInterfaceProps) {
  const [query, setQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatResponse | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;

    setChatLoading(true);
    setEvalLoading(false);
    setError(null);
    setResponse(null);

    let chatData: ChatResponse;

    // ── 1. Execute grounded synthesis ────────────────────────────────────────
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), matchCount: 5 }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || `Chat request failed (${res.status})`);
      }

      chatData = await res.json();
      setResponse(chatData);
    } catch (err) {
      console.error("[Lab] Chat request failed:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setChatLoading(false);
      return;
    }

      // ── 2. Queue LLM-as-a-Judge evaluation asynchronously ────────────────────
    //    The evaluation must not block the chat response. We send the full
    //    evaluation payload (query/answer/chunks/userId/documentId) that we
    //    already have in hand from /api/chat, plus the traceId for Langfuse
    //    score attachment. This avoids a round-trip to Langfuse to re-fetch
    //    values we just produced — which previously raced ahead of Langfuse
    //    Cloud's async ingest and returned a 404 (causing the 500 here).
    const firstDocId = chatData.sources[0]?.document_id;

    // If no chunks were retrieved, there is nothing meaningful to evaluate —
    // skip the judge call rather than surface a confusing 400 to the user.
    if (chatData.sources.length === 0) {
      setChatLoading(false);
      return;
    }

    setEvalLoading(true);

    fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        traceId: chatData.traceId,
        async: true,
        queryText: chatData.meta.query,
        generatedAnswer: chatData.answer,
        retrievedChunks: chatData.sources,
        userId,
        documentId: firstDocId,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || `Evaluation request failed (${res.status})`);
        }
        return res.json();
      })
      .then(() => {
        // Scores are persisted in the background. The Evaluation Hub will
        // display them by reading evaluation_logs.
      })
      .catch((err) => {
        console.error("[Lab] Background evaluation failed:", err);
        setError(
          `Answer generated, but background evaluation failed: ${
            err instanceof Error ? err.message : "Unknown error"
          }`,
        );
      })
      .finally(() => {
        setEvalLoading(false);
      });

    setChatLoading(false);
  }

  const isLoading = chatLoading || evalLoading;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          QA &amp; Retrieval Lab
        </h1>
        <p className="text-muted-foreground">
          Ask a question and inspect the grounded answer beside the exact
          chunks retrieved from your knowledge base.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Textarea
                className="min-h-[96px] resize-y pl-9 pt-2"
                placeholder="e.g. What is the refund policy for enterprise plans?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                The backend embeds your query, runs cosine similarity search,
                synthesizes a grounded answer, and then scores it with an
                LLM-as-a-Judge evaluator.
              </p>
              <Button type="submit" disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {evalLoading ? "Evaluating..." : "Executing Synthesis"}
                  </>
                ) : (
                  "Execute Synthesis"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Request failed</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {chatLoading && !response && (
        <div className="flex flex-col gap-6 w-full">
          <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vectorizing Query &amp; Executing DB Cosine Distance Match...
          </p>
          <Card className="w-full">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </CardContent>
          </Card>
          <Card className="w-full">
            <CardHeader>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      )}

      {response && (
        <div className="flex flex-col gap-6 w-full">
          {/* Grounded Synthesis */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Grounded Synthesis</CardTitle>
              </div>
              <CardDescription>
                AI-generated answer with inline citations to retrieved evidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {response.answer ? (
                <div className="prose prose-sm max-w-none leading-relaxed text-foreground">
                  {renderCitedAnswer(response.answer)}
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No answer was returned.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence Evaluation Space */}
          <div className="flex flex-col gap-6 w-full">
            <div>
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  Evidence Evaluation Space
                </h2>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {response.meta.chunksRetrieved} chunk
                {response.meta.chunksRetrieved === 1 ? "" : "s"} retrieved for{" "}
                <span className="font-medium text-foreground">
                  {response.meta.query}
                </span>
              </p>
            </div>

            {response.sources.map((chunk, index) => (
              <Card key={chunk.id} className="w-full">
                <CardContent className="pt-6">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-muted-foreground">
                        Chunk {index + 1}
                      </p>
                      <p className="truncate text-xs font-mono text-muted-foreground">
                        doc: {chunk.document_id}
                      </p>
                    </div>
                    <Badge
                      variant={
                        chunk.similarity >= 0.8 ? "success" : "outline"
                      }
                    >
                      sim: {chunk.similarity.toFixed(4)}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {chunk.content}
                  </p>
                </CardContent>
              </Card>
            ))}

            {response.sources.length === 0 && (
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                No source chunks were retrieved.
              </div>
            )}
          </div>

          {/* Evaluation results panel */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <CardTitle>Automated Evaluation (Ragas)</CardTitle>
              </div>
              <CardDescription>
                LLM-as-a-Judge scores computed against the retrieved evidence.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {evalLoading ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Queuing LLM-as-a-Judge evaluation...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scores are computed in the background and written to the
                    Evaluation Hub.
                  </p>
                </div>
              ) : (
                <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed text-sm text-muted-foreground">
                  <p>Evaluation queued for background processing.</p>
                  <p className="text-xs">
                    Results will appear in the Evaluation Hub once the judge
                    completes.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
