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
/* strip HTML/control chars + collapse whitespace (defence-in-depth vs XSS/impersonation) */
const clampName = (n) => String(n || "Player").replace(/[<>&"'`]/g, "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 24) || "Player";

const BASE_RATING = 1200;
function upsertPlayer(id, name) {
  if (id && db.players[id]) { if (name) db.players[id].name = clampName(name); if (db.players[id].rating == null) db.players[id].rating = BASE_RATING; return db.players[id]; }
  const nid = id || uuid();
  db.players[nid] = db.players[nid] || { id: nid, name: clampName(name), wins: 0, losses: 0, draws: 0, rating: BASE_RATING, token: "", created: now() };
  if (name) db.players[nid].name = clampName(name);
  if (db.players[nid].rating == null) db.players[nid].rating = BASE_RATING;
  return db.players[nid];
}

/* ---------- lightweight auth (bearer token, trust-on-first-use) ---------- */
function tokenFrom(req, body) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return (m && m[1]) || (body && body.token) || null;
}
/* true if this request is allowed to act as playerId. Binds the token on first use. */
function authAs(playerId, tok) {
  const p = db.players[playerId];
  if (!p || !tok) return false;
  if (!p.token) { p.token = tok; return true; }
  return p.token === tok;
}

/* ---------- rate limiting (per-IP token bucket) ---------- */
const rlHits = new Map();
function rateLimited(ip) {
  const t = now(), w = rlHits.get(ip) || { n: 0, reset: t + 10000 };
  if (t > w.reset) { w.n = 0; w.reset = t + 10000; }
  w.n++; rlHits.set(ip, w);
  return w.n > 100; // 100 requests / 10s / IP
}
setInterval(() => { const t = now(); for (const [ip, w] of rlHits) if (t > w.reset + 60000) rlHits.delete(ip); }, 120000).unref?.();

/* Elo update between two players. winner = aId | bId | null (draw). K=32, floor 100. */
function applyElo(aId, bId, winner) {
  const K = 32, FLOOR = 100;
  const pa = db.players[aId], pb = db.players[bId];
  const Ra = pa.rating == null ? BASE_RATING : pa.rating;
  const Rb = pb.rating == null ? BASE_RATING : pb.rating;
  const Ea = 1 / (1 + Math.pow(10, (Rb - Ra) / 400));
  const Sa = winner === aId ? 1 : winner === bId ? 0 : 0.5;
  const Ra2 = Math.max(FLOOR, Math.round(Ra + K * (Sa - Ea)));
  const Rb2 = Math.max(FLOOR, Math.round(Rb + K * ((1 - Sa) - (1 - Ea))));
  pa.rating = Ra2; pb.rating = Rb2;
  return { [aId]: { before: Ra, after: Ra2, delta: Ra2 - Ra }, [bId]: { before: Rb, after: Rb2, delta: Rb2 - Rb } };
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
    if (!map[other]) map[other] = { opponentId: other, name: (db.players[other] || {}).name || "Player", rating: (db.players[other] || {}).rating == null ? BASE_RATING : db.players[other].rating, youWins: 0, themWins: 0, draws: 0, games: 0, last: 0 };
    const r = map[other];
    r.games++; r.last = Math.max(r.last, g.at);
    if (g.winner === playerId) r.youWins++; else if (g.winner === other) r.themWins++; else r.draws++;
  }
  return Object.values(map).sort((x, y) => y.last - x.last);
}

function leaderboard(limit = 20) {
  return Object.values(db.players)
    .map((p) => ({ id: p.id, name: p.name, rating: p.rating == null ? BASE_RATING : p.rating, wins: p.wins, losses: p.losses, draws: p.draws, played: p.wins + p.losses + p.draws }))
    .filter((p) => p.played > 0)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || b.played - a.played)
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
  let matchWinner = null, rivalry = null, ratings = null;
  if (done) {
    room.status = "finished";
    matchWinner = room.players[a].score > room.players[b].score ? a : b;
    room.matchWinner = matchWinner;
    recordLiveResult(room, matchWinner);
    rivalry = rivalryBetween(a, b);
    ratings = applyElo(a, b, matchWinner);
    save();
  } else room.round = r + 1;
  room.updated = now();
  broadcast(room, "round", { round: r, picks: { ...picks }, roundWinner, scores, done, matchWinner, rivalry, ratings });
  if (!done) broadcastState(room);
}

setInterval(() => {
  const t = now();
  for (const id of Object.keys(rooms)) {
    const room = rooms[id];
    const idle = t - (room.updated || room.createdAt);
    const staleQueue = room.matchmaking && room.status === "waiting" && room.streams.length === 0 && idle > 45 * 1000;
    if (staleQueue || (room.streams.length === 0 && idle > 5 * 60 * 1000) || idle > 60 * 60 * 1000) delete rooms[id];
  }
}, 60 * 1000).unref?.();

