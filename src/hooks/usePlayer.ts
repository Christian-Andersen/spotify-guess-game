import { useState, useEffect, useCallback, useRef } from "react";

const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

interface UsePlayerOptions {
  getAccessToken: () => Promise<string | null>;
  enabled: boolean;
}

export function usePlayer({ getAccessToken, enabled }: UsePlayerOptions) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionMs, setPositionMs] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

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
            if (token) cb(token);
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

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setPositionMs(state.position);
        setDurationMs(state.track_window.current_track.duration_ms ?? null);
      });

      player.addListener("initialization_error", ({ message }) => {
        setError(`Player initialization failed: ${message}`);
      });

      player.addListener("authentication_error", ({ message }) => {
        setError(`Player auth failed: ${message}`);
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

      // The current Web Playback SDK no longer exposes `player.play()` —
      // start playback through the Connect Web API, targeted at this device.
      await player.activateElement();

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

      if (!res.ok) {
        setError(
          res.status === 403
            ? "Spotify denied playback. Log out and back in to grant the playback scope."
            : `Could not start playback (${res.status}). Is Spotify open?`,
        );
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

  // Poll the SDK for playback state: `player_state_changed` events don't
  // fire reliably for position updates, so track the bar via getCurrentState.
  useEffect(() => {
    if (!isReady) return;

    let disposed = false;
    const poll = async () => {
      const player = playerRef.current;
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
  }, [isReady]);

  return {
    isReady,
    play,
    pause,
    setRepeat,
    setVolume,
    positionMs,
    durationMs,
    error,
  };
}
