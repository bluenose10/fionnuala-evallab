import { Langfuse } from "langfuse";

/**
 * EvalLab Langfuse client — Phase 9 observability integration point.
 *
 * Responsibilities:
 * 1. Parse and validate Langfuse credentials.
 * 2. Export a single `langfuse` client that is safe to import anywhere.
 * 3. Provide a no-op fallback when credentials are missing/placeholder so the
 *    app builds and runs locally without observability.
 * 4. Support both LANGFUSE_BASEURL (legacy name in this repo) and
 *    LANGFUSE_HOST (official SDK env var name).
 */

/**
 * Official Langfuse keys use the `pk-lf-*` / `sk-lf-*` prefixes, but we only
 * enforce structural sanity here so the client stays future-proof.
 */
function isValidLangfuseKey(key: string | undefined): key is string {
  if (typeof key !== "string") return false;
  const trimmed = key.trim();
  if (trimmed.length === 0) return false;

  const lower = trimmed.toLowerCase();
  const placeholderMarkers = [
    "your_",
    "placeholder",
    "dummy",
    "test",
    "xxx",
    "changeme",
    "none",
    "null",
    "undefined",
    "...",
  ];

  if (placeholderMarkers.some((marker) => lower.includes(marker))) {
    return false;
  }

  return true;
}

/**
 * Minimal no-op trace whose surface matches the Langfuse trace methods we use.
 * This lets API routes call `.span()`, `.score()`, and `.update()` without
 * branching on whether tracing is enabled.
 */
const createNoOpTrace = () => {
  const self = {
    id: undefined as string | undefined,
    span: () => self,
    score: () => self,
    update: () => self,
    end: () => self,
    event: () => self,
    generation: () => self,
  };
  return self;
};

const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
const secretKey = process.env.LANGFUSE_SECRET_KEY;
const baseUrl =
  process.env.LANGFUSE_HOST ||
  process.env.LANGFUSE_BASEURL ||
  "https://cloud.langfuse.com";

let langfuse: Langfuse;

if (!isValidLangfuseKey(publicKey) || !isValidLangfuseKey(secretKey)) {
  console.warn(
    "[Langfuse] Tracing is disabled. LANGFUSE_PUBLIC_KEY and/or LANGFUSE_SECRET_KEY are missing, empty, or appear to be placeholder values. Set valid credentials to enable observability.",
  );
  langfuse = {
    trace: () => createNoOpTrace(),
    flush: async () => undefined,
    shutdown: async () => undefined,
  } as unknown as Langfuse;
} else {
  langfuse = new Langfuse({
    publicKey,
    secretKey,
    baseUrl,
  });
}

/**
 * Helper: flush the Langfuse client, swallowing errors so telemetry failures
 * never break a user-facing response.
 */
export async function flushLangfuse(): Promise<void> {
  try {
    await langfuse.flush();
  } catch (flushErr) {
    console.error("[Langfuse] flush failed:", flushErr);
  }
}

export { langfuse };
