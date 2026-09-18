interface SpotifyPlayerEventCallbacks {
  ready: (data: { device_id: string }) => void;
  not_ready: (data: { device_id: string }) => void;
  player_state_changed: (state: SpotifyPlayerState | null) => void;
  initialization_error: (data: { message: string }) => void;
  authentication_error: (data: { message: string }) => void;
  account_error: (data: { message: string }) => void;
  playback_error: (data: { message: string }) => void;
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener<T extends keyof SpotifyPlayerEventCallbacks>(
    event: T,
    callback: SpotifyPlayerEventCallbacks[T],
  ): void;
  removeListener<T extends keyof SpotifyPlayerEventCallbacks>(
    event: T,
    callback: SpotifyPlayerEventCallbacks[T],
  ): void;
  // Note: the current Web Playback SDK no longer exposes `play()` —
  // starting playback is done via the Connect Web API (`PUT /me/player/play`).
  pause(): Promise<void>;
  resume(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  activateElement(): Promise<void>;
}

interface SpotifyPlayerTrack {
  id: string;
  uri: string;
  name: string;
  artists: { name: string; uri: string }[];
  album: {
    name: string;
    uri: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
}

interface SpotifyPlayerState {
  context: { uri: string | null };
  disallows: {
    resuming: boolean;
    skipping_prev: boolean;
    skipping_next: boolean;
  };
  paused: boolean;
  position: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: SpotifyPlayerTrack;
    previous_tracks: SpotifyPlayerTrack[];
    next_tracks: SpotifyPlayerTrack[];
  };
}

interface SpotifyPlayerConstructor {
  new (options: {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }): SpotifyPlayer;
}

interface SpotifyStatic {
  Player: SpotifyPlayerConstructor;
}

interface Window {
  Spotify: SpotifyStatic;
  onSpotifyWebPlaybackSDKReady: () => void;
}
