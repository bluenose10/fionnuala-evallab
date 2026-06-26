"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Cpu, FileText, Loader2, Search, Trash2, UploadCloud, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatBytes } from "@/lib/utils";

type Document = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  status: "uploaded" | "processing" | "indexed" | "failed";
  chunk_count: number;
  created_at: string;
};

type UploadState = "idle" | "uploading" | "error";

type QueueItem = {
  file: File;
  status: "pending" | "uploading" | "processing" | "done" | "error";
  error?: string;
};

const STATUS_VARIANT: Record<
  Document["status"],
  "secondary" | "warning" | "success" | "destructive"
> = {
  uploaded:   "secondary",
  processing: "warning",
  indexed:    "success",
  failed:     "destructive",
};

export default function DocumentManagerPage() {
  const supabase = createClient();

  const [dragging, setDragging]         = useState(false);
  const [docs, setDocs]                 = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs]   = useState(true);
  const [uploadState, setUploadState]   = useState<UploadState>("idle");
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [queue, setQueue]               = useState<QueueItem[]>([]);
  const [queueActive, setQueueActive]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = docs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

  const queueDone  = queue.filter((q) => q.status === "done").length;
  const queueTotal = queue.length;
  const queueHasErrors = queue.some((q) => q.status === "error");

  async function fetchDocs() {
    setLoadingDocs(true);
    const { data } = await supabase
      .from("documents")
      .select(
        "id, name, storage_path, size_bytes, mime_type, status, chunk_count, created_at",
      )
      .order("created_at", { ascending: false });
    if (data) setDocs(data as Document[]);
    setLoadingDocs(false);
  }

  useEffect(() => {
    fetchDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateQueueItem(index: number, patch: Partial<QueueItem>) {
    setQueue((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  async function processQueue(files: File[]) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploadError("You must be signed in to upload.");
      setUploadState("error");
      return;
    }

    const initialQueue: QueueItem[] = files.map((file) => ({
      file,
      status: "pending",
    }));
    setQueue(initialQueue);
    setQueueActive(true);
    setUploadState("uploading");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Step 1: Upload to storage
      updateQueueItem(i, { status: "uploading" });
      const storagePath = `${user.id}/${Date.now()}_${file.name}`;

      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { contentType: file.type });

      if (storageError) {
        updateQueueItem(i, { status: "error", error: storageError.message });
        continue;
      }

      // Step 2: Insert DB record
      const { data: inserted, error: dbError } = await supabase
        .from("documents")
        .insert({
          user_id:      user.id,
          name:         file.name,
          storage_path: storagePath,
          size_bytes:   file.size,
          mime_type:    file.type,
          status:       "uploaded",
        })
        .select("id")
        .single();

      if (dbError || !inserted) {
        await supabase.storage.from("documents").remove([storagePath]);
        updateQueueItem(i, { status: "error", error: dbError?.message ?? "DB insert failed" });
        continue;
      }

      // Step 3: Auto-process (chunk + vectorise)
      updateQueueItem(i, { status: "processing" });

      try {
        const res = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: inserted.id }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          updateQueueItem(i, { status: "error", error: body.error ?? "Processing failed" });
        } else {
          updateQueueItem(i, { status: "done" });
        }
      } catch {
        updateQueueItem(i, { status: "error", error: "Network error during processing" });
      }
    }

    setUploadState("idle");
    setQueueActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await fetchDocs();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploadError(null);
    const validFiles: File[] = [];

    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        setUploadError("Only PDF files are accepted.");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setUploadError(`"${file.name}" exceeds the 50 MB limit.`);
        return;
      }
      validFiles.push(file);
    }

    await processQueue(validFiles);
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;

    setDeletingId(doc.id);

    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([doc.storage_path]);

    if (storageError) {
      console.warn("Storage removal warning (continuing):", storageError.message);
    }

    const { error: dbError } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (dbError) {
      alert(`Failed to delete: ${dbError.message}`);
    } else {
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    }

    setDeletingId(null);
  }

  async function handleProcess(doc: Document) {
    setProcessingId(doc.id);
    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = body.error ?? "Processing failed";
        console.error("[handleProcess] error:", msg);
        alert(`Processing failed: ${msg}`);
      }
      await fetchDocs();
    } catch (e) {
      console.error("[handleProcess] network error:", e);
      alert("Network error — could not reach the processing endpoint.");
    } finally {
      setProcessingId(null);
    }
  }

  function getQueueIcon(status: QueueItem["status"]) {
    if (status === "done")       return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    if (status === "error")      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    if (status === "uploading" || status === "processing")
                                 return <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />;
    return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
  }

  function getQueueLabel(item: QueueItem) {
    if (item.status === "uploading")  return "Uploading…";
    if (item.status === "processing") return "Chunking & vectorising…";
    if (item.status === "done")       return "Ready";
    if (item.status === "error")      return item.error ?? "Failed";
    return "Pending";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Document Manager</h1>
        <p className="text-muted-foreground">
          Upload source PDFs. Files are stored securely in Supabase Storage
          with metadata tracked under Row Level Security.
        </p>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload documents</CardTitle>
          <CardDescription>
            Select up to 15 PDFs at once (max 50 MB each). Files are uploaded and chunked automatically one by one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            className={cn(
              "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="rounded-full bg-muted p-3">
              {uploadState === "uploading" ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            <div>
              <p className="font-medium">Drag &amp; drop your PDFs here</p>
              <p className="text-sm text-muted-foreground">or click to browse — multiple files supported</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={queueActive}
              onClick={() => fileInputRef.current?.click()}
            >
              {queueActive ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                "Select files"
              )}
            </Button>

            {uploadError ? (
              <p className="text-xs text-destructive">{uploadError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">PDF · up to 50 MB · max 15 files per batch</p>
            )}
          </div>

          {/* Queue progress */}
          {queue.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {queueActive
                    ? `Processing ${queueDone + 1} of ${queueTotal}…`
                    : queueHasErrors
                    ? `Completed with errors — ${queueDone} of ${queueTotal} succeeded`
                    : `All ${queueTotal} file${queueTotal > 1 ? "s" : ""} processed`}
                </p>
                {!queueActive && (
                  <Button variant="ghost" size="sm" onClick={() => setQueue([])}>
                    Clear
                  </Button>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${queueTotal > 0 ? (queueDone / queueTotal) * 100 : 0}%` }}
                />
              </div>

              {/* Per-file list */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {queue.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {getQueueIcon(item.status)}
                    <span className="truncate flex-1 text-muted-foreground">{item.file.name}</span>
                    <span className={cn(
                      "text-xs shrink-0",
                      item.status === "done"  ? "text-green-500" :
                      item.status === "error" ? "text-destructive" :
                      "text-muted-foreground"
                    )}>
                      {getQueueLabel(item)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Indexed documents</CardTitle>
              <CardDescription>Metadata for every uploaded source file.</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Chunks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDocs ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    {search ? `No documents matching "${search}".` : "No documents uploaded yet."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="flex items-center gap-2 font-medium">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate max-w-[240px]">{doc.name}</span>
                    </TableCell>
                    <TableCell>{formatBytes(doc.size_bytes)}</TableCell>
                    <TableCell>{doc.chunk_count > 0 ? doc.chunk_count : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[doc.status]}>
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {doc.status === "uploaded" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={processingId === doc.id}
                          onClick={() => handleProcess(doc)}
                          aria-label="Process document"
                        >
                          {processingId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Cpu className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === doc.id}
                        onClick={() => handleDelete(doc)}
                        aria-label="Delete document"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
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
