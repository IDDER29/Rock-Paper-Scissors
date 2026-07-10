# RIVALS API (online backend)

A **zero-dependency** Node server (uses Node's built-in `node:sqlite`) that
gives RIVALS accounts, a persistent head-to-head record, and a global
leaderboard. The game frontend stays static
(GitHub Pages) and talks to this API only when you point it at one.

Without this backend the game still works fully offline — challenge links just
embed the moves in the URL and stats stay on each device.

## What it does

- **Players** — an id + display name, with win/loss/draw tallies.
- **Challenges** — a champion + a gauntlet of throws, addressed by a short id.
- **Live rooms** — real-time 1v1 matches over Server-Sent Events (invite a
  friend, or **Quick Match** to pair with a random waiting player). The server
  collects both players' moves each round and only reveals once both are in,
  so play is **server-authoritative and cheat-proof**.
- **Elo ratings** — every completed game updates both players' ratings
  (chess-style: start 1200, K=32, zero-sum, floor 100). Returned in the result
  response and the live `round` event so clients can show the gain/loss.
- **Games** — every completed result (challenge or live).
- Derived on read: **head-to-head records** and the **Elo-ranked global
  leaderboard**.

Data is persisted in a **SQLite** file (`server/rivals.db` by default) — set
`DB_FILE` to relocate it. A one-time import from an old `data.json` runs
automatically. For very high concurrency, move to managed Postgres + Redis.

## Run locally

```bash
node server/server.js          # listens on :8787 (SQLite at server/rivals.db)
# choose a port / db location:
PORT=9000 DB_FILE=/data/rivals.db node server/server.js
# node:sqlite prints a harmless experimental warning; silence with NODE_NO_WARNINGS=1
```

Then set the frontend to use it — edit `js/config.js`:

```js
export const API_BASE = "http://localhost:8787";
```

Open the game over `http://localhost` (not `file://`) and online features light up.

## Deploy (pick one free host)

The API is a single file with no dependencies, so almost anything works.
It **must be served over HTTPS** in production (GitHub Pages is HTTPS, and
browsers block calls from HTTPS pages to plain HTTP).

| Host | How |
| --- | --- |
| **Render** | New → Web Service → build: *(none)* → start: `node server/server.js`. Add a persistent disk so the SQLite file survives redeploys, and set `DB_FILE` to a path on it. |
| **Fly.io** | `fly launch` (Node), start command `node server/server.js`, attach a volume and set `DB_FILE` to it. |
| **Railway / Cyclic** | New project from repo, start command `node server/server.js`. |
| **Deno Deploy / Cloudflare Workers** | Works too, but the SQLite store needs swapping for their KV/storage (the HTTP routes are easy to port). |

After deploying, put the public URL in `js/config.js`:

```js
export const API_BASE = "https://your-rivals-api.onrender.com";
```

Commit that and your GitHub Pages build is now online. CORS is already open
(`Access-Control-Allow-Origin: *`) so the Pages origin can call it.

## Endpoints

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| `GET` | `/` | — | health + counts |
| `POST` | `/api/signup` | `{username, password, name}` | account + `{id, name, token, rating}` |
| `POST` | `/api/login` | `{username, password}` | `{id, name, token, rating}` (cross-device) |
| `POST` | `/api/player` | `{name, id?}` | guest identity `{id, name, token}` |
| `POST` | `/api/challenge` | `{challengerId, name, champId, moves[]}` | `{id}` |
| `GET` | `/api/challenge/:id` | — | `{challengerId, name, champId, moves}` |
| `POST` | `/api/result` | `{challengeId, opponentId, opponentName, champId, pScore, cScore}` | `{rivalry, challengerName, challengerId}` |
| `GET` | `/api/rivalries` | `?player=id` | `{rivalries:[…]}` |
| `GET` | `/api/leaderboard` | `?limit=` | `{leaderboard:[…]}` |
| `POST` | `/api/matchmake` | `{playerId, name, champId, target}` | `{roomId, paired}` (pair with a random waiting player, or open a public room) |
| `POST` | `/api/room` | `{playerId, name, champId, target}` | `{roomId}` (create private live room) |
| `GET` | `/api/room/:id` | — | room snapshot (for the join screen) |
| `POST` | `/api/room/:id/join` | `{playerId, name, champId}` | `{ok, target}` |
| `GET` | `/api/room/:id/events` | `?player=id` | **SSE** stream: `state` + `round` events |
| `POST` | `/api/room/:id/move` | `{playerId, move}` | `{ok}` (server reveals when both are in) |
| `POST` | `/api/room/:id/leave` | `{playerId}` | `{ok}` |

## Security model

- **Auth:** every player gets a bearer **token** on registration (returned from
  `/api/player`). All mutating endpoints require it (`Authorization: Bearer …`)
  and verify it matches the acting `playerId`, so you can't impersonate or
  submit results as another player. (Trust-on-first-use — good enough without a
  full accounts system; upgrade to real accounts for cross-device identity.)
- **Only server-judged games are rated.** Live / Quick-Match rounds resolve on
  the server once both moves are in, so they're cheat-proof and **rated**.
  Async **challenge results are client-reported and therefore UNRATED** — they
  record a casual W/L + head-to-head but never touch Elo, so scores can't be
  faked to climb the ladder.
- **Input hardening:** display names are stripped of HTML/control characters
  server-side (and escaped client-side); request bodies are size-capped.
- **Rate limiting:** ~100 requests / 10s / IP (429 on exceed).

## Notes & limits
- **Hosting for live:** Server-Sent Events need a host that doesn't buffer
  responses (Render, Fly, Railway all work; the server sets `X-Accel-Buffering:
  no`). Serverless platforms with short request limits may cut SSE streams.
- **Storage:** completed games and accounts persist in the SQLite file; live
  rooms are held in memory (idle rooms are reaped). For very high concurrency,
  move to managed Postgres + Redis.
