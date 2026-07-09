/* =========================================================
   RIVALS — player profile & progression
   Champions are won by beating the rival that holds them or by
   achievements; arenas unlock via achievements. Rating (Elo) is
   online-only and lives on the server. No levels / XP.
   ========================================================= */
import {
  CHAMPIONS, CHAMP_BY_ID, ARENAS, ACHIEVEMENTS, DAILY_GOALS, seedFrom,
} from "./data.js";

const KEY = "rivals.profile.v2";
const STARTERS = CHAMPIONS.filter((c) => c.unlock.t === "start").map((c) => c.id);

function defaults() {
  return {
    version: 3,
    career: {
      wins: 0, losses: 0, draws: 0, streak: 0, bestStreak: 0,
      rounds: 0, matches: 0, flawless: 0, comebacks: 0, dailyDone: 0,
      beatGrandmaster: false,
      challengesWon: 0, challengesLost: 0,
      movesThrown: { rock: 0, paper: 0, scissors: 0 },
      winsByChamp: {}, playsByChamp: {},
    },
    unlocks: { champions: [...STARTERS], arenas: ["nebula"], titles: [] },
    achievements: {},
    daily: null,
    settings: { theme: "dark", sound: true, arena: "nebula", online: { id: "", name: "", username: "", rating: 0, token: "" } },
  };
}

function hydrate(raw) {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;
  const p = { ...base, ...raw };
  p.career = { ...base.career, ...(raw.career || {}) };
  p.career.movesThrown = { ...base.career.movesThrown, ...((raw.career || {}).movesThrown || {}) };
  p.career.winsByChamp = { ...((raw.career || {}).winsByChamp || {}) };
  p.career.playsByChamp = { ...((raw.career || {}).playsByChamp || {}) };
  p.unlocks = { ...base.unlocks, ...(raw.unlocks || {}) };
  p.unlocks.champions = Array.from(new Set([...STARTERS, ...(p.unlocks.champions || [])])).filter((id) => CHAMP_BY_ID[id]);
  p.unlocks.arenas = Array.from(new Set(["nebula", ...(p.unlocks.arenas || [])]));
  p.achievements = { ...(raw.achievements || {}) };
  p.settings = { ...base.settings, ...(raw.settings || {}) };
  p.settings.online = { ...base.settings.online, ...((raw.settings || {}).online || {}) };
  return p;
}

/* migrate a v1/v2 record (had xp/level-based unlocks) — keep career + unlocks */
function migrateLegacy(p) {
  try {
    const legacy = localStorage.getItem("rivals.career");
    if (legacy && p.career.matches === 0) {
      const c = JSON.parse(legacy);
      if (c) {
        p.career.wins += c.wins || 0;
        p.career.losses += c.losses || 0;
        p.career.draws += c.draws || 0;
        p.career.bestStreak = Math.max(p.career.bestStreak, c.bestStreak || 0);
        p.career.matches = (c.wins || 0) + (c.losses || 0) + (c.draws || 0);
      }
    }
  } catch {}
  return p;
}

export const profile = migrateLegacy(hydrate(readRaw()));

function readRaw() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch {} }

/* ---------- unlock helpers ---------- */
export const champUnlocked = (id) => profile.unlocks.champions.includes(id);
export const arenaUnlocked = (id) => profile.unlocks.arenas.includes(id);

function unlockChampion(id, out) {
  if (id && CHAMP_BY_ID[id] && !champUnlocked(id)) { profile.unlocks.champions.push(id); out.push({ type: "champion", id, name: CHAMP_BY_ID[id].name, img: CHAMP_BY_ID[id].img }); }
}
function unlockArena(id, out) {
  if (id && !arenaUnlocked(id)) { profile.unlocks.arenas.push(id); const a = ARENAS.find((x) => x.id === id); if (a) out.push({ type: "arena", id, name: a.name }); }
}
/* things unlocked by earning a given achievement id */
function grantForAchievement(achId, out) {
  CHAMPIONS.filter((c) => c.unlock.t === "ach" && c.unlock.id === achId).forEach((c) => unlockChampion(c.id, out));
  ARENAS.filter((a) => a.unlock === achId).forEach((a) => unlockArena(a.id, out));
}

