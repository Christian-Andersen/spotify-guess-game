import { useSpotifyAuth } from "./hooks/useSpotifyAuth";
import { usePlayer } from "./hooks/usePlayer";
import { useGameLogic } from "./hooks/useGameLogic";
import { AuthOverlay } from "./components/AuthOverlay";
import { PlaylistPicker } from "./components/PlaylistPicker";
import { GameBoard } from "./components/GameBoard";
import { ScoreCard } from "./components/ScoreCard";
import type { SpotifyApi } from "@spotify/web-api-ts-sdk";

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
    error: playerError,
  } = usePlayer({
    getAccessToken: fetchAccessToken,
    enabled: true,
  });

  const game = useGameLogic({
    sdk,
    play,
    pause,
    isPlayerReady,
  });

  if (playerError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-lg font-semibold text-red-400">
            Playback Error
          </p>
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
        retryCountdown={game.retryCountdown}
        retryAttempt={game.retryAttempt}
        playlistError={game.playlistError}
        onFetchPlaylists={game.fetchPlaylists}
        onManualRetry={game.retryPlaylists}
        onStartGame={game.startGame}
        onLogout={onLogout}
      />
    );
  }

  if (game.phase === "score") {
    return (
      <ScoreCard
        totalScore={game.totalScore}
        maxPossibleScore={game.maxPossibleScore}
        results={game.results}
        onPlayAgain={game.resetGame}
      />
    );
  }

  if (
    game.currentTrack &&
    (game.phase === "loading" ||
      game.phase === "playing" ||
      game.phase === "guessing" ||
      game.phase === "revealing")
  ) {
    const lastResult =
      game.phase === "revealing"
        ? game.results[game.results.length - 1]
        : undefined;

    return (
      <GameBoard
        currentTrack={game.currentTrack}
        currentRoundIndex={game.currentRoundIndex}
        roundsTotal={game.roundsTotal}
        totalScore={game.totalScore}
        snippetDuration={game.snippetDuration}
        phase={game.phase}
        onPlaySnippet={game.playSnippet}
        onSubmitGuess={game.submitGuess}
        onNextRound={game.nextRound}
        lastGuess={lastResult?.guess}
        lastPoints={lastResult?.points}
        lastSimilarity={lastResult?.similarity}
        isPlayerReady={isPlayerReady}
      />
    );
  }

  return null;
}

export default function App() {
  const {
    sdk,
    isAuthenticated,
    login,
    logout,
    loading,
    error,
    fetchAccessToken,
  } = useSpotifyAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !sdk) {
    return <AuthOverlay onLogin={login} loading={false} error={error} />;
  }

  return (
    <GameApp sdk={sdk} onLogout={logout} fetchAccessToken={fetchAccessToken} />
  );
}