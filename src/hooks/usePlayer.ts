import { useState, useEffect, useCallback, useRef } from "react";

import { sleep } from "../lib/backoff";
import { FIRST_PLAY_STALL_MS, FIRST_PLAY_VERIFY_MS, FIRST_PLAY_WARMUP_MS } from "../lib/constants";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

interface UsePlayerOptions {
  getAccessToken: () => Promise<string | null>;
  enabled: boolean;
}

/**
 * Starts playback on the given device via the Connect Web API. Returns the
 * HTTP status so callers can distinguish the 403 "scope not granted" case.
 */
async function startPlayback(
  deviceId: string,
  token: string,
  uris: string[],
  positionMs: number,
): Promise<number> {
  const res = await fetch(
    `${SPOTIFY_API_BASE}/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris, position_ms: positionMs }),
    },
  );
  return res.status;
}

/**
 * Watches the very first play of a session: once playback is ~2s old, if the
 * SDK still reports no state, or a paused state that never progressed past
 * FIRST_PLAY_STALL_MS, the opening stream cut early — start it once more.
 * (A healthy first play is well past the threshold by then, so it's never
 * restarted.)
 */
async function recoverIfStalledFirstPlay(
  player: SpotifyPlayer,
  deviceId: string,
  getAccessToken: () => Promise<string | null>,
  uris: string[],
  positionMs: number,
): Promise<void> {
  await sleep(FIRST_PLAY_VERIFY_MS);
  const state = await player.getCurrentState().catch(() => null);
  if (state && !state.paused) return;
  if (state && state.position > FIRST_PLAY_STALL_MS) return;

  const token = await getAccessToken();
  if (!token) return;
  await player.activateElement();
  await startPlayback(deviceId, token, uris, positionMs);
}

export function usePlayer({ getAccessToken, enabled }: UsePlayerOptions) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  // The first play of a session gets the warmup + stall recovery; later plays
  // go straight through. `firstPlayRetriedRef` stops recovery from looping if
  // the retry also fails.
  const hasPlayedRef = useRef(false);
  const firstPlayRetriedRef = useRef(false);

  useEffect(() => {
    if (!enabled || playerRef.current) return;

    let disposed = false;

    // Avoid loading script multiple times
    if (!scriptRef.current) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
      scriptRef.current = script;
    }

    const onSDKReady = () => {
      if (disposed) return;

      const player = new window.Spotify.Player({
        name: "Spotify Guess Game",
        getOAuthToken: (cb) => {
          getAccessToken().then((token) => {
            if (token) {
              cb(token);
              return;
            }
            setError("Could not fetch a Spotify token. Log out and back in.");
          });
        },
        volume: 0.5,
      });

      player.addListener("ready", ({ device_id }) => {
        deviceIdRef.current = device_id;
        setIsReady(true);
      });

      player.addListener("not_ready", () => {
        deviceIdRef.current = null;
        setIsReady(false);
      });

      player.addListener("initialization_error", ({ message }) => {
        setError(`Player initialization failed: ${message}`);
      });

      player.addListener("authentication_error", ({ message }) => {
        setError(`Player auth failed: ${message}`);
      });

      player.addListener("account_error", ({ message }) => {
        setError(`Account can't use Web Playback: ${message}`);
      });

      player.addListener("playback_error", ({ message }) => {
        setError(`Playback error: ${message}`);
      });

      player.connect().then((success) => {
        if (success) {
          setError(null);
        } else {
          setError("Could not connect to Spotify. Is Spotify open?");
        }
      });

      playerRef.current = player;
    };

    if (window.Spotify) {
      onSDKReady();
    } else {
      window.onSpotifyWebPlaybackSDKReady = onSDKReady;
    }

    return () => {
      disposed = true;
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [getAccessToken, enabled]);

  const play = useCallback(
    async (uris: string[], positionMs = 0) => {
      const player = playerRef.current;
      const deviceId = deviceIdRef.current;
      const token = await getAccessToken();
      if (!player || !token || !deviceId) return;

      const firstPlay = !hasPlayedRef.current;

      // The current Web Playback SDK no longer exposes `player.play()` —
      // start playback through the Connect Web API, targeted at this device.
      await player.activateElement();

      // The very first play of a session races the transport settling after
      // `ready` (and the activateElement() above), which can cut the opening
      // stream ~1s in — wait briefly so it finishes establishing.
      if (firstPlay) await sleep(FIRST_PLAY_WARMUP_MS);

      const status = await startPlayback(deviceId, token, uris, positionMs);
      if (status < 200 || status >= 300) {
        setError(
          status === 403
            ? "Spotify denied playback. Log out and back in to grant the playback scope."
            : `Could not start playback (${status}). Is Spotify open?`,
        );
        return;
      }

      if (firstPlay) {
        hasPlayedRef.current = true;
        if (!firstPlayRetriedRef.current) {
          firstPlayRetriedRef.current = true;
          void recoverIfStalledFirstPlay(player, deviceId, getAccessToken, uris, positionMs);
        }
      }
    },
    [getAccessToken],
  );

  const pause = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.pause();
  }, []);

  // Repeat keeps the current track looping until the round is answered.
  const setRepeat = useCallback(
    async (state: "track" | "off") => {
      const deviceId = deviceIdRef.current;
      const token = await getAccessToken();
      if (!deviceId || !token) return;
      await fetch(
        `${SPOTIFY_API_BASE}/me/player/repeat?state=${state}&device_id=${encodeURIComponent(deviceId)}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    },
    [getAccessToken],
  );

  const setVolume = useCallback(async (volume: number) => {
    if (!playerRef.current) return;
    await playerRef.current.setVolume(volume);
  }, []);

  const getPlayer = useCallback(() => playerRef.current, []);

  return {
    isReady,
    play,
    pause,
    setRepeat,
    setVolume,
    getPlayer,
    error,
  };
}

/**
 * Polls the Web Playback SDK for the current position/duration so the game
 * can render a whole-song progress bar. `player_state_changed` events don't
 * fire reliably for position updates, so we call `getCurrentState()` once a
 * second — and only while a round is actively playing.
 */
export function usePlaybackPosition({
  isPlayerReady,
  active,
  getPlayer,
}: {
  isPlayerReady: boolean;
  active: boolean;
  getPlayer: () => SpotifyPlayer | null;
}): { positionMs: number | null; durationMs: number | null } {
  const [positionMs, setPositionMs] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlayerReady || !active) return;

    let disposed = false;
    const poll = async () => {
      const player = getPlayer();
      if (!player) return;
      try {
        const state = await player.getCurrentState();
        if (disposed || !state) return;
        setPositionMs(state.position);
        setDurationMs(state.track_window.current_track.duration_ms ?? null);
      } catch {
        // Ignore transient SDK failures during polling.
      }
    };

    void poll();
    const id = setInterval(() => void poll(), 1000);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [isPlayerReady, active, getPlayer]);

  return { positionMs, durationMs };
}
