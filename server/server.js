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

/* ---------- live rooms (in-memory, Server-Sent Events) ---------- */
const rooms = {};

function roomPublic(room) {
  const players = {};
  for (const pid of room.order) {
    const p = room.players[pid];
    players[pid] = { name: p.name, champId: p.champId, score: p.score, connected: p.connected, picked: !!(room.picks[room.round] && room.picks[room.round][pid]) };
  }
  return { id: room.id, status: room.status, target: room.target, round: room.round, order: room.order, players, matchWinner: room.matchWinner };
}
function broadcast(room, type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const s of room.streams) { try { s.res.write(payload); } catch {} }
}
const broadcastState = (room) => broadcast(room, "state", roomPublic(room));

function recordLiveResult(room, winnerId) {
  const [a, b] = room.order;
  const pa = db.players[a] || upsertPlayer(a, room.players[a].name);
  const pb = db.players[b] || upsertPlayer(b, room.players[b].name);
  if (winnerId === a) { pa.wins++; pb.losses++; } else { pb.wins++; pa.losses++; }
  db.games.push({ challengeId: "live:" + room.id, challengerId: a, challengerName: room.players[a].name, opponentId: b, opponentName: room.players[b].name, champChal: room.players[a].champId, champOpp: room.players[b].champId, pScore: room.players[a].score, cScore: room.players[b].score, winner: winnerId, at: now(), live: true });
  if (db.games.length > 5000) db.games = db.games.slice(-5000);
  save();
}
function resolveRound(room) {
  const r = room.round, picks = room.picks[r], [a, b] = room.order;
  const ma = picks[a], mb = picks[b];
  let roundWinner = null;
  if (ma !== mb) { roundWinner = BEATS[ma] === mb ? a : b; room.players[roundWinner].score++; }
  room.history.push({ round: r, picks: { ...picks }, roundWinner });
  const scores = { [a]: room.players[a].score, [b]: room.players[b].score };
  const done = room.players[a].score >= room.target || room.players[b].score >= room.target;
  let matchWinner = null, rivalry = null;
  if (done) {
    room.status = "finished";
    matchWinner = room.players[a].score > room.players[b].score ? a : b;
    room.matchWinner = matchWinner;
    recordLiveResult(room, matchWinner);
    rivalry = rivalryBetween(a, b);
  } else room.round = r + 1;
  room.updated = now();
  broadcast(room, "round", { round: r, picks: { ...picks }, roundWinner, scores, done, matchWinner, rivalry });
  if (!done) broadcastState(room);
}

setInterval(() => {
  const t = now();
  for (const id of Object.keys(rooms)) {
    const room = rooms[id];
    const idle = t - (room.updated || room.createdAt);
    if ((room.streams.length === 0 && idle > 5 * 60 * 1000) || idle > 60 * 60 * 1000) delete rooms[id];
  }
}, 60 * 1000).unref?.();

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

    /* ---- live rooms ---- */
    if (req.method === "POST" && p === "/api/room") {
      const b = await readBody(req);
      const me = upsertPlayer(b.playerId, b.name); save();
      const id = uuid().slice(0, 6);
      rooms[id] = { id, target: Math.min(Math.max((b.target | 0) || 5, 1), 9), status: "waiting", round: 1, order: [me.id], players: { [me.id]: { name: me.name, champId: String(b.champId || "").slice(0, 24), score: 0, connected: false } }, picks: {}, history: [], streams: [], matchWinner: null, createdAt: now(), updated: now() };
      return sendJSON(res, 200, { roomId: id, playerId: me.id });
    }
    let m;
    if ((m = p.match(/^\/api\/room\/([^/]+)$/)) && req.method === "GET") {
      const room = rooms[m[1]]; if (!room) return sendJSON(res, 404, { error: "room not found" });
      return sendJSON(res, 200, roomPublic(room));
    }
    if ((m = p.match(/^\/api\/room\/([^/]+)\/join$/)) && req.method === "POST") {
      const room = rooms[m[1]]; if (!room) return sendJSON(res, 404, { error: "room not found" });
      const b = await readBody(req); const me = upsertPlayer(b.playerId, b.name); save();
      if (!room.order.includes(me.id)) {
        if (room.order.length >= 2) return sendJSON(res, 409, { error: "room full" });
        room.order.push(me.id);
        room.players[me.id] = { name: me.name, champId: String(b.champId || "").slice(0, 24), score: 0, connected: false };
        if (room.order.length === 2) room.status = "playing";
      }
      room.updated = now(); broadcastState(room);
      return sendJSON(res, 200, { ok: true, target: room.target, playerId: me.id });
    }
    if ((m = p.match(/^\/api\/room\/([^/]+)\/events$/)) && req.method === "GET") {
      const room = rooms[m[1]]; const pid = url.searchParams.get("player");
      if (!room) return sendJSON(res, 404, { error: "room not found" });
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*", "X-Accel-Buffering": "no" });
      res.write(":ok\n\n");
      const stream = { res, pid }; room.streams.push(stream);
      if (room.players[pid]) room.players[pid].connected = true;
      room.updated = now(); broadcastState(room);
      const hb = setInterval(() => { try { res.write(":ping\n\n"); } catch {} }, 20000);
      req.on("close", () => {
        clearInterval(hb);
        room.streams = room.streams.filter((s) => s !== stream);
        if (room.players[pid] && !room.streams.some((s) => s.pid === pid)) room.players[pid].connected = false;
        broadcastState(room);
      });
      return;
    }
    if ((m = p.match(/^\/api\/room\/([^/]+)\/move$/)) && req.method === "POST") {
      const room = rooms[m[1]]; if (!room) return sendJSON(res, 404, { error: "room not found" });
      const b = await readBody(req);
      if (room.status !== "playing") return sendJSON(res, 409, { error: "not playing" });
      if (!MOVES.includes(b.move) || !room.players[b.playerId]) return sendJSON(res, 400, { error: "bad move" });
      const r = room.round; room.picks[r] = room.picks[r] || {};
      if (!room.picks[r][b.playerId]) {
        room.picks[r][b.playerId] = b.move; room.updated = now();
        if (room.order.length === 2 && room.order.every((pid) => room.picks[r][pid])) resolveRound(room);
        else broadcastState(room);
      }
      return sendJSON(res, 200, { ok: true });
    }
    if ((m = p.match(/^\/api\/room\/([^/]+)\/leave$/)) && req.method === "POST") {
      const room = rooms[m[1]];
      if (room) { const b = await readBody(req); if (room.players[b.playerId]) room.players[b.playerId].connected = false; broadcastState(room); }
      return sendJSON(res, 200, { ok: true });
    }

    return sendJSON(res, 404, { error: "not found" });
  } catch (e) {
    return sendJSON(res, 500, { error: "server error" });
  }
});

server.listen(PORT, () => console.log(`RIVALS API on :${PORT} (data: ${DATA_FILE})`));
