/* =========================================================
   RIVALS — Rock Paper Scissors
   Engine · AI personalities · progression · FX · routing
   ========================================================= */
import {
  CHAMPIONS, RIVALS, RIVAL_BY_ID, ARENAS, ARENA_BY_ID, ACHIEVEMENTS, TAUNTS,
} from "./data.js";
import {
  profile, save, levelInfo, currentLevel, champUnlocked, arenaUnlocked,
  ensureDaily, dailyLabel, recordMatch, resetProfile,
} from "./profile.js";
import * as net from "./net.js";

/* ---------- Icons ---------- */
const ICONS = {
  rock: `<svg viewBox="0 0 96 96" aria-hidden="true"><g fill="currentColor"><ellipse cx="48" cy="60" rx="35" ry="24"/><circle cx="33" cy="46" r="17"/><circle cx="62" cy="43" r="19"/><circle cx="48" cy="52" r="21"/></g><g fill="rgba(0,0,0,.16)"><ellipse cx="60" cy="66" rx="14" ry="7"/></g></svg>`,
  paper: `<svg viewBox="0 0 96 96" aria-hidden="true"><path fill="currentColor" d="M27 12h28l17 17v51a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5z"/><path fill="rgba(0,0,0,.22)" d="M55 12v14a3 3 0 0 0 3 3h14z"/><g stroke="rgba(0,0,0,.18)" stroke-width="3" stroke-linecap="round"><path d="M33 44h30M33 55h30M33 66h20"/></g></svg>`,
  scissors: `<svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><circle cx="27" cy="68" r="12"/><circle cx="69" cy="68" r="12"/><path d="M36 60 76 20"/><path d="M60 60 20 20"/></g><circle cx="48" cy="46" r="4.5" fill="currentColor"/></svg>`,
  question: `<svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><path d="M36 38a12 12 0 1 1 19 9c-4.5 3.4-7 5.5-7 11" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="72" r="5.5" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
const injectIcons = (root = document) => {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    const key = el.getAttribute("data-icon");
    if (ICONS[key] && el.dataset.iconDone !== "1") { el.innerHTML = ICONS[key]; el.dataset.iconDone = "1"; }
  });
};

const MOVES = ["rock", "paper", "scissors"];
const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" }; // key beats value
const LABEL = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

/* ---------- DOM helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const el = {};
[
  "career", "roster", "rivalPicker", "length", "setupSummary", "startBtn",
  "playerAvatar", "playerName", "cpuAvatar", "cpuName", "cpuTag",
  "playerScore", "cpuScore", "pips", "targetLabel",
  "playerHand", "cpuHand", "cpuHandCaption", "countdown", "verdict",
  "moves", "historyList", "quitBtn",
  "resultCard", "resultBadge", "resultKicker", "resultLine",
  "resultScoreline", "resultStats", "rematchBtn",
  "xpFill", "xpGain", "xpBreakdown", "rLevelFrom", "rLevelTo", "levelUpTag",
  "soundBtn", "srStatus", "fx", "tbLevel", "tbXp", "levelChip",
  "dailyCard", "profileBody",
  "readsPanel", "readsRival", "readsBody", "readsTip",
  "modeSwitch", "rivalSection", "champSub", "passCover", "passName", "passBtn",
  "progressBlock", "shareBtn", "sharePreview", "shareNativeBtn", "shareDownloadBtn", "shareCopyBtn",
  "themeBtn", "challengeBanner", "lengthSection",
  "nameInput", "nameSaveBtn", "onlineNote",
  "liveWait", "liveWaitTitle", "liveWaitSub", "liveCode", "liveCopyBtn", "liveCancelBtn",
].forEach((id) => (el[id] = document.getElementById(id)));
el.battleStatus = document.getElementById("battle-status");
el.resultTitle = document.getElementById("result-title");

let soundOn = profile.settings.sound !== false;

/* ---------- Sound ---------- */
const Sound = (() => {
  let ctx = null;
  const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return ctx; };
  const blip = (freq, dur = 0.12, type = "sine", gain = 0.05, when = 0) => {
    if (!soundOn) return; const c = ensure(); if (!c) return;
    const t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  };
  return {
    pick: () => blip(520, 0.1, "triangle", 0.045), tick: () => blip(340, 0.07, "square", 0.03),
    shoot: () => blip(760, 0.14, "triangle", 0.05),
    win: () => { blip(660, 0.12, "triangle", 0.05); blip(880, 0.16, "triangle", 0.05, 0.1); },
    lose: () => { blip(300, 0.16, "sawtooth", 0.04); blip(200, 0.2, "sawtooth", 0.04, 0.1); },
    draw: () => blip(440, 0.14, "sine", 0.04),
    level: () => [523, 784, 1046].forEach((f, i) => blip(f, 0.22, "triangle", 0.05, i * 0.09)),
    fanfare: () => [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.28, "triangle", 0.05, i * 0.12)),
    defeat: () => [392, 349, 294, 233].forEach((f, i) => blip(f, 0.3, "sine", 0.045, i * 0.14)),
    resume: () => ensure(),
  };
})();

/* ---------- Confetti ---------- */
const Confetti = (() => {
  const c = el.fx, ctx = c.getContext("2d");
  let parts = [], raf = null, dpr = 1;
  const resize = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
  window.addEventListener("resize", resize); resize();
  const colors = ["#8b6bff", "#25d5e6", "#4ade80", "#f0a35e", "#ff7a90", "#a98bff"];
  const rand = (a, b) => a + Math.random() * (b - a);
  const burst = (n = 140) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < n; i++) parts.push({
      x: rand(0.2, 0.8) * c.width, y: rand(-0.1, 0.1) * c.height,
      vx: rand(-6, 6) * dpr, vy: rand(2, 10) * dpr, g: rand(0.12, 0.28) * dpr,
      s: rand(5, 11) * dpr, rot: rand(0, 6.28), vr: rand(-0.25, 0.25),
      col: colors[(Math.random() * colors.length) | 0], life: rand(90, 160),
    });
    if (!raf) loop();
  };
  const loop = () => {
    ctx.clearRect(0, 0, c.width, c.height);
    parts = parts.filter((p) => p.life > 0 && p.y < c.height + 40);
    parts.forEach((p) => {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr; p.life--;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillStyle = p.col; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(loop); else { raf = null; ctx.clearRect(0, 0, c.width, c.height); }
  };
  return { burst };
})();

/* ---------- Toast ---------- */
function toast(html, ms = 2600) {
  let host = document.getElementById("toastHost");
  if (!host) { host = document.createElement("div"); host.id = "toastHost"; host.className = "toast-host"; document.body.appendChild(host); }
  const t = document.createElement("div"); t.className = "toast"; t.innerHTML = html;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); setTimeout(() => t.remove(), 400); }, ms);
}

/* ---------- Arena theme ---------- */
function applyArena(id) {
  const a = ARENA_BY_ID[id] || ARENA_BY_ID.nebula;
  document.body.dataset.arena = a.id;
  const r = document.documentElement.style;
  r.setProperty("--violet", a.a); r.setProperty("--cyan", a.b); r.setProperty("--indigo", a.c);
  profile.settings.arena = a.id; save();
}

/* ---------- View router ---------- */
const SCREENS = ["home", "setup", "battle", "result", "profile"];
let current = "home";
function show(name) {
  const prev = current;
  current = name;
  if (prev === "battle" && name !== "battle" && live && !live.finished) teardownLive();
  document.body.dataset.screen = name;
  SCREENS.forEach((s) => {
    const node = document.getElementById("screen-" + s);
    if (!node) return;
    if (s === name) { node.hidden = false; node.classList.remove("is-entering"); void node.offsetWidth; node.classList.add("is-entering"); }
    else node.hidden = true;
  });
  window.scrollTo({ top: 0 });
  if (name === "home") renderHome();
  if (name === "setup") { renderRoster(); refreshSetupForMode(); }
  if (name === "profile") renderProfile();
  renderTopbar();
}

/* ---------- Topbar level chip ---------- */
function renderTopbar() {
  const info = levelInfo();
  if (el.tbLevel) el.tbLevel.textContent = String(info.level);
  if (el.tbXp) el.tbXp.style.width = Math.round(info.progress * 100) + "%";
}

/* ---------- Home ---------- */
function renderHome() { renderCareer(); renderDaily(); }
function renderCareer() {
  const c = profile.career;
  const played = c.wins + c.losses + c.draws;
  if (played === 0) {
    el.career.innerHTML = `<div class="career__empty"><span>⚔️</span><div>No duels yet — your legend starts with the next match.</div></div>`;
    return;
  }
  const rate = Math.round((c.wins / played) * 100);
  el.career.innerHTML = `
    <div class="career__grid">
      <div class="stat"><div class="stat__num is-win">${c.wins}</div><div class="stat__label">Won</div></div>
      <div class="stat"><div class="stat__num is-lose">${c.losses}</div><div class="stat__label">Lost</div></div>
      <div class="stat"><div class="stat__num">${rate}%</div><div class="stat__label">Win rate</div></div>
      <div class="stat"><div class="stat__num is-streak">${c.bestStreak}</div><div class="stat__label">Best streak</div></div>
    </div>`;
}
function renderDaily() {
  if (!el.dailyCard) return;
  const d = ensureDaily();
  const pct = Math.round((d.progress / d.target) * 100);
  el.dailyCard.innerHTML = `
    <div class="daily__head">
      <span class="daily__badge">Daily challenge</span>
      ${d.done ? '<span class="daily__done">Complete ✓</span>' : `<span class="daily__reward">+150 XP</span>`}
    </div>
    <p class="daily__goal">${dailyLabel(d)}</p>
    <div class="daily__bar"><i style="width:${pct}%"></i></div>
    <span class="daily__count">${Math.min(d.progress, d.target)} / ${d.target}</span>`;
}

/* ---------- Challenge link encode/decode ---------- */
const CHALLENGE_ROUNDS = 5;
function encodeChallenge(obj) {
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  catch { return ""; }
}
function decodeChallenge(str) {
  try {
    const s = str.replace(/-/g, "+").replace(/_/g, "/");
    const o = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (o && o.c && Array.isArray(o.m) && o.m.length && o.m.every((m) => MOVES.includes(m))) return o;
  } catch {}
  return null;
}
function parseChallengeFromUrl() {
  const m = (location.hash || "").match(/[#&]c=([^&]+)/);
  if (m) { const o = decodeChallenge(m[1]); if (o && CHAMPIONS.find((c) => c.id === o.c)) return o; }
  return null;
}
let pendingChallenge = null;

/* ---------- Online identity ---------- */
function identity() { return profile.settings.online || (profile.settings.online = { id: "", name: "" }); }
function hasIdentity() { const o = identity(); return !!(o.id && o.name); }

let _nameResolve = null;
function ensureIdentity() {
  return new Promise((resolve) => {
    if (hasIdentity()) return resolve(identity());
    const sheet = document.getElementById("nameSheet");
    if (!sheet) return resolve(null);
    _nameResolve = resolve;
    el.nameInput.value = identity().name || "";
    openSheet(sheet);
    setTimeout(() => el.nameInput.focus(), 60);
  });
}
async function saveName() {
  const name = (el.nameInput.value || "").trim().slice(0, 24);
  if (!name) { el.nameInput.focus(); return; }
  const o = identity(); o.name = name;
  try { if (net.online()) { const p = await net.registerPlayer(name, o.id || undefined); o.id = p.id; o.name = p.name; } }
  catch {}
  if (!o.id) o.id = "local-" + Math.random().toString(36).slice(2, 10);
  save();
  const sheet = document.getElementById("nameSheet"); closeSheet(sheet);
  const r = _nameResolve; _nameResolve = null; if (r) r(identity());
}

/* ---------- Setup ---------- */
const setup = { champ: null, rivalId: "duelist", length: 5, mode: "ai" };

function refreshSetupForMode() {
  const mode = setup.mode;
  const isAi = mode === "ai", isPvp = mode === "pvp", isChal = mode === "challenge", isAccept = mode === "accept", isLive = mode === "live", isQuick = mode === "quick";
  const liveJoin = isLive && !!pendingLive;
  if (el.rivalSection) el.rivalSection.hidden = !isAi;
  if (el.lengthSection) el.lengthSection.hidden = isChal || isAccept || liveJoin;
  if (el.champSub) el.champSub.textContent =
    isPvp ? "Player 1 — pick your fighter. Player 2 gets a surprise challenger."
    : isChal ? "Pick your fighter, then set a gauntlet of throws for a friend to beat."
    : isAccept ? "Pick your champion, then out-read the gauntlet."
    : liveJoin ? `Pick your champion to join ${pendingLive.hostName}'s live match.`
    : isLive ? "Pick your champion and length, then invite a friend to a real-time match."
    : isQuick ? "Pick your champion — we'll match you with a random player online."
    : "This is you in the ring. Pick the face of your winning streak.";
  // banner (challenge accept OR live join)
  if (el.challengeBanner) {
    if (isAccept && pendingChallenge) {
      const foe = CHAMPIONS.find((c) => c.id === pendingChallenge.c);
      const who = pendingChallenge.online && pendingChallenge.name ? pendingChallenge.name : foe.name;
      el.challengeBanner.hidden = false;
      el.challengeBanner.innerHTML = `<span class="challenge-banner__ic">🔗</span><img src="${foe.img}" alt=""/><div class="challenge-banner__body"><div class="challenge-banner__title">${who} laid down a gauntlet</div><div class="challenge-banner__sub">Best of ${pendingChallenge.m.length}${pendingChallenge.online ? " · online" : ""} · out-read their throws to win.</div></div>`;
    } else if (liveJoin) {
      el.challengeBanner.hidden = false;
      el.challengeBanner.innerHTML = `<span class="challenge-banner__ic">⚡</span>${pendingLive.hostImg ? `<img src="${pendingLive.hostImg}" alt=""/>` : ""}<div class="challenge-banner__body"><div class="challenge-banner__title">${pendingLive.hostName} wants a live match</div><div class="challenge-banner__sub">Real-time · pick your champion and jump in.</div></div>`;
    } else el.challengeBanner.hidden = true;
  }
  const span = el.startBtn.querySelector("span");
  if (span) span.textContent = isChal ? "Set your gauntlet" : isAccept ? "Accept challenge" : liveJoin ? "Join match" : isLive ? "Create live room" : isQuick ? "Find a match" : "Start the duel";
  updateSummary();
}

