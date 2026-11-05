import './style.css';
import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { LEVELS, BIOMES } from './level.js';
import { clamp, formatTime } from './utils.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const STORAGE_KEY = 'indy_lost_relics_save_v1';
const defaultSave = () => ({ unlocked: 1, current: 1, completed: [], scores: {}, idols: {}, totalScore: 0, finished: false });

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed, completed: Array.isArray(parsed.completed) ? parsed.completed : [] };
  } catch { return defaultSave(); }
}
let save = loadSave();
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch {} }

const HEART_SVG = `<svg viewBox="0 0 30 28" aria-hidden="true"><path d="M15 26.2 4.4 16.1C1.1 13.2 1.5 8.2 4.7 5.8c2.8-2.2 6.8-1.4 8.7 1.3L15 9.1l1.6-2c1.9-2.7 5.9-3.5 8.7-1.3 3.2 2.4 3.6 7.4.3 10.3L15 26.2Z"/></svg>`;

class UI {
  constructor() {
    this.el = {
      hud: $('#hud'), menu: $('#menu'), touch: $('#touch-ui'), loading: $('#loading'), fade: $('#fade'),
      hearts: $('#hearts'), score: $('#hud-score'), ammo: $('#hud-ammo'), idols: $('#hud-idols'),
      level: $('#hud-level'), biome: $('#hud-biome'), objective: $('#hud-objective'), distance: $('#hud-distance'),
      compassArrow: $('#compass-arrow'), compassLabel: $('#compass-label'), compassDist: $('#compass-dist'),
      routePlayer: $('#route-player'), routeRelic: $('#route-relic'), routeSecrets: $('#route-secrets'),
      bossBar: $('#boss-bar'), bossHp: $('#boss-hp'), bossLabel: $('#boss-hp-label'),
      interact: $('#interact-prompt'), interactText: $('#interact-text'), hint: $('#hint-card'),
      toast: $('#toast-stack'), pause: $('#pause'), complete: $('#level-complete'), ending: $('#ending'),
      levelSelect: $('#level-select'), levelGrid: $('#level-grid'), damage: $('#damage-flash'),
      completeTitle: $('#complete-title'), completeBiome: $('#complete-biome'),
      statTime: $('#stat-time'), statIdols: $('#stat-idols'), statScore: $('#stat-score'),
      nextButton: $('#next-button'), replayButton: $('#replay-button'), completeMap: $('#complete-map-button'),
      endingScore: $('#ending-score'), menuLevel: $('#menu-level'), menuProgress: $('#menu-progress'),
      totalRelics: $('#total-relics'), sound: $('#sound-toggle'),
    };
    this.cache = {};
    this.mobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
    this.lastCompleted = 1;
    this.hintTimer = null;
    this.toastTimers = new Set();
    this.currentLevel = null;
    this.game = null;
    this.lastInteract = null;
    this.lastObjective = '';
    this.mapOrigin = 'menu';
    this.buildHearts(3, 3);
    if (this.mobile) this.el.touch.classList.remove('hidden');
    window.addEventListener('resize', () => {
      this.mobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
      if (this.game?.state === 'playing') this.el.touch.classList.toggle('hidden', !this.mobile);
    });
  }

  bind(game) {
    this.game = game;
    $('#play-button').addEventListener('click', () => { game.audio.init(); game.audio.click(); this.hideMenu(); game.start(this.primaryLevel()); });
    $('#levels-button').addEventListener('click', () => { game.audio.click(); this.openMap('menu'); });
    $('#close-levels').addEventListener('click', () => { game.audio.click(); this.closeMap(); });
    $('#pause-button').addEventListener('click', () => { this.pauseGame(); });
    $('#resume-button').addEventListener('click', () => { this.resumeGame(); });
    $('#restart-button').addEventListener('click', () => { this.hidePause(); game.start(game.levelNumber); });
    $('#pause-map-button').addEventListener('click', () => { this.hidePause(); this.openMap('pause'); });
    $('#quit-button').addEventListener('click', () => { this.hidePause(); game.state = 'menu'; this.showMenu(); game.showMenuScene(); });
    $('#next-button').addEventListener('click', () => this.nextLevel());
    $('#replay-button').addEventListener('click', () => { this.el.complete.classList.add('hidden'); this.game.start(this.lastCompleted); });
    this.el.completeMap.addEventListener('click', () => { this.el.complete.classList.add('hidden'); this.openMap('complete'); });
    $('#ending-continue').addEventListener('click', () => { this.el.ending.classList.add('hidden'); this.el.hud.classList.add('hidden'); this.el.touch.classList.add('hidden'); this.showMenu(); this.game.state = 'menu'; this.game.showMenuScene(); });
    this.el.sound.addEventListener('click', () => {
      game.audio.init();
      const next = !game.audio.enabled;
      game.audio.setEnabled(next);
      this.el.sound.classList.toggle('muted', !next);
    });
    game.events.onPause = () => this.pauseGame();
    game.events.onResume = () => this.resumeGame();
    game.events.onComplete = (data) => this.finishLevel(data);
    this.renderMenuMeta();
  }

