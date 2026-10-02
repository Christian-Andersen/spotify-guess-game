import { LogOut, Music2, ArrowRight, ListMusic, Loader2, Search, CircleAlert } from "lucide-react";
import { useState, useEffect, useRef } from "react";

import type { Playlist } from "../types";

import { cn } from "../lib/cn";

interface PlaylistPickerProps {
  playlists: Playlist[];
  isLoading: boolean;
  isRetrying: boolean;
  retryCountdown: number;
  retryAttempt: number;
  playlistError: string | null;
  startError: string | null;
  onFetchPlaylists: () => void;
  onManualRetry: () => void;
  onStartGame: (playlistId: string) => void;
  onLogout: () => void;
}

export function PlaylistPicker({
  playlists,
  isLoading,
  isRetrying,
  retryCountdown,
  retryAttempt,
  playlistError,
  startError,
  onFetchPlaylists,
  onManualRetry,
  onStartGame,
  onLogout,
}: PlaylistPickerProps) {
  const [manualUrl, setManualUrl] = useState("");
  const [showManual, setShowManual] = useState(false);
  const didFetchRef = useRef(false);

  // Fetch exactly once on mount; exponential backoff (handled in the hook)
  // drives all subsequent refetches so we never hot-loop the Spotify API.
  useEffect(() => {
    if (didFetchRef.current) return;
    didFetchRef.current = true;
    onFetchPlaylists();
  }, [onFetchPlaylists]);

  const extractPlaylistId = (input: string): string | null => {
    const trimmed = input.trim();
    // Match Spotify playlist URL, with optional locale prefix:
    // https://open.spotify.com/playlist/{id} or
    // https://open.spotify.com/intl-{locale}/playlist/{id}
    const urlId = trimmed.match(/open\.spotify\.com\/(?:intl-[a-zA-Z-]+\/)?playlist\/([a-zA-Z0-9]+)/)?.[1];
    if (urlId) return urlId;
    // Match spotify:playlist:{id}
    const uriId = trimmed.match(/spotify:playlist:([a-zA-Z0-9]+)/)?.[1];
    if (uriId) return uriId;
    // Assume it's a raw ID (alphanumeric, ~22 chars)
    if (/^[a-zA-Z0-9]{20,}$/.test(trimmed)) return trimmed;
    return null;
  };

  const handleManualSubmit = () => {
    const id = extractPlaylistId(manualUrl);
    if (id) {
      onStartGame(id);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
              <Music2 className="h-5 w-5 text-black" />
            </div>
            <h1 className="text-xl font-bold">
              Guess the <span className="text-green-400">Song</span>
            </h1>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-8 space-y-2">
          <h2 className="text-2xl font-bold">Choose a Playlist</h2>
          <p className="text-neutral-400">
            Pick a playlist to test your music knowledge — the game shuffles it and keeps playing
            until you call it quits.
          </p>
        </div>

        {startError && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{startError}</p>
          </div>
        )}

        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            aria-expanded={showManual}
            className="flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-white"
          >
            <ListMusic className="h-4 w-4" />
            {showManual ? "Browse my playlists instead" : "Paste a playlist URL"}
          </button>
        </div>

        {showManual ? (
          <div className="flex gap-3">
            <input
              type="text"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              placeholder="Paste Spotify playlist URL or ID..."
              className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 transition-colors outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={!extractPlaylistId(manualUrl)}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 font-semibold text-black transition-all hover:bg-green-400 disabled:opacity-40 disabled:hover:bg-green-500"
            >
              <ArrowRight className="h-4 w-4" />
              Go
            </button>
          </div>
        ) : isLoading || isRetrying ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            {isRetrying && retryCountdown > 0 ? (
              <div className="text-center">
                <p className="text-neutral-300">
                  Rate limited by Spotify — retrying in{" "}
                  <span className="font-bold text-green-400">{retryCountdown}s</span>
                </p>
                <p className="mt-1 text-sm text-neutral-500">
                  Backing off to avoid further throttling.{" "}
                  <span className="text-neutral-400">(attempt {retryAttempt})</span>
                </p>
              </div>
            ) : (
              <p className="text-neutral-400">Loading your playlists...</p>
            )}
          </div>
        ) : playlists.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Search className="h-12 w-12 text-neutral-600" />
            <p className="text-neutral-400">{playlistError ?? "No playlists found."}</p>
            <button
              type="button"
              onClick={onManualRetry}
              className="text-sm text-green-400 hover:underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((pl) => (
              <button
                type="button"
                key={pl.id}
                onClick={() => onStartGame(pl.id)}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-all",
                  "hover:border-neutral-700 hover:bg-neutral-800/50 hover:shadow-lg hover:shadow-green-500/5",
                )}
              >
                {pl.image ? (
                  <img
                    src={pl.image}
                    alt=""
                    className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                    <Music2 className="h-6 w-6 text-neutral-600" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-green-400">{pl.name}</p>
                  <p className="truncate text-sm text-neutral-500">
                    {pl.owner} &middot; {pl.trackCount} tracks
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 flex-shrink-0 text-neutral-600 transition-colors group-hover:text-green-400" />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
