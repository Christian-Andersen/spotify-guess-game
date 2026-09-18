import type { SpotifyApi } from "@spotify/web-api-ts-sdk";

import { AuthOverlay } from "./components/AuthOverlay";
import { EndlessSummary } from "./components/EndlessSummary";
import { GameBoard } from "./components/GameBoard";
import { PlaylistPicker } from "./components/PlaylistPicker";
import { useGameLogic } from "./hooks/useGameLogic";
import { usePlayer } from "./hooks/usePlayer";
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
    positionMs,
    durationMs,
    error: playerError,
  } = usePlayer({
    getAccessToken: fetchAccessToken,
    enabled: true,
  });

  const game = useGameLogic({
    sdk,
    fetchAccessToken,
    play,
    pause,
    setRepeat,
    isPlayerReady,
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
        onPickTrack={game.onPickTrack}
        onGiveUp={game.giveUp}
        onQuit={game.quitGame}
        onSetVolume={setVolume}
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
