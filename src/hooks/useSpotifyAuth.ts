import {
  SpotifyApi,
  AuthorizationCodeWithPKCEStrategy,
  type AccessToken,
} from "@spotify/web-api-ts-sdk";
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
 * PKCE strategy that appends `show_dialog=true` to the authorize URL so
 * Spotify always shows the consent screen on a fresh login. Spotify skips the
 * prompt for previously-approved apps and can silently re-issue a token with
 * the *old* scope set — which is exactly how a login ends up missing the
 * `streaming` scope and the Web Playback SDK starts failing its scope check
 * (403 on `/melody/v1/check_scope?scope=web-playback`). The dialog only ever
 * shows during an actual redirect (cached/refreshable tokens skip it), so
 * repeat logins are unaffected.
 */
class ForceConsentPKCEStrategy extends AuthorizationCodeWithPKCEStrategy {
  protected override generateRedirectUrlForUser(
    scopes: string[],
    challenge: string,
  ): Promise<string> {
    return super.generateRedirectUrlForUser(scopes, challenge).then((url) => {
      const authorizeUrl = new URL(url);
      authorizeUrl.searchParams.set("show_dialog", "true");
      return authorizeUrl.toString();
    });
  }
}

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

interface TokenPayload {
  scp?: unknown;
  scope?: unknown;
  premium?: unknown;
}

/**
 * Decodes the JWT-style middle segment of a Spotify access token so the app
 * can see the scopes (`scp`/`scope`) and Premium flag (`premium`) it was
 * issued with. Purely diagnostic — never sent anywhere.
 */
function decodeTokenPayload(accessToken: string): TokenPayload | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as TokenPayload;
  } catch {
    return null;
  }
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value.split(/\s+/);
  return [];
}

type PlaybackAccess =
  | { ok: true; details: string }
  | { ok: false; details: string; message: string };

/**
 * Determines whether the granted token can drive the Web Playback SDK. Reads
 * the `scope` field the SDK's cache preserves (Spotify's token response
 * includes it even though the SDK's AccessToken type omits it) plus the JWT
 * claims, so a missing playback permission is caught here instead of as a
 * cryptic 403 from `/melody/v1/check_scope?scope=web-playback` later.
 */
function evaluatePlaybackAccess(token: AccessToken): PlaybackAccess {
  const rawScope = (token as { scope?: unknown }).scope;
  const payload = decodeTokenPayload(token.access_token);

  const granted = new Set([
    ...stringList(rawScope),
    ...stringList(payload?.scp),
    ...stringList(payload?.scope),
  ]);

  const hasStreaming = granted.has("streaming");
  const premiumKnown = payload?.premium === 0 || payload?.premium === 1;

  const parts: string[] = [
    granted.size > 0 ? `scopes=${[...granted].join(",")}` : "scopes=<unknown>",
  ];
  if (premiumKnown) parts.push(`premium=${payload?.premium ? "yes" : "no"}`);
  const details = parts.join(" ");

  if (!hasStreaming) {
    return {
      ok: false,
      details,
      message:
        "Logging out: the Spotify token lacks the 'streaming' scope the player needs. Log in again and accept the playback permission.",
    };
  }
  if (premiumKnown && payload?.premium !== 1) {
    return {
      ok: false,
      details,
      message:
        "Logging out: this Spotify account doesn't include Premium, which Web Playback requires.",
    };
  }
  return { ok: true, details };
}

/**
 * Builds an authenticated SDK, transparently recovering from a stale
 * authorize-redirect callback: it clears the leftover query params and
 * re-runs the PKCE flow from scratch. After a successful login it also
 * verifies the granted token can drive playback (streaming scope + Premium)
 * and — importantly — drops the cached token when it can't, so the next
 * login attempt actually redirects to Spotify instead of silently re-using
 * the broken grant.
 */
async function createAuthenticatedSdk(): Promise<SpotifyApi | null> {
  const sdk = new SpotifyApi(new ForceConsentPKCEStrategy(CLIENT_ID, REDIRECT_URI, SCOPES));

  const { authenticated } = await sdk.authenticate().catch(async (error: unknown) => {
    if (!isNoVerifierError(error)) throw error;
    clearCallbackParams();
    return sdk.authenticate();
  });

  if (!authenticated) return null;
  clearCallbackParams();

  const token = await sdk.getAccessToken();
  if (!token) return null;

  const playback = evaluatePlaybackAccess(token);
  // Diagnostic: share this line if a 403 on check_scope still appears.
  console.info("[spotify-auth] playback access:", playback.details);

  if (!playback.ok) {
    // A still-valid cached token would make the next authenticate() skip the
    // redirect (and the forced-consent dialog) and hand the same broken
    // token to the player — remove it first so login really re-authorizes.
    sdk.logOut();
    throw new Error(playback.message);
  }

  return sdk;
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
        // anything reaching here is unexpected — surface it on the login screen.
        if (!isNoVerifierError(e)) {
          console.error("Spotify auth error:", e);
          setError(e instanceof Error ? e.message : "Spotify login failed. Try again.");
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
      setError(e instanceof Error ? e.message : "Login failed. Please try again.");
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