function selectMode(mode) {
  if ((mode === "live" || mode === "quick") && !net.online()) { toast("Online play needs the server — see server/README."); Sound.tick(); return; }
  if (mode !== "live") pendingLive = null;
  setup.mode = mode;
  $$(".mode", el.modeSwitch).forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle("is-selected", on); b.setAttribute("aria-checked", String(on)); });
  Sound.tick(); refreshSetupForMode();
}

function renderRoster() {
  el.roster.innerHTML = CHAMPIONS.map((c, i) => {
    const unlocked = champUnlocked(c.id);
    const sel = setup.champ && setup.champ.id === c.id;
    return `
      <button class="champ ${unlocked ? "" : "is-locked"} ${sel ? "is-selected" : ""}" role="radio"
        aria-checked="${sel}" data-id="${c.id}" data-unlocked="${unlocked}" title="${unlocked ? c.name : `Unlocks at level ${c.unlockLevel}`}"
        style="animation-delay:${i * 25}ms">
        <img src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.style.opacity=.2" />
        <span class="champ__name">${c.name}</span>
        <span class="champ__check">${ICONS.check}</span>
        ${unlocked ? "" : `<span class="champ__lock">${ICONS.lock}<b>Lv ${c.unlockLevel}</b></span>`}
      </button>`;
  }).join("");
}

function buildRivalPicker() {
  if (!el.rivalPicker) return;
  el.rivalPicker.innerHTML = RIVALS.map((r) => {
    const sel = setup.rivalId === r.id;
    const stars = "★".repeat(r.stars) + "☆".repeat(4 - r.stars);
    return `
      <button class="rival ${sel ? "is-selected" : ""}" role="radio" aria-checked="${sel}" data-id="${r.id}">
        <img class="rival__avatar" src="${r.img}" alt="" loading="lazy" onerror="this.style.opacity=.2"/>
        <span class="rival__body">
          <span class="rival__name">${r.name}</span>
          <span class="rival__tag">${r.tag}</span>
          <span class="rival__blurb">${r.blurb}</span>
        </span>
        <span class="rival__stars" aria-label="${r.stars} of 4 difficulty">${stars}</span>
      </button>`;
  }).join("");
}

function selectChamp(id) {
  const champ = CHAMPIONS.find((c) => c.id === id);
  if (!champ) return;
  if (!champUnlocked(id)) { toast(`<span class="toast__ic">${ICONS.lock}</span><div><b>${champ.name}</b> unlocks at level ${champ.unlockLevel}</div>`); Sound.tick(); return; }
  setup.champ = champ;
  $$(".champ", el.roster).forEach((b) => { const on = b.dataset.id === id; b.classList.toggle("is-selected", on); b.setAttribute("aria-checked", String(on)); });
  Sound.pick(); updateSummary();
}
function selectRival(id) {
  if (!RIVAL_BY_ID[id]) return;
  setup.rivalId = id;
  $$(".rival", el.rivalPicker).forEach((b) => { const on = b.dataset.id === id; b.classList.toggle("is-selected", on); b.setAttribute("aria-checked", String(on)); });
  Sound.tick(); updateSummary();
}
function bindLength() {
  $$(".seg", el.length).forEach((b) => b.addEventListener("click", () => {
    $$(".seg", el.length).forEach((x) => { x.classList.remove("is-selected"); x.setAttribute("aria-checked", "false"); });
    b.classList.add("is-selected"); b.setAttribute("aria-checked", "true");
    setup.length = parseInt(b.dataset.value, 10); Sound.tick(); updateSummary();
  }));
}
function updateSummary() {
  if (!setup.champ) { el.setupSummary.innerHTML = "Pick a champion to continue."; el.startBtn.disabled = true; return; }
  if (setup.mode === "pvp") {
    el.setupSummary.innerHTML = `Two players, one device · first to <b>${setup.length}</b>.`;
  } else if (setup.mode === "challenge") {
    el.setupSummary.innerHTML = `Set a best-of-${CHALLENGE_ROUNDS} gauntlet as <b>${setup.champ.name}</b> for a friend to beat.`;
  } else if (setup.mode === "accept") {
    const foe = pendingChallenge && CHAMPIONS.find((c) => c.id === pendingChallenge.c);
    const who = pendingChallenge && pendingChallenge.online && pendingChallenge.name ? pendingChallenge.name : (foe ? foe.name : "the");
    el.setupSummary.innerHTML = `Beat <b>${who}</b>'s gauntlet as <b>${setup.champ.name}</b>.`;
  } else if (setup.mode === "live") {
    el.setupSummary.innerHTML = pendingLive
      ? `Join <b>${pendingLive.hostName}</b>'s live match as <b>${setup.champ.name}</b>.`
      : `Host a live match as <b>${setup.champ.name}</b> · first to <b>${setup.length}</b>.`;
  } else if (setup.mode === "quick") {
    el.setupSummary.innerHTML = `Find a random opponent as <b>${setup.champ.name}</b> · first to <b>${setup.length}</b>.`;
  } else {
    const r = RIVAL_BY_ID[setup.rivalId];
    el.setupSummary.innerHTML = `Playing as <b>${setup.champ.name}</b> vs <b>${r.name}</b> · first to <b>${setup.length}</b>.`;
  }
  el.startBtn.disabled = false;
}

/* ---------- Battle engine ---------- */
const match = {
  active: false, locked: false, round: 0, player: 0, cpu: 0, target: 5,
  playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
  mode: "ai", phase: "p1", p1move: null, p1name: "Player 1", p2name: "Player 2",
  p1img: "", p2img: "", fixedRounds: 0, challengeMoves: [], gauntletMoves: [],
};

function startMatch() {
  if (!setup.champ) return;
  Sound.resume();
  if (setup.mode === "challenge") return startGauntlet();
  if (setup.mode === "accept") return startAccept();
  if (setup.mode === "live") return startLive();
  if (setup.mode === "quick") return startQuick();
  const pvp = setup.mode === "pvp";
  Object.assign(match, {
    active: true, locked: false, round: 0, player: 0, cpu: 0, target: setup.length,
    playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
    mode: setup.mode, phase: "p1", p1move: null, fixedRounds: 0,
  });

  const p1 = setup.champ;
  let opponent;
  if (pvp) {
    const pool = CHAMPIONS.filter((c) => champUnlocked(c.id) && c.id !== p1.id);
    opponent = pool[(Math.random() * pool.length) | 0] || p1;
  } else {
    opponent = RIVAL_BY_ID[setup.rivalId];
  }
  match.p1name = p1.name; match.p1img = p1.img;
  match.p2name = opponent.name; match.p2img = opponent.img;

  el.playerAvatar.src = p1.img; el.playerAvatar.alt = p1.name;
  el.playerName.textContent = p1.name;
  el.cpuAvatar.src = opponent.img; el.cpuAvatar.alt = opponent.name;
  el.cpuName.textContent = opponent.name;
  el.cpuTag.textContent = pvp ? "Player 2" : opponent.tag;
  el.cpuHandCaption.textContent = opponent.name;
  el.playerScore.textContent = "0"; el.cpuScore.textContent = "0";
  el.targetLabel.textContent = `First to ${match.target}`;
  buildPips(); resetHands();
  el.historyList.innerHTML = `<li class="history__empty">No rounds yet — throw your first move to begin the story.</li>`;
  el.verdict.className = "verdict"; el.verdict.textContent = "";
  if (el.passCover) el.passCover.hidden = true;
  setStatus(pvp ? `${match.p1name} — make your move` : "Make your move.");
  unlockMoves(); show("battle"); injectIcons(el.moves);
}

