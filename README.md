# RIVALS — Rock · Paper · Scissors

A premium take on Rock Paper Scissors. Pick your champion, size up your rival,
and win the mind game. Built as a fast, self‑contained static web app.

**Play:** https://idder29.github.io/Rock-Paper-Scissors/

## Features

- **Full match journey** — Home → Choose your champion → Battle arena → Match result.
- **Three AI difficulties**
  - *Rookie* — plays loose and forgiving.
  - *Duelist* — pure chance.
  - *Grandmaster* — tracks your recent moves and counters your patterns.
- **Best‑of matches** — first to 3, 5, or 7.
- **Animated duels** — "Rock… Paper… Scissors… Shoot!" countdown, hand reveal, and per‑round verdicts.
- **Round history, live scoreboard, streaks**, and a persistent career record (saved locally).
- **Delightful details** — victory confetti, subtle WebAudio sound effects (mutable), and glassmorphic UI.
- **Accessible & responsive** — keyboard play (`R` / `P` / `S`, `Esc`), ARIA live regions,
  visible focus states, `prefers-reduced-motion` support, and a layout tuned from mobile to desktop.

## Tech

Vanilla HTML, CSS, and JavaScript — no framework, no build step.

| File | Purpose |
| --- | --- |
| `index.html` | App shell and all screens |
| `styles.css` | Design system (tokens) + components |
| `app.js` | Game engine, AI, sound, confetti, view routing |
| `img/` | Champion avatars and artwork |

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## How to play

Rock crushes Scissors · Paper covers Rock · Scissors cut Paper.
Mix up your moves — the Grandmaster punishes predictable players.
