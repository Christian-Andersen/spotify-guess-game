export interface BackoffConfig {
  baseDelayMs?: number;
  maxDelayMs?: number;
  minDelayMs?: number;
  factor?: number;
  jitter?: boolean;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

function extractMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

// The Spotify SDK surfaces rate limits as plain Errors with no `status` on
// the object, only a message like "The app has exceeded its rate limits."
// Quota hits (July 2026+) instead return a body with `reason: "QUOTA_EXCEEDED"`.
const THROTTLE_PATTERN = /rate\s*limit|too\s*many\s*requests|rate\s*limited|quota\s*exceeded/i;

function extractReason(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const body = (err as { body?: unknown }).body;
  if (body && typeof body === "object") {
    const reason = (body as { reason?: unknown }).reason;
    if (typeof reason === "string") return reason;
  }
  return undefined;
}

function extractRetryAfterMs(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const body = (err as { body?: unknown }).body;
  if (body && typeof body === "object") {
    const retryAfter = (body as { retry_after?: unknown }).retry_after;
    if (typeof retryAfter === "number") return retryAfter * 1000;
    // Spotify also uses a lowercase `retry_after` in minutes on rare 429s
    const minutes = (body as { retryAfterMinutes?: unknown }).retryAfterMinutes;
    if (typeof minutes === "number") return Math.min(minutes * 60 * 1000, 5 * 60 * 1000);
  }
  return undefined;
}

/**
 * Whether a failed API call should be retried at all.
 * Retry: 429 (rate limited), 5xx (server), or transport-level failures.
 * Stop: 4xx (auth/validation/permission) — retrying won't help.
 */
export function isRetryableError(err: unknown): boolean {
  const status = extractStatus(err);
  if (status === undefined) {
    // The SDK often strips the status; fall back to name/message/reason
    // matching to distinguish throttling (retry) from auth/validation (stop).
    const name = (err as { name?: string } | null)?.name ?? "";
    if (name === "TypeError" || name === "TimeoutError" || name === "AbortError") {
      return true;
    }
    const reason = extractReason(err);
    if (reason === "QUOTA_EXCEEDED") return true;
    return THROTTLE_PATTERN.test(`${extractMessage(err)} ${reason ?? ""}`);
  }
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Tracks consecutive failures and yields an ever-increasing wait time,
 * capped at `maxDelayMs` with optional full jitter. Honors the server's
 * `Retry-After` hint when present.
 */
export function createExponentialBackoff(config?: BackoffConfig) {
  const baseDelayMs = config?.baseDelayMs ?? 1000;
  // Spotify's rate limit sits on a rolling 30s window, so the cap must
  // exceed that to give the window room to fully clear between attempts.
  const maxDelayMs = config?.maxDelayMs ?? 60000;
  const minDelayMs = config?.minDelayMs ?? 500;
  const factor = config?.factor ?? 2;
  const jitter = config?.jitter ?? true;
  let attempt = 0;

  const nextDelayMs = (err?: unknown): number => {
    const retryAfter = extractRetryAfterMs(err);
    if (retryAfter !== undefined) {
      attempt += 1;
      return Math.min(Math.max(retryAfter, minDelayMs), maxDelayMs);
    }
    const base = Math.min(baseDelayMs * Math.pow(factor, attempt), maxDelayMs);
    attempt += 1;
    if (!jitter) return Math.max(minDelayMs, base);
    // Equal jitter: delay in [base/2, base). Once `base` hits maxDelayMs the
    // wait is guaranteed >= maxDelayMs/2, so sparing Spotify's 30s rolling
    // window becomes a guarantee rather than a matter of luck.
    const jittered = base / 2 + Math.floor(Math.random() * (base / 2));
    return Math.max(minDelayMs, jittered);
  };

  const reset = (): void => {
    attempt = 0;
  };

  return { nextDelayMs, reset };
}
