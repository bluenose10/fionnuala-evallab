import { ExperimentLeaderboard } from "@/components/dashboard/ExperimentLeaderboard";

// Phase 10 — Experiment Leaderboard.
// This page renders the live `ExperimentLeaderboard` client component, which:
//   - loads indexed documents + existing experiment_runs directly via Supabase
//   - triggers new runs via POST /api/experiments/run
//   - ranks configs by averaged Ragas score with a Recharts radar comparison
//
// Previously this page rendered a hardcoded placeholder table with "—" scores.
// That black-box behaviour is replaced with real, objective Ragas data here.
export default function ExperimentLeaderboardPage() {
  return <ExperimentLeaderboard />;
}