/* dispatch a move click/keypress to the right handler */
function throwMove(move) {
  if (!match.active || match.locked) return;
  if (match.mode === "challenge") gauntletThrow(move);
  else if (match.mode === "pvp") pvpMove(move);
  else if (match.mode === "live") liveThrow(move);
  else playRound(move);
}

/* --- Pass & Play round flow --- */
function pvpMove(move) {
  if (match.phase === "p1") {
    match.p1move = move; lockMoves(); Sound.pick();
    const picked = $(`.move[data-move="${move}"]`, el.moves); if (picked) picked.classList.add("is-picked");
    el.passName.textContent = match.p2name;
    el.passCover.hidden = false;
    el.passBtn.focus();
    setStatus("");
  } else if (match.phase === "p2") {
    lockMoves(); Sound.pick();
    match.round++;
    match.playerHistory.push(match.p1move); match.cpuHistory.push(move);
    const result = judge(match.p1move, move);
    match.rounds.push({ p: match.p1move, c: move, result });
    revealRound(match.p1move, move, result);
  }
}
function passReady() {
  el.passCover.hidden = true;
  match.phase = "p2";
  unlockMoves();
  setStatus(`${match.p2name} — make your move`);
}

/* --- Challenge: set a gauntlet (record N of your throws) --- */
function startGauntlet() {
  const p1 = setup.champ;
  Object.assign(match, {
    active: true, locked: false, round: 0, player: 0, cpu: 0, target: 99,
    playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
    mode: "challenge", fixedRounds: CHALLENGE_ROUNDS, gauntletMoves: [],
    p1name: p1.name, p1img: p1.img, p2name: "Your friend", p2img: "img/icon-192.png",
  });
  el.playerAvatar.src = p1.img; el.playerAvatar.alt = p1.name; el.playerName.textContent = p1.name;
  el.cpuAvatar.src = "img/icon-192.png"; el.cpuAvatar.alt = ""; el.cpuName.textContent = "Your friend"; el.cpuTag.textContent = "Awaiting";
  el.cpuHandCaption.textContent = "Your friend";
  el.playerScore.textContent = "0"; el.cpuScore.textContent = "0";
  el.targetLabel.textContent = `Gauntlet · ${CHALLENGE_ROUNDS} throws`;
  match.target = 99; buildPips(); resetHands();
  el.pips.innerHTML = ""; for (let i = 0; i < CHALLENGE_ROUNDS; i++) { const s = document.createElement("span"); s.className = "pip"; el.pips.appendChild(s); }
  el.historyList.innerHTML = `<li class="history__empty">Lock in your throws — your friend will play against them.</li>`;
  el.verdict.className = "verdict"; el.verdict.textContent = "";
  if (el.passCover) el.passCover.hidden = true;
  setStatus(`Throw 1 of ${CHALLENGE_ROUNDS} — set your gauntlet.`);
  unlockMoves(); show("battle"); injectIcons(el.moves);
}
function gauntletThrow(move) {
  if (match.locked) return;
  match.gauntletMoves.push(move);
  lockMoves(); Sound.pick();
  const picked = $(`.move[data-move="${move}"]`, el.moves); if (picked) picked.classList.add("is-picked");
  setGlyph(el.playerHand, move); el.playerHand.dataset.state = "reveal"; el.playerHand.classList.add("win");
  const idx = match.gauntletMoves.length;
  const pip = $$(".pip", el.pips)[idx - 1]; if (pip) pip.classList.add("p-win");
  const li = document.createElement("li"); li.className = "round";
  li.innerHTML = `<span class="round__no">${idx}</span><span class="round__throws">${miniIcon(move)}</span><span class="round__result win">Set</span>`;
  const empty = el.historyList.querySelector(".history__empty"); if (empty) empty.remove();
  el.historyList.prepend(li);
  el.verdict.className = "verdict show v-win"; el.verdict.textContent = LABEL[move];
  if (idx >= CHALLENGE_ROUNDS) { setStatus("Gauntlet set!"); setTimeout(finishGauntlet, 800); return; }
  setStatus(`Throw ${idx + 1} of ${CHALLENGE_ROUNDS} — keep them guessing.`);
  setTimeout(() => { el.playerHand.classList.remove("win"); setGlyph(el.playerHand, "question"); el.playerHand.dataset.state = "idle"; el.verdict.className = "verdict"; el.verdict.textContent = ""; unlockMoves(); }, 800);
}
async function finishGauntlet() {
  match.active = false;
  const moves = match.gauntletMoves.slice();
  if (net.online()) {
    try {
      const me = await ensureIdentity();
      if (me) {
        const r = await net.createChallenge(me.id, me.name, setup.champ.id, moves);
        return openShareChallenge(`${location.origin}${location.pathname}#g=${r.id}`);
      }
    } catch {}
  }
  const payload = { v: 1, c: setup.champ.id, m: moves };
  openShareChallenge(`${location.origin}${location.pathname}#c=${encodeChallenge(payload)}`);
}

/* --- Challenge: accept & play against a recorded gauntlet --- */
function startAccept() {
  if (!pendingChallenge) return;
  const p1 = setup.champ;
  const foe = CHAMPIONS.find((c) => c.id === pendingChallenge.c);
  const moves = pendingChallenge.m.slice();
  const foeName = pendingChallenge.name || foe.name;
  Object.assign(match, {
    active: true, locked: false, round: 0, player: 0, cpu: 0, target: 99,
    playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
    mode: "accept", fixedRounds: moves.length, challengeMoves: moves,
    p1name: p1.name, p1img: p1.img, p2name: foeName, p2img: foe.img,
    online: !!pendingChallenge.online, challengeId: pendingChallenge.id || null,
  });
  el.playerAvatar.src = p1.img; el.playerAvatar.alt = p1.name; el.playerName.textContent = p1.name;
  el.cpuAvatar.src = foe.img; el.cpuAvatar.alt = foeName; el.cpuName.textContent = foeName; el.cpuTag.textContent = "Challenger";
  el.cpuHandCaption.textContent = foeName;
  el.playerScore.textContent = "0"; el.cpuScore.textContent = "0";
  el.targetLabel.textContent = `Gauntlet · best of ${moves.length}`;
  el.pips.innerHTML = ""; for (let i = 0; i < moves.length; i++) { const s = document.createElement("span"); s.className = "pip"; el.pips.appendChild(s); }
  resetHands();
  el.historyList.innerHTML = `<li class="history__empty">Beat the gauntlet — out-read every throw.</li>`;
  el.verdict.className = "verdict"; el.verdict.textContent = "";
  if (el.passCover) el.passCover.hidden = true;
  setStatus("Round 1 — make your move.");
  unlockMoves(); show("battle"); injectIcons(el.moves);
  // consume the challenge so a refresh won't replay it
  try { history.replaceState(null, "", location.pathname); } catch {}
}

/* --- Live: real-time online match (Server-Sent Events) --- */
let live = null;       // active room state
let liveES = null;     // EventSource
let pendingLive = null; // guest arriving via #live= link

function teardownLive() {
  if (liveES) { try { liveES.close(); } catch {} liveES = null; }
  if (live && live.id && live.myId && net.online()) net.leaveRoom(live.id, live.myId);
  live = null;
  if (el.liveWait) el.liveWait.hidden = true;
}
function showLiveWait(link, code) {
  live._link = link;
  el.liveWaitTitle.textContent = "Waiting for your rival…";
  el.liveWaitSub.textContent = "Share this link. The match starts the moment they join.";
  if (el.liveCopyBtn) el.liveCopyBtn.hidden = false;
  el.liveCode.hidden = false; el.liveCode.textContent = "Room " + code;
  el.liveWait.hidden = false;
}
function showFindingWait() {
  el.liveWaitTitle.textContent = "Finding an opponent…";
  el.liveWaitSub.textContent = "Matching you with another player online. Hang tight.";
  if (el.liveCode) el.liveCode.hidden = true;
  if (el.liveCopyBtn) el.liveCopyBtn.hidden = true;
  el.liveWait.hidden = false;
}
function prepLiveBattle(myChamp, target) {
  Object.assign(match, {
    active: true, locked: true, round: 0, player: 0, cpu: 0, target,
    playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
    mode: "live", online: true, myMoves: [], revealing: false, roundNo: 0,
  });
  el.playerAvatar.src = myChamp.img; el.playerAvatar.alt = myChamp.name; el.playerName.textContent = myChamp.name;
  el.cpuAvatar.src = "img/icon-192.png"; el.cpuAvatar.alt = ""; el.cpuName.textContent = "Waiting…"; el.cpuTag.textContent = "Live";
  el.cpuHandCaption.textContent = "Rival";
  el.playerScore.textContent = "0"; el.cpuScore.textContent = "0";
  el.targetLabel.textContent = `First to ${target}`;
  buildPips(); resetHands();
  el.historyList.innerHTML = `<li class="history__empty">First to ${target} takes the match. Good luck.</li>`;
  el.verdict.className = "verdict"; el.verdict.textContent = "";
  el.moves.classList.add("is-locked");
  setStatus("Connecting…");
  show("battle"); injectIcons(el.moves);
}

