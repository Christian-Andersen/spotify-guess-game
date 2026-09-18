import { SpotifyApi, AuthorizationCodeWithPKCEStrategy } from "@spotify/web-api-ts-sdk";
import { useCallback, useEffect, useRef, useState } from "react";

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = window.location.origin;

const SCOPES = [
  "streaming",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
];

const NO_VERIFIER_SUBSTRING = "No verifier found in cache";

/**
 * Strips the `?code=...` params the Spotify authorize redirect leaves behind.
 *
 * The PKCE strategy stores its code verifier as a *single-use* cache item
 * (`expiresOnAccess`), so once it has been read — even by an exchange attempt
 * that then failed or was interrupted — any later `authenticate()` on the
 * callback page throws "No verifier found in cache" and the app is stuck on
 * the login screen forever. Removing the stale params lets the flow restart
 * from a clean state.
 */
function clearCallbackParams(): void {
  const url = new URL(window.location.href);
  if (!url.search) return;
  url.search = "";
  window.history.replaceState({}, "", url.toString());
}

function isNoVerifierError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.includes(NO_VERIFIER_SUBSTRING);
}

/**
 * Builds an authenticated SDK, transparently recovering from a stale
 * authorize-redirect callback: it clears the leftover query params and
 * re-runs the PKCE flow from scratch.
 */
async function createAuthenticatedSdk(): Promise<SpotifyApi | null> {
  const sdk = new SpotifyApi(
    new AuthorizationCodeWithPKCEStrategy(CLIENT_ID, REDIRECT_URI, SCOPES),
  );

  const { authenticated } = await sdk.authenticate().catch(async (error: unknown) => {
    if (!isNoVerifierError(error)) throw error;
    clearCallbackParams();
    return sdk.authenticate();
  });

  if (authenticated) clearCallbackParams();
  return authenticated ? sdk : null;
}

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
  // StrictMode double-invokes effects in dev; running the PKCE flow twice in
  // the same tick would consume the single-use verifier twice and can loop
  // the authorize redirect, so only the first invocation attempts it.
  const authAttemptedRef = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || authAttemptedRef.current) return;
    authAttemptedRef.current = true;

    createAuthenticatedSdk()
      .then((internalSdk) => {
        if (!internalSdk) return;
        sdkRef.current = internalSdk;
        setSdk(internalSdk);
        setIsAuthenticated(true);
      })
      .catch((e: unknown) => {
        // Transient verifier errors are handled inside createAuthenticatedSdk;
        // anything reaching here is unexpected.
        if (!isNoVerifierError(e)) console.error("Spotify auth error:", e);
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

    try {
      const internalSdk = await createAuthenticatedSdk();
      if (internalSdk) {
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
