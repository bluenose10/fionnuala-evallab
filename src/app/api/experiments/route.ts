import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Auth — verify session via cookie-scoped anon client.
  const anonClient = createClient();
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const serviceClient = createServiceClient();
    const { data: runs, error } = await serviceClient
      .from("experiment_runs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, runs: runs ?? [] });
  } catch (error: any) {
    console.error("[/api/experiments] Fetch failure:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch experiments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // Auth — verify session via cookie-scoped anon client.
  const anonClient = createClient();
  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      document_id,
      configuration_name,
      chunk_size,
      chunk_overlap,
      prompt_template,
      model_name,
      avg_faithfulness,
      avg_answer_relevance,
      avg_context_precision,
      total_queries_tested,
      metadata,
    } = body;

    // Fail-fast structural validation
    if (!document_id || !configuration_name || !chunk_size) {
      return NextResponse.json(
        { success: false, error: "Missing required configuration parameters" },
        { status: 400 },
      );
    }

    const serviceClient = createServiceClient();
    const { data, error } = await serviceClient
      .from("experiment_runs")
      .insert({
        user_id: user.id,
        document_id,
        configuration_name,
        chunk_size: Number(chunk_size),
        chunk_overlap: Number(chunk_overlap ?? 0),
        prompt_template: prompt_template ?? "default-rag-answer",
        model_name: model_name || "gpt-4o",
        avg_faithfulness: Number(avg_faithfulness ?? 0),
        avg_answer_relevance: Number(avg_answer_relevance ?? 0),
        avg_context_precision: Number(avg_context_precision ?? 0),
        total_queries_tested: Number(total_queries_tested ?? 1),
        metadata: metadata ?? {},
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("[/api/experiments] Insertion failure:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log experiment run" },
      { status: 500 },
    );
  }
}