async function startLive() {
  if (!setup.champ) return;
  if (!net.online()) { toast("Live play needs the online server."); return; }
  const me = await ensureIdentity(); if (!me) return;
  if (pendingLive) return joinLive(pendingLive.id, me);
  try {
    const r = await net.createRoom(me.id, me.name, setup.champ.id, setup.length);
    live = { id: r.roomId, myId: me.id, oppId: null, target: setup.length, status: "waiting", finished: false };
    prepLiveBattle(setup.champ, setup.length);
    showLiveWait(`${location.origin}${location.pathname}#live=${r.roomId}`, r.roomId);
    connectRoom(r.roomId, me.id);
  } catch { toast("Couldn't create a live room."); show("setup"); }
}
async function startQuick() {
  if (!setup.champ) return;
  if (!net.online()) { toast("Online play needs the server."); return; }
  const me = await ensureIdentity(); if (!me) return;
  try {
    const r = await net.matchmake(me.id, me.name, setup.champ.id, setup.length);
    live = { id: r.roomId, myId: me.id, oppId: null, target: r.target || setup.length, status: r.paired ? "playing" : "waiting", finished: false, matchmaking: true };
    prepLiveBattle(setup.champ, live.target);
    if (r.paired) { if (el.liveWait) el.liveWait.hidden = true; } else showFindingWait();
    connectRoom(r.roomId, me.id);
  } catch { toast("Matchmaking failed — try again."); show("setup"); }
}
async function joinLive(id, me) {
  try {
    const rr = await net.joinRoom(id, me.id, me.name, setup.champ.id);
    live = { id, myId: me.id, oppId: null, target: rr.target || 5, status: "playing", finished: false };
    prepLiveBattle(setup.champ, live.target);
    if (el.liveWait) el.liveWait.hidden = true;
    connectRoom(id, me.id);
    try { history.replaceState(null, "", location.pathname); } catch {}
    pendingLive = null;
  } catch { toast("Couldn't join — the room is full or gone."); show("home"); }
}
function connectRoom(id, myId) {
  try {
    liveES = new EventSource(net.roomEventsUrl(id, myId));
    liveES.addEventListener("state", (e) => { try { handleLiveState(JSON.parse(e.data)); } catch {} });
    liveES.addEventListener("round", (e) => { try { handleLiveRound(JSON.parse(e.data)); } catch {} });
    liveES.onerror = () => { if (live && !live.finished) setStatus("Reconnecting…"); };
  } catch { toast("Live connection failed."); }
}
function handleLiveState(s) {
  if (!live || live.finished) return;
  live.status = s.status; live.order = s.order; live.players = s.players; live.target = s.target;
  const oppId = (s.order || []).find((x) => x !== live.myId);
  live.oppId = oppId || live.oppId;
  const meP = s.players[live.myId] || {}, oppP = (oppId && s.players[oppId]) || {};
  match.player = meP.score || 0; match.cpu = oppP.score || 0; match.target = s.target;
  el.playerScore.textContent = String(meP.score || 0); el.cpuScore.textContent = String(oppP.score || 0);
  if (oppP.name) { el.cpuName.textContent = oppP.name; el.cpuHandCaption.textContent = oppP.name; }
  el.cpuTag.textContent = oppId ? (oppP.connected ? "Live" : "Away") : "Live";
  if (oppP.champId) { const c = CHAMPIONS.find((x) => x.id === oppP.champId); if (c) el.cpuAvatar.src = c.img; }
  if ($$(".pip", el.pips).length !== s.target) buildPips();
  paintPips();

  if (s.status === "waiting") { el.moves.classList.add("is-locked"); if (live.matchmaking) showFindingWait(); else if (el.liveWait) el.liveWait.hidden = false; }
  else if (s.status === "playing") {
    if (el.liveWait) el.liveWait.hidden = true;
    if (!oppP.connected) { setStatus(`${oppP.name || "Rival"} disconnected — waiting…`); el.moves.classList.add("is-locked"); return; }
    if (!live.revealing && !(meP.picked)) { unlockMoves(); setStatus(match.round === 0 ? "Make your move." : "Next round — make your move."); }
    else if (meP.picked) { el.moves.classList.add("is-locked"); setStatus("Waiting for your rival…"); }
  }
}
function handleLiveRound(d) {
  if (!live || live.finished) return;
  live.revealing = true; match.locked = true; el.moves.classList.add("is-locked");
  const myMove = d.picks[live.myId], oppMove = d.picks[live.oppId];
  const result = d.roundWinner === live.myId ? "win" : d.roundWinner === live.oppId ? "lose" : "draw";
  live.roundNo = d.round; match.round = d.round;
  if (myMove) match.myMoves.push(myMove);

  setGlyph(el.playerHand, myMove); setGlyph(el.cpuHand, oppMove);
  el.playerHand.dataset.state = "reveal"; el.cpuHand.dataset.state = "reveal";
  el.playerHand.classList.remove("win", "lose"); el.cpuHand.classList.remove("win", "lose");
  if (result === "win") { el.playerHand.classList.add("win"); el.cpuHand.classList.add("lose"); }
  else if (result === "lose") { el.cpuHand.classList.add("win"); el.playerHand.classList.add("lose"); }
  match.player = d.scores[live.myId]; match.cpu = d.scores[live.oppId];
  bumpScores(); paintPips();
  const vmap = { win: { cls: "v-win", txt: "You win!", snd: Sound.win }, lose: { cls: "v-lose", txt: "Rival wins", snd: Sound.lose }, draw: { cls: "v-draw", txt: "Draw", snd: Sound.draw } }[result];
  el.verdict.className = `verdict show ${vmap.cls}`; el.verdict.textContent = vmap.txt; vmap.snd();
  setStatus({ win: `Your ${LABEL[myMove]} beats ${LABEL[oppMove]}.`, lose: `Their ${LABEL[oppMove]} beats your ${LABEL[myMove]}.`, draw: `Both threw ${LABEL[myMove]}.` }[result]);
  addHistory(d.round, myMove, oppMove, result);

  if (d.done) { setTimeout(() => endLive(d), 1150); }
  else setTimeout(() => {
    resetHands(); el.verdict.className = "verdict"; el.verdict.textContent = ""; live.revealing = false;
    const meP = (live.players && live.players[live.myId]) || {};
    if (!meP.picked) { unlockMoves(); setStatus("Next round — make your move."); }
  }, 1200);
}
function liveThrow(move) {
  if (!live || live.status !== "playing" || live.revealing || match.locked) return;
  match.locked = true; el.moves.classList.add("is-locked"); Sound.pick();
  const picked = $(`.move[data-move="${move}"]`, el.moves); if (picked) picked.classList.add("is-picked");
  setStatus("Waiting for your rival…");
  net.sendMove(live.id, live.myId, move).catch(() => { toast("Move failed — check your connection."); match.locked = false; el.moves.classList.remove("is-locked"); });
}
function endLive(d) {
  live.finished = true; match.active = false;
  const won = d.matchWinner === live.myId;
  const oppName = ((live.players && live.players[live.oppId]) || {}).name || "Rival";
  const oppChampId = ((live.players && live.players[live.oppId]) || {}).champId;
  const oppChamp = CHAMPIONS.find((c) => c.id === oppChampId);

  const ctx = { won, playerScore: match.player, cpuScore: match.cpu, rounds: live.roundNo, flawless: won && match.cpu === 0, comeback: won && match.maxDeficit >= 2, rivalStars: 3, moves: match.myMoves.slice(), champId: setup.champ.id };
  const summary = recordMatch(ctx);

  if (el.progressBlock) el.progressBlock.hidden = false;
  if (el.readsPanel) el.readsPanel.hidden = true;
  el.resultCard.dataset.outcome = won ? "win" : "lose";
  el.resultBadge.textContent = won ? "👑" : "🥊";
  el.resultKicker.textContent = "Live match · online";
  el.resultTitle.textContent = won ? "Victory" : "Defeated";
  el.resultLine.textContent = won ? `You beat ${oppName} in a live duel.` : `${oppName} took the live duel. Rematch?`;
  el.resultScoreline.innerHTML = `<span class="me">${match.player}</span><span class="sep">—</span><span class="cpu">${match.cpu}</span>`;
  el.resultStats.innerHTML = `
    <div class="rstat"><div class="rstat__num">${live.roundNo}</div><div class="rstat__label">Rounds</div></div>
    <div class="rstat"><div class="rstat__num">${won ? "W" : "L"}</div><div class="rstat__label">Result</div></div>
    <div class="rstat"><div class="rstat__num">${profile.career.streak}</div><div class="rstat__label">Win streak</div></div>`;

  // shared head-to-head from the final event
  if (d.rivalry) {
    const rv = d.rivalry;
    const meWins = rv.a === live.myId ? rv.aWins : rv.bWins;
    const themWins = rv.a === live.myId ? rv.bWins : rv.aWins;
    el.onlineNote.hidden = false;
    el.onlineNote.innerHTML = `<span class="h2h__label">Head-to-head vs ${oppName}</span><span class="h2h__score"><b class="me">${meWins}</b><span class="sep">–</span><b class="them">${themWins}</b></span>`;
  } else el.onlineNote.hidden = true;

  renderProgress(summary);
  const taunts = TAUNTS[won ? "win" : "lose"];
  lastMatch = { mode: "ai", won, winner: won ? setup.champ.name : oppName, p1name: setup.champ.name, p1img: setup.champ.img, p2name: oppName, p2img: oppChamp ? oppChamp.img : "img/icon-192.png", pScore: match.player, cScore: match.cpu, taunt: taunts[live.roundNo % taunts.length] };

  if (liveES) { try { liveES.close(); } catch {} liveES = null; }
  show("result"); injectIcons(el.resultCard); renderTopbar();
  if (won) { Confetti.burst(160); Sound.fanfare(); } else Sound.defeat();
  announce(won ? "You won the live match." : "You lost the live match.");
  if (summary.leveledUp) { setTimeout(() => Sound.level(), 500); setTimeout(() => showUnlocks(summary), 900); }
}

function buildPips() {
  el.pips.innerHTML = "";
  for (let i = 0; i < match.target; i++) { const s = document.createElement("span"); s.className = "pip"; el.pips.appendChild(s); }
}
function paintPips() {
  $$(".pip", el.pips).forEach((p, i) => {
    p.classList.remove("p-win", "c-win");
    if (i < match.player) p.classList.add("p-win");
    else if (i >= match.target - match.cpu) p.classList.add("c-win");
  });
}
function resetHands() {
  el.playerHand.dataset.state = "idle"; el.cpuHand.dataset.state = "idle";
  el.playerHand.classList.remove("win", "lose"); el.cpuHand.classList.remove("win", "lose");
  setGlyph(el.playerHand, "question"); setGlyph(el.cpuHand, "question");
}
function setGlyph(handEl, icon) { const g = handEl.querySelector(".hand__glyph"); g.setAttribute("data-icon", icon); g.innerHTML = ICONS[icon]; }
const setStatus = (m) => (el.battleStatus.textContent = m);
const announce = (m) => (el.srStatus.textContent = m);
const lockMoves = () => { match.locked = true; el.moves.classList.add("is-locked"); };
function unlockMoves() { match.locked = false; el.moves.classList.remove("is-locked"); $$(".move", el.moves).forEach((m) => m.classList.remove("is-picked")); }

