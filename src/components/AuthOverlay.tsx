import { Music } from "lucide-react";

interface AuthOverlayProps {
  onLogin: () => void;
  error: string | null;
}

export function AuthOverlay({ onLogin, error }: AuthOverlayProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-green-500/20 blur-2xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-500">
            <Music className="h-12 w-12 text-black" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">
            Guess the <span className="text-green-400">Song</span>
          </h1>
          <p className="text-lg text-neutral-400">
            Listen to snippets. Name the track. How well do you know your playlists?
          </p>
        </div>

        {error && (
          <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onLogin}
          className="flex items-center gap-3 rounded-full bg-green-500 px-8 py-4 text-lg font-bold text-black transition-all hover:bg-green-400 hover:shadow-lg hover:shadow-green-500/25 active:scale-95"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Login with Spotify
        </button>

        <p className="max-w-sm text-xs text-neutral-500">
          Requires a Spotify Premium account for in-browser playback.
          <br />
          Your credentials are never stored on any server.
        </p>
      </div>
    </div>
  );
}
