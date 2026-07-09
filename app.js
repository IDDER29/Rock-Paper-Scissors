/* =========================================================
   RIVALS — Rock Paper Scissors
   Game engine, AI, FX, and view routing
   ========================================================= */
(() => {
  "use strict";

  /* ---------- Icons (single source of truth) ---------- */
  const ICONS = {
    rock: `<svg viewBox="0 0 96 96" aria-hidden="true"><g fill="currentColor"><ellipse cx="48" cy="60" rx="35" ry="24"/><circle cx="33" cy="46" r="17"/><circle cx="62" cy="43" r="19"/><circle cx="48" cy="52" r="21"/></g><g fill="rgba(0,0,0,.16)"><ellipse cx="60" cy="66" rx="14" ry="7"/></g></svg>`,
    paper: `<svg viewBox="0 0 96 96" aria-hidden="true"><path fill="currentColor" d="M27 12h28l17 17v51a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5V17a5 5 0 0 1 5-5z"/><path fill="rgba(0,0,0,.22)" d="M55 12v14a3 3 0 0 0 3 3h14z"/><g stroke="rgba(0,0,0,.18)" stroke-width="3" stroke-linecap="round"><path d="M33 44h30M33 55h30M33 66h20"/></g></svg>`,
    scissors: `<svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><circle cx="27" cy="68" r="12"/><circle cx="69" cy="68" r="12"/><path d="M36 60 76 20"/><path d="M60 60 20 20"/></g><circle cx="48" cy="46" r="4.5" fill="currentColor"/></svg>`,
    question: `<svg viewBox="0 0 96 96" fill="none" aria-hidden="true"><path d="M36 38a12 12 0 1 1 19 9c-4.5 3.4-7 5.5-7 11" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="48" cy="72" r="5.5" fill="currentColor"/></svg>`,
  };

  const injectIcons = (root = document) => {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      const key = el.getAttribute("data-icon");
      if (ICONS[key] && el.dataset.iconDone !== "1") {
        el.innerHTML = ICONS[key];
        el.dataset.iconDone = "1";
      }
    });
  };

  /* ---------- Champion roster (reuses existing avatar assets) ---------- */
  const ROSTER = [
    { id: "luffy", name: "Luffy", img: "img/avatars/luffy.png" },
    { id: "zoro", name: "Zoro", img: "img/avatars/zoro.jpg" },
    { id: "naruto", name: "Naruto", img: "img/avatars/naruto.jpg" },
    { id: "sasuke", name: "Sasuke", img: "img/avatars/sasuke.webp" },
    { id: "levi", name: "Levi", img: "img/avatars/levi.jpg" },
    { id: "mikasa", name: "Mikasa", img: "img/avatars/mikasa.webp" },
    { id: "gon", name: "Gon", img: "img/avatars/gonHxH.webp" },
    { id: "gaara", name: "Gaara", img: "img/avatars/gara.jpg" },
    { id: "l", name: "L", img: "img/avatars/L.avif" },
    { id: "shanks", name: "Shanks", img: "img/avatars/shanks.jpg" },
    { id: "nami", name: "Nami", img: "img/avatars/nami.jpg" },
    { id: "light", name: "Light", img: "img/avatars/yagami_light.webp" },
  ];

  const RIVALS = {
    easy: { name: "Rookie", tag: "Plays loose", img: "img/avatars/gara.jpg" },
    normal: { name: "Duelist", tag: "Pure chance", img: "img/avatars/robin-bat.jpg" },
    hard: { name: "Grandmaster", tag: "Reads your patterns", img: "img/avatars/mihok.avif" },
  };

  const MOVES = ["rock", "paper", "scissors"];
  const BEATS = { rock: "scissors", paper: "rock", scissors: "paper" }; // key beats value
  const LABEL = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

  /* ---------- Element cache ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const el = {
    body: document.body,
    career: $("#career"),
    roster: $("#roster"),
    difficulty: $("#difficulty"),
    length: $("#length"),
    setupSummary: $("#setupSummary"),
    startBtn: $("#startBtn"),
    // battle
    playerAvatar: $("#playerAvatar"),
    playerName: $("#playerName"),
    cpuAvatar: $("#cpuAvatar"),
    cpuName: $("#cpuName"),
    cpuTag: $("#cpuTag"),
    playerScore: $("#playerScore"),
    cpuScore: $("#cpuScore"),
    pips: $("#pips"),
    targetLabel: $("#targetLabel"),
    playerHand: $("#playerHand"),
    cpuHand: $("#cpuHand"),
    cpuHandCaption: $("#cpuHandCaption"),
    countdown: $("#countdown"),
    verdict: $("#verdict"),
    battleStatus: $("#battle-status"),
    moves: $("#moves"),
    historyList: $("#historyList"),
    quitBtn: $("#quitBtn"),
    // result
    resultCard: $("#resultCard"),
    resultBadge: $("#resultBadge"),
    resultKicker: $("#resultKicker"),
    resultTitle: $("#result-title"),
    resultLine: $("#resultLine"),
    resultScoreline: $("#resultScoreline"),
    resultStats: $("#resultStats"),
    rematchBtn: $("#rematchBtn"),
    // misc
    soundBtn: $("#soundBtn"),
    srStatus: $("#srStatus"),
    fx: $("#fx"),
  };

  /* ---------- Persistent settings + career ---------- */
  const store = {
    read(key, fallback) {
      try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
  };

  const career = store.read("rivals.career", { wins: 0, losses: 0, draws: 0, bestStreak: 0, streak: 0 });
  let soundOn = store.read("rivals.sound", true);

  /* ---------- Sound (WebAudio, no assets) ---------- */
  const Sound = (() => {
    let ctx = null;
    const ensure = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } return ctx; };
    const blip = (freq, dur = 0.12, type = "sine", gain = 0.05, when = 0) => {
      if (!soundOn) return; const c = ensure(); if (!c) return;
      const t = c.currentTime + when;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    };
    return {
      pick: () => blip(520, 0.1, "triangle", 0.045),
      tick: () => blip(340, 0.07, "square", 0.03),
      shoot: () => blip(760, 0.14, "triangle", 0.05),
      win: () => { blip(660, 0.12, "triangle", 0.05); blip(880, 0.16, "triangle", 0.05, 0.1); },
      lose: () => { blip(300, 0.16, "sawtooth", 0.04); blip(200, 0.2, "sawtooth", 0.04, 0.1); },
      draw: () => blip(440, 0.14, "sine", 0.04),
      fanfare: () => [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.28, "triangle", 0.05, i * 0.12)),
      defeat: () => [392, 349, 294, 233].forEach((f, i) => blip(f, 0.3, "sine", 0.045, i * 0.14)),
      resume: () => ensure(),
    };
  })();

  /* ---------- Confetti (canvas) ---------- */
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

  /* ---------- View router ---------- */
  const SCREENS = ["home", "setup", "battle", "result"];
  let current = "home";
  const show = (name) => {
    current = name;
    el.body.dataset.screen = name;
    SCREENS.forEach((s) => {
      const node = $("#screen-" + s);
      if (!node) return;
      if (s === name) {
        node.hidden = false;
        node.classList.remove("is-entering"); void node.offsetWidth; node.classList.add("is-entering");
      } else node.hidden = true;
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    if (name === "home") renderCareer();
    if (name === "setup") reflectStep();
  };

  /* ---------- Home: career strip ---------- */
  function renderCareer() {
    const played = career.wins + career.losses + career.draws;
    if (played === 0) {
      el.career.innerHTML = `<div class="career__empty"><span>⚔️</span><div>No duels yet — your legend starts with the next match.</div></div>`;
      return;
    }
    const rate = Math.round((career.wins / played) * 100);
    el.career.innerHTML = `
      <div class="career__grid">
        <div class="stat"><div class="stat__num is-win">${career.wins}</div><div class="stat__label">Matches won</div></div>
        <div class="stat"><div class="stat__num is-lose">${career.losses}</div><div class="stat__label">Matches lost</div></div>
        <div class="stat"><div class="stat__num">${rate}%</div><div class="stat__label">Win rate</div></div>
        <div class="stat"><div class="stat__num is-streak">${career.bestStreak}</div><div class="stat__label">Best streak</div></div>
      </div>`;
  }

  /* ---------- Setup ---------- */
  const setup = { champ: null, difficulty: "normal", length: 5 };

  function buildRoster() {
    el.roster.innerHTML = ROSTER.map((c, i) => `
      <button class="champ" role="radio" aria-checked="false" data-id="${c.id}" title="${c.name}" style="animation-delay:${i * 30}ms">
        <img src="${c.img}" alt="${c.name}" loading="lazy" onerror="this.style.opacity=.25" />
        <span class="champ__name">${c.name}</span>
        <span class="champ__check">${'<svg viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5 9-11" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'}</span>
      </button>`).join("");
  }

  function selectChamp(id) {
    setup.champ = ROSTER.find((c) => c.id === id) || null;
    $$(".champ", el.roster).forEach((b) => {
      const on = b.dataset.id === id;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-checked", String(on));
    });
    Sound.pick();
    updateSummary();
  }

  function bindSegmented(group, key, cast = (v) => v) {
    $$(".seg", group).forEach((b) => {
      b.addEventListener("click", () => {
        $$(".seg", group).forEach((x) => { x.classList.remove("is-selected"); x.setAttribute("aria-checked", "false"); });
        b.classList.add("is-selected"); b.setAttribute("aria-checked", "true");
        setup[key] = cast(b.dataset.value);
        Sound.tick();
        updateSummary();
      });
    });
  }

  function updateSummary() {
    const r = RIVALS[setup.difficulty];
    if (!setup.champ) {
      el.setupSummary.innerHTML = `Pick a champion to continue.`;
      el.startBtn.disabled = true;
      return;
    }
    el.setupSummary.innerHTML = `Playing as <b>${setup.champ.name}</b> vs the <b>${r.name}</b> · first to <b>${setup.length}</b>.`;
    el.startBtn.disabled = false;
  }

  function reflectStep() {
    const steps = $$(".steps .step");
    if (!steps.length) return;
    const done = setup.champ ? 1 : 0;
    steps.forEach((s, i) => s.classList.toggle("is-active", i === (done ? 1 : 0)));
  }

  /* ---------- Battle engine ---------- */
  const match = {
    active: false, locked: false, round: 0,
    player: 0, cpu: 0, target: 5,
    playerHistory: [], // player's past moves (for Hard AI)
    rounds: [],
  };

  function startMatch() {
    if (!setup.champ) return;
    Sound.resume();
    match.active = true; match.locked = false; match.round = 0;
    match.player = 0; match.cpu = 0; match.target = setup.length;
    match.playerHistory = []; match.rounds = [];

    const rival = RIVALS[setup.difficulty];
    el.playerAvatar.src = setup.champ.img; el.playerAvatar.alt = setup.champ.name;
    el.playerName.textContent = setup.champ.name;
    el.cpuAvatar.src = rival.img; el.cpuAvatar.alt = rival.name;
    el.cpuName.textContent = rival.name; el.cpuTag.textContent = "Rival";
    el.cpuHandCaption.textContent = rival.name;

    el.playerScore.textContent = "0"; el.cpuScore.textContent = "0";
    el.targetLabel.textContent = `First to ${match.target}`;
    buildPips();

    resetHands();
    el.historyList.innerHTML = `<li class="history__empty">No rounds yet — throw your first move to begin the story.</li>`;
    el.verdict.className = "verdict"; el.verdict.textContent = "";
    setStatus("Make your move.");
    unlockMoves();
    show("battle");
    injectIcons(el.moves);
  }

  function buildPips() {
    // show target pips per side around the center
    el.pips.innerHTML = "";
    for (let i = 0; i < match.target; i++) { const s = document.createElement("span"); s.className = "pip"; el.pips.appendChild(s); }
  }
  function paintPips() {
    const pips = $$(".pip", el.pips);
    pips.forEach((p, i) => {
      p.classList.remove("p-win", "c-win");
      if (i < match.player) p.classList.add("p-win");
      else if (i >= match.target - match.cpu) p.classList.add("c-win");
    });
  }

  function resetHands() {
    el.playerHand.dataset.state = "idle";
    el.cpuHand.dataset.state = "idle";
    el.playerHand.classList.remove("win", "lose");
    el.cpuHand.classList.remove("win", "lose");
    setGlyph(el.playerHand, "question");
    setGlyph(el.cpuHand, "question");
  }
  function setGlyph(handEl, icon) {
    const g = handEl.querySelector(".hand__glyph");
    g.setAttribute("data-icon", icon); g.dataset.iconDone = "0"; g.innerHTML = ICONS[icon];
  }

  function setStatus(msg) { el.battleStatus.textContent = msg; }
  function announce(msg) { el.srStatus.textContent = msg; }
  function lockMoves() { match.locked = true; el.moves.classList.add("is-locked"); }
  function unlockMoves() {
    match.locked = false; el.moves.classList.remove("is-locked");
    $$(".move", el.moves).forEach((m) => m.classList.remove("is-picked"));
  }

  /* --- AI move selection --- */
  function cpuChoose() {
    const d = setup.difficulty;
    const rnd = () => MOVES[(Math.random() * 3) | 0];
    if (d === "normal") return rnd();

    if (d === "easy") {
      // 55% of the time deliberately plays the move that loses to player's last move (goes easy)
      const last = match.playerHistory[match.playerHistory.length - 1];
      if (last && Math.random() < 0.55) return BEATS[last]; // move that `last` beats -> player wins
      return rnd();
    }

    // hard: predict player's most frequent recent move and counter it 65% of the time
    if (match.playerHistory.length >= 2 && Math.random() < 0.65) {
      const recent = match.playerHistory.slice(-6);
      const counts = { rock: 0, paper: 0, scissors: 0 };
      recent.forEach((m) => counts[m]++);
      const predicted = MOVES.reduce((a, b) => (counts[b] > counts[a] ? b : a));
      // choose the move that beats the predicted player move
      return MOVES.find((m) => BEATS[m] === predicted);
    }
    return rnd();
  }

  function judge(player, cpu) {
    if (player === cpu) return "draw";
    return BEATS[player] === cpu ? "win" : "lose";
  }

  /* --- Play a round --- */
  function playRound(playerMove) {
    if (!match.active || match.locked) return;
    lockMoves();
    match.round++;
    match.playerHistory.push(playerMove);

    const picked = $(`.move[data-move="${playerMove}"]`, el.moves);
    if (picked) picked.classList.add("is-picked");
    Sound.pick();

    const cpuMove = cpuChoose();
    const result = judge(playerMove, cpuMove);

    // Reset hand visuals to shake/question
    el.playerHand.classList.remove("win", "lose");
    el.cpuHand.classList.remove("win", "lose");
    setGlyph(el.playerHand, playerMove);
    setGlyph(el.cpuHand, "question");
    el.verdict.className = "verdict"; el.verdict.textContent = "";

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const words = ["Rock", "Paper", "Scissors", "Shoot!"];

    if (reduce) {
      revealRound(playerMove, cpuMove, result);
      return;
    }

    // Countdown "Rock / Paper / Scissors / Shoot!"
    el.playerHand.dataset.state = "shake";
    el.cpuHand.dataset.state = "shake";
    let i = 0;
    setStatus("");
    const step = () => {
      if (i < words.length) {
        const isGo = i === words.length - 1;
        el.countdown.innerHTML = `<span class="${isGo ? "go" : ""}">${words[i]}</span>`;
        isGo ? Sound.shoot() : Sound.tick();
        i++;
        setTimeout(step, isGo ? 220 : 230);
      } else {
        el.countdown.textContent = "";
        revealRound(playerMove, cpuMove, result);
      }
    };
    step();
  }

  function revealRound(playerMove, cpuMove, result) {
    setGlyph(el.playerHand, playerMove);
    setGlyph(el.cpuHand, cpuMove);
    el.playerHand.dataset.state = "reveal";
    el.cpuHand.dataset.state = "reveal";

    // score + winner highlight
    if (result === "win") { match.player++; el.playerHand.classList.add("win"); el.cpuHand.classList.add("lose"); }
    else if (result === "lose") { match.cpu++; el.cpuHand.classList.add("win"); el.playerHand.classList.add("lose"); }

    bumpScores();
    paintPips();

    // verdict text
    const vmap = {
      win: { cls: "v-win", txt: "You win!", snd: Sound.win },
      lose: { cls: "v-lose", txt: "Rival wins", snd: Sound.lose },
      draw: { cls: "v-draw", txt: "Draw", snd: Sound.draw },
    };
    const v = vmap[result];
    el.verdict.className = `verdict show ${v.cls}`;
    el.verdict.textContent = v.txt;
    v.snd();

    const flavour = {
      win: `Your ${LABEL[playerMove]} beats ${LABEL[cpuMove]}.`,
      lose: `Their ${LABEL[cpuMove]} beats your ${LABEL[playerMove]}.`,
      draw: `Both threw ${LABEL[playerMove]}.`,
    }[result];
    setStatus(flavour);
    announce(`Round ${match.round}: ${v.txt}. ${flavour} Score ${match.player} to ${match.cpu}.`);

    addHistory(match.round, playerMove, cpuMove, result);

    // match over?
    if (match.player >= match.target || match.cpu >= match.target) {
      setTimeout(endMatch, 1050);
    } else {
      setTimeout(() => {
        resetHands();
        el.verdict.className = "verdict"; el.verdict.textContent = "";
        unlockMoves();
        setStatus("Next round — make your move.");
      }, 1150);
    }
  }

  function bumpScores() {
    el.playerScore.textContent = String(match.player);
    el.cpuScore.textContent = String(match.cpu);
    [el.playerScore, el.cpuScore].forEach((n) => { n.classList.remove("bump"); void n.offsetWidth; n.classList.add("bump"); });
  }

  function miniIcon(move) { return `<span class="mini" data-icon="${move}">${ICONS[move]}</span>`; }

  function addHistory(no, p, c, result) {
    const empty = el.historyList.querySelector(".history__empty");
    if (empty) empty.remove();
    const li = document.createElement("li");
    li.className = "round";
    const label = { win: "Won", lose: "Lost", draw: "Draw" }[result];
    li.innerHTML = `
      <span class="round__no">R${no}</span>
      <span class="round__throws">${miniIcon(p)}<span class="vs">vs</span>${miniIcon(c)}</span>
      <span class="round__result ${result}">${label}</span>`;
    el.historyList.prepend(li);
  }

  /* ---------- End of match ---------- */
  function endMatch() {
    match.active = false;
    const win = match.player > match.cpu;
    const outcome = win ? "win" : "lose";

    // update career
    if (win) { career.wins++; career.streak++; career.bestStreak = Math.max(career.bestStreak, career.streak); }
    else { career.losses++; career.streak = 0; }
    store.write("rivals.career", career);

    const rival = RIVALS[setup.difficulty];
    el.resultCard.dataset.outcome = outcome;
    el.resultBadge.textContent = win ? "👑" : "🥊";
    el.resultKicker.textContent = win ? "Match complete · Champion" : "Match complete";
    el.resultTitle.textContent = win ? "Victory" : "Defeated";
    el.resultLine.textContent = win
      ? `You out-read the ${rival.name} and claimed the crown. ${career.streak > 1 ? `That's ${career.streak} in a row.` : "A clean start to your streak."}`
      : `The ${rival.name} had your number this time. Shake it off and run it back.`;
    el.resultScoreline.innerHTML = `<span class="me">${match.player}</span><span class="sep">—</span><span class="cpu">${match.cpu}</span>`;

    const total = match.rounds.length || (match.player + match.cpu);
    const draws = match.round - (match.player + match.cpu);
    el.resultStats.innerHTML = `
      <div class="rstat"><div class="rstat__num">${match.round}</div><div class="rstat__label">Rounds</div></div>
      <div class="rstat"><div class="rstat__num">${draws}</div><div class="rstat__label">Draws</div></div>
      <div class="rstat"><div class="rstat__num">${career.streak}</div><div class="rstat__label">Win streak</div></div>`;

    show("result");
    injectIcons(el.resultCard);
    if (win) { Confetti.burst(160); Sound.fanfare(); } else { Sound.defeat(); }
    announce(win ? "You won the match." : "You lost the match.");
  }

  /* ---------- How-to sheet ---------- */
  const sheet = $("#howtoSheet");
  let lastFocus = null;
  function openSheet() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    injectIcons(sheet);
    const focusable = sheet.querySelector(".sheet__close");
    focusable && focusable.focus();
    document.addEventListener("keydown", sheetKeys);
  }
  function closeSheet() {
    sheet.hidden = true;
    document.removeEventListener("keydown", sheetKeys);
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  function sheetKeys(e) {
    if (e.key === "Escape") { e.preventDefault(); closeSheet(); }
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
    soundOn = !soundOn;
    el.soundBtn.setAttribute("aria-pressed", String(soundOn));
    store.write("rivals.sound", soundOn);
    if (soundOn) { Sound.resume(); Sound.pick(); }
  }

  /* ---------- Keyboard ---------- */
  function onKey(e) {
    if (!sheet.hidden) return;
    if (current === "battle") {
      const map = { r: "rock", p: "paper", s: "scissors" };
      const k = e.key.toLowerCase();
      if (map[k] && !match.locked && match.active) { e.preventDefault(); playRound(map[k]); }
      if (e.key === "Escape") { e.preventDefault(); forfeit(); }
    }
  }

  function forfeit() {
    if (!match.active) return;
    match.active = false;
    career.streak = 0; career.losses++; store.write("rivals.career", career);
    show("setup");
  }

  /* ---------- Wire up ---------- */
  function bind() {
    // nav buttons
    $$("[data-nav]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      const dest = b.dataset.nav;
      if (dest === "setup") { Sound.resume(); reflectStep(); }
      show(dest);
    }));

    // roster (delegated)
    el.roster.addEventListener("click", (e) => {
      const card = e.target.closest(".champ");
      if (card) selectChamp(card.dataset.id);
    });
    el.roster.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { const c = e.target.closest(".champ"); if (c) { e.preventDefault(); selectChamp(c.dataset.id); } }
    });

    bindSegmented(el.difficulty, "difficulty");
    bindSegmented(el.length, "length", (v) => parseInt(v, 10));

    el.startBtn.addEventListener("click", startMatch);
    el.rematchBtn.addEventListener("click", startMatch);
    el.quitBtn.addEventListener("click", forfeit);

    // moves
    $$(".move", el.moves).forEach((m) => m.addEventListener("click", () => {
      if (!match.locked && match.active) playRound(m.dataset.move);
    }));

    // how-to
    $("#howtoBtn").addEventListener("click", openSheet);
    const h2 = $("#howtoBtn2"); h2 && h2.addEventListener("click", openSheet);
    $$("[data-close]", sheet).forEach((b) => b.addEventListener("click", closeSheet));

    el.soundBtn.addEventListener("click", toggleSound);
    el.soundBtn.setAttribute("aria-pressed", String(soundOn));

    document.addEventListener("keydown", onKey);

    // resume audio on first gesture
    window.addEventListener("pointerdown", () => Sound.resume(), { once: true });
  }

  /* ---------- Boot ---------- */
  function boot() {
    injectIcons(document);
    buildRoster();
    updateSummary();
    renderCareer();
    bind();

    // reveal home, then reveal animations
    show("home");
    requestAnimationFrame(() => {
      $$(".reveal").forEach((r) => {
        const d = (parseInt(r.dataset.r || "1", 10) - 1) * 90;
        r.style.animationDelay = d + "ms";
        r.classList.add("in");
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
