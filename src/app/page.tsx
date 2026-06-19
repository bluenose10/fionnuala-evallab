import Link from "next/link";
import {
  Activity,
  BarChart3,
  FlaskConical,
  Layers,
  ShieldCheck,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Target,
    title: "Scientific RAG",
    description:
      "Move from subjective “vibe checks” to objective data. Every answer is grounded in your documents and scored against the source.",
  },
  {
    icon: FlaskConical,
    title: "Evaluation Engine",
    description:
      "Ragas computes Faithfulness, Answer Relevance & Context Precision — turning quality into measurable metrics.",
  },
  {
    icon: Layers,
    title: "Experimentation",
    description:
      "A/B test chunk sizes, Simple vs. Chain-of-Thought prompts, and Vector vs. Hybrid retrieval on a live leaderboard.",
  },
  {
    icon: Activity,
    title: "Full Observability",
    description:
      "Langfuse traces every interaction — retrieval and generation spans nested under one parent trace.",
  },
  {
    icon: ShieldCheck,
    title: "Production Security",
    description:
      "Supabase Row Level Security isolates every tenant's data: a user only ever sees their own documents.",
  },
  {
    icon: BarChart3,
    title: "Metrics Dashboard",
    description:
      "Radar charts and side-by-side views separate “The AI Answer” from “The Evaluation of the Answer.”",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <FlaskConical className="h-5 w-5 text-primary" />
            <span>EvalLab</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="container flex flex-col items-center gap-6 py-24 text-center">
          <Badge variant="secondary" className="gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Not a chatbot — a laboratory for AI
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Accuracy-First AI for{" "}
            <span className="text-primary">Eliminating Hallucinations</span>
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            A production-grade Knowledge Base Evaluation Platform. Ground every
            answer in your documents, then prove it with empirical Ragas scores
            and full Langfuse observability.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">Start evaluating</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View the dashboard</Link>
            </Button>
          </div>
        </section>

        {/* Feature grid */}
        <section className="border-t bg-muted/30">
          <div className="container py-20">
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Engineering depth, not “Upload-Chat-Hope”
              </h2>
              <p className="mt-3 text-muted-foreground">
                Six pillars that separate a serious RAG system from a toy
                chatbot.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title}>
                  <CardHeader>
                    <feature.icon className="h-8 w-8 text-primary" />
                    <CardTitle className="mt-2">{feature.title}</CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} EvalLab. Built for grounded AI.</span>
          <span>Next.js · Supabase · LlamaIndex · Ragas · Langfuse</span>
        </div>
      </footer>
    </div>
  );
}
