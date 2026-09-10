import { useState, useEffect, useCallback, useRef } from "react";

interface UsePlayerOptions {
  getAccessToken: () => Promise<string | null>;
  enabled: boolean;
}

export function usePlayer({ getAccessToken, enabled }: UsePlayerOptions) {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<SpotifyPlayer | null>(null);
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

      player.addListener("ready", () => {
        setIsReady(true);
      });

      player.addListener("not_ready", () => {
        setIsReady(false);
      });

      player.addListener("player_state_changed", (state) => {
        if (state) {
          setIsPlaying(!state.paused);
        }
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

  const play = useCallback(async (uris: string[], positionMs = 0) => {
    if (!playerRef.current) return;
    await playerRef.current.play({
      uris,
      position_ms: positionMs,
    });
  }, []);

  const pause = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.pause();
  }, []);

  const resume = useCallback(async () => {
    if (!playerRef.current) return;
    await playerRef.current.resume();
  }, []);

  const seek = useCallback(async (positionMs: number) => {
    if (!playerRef.current) return;
    await playerRef.current.seek(positionMs);
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    if (!playerRef.current) return;
    await playerRef.current.setVolume(volume);
  }, []);

  return {
    isReady,
    isPlaying,
    play,
    pause,
    resume,
    seek,
    setVolume,
    error,
  };
}