/* --- AI personalities --- */
function cpuChoose() {
  const rnd = () => MOVES[(Math.random() * 3) | 0];
  const hist = match.playerHistory, last = hist[hist.length - 1];
  switch (setup.rivalId) {
    case "rookie":
      if (last && Math.random() < 0.5) return BEATS[last];
      return rnd();
    case "mirror":
      if (last && Math.random() < 0.7) return last;
      return rnd();
    case "duelist":
      return rnd();
    case "cycler":
      match.aiState.cyc = match.aiState.cyc == null ? ((Math.random() * 3) | 0) : (match.aiState.cyc + 1) % 3;
      return Math.random() < 0.25 ? rnd() : MOVES[match.aiState.cyc];
    case "grandmaster":
      if (hist.length >= 2 && Math.random() < 0.72) {
        const recent = hist.slice(-6), counts = { rock: 0, paper: 0, scissors: 0 };
        recent.forEach((m) => counts[m]++);
        const predicted = MOVES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
        return MOVES.find((m) => BEATS[m] === predicted);
      }
      return rnd();
    default: return rnd();
  }
}
const judge = (p, c) => (p === c ? "draw" : BEATS[p] === c ? "win" : "lose");

function playRound(playerMove) {
  if (!match.active || match.locked) return;
  lockMoves(); match.round++;
  match.playerHistory.push(playerMove);
  const cpuMove = match.mode === "accept" ? match.challengeMoves[match.round - 1] : cpuChoose();
  match.cpuHistory.push(cpuMove);
  const result = judge(playerMove, cpuMove);
  match.rounds.push({ p: playerMove, c: cpuMove, result });

  const picked = $(`.move[data-move="${playerMove}"]`, el.moves);
  if (picked) picked.classList.add("is-picked");
  Sound.pick();

  el.playerHand.classList.remove("win", "lose"); el.cpuHand.classList.remove("win", "lose");
  setGlyph(el.playerHand, playerMove); setGlyph(el.cpuHand, "question");
  el.verdict.className = "verdict"; el.verdict.textContent = "";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return revealRound(playerMove, cpuMove, result);

  el.playerHand.dataset.state = "shake"; el.cpuHand.dataset.state = "shake";
  const words = ["Rock", "Paper", "Scissors", "Shoot!"]; let i = 0; setStatus("");
  const step = () => {
    if (i < words.length) {
      const go = i === words.length - 1;
      el.countdown.innerHTML = `<span class="${go ? "go" : ""}">${words[i]}</span>`;
      go ? Sound.shoot() : Sound.tick(); i++;
      setTimeout(step, go ? 220 : 230);
    } else { el.countdown.textContent = ""; revealRound(playerMove, cpuMove, result); }
  };
  step();
}

function revealRound(playerMove, cpuMove, result) {
  setGlyph(el.playerHand, playerMove); setGlyph(el.cpuHand, cpuMove);
  el.playerHand.dataset.state = "reveal"; el.cpuHand.dataset.state = "reveal";
  if (result === "win") { match.player++; el.playerHand.classList.add("win"); el.cpuHand.classList.add("lose"); }
  else if (result === "lose") { match.cpu++; el.cpuHand.classList.add("win"); el.playerHand.classList.add("lose"); }
  match.maxDeficit = Math.max(match.maxDeficit, match.cpu - match.player);

  bumpScores(); paintPips();
  const pvp = match.mode === "pvp";
  const vmap = {
    win: { cls: "v-win", txt: pvp ? `${match.p1name} wins` : "You win!", snd: Sound.win },
    lose: { cls: "v-lose", txt: pvp ? `${match.p2name} wins` : "Rival wins", snd: Sound.lose },
    draw: { cls: "v-draw", txt: "Draw", snd: Sound.draw },
  }[result];
  el.verdict.className = `verdict show ${vmap.cls}`; el.verdict.textContent = vmap.txt; vmap.snd();
  const flavour = pvp ? {
    win: `${LABEL[playerMove]} beats ${LABEL[cpuMove]}.`,
    lose: `${LABEL[cpuMove]} beats ${LABEL[playerMove]}.`,
    draw: `Both threw ${LABEL[playerMove]}.`,
  }[result] : {
    win: `Your ${LABEL[playerMove]} beats ${LABEL[cpuMove]}.`,
    lose: `Their ${LABEL[cpuMove]} beats your ${LABEL[playerMove]}.`,
    draw: `Both threw ${LABEL[playerMove]}.`,
  }[result];
  setStatus(flavour);
  announce(`Round ${match.round}: ${vmap.txt}. ${flavour} Score ${match.player} to ${match.cpu}.`);
  addHistory(match.round, playerMove, cpuMove, result);

  const over = (match.fixedRounds && match.round >= match.fixedRounds) || match.player >= match.target || match.cpu >= match.target;
  if (over) setTimeout(endMatch, 1050);
  else setTimeout(() => {
    resetHands(); el.verdict.className = "verdict"; el.verdict.textContent = ""; unlockMoves();
    if (pvp) { match.phase = "p1"; setStatus(`${match.p1name} — make your move`); }
    else if (match.mode === "accept") setStatus(`Round ${match.round + 1} — make your move.`);
    else setStatus("Next round — make your move.");
  }, 1150);
}
function bumpScores() {
  el.playerScore.textContent = String(match.player); el.cpuScore.textContent = String(match.cpu);
  [el.playerScore, el.cpuScore].forEach((n) => { n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); });
}
const miniIcon = (m) => `<span class="mini" data-icon="${m}">${ICONS[m]}</span>`;
function addHistory(no, p, c, result) {
  const empty = el.historyList.querySelector(".history__empty"); if (empty) empty.remove();
  const li = document.createElement("li"); li.className = "round";
  const label = { win: "Won", lose: "Lost", draw: "Draw" }[result];
  li.innerHTML = `<span class="round__no">R${no}</span><span class="round__throws">${miniIcon(p)}<span class="vs">vs</span>${miniIcon(c)}</span><span class="round__result ${result}">${label}</span>`;
  el.historyList.prepend(li);
}

/* ---------- End of match + progression ---------- */
let lastMatch = null; // snapshot for the share card

function endMatch() {
  match.active = false;
  if (el.passCover) el.passCover.hidden = true;
  if (el.onlineNote) el.onlineNote.hidden = true;
  if (match.mode === "pvp") return endMatchPvp();
  if (match.mode === "accept") return endMatchChallenge();

  const won = match.player > match.cpu;
  const flawless = won && match.cpu === 0;
  const comeback = won && match.maxDeficit >= 2;
  const rival = RIVAL_BY_ID[setup.rivalId];

  if (el.progressBlock) el.progressBlock.hidden = false;

  const ctx = {
    won, playerScore: match.player, cpuScore: match.cpu, rounds: match.round,
    flawless, comeback, rivalStars: rival.stars, moves: match.playerHistory.slice(),
    champId: setup.champ.id,
  };
  const summary = recordMatch(ctx);

  el.resultCard.dataset.outcome = won ? "win" : "lose";
  el.resultBadge.textContent = won ? "👑" : "🥊";
  el.resultKicker.textContent = won ? "Match complete · Champion" : "Match complete";
  el.resultTitle.textContent = won ? "Victory" : "Defeated";
  el.resultLine.textContent = won
    ? `You out-read ${rival.name} and claimed the crown.${flawless ? " Flawless." : comeback ? " What a comeback!" : ""}`
    : `${rival.name} had your number this time. Shake it off and run it back.`;
  el.resultScoreline.innerHTML = `<span class="me">${match.player}</span><span class="sep">—</span><span class="cpu">${match.cpu}</span>`;
  const draws = match.round - (match.player + match.cpu);
  el.resultStats.innerHTML = `
    <div class="rstat"><div class="rstat__num">${match.round}</div><div class="rstat__label">Rounds</div></div>
    <div class="rstat"><div class="rstat__num">${draws}</div><div class="rstat__label">Draws</div></div>
    <div class="rstat"><div class="rstat__num">${profile.career.streak}</div><div class="rstat__label">Win streak</div></div>`;

  renderProgress(summary);
  renderReads(rival);
  show("result");
  injectIcons(el.resultCard);
  renderTopbar();

  if (won) { Confetti.burst(160); Sound.fanfare(); } else Sound.defeat();
  announce(won ? "You won the match." : "You lost the match.");

  const taunts = TAUNTS[won ? "win" : "lose"];
  lastMatch = { mode: "ai", won, winner: won ? setup.champ.name : rival.name,
    p1name: setup.champ.name, p1img: setup.champ.img, p2name: rival.name, p2img: rival.img,
    pScore: match.player, cScore: match.cpu, taunt: taunts[match.round % taunts.length] };

  if (summary.leveledUp) { setTimeout(() => Sound.level(), 500); setTimeout(() => showUnlocks(summary), 900); }
  else if (summary.newAchievements.length) setTimeout(() => summary.newAchievements.forEach((a, i) => setTimeout(() => toast(`<span class="toast__ic">${a.icon}</span><div><b>Achievement</b><br>${a.name}</div>`), i * 900)), 700);
}

/* Pass & Play match end — no progression, neutral framing */
function endMatchPvp() {
  const p1won = match.player > match.cpu;
  const winner = p1won ? match.p1name : match.p2name;
  const wScore = Math.max(match.player, match.cpu), lScore = Math.min(match.player, match.cpu);

  if (el.progressBlock) el.progressBlock.hidden = true;
  if (el.readsPanel) el.readsPanel.hidden = true;

  el.resultCard.dataset.outcome = "win";
  el.resultBadge.textContent = "🏆";
  el.resultKicker.textContent = "Pass & Play · Match complete";
  el.resultTitle.textContent = `${winner} wins`;
  el.resultLine.textContent = `${winner} takes the crown ${wScore}–${lScore}. Run it back?`;
  el.resultScoreline.innerHTML = `<span class="me">${match.player}</span><span class="sep">—</span><span class="cpu">${match.cpu}</span>`;
  const draws = match.round - (match.player + match.cpu);
  el.resultStats.innerHTML = `
    <div class="rstat"><div class="rstat__num">${match.round}</div><div class="rstat__label">Rounds</div></div>
    <div class="rstat"><div class="rstat__num">${draws}</div><div class="rstat__label">Draws</div></div>
    <div class="rstat"><div class="rstat__num">${wScore}–${lScore}</div><div class="rstat__label">Final</div></div>`;

  const taunts = TAUNTS.win;
  lastMatch = { mode: "pvp", won: true, winner,
    p1name: match.p1name, p1img: match.p1img, p2name: match.p2name, p2img: match.p2img,
    pScore: match.player, cScore: match.cpu, taunt: taunts[match.round % taunts.length] };

  show("result");
  injectIcons(el.resultCard);
  Confetti.burst(160); Sound.fanfare();
  announce(`${winner} won the match.`);
}