/* ---------- http helpers ---------- */
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || "?";
  if (p !== "/" && rateLimited(ip)) return sendJSON(res, 429, { error: "too many requests" });

  try {
    if (req.method === "GET" && p === "/") return sendJSON(res, 200, { ok: true, service: "RIVALS API", players: Object.keys(db.players).length, games: db.games.length });

    if (req.method === "POST" && p === "/api/player") {
      const b = await readBody(req);
      const tok = tokenFrom(req, b);
      if (b.id && db.players[b.id] && db.players[b.id].token && db.players[b.id].token !== tok) return sendJSON(res, 401, { error: "unauthorized" });
      const player = upsertPlayer(b.id, b.name);
      if (!player.token) player.token = tok || uuid();
      save();
      return sendJSON(res, 200, { id: player.id, name: player.name, rating: player.rating, token: player.token });
    }

    if (req.method === "POST" && p === "/api/challenge") {
      const b = await readBody(req);
      if (!authAs(b.challengerId, tokenFrom(req, b))) return sendJSON(res, 401, { error: "unauthorized" });
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
      if (!authAs(b.opponentId, tokenFrom(req, b))) return sendJSON(res, 401, { error: "unauthorized" });
      const c = db.challenges[b.challengeId];
      if (!c) return sendJSON(res, 404, { error: "challenge not found" });
      const opp = upsertPlayer(b.opponentId, b.opponentName);
      if (opp.id === c.challengerId) return sendJSON(res, 400, { error: "cannot play your own challenge" });
      const pScore = b.pScore | 0, cScore = b.cScore | 0;
      const oppWon = pScore > cScore, chalWon = cScore > pScore;
      const winner = oppWon ? opp.id : chalWon ? c.challengerId : null;
      const chal = db.players[c.challengerId] || upsertPlayer(c.challengerId, c.name);
      // Challenge scores are client-reported -> record casual W/L + head-to-head only.
      // Rating (Elo) is NOT touched here; only server-judged live/quick matches are rated.
      if (oppWon) { opp.wins++; chal.losses++; }
      else if (chalWon) { chal.wins++; opp.losses++; }
      else { opp.draws++; chal.draws++; }
      db.games.push({ challengeId: c.id, challengerId: c.challengerId, challengerName: c.name, opponentId: opp.id, opponentName: opp.name, champChal: c.champId, champOpp: String(b.champId || "").slice(0, 24), pScore, cScore, winner, at: now(), rated: false });
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
      if (!authAs(b.playerId, tokenFrom(req, b))) return sendJSON(res, 401, { error: "unauthorized" });
      const me = upsertPlayer(b.playerId, b.name); save();
      const id = uuid().slice(0, 6);
      rooms[id] = { id, target: Math.min(Math.max((b.target | 0) || 5, 1), 9), status: "waiting", round: 1, order: [me.id], players: { [me.id]: { name: me.name, champId: String(b.champId || "").slice(0, 24), score: 0, connected: false } }, picks: {}, history: [], streams: [], matchWinner: null, createdAt: now(), updated: now() };
      return sendJSON(res, 200, { roomId: id, playerId: me.id });
    }

    if (req.method === "POST" && p === "/api/matchmake") {
      const b = await readBody(req);
      if (!authAs(b.playerId, tokenFrom(req, b))) return sendJSON(res, 401, { error: "unauthorized" });
      const me = upsertPlayer(b.playerId, b.name); save();
      const champId = String(b.champId || "").slice(0, 24);
      const target = Math.min(Math.max((b.target | 0) || 5, 1), 9);
      // pair with an open public room whose host is connected (or just created)
      const open = Object.values(rooms).find((r) =>
        r.matchmaking && r.status === "waiting" && r.order.length === 1 && r.order[0] !== me.id &&
        r.players[r.order[0]] && (r.players[r.order[0]].connected || now() - r.createdAt < 12000));
      if (open) {
        open.order.push(me.id);
        open.players[me.id] = { name: me.name, champId, score: 0, connected: false };
        open.status = "playing"; open.updated = now();
        broadcastState(open);
        return sendJSON(res, 200, { roomId: open.id, target: open.target, paired: true });
      }
      const id = uuid().slice(0, 6);
      rooms[id] = { id, target, status: "waiting", round: 1, order: [me.id], players: { [me.id]: { name: me.name, champId, score: 0, connected: false } }, picks: {}, history: [], streams: [], matchWinner: null, matchmaking: true, createdAt: now(), updated: now() };
      return sendJSON(res, 200, { roomId: id, target, paired: false });
    }
    let m;
    if ((m = p.match(/^\/api\/room\/([^/]+)$/)) && req.method === "GET") {
      const room = rooms[m[1]]; if (!room) return sendJSON(res, 404, { error: "room not found" });
      return sendJSON(res, 200, roomPublic(room));
    }
    if ((m = p.match(/^\/api\/room\/([^/]+)\/join$/)) && req.method === "POST") {
      const room = rooms[m[1]]; if (!room) return sendJSON(res, 404, { error: "room not found" });
      const b = await readBody(req);
      if (!authAs(b.playerId, tokenFrom(req, b))) return sendJSON(res, 401, { error: "unauthorized" });
      const me = upsertPlayer(b.playerId, b.name); save();
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
      if (!authAs(b.playerId, tokenFrom(req, b))) return sendJSON(res, 401, { error: "unauthorized" });
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
      if (room) { const b = await readBody(req); if (authAs(b.playerId, tokenFrom(req, b)) && room.players[b.playerId]) room.players[b.playerId].connected = false; broadcastState(room); }
      return sendJSON(res, 200, { ok: true });
    }

    return sendJSON(res, 404, { error: "not found" });
  } catch (e) {
    return sendJSON(res, 500, { error: "server error" });
  }
});

server.listen(PORT, () => console.log(`RIVALS API on :${PORT} (data: ${DATA_FILE})`));
