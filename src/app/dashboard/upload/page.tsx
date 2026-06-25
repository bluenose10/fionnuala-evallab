"use client";

import { useEffect, useRef, useState } from "react";
import { Cpu, FileText, Loader2, Search, Trash2, UploadCloud } from "lucide-react";

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

const STATUS_VARIANT: Record
  Document["status"],
  "secondary" | "warning" | "success" | "destructive"
> = {

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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = docs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()),
  );

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

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0];

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File exceeds the 50 MB limit.");
      return;
    }

    setUploadState("uploading");
    setUploadError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setUploadError("You must be signed in to upload.");
      setUploadState("error");
      return;
    }

    const storagePath = `${user.id}/${Date.now()}_${file.name}`;

    const { error: storageError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file, { contentType: file.type });

    if (storageError) {
      setUploadError(storageError.message);
      setUploadState("error");
      return;
    }

    const { error: dbError } = await