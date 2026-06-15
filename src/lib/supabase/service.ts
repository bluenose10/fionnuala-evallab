import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side operations that must
 * bypass Row Level Security (e.g., writing document_chunks in a Route Handler).
 *
 * NEVER import this in Client Components or expose it to the browser.
 * SUPABASE_SERVICE_ROLE_KEY must only exist in server-side env vars.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}
