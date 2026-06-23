// src/app/api/process/route.ts

export const runtime = "nodejs";

if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { Document, SentenceSplitter } from "llamaindex";
import pdfParse from "pdf-parse";
import OpenAI from "openai";

const EMBEDDING_BATCH_SIZE = 100;

export async function POST(request: NextRequest) {
  // 1. Auth
  const anonClient = createClient();
  const { data: { user }, error: authError } = await anonClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse Body
  let body;
  try {
    body = await request.json();
    if (!body.documentId || typeof body.documentId !== "string") {
      throw new Error("documentId is required");
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid request body" },
      { status: 400 }
    );
  }

  const { documentId } = body;
  const userId = user.id;
  const serviceClient = createServiceClient();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // 3. Fetch document metadata and verify ownership
    const { data: doc, error: docError } = await serviceClient
      .from("documents")
      .select("storage_path")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found or access denied" }, { status: 404 });
    }

    // 4. Download PDF from Storage
    const { data: fileData, error: dlErr } = await serviceClient.storage
      .from("documents")
      .download(doc.storage_path);

    if (dlErr || !fileData) {
      return NextResponse.json({ error: "Storage download failed" }, { status: 500 });
    }

    // 5. Extract Text
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const pdfData = await pdfParse(buffer);
    const rawText = pdfData.text?.trim();

    if (!rawText) {
      return NextResponse.json({ error: "PDF produced no extractable text" }, { status: 400 });
    }

    // 6. Chunk Text (Using standard 512/50 for production ingestion)
    const llamaDoc = new Document({ text: rawText });
    const splitter = new SentenceSplitter({ chunkSize: 512, chunkOverlap: 50 });
    const nodes = splitter.getNodesFromDocuments([llamaDoc]);

    if (nodes.length === 0) {
      return NextResponse.json({ error: "PDF produced zero chunks" }, { status: 400 });
    }

    const chunkTexts = nodes.map((n) => n.getText());

    // 7. Embed chunks in batches of 100
    const embeddings: number[][] = [];
    for (let i = 0; i < chunkTexts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunkTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
      const { data: embedData } = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: batch,
      });
      embeddings.push(...embedData.map((e) => e.embedding));
    }

    // 8. Prepare DB Records
    const recordsToInsert = chunkTexts.map((content, index) => ({
      document_id: documentId,
      user_id: userId,
      content: content,
      embedding: embeddings[index],
      chunk_index: index,
    }));

    // 9. Atomic DB Insert
    const { error: insertError } = await serviceClient
      .from("document_chunks")
      .insert(recordsToInsert);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // 10. Update Document Status
    await serviceClient
      .from("documents")
      .update({ status: "indexed", chunk_count: recordsToInsert.length })
      .eq("id", documentId);

    return NextResponse.json({
      success: true,
      message: `Successfully processed document and inserted ${recordsToInsert.length} chunks.`,
    });

  } catch (error: any) {
    console.error("[/api/process] Ingestion failed:", error);
    return NextResponse.json(
      { error: error.message || "Ingestion failed" },
      { status: 500 }
    );
  }
}