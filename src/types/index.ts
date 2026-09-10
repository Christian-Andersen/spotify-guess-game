export type GamePhase =
  | "auth"
  | "playlist"
  | "loading"
  | "playing"
  | "guessing"
  | "revealing"
  | "score";

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
  guess: string;
  points: number;
  similarity: number;
  wasExact: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  image: string;
  trackCount: number;
  owner: string;
}
