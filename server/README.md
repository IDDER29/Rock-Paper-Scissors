# RIVALS API (online backend)

A tiny, **zero-dependency** Node server that gives RIVALS a shared, persistent
head-to-head record and a global leaderboard. The game frontend stays static
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
- **Games** — every completed result (challenge or live).
- Derived on read: **head-to-head records** and the **global leaderboard**.

Data is persisted to a JSON file (`server/data.json` by default). No database
to set up. For higher scale, swap the JSON store for SQLite/Postgres later.

## Run locally

```bash
node server/server.js          # listens on :8787
# or choose a port / data file:
PORT=9000 DATA_FILE=/data/rivals.json node server/server.js
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
| **Render** | New → Web Service → build: *(none)* → start: `node server/server.js`. Add a persistent disk if you want data to survive redeploys, and set `DATA_FILE` to a path on it. |
| **Fly.io** | `fly launch` (Node), start command `node server/server.js`, attach a volume and set `DATA_FILE` to it. |
| **Railway / Cyclic** | New project from repo, start command `node server/server.js`. |
| **Deno Deploy / Cloudflare Workers** | Works too, but the JSON-file store needs swapping for their KV/storage (the HTTP routes are easy to port). |

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
| `POST` | `/api/player` | `{name, id?}` | `{id, name}` |
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

## Notes & limits

- **Live matches are server-authoritative:** each round resolves only when both
  players' moves are in, so neither client can see the other's move early —
  cheat-proof by construction.
- **Async challenge results are client-reported** (same trust level as the
  offline link mode, which already puts the gauntlet in the URL). Fine for
  friendly play; for competitive integrity, judge those server-side too.
- **Hosting for live:** Server-Sent Events need a host that doesn't buffer
  responses (Render, Fly, Railway all work; the server sets `X-Accel-Buffering:
  no`). Serverless platforms with short request limits may cut SSE streams.
- **Storage:** the JSON file keeps the last 5,000 games and holds live rooms in
  memory (idle rooms are reaped). Swap for a real DB for anything serious.
