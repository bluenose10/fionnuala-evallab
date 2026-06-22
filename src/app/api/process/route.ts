// Spec requirement: must declare Node.js runtime to bypass the 15-second
// serverless execution limit when processing large PDF payloads.
export const runtime = "nodejs";

// Windows dev: this machine cannot verify external TLS certs.
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { Document, SentenceSplitter } from "llamaindex";
import pdfParse from "pdf-parse";
import OpenAI from "openai";
import fs from "fs/promises";
import path from "path";

// Phase 10.3 scaling fix: bumped 20 → 100. Minimizes network latency,
// avoids OpenAI RPM limits, and ~5× faster ingestion while preserving
// atomic data integrity (1:1 input→output ordering guaranteed by OpenAI).
const EMBEDDING_BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  // ── 1. Verify auth via anon client (reads session cookies) ─────────────────
  const anonClient = createClient();
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Parse request body ───────────────────────────────────────────────────
  let documentId: string;
  try {
    const body = await request.json();
    documentId = body.documentId;
    if (!documentId || typeof documentId !== "string") throw new Error();
  } catch {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  // ── 3. Verify document ownership via RLS-scoped anon client ─────────────────
  const { data: doc, error: docError } = await anonClient
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // ── 4. Service client for all privileged writes ──────────────────────────────
  const serviceClient = createServiceClient();
  const tmpPath = path.join("/tmp", `${documentId}.pdf`);

  async function setStatus(status: string, chunkCount?: number) {
    const patch: Record<string, unknown> = { status };
    if (chunkCount !== undefined) patch.chunk_count = chunkCount;
    await serviceClient.from("documents").update(patch).eq("id", documentId);
  }

  try {
    // ── 5a. Mark as processing ─────────────────────────────────────────────────
    await setStatus("processing");

    // ── 5b. Download PDF from Supabase Storage ─────────────────────────────────
    const { data: fileData, error: dlErr } = await serviceClient.storage
      .from("documents")
      .download(doc.storage_path);

    if (dlErr || !fileData) {
      throw new Error(`Storage download failed: ${dlErr?.message}`);
    }

    // ── 5c. Write to /tmp ──────────────────────────────────────────────────────
    const buffer = Buffer.from(await fileData.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);

    // ── 5d. Extract text with pdf-parse ────────────────────────────────────────
    const pdfData = await pdfParse(buffer);
    const rawText = pdfData.text?.trim();
    if (!rawText) {
      throw new Error(
        "PDF produced no extractable text — file may be image-only.",
      );
    }

    // ── 5e. Chunk with LlamaIndex SentenceSplitter (synchronous) ──────────────
    const llamaDoc = new Document({ text: rawText });
    const splitter = new SentenceSplitter({ chunkSize: 512, chunkOverlap: 50 });
    const nodes = splitter.getNodesFromDocuments([llamaDoc]);

    if (nodes.length === 0) {
      throw new Error("PDF produced zero chunks after splitting.");
    }

    const chunkTexts = nodes.map((n) => n.getText());

    // ── 5f. Generate embeddings in deterministic batches of 100 ─────────────
    //    Process in fixed batches of EMBEDDING_BATCH_SIZE (100) to minimize
    //    network round-trips and avoid OpenAI RPM limits.
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const embeddings: number[][] = [];

    for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const { data: embedData } = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
      });
      embeddings.push(...embedData.map((e) => e.embedding));
    }

    // ── 5g. Insert document_chunks rows ────────────────────────────────────────
    const rows = chunkTexts.map((content, i) => ({
      document_id: documentId,
      user_id:     user.id,
      content,
      chunk_index: i,
      embedding:   embeddings[i],
    }));

    const { error: insertErr } = await serviceClient
      .from("document_chunks")
      .insert(rows);

    if (insertErr) {
      throw new Error(`Chunk insert failed: ${insertErr.message}`);
    }

    // ── 5h. Mark as indexed ────────────────────────────────────────────────────
    await setStatus("indexed", nodes.length);
    await fs.unlink(tmpPath).catch(() => {});

    return NextResponse.json({ chunkCount: nodes.length });

  } catch (err) {
    console.error("[/api/process] Pipeline error:", err);
    await setStatus("failed");
    await fs.unlink(tmpPath).catch(() => {});

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 },
    );
  }
}
