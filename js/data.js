/* =========================================================
   RIVALS — static game data & progression tables
   Progression: rating (Elo, online) is the ladder; champions
   are won by beating the rival that holds them, or via
   achievements. No levels / XP.
   ========================================================= */

/* ---------- Champions ----------
   unlock: {t:"start"} | {t:"rival", rival} | {t:"ach", id}
   Rival-held champions are claimed by beating that rival once. */
export const CHAMPIONS = [
  { id: "ember", name: "Ember", img: "img/champions/ember.svg", unlock: { t: "start" } },
  { id: "frost", name: "Frost", img: "img/champions/frost.svg", unlock: { t: "start" } },
  { id: "volt", name: "Volt", img: "img/champions/volt.svg", unlock: { t: "start" } },
  { id: "kai", name: "Kai", img: "img/champions/kai.svg", unlock: { t: "rival", rival: "rookie" } },
  { id: "luna", name: "Luna", img: "img/champions/luna.svg", unlock: { t: "rival", rival: "mirror" } },
  { id: "nova", name: "Nova", img: "img/champions/nova.svg", unlock: { t: "rival", rival: "duelist" } },
  { id: "onyx", name: "Onyx", img: "img/champions/onyx.svg", unlock: { t: "rival", rival: "cycler" } },
  { id: "ash", name: "Ash", img: "img/champions/ash.svg", unlock: { t: "rival", rival: "grandmaster" } },
  { id: "blaze", name: "Blaze", img: "img/champions/blaze.svg", unlock: { t: "ach", id: "first_blood" } },
  { id: "cinder", name: "Cinder", img: "img/champions/cinder.svg", unlock: { t: "ach", id: "hat_trick" } },
  { id: "dune", name: "Dune", img: "img/champions/dune.svg", unlock: { t: "ach", id: "flawless" } },
  { id: "sol", name: "Sol", img: "img/champions/sol.svg", unlock: { t: "ach", id: "sharpshooter" } },
];
export const CHAMP_BY_ID = Object.fromEntries(CHAMPIONS.map((c) => [c.id, c]));

/* ---------- Rival personalities (readable AI strategies) ----------
   Each rival IS the champion it holds — beat it once to claim that champion. */
export const RIVALS = [
  { id: "rookie", name: "The Rookie", tag: "Plays loose", stars: 1, champ: "kai", img: "img/champions/kai.svg",
    blurb: "Forgiving and easy to read — a gentle warm-up." },
  { id: "mirror", name: "The Mirror", tag: "Copies your last move", stars: 2, champ: "luna", img: "img/champions/luna.svg",
    blurb: "Reflects what you just threw. Punish the echo." },
  { id: "duelist", name: "The Duelist", tag: "Pure chance", stars: 2, champ: "nova", img: "img/champions/nova.svg",
    blurb: "No pattern at all — a true coin-flip rival." },
  { id: "cycler", name: "The Cycler", tag: "Rotates its throws", stars: 3, champ: "onyx", img: "img/champions/onyx.svg",
    blurb: "Cycles Rock → Paper → Scissors, with the odd feint." },
  { id: "grandmaster", name: "The Grandmaster", tag: "Reads your patterns", stars: 4, champ: "ash", img: "img/champions/ash.svg",
    blurb: "Learns your habits and counters them. Stay unpredictable." },
];
export const RIVAL_BY_ID = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

/* ---------- Arenas (cosmetic board themes) ----------
   unlock: "start" or an achievement id. */
export const ARENAS = [
  { id: "nebula", name: "Nebula", unlock: "start", a: "#8b6bff", b: "#25d5e6", c: "#6366f1" },
  { id: "sunset", name: "Sunset", unlock: "first_blood", a: "#ff8a5c", b: "#ff5c9d", c: "#ffb35c" },
  { id: "matrix", name: "Matrix", unlock: "veteran", a: "#22e08a", b: "#25d5e6", c: "#4ade80" },
  { id: "crimson", name: "Crimson", unlock: "gm_slayer", a: "#ff5c6e", b: "#b06bff", c: "#ff8a5c" },
];
export const ARENA_BY_ID = Object.fromEntries(ARENAS.map((a) => [a.id, a]));

/* ---------- Achievements ---------- */
/* check(profile, ctx) — profile is post-update; ctx describes the finished match */
export const ACHIEVEMENTS = [
  { id: "first_blood", name: "First Blood", desc: "Win your first match.", icon: "🩸",
    check: (p) => p.career.wins >= 1 },
  { id: "hat_trick", name: "Hat-Trick", desc: "Win 3 matches in a row.", icon: "🎩",
    check: (p) => p.career.bestStreak >= 3 },
  { id: "unstoppable", name: "Unstoppable", desc: "Win 5 matches in a row.", icon: "🔥",
    check: (p) => p.career.bestStreak >= 5 },
  { id: "legendary", name: "Legendary", desc: "Win 10 matches in a row.", icon: "⚡",
    check: (p) => p.career.bestStreak >= 10 },
  { id: "flawless", name: "Flawless", desc: "Win a match without dropping a round.", icon: "💎",
    check: (p, c) => c.won && c.flawless },
  { id: "comeback", name: "Comeback King", desc: "Win after trailing by 2+ rounds.", icon: "🛡️",
    check: (p, c) => c.won && c.comeback },
  { id: "gm_slayer", name: "Grandmaster Slayer", desc: "Beat the Grandmaster.", icon: "🗡️",
    check: (p, c) => c.won && c.rivalStars >= 4 },
  { id: "centurion", name: "Centurion", desc: "Play 100 rounds.", icon: "🏛️",
    check: (p) => p.career.rounds >= 100 },
  { id: "veteran", name: "Veteran", desc: "Play 25 matches.", icon: "🎖️",
    check: (p) => p.career.matches >= 25 },
  { id: "daily_devotee", name: "Daily Devotee", desc: "Complete 5 daily challenges.", icon: "📅",
    check: (p) => p.career.dailyDone >= 5 },
  { id: "collector", name: "Collector", desc: "Unlock every champion.", icon: "🌟",
    check: (p) => p.unlocks.champions.length >= CHAMPIONS.length },
  { id: "sharpshooter", name: "Sharpshooter", desc: "Win 10 matches total.", icon: "🎯",
    check: (p) => p.career.wins >= 10 },
];
export const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

/* ---------- Daily challenges ---------- */
export const DAILY_GOALS = [
  { id: "win_matches", target: 2, label: (t) => `Win ${t} matches`, kind: "matchWin" },
  { id: "win_rounds", target: 12, label: (t) => `Win ${t} rounds`, kind: "roundWin" },
  { id: "beat_gm", target: 1, label: () => `Beat the Grandmaster`, kind: "gmWin" },
  { id: "flawless", target: 1, label: () => `Win a flawless match`, kind: "flawless" },
  { id: "play_matches", target: 3, label: (t) => `Play ${t} matches`, kind: "matchPlay" },
];

/* deterministic string hash -> uint */
export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------- Taunts for share cards ---------- */
export const TAUNTS = {
  win: ["Outplayed and outread.", "Crown secured.", "GG — better luck next time.", "Read like an open book."],
  lose: ["I'll be back.", "Rematch incoming.", "The rival got lucky… this time.", "Down but not out."],
};
