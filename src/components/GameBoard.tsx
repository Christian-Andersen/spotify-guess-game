import { Flag, Loader2, Music2, Volume2, VolumeX, X } from "lucide-react";

import type { RoundResult, Track } from "../types";

import { cn } from "../lib/cn";
import { ALBUM_ART_CLUE_AT_S, ALBUM_NAME_CLUE_AT_S, ARTIST_CLUE_AT_S } from "../lib/constants";
import { SongPicker } from "./SongPicker";

interface GameBoardProps {
  pool: Track[];
  currentTrack: Track | null;
  roundNumber: number;
  totalScore: number;
  elapsed: number;
  wrongPicks: string[];
  phase: "loading" | "playing" | "revealed";
  lastResult?: RoundResult;
  isPlayerReady: boolean;
  positionMs: number | null;
  durationMs: number | null;
  muted: boolean;
  onToggleMute: () => void;
  onPickTrack: (track: Track) => void;
  onGiveUp: () => void;
  onQuit: () => void;
}

export function GameBoard({
  pool,
  currentTrack,
  roundNumber,
  totalScore,
  elapsed,
  wrongPicks,
  phase,
  lastResult,
  isPlayerReady,
  positionMs,
  durationMs,
  muted,
  onToggleMute,
  onPickTrack,
  onGiveUp,
  onQuit,
}: GameBoardProps) {
  const durationSec = durationMs ? durationMs / 1000 : 0;
  const songProgress =
    durationSec > 0 ? Math.min(100, ((positionMs ?? 0) / durationSec / 1000) * 100) : 0;
  const clueTicks =
    durationSec > 0
      ? [ARTIST_CLUE_AT_S, ALBUM_ART_CLUE_AT_S, ALBUM_NAME_CLUE_AT_S].filter(
          (t) => t <= durationSec,
        )
      : [];

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="flex w-full max-w-lg flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between text-sm text-neutral-400">
          <span>
            Round <span className="font-bold text-white">{roundNumber}</span>
          </span>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span>
              Score: <span className="font-bold text-green-400">{totalScore}</span>
            </span>
            <button
              type="button"
              onClick={onToggleMute}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onQuit}
              className="flex items-center gap-1.5 rounded-lg bg-neutral-800 px-3 py-1.5 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
            >
              <X className="h-4 w-4" />
              Quit
            </button>
          </div>
        </div>

        {phase === "loading" || !currentTrack ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="h-10 w-10 animate-spin text-green-500" />
            <p className="text-neutral-400">Loading game...</p>
          </div>
        ) : (
          <>
            {/* Clue area */}
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
              {phase === "revealed" && lastResult ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  {lastResult.correct ? (
                    <>
                      <p className="text-5xl font-black text-green-400">+{lastResult.points}</p>
                      <p className="text-lg font-semibold text-white">Correct!</p>
                      <p className="text-sm text-neutral-500">
                        {currentTrack.name} &middot; {currentTrack.artists}
                      </p>
                      <p className="text-xs text-neutral-600">
                        guessed in {lastResult.elapsedSeconds}s
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-neutral-400">It was...</p>
                      <p className="text-2xl font-bold text-white">{currentTrack.name}</p>
                      <p className="text-sm text-neutral-500">
                        {currentTrack.artists} &middot; {currentTrack.album}
                      </p>
                      <p className="text-xs text-neutral-600">Next round...</p>
                    </>
                  )}
                </div>
              ) : elapsed < ARTIST_CLUE_AT_S ? (
                <div className="text-center">
                  <Music2 className="mx-auto h-12 w-12 text-neutral-700" />
                  <p className="mt-3 text-neutral-500">Listen...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center">
                  <p className="text-2xl font-bold text-white">{currentTrack.artists}</p>
                  {elapsed >= ALBUM_ART_CLUE_AT_S && currentTrack.albumArt && (
                    <img
                      src={currentTrack.albumArt}
                      alt={currentTrack.album}
                      className="h-44 w-44 rounded-xl object-cover shadow-lg"
                    />
                  )}
                  {elapsed >= ALBUM_NAME_CLUE_AT_S && (
                    <p className="text-sm text-neutral-400 italic">{currentTrack.album}</p>
                  )}
                </div>
              )}
            </div>

            {/* Song progress */}
            <div className="space-y-1">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-green-500 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${songProgress}%` }}
                />
                {clueTicks.map((t) => (
                  <div
                    key={t}
                    className="absolute inset-y-0 w-px bg-neutral-500/80"
                    style={{ left: `${(t / durationSec) * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{elapsed}s listening</span>
              </div>
              <p className="text-right text-[10px] text-neutral-600">
                Artist @{ARTIST_CLUE_AT_S}s · Art @{ALBUM_ART_CLUE_AT_S}s · Album @
                {ALBUM_NAME_CLUE_AT_S}s
              </p>
            </div>

            {!isPlayerReady && (
              <p className="text-center text-xs text-yellow-500">
                Connecting to Spotify... Make sure Spotify is open.
              </p>
            )}

            {/* Wrong picks */}
            {wrongPicks.length > 0 && phase !== "revealed" && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-neutral-500">Not it:</span>
                {wrongPicks.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-red-400"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Guess box + give up */}
            <div className={cn("space-y-3", phase === "revealed" && "opacity-40")}>
              <SongPicker pool={pool} onPick={onPickTrack} />
              <button
                type="button"
                onClick={onGiveUp}
                disabled={phase !== "playing"}
                className="mx-auto flex items-center gap-2 rounded-xl border border-neutral-700 px-6 py-3 text-neutral-400 transition-colors hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Flag className="h-4 w-4" />
                Give Up
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