/* ---------- daily challenge ---------- */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function ensureDaily() {
  const key = todayKey();
  if (!profile.daily || profile.daily.date !== key) {
    const seed = seedFrom(key);
    const goal = DAILY_GOALS[seed % DAILY_GOALS.length];
    profile.daily = { date: key, goalId: goal.id, kind: goal.kind, target: goal.target, progress: 0, done: false, claimed: false };
    save();
  }
  return profile.daily;
}
export function dailyLabel(d = profile.daily) {
  if (!d) return "";
  const goal = DAILY_GOALS.find((g) => g.id === d.goalId);
  return goal ? goal.label(goal.target) : "";
}
function advanceDaily(ctx) {
  const d = ensureDaily();
  if (d.done) return 0;
  let inc = 0;
  if (d.kind === "matchPlay") inc = 1;
  else if (d.kind === "matchWin" && ctx.won) inc = 1;
  else if (d.kind === "roundWin") inc = ctx.playerScore;
  else if (d.kind === "gmWin" && ctx.won && ctx.rivalStars >= 4) inc = 1;
  else if (d.kind === "flawless" && ctx.won && ctx.flawless) inc = 1;
  if (inc <= 0) return 0;
  d.progress = Math.min(d.target, d.progress + inc);
  if (d.progress >= d.target && !d.done) { d.done = true; return d.target; }
  return 0;
}

/* ---------- record a finished match ----------
   ctx: { won, playerScore, cpuScore, rounds, flawless, comeback, rivalStars,
          rivalId, moves, champId, challenge }
   returns { claimed:[{type,...}], newAchievements:[], dailyCompleted } */
export function recordMatch(ctx) {
  const c = profile.career;
  c.matches++;
  c.rounds += ctx.rounds;
  (ctx.moves || []).forEach((m) => { if (c.movesThrown[m] != null) c.movesThrown[m]++; });
  if (ctx.won) { c.wins++; c.streak++; c.bestStreak = Math.max(c.bestStreak, c.streak); }
  else { c.losses++; c.streak = 0; }
  if (ctx.won && ctx.flawless) c.flawless++;
  if (ctx.won && ctx.comeback) c.comebacks++;
  if (ctx.won && ctx.rivalStars >= 4) c.beatGrandmaster = true;
  if (ctx.champId) {
    c.playsByChamp[ctx.champId] = (c.playsByChamp[ctx.champId] || 0) + 1;
    if (ctx.won) c.winsByChamp[ctx.champId] = (c.winsByChamp[ctx.champId] || 0) + 1;
  }
  if (ctx.challenge) { if (ctx.won) c.challengesWon++; else c.challengesLost++; }

  const claimed = [];
  // conquest: beat the rival that holds a champion -> claim it
  if (ctx.won && ctx.rivalId) {
    const held = CHAMPIONS.find((ch) => ch.unlock.t === "rival" && ch.unlock.rival === ctx.rivalId);
    if (held) unlockChampion(held.id, claimed);
  }

  const dailyReward = advanceDaily(ctx);
  if (dailyReward > 0) c.dailyDone++;

  // achievements (after career updated) — earning one may unlock a champion/arena
  const newAchievements = [];
  ACHIEVEMENTS.forEach((a) => {
    if (!profile.achievements[a.id] && a.check(profile, ctx)) {
      profile.achievements[a.id] = Date.now();
      newAchievements.push(a);
      grantForAchievement(a.id, claimed);
    }
  });

  save();
  return { claimed, newAchievements, dailyCompleted: dailyReward > 0, daily: profile.daily };
}

/* ---------- online rating cache (display only; server is authoritative) ---------- */
export const myRating = () => (profile.settings.online && profile.settings.online.rating) || 0;

export function resetProfile() {
  const fresh = defaults();
  Object.keys(profile).forEach((k) => delete profile[k]);
  Object.assign(profile, fresh);
  save();
}
