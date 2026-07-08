"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Sparkles,
  FileSearch,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
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
import { createClient } from "@/lib/supabase/client";

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

function CollapsibleChunk({ chunk, index }: { chunk: SourceChunk; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-muted-foreground">
              Chunk {index + 1}
            </p>
            <p className="truncate text-xs font-mono text-muted-foreground">
              doc: {chunk.document_id}
            </p>
          </div>
          <Badge variant={chunk.similarity >= 0.8 ? "success" : "outline"}>
            sim: {chunk.similarity.toFixed(4)}
          </Badge>
        </div>

        <div
          className={
            expanded
              ? "text-sm leading-relaxed text-foreground whitespace-pre-wrap"
              : "text-sm leading-relaxed text-foreground whitespace-pre-wrap line-clamp-3"
          }
        >
          {chunk.content}
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          {expanded ? (
            <><ChevronUp className="h-3 w-3" /> Show less</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Show more</>
          )}
        </button>
      </CardContent>
    </Card>
  );
}

export function LabInterface({ userId }: LabInterfaceProps) {
  const [query, setQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
    async function fetchDocs() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("id, name")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      
      if (error) console.error("[Lab] Failed to fetch docs:", error);
      if (data) setDocuments(data);
    }
    fetchDocs();
  }, [userId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!query.trim()) return;

    setChatLoading(true);
    setEvalLoading(false);
    setError(null);
    setResponse(null);

    let chatData: ChatResponse;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          matchCount: 3,
          document_id: selectedDocumentId,
        }),
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

    const firstDocId = chatData.sources[0]?.document_id;

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
      .catch((err) => {
        console.error("[Lab] Background evaluation failed:", err);
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
          Ask a question and inspect the answer beside the exact
          chunks retrieved from your knowledge base.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1.5 block">
                Search within
              </label>
              <select
                value={selectedDocumentId || ""}
                onChange={(e) => setSelectedDocumentId(e.target.value || null)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Documents</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name}
                  </option>
                ))}
              </select>
            </div>
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
            <div className="flex items-center justify-end">
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

      <div className="rounded-lg border border-border/50 bg-muted/30 px-5 py-4">
        <p className="text-sm font-semibold text-foreground/80 mb-3">How this works:</p>
        <ul className="text-sm text-muted-foreground space-y-2 list-none pl-0">
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 flex-shrink-0"></span>
            <span>You ask a question.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 flex-shrink-0"></span>
            <span>The system finds the 3 most relevant paragraphs from your documents <span className="text-foreground/50">(shown below)</span>.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 flex-shrink-0"></span>
            <span>The AI writes an answer using <em>only</em> those paragraphs <span className="text-foreground/50">(shown below)</span>.</span>
          </li>
        </ul>
        <div className="mt-3 pt-3 border-t border-border/30">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground/80">Your job:</span> Check the 3 chunks below. If they&apos;re the right bits of your document, the system is working perfectly.
          </p>
        </div>
      </div>

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
            Searching documents...
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
            </CardContent>
          </Card>
        </div>
      )}

      {response && (
        <div className="flex flex-col gap-6 w-full">
          {/* Answer */}
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle>Answer</CardTitle>
              </div>
              <CardDescription>
                Generated from your documents with inline citations.
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

          {/* Retrieved Evidence */}
          <div className="flex flex-col gap-4 w-full">
            <div>
              <div className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold leading-none tracking-tight">
                  Retrieved Evidence
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
              <CollapsibleChunk key={chunk.id} chunk={chunk} index={index} />
            ))}

            {response.sources.length === 0 && (
              <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                No source chunks were retrieved.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}