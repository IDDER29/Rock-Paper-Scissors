/* =========================================================
   RIVALS — Rock Paper Scissors
   Engine · AI personalities · progression · FX · routing
   ========================================================= */
import {
  CHAMPIONS, RIVALS, RIVAL_BY_ID, ARENAS, ARENA_BY_ID, ACHIEVEMENTS,
} from "./data.js";
import {
  profile, save, levelInfo, currentLevel, champUnlocked, arenaUnlocked,
  ensureDaily, dailyLabel, recordMatch, resetProfile,
} from "./profile.js";

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
  current = name;
  document.body.dataset.screen = name;
  SCREENS.forEach((s) => {
    const node = document.getElementById("screen-" + s);
    if (!node) return;
    if (s === name) { node.hidden = false; node.classList.remove("is-entering"); void node.offsetWidth; node.classList.add("is-entering"); }
    else node.hidden = true;
  });
  window.scrollTo({ top: 0 });
  if (name === "home") renderHome();
  if (name === "setup") { renderRoster(); updateSummary(); }
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

/* ---------- Setup ---------- */
const setup = { champ: null, rivalId: "duelist", length: 5 };

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
  const r = RIVAL_BY_ID[setup.rivalId];
  if (!setup.champ) { el.setupSummary.innerHTML = "Pick a champion to continue."; el.startBtn.disabled = true; return; }
  el.setupSummary.innerHTML = `Playing as <b>${setup.champ.name}</b> vs <b>${r.name}</b> · first to <b>${setup.length}</b>.`;
  el.startBtn.disabled = false;
}

/* ---------- Battle engine ---------- */
const match = {
  active: false, locked: false, round: 0, player: 0, cpu: 0, target: 5,
  playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
};

