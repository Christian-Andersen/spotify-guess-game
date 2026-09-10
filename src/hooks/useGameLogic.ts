import { useState, useCallback, useEffect, useRef } from "react";
import type { SpotifyApi } from "@spotify/web-api-ts-sdk";
import type { Track, RoundResult, GamePhase, Playlist } from "../types";
import { computeMatchScore, getRoundPoints } from "../lib/matching";
import {
  createExponentialBackoff,
  isRetryableError,
  sleep,
} from "../lib/backoff";

const ROUNDS_PER_GAME = 10;
const SNIPPET_DURATION_S = 8;
const BUFFER_S = 15;

interface UseGameLogicParams {
  sdk: SpotifyApi;
  play: (uris: string[], positionMs: number) => Promise<void>;
  pause: () => Promise<void>;
  isPlayerReady: boolean;
}

export function useGameLogic({
  sdk,
  play,
  pause,
  isPlayerReady,
}: UseGameLogicParams) {
  const [phase, setPhase] = useState<GamePhase>("playlist");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [currentGuess, setCurrentGuess] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryAttemptRef = useRef(0);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const autoPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playlistBackoffRef = useRef(createExponentialBackoff());

  const clearAutoPause = useCallback(() => {
    if (autoPauseTimer.current) {
      clearTimeout(autoPauseTimer.current);
      autoPauseTimer.current = null;
    }
  }, []);

  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);
    console.warn("[game:playlists] fetch started");

    // Confirm auth state before requesting
    try {
      const token = await sdk.getAccessToken();
      console.warn("[game:playlists] access token present:", !!token);
    } catch (tokenErr) {
      console.error("[game:playlists] getAccessToken threw:", tokenErr);
    }

    try {
      const response = await sdk.currentUser.playlists.playlists(50);
      console.warn("[game:playlists] response:", {
        href: response.href,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        returnedCount: response.items.length,
      });

      const mapped: Playlist[] = response.items
        .filter((pl) => pl.tracks && pl.tracks.total > 0)
        .map((pl) => ({
          id: pl.id,
          name: pl.name,
          description: pl.description ?? "",
          image: pl.images?.[0]?.url ?? "",
          trackCount: pl.tracks?.total ?? 0,
          owner: pl.owner.display_name ?? "Unknown",
        }));
      console.warn(
        `[game:playlists] mapped: ${mapped.length} usable of ${response.items.length} returned`,
      );
      if (response.items.length > 0 && mapped.length === 0) {
        console.warn(
          "[game:playlists] ALL items were filtered out. Sample item:",
          response.items[0],
        );
      }
      // Success: clear backoff state so any later failure starts fresh
      playlistBackoffRef.current.reset();
      retryAttemptRef.current = 0;
      setIsRetrying(false);
      setRetryCountdown(0);
      setRetryAttempt(0);
      setPlaylistError(null);
      setPlaylists(mapped);
    } catch (e) {
      const err = e as {
        status?: number;
        message?: string;
        body?: unknown;
        response?: unknown;
      };
      console.error("[game:playlists] fetch FAILED:", e);
      console.error("[game:playlists] error details:", {
        name: e instanceof Error ? e.name : typeof e,
        message: err.message,
        status: err.status,
        body: err.body,
        response: err.response,
      });

      if (isRetryableError(e)) {
        const waitMs = playlistBackoffRef.current.nextDelayMs(e);
        const attempt = retryAttemptRef.current + 1;
        retryAttemptRef.current = attempt;
        setIsRetrying(true);
        setRetryAttempt(attempt);
        setRetryCountdown(Math.ceil(waitMs / 1000));
        setPlaylistError(null);
        console.warn(
          `[game:playlists] retryable error -> attempt ${attempt}, retrying in ${waitMs}ms`,
        );
      } else {
        setIsRetrying(false);
        setRetryCountdown(0);
        retryAttemptRef.current = 0;
        setRetryAttempt(0);
        setPlaylistError(
          "Could not load playlists. Check your connection and try again.",
        );
        console.warn("[game:playlists] terminal error, stopping auto-retry");
      }
    } finally {
      setIsLoading(false);
      console.warn("[game:playlists] fetch finished, isLoading=false");
    }
  }, [sdk]);

  // Tick the retry countdown down; at 0, re-fetch with the computed delay
  useEffect(() => {
    if (!isRetrying) return;
    if (retryCountdown <= 0) {
      const t = setTimeout(() => void fetchPlaylists(), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setRetryCountdown((c) => c - 1),
      1000,
    );
    return () => clearTimeout(t);
  }, [isRetrying, retryCountdown, fetchPlaylists]);

  const retryPlaylists = useCallback(() => {
    playlistBackoffRef.current.reset();
    void fetchPlaylists();
  }, [fetchPlaylists]);

  const fetchPlaylistTracks = useCallback(
    async (playlistId: string): Promise<Track[]> => {
      const backoff = createExponentialBackoff({ baseDelayMs: 1000 });
      for (;;) {
        try {
          let allTracks: Track[] = [];
          let offset = 0;
          const limit = 100;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const response = await sdk.playlists.getPlaylistItems(
              playlistId,
              undefined,
              undefined,
              limit as never,
              offset,
            );

            for (const item of response.items) {
              if (
                item.track &&
                "uri" in item.track &&
                item.track.type === "track"
              ) {
                const t = item.track;
                allTracks.push({
                  id: t.id,
                  name: t.name,
                  artists: t.artists.map((a) => a.name).join(", "),
                  album: t.album.name,
                  albumArt: t.album.images?.[0]?.url ?? "",
                  duration_ms: t.duration_ms,
                  uri: t.uri,
                });
              }
            }

            offset += limit;
            if (response.items.length < limit || !response.next) break;
          }

          console.warn(
            `[game:tracks] fetched ${allTracks.length} tracks for playlist ${playlistId}`,
          );
          return allTracks;
        } catch (e) {
          if (!isRetryableError(e)) {
            console.error("[game:tracks] terminal error fetching tracks:", e);
            return [];
          }
          const waitMs = backoff.nextDelayMs(e);
          console.warn(
            `[game:tracks] retryable error fetching tracks, retrying in ${waitMs}ms`,
            e,
          );
          await sleep(waitMs);
        }
      }
    },
    [sdk],
  );

  const startGame = useCallback(
    async (playlistId: string) => {
      setPhase("loading");
      const allTracks = await fetchPlaylistTracks(playlistId);
      if (allTracks.length === 0) {
        setPhase("playlist");
        return;
      }

      const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(
        0,
        Math.min(ROUNDS_PER_GAME, shuffled.length),
      );

      setTracks(selected);
      setCurrentRoundIndex(0);
      setResults([]);
      setTotalScore(0);
      setCurrentGuess("");
      setPhase("playing");
    },
    [fetchPlaylistTracks],
  );

  const playSnippet = useCallback(async () => {
    if (!isPlayerReady || tracks.length === 0) return;

    const track = tracks[currentRoundIndex];
    if (!track) return;

    const minPos = BUFFER_S * 1000;
    const maxPos = Math.max(
      minPos,
      track.duration_ms - SNIPPET_DURATION_S * 1000 - BUFFER_S * 1000,
    );
    const randomPos =
      maxPos <= minPos
        ? minPos
        : Math.floor(Math.random() * (maxPos - minPos) + minPos);

    setPhase("playing");
    await play([track.uri], randomPos);

    clearAutoPause();
    autoPauseTimer.current = setTimeout(async () => {
      await pause();
      setPhase("guessing");
    }, SNIPPET_DURATION_S * 1000);
  }, [
    isPlayerReady,
    tracks,
    currentRoundIndex,
    play,
    pause,
    clearAutoPause,
  ]);

  const submitGuess = useCallback(
    (guess: string) => {
      if (tracks.length === 0) return;

      clearAutoPause();
      const track = tracks[currentRoundIndex];
      const { similarity, exact } = computeMatchScore(guess, track.name);
      const points = getRoundPoints(similarity, exact);

      const result: RoundResult = {
        track,
        guess,
        points,
        similarity,
        wasExact: exact,
      };

      setResults((prev) => [...prev, result]);
      setTotalScore((prev) => prev + points);
      setPhase("revealing");
    },
    [tracks, currentRoundIndex, clearAutoPause],
  );

  const nextRound = useCallback(() => {
    if (currentRoundIndex + 1 >= tracks.length) {
      setPhase("score");
    } else {
      setCurrentRoundIndex((prev) => prev + 1);
      setCurrentGuess("");
      setPhase("playing");
    }
  }, [currentRoundIndex, tracks.length]);

  const resetGame = useCallback(() => {
    clearAutoPause();
    setPhase("playlist");
    setTracks([]);
    setCurrentRoundIndex(0);
    setResults([]);
    setTotalScore(0);
    setCurrentGuess("");
  }, [clearAutoPause]);

  const currentTrack = tracks[currentRoundIndex] ?? null;
  const maxPossibleScore = tracks.length * 3;
  const roundsTotal = tracks.length;

  return {
    phase,
    playlists,
    tracks,
    currentRoundIndex,
    currentTrack,
    results,
    totalScore,
    maxPossibleScore,
    roundsTotal,
    isLoading,
    currentGuess,
    setCurrentGuess,
    snippetDuration: SNIPPET_DURATION_S,
    retryCountdown,
    retryAttempt,
    isRetrying,
    playlistError,
    fetchPlaylists,
    retryPlaylists,
    startGame,
    playSnippet,
    submitGuess,
    nextRound,
    resetGame,
  };
}