  primaryLevel() {
    if (save.finished) return 20;
    return clamp(save.current || 1, 1, save.unlocked || 1);
  }

  hideMenu() {
    this.el.menu.classList.add('hidden');
    this.el.levelSelect.classList.add('hidden');
  }

  showMenu() {
    this.el.menu.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    this.el.complete.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.ending.classList.add('hidden');
    this.el.levelSelect.classList.add('hidden');
    this.el.fade?.classList.remove('active');
    this.buildHearts(3, 3);
    this.renderMenuMeta();
  }

  renderMenuMeta() {
    $("#menu-level").textContent = String(this.primaryLevel()).padStart(2, '0');
    $('#menu-progress').textContent = `${save.completed.length} / 20 RELICS`;
    $('#total-relics').textContent = `${save.completed.length} / 20`;
  }

  startPlaying(info, level) {
    this.currentLevel = info.n;
    this.hideMenu();
    this.el.hud.classList.remove('hidden');
    this.el.touch.classList.toggle('hidden', !this.mobile);
    this.el.complete.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.el.ending.classList.add('hidden');
    this.el.bossBar.classList.add('hidden');
    this.el.fade.classList.remove('active');
    document.body.classList.remove('cinematic');
    this.buildHearts(3, 3);
    this.el.level.textContent = String(info.n).padStart(2, '0');
    this.el.biome.textContent = BIOMES[info.biome].short;
    this.lastObjective = '';
    this.toast(`${info.name.toUpperCase()} · ${BIOMES[info.biome].subtitle}`, 'gold');
    this.showHint(`<b>${info.name}</b><br/>${info.hint}`, 6200);
    this.renderRoute(level);
  }