/* Challenge (accept) match end — records with XP + challenge W/L */
function endMatchChallenge() {
  const won = match.player > match.cpu;
  const tie = match.player === match.cpu;
  const foeName = match.p2name;

  const ctx = {
    won, playerScore: match.player, cpuScore: match.cpu, rounds: match.round,
    flawless: won && match.cpu === 0, comeback: won && match.maxDeficit >= 2,
    rivalStars: 2, moves: match.playerHistory.slice(), champId: setup.champ.id, challenge: true,
  };
  const summary = recordMatch(ctx);

  if (el.progressBlock) el.progressBlock.hidden = false;
  if (el.readsPanel) el.readsPanel.hidden = true;

  el.resultCard.dataset.outcome = won ? "win" : tie ? "draw" : "lose";
  el.resultBadge.textContent = won ? "🏆" : tie ? "🤝" : "🥊";
  el.resultKicker.textContent = "Challenge · Gauntlet";
  el.resultTitle.textContent = won ? "Gauntlet beaten!" : tie ? "Dead heat" : "Gauntlet holds";
  el.resultLine.textContent = won
    ? `You out-read ${foeName}'s gauntlet ${match.player}–${match.cpu}. Send one back!`
    : tie ? `Locked at ${match.player}–${match.cpu} against ${foeName}. So close.`
    : `${foeName}'s gauntlet held ${match.cpu}–${match.player}. Run it back.`;
  el.resultScoreline.innerHTML = `<span class="me">${match.player}</span><span class="sep">—</span><span class="cpu">${match.cpu}</span>`;
  const draws = match.round - (match.player + match.cpu);
  el.resultStats.innerHTML = `
    <div class="rstat"><div class="rstat__num">${match.round}</div><div class="rstat__label">Rounds</div></div>
    <div class="rstat"><div class="rstat__num">${draws}</div><div class="rstat__label">Draws</div></div>
    <div class="rstat"><div class="rstat__num">${profile.career.challengesWon}</div><div class="rstat__label">Challenges won</div></div>`;

  renderProgress(summary);
  const taunts = TAUNTS[won ? "win" : "lose"];
  lastMatch = { mode: "ai", won, winner: won ? setup.champ.name : foeName,
    p1name: setup.champ.name, p1img: setup.champ.img, p2name: foeName, p2img: match.p2img,
    pScore: match.player, cScore: match.cpu, taunt: taunts[match.round % taunts.length] };

  // online: record the shared head-to-head result
  if (match.online && match.challengeId && net.online()) {
    el.onlineNote.hidden = false;
    el.onlineNote.innerHTML = `<span class="h2h__saving">Saving to your rivalry…</span>`;
    (async () => {
      try {
        const me = await ensureIdentity();
        const r = await net.submitResult(match.challengeId, me.id, me.name, setup.champ.id, match.player, match.cpu);
        const rv = r.rivalry;
        const meWins = rv.a === me.id ? rv.aWins : rv.bWins;
        const themWins = rv.a === me.id ? rv.bWins : rv.aWins;
        el.onlineNote.innerHTML = `<span class="h2h__label">Head-to-head vs ${r.challengerName}</span><span class="h2h__score"><b class="me">${meWins}</b><span class="sep">–</span><b class="them">${themWins}</b></span>`;
      } catch { el.onlineNote.hidden = true; }
    })();
  } else el.onlineNote.hidden = true;

  show("result"); injectIcons(el.resultCard); renderTopbar();
  if (won) { Confetti.burst(160); Sound.fanfare(); } else Sound.defeat();
  announce(won ? "You beat the gauntlet." : "The gauntlet held.");
  if (summary.leveledUp) { setTimeout(() => Sound.level(), 500); setTimeout(() => showUnlocks(summary), 900); }
}

function renderProgress(s) {
  if (!el.xpFill) return;
  el.rLevelFrom.textContent = "Lv " + s.before.level;
  el.rLevelTo.textContent = "Lv " + s.after.level;
  el.levelUpTag.hidden = !s.leveledUp;
  el.xpGain.textContent = `+${s.xpGained} XP`;
  el.xpBreakdown.innerHTML = s.breakdown.map((b) => `<li><span>${b.label}</span><b>+${b.xp}</b></li>`).join("");
  el.xpFill.style.transition = "none";
  el.xpFill.style.width = Math.round(s.before.progress * 100) + "%";
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.xpFill.style.transition = "width 1s cubic-bezier(.22,1,.36,1) .25s";
    el.xpFill.style.width = Math.round((s.leveledUp ? 1 : s.after.progress) * 100) + "%";
  }));
}

/* ---------- Post-match "reads" analysis ---------- */
function renderReads(rival) {
  if (!el.readsPanel) return;
  const h = match.playerHistory, n = h.length;
  if (n < 3) { el.readsPanel.hidden = true; return; }
  const counts = { rock: 0, paper: 0, scissors: 0 };
  h.forEach((m) => counts[m]++);
  const fav = MOVES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
  const favPct = Math.round((counts[fav] / n) * 100);
  let repeats = 0;
  for (let i = 1; i < n; i++) if (h[i] === h[i - 1]) repeats++;
  const repeatPct = Math.round((repeats / (n - 1)) * 100);

  let body;
  if (favPct >= 50) body = `You leaned on <b>${LABEL[fav]}</b> — <b>${favPct}%</b> of your ${n} throws.`;
  else if (repeatPct >= 40) body = `You repeated your previous move <b>${repeatPct}%</b> of the time — a habit rivals exploit.`;
  else body = `You spread your throws well (${favPct}% ${LABEL[fav]}). Genuinely tough to predict.`;

  const predictable = favPct >= 50 || repeatPct >= 40;
  const tips = {
    rookie: predictable ? `Even the Rookie can punish a pattern — keep mixing it up.` : `Clean play. Step up to a tougher rival.`,
    mirror: `The Mirror copies your last move, so throwing what beats your <em>own</em> previous move wins the exchange.`,
    duelist: predictable ? `The Duelist is pure luck — but a habit still leaves you exposed to sharper rivals.` : `Perfectly balanced against a coin-flip rival.`,
    cycler: `The Cycler rotates Rock → Paper → Scissors. Track its last throw and cut off the next.`,
    grandmaster: predictable ? `The Grandmaster counters your favourite — cut back on <b>${LABEL[fav]}</b> and stay random.` : `You out-randomised the Grandmaster. Elite reads.`,
  };
  el.readsRival.textContent = rival.name;
  el.readsBody.innerHTML = body;
  el.readsTip.innerHTML = `<span class="reads__tiplabel">Tip</span> ${tips[rival.id] || tips.duelist}`;
  el.readsPanel.hidden = false;
}

/* ---------- Unlock / celebration sheet ---------- */
function showUnlocks(s) {
  const sheet = document.getElementById("unlockSheet");
  const body = document.getElementById("unlockBody");
  if (!sheet || !body) return;
  const champs = s.unlocks.filter((u) => u.type === "champion");
  const arenas = s.unlocks.filter((u) => u.type === "arena");
  body.innerHTML = `
    <div class="unlock__level"><span class="unlock__ring">${s.after.level}</span></div>
    <h2 class="sheet__title">Level ${s.after.level}!</h2>
    <p class="sheet__lede">${s.unlocks.length ? "New rewards unlocked." : "Keep the streak going."}</p>
    ${champs.length ? `<div class="unlock__grid">${champs.map((c) => `<div class="unlock__item"><img src="${c.img}" alt="${c.name}"/><span>${c.name}</span><em>Champion</em></div>`).join("")}</div>` : ""}
    ${arenas.length ? `<div class="unlock__arenas">${arenas.map((a) => `<span class="unlock__arena">🎨 ${a.name} arena</span>`).join("")}</div>` : ""}
    ${s.newAchievements.length ? `<div class="unlock__ach">${s.newAchievements.map((a) => `<span class="ach-pill">${a.icon} ${a.name}</span>`).join("")}</div>` : ""}
    <button class="btn btn--primary btn--block" data-close type="button">Nice</button>`;
  openSheet(sheet);
  $$("[data-close]", sheet).forEach((b) => b.addEventListener("click", () => closeSheet(sheet), { once: true }));
}

/* ---------- Profile screen ---------- */
function leaderboardHTML(c) {
  const rows = CHAMPIONS
    .map((ch) => ({ ch, plays: c.playsByChamp[ch.id] || 0, wins: c.winsByChamp[ch.id] || 0 }))
    .filter((x) => x.plays > 0)
    .sort((a, b) => b.wins - a.wins || b.wins / b.plays - a.wins / a.plays || b.plays - a.plays)
    .slice(0, 6);
  if (!rows.length) return `<div class="career__empty"><span>🏅</span><div>Play some matches to rank your champions here.</div></div>`;
  const medals = ["🥇", "🥈", "🥉"];
  return `<ol class="lb">${rows.map((r, i) => {
    const pct = Math.round((r.wins / r.plays) * 100);
    return `<li class="lb__row"><span class="lb__rank">${medals[i] || i + 1}</span><img class="lb__av" src="${r.ch.img}" alt="" loading="lazy"/><span class="lb__name">${r.ch.name}</span><span class="lb__bar"><i style="width:${pct}%"></i></span><span class="lb__stat"><b>${r.wins}</b>/${r.plays} · ${pct}%</span></li>`;
  }).join("")}</ol>`;
}

