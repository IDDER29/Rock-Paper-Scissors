/* =========================================================
   RIVALS API — tiny zero-dependency backend
   Persistent players, challenges, head-to-head records,
   and a global leaderboard. Data is stored in a JSON file.

   Run:  node server/server.js   (PORT env optional, default 8787)
   ========================================================= */
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 8787;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const MOVES = ["rock", "paper", "scissors"];
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

/* ---------- storage ---------- */
let db = { players: {}, challenges: {}, games: [] };
try { if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch (e) { console.error("save failed", e.message); }
  }, 50);
}

const uuid = () => crypto.randomUUID();
const now = () => Date.now();
const clampName = (n) => String(n || "Player").trim().slice(0, 24) || "Player";

function upsertPlayer(id, name) {
  if (id && db.players[id]) { if (name) db.players[id].name = clampName(name); return db.players[id]; }
  const nid = id || uuid();
  db.players[nid] = db.players[nid] || { id: nid, name: clampName(name), wins: 0, losses: 0, draws: 0, created: now() };
  if (name) db.players[nid].name = clampName(name);
  return db.players[nid];
}

function rivalryBetween(a, b) {
  let aWins = 0, bWins = 0, draws = 0, games = 0;
  for (const g of db.games) {
    const inv = (g.challengerId === a && g.opponentId === b) || (g.challengerId === b && g.opponentId === a);
    if (!inv) continue;
    games++;
    if (g.winner === a) aWins++; else if (g.winner === b) bWins++; else draws++;
  }
  return { a, b, aWins, bWins, draws, games };
}

function rivalriesFor(playerId) {
  const map = {};
  for (const g of db.games) {
    let other = null;
    if (g.challengerId === playerId) other = g.opponentId;
    else if (g.opponentId === playerId) other = g.challengerId;
    else continue;
    if (!map[other]) map[other] = { opponentId: other, name: (db.players[other] || {}).name || "Player", youWins: 0, themWins: 0, draws: 0, games: 0, last: 0 };
    const r = map[other];
    r.games++; r.last = Math.max(r.last, g.at);
    if (g.winner === playerId) r.youWins++; else if (g.winner === other) r.themWins++; else r.draws++;
  }
  return Object.values(map).sort((x, y) => y.last - x.last);
}

function leaderboard(limit = 20) {
  return Object.values(db.players)
    .map((p) => ({ id: p.id, name: p.name, wins: p.wins, losses: p.losses, draws: p.draws, played: p.wins + p.losses + p.draws }))
    .filter((p) => p.played > 0)
    .sort((a, b) => b.wins - a.wins || b.wins / (b.played || 1) - a.wins / (a.played || 1) || b.played - a.played)
    .slice(0, limit);
}

/* ---------- http helpers ---------- */
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", (c) => { data += c; if (data.length > 1e5) req.destroy(); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

/* ---------- routes ---------- */
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJSON(res, 204, {});
  const url = new URL(req.url, "http://x");
  const p = url.pathname;

  try {
    if (req.method === "GET" && p === "/") return sendJSON(res, 200, { ok: true, service: "RIVALS API", players: Object.keys(db.players).length, games: db.games.length });

    if (req.method === "POST" && p === "/api/player") {
      const b = await readBody(req);
      const player = upsertPlayer(b.id, b.name); save();
      return sendJSON(res, 200, { id: player.id, name: player.name });
    }

    if (req.method === "POST" && p === "/api/challenge") {
      const b = await readBody(req);
      const moves = Array.isArray(b.moves) ? b.moves.filter((m) => MOVES.includes(m)).slice(0, 15) : [];
      if (!moves.length || !b.champId) return sendJSON(res, 400, { error: "invalid challenge" });
      const challenger = upsertPlayer(b.challengerId, b.name);
      const id = uuid().slice(0, 8);
      db.challenges[id] = { id, challengerId: challenger.id, name: challenger.name, champId: String(b.champId).slice(0, 24), moves, created: now() };
      save();
      return sendJSON(res, 200, { id });
    }

    if (req.method === "GET" && p.startsWith("/api/challenge/")) {
      const id = decodeURIComponent(p.slice("/api/challenge/".length));
      const c = db.challenges[id];
      if (!c) return sendJSON(res, 404, { error: "not found" });
      return sendJSON(res, 200, { id: c.id, challengerId: c.challengerId, name: c.name, champId: c.champId, moves: c.moves });
    }

    if (req.method === "POST" && p === "/api/result") {
      const b = await readBody(req);
      const c = db.challenges[b.challengeId];
      if (!c) return sendJSON(res, 404, { error: "challenge not found" });
      const opp = upsertPlayer(b.opponentId, b.opponentName);
      if (opp.id === c.challengerId) return sendJSON(res, 400, { error: "cannot play your own challenge" });
      const pScore = b.pScore | 0, cScore = b.cScore | 0;
      const oppWon = pScore > cScore, chalWon = cScore > pScore;
      const winner = oppWon ? opp.id : chalWon ? c.challengerId : null;
      const chal = db.players[c.challengerId] || upsertPlayer(c.challengerId, c.name);
      if (oppWon) { opp.wins++; chal.losses++; }
      else if (chalWon) { chal.wins++; opp.losses++; }
      else { opp.draws++; chal.draws++; }
      db.games.push({ challengeId: c.id, challengerId: c.challengerId, challengerName: c.name, opponentId: opp.id, opponentName: opp.name, champChal: c.champId, champOpp: String(b.champId || "").slice(0, 24), pScore, cScore, winner, at: now() });
      if (db.games.length > 5000) db.games = db.games.slice(-5000);
      save();
      return sendJSON(res, 200, { rivalry: rivalryBetween(opp.id, c.challengerId), challengerName: c.name, challengerId: c.challengerId });
    }

    if (req.method === "GET" && p === "/api/rivalries") {
      const player = url.searchParams.get("player");
      if (!player) return sendJSON(res, 400, { error: "player required" });
      return sendJSON(res, 200, { rivalries: rivalriesFor(player) });
    }

    if (req.method === "GET" && p === "/api/leaderboard") {
      return sendJSON(res, 200, { leaderboard: leaderboard(Number(url.searchParams.get("limit")) || 20) });
    }

    return sendJSON(res, 404, { error: "not found" });
  } catch (e) {
    return sendJSON(res, 500, { error: "server error" });
  }
});

server.listen(PORT, () => console.log(`RIVALS API on :${PORT} (data: ${DATA_FILE})`));
