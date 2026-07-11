/**
 * fionnuala — Phase 9 OpenTelemetry instrumentation hook.
 *
 * Next.js calls `register()` once when the server starts. We set up the
 * OpenTelemetry NodeSDK here and route spans to Langfuse via the
 * LangfuseSpanProcessor. This keeps all observability wiring out of the
 * business logic in /api/* routes.
 *
 * Design constraints honored:
 * - Guarded to run only in the Node.js runtime (matches `runtime = "nodejs"`).
 * - Silently disables itself when Langfuse credentials are missing/placeholder.
 * - Loads heavy OTel packages dynamically so they are not bundled where
 *   instrumentation is not needed.
 * - Does not wrap or alter the atomic ingestion / retrieval flows.
 */

export async function register() {
  // Only instrument the long-running Node.js execution layer. Edge runtime
  // is intentionally skipped because all intensive routes declare
  // `export const runtime = "nodejs"`.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    console.log(
      "[instrumentation] Skipping OpenTelemetry registration in non-Node.js runtime.",
    );
    return;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const baseUrl =
    process.env.LANGFUSE_HOST ||
    process.env.LANGFUSE_BASE_URL ||
    process.env.LANGFUSE_BASEURL ||
    "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    console.warn(
      "[instrumentation] LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY missing; OpenTelemetry tracing disabled.",
    );
    return;
  }

  // Dynamic imports keep the startup footprint small and avoid loading OTel
  // dependencies in runtimes where they are not used.
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
  } = await import("@opentelemetry/semantic-conventions");
  const { OpenAIInstrumentation } = await import(
    "@arizeai/openinference-instrumentation-openai"
  );

  const langfuseSpanProcessor = new LangfuseSpanProcessor({
    publicKey,
    secretKey,
    baseUrl,
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "fionnuala-rag",
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "0.1.0",
    }),
    spanProcessors: [langfuseSpanProcessor],
    instrumentations: [new OpenAIInstrumentation()],
  });

  sdk.start();

  console.log(
    "[instrumentation] Langfuse OpenTelemetry SDK started for Node.js runtime.",
  );
}
