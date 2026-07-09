/* =========================================================
   RIVALS — player profile, progression, achievements, daily
   ========================================================= */
import {
  CHAMPIONS, ARENAS, ACHIEVEMENTS, DAILY_GOALS,
  xpForLevel, levelFromXp, rivalXpMult, seedFrom,
} from "./data.js";

const KEY = "rivals.profile.v2";
const STARTERS = CHAMPIONS.filter((c) => c.unlockLevel <= 1).map((c) => c.id);

function defaults() {
  return {
    version: 2,
    xp: 0,
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
    settings: { theme: "dark", sound: true, arena: "nebula" },
  };
}

/* deep-ish merge of stored profile onto defaults */
function hydrate(raw) {
  const base = defaults();
  if (!raw || typeof raw !== "object") return base;
  const p = { ...base, ...raw };
  p.career = { ...base.career, ...(raw.career || {}) };
  p.career.movesThrown = { ...base.career.movesThrown, ...((raw.career || {}).movesThrown || {}) };
  p.career.winsByChamp = { ...((raw.career || {}).winsByChamp || {}) };
  p.career.playsByChamp = { ...((raw.career || {}).playsByChamp || {}) };
  p.unlocks = { ...base.unlocks, ...(raw.unlocks || {}) };
  p.unlocks.champions = Array.from(new Set([...STARTERS, ...(p.unlocks.champions || [])]));
  p.unlocks.arenas = Array.from(new Set(["nebula", ...(p.unlocks.arenas || [])]));
  p.achievements = { ...(raw.achievements || {}) };
  p.settings = { ...base.settings, ...(raw.settings || {}) };
  return p;
}

/* one-time migration from the v1 career record */
function migrateLegacy(p) {
  try {
    const legacy = localStorage.getItem("rivals.career");
    if (legacy && p.career.matches === 0 && p.xp === 0) {
      const c = JSON.parse(legacy);
      if (c) {
        p.career.wins += c.wins || 0;
        p.career.losses += c.losses || 0;
        p.career.draws += c.draws || 0;
        p.career.bestStreak = Math.max(p.career.bestStreak, c.bestStreak || 0);
        p.career.matches = (c.wins || 0) + (c.losses || 0) + (c.draws || 0);
        p.xp = (c.wins || 0) * 100 + (c.losses || 0) * 25;
      }
    }
  } catch {}
  return p;
}

export const profile = migrateLegacy(hydrate(readRaw()));

function readRaw() { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } }
export function save() { try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch {} }

/* ---------- level helpers ---------- */
export const levelInfo = () => levelFromXp(profile.xp);
export const currentLevel = () => levelInfo().level;

/* ---------- unlock helpers ---------- */
export const champUnlocked = (id) => profile.unlocks.champions.includes(id);
export const arenaUnlocked = (id) => profile.unlocks.arenas.includes(id);

function grantLevelUnlocks(fromLevel, toLevel) {
  const gained = [];
  for (let lv = fromLevel + 1; lv <= toLevel; lv++) {
    CHAMPIONS.filter((c) => c.unlockLevel === lv && !champUnlocked(c.id)).forEach((c) => {
      profile.unlocks.champions.push(c.id);
      gained.push({ type: "champion", id: c.id, name: c.name, img: c.img });
    });
    ARENAS.filter((a) => a.unlockLevel === lv && !arenaUnlocked(a.id)).forEach((a) => {
      profile.unlocks.arenas.push(a.id);
      gained.push({ type: "arena", id: a.id, name: a.name });
    });
  }
  return gained;
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

/* ---------- record a finished match ---------- */
/*
  ctx: { won, playerScore, cpuScore, rounds, flawless, comeback, rivalStars, moves:[...] }
  returns a rich summary for the result UI.
*/
export function recordMatch(ctx) {
  const c = profile.career;
  const before = levelInfo();

  // career tallies
  c.matches++;
  c.rounds += ctx.rounds;
  ctx.moves.forEach((m) => { if (c.movesThrown[m] != null) c.movesThrown[m]++; });
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

  // XP breakdown
  const breakdown = [];
  const mult = rivalXpMult(ctx.rivalStars);
  if (ctx.won) {
    breakdown.push({ label: "Match won", xp: Math.round(100 * mult) });
  } else {
    breakdown.push({ label: "Match played", xp: 25 });
  }
  if (ctx.playerScore > 0) breakdown.push({ label: `${ctx.playerScore} rounds won`, xp: ctx.playerScore * 10 });
  if (ctx.won && ctx.flawless) breakdown.push({ label: "Flawless bonus", xp: 75 });
  if (ctx.won && ctx.comeback) breakdown.push({ label: "Comeback bonus", xp: 50 });

  // daily
  const dailyReward = advanceDaily(ctx);
  if (dailyReward > 0) { c.dailyDone++; breakdown.push({ label: "Daily challenge", xp: 150 }); }

  const xpGained = breakdown.reduce((s, b) => s + b.xp, 0);
  profile.xp += xpGained;

  const after = levelFromXp(profile.xp);
  const leveledUp = after.level > before.level;
  const unlocks = leveledUp ? grantLevelUnlocks(before.level, after.level) : [];

  // achievements (evaluate after career + unlocks updated)
  const newAchievements = [];
  ACHIEVEMENTS.forEach((a) => {
    if (!profile.achievements[a.id] && a.check(profile, ctx)) {
      profile.achievements[a.id] = Date.now();
      newAchievements.push(a);
    }
  });

  save();

  return {
    xpGained, breakdown,
    before, after, leveledUp,
    unlocks, newAchievements,
    daily: profile.daily, dailyCompleted: dailyReward > 0,
  };
}

/* reset everything (used by the danger-zone button) */
export function resetProfile() {
  const fresh = defaults();
  Object.keys(profile).forEach((k) => delete profile[k]);
  Object.assign(profile, fresh);
  save();
}
