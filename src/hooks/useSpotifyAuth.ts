import { SpotifyApi, AuthorizationCodeWithPKCEStrategy } from "@spotify/web-api-ts-sdk";
import { useState, useEffect, useCallback, useRef } from "react";

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = window.location.origin;

const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
];

export function useSpotifyAuth() {
  const [sdk, setSdk] = useState<SpotifyApi | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Derive error/loading from the env var instead of setting state in an effect
  const [loading, setLoading] = useState(() => Boolean(CLIENT_ID));
  const [error, setError] = useState<string | null>(() =>
    CLIENT_ID
      ? null
      : "Missing VITE_SPOTIFY_CLIENT_ID. Create a .env file with your Spotify app client ID.",
  );
  const sdkRef = useRef<SpotifyApi | null>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;

    const auth = new AuthorizationCodeWithPKCEStrategy(CLIENT_ID, REDIRECT_URI, SCOPES);
    const internalSdk = new SpotifyApi(auth);

    internalSdk
      .authenticate()
      .then(({ authenticated }) => {
        if (authenticated) {
          sdkRef.current = internalSdk;
          setSdk(internalSdk);
          setIsAuthenticated(true);
        }
      })
      .catch((e: unknown) => {
        const err = e as Error;
        if (err?.message?.includes("No verifier found in cache")) {
          console.warn("PKCE verifier consumed (StrictMode dev artifact):", err.message);
        } else {
          console.error("Spotify auth error:", e);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async () => {
    if (!CLIENT_ID) {
      setError("Missing VITE_SPOTIFY_CLIENT_ID");
      return;
    }

    const auth = new AuthorizationCodeWithPKCEStrategy(CLIENT_ID, REDIRECT_URI, SCOPES);
    const internalSdk = new SpotifyApi(auth);

    try {
      const { authenticated } = await internalSdk.authenticate();
      if (authenticated) {
        sdkRef.current = internalSdk;
        setSdk(internalSdk);
        setIsAuthenticated(true);
        setError(null);
      }
    } catch (e) {
      console.error("Login failed:", e);
      setError("Login failed. Please try again.");
    }
  }, []);

  const logout = useCallback(() => {
    sdk?.logOut();
    sdkRef.current = null;
    setSdk(null);
    setIsAuthenticated(false);
  }, [sdk]);

  const fetchAccessToken = useCallback(async (): Promise<string | null> => {
    const currentSdk = sdkRef.current;
    if (!currentSdk) return null;
    const token = await currentSdk.getAccessToken();
    return token?.access_token ?? null;
  }, []);

  return {
    sdk,
    isAuthenticated,
    login,
    logout,
    loading,
    error,
    fetchAccessToken,
  };
}
