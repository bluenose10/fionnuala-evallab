// src/app/dashboard/audit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ShieldCheck, Trash2, Download, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const DATE_RANGES = [
  { label: "Today",        days: 1  },
  { label: "Last 7 days",  days: 7  },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const PAGE_SIZE = 50;

export default function AuditTrailPage() {
  const supabase = createClient();

  const [logs, setLogs]               = useState<LogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [purging, setPurging]         = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [totalCount, setTotalCount]   = useState(0);
  const [cachedCount, setCachedCount] = useState(0);
  const [freshCount, setFreshCount]   = useState(0);
  const [search, setSearch]           = useState("");
  const [rangeDays, setRangeDays]     = useState(30);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [cacheExpiredCount, setCacheExpiredCount] = useState<number | null>(null);

  async function fetchLogs(currentPage = 1, days = rangeDays, keyword = search) {
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - days);

    let query = supabase
      .from("public_interaction_logs")
      .select("id, question, answer, cached, created_at", { count: "exact" })
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false });

    if (keyword.trim()) {
      query = query.ilike("question", `%${keyword.trim()}%`);
    }

    const from = (currentPage - 1) * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;
    query = query.range(from, to);

    const { data, count } = await query;

    if (data) setLogs(data as LogEntry[]);
    if (count !== null) {
      setTotalCount(count);
      setTotalPages(Math.max(1, Math.ceil(count / PAGE_SIZE)));
    }

    // Fetch summary counts (unfiltered by keyword, just date range)
    const { data: summary } = await supabase
      .from("public_interaction_logs")
      .select("cached")
      .gte("created_at", since.toISOString());

    if (summary) {
      setCachedCount(summary.filter((r) => r.cached).length);
      setFreshCount(summary.filter((r) => !r.cached).length);
    }

    setLoading(false);
  }

  async function fetchExpiredCacheCount() {
    const { count } = await supabase
      .from("semantic_cache")
      .select("id", { count: "exact", head: true })
      .lt("expires_at", new Date().toISOString());
    setCacheExpiredCount(count ?? 0);
  }

  async function purgeOldLogs() {
    if (!confirm(`Permanently delete all interaction logs older than 90 days? This cannot be undone.`)) return;
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
      setPage(1);
      await fetchLogs(1, rangeDays, search);
    }
    setPurging(false);
  }

  async function clearExpiredCache() {
    if (!confirm(`Delete all expired semantic cache entries? This frees up storage — the cache will rebuild naturally from new queries.`)) return;
    setClearingCache(true);

    const { error } = await supabase
      .from("semantic_cache")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (error) {
      alert("Cache clear failed: " + error.message);
    } else {
      setCacheExpiredCount(0);
      alert("Expired cache entries cleared successfully.");
    }
    setClearingCache(false);
  }

  function exportCSV() {
    if (logs.length === 0) return;
    const headers = ["Date", "Question", "Answer", "Type"];
    const rows = logs.map((l) => [
      new Date(l.created_at).toLocaleString(),
      `"${l.question.replace(/"/g, '""')}"`,
      `"${l.answer.replace(/"/g, '""')}"`,
      l.cached ? "Cached" : "Fresh",
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

  function handleRangeChange(days: number) {
    setRangeDays(days);
    setPage(1);
    fetchLogs(1, days, search);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
    fetchLogs(1, rangeDays, value);
  }

  function handlePage(next: number) {
    setPage(next);
    fetchLogs(next, rangeDays, search);
  }

  useEffect(() => {
    fetchLogs(1, 30, "");
    fetchExpiredCacheCount();
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
          Permanent log of every public chatbot interaction. All interactions stored in your private database.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold text-primary">{totalCount}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Total interactions ({DATE_RANGES.find((r) => r.days === rangeDays)?.label.toLowerCase()})
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{cachedCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Served from cache (zero AI cost)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-3xl font-bold">{freshCount}</p>
            <p className="text-sm text-muted-foreground mt-1">Fresh RAG pipeline answers</p>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance card */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>
            Keep your database clean and GDPR-compliant.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
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
            Purge interaction logs older than 90 days
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={clearExpiredCache}
            disabled={clearingCache}
          >
            {clearingCache ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Clear expired cache
            {cacheExpiredCount !== null && cacheExpiredCount > 0 && (
              <span className="ml-2 bg-primary/15 text-primary text-xs px-1.5 py-0.5 rounded">
                {cacheExpiredCount} expired
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Log table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Interaction Log</CardTitle>
              <CardDescription>
                Every question asked to your public chatbot, with the exact answer delivered.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 pt-2">
            {/* Date range */}
            <div className="flex gap-1">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => handleRangeChange(r.days)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    rangeDays === r.days
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
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
                    {search
                      ? `No interactions matching "${search}" in this date range.`
                      : "No interactions logged yet."}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} &nbsp;·&nbsp; {totalCount} total interactions
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePage(page - 1)}
                  disabled={page === 1 || loading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePage(page + 1)}
                  disabled={page === totalPages || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
