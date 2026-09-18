export type GamePhase = "playlist" | "loading" | "playing" | "revealed" | "summary";

export interface Track {
  id: string;
  name: string;
  artists: string;
  album: string;
  albumArt: string;
  duration_ms: number;
  uri: string;
}

export interface RoundResult {
  track: Track;
  points: number;
  correct: boolean;
  elapsedSeconds: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  image: string;
  trackCount: number;
  owner: string;
}
