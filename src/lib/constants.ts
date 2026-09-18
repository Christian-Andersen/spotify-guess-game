// Clue reveal timeline (seconds of listening per round).
export const ARTIST_CLUE_AT_S = 10;
export const ALBUM_ART_CLUE_AT_S = 20;
export const ALBUM_NAME_CLUE_AT_S = 30;

// Time-based scoring: guessing instantly is worth MAX_ROUND_POINTS and
// decays by 1 point per second, down to a minimum of MIN_ROUND_POINTS.
export const MAX_ROUND_POINTS = 10;
export const MIN_ROUND_POINTS = 1;

// How long the answer stays on screen before the next round starts.
export const REVEAL_DELAY_MS = 2500;

// First-play stabilization for the Web Playback SDK. The SDK's transport
// settles a moment after `ready`, and the first `activateElement()` call can
// briefly interrupt it — so the very first play of a session gets a short
// warmup and, if the stream still stalls (it can cut ~1s in), the app checks
// once ~2s later and restarts it. Later plays are unaffected.
export const FIRST_PLAY_WARMUP_MS = 800;
export const FIRST_PLAY_VERIFY_MS = 2000;
export const FIRST_PLAY_STALL_MS = 1500;