async function renderOnlineSections() {
  const host = document.getElementById("onlineSections");
  if (!host) return;
  if (!net.online()) {
    host.innerHTML = `<h3 class="panel__title">Online play</h3><div class="career__empty"><span>🌐</span><div>Offline mode — challenge links still work and stats stay on this device. Deploy the backend to share records with friends.</div></div>`;
    return;
  }
  const me = identity();
  host.innerHTML = `<h3 class="panel__title">Rivalries <span class="muted">${me.name ? "as " + me.name : ""}</span></h3><div class="career__empty" id="rivLoad"><span>⏳</span><div>Loading your online records…</div></div>`;
  if (!hasIdentity()) { document.getElementById("rivLoad").innerHTML = `<span>🌐</span><div>Set a display name (create or accept a challenge) to start building online rivalries.</div>`; return; }
  try {
    const [rv, lb] = await Promise.all([net.getRivalries(me.id).catch(() => ({ rivalries: [] })), net.getLeaderboard().catch(() => ({ leaderboard: [] }))]);
    const rivals = rv.rivalries || [];
    const rivalsHTML = rivals.length
      ? `<ol class="lb">${rivals.map((r) => `<li class="lb__row lb__row--h2h"><span class="lb__vs">vs</span><span class="lb__name">${r.name}</span><span class="lb__bar"><i style="width:${r.games ? Math.round((r.youWins / r.games) * 100) : 0}%"></i></span><span class="lb__stat"><b class="me">${r.youWins}</b> – <b class="them">${r.themWins}</b></span></li>`).join("")}</ol>`
      : `<div class="career__empty"><span>🤝</span><div>No rivalries yet — send a challenge link to a friend to start one.</div></div>`;
    const meRow = (lb.leaderboard || []).find((x) => x.id === me.id);
    const lbHTML = (lb.leaderboard || []).length
      ? `<ol class="lb">${lb.leaderboard.map((x, i) => { const pct = x.played ? Math.round((x.wins / x.played) * 100) : 0; const medals = ["🥇", "🥈", "🥉"]; return `<li class="lb__row ${x.id === me.id ? "lb__row--you" : ""}"><span class="lb__rank">${medals[i] || i + 1}</span><span class="lb__name">${x.name}${x.id === me.id ? " <em>(you)</em>" : ""}</span><span class="lb__bar"><i style="width:${pct}%"></i></span><span class="lb__stat"><b>${x.wins}</b>W · ${pct}%</span></li>`; }).join("")}</ol>`
      : `<div class="career__empty"><span>🏆</span><div>The global leaderboard is empty — be the first to post a win.</div></div>`;
    host.innerHTML = `
      <h3 class="panel__title">Rivalries <span class="muted">${me.name ? "as " + me.name : ""}</span></h3>
      ${rivalsHTML}
      <h3 class="panel__title" style="margin-top:24px">Global leaderboard ${meRow ? `<span class="muted">you: #${(lb.leaderboard.findIndex((x) => x.id === me.id) + 1)}</span>` : ""}</h3>
      ${lbHTML}`;
  } catch {
    host.innerHTML = `<h3 class="panel__title">Online play</h3><div class="career__empty"><span>⚠️</span><div>Couldn't reach the online server. Records will sync when it's back.</div></div>`;
  }
}

function renderProfile() {
  if (!el.profileBody) return;
  const c = profile.career, info = levelInfo();
  const played = c.wins + c.losses + c.draws || 1;
  const rate = Math.round((c.wins / played) * 100);
  const totalMoves = c.movesThrown.rock + c.movesThrown.paper + c.movesThrown.scissors || 1;
  const movePct = (m) => Math.round((c.movesThrown[m] / totalMoves) * 100);
  const achUnlocked = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]).length;

  el.profileBody.innerHTML = `
    <div class="prof-hero">
      <div class="prof-level"><span class="prof-level__ring" style="--p:${info.progress}"><b>${info.level}</b></span></div>
      <div class="prof-hero__meta">
        <h2 class="section-title">Level ${info.level}</h2>
        <div class="prof-xpbar"><i style="width:${Math.round(info.progress * 100)}%"></i></div>
        <p class="prof-xp">${info.into} / ${info.need} XP to level ${info.level + 1}</p>
      </div>
    </div>
    <div class="prof-stats">
      <div class="stat"><div class="stat__num is-win">${c.wins}</div><div class="stat__label">Wins</div></div>
      <div class="stat"><div class="stat__num is-lose">${c.losses}</div><div class="stat__label">Losses</div></div>
      <div class="stat"><div class="stat__num">${rate}%</div><div class="stat__label">Win rate</div></div>
      <div class="stat"><div class="stat__num is-streak">${c.bestStreak}</div><div class="stat__label">Best streak</div></div>
      <div class="stat"><div class="stat__num">${c.rounds}</div><div class="stat__label">Rounds</div></div>
      <div class="stat"><div class="stat__num">${c.matches}</div><div class="stat__label">Matches</div></div>
    </div>
    <div class="panel">
      <h3 class="panel__title">Your throws</h3>
      <div class="movebars">
        ${["rock", "paper", "scissors"].map((m) => `
          <div class="movebar"><span class="movebar__ic mv-${m}" data-icon="${m}">${ICONS[m]}</span>
            <div class="movebar__track"><i class="mv-${m}" style="width:${movePct(m)}%"></i></div><b>${movePct(m)}%</b></div>`).join("")}
      </div>
    </div>
    <div class="prof-section">
      <h3 class="panel__title">Achievements <span class="muted">${achUnlocked}/${ACHIEVEMENTS.length}</span></h3>
      <div class="ach-grid">
        ${ACHIEVEMENTS.map((a) => { const got = !!profile.achievements[a.id];
          return `<div class="ach ${got ? "is-got" : ""}" title="${a.desc}"><span class="ach__ic">${got ? a.icon : ICONS.lock}</span><span class="ach__name">${a.name}</span><span class="ach__desc">${a.desc}</span></div>`; }).join("")}
      </div>
    </div>
    <div class="prof-section">
      <h3 class="panel__title">Champion leaderboard <span class="muted">${(c.challengesWon || 0)}W / ${(c.challengesLost || 0)}L in challenges</span></h3>
      ${leaderboardHTML(c)}
    </div>

    <div class="prof-section">
      <h3 class="panel__title">Champions <span class="muted">${profile.unlocks.champions.length}/${CHAMPIONS.length}</span></h3>
      <div class="gallery">
        ${CHAMPIONS.map((ch) => { const got = champUnlocked(ch.id);
          return `<div class="gitem ${got ? "" : "is-locked"}"><img src="${ch.img}" alt="${ch.name}" loading="lazy"/>${got ? "" : `<span class="gitem__lock">${ICONS.lock}<b>Lv ${ch.unlockLevel}</b></span>`}<span class="gitem__name">${ch.name}</span></div>`; }).join("")}
      </div>
    </div>
    <div class="prof-section">
      <h3 class="panel__title">Arena</h3>
      <div class="arena-picker">
        ${ARENAS.map((a) => { const got = arenaUnlocked(a.id), on = profile.settings.arena === a.id;
          return `<button class="arena-swatch ${on ? "is-on" : ""} ${got ? "" : "is-locked"}" data-arena="${a.id}" ${got ? "" : "disabled"} title="${got ? a.name : `Unlocks at level ${a.unlockLevel}`}"><span style="background:linear-gradient(120deg,${a.a},${a.b})"></span>${a.name}${got ? "" : ` · Lv ${a.unlockLevel}`}</button>`; }).join("")}
      </div>
    </div>
    <div class="prof-section" id="onlineSections"></div>

    <div class="danger"><button class="link-btn danger__btn" id="resetBtn" type="button">Reset all progress</button></div>`;

  injectIcons(el.profileBody);
  renderOnlineSections();
  $$(".arena-swatch:not(.is-locked)", el.profileBody).forEach((b) => b.addEventListener("click", () => { applyArena(b.dataset.arena); renderProfile(); Sound.tick(); }));
  const reset = document.getElementById("resetBtn");
  if (reset) reset.addEventListener("click", () => {
    if (confirm("Reset all progress, unlocks and achievements? This cannot be undone.")) {
      resetProfile(); soundOn = true; applyArena("nebula"); toast("Progress reset."); renderProfile(); renderTopbar();
    }
  });
}

/* ---------- Shareable match card ---------- */
function loadImg(src) {
  return new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
function drawAvatarCircle(g, im, cx, cy, r, ring) {
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.closePath(); g.clip();
  if (im) { const s = Math.max((2 * r) / im.width, (2 * r) / im.height); const w = im.width * s, h = im.height * s; g.drawImage(im, cx - w / 2, cy - h / 2, w, h); }
  else { g.fillStyle = "#1a1d2e"; g.fillRect(cx - r, cy - r, 2 * r, 2 * r); }
  g.restore();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.lineWidth = 7; g.strokeStyle = ring; g.stroke();
}
async function drawMatchCard() {
  const lm = lastMatch; if (!lm) return null;
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch {}
  const W = 1200, H = 630, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#0c1030"); bg.addColorStop(1, "#0a0b14");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 40, 40, W / 2, 40, 760);
  glow.addColorStop(0, lm.won ? "rgba(74,222,128,.34)" : "rgba(255,107,125,.3)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);

  g.textBaseline = "alphabetic"; g.textAlign = "left";
  g.fillStyle = "#f3f4fb"; g.font = '700 40px "Space Grotesk", system-ui, sans-serif';
  g.fillText("RIVALS", 64, 92);
  g.font = '500 22px Inter, system-ui, sans-serif'; g.fillStyle = "#8186a3";
  g.fillText("ROCK · PAPER · SCISSORS", 66, 122);

  g.textAlign = "center";
  const title = lm.mode === "pvp" ? `${lm.winner.toUpperCase()} WINS` : (lm.won ? "VICTORY" : "DEFEAT");
  g.font = '700 84px "Space Grotesk", system-ui, sans-serif';
  g.fillStyle = lm.won ? "#5ee08e" : "#ff6b7d";
  if (lm.mode === "pvp") g.fillStyle = "#b49bff";
  g.fillText(title, W / 2, 232);

  const [a, b] = await Promise.all([loadImg(lm.p1img), loadImg(lm.p2img)]);
  drawAvatarCircle(g, a, 330, 400, 108, "#8b6bff");
  drawAvatarCircle(g, b, 870, 400, 108, "#ff7a90");

  g.font = '700 96px "Space Grotesk", system-ui, sans-serif'; g.fillStyle = "#f3f4fb"; g.textBaseline = "middle";
  g.fillText(`${lm.pScore}–${lm.cScore}`, W / 2, 400);
  g.textBaseline = "alphabetic";
  g.font = '600 34px Inter, system-ui, sans-serif'; g.fillStyle = "#f3f4fb";
  g.fillText(lm.p1name, 330, 552); g.fillText(lm.p2name, 870, 552);

  g.font = 'italic 27px Inter, system-ui, sans-serif'; g.fillStyle = "#b9bcd0";
  g.fillText(`“${lm.taunt}”`, W / 2, 600);
  g.textAlign = "left";
  return cv;
}
const canvasToBlob = (cv) => new Promise((res) => cv.toBlob(res, "image/png"));

async function drawChallengeCard(champ, roundsN) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch {}
  const W = 1200, H = 630, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#161036"); bg.addColorStop(1, "#0a0b14");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 60, 40, W / 2, 60, 780);
  glow.addColorStop(0, "rgba(139,107,255,.4)"); glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = "#f3f4fb"; g.font = '700 40px "Space Grotesk", system-ui, sans-serif'; g.fillText("RIVALS", 64, 92);
  g.font = '500 22px Inter, system-ui, sans-serif'; g.fillStyle = "#8186a3"; g.fillText("ROCK · PAPER · SCISSORS", 66, 122);
  g.textAlign = "center";
  g.font = '700 76px "Space Grotesk", system-ui, sans-serif'; g.fillStyle = "#b49bff";
  g.fillText("BEAT MY GAUNTLET", W / 2, 240);
  const img = await loadImg(champ.img); drawAvatarCircle(g, img, W / 2, 400, 118, "#8b6bff");
  g.font = '600 34px Inter, system-ui, sans-serif'; g.fillStyle = "#f3f4fb"; g.fillText(champ.name, W / 2, 560);
  g.font = 'italic 26px Inter, system-ui, sans-serif'; g.fillStyle = "#b9bcd0";
  g.fillText(`Best of ${roundsN} — open the link and out-read me.`, W / 2, 602);
  g.textAlign = "left";
  return cv;
}

let shareCtx = { kind: "result", link: "" };
function openShareWith(cv, ctx) {
  const sheet = document.getElementById("shareSheet"); if (!sheet || !cv) return;
  sheet._canvas = cv; shareCtx = ctx;
  el.sharePreview.src = cv.toDataURL("image/png");
  el.shareNativeBtn.style.display = (navigator.canShare && navigator.share) ? "" : "none";
  const title = sheet.querySelector(".sheet__title"), lede = sheet.querySelector(".sheet__lede");
  if (title) title.textContent = ctx.kind === "challenge" ? "Send your challenge" : "Share your result";
  if (lede) lede.textContent = ctx.kind === "challenge" ? "Share the link — your friend plays against your gauntlet." : "A match card, ready to post anywhere.";
  openSheet(sheet);
}
async function openShare() { if (!lastMatch) return; Sound.tick(); const cv = await drawMatchCard(); openShareWith(cv, { kind: "result", link: location.href.split("#")[0] }); }
async function openShareChallenge(link) { Sound.tick(); const cv = await drawChallengeCard(setup.champ, CHALLENGE_ROUNDS); openShareWith(cv, { kind: "challenge", link }); }

async function shareNative() {
  const sheet = document.getElementById("shareSheet"); const cv = sheet && sheet._canvas; if (!cv) return;
  try {
    const blob = await canvasToBlob(cv);
    const file = new File([blob], "rivals.png", { type: "image/png" });
    const text = shareCtx.kind === "challenge"
      ? `Beat my RIVALS gauntlet! ${shareCtx.link}`
      : `${lastMatch ? lastMatch.winner : "I"} won on RIVALS! ${shareCtx.link}`;
    if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "RIVALS", text });
    else await navigator.share({ title: "RIVALS", text });
  } catch {}
}
async function shareDownload() {
  const sheet = document.getElementById("shareSheet"); const cv = sheet && sheet._canvas; if (!cv) return;
  const a = document.createElement("a"); a.download = shareCtx.kind === "challenge" ? "rivals-challenge.png" : "rivals-result.png"; a.href = cv.toDataURL("image/png");
  document.body.appendChild(a); a.click(); a.remove(); toast("Image downloaded.");
}
async function shareCopy() {
  const link = shareCtx.link || location.href.split("#")[0];
  try { await navigator.clipboard.writeText(link); toast(shareCtx.kind === "challenge" ? "Challenge link copied!" : "Link copied to clipboard."); }
  catch { toast("Copy the link from your address bar to share."); }
}

/* ---------- Sheets ---------- */
let lastFocus = null;
function openSheet(sheet) {
  lastFocus = document.activeElement; sheet.hidden = false; injectIcons(sheet);
  const f = sheet.querySelector(".sheet__close, [data-close], button"); f && f.focus();
  sheet._keys = (e) => sheetKeys(e, sheet); document.addEventListener("keydown", sheet._keys);
}
function closeSheet(sheet) { sheet.hidden = true; document.removeEventListener("keydown", sheet._keys); lastFocus && lastFocus.focus && lastFocus.focus(); }
function sheetKeys(e, sheet) {
  if (e.key === "Escape") { e.preventDefault(); closeSheet(sheet); }
  if (e.key === "Tab") {
    const items = $$('button, a, [tabindex]:not([tabindex="-1"])', sheet).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

/* ---------- Theme ---------- */
function applyTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  profile.settings.theme = t; save();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t === "light" ? "#f4f5fb" : "#0a0b14");
  if (el.themeBtn) el.themeBtn.setAttribute("aria-pressed", String(t === "light"));
}
function toggleTheme() { applyTheme(profile.settings.theme === "light" ? "dark" : "light"); Sound.tick(); }

/* ---------- Sound toggle ---------- */
function toggleSound() {
  soundOn = !soundOn; el.soundBtn.setAttribute("aria-pressed", String(soundOn));
  profile.settings.sound = soundOn; save();
  if (soundOn) { Sound.resume(); Sound.pick(); }
}

/* ---------- Keyboard ---------- */
function onKey(e) {
  const openSheetEl = $(".sheet:not([hidden])"); if (openSheetEl) return;
  if (current === "battle") {
    if (match.mode === "pvp" && el.passCover && !el.passCover.hidden) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); passReady(); }
      return;
    }
    const map = { r: "rock", p: "paper", s: "scissors" }, k = e.key.toLowerCase();
    if (map[k] && !match.locked && match.active) { e.preventDefault(); throwMove(map[k]); }
    if (e.key === "Escape") { e.preventDefault(); forfeit(); }
  }
}
function forfeit() {
  if (!match.active) return;
  match.active = false;
  if (el.passCover) el.passCover.hidden = true;
  if (match.mode === "ai") {
    recordMatch({ won: false, playerScore: match.player, cpuScore: match.cpu, rounds: match.round, flawless: false, comeback: false, rivalStars: RIVAL_BY_ID[setup.rivalId].stars, moves: match.playerHistory.slice(), champId: setup.champ.id });
    renderTopbar();
  }
  show("setup");
}

/* ---------- Wire up ---------- */
function bind() {
  $$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); const dest = b.dataset.nav; if (dest === "setup") Sound.resume(); show(dest); }));
  el.roster.addEventListener("click", (e) => { const c = e.target.closest(".champ"); if (c) selectChamp(c.dataset.id); });
  el.roster.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { const c = e.target.closest(".champ"); if (c) { e.preventDefault(); selectChamp(c.dataset.id); } } });
  if (el.rivalPicker) {
    el.rivalPicker.addEventListener("click", (e) => { const r = e.target.closest(".rival"); if (r) selectRival(r.dataset.id); });
    el.rivalPicker.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { const r = e.target.closest(".rival"); if (r) { e.preventDefault(); selectRival(r.dataset.id); } } });
  }
  bindLength();
  if (el.modeSwitch) $$(".mode", el.modeSwitch).forEach((b) => b.addEventListener("click", () => selectMode(b.dataset.mode)));
  el.startBtn.addEventListener("click", startMatch);
  el.rematchBtn.addEventListener("click", startMatch);
  el.quitBtn.addEventListener("click", forfeit);
  if (el.passBtn) el.passBtn.addEventListener("click", passReady);
  if (el.liveCopyBtn) el.liveCopyBtn.addEventListener("click", async () => { const link = live && live._link; if (!link) return; try { await navigator.clipboard.writeText(link); toast("Invite link copied!"); } catch { toast("Copy the link from your address bar."); } });
  if (el.liveCancelBtn) el.liveCancelBtn.addEventListener("click", () => { teardownLive(); match.active = false; show("setup"); });
  $$(".move", el.moves).forEach((m) => m.addEventListener("click", () => throwMove(m.dataset.move)));

  const howto = document.getElementById("howtoSheet");
  $("#howtoBtn").addEventListener("click", () => openSheet(howto));
  const h2 = document.getElementById("howtoBtn2"); h2 && h2.addEventListener("click", () => openSheet(howto));
  $$("[data-close]", howto).forEach((b) => b.addEventListener("click", () => closeSheet(howto)));

  const shareSheet = document.getElementById("shareSheet");
  if (el.shareBtn) el.shareBtn.addEventListener("click", openShare);
  if (shareSheet) $$("[data-close]", shareSheet).forEach((b) => b.addEventListener("click", () => closeSheet(shareSheet)));
  if (el.shareNativeBtn) el.shareNativeBtn.addEventListener("click", shareNative);
  if (el.shareDownloadBtn) el.shareDownloadBtn.addEventListener("click", shareDownload);
  if (el.shareCopyBtn) el.shareCopyBtn.addEventListener("click", shareCopy);

  const nameSheet = document.getElementById("nameSheet");
  if (nameSheet) {
    if (el.nameSaveBtn) el.nameSaveBtn.addEventListener("click", saveName);
    if (el.nameInput) el.nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveName(); } });
    $$("[data-close]", nameSheet).forEach((b) => b.addEventListener("click", () => { closeSheet(nameSheet); const r = _nameResolve; _nameResolve = null; if (r) r(hasIdentity() ? identity() : null); }));
  }

  el.soundBtn.addEventListener("click", toggleSound);
  el.soundBtn.setAttribute("aria-pressed", String(soundOn));
  if (el.themeBtn) el.themeBtn.addEventListener("click", toggleTheme);
  document.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", () => Sound.resume(), { once: true });
}

/* ---------- Service worker (PWA / offline) ---------- */
function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
}

/* ---------- Boot ---------- */
async function resolvePending() {
  const g = (location.hash || "").match(/[#&]g=([A-Za-z0-9_-]+)/);
  if (g) {
    if (!net.online()) { toast("This challenge needs the online server. Playing offline."); return null; }
    try {
      const c = await net.getChallenge(g[1]);
      if (c && Array.isArray(c.moves) && c.moves.length && CHAMPIONS.find((x) => x.id === c.champId)) {
        return { c: c.champId, m: c.moves, online: true, id: c.id, name: c.name };
      }
    } catch { toast("Couldn't load that challenge."); }
    return null;
  }
  return parseChallengeFromUrl(); // offline embed (#c=)
}

async function boot() {
  applyTheme(profile.settings.theme || "dark");
  applyArena(profile.settings.arena || "nebula");
  registerSW();
  injectIcons(document);
  buildRivalPicker();
  bind();
  renderTopbar();
  let routed = false;
  const liveM = (location.hash || "").match(/[#&]live=([A-Za-z0-9]+)/);
  if (liveM) {
    if (!net.online()) toast("Live play needs the online server.");
    else {
      try {
        const room = await net.getRoom(liveM[1]);
        if (room && room.status !== "finished" && (room.order || []).length < 2) {
          const hostId = room.order[0], hp = room.players[hostId], hc = CHAMPIONS.find((c) => c.id === hp.champId);
          pendingLive = { id: liveM[1], hostName: hp.name, hostImg: hc ? hc.img : "" };
          setup.mode = "live"; show("setup");
          if (!hasIdentity()) ensureIdentity();
          routed = true;
        } else toast("That live match is full or already finished.");
      } catch { toast("Live match not found."); }
    }
  }
  if (!routed) {
    pendingChallenge = await resolvePending();
    if (pendingChallenge) {
      setup.mode = "accept"; show("setup");
      if (pendingChallenge.online && !hasIdentity()) ensureIdentity();
    } else show("home");
  }
  requestAnimationFrame(() => $$(".reveal").forEach((r) => { r.style.animationDelay = (parseInt(r.dataset.r || "1", 10) - 1) * 90 + "ms"; r.classList.add("in"); }));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
