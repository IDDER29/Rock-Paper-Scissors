# RIVALS — Rock · Paper · Scissors

A premium take on Rock Paper Scissors. Pick your champion, read your rival,
level up, and challenge your friends. Built as a fast, installable,
self‑contained static web app — no framework, no build step, no backend.

**Play:** https://idder29.github.io/Rock-Paper-Scissors/

## Features

### Play
- **Five ways to play**
  - **vs Rival** — face the AI.
  - **Pass & Play** — two players share one device.
  - **Challenge** — set a gauntlet of throws and send a friend a link to beat.
  - **Live** — real-time 1v1 with a friend: share an invite link and play
    simultaneous, server-judged rounds.
  - **Quick Match** — get paired with a **random opponent online**, no link
    needed. (Live and Quick Match need the backend running.)
- **Five AI personalities**, each with a readable "tell" and star difficulty:
  Rookie, Mirror (copies your last move), Duelist (pure chance),
  Cycler (rotates its throws), and Grandmaster (counters your patterns).
- **Best‑of matches** — first to 3, 5, or 7.
- **Animated duels** — "Rock… Paper… Scissors… Shoot!" countdown, hand reveal,
  per‑round verdicts, and a round‑history timeline.
- **Post‑match "reads"** — the rival explains how it read you (your favourite
  move, your habits) and gives a personality‑specific tip to improve.

### Progress
- **Rating is the ladder** — no levels or XP. Your chess-style **Elo rating**
  (online) is the single measure of skill, shown in the top bar and profile.
- **Win champions by conquest** — each of the 5 rivals *is* the character it
  holds; **beat it once to recruit that champion** and play as them. The rest
  unlock through achievements, so you can collect offline too.
- **12 achievements** (First Blood, Flawless, Comeback King, Grandmaster
  Slayer…) that also unlock champions and arena themes.
- **Daily challenge** — a deterministic goal everyone shares each day.
- **Profile** — rating, career stats, throw distribution, achievements,
  champion gallery (with how to unlock each), arenas, and leaderboards.

### Share & play online
- **Match cards** — a rendered result image ready to post, via the Web Share
  API (share the PNG), download, or copy link.
- **Challenge links** — set a gauntlet of throws and send a friend a link;
  they play it on their own device.
- **Optional online mode** — deploy the tiny backend in [`server/`](server/)
  and set `API_BASE` in `js/config.js` to unlock **real-time live matches**, a
  **shared, persistent head‑to‑head record**, and a **global leaderboard** both
  players see. Leave it blank and everything runs fully offline (challenge
  links just embed the moves, stats stay on‑device).
- **Chess-style Elo rating** — every online game updates your rating (start
  1200, K=32, zero-sum). The result screen shows your gain/loss and the global
  leaderboard ranks players by Elo.

### Polish
- **Installable PWA** — add to home screen and **play fully offline**.
- **Light & dark themes** with a top‑bar toggle (persisted).
- **Accessible & responsive** — keyboard play (`R` / `P` / `S`, `Esc`),
  ARIA live regions, focus states, `prefers-reduced-motion`, tuned from
  mobile to desktop.
- **Delight** — victory confetti and subtle, mutable WebAudio sound effects.

## Tech

Vanilla HTML, CSS, and ES‑module JavaScript. State persists in `localStorage`.

| Path | Purpose |
| --- | --- |
| `index.html` | App shell and all screens |
| `styles.css` | Design system (tokens) + components + light theme |
| `js/data.js` | Champions, rivals, arenas, achievements, XP tables |
| `js/profile.js` | Player profile, progression, achievements, daily |
| `js/app.js` | Engine, AI, FX, share cards, routing |
| `js/net.js`, `js/config.js` | Online API client + backend URL config |
| `server/` | Optional zero‑dependency backend (records + leaderboard) |
| `sw.js`, `manifest.webmanifest` | PWA offline shell + install metadata |
| `img/` | Champion avatars, artwork, app icons |

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

A local HTTP server is required (ES modules + service worker don't run from `file://`).

## How to play

Rock crushes Scissors · Paper covers Rock · Scissors cut Paper.
Mix up your moves — the Grandmaster punishes predictable players.
