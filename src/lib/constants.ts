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
