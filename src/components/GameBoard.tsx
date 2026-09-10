import { useState, useEffect, useRef } from "react";
import {
  Play,
  SkipForward,
  Loader2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Track } from "../types";
import { cn } from "../lib/cn";

interface GameBoardProps {
  currentTrack: Track;
  currentRoundIndex: number;
  roundsTotal: number;
  totalScore: number;
  snippetDuration: number;
  phase: "loading" | "playing" | "guessing" | "revealing";
  onPlaySnippet: () => void;
  onSubmitGuess: (guess: string) => void;
  onNextRound: () => void;
  lastGuess?: string;
  lastPoints?: number;
  lastSimilarity?: number;
  isPlayerReady: boolean;
}

export function GameBoard({
  currentTrack,
  currentRoundIndex,
  roundsTotal,
  totalScore,
  snippetDuration,
  phase,
  onPlaySnippet,
  onSubmitGuess,
  onNextRound,
  lastGuess,
  lastPoints,
  lastSimilarity,
  isPlayerReady,
}: GameBoardProps) {
  const [guess, setGuess] = useState("");
  const [timer, setTimer] = useState(snippetDuration);
  const [muted, setMuted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRoundRef = useRef(currentRoundIndex);

  // Reset state on new round
  useEffect(() => {
    if (prevRoundRef.current === currentRoundIndex) return;
    prevRoundRef.current = currentRoundIndex;
    setGuess("");
    setTimer(snippetDuration);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [currentRoundIndex, snippetDuration]);

  // Focus input when guessing
  useEffect(() => {
    if (phase === "guessing") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  // Countdown timer
  useEffect(() => {
    if (phase === "playing") {
      setTimer(snippetDuration);
      timerRef.current = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, snippetDuration]);

  const handleSubmit = () => {
    const trimmed = guess.trim();
    if (!trimmed) return;
    onSubmitGuess(trimmed);
  };

  const progress =
    phase === "playing"
      ? ((snippetDuration - timer) / snippetDuration) * 100
      : phase === "revealing"
        ? 100
        : 0;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <span>
            Round{" "}
            <span className="font-bold text-white">
              {currentRoundIndex + 1}
            </span>
            /{roundsTotal}
          </span>
          <span>
            Score: <span className="font-bold text-green-400">{totalScore}</span>
          </span>
        </div>

        {/* Album Art */}
        <div className="flex justify-center">
          <div className="relative">
            <div
              className={cn(
                "h-64 w-64 overflow-hidden rounded-2xl shadow-2xl transition-all duration-500",
                phase === "guessing" && "blur-xl scale-105",
                phase === "revealing" && "blur-none scale-100",
              )}
            >
              {currentTrack.albumArt ? (
                <img
                  src={currentTrack.albumArt}
                  alt={currentTrack.album}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-neutral-800">
                  <span className="text-6xl">?</span>
                </div>
              )}
            </div>
            {phase === "guessing" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl">?</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-neutral-500">
            <span>
              {phase === "playing"
                ? `-${timer}s`
                : phase === "guessing"
                  ? "Time's up!"
                  : ""}
            </span>
            <span>{snippetDuration}s snippet</span>
          </div>
        </div>

        {/* Controls */}
        {phase === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
            <p className="text-neutral-400">Loading game...</p>
          </div>
        )}

        {phase === "playing" && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPlaySnippet}
                disabled={!isPlayerReady}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-black transition-all hover:bg-green-400 hover:shadow-lg hover:shadow-green-500/25 active:scale-95 disabled:opacity-40"
              >
                <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
              </button>
              <button
                type="button"
                onClick={() => setMuted(!muted)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
              >
                {muted ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
            </div>
            {!isPlayerReady && (
              <p className="text-xs text-yellow-500">
                Connecting to Spotify... Make sure Spotify is open.
              </p>
            )}
          </div>
        )}

        {phase === "guessing" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-lg font-semibold">What song is this?</p>
              <p className="text-sm text-neutral-500">
                Type your best guess and press Enter
              </p>
            </div>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Enter song name..."
                className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 px-5 py-4 text-lg text-white placeholder-neutral-500 outline-none transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!guess.trim()}
                className="rounded-xl bg-green-500 px-6 py-4 font-bold text-black transition-all hover:bg-green-400 disabled:opacity-40"
              >
                Guess
              </button>
            </div>
          </div>
        )}

        {phase === "revealing" && (
          <div className="space-y-4 text-center">
            <div className="space-y-1">
              <p className="text-sm text-neutral-400">The answer was...</p>
              <p className="text-2xl font-bold text-green-400">
                {currentTrack.name}
              </p>
              <p className="text-sm text-neutral-500">
                {currentTrack.artists} &middot; {currentTrack.album}
              </p>
            </div>

            {lastGuess !== undefined && (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                <p className="text-sm text-neutral-400">
                  Your guess: <span className="text-white">{lastGuess}</span>
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  {lastPoints !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-bold",
                        lastPoints === 3
                          ? "bg-green-500/20 text-green-400"
                          : lastPoints === 2
                            ? "bg-blue-500/20 text-blue-400"
                            : lastPoints === 1
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400",
                      )}
                    >
                      {lastPoints === 3
                        ? "Perfect! +3"
                        : lastPoints === 2
                          ? "Close! +2"
                          : lastPoints === 1
                            ? "Close enough +1"
                            : "Wrong! +0"}
                    </span>
                  )}
                  {lastSimilarity !== undefined && lastSimilarity < 1 && (
                    <span className="text-xs text-neutral-500">
                      {Math.round(lastSimilarity * 100)}% match
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onNextRound}
              className="mx-auto flex items-center gap-2 rounded-xl bg-green-500 px-8 py-4 font-bold text-black transition-all hover:bg-green-400 active:scale-95"
            >
              {currentRoundIndex + 1 >= roundsTotal ? (
                "See Results"
              ) : (
                <>
                  Next Round
                  <SkipForward className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
