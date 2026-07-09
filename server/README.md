# RIVALS API (online backend)

A tiny, **zero-dependency** Node server that gives RIVALS a shared, persistent
head-to-head record and a global leaderboard. The game frontend stays static
(GitHub Pages) and talks to this API only when you point it at one.

Without this backend the game still works fully offline — challenge links just
embed the moves in the URL and stats stay on each device.

## What it stores

- **Players** — an id + display name, with win/loss/draw tallies.
- **Challenges** — a champion + a gauntlet of throws, addressed by a short id.
- **Games** — every completed challenge result (who beat whose gauntlet).
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

## Notes & limits

- **Trust model:** results are reported by the client, same as the offline
  link mode (which already exposes the gauntlet in the URL). Fine for friendly
  play. For competitive integrity, move judging server-side (the opponent
  submits moves, the server compares against the stored gauntlet).
- **Not real-time:** this is asynchronous play (set a gauntlet → a friend beats
  it later). True live matches would add a WebSocket layer + matchmaking.
- **Storage:** the JSON file keeps the last 5,000 games. Swap for a real DB for
  anything serious.