  buildHearts(hp, max) {
    if (this.cache.hearts === `${hp}/${max}`) return;
    this.cache.hearts = `${hp}/${max}`;
    this.el.hearts.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const d = document.createElement('div');
      d.className = 'heart' + (i >= hp ? ' empty' : '');
      d.innerHTML = HEART_SVG;
      this.el.hearts.appendChild(d);
    }
  }

  gainHeart() {
    const hearts = [...this.el.hearts.children];
    if (hearts.length < 3) return;
    const empty = hearts.find(h => h.classList.contains('empty'));
    if (empty) {
      empty.classList.remove('empty');
      empty.classList.add('gain');
      setTimeout(() => empty.classList.remove('gain'), 520);
      this.cache.hearts = '';
    }
  }

  setHUD(data, force = false) {
    const c = this.cache;
    if (force || c.hp !== data.health || c.max !== data.maxHealth) {
      if (c.hp !== undefined && data.health < c.hp) {
        [...this.el.hearts.children].forEach((h, i) => {
          if (i === data.health) { h.classList.add('lost'); setTimeout(() => h.classList.remove('lost'), 600); }
        });
      }
      this.buildHearts(data.health, data.maxHealth);
      c.hp = data.health;
      c.max = data.maxHealth;
    }
    const score = String(data.score).padStart(4, '0');
    if (force || c.score !== score) { this.el.score.textContent = score; c.score = score; }
    if (force || c.ammo !== data.ammo) {
      this.el.ammo.textContent = data.ammo;
      this.el.ammo.parentElement.classList.toggle('empty', data.ammo === 0);
      c.ammo = data.ammo;
    }
    if (force || c.idols !== `${data.idols}/${data.totalIdols}`) {
      this.el.idols.textContent = `${data.idols} / ${data.totalIdols}`;
      c.idols = `${data.idols}/${data.totalIdols}`;
    }
    if (force || c.level !== data.level) {
      this.el.level.textContent = String(data.level).padStart(2, '0');
      this.el.biome.textContent = data.info ? BIOMES[data.info.biome].short : '';
      c.level = data.level;
      this.currentLevel = data.level;
    }
    if (force || c.objective !== data.objective) {
      this.el.objective.textContent = data.objective;
      this.el.objective.parentElement.classList.add('objective-pulse');
      setTimeout(() => this.el.objective.parentElement.classList.remove('objective-pulse'), 700);
      c.objective = data.objective;
    }
    const dTxt = `${Math.max(0, Math.round(data.distance))} m`;
    if (force || c.distance !== dTxt) { this.el.distance.textContent = dTxt; c.distance = dTxt; }
    this.el.compassDist.textContent = `${Math.max(0, Math.round(data.distance))}m`;
    this.el.compassLabel.textContent = data.level === 20 && data.boss ? 'GUARDIAN' : 'RELIC';

    // compass arrow relative to camera
    const dx = 0 - data.playerX;
    const dz = data.relicZ - data.playerZ;
    const len = Math.hypot(dx, dz) || 1;
    const fx = -Math.sin(data.yaw), fz = -Math.cos(data.yaw);
    const rx = Math.cos(data.yaw), rz = -Math.sin(data.yaw);
    const angle = Math.atan2((dx / len) * rx + (dz / len) * rz, (dx / len) * fx + (dz / len) * fz);
    this.el.compassArrow.style.transform = `rotate(${angle}rad)`;

    // route strip
    const denom = data.startZ - data.relicZ;
    const progress = denom !== 0 ? clamp((data.startZ - data.playerZ) / denom, 0, 1) : 0;
    this.el.routePlayer.style.left = `${progress * 100}%`;
    const key = `${data.level}-${data.secrets.length}`;
    if (force || c.secretKey !== key) {
      c.secretKey = key;
      this.el.routeSecrets.innerHTML = '';
      data.secrets.forEach(s => {
        const i = document.createElement('i');
        const p = denom !== 0 ? clamp((data.startZ - s.z) / denom, 0, 1) : 0;
        i.style.left = `${p * 100}%`;
        i.dataset.idx = data.secrets.indexOf(s);
        this.el.routeSecrets.appendChild(i);
      });
      this.el.routeSecrets.dataset.level = data.level;
    }
    [...this.el.routeSecrets.children].forEach((el, i) => {
      if (data.secrets[i]?.found) el.classList.add('found');
      else el.classList.remove('found');
    });
  }

  renderRoute(level) {
    this.el.routeSecrets.innerHTML = '';
    const secretZ = level.secretDoors.map(s => s.z ?? 0);
    level.secretDoors.forEach((s) => {
      const i = document.createElement('i');
      this.el.routeSecrets.appendChild(i);
    });
    this.cache.secretKey = null;
  }

  toast(text, type = '') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = text;
    this.el.toast.appendChild(el);
    setTimeout(() => { el.remove(); }, 3000);
  }

  hint(html, ms = 4500) {
    clearTimeout(this.hintTimer);
    this.el.hint.innerHTML = html;
    this.el.hint.classList.remove('hidden');
    this.hintTimer = setTimeout(() => this.el.hint.classList.add('hidden'), ms);
  }

  interact(text) {
    if (text === this.lastInteract) return;
    this.lastInteract = text;
    if (text) {
      this.el.interactText.textContent = text;
      this.el.interact.classList.remove('hidden');
      $('.touch-btn.interact')?.classList.add('available');
    } else {
      this.el.interact.classList.add('hidden');
      $('.touch-btn.interact')?.classList.remove('available');
    }
  }

  inspect() {}

  damage() {
    this.el.damage.classList.add('active');
    setTimeout(() => this.el.damage.classList.remove('active'), 130);
  }

  fade(on) { this.el.fade.classList.toggle('active', !!on); }

  showBoss(hp, max) {
    this.el.bossBar.classList.remove('hidden');
    const pct = Math.max(0, hp / max * 100);
    this.el.bossHp.style.width = `${pct}%`;
    this.el.bossLabel.textContent = `${Math.ceil(pct)}%`;
  }

  hideBoss() { this.el.bossBar.classList.add('hidden'); }

  pauseGame() {
    if (this.game.state !== 'playing') return;
    this.game.state = 'paused';
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.el.pause.classList.remove('hidden');
    this.el.touch.classList.add('hidden');
  }

  resumeGame() {
    if (!this.game || this.game.state !== 'paused') return;
    this.game.state = 'playing';
    this.hidePause();
    this.el.touch.classList.toggle('hidden', !this.mobile);
    this.game.snapCamera();
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  finishLevel(data) {
    this.lastCompleted = data.level;
    const n = data.level;
    save.completed = [...new Set([...save.completed, n])].sort((a, b) => a - b);
    save.scores[n] = Math.max(save.scores[n] || 0, data.score);
    save.idols[n] = Math.max(save.idols[n] || 0, data.idols);
    save.totalScore = Object.values(save.scores).reduce((a, b) => a + b, 0);
    save.unlocked = Math.max(save.unlocked, Math.min(20, n + 1));
    save.current = Math.min(20, n + 1);
    if (n === 20) save.finished = true;
    persist();
    this.el.completeTitle.textContent = data.title;
    this.el.completeBiome.textContent = `${BIOMES[data.info.biome].short} · CHAPTER ${String(n).padStart(2, '0')}`;
    this.el.statTime.textContent = formatTime(data.time);
    this.el.statIdols.textContent = `${data.idols} / ${data.totalIdols}`;
    this.el.statScore.textContent = data.score;
    this.el.nextButton.textContent = n === 20 ? 'CLAIM THE LEGEND' : 'NEXT TEMPLE';
    setTimeout(() => {
      this.el.complete.classList.remove('hidden');
      this.el.touch.classList.add('hidden');
      this.el.hud.classList.add('hidden');
    }, 450);
    this.renderMenuMeta();
  }

  nextLevel() {
    this.el.complete.classList.add('hidden');
    if (this.lastCompleted >= 20) {
      this.showEnding();
      return;
    }
    this.game.start(this.lastCompleted + 1);
  }

  showEnding() {
    this.el.ending.classList.remove('hidden');
    this.el.endingScore.textContent = save.totalScore;
    this.el.hud.classList.add('hidden');
    this.el.touch.classList.add('hidden');
    if (!this.game.audio.enabled) return;
    this.game.audio.relic();
  }

  openMap(origin = 'menu') {
    this.mapOrigin = origin;
    if (origin === 'menu') this.el.menu.classList.add('hidden');
    if (origin === 'pause') { this.el.pause.classList.add('hidden'); this.el.touch.classList.add('hidden'); }
    this.el.levelSelect.classList.remove('hidden');
    this.buildMap();
  }

  closeMap() {
    this.el.levelSelect.classList.add('hidden');
    if (this.mapOrigin === 'menu') this.el.menu.classList.remove('hidden');
    else if (this.mapOrigin === 'pause') this.el.pause.classList.remove('hidden');
    else if (this.mapOrigin === 'complete') this.el.complete.classList.remove('hidden');
    else if (this.mapOrigin === 'map') this.el.menu.classList.remove('hidden');
  }

  buildMap() {
    const grid = this.el.levelGrid;
    grid.innerHTML = '';
    let currentBiome = 0;
    for (const info of LEVELS) {
      if (info.biome !== currentBiome) {
        currentBiome = info.biome;
        const heading = document.createElement('div');
        heading.className = 'biome-heading';
        heading.textContent = `${BIOMES[info.biome].chapter} · ${BIOMES[info.biome].name}`;
        grid.appendChild(heading);
      }
      const unlocked = info.n <= save.unlocked || save.finished;
      const completed = save.completed.includes(info.n);
      const card = document.createElement('button');
      card.className = `level-card${unlocked ? '' : ' locked'}${completed ? ' completed' : ''}${info.n === this.primaryLevel() ? ' current' : ''}${info.boss ? ' boss' : ''}`;
      card.disabled = !unlocked;
      const diffDots = Array.from({ length: 5 }, (_, i) => `<i class="${i < Math.min(5, info.diff) ? 'on' : ''}"></i>`).join('');
      const idols = save.idols[info.n] || 0;
      card.innerHTML = `
        <span class="num">${String(info.n).padStart(2, '0')}</span>
        <span class="name">${info.name}</span>
        <span class="meta"><span class="difficulty">${diffDots}</span><span class="idols">${completed ? `✦ ${idols}/2` : unlocked ? 'ENTER' : 'SEALED'}</span></span>`;
      card.addEventListener('click', () => {
        if (!unlocked) return;
        this.el.levelSelect.classList.add('hidden');
        this.el.menu.classList.add('hidden');
        this.el.pause.classList.add('hidden');
        this.el.complete.classList.add('hidden');
        this.game.audio.init();
        this.game.start(info.n);
      });
      grid.appendChild(card);
    }
  }
}