function startMatch() {
  if (!setup.champ) return;
  Sound.resume();
  Object.assign(match, {
    active: true, locked: false, round: 0, player: 0, cpu: 0, target: setup.length,
    playerHistory: [], cpuHistory: [], rounds: [], maxDeficit: 0, aiState: {},
  });
  const rival = RIVAL_BY_ID[setup.rivalId];
  el.playerAvatar.src = setup.champ.img; el.playerAvatar.alt = setup.champ.name;
  el.playerName.textContent = setup.champ.name;
  el.cpuAvatar.src = rival.img; el.cpuAvatar.alt = rival.name;
  el.cpuName.textContent = rival.name; el.cpuTag.textContent = rival.tag;
  el.cpuHandCaption.textContent = rival.name;
  el.playerScore.textContent = "0"; el.cpuScore.textContent = "0";
  el.targetLabel.textContent = `First to ${match.target}`;
  buildPips(); resetHands();
  el.historyList.innerHTML = `<li class="history__empty">No rounds yet — throw your first move to begin the story.</li>`;
  el.verdict.className = "verdict"; el.verdict.textContent = "";
  setStatus("Make your move.");
  unlockMoves(); show("battle"); injectIcons(el.moves);
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
  const cpuMove = cpuChoose();
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
  const vmap = {
    win: { cls: "v-win", txt: "You win!", snd: Sound.win },
    lose: { cls: "v-lose", txt: "Rival wins", snd: Sound.lose },
    draw: { cls: "v-draw", txt: "Draw", snd: Sound.draw },
  }[result];
  el.verdict.className = `verdict show ${vmap.cls}`; el.verdict.textContent = vmap.txt; vmap.snd();
  const flavour = {
    win: `Your ${LABEL[playerMove]} beats ${LABEL[cpuMove]}.`,
    lose: `Their ${LABEL[cpuMove]} beats your ${LABEL[playerMove]}.`,
    draw: `Both threw ${LABEL[playerMove]}.`,
  }[result];
  setStatus(flavour);
  announce(`Round ${match.round}: ${vmap.txt}. ${flavour} Score ${match.player} to ${match.cpu}.`);
  addHistory(match.round, playerMove, cpuMove, result);

  if (match.player >= match.target || match.cpu >= match.target) setTimeout(endMatch, 1050);
  else setTimeout(() => { resetHands(); el.verdict.className = "verdict"; el.verdict.textContent = ""; unlockMoves(); setStatus("Next round — make your move."); }, 1150);
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
function endMatch() {
  match.active = false;
  const won = match.player > match.cpu;
  const flawless = won && match.cpu === 0;
  const comeback = won && match.maxDeficit >= 2;
  const rival = RIVAL_BY_ID[setup.rivalId];

  const ctx = {
    won, playerScore: match.player, cpuScore: match.cpu, rounds: match.round,
    flawless, comeback, rivalStars: rival.stars, moves: match.playerHistory.slice(),
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

  if (summary.leveledUp) { setTimeout(() => Sound.level(), 500); setTimeout(() => showUnlocks(summary), 900); }
  else if (summary.newAchievements.length) setTimeout(() => summary.newAchievements.forEach((a, i) => setTimeout(() => toast(`<span class="toast__ic">${a.icon}</span><div><b>Achievement</b><br>${a.name}</div>`), i * 900)), 700);
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
    <div class="danger"><button class="link-btn danger__btn" id="resetBtn" type="button">Reset all progress</button></div>`;

  injectIcons(el.profileBody);
  $$(".arena-swatch:not(.is-locked)", el.profileBody).forEach((b) => b.addEventListener("click", () => { applyArena(b.dataset.arena); renderProfile(); Sound.tick(); }));
  const reset = document.getElementById("resetBtn");
  if (reset) reset.addEventListener("click", () => {
    if (confirm("Reset all progress, unlocks and achievements? This cannot be undone.")) {
      resetProfile(); soundOn = true; applyArena("nebula"); toast("Progress reset."); renderProfile(); renderTopbar();
    }
  });
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
    const map = { r: "rock", p: "paper", s: "scissors" }, k = e.key.toLowerCase();
    if (map[k] && !match.locked && match.active) { e.preventDefault(); playRound(map[k]); }
    if (e.key === "Escape") { e.preventDefault(); forfeit(); }
  }
}
function forfeit() {
  if (!match.active) return;
  match.active = false;
  recordMatch({ won: false, playerScore: match.player, cpuScore: match.cpu, rounds: match.round, flawless: false, comeback: false, rivalStars: RIVAL_BY_ID[setup.rivalId].stars, moves: match.playerHistory.slice() });
  renderTopbar(); show("setup");
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
  el.startBtn.addEventListener("click", startMatch);
  el.rematchBtn.addEventListener("click", startMatch);
  el.quitBtn.addEventListener("click", forfeit);
  $$(".move", el.moves).forEach((m) => m.addEventListener("click", () => { if (!match.locked && match.active) playRound(m.dataset.move); }));

  const howto = document.getElementById("howtoSheet");
  $("#howtoBtn").addEventListener("click", () => openSheet(howto));
  const h2 = document.getElementById("howtoBtn2"); h2 && h2.addEventListener("click", () => openSheet(howto));
  $$("[data-close]", howto).forEach((b) => b.addEventListener("click", () => closeSheet(howto)));

  el.soundBtn.addEventListener("click", toggleSound);
  el.soundBtn.setAttribute("aria-pressed", String(soundOn));
  document.addEventListener("keydown", onKey);
  window.addEventListener("pointerdown", () => Sound.resume(), { once: true });
}

/* ---------- Boot ---------- */
function boot() {
  applyArena(profile.settings.arena || "nebula");
  injectIcons(document);
  buildRivalPicker();
  bind();
  renderTopbar();
  show("home");
  requestAnimationFrame(() => $$(".reveal").forEach((r) => { r.style.animationDelay = (parseInt(r.dataset.r || "1", 10) - 1) * 90 + "ms"; r.classList.add("in"); }));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
