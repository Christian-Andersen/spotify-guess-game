# Spotify Guess Game

A single-player music guessing game that streams real Spotify tracks in the browser. Log in with your Spotify account, pick a playlist, and name the songs as they play.

## Features

- **Pure client-side PKCE OAuth** — no backend required (uses `@spotify/web-api-ts-sdk`)
- **In-browser streaming** via the Spotify Web Playback SDK (requires a **Spotify Premium** account)
- **Endless play** — the game shuffles your playlist and cycles through every track; a **Quit** button ends the session with a summary
- **Looping playback** — each track plays (looping) until you guess it or give up. No time-outs
- **Progressive clues** — nothing at first, then:
  - Artist at **10s**
  - Album art at **20s**
  - Album name at **30s**
- **Speed-based scoring** — guessing instantly is worth **10 points** and decays by 1 point per second (min 1); giving up scores 0
- **Fuzzy song picker** — search the playlist's tracks (fuse.js) and pick your guess from the list; wrong picks are flagged and you keep guessing
- **Score summary** at the end with total score, correct/gave-up counts, and round stats

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

> **Important:** You must browse to the _exact_ origin you registered. The app builds
> its redirect URI from `window.location.origin`, so accessing the app via
> `http://localhost:5173` while you registered `http://127.0.0.1:5173` will fail
> with `redirect_uri: Not matching configuration`. Loopback IPs (127.0.0.1)
> are the only ones allowed over HTTP; any other host requires HTTPS.
>
> The dashboard entry must also have **no trailing slash**: `window.location.origin`
> is always `http://127.0.0.1:5173`, so registering `http://127.0.0.1:5173/` will not
> match. Spotify compares the two strings character-for-character.

> **Note (February 2026 API migration):** Spotify moved playlist items from
> `GET /playlists/{id}/tracks` to `GET /playlists/{id}/items`; the old route now
> returns `403 Forbidden` for Development Mode apps. The published SDK (1.2.0)
> still calls the old route, so the app requests `/items` directly. The new route
> also only returns playlists you **own or collaborate on**, so pasting someone
> else's public playlist will return `403`.

> **Troubleshooting — sound won't start (403 on `check_scope` in the console):**
> the Web Playback SDK verifies your token carries the `streaming` scope before
> it plays anything; that request failing usually means the permission wasn't
> granted. The app checks this itself after every login: if the token can't
> drive playback it logs you out automatically (dropping the cached token) and
> explains why on the login screen, and every fresh login forces Spotify's
> consent screen (`show_dialog=true`) so the current scope set is always shown.
> If you were logged in before these checks existed, log out once and log back
> in, ticking the "play music and control playback" toggle on the approval
> screen. If the 403 _still_ appears, the console line
> `[spotify-auth] playback access: …` shows the granted scopes and Premium
> flag — a token with `streaming` + `premium=yes` that still 403s points at an
> app-dashboard/Web Playback entitlement issue, not the app's code.

## Architecture

```
src/
├── components/
│   ├── AuthOverlay.tsx      # Login screen with Spotify-branded entry
│   ├── PlaylistPicker.tsx   # Grid of your playlists + URL/ID input
│   ├── GameBoard.tsx        # Clue area, song progress, guess input, reveal
│   ├── SongPicker.tsx       # Fuzzy search + keyboard-navigable guess list
│   └── EndlessSummary.tsx   # End-of-session stats and restart
├── hooks/
│   ├── useSpotifyAuth.ts    # PKCE OAuth lifecycle + token provider
│   ├── usePlayer.ts         # Spotify Web Playback SDK wrapper (REST transport)
│   └── useGameLogic.ts      # Game state machine, pool cycling, scoring
├── lib/
│   ├── backoff.ts           # Retryable-error detection + exponential backoff
│   ├── constants.ts         # Clue timing, scoring, reveal delay
│   └── cn.ts                # clsx + tailwind-merge helper
└── types/
    └── index.ts             # Shared types (Track, RoundResult, GamePhase)
```

## Scopes Requested

- `streaming` — Web Playback SDK audio streaming
- `user-modify-playback-state` — start/pause/seek playback (required since the Web Playback SDK moved transport control to the Connect Web API)
- `playlist-read-private`, `playlist-read-collaborative` — read your playlists

## Scripts

| Script              | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the Vite dev server            |
| `npm run build`     | Type-check and bundle for production |
| `npm run preview`   | Preview the production build         |
| `npm run lint`      | Run oxlint                           |
| `npm run lint:fix`  | Run oxlint with autofix              |
| `npm run fmt`       | Format with oxfmt                    |
| `npm run fmt:check` | Check formatting with oxfmt          |