const ui = new UI();
const audio = new AudioEngine();
const game = new Game({ canvas: $('#game'), ui, audio });
ui.bind(game);

// Loading sequence: paint the screen, then build the menu diorama.
const steps = [
  ['DUSTING OFF THE FEDORA…', 18],
  ['CARVING THE TEMPLE STONES…', 44],
  ['LIGHTING THE ANCIENT BRAZIERS…', 68],
  ['POLISHING THE GOLDEN IDOLS…', 90],
  ['THE ADVENTURE IS READY', 100],
];
let stepIndex = 0;
function loadStep() {
  const [text, pct] = steps[stepIndex];
  $('#loading-text').textContent = text;
  $('#loading-bar').style.width = `${pct}%`;
  stepIndex++;
  if (stepIndex < steps.length) setTimeout(loadStep, 110);
  else {
    setTimeout(() => {
      try {
        game.showMenuScene();
        ui.showMenu();
      } catch (err) {
        console.error(err);
        $('#loading-text').textContent = 'THE TEMPLE REFUSES TO OPEN — RELOAD TO TRY AGAIN';
        return;
      }
      setTimeout(() => $('#loading').classList.add('done'), 160);
      game.loop();
      window.__indy = { game, ui, save, LEVELS };
    }, 260);
  }
}
setTimeout(loadStep, 80);

// Keep the first gesture capable of starting audio on iOS.
document.addEventListener('pointerdown', () => audio.init(), { once: true });
