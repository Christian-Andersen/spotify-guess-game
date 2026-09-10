import { RotateCcw, Trophy, Star, Music2 } from "lucide-react";
import type { RoundResult } from "../types";
import { cn } from "../lib/cn";

interface ScoreCardProps {
  totalScore: number;
  maxPossibleScore: number;
  results: RoundResult[];
  onPlayAgain: () => void;
}

function getGrade(percentage: number): {
  label: string;
  color: string;
  emoji: string;
} {
  if (percentage >= 0.9) return { label: "Legendary", color: "text-yellow-400", emoji: "🏆" };
  if (percentage >= 0.7) return { label: "Amazing", color: "text-green-400", emoji: "🌟" };
  if (percentage >= 0.5) return { label: "Good", color: "text-blue-400", emoji: "🎶" };
  if (percentage >= 0.3) return { label: "Not Bad", color: "text-orange-400", emoji: "🤔" };
  return { label: "Keep Trying", color: "text-red-400", emoji: "💪" };
}

export function ScoreCard({
  totalScore,
  maxPossibleScore,
  results,
  onPlayAgain,
}: ScoreCardProps) {
  const percentage = maxPossibleScore > 0 ? totalScore / maxPossibleScore : 0;
  const grade = getGrade(percentage);
  const exactCount = results.filter((r) => r.wasExact).length;

  return (
    <div className="min-h-screen bg-neutral-950">
      <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-12">
        {/* Score Header */}
        <div className="mb-12 flex flex-col items-center gap-4 text-center">
          <Trophy className={cn("h-16 w-16", grade.color)} />
          <p className="text-lg text-neutral-400">Game Complete!</p>
          <div className="space-y-1">
            <p className={cn("text-5xl font-black", grade.color)}>
              {grade.emoji} {grade.label}
            </p>
          </div>
          <div className="mt-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 px-8 py-6">
            <p className="text-6xl font-black text-white">
              {totalScore}
              <span className="text-2xl text-neutral-500">
                /{maxPossibleScore}
              </span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-neutral-400">
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-400" />
                {exactCount} perfect
              </span>
              <span>
                {Math.round(percentage * 100)}% accuracy
              </span>
            </div>
          </div>
        </div>

        {/* Track Results */}
        <div className="mb-10 w-full space-y-2">
          <h3 className="mb-4 text-lg font-semibold text-neutral-300">
            Round Results
          </h3>
          {results.map((result, i) => (
            <div
              key={`${result.track.id}-${String(i)}`}
              className={cn(
                "flex items-center gap-4 rounded-xl border p-4 transition-colors",
                result.wasExact
                  ? "border-green-500/30 bg-green-500/5"
                  : result.points > 0
                    ? "border-yellow-500/20 bg-yellow-500/5"
                    : "border-neutral-800 bg-neutral-900/30",
              )}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-bold text-neutral-400">
                {i + 1}
              </span>

              {result.track.albumArt ? (
                <img
                  src={result.track.albumArt}
                  alt=""
                  className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                  <Music2 className="h-5 w-5 text-neutral-600" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">
                  {result.track.name}
                </p>
                <p className="truncate text-sm text-neutral-500">
                  {result.track.artists}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p className="font-bold text-white">+{result.points}</p>
                {!result.wasExact && result.guess && (
                  <p className="max-w-[120px] truncate text-xs text-neutral-500">
                    "{result.guess}"
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Play Again */}
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex items-center gap-3 rounded-full bg-green-500 px-10 py-4 text-lg font-bold text-black transition-all hover:bg-green-400 hover:shadow-lg hover:shadow-green-500/25 active:scale-95"
        >
          <RotateCcw className="h-5 w-5" />
          Play Again
        </button>
      </main>
    </div>
  );
}
