// src/app/dashboard/audit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck, Trash2, Download } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

type LogEntry = {
  id: string;
  question: string;
  answer: string;
  cached: boolean;
  created_at: string;
};

export default function AuditTrailPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  async function fetchLogs() {
    setLoading(true);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, count } = await supabase
      .from("public_interaction_logs")
      .select("id, question, answer, cached, created_at", { count: "exact" })
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    if (data) setLogs(data as LogEntry[]);
    if (count !== null) setTotalCount(count);
    setLoading(false);
  }

  async function purgeOldLogs() {
    if (!confirm("Permanently delete all interaction logs older than 90 days? This cannot be undone.")) return;
    setPurging(true);

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { error } = await supabase
      .from("public_interaction_logs")
      .delete()
      .lt("created_at", ninetyDaysAgo.toISOString());

    if (error) {
      alert("Purge failed: " + error.message);
    } else {
      await fetchLogs();
    }
    setPurging(false);
  }

  function exportCSV() {
    if (logs.length === 0) return;
    const headers = ["Date", "Question", "Answer", "Cached"];
    const rows = logs.map((l) => [
      new Date(l.created_at).toLocaleString(),
      `"${l.question.replace(/"/g, '""')}"`,
      `"${l.answer.replace(/"/g, '""')}"`,
      l.cached ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Audit Trail
        </h1>
        <p className="text-muted-foreground">
          Permanent log of every public chatbot interaction. Last 30 days shown.
          All interactions are stored in your private database.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-primary">{totalCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Total interactions (last 30 days)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{logs.filter((l) => l.cached).length}</p>
            <p className="text-sm text-muted-foreground mt-1">Served from cache (zero AI cost)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{logs.filter((l) => !l.cached).length}</p>
            <p className="text-sm text-muted-foreground mt-1">Fresh RAG pipeline answers</p>
          </CardContent>
        </Card>
      </div>

      {/* Log table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Interaction Log</CardTitle>
              <CardDescription>
                Every question asked to your public chatbot, with the exact answer delivered.
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={purgeOldLogs}
                disabled={purging}
              >
                {purging ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Purge logs older than 90 days
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Question</TableHead>
                <TableHead>Answer</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    No interactions logged yet. Questions asked via the public chatbot will appear here.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <p className="text-sm truncate" title={log.question}>{log.question}</p>
                    </TableCell>
                    <TableCell className="max-w-[320px]">
                      <p className="text-sm text-muted-foreground truncate" title={log.answer}>{log.answer}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.cached ? "secondary" : "success"}>
                        {log.cached ? "Cached" : "Fresh"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
