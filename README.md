# Spotify Guess Game

A single-player music guessing game that streams real Spotify tracks in the browser. Log in with your Spotify account, pick a playlist, and name the songs from short audio snippets.

## Features

- **Pure client-side PKCE OAuth** — no backend required (uses `@spotify/web-api-ts-sdk`)
- **In-browser streaming** via the Spotify Web Playback SDK (requires a **Spotify Premium** account)
- **10 random tracks** selected from any of your playlists (or paste a playlist URL)
- **8-second snippets** at random timestamps with auto-pause
- **Smart title normalization** that strips remaster tags, "feat." credits, and punctuation so official metadata clutter never breaks a correct answer
- **Fuzzy matching** (fuse.js) that gives partial credit for typos and partial guesses:
  - Perfect match: **+3**
  - Close match (≥80% similarity): **+2**
  - Partial match (≥50%): **+1**
- **Score summary** at the end with per-round results and replay

## Getting Started

### 1. Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
2. Add a redirect URI. Spotify requires an **explicit loopback IP** for local development (`localhost` is not allowed and HTTP is only permitted for loopback addresses):
   - `http://127.0.0.1:5173` (Vite default port)
3. Copy the **Client ID**.

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Client ID:

```bash
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id_here
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173` (match the loopback IP you registered — not `localhost`), log in with Spotify, and accept the streaming + playlist scopes.

> **Important:** You must browse to the *exact* origin you registered. The app builds
> its redirect URI from `window.location.origin`, so accessing the app via
> `http://localhost:5173` while you registered `http://127.0.0.1:5173` will fail
> with `redirect_uri: Not matching configuration`. Loopback IPs (127.0.0.1 / ::1)
> are the only ones allowed over HTTP; any other host requires HTTPS.

## Architecture

```
src/
├── components/
│   ├── AuthOverlay.tsx      # Login screen with Spotify-branded entry
│   ├── PlaylistPicker.tsx   # Grid of your playlists + URL/ID input
│   ├── GameBoard.tsx        # Snippet player, timer, guess input, reveal
│   └── ScoreCard.tsx        # Final score, grade, per-round recap
├── hooks/
│   ├── useSpotifyAuth.ts    # PKCE OAuth lifecycle + token provider
│   ├── usePlayer.ts         # Spotify Web Playback SDK wrapper
│   └── useGameLogic.ts      # Game state machine, track selection, scoring
├── lib/
│   ├── normalizer.ts        # Title cleanup (remasters, feat., punctuation)
│   └── matching.ts          # fuse.js-based fuzzy scoring
└── types/
    └── index.ts             # Shared types (Track, RoundResult, GamePhase)
```

## Scopes Requested

- `streaming` — Web Playback SDK audio streaming
- `user-read-email`, `user-read-private` — profile access
- `playlist-read-private`, `playlist-read-collaborative` — read your playlists

## Scripts

| Script            | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server             |
| `npm run build`   | Type-check and bundle for production  |
| `npm run preview` | Preview the production build          |
| `npm run lint`    | Run oxlint                            |