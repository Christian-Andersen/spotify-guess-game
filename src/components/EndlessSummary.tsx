import { Clock, RotateCcw, Star, Target, Trophy, XCircle } from "lucide-react";

import type { RoundResult } from "../types";

interface EndlessSummaryProps {
  results: RoundResult[];
  totalScore: number;
  onNewGame: () => void;
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3">
      <span className={accent ?? "text-neutral-500"}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold text-white">{value}</p>
        <p className="text-xs text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export function EndlessSummary({ results, totalScore, onNewGame }: EndlessSummaryProps) {
  const rounds = results.length;
  const correct = results.filter((r) => r.correct).length;
  const gaveUp = rounds - correct;
  const best = correct > 0 ? Math.max(...results.filter((r) => r.correct).map((r) => r.points)) : 0;
  const avgGuessSeconds =
    correct > 0
      ? results.filter((r) => r.correct).reduce((acc, r) => acc + r.elapsedSeconds, 0) / correct
      : 0;

  return (
    <div className="min-h-screen bg-neutral-950">
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-12">
        <div className="mb-10 flex flex-col items-center text-center">
          <Trophy className="h-14 w-14 text-yellow-400" />
          <p className="mt-4 text-lg text-neutral-400">Session over!</p>
          <p className="mt-2 text-5xl font-black text-white">
            {totalScore}
            <span className="text-2xl text-neutral-500"> points</span>
          </p>
        </div>

        <div className="mb-10 grid w-full grid-cols-2 gap-3">
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Total score"
            value={`${totalScore}`}
            accent="text-yellow-400"
          />
          <StatCard
            icon={<Target className="h-5 w-5" />}
            label="Rounds played"
            value={`${rounds}`}
          />
          <StatCard
            icon={<Star className="h-5 w-5" />}
            label="Correct"
            value={`${correct}`}
            accent="text-green-400"
          />
          <StatCard
            icon={<XCircle className="h-5 w-5" />}
            label="Gave up"
            value={`${gaveUp}`}
            accent="text-red-400"
          />
          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            label="Best round"
            value={`${best}`}
            accent="text-yellow-400"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Avg guess time"
            value={correct > 0 ? `${avgGuessSeconds.toFixed(1)}s` : "—"}
          />
        </div>

        <button
          type="button"
          onClick={onNewGame}
          className="flex items-center gap-3 rounded-full bg-green-500 px-10 py-4 text-lg font-bold text-black transition-all hover:bg-green-400 hover:shadow-lg hover:shadow-green-500/25 active:scale-95"
        >
          <RotateCcw className="h-5 w-5" />
          Play another playlist
        </button>
      </main>
    </div>
  );
}
