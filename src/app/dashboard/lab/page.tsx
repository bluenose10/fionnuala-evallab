"use client";

import { useState } from "react";
import { Search, Sparkles, FileSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function RetrievalLabPage() {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-8">
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
          <form
            className="flex gap-2"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="e.g. What is the refund policy for enterprise plans?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit" disabled>
              Ask
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Retrieval + generation go live in Phases 5–6.
          </p>
        </CardContent>
      </Card>

      {/* The core engineering distinction: the answer vs. its evidence */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>The AI Answer</CardTitle>
            </div>
            <CardDescription>
              Grounded, generated response from the RAG pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              Answers will appear here once retrieval is wired up.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              <CardTitle>Retrieved Chunks</CardTitle>
            </div>
            <CardDescription>
              The source evidence — with similarity scores — used to ground the
              answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-md border p-3 text-sm text-muted-foreground"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    Chunk #{i}
                  </span>
                  <Badge variant="outline">score —</Badge>
                </div>
                Retrieved context will be displayed here.
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
