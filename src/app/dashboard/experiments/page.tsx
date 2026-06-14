import { Trophy } from "lucide-react";

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

type Experiment = {
  config: string;
  retrieval: string;
  prompt: string;
  faithfulness: string;
  relevance: string;
};

// Placeholder leaderboard — populated by the Experiment Engine in Phase 8.
const experiments: Experiment[] = [
  {
    config: "Chunk Size: 200",
    retrieval: "Vector Only",
    prompt: "Simple",
    faithfulness: "—",
    relevance: "—",
  },
  {
    config: "Chunk Size: 500",
    retrieval: "Vector Only",
    prompt: "Simple",
    faithfulness: "—",
    relevance: "—",
  },
  {
    config: "Chunk Size: 500",
    retrieval: "Hybrid (Vector + BM25)",
    prompt: "Chain-of-Thought",
    faithfulness: "—",
    relevance: "—",
  },
];

export default function ExperimentLeaderboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Experiment Leaderboard
        </h1>
        <p className="text-muted-foreground">
          A/B test configurations and rank them by measured quality. Chunk
          size, retrieval method, and prompt strategy — all compared head to
          head.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Chunk Size</CardDescription>
            <CardTitle className="text-lg">200 vs 500</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Granularity vs. context trade-off.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Retrieval</CardDescription>
            <CardTitle className="text-lg">Hybrid vs Vector</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            BM25 keyword + semantic recall.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prompt</CardDescription>
            <CardTitle className="text-lg">Simple vs CoT</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Expert analyst, step-by-step reasoning.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <CardTitle>Results</CardTitle>
          </div>
          <CardDescription>
            Ranked by Faithfulness — higher is better.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Configuration</TableHead>
                <TableHead>Retrieval</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Faithfulness</TableHead>
                <TableHead>Relevance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {experiments.map((exp, i) => (
                <TableRow key={`${exp.config}-${exp.retrieval}-${exp.prompt}`}>
                  <TableCell className="font-medium">{i + 1}</TableCell>
                  <TableCell>{exp.config}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{exp.retrieval}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{exp.prompt}</Badge>
                  </TableCell>
                  <TableCell>{exp.faithfulness}</TableCell>
                  <TableCell>{exp.relevance}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
