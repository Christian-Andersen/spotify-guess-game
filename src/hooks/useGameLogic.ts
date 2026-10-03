import type { SpotifyApi, SimplifiedPlaylist } from "@spotify/web-api-ts-sdk";

import { useState, useCallback, useEffect, useRef } from "react";

import type { Track, RoundResult, GamePhase, Playlist } from "../types";

import { createExponentialBackoff, extractStatus, isRetryableError, sleep } from "../lib/backoff";
import { MAX_ROUND_POINTS, MIN_ROUND_POINTS, REVEAL_DELAY_MS } from "../lib/constants";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

// Auto-retry failed playlist fetches at most this many consecutive times
// before giving up and surfacing a manual "Try again". Spotify rate-limit
// bursts are short-lived, so five attempts (with backoff) is generous.
const MAX_RETRY_ATTEMPTS = 5;

// Spotify's Feb 2026 migration moved playlist items from
// `GET /playlists/{id}/tracks` to `GET /playlists/{id}/items`; the old path
// now returns 403 for Development Mode apps. The published SDK (1.2.0) still
// calls the old path, so we hit the new one directly.
interface PlaylistTrackObject {
  id: string;
  name: string;
  type: string;
  uri: string;
  duration_ms: number;
  artists: Array<{ name: string }>;
  album: { name: string; images?: Array<{ url: string }> };
}

interface PlaylistItemsPage {
  items: Array<{
    item?: PlaylistTrackObject | null;
    track?: PlaylistTrackObject | null;
  }>;
  next: string | null;
}

interface UseGameLogicParams {
  sdk: SpotifyApi;
  fetchAccessToken: () => Promise<string | null>;
  play: (uris: string[], positionMs: number) => Promise<void>;
  pause: () => Promise<void>;
  setRepeat: (state: "track" | "off") => Promise<void>;
  isPlayerReady: boolean;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    // `i` and `j` are always valid indices in this loop, so the values exist.
    const temp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = temp;
  }
  return arr;
}

