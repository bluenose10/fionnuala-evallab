import { Activity } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RagasRadar } from "@/components/dashboard/ragas-radar";

const metrics = [
  {
    name: "Faithfulness",
    description: "Is the answer supported by the retrieved context?",
  },
  {
    name: "Answer Relevance",
    description: "Does the answer actually address the question?",
  },
  {
    name: "Context Precision",
    description: "Are the retrieved chunks relevant (signal vs. noise)?",
  },
  {
    name: "Context Recall",
    description: "Did retrieval find everything needed to answer?",
  },
];

export default function EvaluationHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Evaluation Hub</h1>
        <p className="text-muted-foreground">
          This is{" "}
          <strong>the evaluation of the answer</strong> — objective Ragas
          scoring, not a vibe check. Powered in Phase 7.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <CardTitle>Ragas Score Profile</CardTitle>
            </div>
            <CardDescription>
              Spider chart across the four core evaluation dimensions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RagasRadar />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metric Breakdown</CardTitle>
            <CardDescription>
              Each dimension scored 0.0 – 1.0 per evaluated answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{metric.name}</span>
                  <Badge variant="secondary">— / 1.0</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div className="h-2 w-0 rounded-full bg-primary" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
