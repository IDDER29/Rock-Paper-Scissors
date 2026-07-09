/* =========================================================
   RIVALS — online API client (thin wrapper over the backend)
   Every call fails soft: online() is false when no API is set,
   and callers fall back to offline behaviour on any error.
   ========================================================= */
import { API_BASE } from "./config.js";

export const online = () => !!API_BASE;

async function api(pathname, opts = {}) {
  const res = await fetch(API_BASE + pathname, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error("api " + res.status);
  return res.json();
}

export const registerPlayer = (name, id) =>
  api("/api/player", { method: "POST", body: JSON.stringify({ name, id }) });

export const createChallenge = (challengerId, name, champId, moves) =>
  api("/api/challenge", { method: "POST", body: JSON.stringify({ challengerId, name, champId, moves }) });

export const getChallenge = (id) => api("/api/challenge/" + encodeURIComponent(id));

export const submitResult = (challengeId, opponentId, opponentName, champId, pScore, cScore) =>
  api("/api/result", { method: "POST", body: JSON.stringify({ challengeId, opponentId, opponentName, champId, pScore, cScore }) });

export const getRivalries = (playerId) => api("/api/rivalries?player=" + encodeURIComponent(playerId));

export const getLeaderboard = () => api("/api/leaderboard");