export function useGameLogic({
  sdk,
  fetchAccessToken,
  play,
  pause,
  setRepeat,
  isPlayerReady,
}: UseGameLogicParams) {
  const [phase, setPhase] = useState<GamePhase>("playlist");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  // The full, shuffled track pool of the chosen playlist (endless).
  const [pool, setPool] = useState<Track[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [wrongPicks, setWrongPicks] = useState<string[]>([]);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const retryAttemptRef = useRef(0);
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const playlistBackoffRef = useRef(createExponentialBackoff());
  // Cache our own user ID: `GET /me` is unnecessary on every refresh/retry.
  const currentUserIdRef = useRef<string | null>(null);
  // Guards against starting playback for the same track twice.
  const playedRoundRef = useRef<string | null>(null);

  const currentTrack = pool[roundIndex] ?? null;

  // Fetch playlists for the picker (unchanged flow).
  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);

    try {
      let myId = currentUserIdRef.current;
      if (!myId) {
        const me = await sdk.currentUser.profile();
        myId = me.id;
        currentUserIdRef.current = myId;
      }

      const response = await sdk.currentUser.playlists.playlists(50);

      // Feb 2026 migration: the `tracks` field on playlist objects was renamed
      // to `items`, and `items` is only present on playlists the current user
      // owns or collaborates on (per Spotify's own access model). The legacy
      // `tracks` field may still be returned for followed playlists we cannot
      // fetch, so it must not be enough on its own to show a playlist.
      type LivePlaylist = SimplifiedPlaylist & { items?: { total?: number } | null };

      const playlistsResponse = response.items as LivePlaylist[];

      const mapped: Playlist[] = playlistsResponse
        // Only playlists we own are guaranteed fetchable via `/items`; the
        // migration guide's "items only on owned/collaborated" claim doesn't
        // hold for `/me/playlists`, so anything else may 403 when played.
        .filter((pl) => {
          const count = pl.items?.total ?? pl.tracks?.total ?? 0;
          return count > 0 && pl.owner.id === myId;
        })
        .map((pl) => ({
          id: pl.id,
          name: pl.name,
          description: pl.description ?? "",
          image: pl.images?.[0]?.url ?? "",
          trackCount: pl.items?.total ?? pl.tracks?.total ?? 0,
          owner: pl.owner.display_name ?? "Unknown",
        }));

      // Success: clear backoff state so any later failure starts fresh
      playlistBackoffRef.current.reset();
      retryAttemptRef.current = 0;
      setIsRetrying(false);
      setRetryCountdown(0);
      setRetryAttempt(0);
      setPlaylistError(null);
      setPlaylists(mapped);
    } catch (error) {
      if (isRetryableError(error)) {
        const waitMs = playlistBackoffRef.current.nextDelayMs(error);
        const attempt = retryAttemptRef.current + 1;
        retryAttemptRef.current = attempt;

        if (attempt >= MAX_RETRY_ATTEMPTS) {
          // Surrender to a manual retry instead of looping forever.
          playlistBackoffRef.current.reset();
          retryAttemptRef.current = 0;
          setIsRetrying(false);
          setRetryCountdown(0);
          setRetryAttempt(0);
          setPlaylistError(
            "Could not load playlists after several attempts. Check your connection and try again.",
          );
        } else {
          setIsRetrying(true);
          setRetryAttempt(attempt);
          setRetryCountdown(Math.ceil(waitMs / 1000));
          setPlaylistError(null);
        }
      } else {
        setIsRetrying(false);
        setRetryCountdown(0);
        retryAttemptRef.current = 0;
        setRetryAttempt(0);
        setPlaylistError("Could not load playlists. Check your connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  // Tick the retry countdown down; at 0, re-fetch with the computed delay
  useEffect(() => {
    if (!isRetrying) return;
    if (retryCountdown <= 0) {
      const t = setTimeout(() => void fetchPlaylists(), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRetryCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [isRetrying, retryCountdown, fetchPlaylists]);

  const retryPlaylists = useCallback(() => {
    playlistBackoffRef.current.reset();
    retryAttemptRef.current = 0;
    void fetchPlaylists();
  }, [fetchPlaylists]);

  const fetchPlaylistTracks = useCallback(
    async (playlistId: string): Promise<Track[]> => {
      const backoff = createExponentialBackoff({ baseDelayMs: 1000 });
      let attempt = 0;
      for (;;) {
        try {
          const token = await fetchAccessToken();
          if (!token) throw new Error("Not authenticated with Spotify");

          const allTracks: Track[] = [];
          let offset = 0;
          const limit = 50;
          while (true) {
            const url =
              `${SPOTIFY_API_BASE}/playlists/${encodeURIComponent(playlistId)}/items` +
              `?limit=${limit}&offset=${offset}`;
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

            if (!res.ok) {
              const body = await res.text();
              const error = new Error(
                `Playlist items request failed: ${res.status} ${res.statusText} ${body}`,
              ) as Error & { status: number };
              error.status = res.status;
              throw error;
            }

            const page = (await res.json()) as PlaylistItemsPage;

            for (const entry of page.items) {
              // `item` is the new key; `track` is kept for backward compatibility.
              const track = entry.item ?? entry.track;
              if (track && track.type === "track" && track.uri) {
                allTracks.push({
                  id: track.id,
                  name: track.name,
                  artists: track.artists.map((a) => a.name).join(", "),
                  album: track.album.name,
                  albumArt: track.album.images?.[0]?.url ?? "",
                  duration_ms: track.duration_ms,
                  uri: track.uri,
                });
              }
            }

            offset += limit;
            if (!page.next) break;
          }

          return allTracks;
        } catch (error) {
          if (!isRetryableError(error)) {
            throw error;
          }
          attempt += 1;
          if (attempt >= MAX_RETRY_ATTEMPTS) throw error;
          const waitMs = backoff.nextDelayMs(error);
          await sleep(waitMs);
        }
      }
    },
    [fetchAccessToken],
  );

  const startGame = useCallback(
    async (playlistId: string) => {
      setPhase("loading");
      setStartGameError(null);
      try {
        const allTracks = await fetchPlaylistTracks(playlistId);
        if (allTracks.length === 0) {
          setStartGameError("That playlist has no playable tracks. Try another one.");
          setPhase("playlist");
          return;
        }

        playedRoundRef.current = null;
        setPool(shuffle(allTracks));
        setRoundIndex(0);
        setElapsed(0);
        setWrongPicks([]);
        setResults([]);
        setTotalScore(0);
        setPhase("playing");
      } catch (error) {
        if (extractStatus(error) === 403) {
          setStartGameError(
            "Spotify only lets you load playlists you own or collaborate on via the API.",
          );
        } else {
          setStartGameError("Could not load that playlist. Please try another.");
        }
        setPhase("playlist");
      }
    },
    [fetchPlaylistTracks],
  );

  // Start playback once the player is ready; the track loops until answered.
  useEffect(() => {
    if (phase !== "playing" || !isPlayerReady || !currentTrack) return;
    if (playedRoundRef.current === currentTrack.id) return;
    playedRoundRef.current = currentTrack.id;
    setElapsed(0);
    setWrongPicks([]);

    // Playback starts at 0:00 so the reveal notches on the progress bar line
    // up with real song time.
    void play([currentTrack.uri], 0);
    void setRepeat("track");
  }, [phase, isPlayerReady, currentTrack, play, setRepeat]);

  // Elapsed seconds drive the clue reveals and speed-based scoring.
  useEffect(() => {
    if (phase !== "playing" || !isPlayerReady) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, isPlayerReady]);

  const onPickTrack = useCallback(
    (picked: Track) => {
      if (phase !== "playing" || !currentTrack) return;

      if (picked.id === currentTrack.id) {
        const points = Math.max(MIN_ROUND_POINTS, MAX_ROUND_POINTS - elapsed);
        const result: RoundResult = {
          track: currentTrack,
          points,
          correct: true,
          elapsedSeconds: elapsed,
        };
        setResults((prev) => [...prev, result]);
        setTotalScore((prev) => prev + points);
        void pause();
        setPhase("revealed");
      } else {
        // Picking the same wrong track twice adds no information — keep one chip.
        setWrongPicks((prev) => (prev.includes(picked.name) ? prev : [...prev, picked.name]));
      }
    },
    [phase, currentTrack, elapsed, pause],
  );

  const giveUp = useCallback(() => {
    if (phase !== "playing" || !currentTrack) return;
    const result: RoundResult = {
      track: currentTrack,
      points: 0,
      correct: false,
      elapsedSeconds: elapsed,
    };
    setResults((prev) => [...prev, result]);
    void pause();
    setPhase("revealed");
  }, [phase, currentTrack, elapsed, pause]);

  const advanceRound = useCallback(() => {
    playedRoundRef.current = null;
    setElapsed(0);
    setWrongPicks([]);
    if (roundIndex + 1 >= pool.length) {
      // Endless: the pool is exhausted — reshuffle and loop back around.
      setPool((p) => shuffle(p));
      setRoundIndex(0);
    } else {
      setRoundIndex((i) => i + 1);
    }
    setPhase("playing");
  }, [roundIndex, pool.length]);

  // Auto-advance after the answer is revealed.
  useEffect(() => {
    if (phase !== "revealed") return;
    const t = setTimeout(() => advanceRound(), REVEAL_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase, advanceRound]);

  const quitGame = useCallback(() => {
    playedRoundRef.current = null;
    void pause();
    void setRepeat("off");
    setElapsed(0);
    setWrongPicks([]);
    setPhase("summary");
  }, [pause, setRepeat]);

  const newGame = useCallback(() => {
    playedRoundRef.current = null;
    void pause();
    void setRepeat("off");
    setPool([]);
    setRoundIndex(0);
    setElapsed(0);
    setWrongPicks([]);
    setResults([]);
    setTotalScore(0);
    setStartGameError(null);
    setPhase("playlist");
  }, [pause, setRepeat]);

  // `results` already contains the round being revealed, so during
  // "revealed" the current round is `results.length` — adding one would show
  // the *next* round's number (and remount GameBoard) while the answer is up.
  const roundNumber = phase === "revealed" ? results.length : results.length + 1;

  return {
    phase,
    playlists,
    pool,
    currentTrack,
    roundNumber,
    results,
    totalScore,
    elapsed,
    wrongPicks,
    isLoading,
    isRetrying,
    retryCountdown,
    retryAttempt,
    playlistError,
    startGameError,
    fetchPlaylists,
    retryPlaylists,
    startGame,
    onPickTrack,
    giveUp,
    quitGame,
    newGame,
  };
}
