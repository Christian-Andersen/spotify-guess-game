import type { SpotifyApi } from "@spotify/web-api-ts-sdk";

import { useState } from "react";

import { AuthOverlay } from "./components/AuthOverlay";
import { EndlessSummary } from "./components/EndlessSummary";
import { GameBoard } from "./components/GameBoard";
import { PlaylistPicker } from "./components/PlaylistPicker";
import { useGameLogic } from "./hooks/useGameLogic";
import { usePlaybackPosition, usePlayer } from "./hooks/usePlayer";
import { useSpotifyAuth } from "./hooks/useSpotifyAuth";

interface GameAppProps {
  sdk: SpotifyApi;
  onLogout: () => void;
  fetchAccessToken: () => Promise<string | null>;
}

function GameApp({ sdk, onLogout, fetchAccessToken }: GameAppProps) {
  const {
    isReady: isPlayerReady,
    play,
    pause,
    setRepeat,
    setVolume,
    error: playerError,
    getPlayer,
  } = usePlayer({
    getAccessToken: fetchAccessToken,
    enabled: true,
  });

  // Lifted above GameBoard (which is keyed by round and remounts each round)
  // so muting survives round changes — the SDK volume must stay in sync.
  const [muted, setMuted] = useState(false);
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    void setVolume(next ? 0 : 0.5);
  };

  const game = useGameLogic({
    sdk,
    fetchAccessToken,
    play,
    pause,
    setRepeat,
    isPlayerReady,
  });

  // Poll the SDK for playback position only during an active round.
  const { positionMs, durationMs } = usePlaybackPosition({
    isPlayerReady,
    active: game.phase === "playing",
    getPlayer,
  });

  if (playerError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-lg font-semibold text-red-400">Playback Error</p>
          <p className="text-neutral-400">{playerError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-neutral-800 px-6 py-3 text-white hover:bg-neutral-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (game.phase === "playlist") {
    return (
      <PlaylistPicker
        playlists={game.playlists}
        isLoading={game.isLoading}
        isRetrying={game.isRetrying}
        retryCountdown={game.retryCountdown}
        retryAttempt={game.retryAttempt}
        playlistError={game.playlistError}
        startError={game.startGameError}
        onFetchPlaylists={game.fetchPlaylists}
        onManualRetry={game.retryPlaylists}
        onStartGame={game.startGame}
        onLogout={onLogout}
      />
    );
  }

  if (game.phase === "summary") {
    return (
      <EndlessSummary
        results={game.results}
        totalScore={game.totalScore}
        onNewGame={game.newGame}
      />
    );
  }

  if (game.phase === "loading" || game.phase === "playing" || game.phase === "revealed") {
    const lastResult =
      game.phase === "revealed" ? game.results[game.results.length - 1] : undefined;

    return (
      <GameBoard
        key={game.roundNumber}
        pool={game.pool}
        currentTrack={game.currentTrack}
        roundNumber={game.roundNumber}
        totalScore={game.totalScore}
        elapsed={game.elapsed}
        wrongPicks={game.wrongPicks}
        phase={game.phase}
        lastResult={lastResult}
        isPlayerReady={isPlayerReady}
        positionMs={positionMs}
        durationMs={durationMs}
        muted={muted}
        onToggleMute={toggleMute}
        onPickTrack={game.onPickTrack}
        onGiveUp={game.giveUp}
        onQuit={game.quitGame}
      />
    );
  }

  return null;
}

export default function App() {
  const { sdk, isAuthenticated, login, logout, loading, error, fetchAccessToken } =
    useSpotifyAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !sdk) {
    return <AuthOverlay onLogin={login} error={error} />;
  }

  return <GameApp sdk={sdk} onLogout={logout} fetchAccessToken={fetchAccessToken} />;
}
