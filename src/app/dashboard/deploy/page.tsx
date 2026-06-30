// src/app/dashboard/deploy/page.tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, KeyRound, Copy, Check } from "lucide-react";

export default function DeployPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchKey() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("client_api_keys")
        .select("api_key")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setApiKey(data.api_key);
      setLoading(false);
    }
    fetchKey();
  }, [supabase]);

  const generateKey = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newKey = `eval_live_${crypto.randomUUID()}`;

    await supabase.from("client_api_keys").delete().eq("user_id", user.id);

    const { data } = await supabase
      .from("client_api_keys")
      .insert({ user_id: user.id, api_key: newKey, name: "Production Website" })
      .select()
      .single();

    if (data) setApiKey(data.api_key);
    setLoading(false);
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-app.com";

  const snippet = `<!-- AI Knowledge Base Widget -->
<script>
  window.EvalLabConfig = {
    apiKey: "${apiKey || "YOUR_API_KEY"}",
    apiEndpoint: "${origin}/api/public/chat"
  };
</script>
<script src="${origin}/embed.js" async defer></script>`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deploy to Production</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Generate your API key and embed the Truth Engine into your website.
        </p>
      </div>

      {/* API Key Generation Card */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Production API Key
        </h2>

        {apiKey ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-lg p-3">
              <code className="text-sm text-foreground font-mono flex-1 truncate">{apiKey}</code>
              <button
                onClick={copyToClipboard}
                className="p-2 hover:bg-secondary rounded-md transition-colors"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            <button
              onClick={generateKey}
              className="text-sm text-destructive hover:underline"
            >
              Regenerate Key (Invalidates current key)
            </button>
          </div>
        ) : (
          <button
            onClick={generateKey}
            className="bg-primary text-primary-foreground font-bold py-2.5 px-6 rounded-lg shadow-[0_0_20px_-5px_rgba(59,227,138,0.5)] hover:bg-primary/90 transition-all"
          >
            Generate API Key
          </button>
        )}
      </div>

      {/* Embed Code Card */}
      {apiKey && (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Embed Code</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Paste this snippet into the <code>&lt;head&gt;</code> of your website to activate the AI assistant.
          </p>
          <pre className="bg-zinc-950 border border-border rounded-lg p-4 overflow-x-auto text-xs text-zinc-300 font-mono">
            <code>{snippet}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
