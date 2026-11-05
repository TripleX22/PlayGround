import * as THREE from 'three';
import { buildLevel, getLevelInfo, BIOMES } from './level.js';
import { createExplorer, createEnemy, createBoss } from './character.js';
import { AudioEngine } from './audio.js';
import { clamp, damp, angleLerp, smoothstep, formatTime } from './utils.js';

const PLAYER_HEIGHT = 1.78;
const CROUCH_HEIGHT = 1.05;
const RADIUS = .38;
const GRAVITY = 18.5;

const UP = new THREE.Vector3(0, 1, 0);

export class Game {
  get playerOnGround() { return !!this.player?.grounded; }

  notify(text, type = '') { this.ui.toast?.(text, type); }
  shakeCamera(amount = .2) { this.cameraShake = Math.max(this.cameraShake, amount); }

  constructor({ canvas, ui, audio }) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio || new AudioEngine();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, .1, 420);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.clock = new THREE.Clock();
    this.state = 'boot';
    this.level = null;
    this.levelNumber = 0;
    this.levelStartZ = 0;
    this.player = null;
    this.playerMesh = null;
    this.enemies = [];
    this.boss = null;
    this.enemyShots = [];
    this.effects = [];
    this.events = {};
    this.input = { forward: 0, right: 0, jumpQueued: false, crouch: false };
    this.keys = new Set();
    this.touchJoystick = { x: 0, y: 0 };
    this.cameraYaw = 0;
    this.cameraPitch = .28;
    this.cameraDistance = 6.1;
    this.cameraShake = 0;
    this.cameraShakeSeed = Math.random() * 100;
    this.cameraPos = new THREE.Vector3();
    this.cameraLook = new THREE.Vector3();
    this.whipFx = null;
    this.handPos = new THREE.Vector3();
    this.aimPoint = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.uiTimer = 0;
    this.menuTime = 0;
    this.hintCooldown = {};
    this.deadTimer = 0;
    this.completeTimer = 0;
    this.timeScale = 1;
    this.mobile = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.bindInput();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
    this.onResize();
    this.createPlayerMesh();
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 1.75));
    this.renderer.setSize(w, h);
    if (this.mobile) this.renderer.shadowMap.enabled = false;
  }

  createPlayerMesh() {
    this.playerMesh = createExplorer();
    this.playerMesh.visible = false;
    this.scene.add(this.playerMesh);
    this.player = this.makePlayerState();
  }

  makePlayerState() {
    return {
      pos: new THREE.Vector3(0, 0, 8),
      vel: new THREE.Vector3(),
      facing: 0,
      targetFacing: 0,
      grounded: true,
      crouching: false,
      height: PLAYER_HEIGHT,
      health: 3,
      maxHealth: 3,
      ammo: 6,
      score: 0,
      moveSpeed: 0,
      invuln: 0,
      jumpBuffer: 0,
      coyote: 0,
      attackTime: 0,
      attackType: '',
      attackDuration: .3,
      whipCd: 0,
      punchCd: 0,
      shootCd: 0,
      useCd: 0,
      stepTimer: 0,
      idleTime: 0,
      swinging: false,
    };
  }

  bindInput() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) e.preventDefault();
      if (this.state === 'menu' && (code === 'Enter' || code === 'KeyW')) return;
      this.keys.add(code);
      if (code === 'Space') this.input.jumpQueued = true;
      if (code === 'KeyC') this.input.crouch = true;
      if (code === 'Escape') { if (this.state === 'playing') this.events.onPause?.(); else if (this.state === 'paused') this.events.onResume?.(); }
      if (this.state !== 'playing') return;
      if (code === 'KeyJ') this.punch();
      if (code === 'KeyF') this.whip();
      if (code === 'KeyK') this.shoot();
      if (code === 'KeyE') this.use();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'KeyC') this.input.crouch = false;
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.input.crouch = false; });

    // Pointer lock and drag look. Touch look is handled separately.
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing' || this.mobile) return;
      if (e.button === 2) { e.preventDefault(); this.shoot(); return; }
      if (document.pointerLockElement !== this.canvas) {
        this.canvas.requestPointerLock?.();
        return;
      }
      if (e.button === 0) this.punch();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) this.ui.setLocked?.(true);
      else this.ui.setLocked?.(false);
    });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && this.state === 'playing') {
        this.cameraYaw -= e.movementX * .0024;
        this.cameraPitch = clamp(this.cameraPitch + e.movementY * .0018, -.18, .78);
      }
    });

    // Touch drag look on the open right side of the view.
    let lookPointer = null, lastX = 0, lastY = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch' || this.state !== 'playing') return;
      if (e.clientX < window.innerWidth * .38) return;
      lookPointer = e.pointerId; lastX = e.clientX; lastY = e.clientY;
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lookPointer) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      this.cameraYaw -= dx * .006;
      this.cameraPitch = clamp(this.cameraPitch + dy * .004, -.18, .78);
    });
    const releaseLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
    this.canvas.addEventListener('pointerup', releaseLook);
    this.canvas.addEventListener('pointercancel', releaseLook);

    // Joystick
    const joy = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    if (joy && knob) {
      let joyPointer = null, cx = 0, cy = 0;
      const start = (e) => {
        if (this.state !== 'playing') return;
        joyPointer = e.pointerId;
        const rect = joy.getBoundingClientRect();
        cx = rect.left + rect.width / 2; cy = rect.top + rect.height / 2;
        joy.setPointerCapture?.(e.pointerId);
        e.preventDefault(); e.stopPropagation();
      };
      const move = (e) => {
        if (e.pointerId !== joyPointer) return;
        const max = joy.clientWidth * .32;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.touchJoystick.x = dx / max;
        this.touchJoystick.y = -dy / max;
        e.preventDefault();
      };
      const end = (e) => {
        if (e.pointerId !== joyPointer) return;
        joyPointer = null; this.touchJoystick.x = 0; this.touchJoystick.y = 0;
        knob.style.transform = '';
      };
      joy.addEventListener('pointerdown', start);
      joy.addEventListener('pointermove', move);
      joy.addEventListener('pointerup', end);
      joy.addEventListener('pointercancel', end);
    }
    document.querySelectorAll('[data-action]').forEach((btn) => {
      const action = btn.dataset.action;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (this.state !== 'playing') return;
        btn.classList.add('pressed');
        if (action === 'jump') this.input.jumpQueued = true;
        else if (action === 'crouch') this.input.crouch = !this.input.crouch;
        else if (action === 'punch') this.punch();
        else if (action === 'whip') this.whip();
        else if (action === 'shoot') this.shoot();
        else if (action === 'interact') this.use();
      });
      const up = () => btn.classList.remove('pressed');
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });
  }

  showMenuScene() {
    this.state = 'menu';
    if (this.levelNumber !== 1) this.loadLevel(1);
    this.playerMesh.visible = false;
    this.ui.showMenu?.();
    this.camera.position.set(5, 4.4, 15);
    this.camera.lookAt(-1, 2.2, -18);
  }

  start(levelNumber) {
    this.audio.init();
    this.state = 'loading';
    this.loadLevel(levelNumber || this.levelNumber || 1);
    this.state = 'playing';
    this.playerMesh.visible = true;
    this.ui.startPlaying?.(this.level.info, this.level);
    this.audio.setBiome(this.level.biomeId);
    this.updateHUD(true);
    this.snapCamera();
    setTimeout(() => this.hint(this.level.info.hint, 7), 1200);
  }

  loadLevel(levelNumber) {
    if (this.level) {
      this.scene.remove(this.level.root);
      this.level.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      this.level = null;
    }
    this.enemies = [];
    this.boss = null;
    this.enemyShots = [];
    this.effects = [];
    this.whipFx = null;
    this.levelNumber = levelNumber;
    const level = buildLevel(levelNumber, this.renderer);
    this.level = level;
    this.levelStartZ = level.startPos.z;
    this.scene.add(level.root);
    this.scene.fog = new THREE.FogExp2(level.theme.fog, level.theme.fogDensity);
    this.scene.background = new THREE.Color(level.theme.fog);
    this.player = this.makePlayerState();
    this.player.pos.copy(level.startPos);
    this.player.health = 3;
    this.player.ammo = 6;
    this.player.invuln = 0;
    this.playerMesh.position.copy(this.player.pos);
    this.playerMesh.rotation.set(0, 0, 0);
    this.checkpoint = level.startPos.clone();
    this.checkpointPos = level.startPos.clone();
    this.elapsed = 0;
    this.idolsFound = 0;
    this.secretsFound = 0;
    this.visitedSecret = new Set();
    this.bossDefeated = false;
    this.bossRelicTimer = 0;
    this.completed = false;
    this.cameraYaw = 0;
    this.cameraPitch = .29;
    this.cameraDistance = 6.1;
    this.cameraShake = 0;
    this.instantiateEnemies();
    this.lastHint = '';
    this.hintCooldown = {};
    this.levelFadeStart = 0;
    this.ui.setLevel?.(level.info);
    this.updateHUD(true);
  }

  instantiateEnemies() {
    for (const data of this.level.enemies) {
      if (data.type === 'boss') {
        const mesh = createBoss();
        mesh.position.set(data.x, data.y || 0, data.z);
        mesh.rotation.y = Math.PI;
        this.level.root.add(mesh);
        this.boss = {
          mesh, data, hp: data.hp, maxHp: data.hp, awake: false, dead: false, state: 'idle',
          cooldown: 1.4, attackTimer: 0, hitFlash: 0, deathTimer: 0, projectileDone: false,
          hitDone: false, y: data.y, ring: null, radius: 2.2,
        };
        continue;
      }
      const mesh = createEnemy(data.type);
      mesh.position.set(data.x, data.y || 0, data.z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      this.level.root.add(mesh);
      const e = {
        data, mesh, type: data.type, hp: data.hp, maxHp: data.hp, alive: true,
        stun: 0, cooldown: .5 + Math.random(), attackTimer: 0, attackWindup: 0,
        deathTimer: 0, hitFlash: 0, disarmed: false, home: new THREE.Vector3(data.x, 0, data.z),
        wander: Math.random() * 10, speed: data.type === 'spider' ? 2.1 : data.type === 'scorpion' ? 2.5 : data.type === 'elite' ? 2.35 : data.type === 'skeleton' ? 1.8 : 2.0,
        radius: data.type === 'elite' ? .9 : data.type === 'spider' || data.type === 'scorpion' ? .55 : .48,
        y: data.y || 0, baseScale: mesh.scale.x,
      };
      this.enemies.push(e);
    }
  }

  snapCamera() {
    if (!this.player) return;
    this.updateCamera(1, true);
  }

  startSwing(hook) {
    const p = this.player;
    if (p.swinging) return;
    const start = p.pos.clone();
    const end = new THREE.Vector3(hook.x, Math.max(0, hook.y - 6.2), hook.z - 4.5);
    // land on a real surface near the end point when possible
    const support = this.groundUnder(end.x, end.z, 20);
    if (support) end.y = support.top + .02;
    else end.y = Math.max(0, end.y);
    p.swinging = true;
    p.grounded = false;
    p.vel.set(0, 0, 0);
    this.swing = {
      t: 0, duration: 1.15, start, end, hook, startY: p.pos.y,
      ropeStart: new THREE.Vector3(), trail: null,
    };
    this.audio.whip();
    this.audio.swing();
    this.ui.hint?.('Whip-swing! <b>Steer your landing</b> toward the far ledge.', 2200);
    this.cameraShake = Math.max(this.cameraShake, .28);
    this.whipFx?.line && this.scene.remove(this.whipFx.line);
    this.whipFx = { line: this.makeRopeLine(p.pos.clone().setY(p.pos.y + 1.2), new THREE.Vector3(hook.x, hook.y, hook.z)), timer: 1.2, swing: true };
  }

  updateSwing(dt) {
    const p = this.player;
    const s = this.swing;
    if (!s) { p.swinging = false; return; }
    s.t += dt / s.duration;
    const t = clamp(s.t, 0, 1);
    const ease = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    p.pos.x = THREE.MathUtils.lerp(s.start.x, s.end.x, ease);
    p.pos.z = THREE.MathUtils.lerp(s.start.z, s.end.z, ease);
    p.pos.y = THREE.MathUtils.lerp(s.startY, s.end.y, smoothstep(0, 1, t)) + Math.sin(Math.PI * t) * 2.5;
    p.targetFacing = Math.atan2(-(s.end.x - s.start.x), -(s.end.z - s.start.z));
    if (t >= 1) {
      p.swinging = false;
      p.grounded = false;
      p.vel.set((s.end.x - s.start.x) * .35, -1.5, (s.end.z - s.start.z) * .35);
      this.swing = null;
      this.audio.land();
      this.cameraShake = Math.max(this.cameraShake, .2);
    }
    if (this.whipFx) {
      this.whipFx.timer -= dt;
      this.updateRopeLine(this.whipFx.line, p.pos.clone().setY(p.pos.y + 1.2), new THREE.Vector3(s.hook.x, s.hook.y, s.hook.z));
      if (this.whipFx.timer <= 0) { this.scene.remove(this.whipFx.line); this.whipFx = null; }
    }
  }

  makeRopeLine(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xe2c180, transparent: true, opacity: .92 });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    this.scene.add(line);
    return line;
  }

  updateRopeLine(line, a, b) {
    if (!line) return;
    const arr = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const x = THREE.MathUtils.lerp(a.x, b.x, t);
      const y = THREE.MathUtils.lerp(a.y, b.y, t) + Math.sin(Math.PI * t) * -.35;
      const z = THREE.MathUtils.lerp(a.z, b.z, t);
      arr.push(new THREE.Vector3(x, y, z));
    }
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(arr);
  }

  findTarget(maxDist, minDot) {
    const p = this.player;
    const dir = new THREE.Vector3(-Math.sin(p.facing), 0, -Math.cos(p.facing));
    let best = null, bestScore = Infinity;
    const candidates = [];
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dx = e.mesh.position.x - p.pos.x, dz = e.mesh.position.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > maxDist || d < .25) continue;
      const dot = (dx * dir.x + dz * dir.z) / d;
      if (dot < minDot) continue;
      const score = d - dot * 2;
      if (score < bestScore) { bestScore = score; best = { e, point: e.mesh.position.clone().setY(e.mesh.position.y + (e.type === 'spider' || e.type === 'scorpion' ? .35 : 1.15)), dist: d, type: 'enemy' }; }
    }
    if (this.boss && this.boss.awake && !this.boss.dead) {
      const dx = this.boss.mesh.position.x - p.pos.x, dz = this.boss.mesh.position.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      const dot = d > 0 ? (dx * dir.x + dz * dir.z) / d : 1;
      if (d < maxDist + 2 && dot > minDot - .12 && d < bestScore) best = { e: this.boss, point: this.boss.mesh.position.clone().setY(2.3), dist: d, type: 'boss' };
    }
    return best;
  }

  findBreakable(maxDist) {
    const p = this.player;
    const dir = new THREE.Vector3(-Math.sin(p.facing), 0, -Math.cos(p.facing));
    let best = null, bestD = Infinity;
    for (const b of this.level.breakables) {
      if (b.broken) continue;
      const dx = b.x - p.pos.x, dz = b.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > maxDist) continue;
      const dot = d > .1 ? (dx * dir.x + dz * dir.z) / d : 1;
      if (dot < .2) continue;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  punch() {
    const p = this.player;
    if (this.state !== 'playing' || p.swinging || p.punchCd > 0) return;
    p.punchCd = .36;
    p.attackTime = .28; p.attackType = 'punch'; p.attackDuration = .28;
    this.audio.punch();
    let hit = false;
    const target = this.findTarget(2.4, .12);
    if (target) {
      if (target.type === 'boss') this.damageBoss(4, true);
      else this.hitEnemy(target.e, 1, .35, 1.4);
      hit = true;
    }
    const wall = this.findBreakable(2.7);
    if (wall && (!target || wall.secret !== undefined)) {
      this.level.breakWall(wall);
      this.audio.hit();
      this.ui.toast('A HIDDEN PASSAGE OPENS', 'gold');
      this.ui.hint?.('The wall gives way. <b>Claim what lies within.</b>', 3200);
      this.cameraShake = Math.max(this.cameraShake, .25);
      hit = true;
    }
    if (!hit) this.spawnImpact(p.pos.clone().add(new THREE.Vector3(-Math.sin(p.facing), 1.05, -Math.cos(p.facing)).multiplyScalar(1.6)), 0xd8c7a3);
  }

  whip() {
    const p = this.player;
    if (this.state !== 'playing' || p.swinging || p.whipCd > 0) return;
    // Prefer a nearby gold ring: this is the traversal mechanic.
    let hook = null, hookD = Infinity;
    const forward = new THREE.Vector3(-Math.sin(p.facing), 0, -Math.cos(p.facing));
    for (const h of this.level.hooks) {
      const dx = h.x - p.pos.x, dz = h.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < hookD && d < 7.4 && (dx * forward.x + dz * forward.z) > -.1) { hook = h; hookD = d; }
    }
    if (hook) { this.startSwing(hook); p.whipCd = .5; return; }
    p.whipCd = .5;
    p.attackTime = .38; p.attackType = 'whip'; p.attackDuration = .38;
    this.audio.whip();
    const target = this.findTarget(4.3, -.05);
    let endpoint;
    if (target) {
      endpoint = target.point.clone();
      if (target.type === 'boss') this.damageBoss(2, true);
      else {
        this.hitEnemy(target.e, .5, 1.35, .8);
        if (!target.e.disarmed && (target.e.type === 'raider' || target.e.type === 'elite')) {
          target.e.disarmed = true;
          if (target.e.mesh.userData.arms?.[1]?.userData.gun) target.e.mesh.userData.arms[1].userData.gun.visible = false;
          this.ui.toast('DISARMED', 'gold');
        }
      }
    } else {
      endpoint = p.pos.clone().add(new THREE.Vector3(forward.x, 0, forward.z).multiplyScalar(4.1)).setY(p.pos.y + 1.12);
    }
    const wall = this.findBreakable(4.4);
    if (wall) {
      endpoint = new THREE.Vector3(wall.x, 1.7, wall.z);
      this.level.breakWall(wall);
      this.audio.hit();
      this.ui.toast('SECRET WALL SHATTERED', 'gold');
      this.ui.hint?.('A hidden vault. <b>The idol is yours.</b>', 3000);
      this.cameraShake = Math.max(this.cameraShake, .28);
    } else if (!target) {
      this.spawnImpact(endpoint, 0xd9bc7a);
    }
    this.showWhip(endpoint);
  }

  showWhip(endpoint) {
    if (this.whipFx?.line) this.scene.remove(this.whipFx.line);
    const start = this.player.pos.clone().add(new THREE.Vector3(-Math.sin(this.player.facing) * .3 + .25, 1.2, -Math.cos(this.player.facing) * .3));
    const line = this.makeRopeLine(start, endpoint);
    this.updateRopeLine(line, start, endpoint);
    this.whipFx = { line, timer: .25 };
  }

  shoot() {
    const p = this.player;
    if (this.state !== 'playing' || p.swinging || p.shootCd > 0) return;
    if (p.ammo <= 0) {
      this.audio.click();
      if (!this.hintCooldown.ammo || performance.now() - this.hintCooldown.ammo > 3500) {
        this.hintCooldown.ammo = performance.now();
        this.ui.hint?.('The revolver is empty. <b>Use your whip</b> — it never runs out.', 3000);
      }
      return;
    }
    p.ammo--;
    p.shootCd = .78;
    p.attackTime = .3; p.attackType = 'shoot'; p.attackDuration = .3;
    this.audio.shoot();
    this.cameraShake = Math.max(this.cameraShake, .35);
    const target = this.findTarget(26, .45);
    const origin = p.pos.clone().add(new THREE.Vector3(-Math.sin(p.facing) * .18, 1.3, -Math.cos(p.facing) * .18));
    let endpoint;
    if (target) {
      endpoint = target.point.clone();
      if (target.type === 'boss') this.damageBoss(5, false);
      else this.hitEnemy(target.e, 2.2, .25, 2.2);
    } else {
      endpoint = p.pos.clone().add(new THREE.Vector3(-Math.sin(p.facing), .06, -Math.cos(p.facing)).multiplyScalar(32)).setY(1.4);
    }
    this.tracer(origin, endpoint);
    this.muzzle(origin);
    this.updateHUD(true);
  }

  tracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffd587, transparent: true, opacity: .92 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.effects.push({ type: 'tracer', mesh: line, life: .12 });
  }

  muzzle(pos) {
    const light = new THREE.PointLight(0xffbf5e, 7, 4, 2);
    light.position.copy(pos);
    this.scene.add(light);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(.13, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffe2a1, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false }));
    sphere.position.copy(pos);
    this.scene.add(sphere);
    this.effects.push({ type: 'muzzle', mesh: sphere, light, life: .1 });
  }

  spawnImpact(pos, color = 0xe1c78c) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.035 + Math.random() * .04, 5, 4), mat);
      m.userData.vel = new THREE.Vector3((Math.random() - .5) * 2.5, Math.random() * 2, (Math.random() - .5) * 2.5);
      g.add(m);
    }
    g.position.copy(pos);
    this.scene.add(g);
    this.effects.push({ type: 'impact', mesh: g, life: .35, material: mat });
  }

  use() {
    if (this.state !== 'playing') return;
    const near = this.nearInteraction;
    if (!near) return;
    if (near.type === 'lever') {
      if (this.level.pullLever(near.lever)) {
        this.audio.lever(); this.audio.gate();
        this.ui.toast('A HIDDEN PASSAGE OPENS', 'gold');
        this.ui.hint?.('A hidden vault. <b>Find the golden idol.</b>', 3400);
        this.cameraShake = Math.max(this.cameraShake, .3);
      }
    } else if (near.type === 'relic') {
      this.collectRelic();
    } else if (near.type === 'locked') {
      this.ui.toast('THE GUARDIAN PROTECTS THE SUN DISC', 'gold');
    }
  }

  groundUnder(x, z, maxTop = 40) {
    let best = null;
    for (const s of this.level.surfaces) {
      if (!s.active) continue;
      if (x < s.minX - .05 || x > s.maxX + .05 || z < s.minZ - .05 || z > s.maxZ + .05) continue;
      if (s.top > maxTop + .01) continue;
      if (!best || s.top > best.top) best = s;
    }
    return best;
  }

  resolveCollisions(axis, oldValue) {
    const p = this.player;
    const h = p.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    for (const c of this.level.colliders) {
      if (!c.active) continue;
      if (p.pos.y + h < c.minY || p.pos.y > c.maxY) continue;
      const minX = c.minX - RADIUS, maxX = c.maxX + RADIUS;
      const minZ = c.minZ - RADIUS, maxZ = c.maxZ + RADIUS;
      if (p.pos.x <= minX || p.pos.x >= maxX || p.pos.z <= minZ || p.pos.z >= maxZ) continue;
      if (axis === 'x') {
        if (oldValue <= minX) p.pos.x = minX;
        else if (oldValue >= maxX) p.pos.x = maxX;
        else p.pos.x = (p.pos.x - minX < maxX - p.pos.x) ? minX : maxX;
      } else {
        if (oldValue <= minZ) p.pos.z = minZ;
        else if (oldValue >= maxZ) p.pos.z = maxZ;
        else p.pos.z = (p.pos.z - minZ < maxZ - p.pos.z) ? minZ : maxZ;
      }
    }
  }

  updatePlayer(dt, time) {
    const p = this.player;
    p.crouching = !!(this.input.crouch && p.grounded);
    p.height = p.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
    p.invuln = Math.max(0, p.invuln - dt);
    p.attackTime = Math.max(0, p.attackTime - dt);
    p.whipCd = Math.max(0, p.whipCd - dt);
    p.punchCd = Math.max(0, p.punchCd - dt);
    p.shootCd = Math.max(0, p.shootCd - dt);
    p.useCd = Math.max(0, p.useCd - dt);
    p.idleTime += dt;

    if (p.swinging) {
      this.updateSwing(dt);
      this.playerMesh.position.copy(p.pos);
      this.playerMesh.rotation.y = angleLerp(this.playerMesh.rotation.y, p.targetFacing, Math.min(1, dt * 12));
      p.facing = angleLerp(p.facing, p.targetFacing, Math.min(1, dt * 12));
      const attack = p.attackTime > 0 ? 1 - p.attackTime / p.attackDuration : 0;
      this.playerMesh.userData.rig.update(dt, { moveSpeed: 3, grounded: false, crouch: false, attack, attackType: p.attackType, airborne: true });
      return;
    }

    let f = 0, r = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) f += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) f -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) r += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) r -= 1;
    f += this.touchJoystick.y;
    r += this.touchJoystick.x;
    const mag = Math.hypot(f, r);
    if (mag > 1) { f /= mag; r /= mag; }
    const moving = Math.abs(f) + Math.abs(r) > .08;
    const sprint = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && !p.crouching;
    let speed = p.crouching ? 2.05 : sprint ? 6.5 : 4.45;
    if (!p.grounded) speed *= .82;
    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const wish = new THREE.Vector3().addScaledVector(forward, f).addScaledVector(right, r);
    if (wish.lengthSq() > 0) wish.normalize();
    const targetVX = wish.x * speed, targetVZ = wish.z * speed;
    const accel = p.grounded ? 17 : 5;
    p.vel.x = damp(p.vel.x, targetVX, accel, dt);
    p.vel.z = damp(p.vel.z, targetVZ, accel, dt);
    p.moveSpeed = Math.hypot(p.vel.x, p.vel.z);
    if (moving) {
      p.targetFacing = Math.atan2(-wish.x, -wish.z);
      p.idleTime = 0;
    }
    p.facing = angleLerp(p.facing, p.targetFacing, Math.min(1, dt * 12));

    // horizontal movement with axis-separated collision resolution
    const oldX = p.pos.x, oldZ = p.pos.z;
    p.pos.x += p.vel.x * dt;
    this.resolveCollisions('x', oldX);
    p.pos.z += p.vel.z * dt;
    this.resolveCollisions('z', oldZ);

    // ground / gravity
    const support = this.groundUnder(p.pos.x, p.pos.z, p.pos.y + .44);
    if (p.grounded) {
      if (support && Math.abs(support.top - p.pos.y) < .55) {
        p.pos.y = support.top;
        p.coyote = .12;
      } else if (support && support.top < p.pos.y - .55) {
        p.grounded = false;
      } else if (!support) {
        p.grounded = false;
      }
    }
    if (this.input.jumpQueued) {
      this.input.jumpQueued = false;
      p.jumpBuffer = .14;
    } else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyote = p.grounded ? .12 : Math.max(0, p.coyote - dt);
    if (p.jumpBuffer > 0 && (p.grounded || p.coyote > 0) && !p.swinging) {
      p.vel.y = 7.0;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this.audio.jump();
    }
    if (!p.grounded) {
      p.vel.y -= GRAVITY * dt;
      const prevY = p.pos.y;
      p.pos.y += p.vel.y * dt;
      if (p.vel.y <= 0) {
        const landing = this.groundUnder(p.pos.x, p.pos.z, prevY + .08);
        if (landing && p.pos.y <= landing.top + .02 && prevY >= landing.top - .6) {
          p.pos.y = landing.top;
          const impact = Math.abs(p.vel.y);
          p.vel.y = 0;
          p.grounded = true;
          p.coyote = .12;
          if (impact > 5) { this.audio.land(); this.cameraShake = Math.max(this.cameraShake, .12); }
          this.playerMesh.userData.rig.land = .15;
        }
      }
      if (p.pos.y < -9) { this.die('THE JUNGLE CLAIMS YOU'); return; }
    }

    // footsteps
    if (p.grounded && p.moveSpeed > .7) {
      p.stepTimer -= dt * (p.moveSpeed / 4.2);
      if (p.stepTimer <= 0) {
        p.stepTimer = .37;
        this.audio.step(Math.random() > .5);
      }
    } else p.stepTimer = .1;

    this.playerMesh.position.copy(p.pos);
    this.playerMesh.rotation.y = p.facing;
    const attackProgress = p.attackTime > 0 ? 1 - p.attackTime / p.attackDuration : 0;
    this.playerMesh.userData.rig.update(dt, {
      moveSpeed: p.moveSpeed, grounded: p.grounded, crouch: p.crouching,
      attack: attackProgress, attackType: p.attackType, airborne: !p.grounded,
    });

    // pickups and secrets
    this.handleCollectibles(time);
    this.updateInteraction();
  }

  handleCollectibles(time) {
    const p = this.player;
    for (const idol of this.level.idols) {
      if (idol.collected) continue;
      if (Math.hypot(p.pos.x - idol.x, p.pos.z - idol.z) < 1.3 && Math.abs(p.pos.y + .8 - idol.y) < 2.2) {
        idol.collected = true; idol.mesh.visible = false;
        this.idolsFound++;
        this.secretsFound++;
        p.score += 500;
        this.audio.secret();
        this.ui.toast(`GOLDEN IDOL ${this.idolsFound} / ${this.level.idols.length}`, 'gold');
        this.spawnImpact(new THREE.Vector3(idol.x, idol.y, idol.z), 0xffd678);
        if (this.idolsFound === this.level.idols.length) {
          setTimeout(() => this.ui.toast('ALL SECRETS FOUND', 'gold'), 650);
        }
      }
    }
    for (const potion of this.level.potions) {
      if (potion.collected) continue;
      if (Math.hypot(p.pos.x - potion.x, p.pos.z - potion.z) < 1.25) {
        potion.collected = true; potion.mesh.visible = false;
        if (p.health < p.maxHealth) {
          p.health++; this.audio.potion(); this.ui.toast('HEALTH RESTORED', 'gold');
          if (this.ui.gainHeart) this.ui.gainHeart();
        } else {
          p.score += 100; this.audio.pickup(); this.ui.toast('+100 PATIENCE', 'gold');
        }
      }
    }
    for (const pickup of this.level.pickups) {
      if (pickup.collected) continue;
      if (Math.hypot(p.pos.x - pickup.x, p.pos.z - pickup.z) < 1.3) {
        pickup.collected = true; pickup.mesh.visible = false;
        p.ammo = Math.min(12, p.ammo + 4);
        this.audio.pickup();
        this.ui.toast('+4 ROUNDS', 'gold');
      }
    }
    for (const cp of this.level.checkpoints) {
      if (cp.active) continue;
      if (Math.hypot(p.pos.x - cp.x, p.pos.z - cp.z) < 2.7) {
        cp.active = true;
        this.checkpointPos.set(cp.x, .05, cp.z);
        this.audio.pickup();
        this.ui.toast('CHECKPOINT', 'gold');
      }
    }
  }

  updateInteraction() {
    const p = this.player;
    this.nearInteraction = null;
    let bestDist = 3.2;
    for (const lever of this.level.levers) {
      if (lever.active) continue;
      const d = Math.hypot(p.pos.x - lever.x, p.pos.z - lever.z);
      if (d < bestDist) { bestDist = d; this.nearInteraction = { type: 'lever', lever }; }
    }
    if (this.level.relic && !this.level.relic.collected) {
      const d = Math.hypot(p.pos.x - this.level.relic.x, p.pos.z - this.level.relic.z);
      if (d < 2.8) {
        this.nearInteraction = this.level.relic.locked ? { type: 'locked', relic: this.level.relic } : { type: 'relic', relic: this.level.relic };
      }
    }
    this.ui.interact?.(this.nearInteraction ? (this.nearInteraction.type === 'relic' ? 'TAKE THE RELIC' : this.nearInteraction.type === 'locked' ? 'GUARDIAN SEALED' : 'PULL THE LEVER') : null);
    if (!this.nearInteraction) {
      const wall = this.findBreakable(3.4);
      if (wall && (!this.hintCooldown.wall || performance.now() - this.hintCooldown.wall > 8000)) {
        this.hintCooldown.wall = performance.now();
        this.ui.hint?.('Cracked stone. <b>Punch or whip the wall</b> to reveal what lies behind.', 4200);
      }
    }
  }

  collectRelic() {
    const relic = this.level.relic;
    if (!relic || relic.collected || relic.locked) return;
    relic.collected = true;
    this.player.score += 1500;
    this.audio.relic();
    this.ui.toast(`${this.level.info.relic.toUpperCase()} RECOVERED`, 'gold');
    this.completed = true;
    this.state = 'complete';
    this.completeTimer = 1.35;
    if (document.pointerLockElement) document.exitPointerLock?.();
    this.events.onComplete?.({
      level: this.levelNumber,
      info: this.level.info,
      time: this.elapsed,
      idols: this.idolsFound,
      secrets: this.level.secretDoors.length,
      score: this.player.score,
      health: this.player.health,
    });
    this.ui.complete?.({
      title: this.level.info.relic,
      info: this.level.info,
      time: this.elapsed,
      idols: this.idolsFound,
      totalIdols: this.level.idols.length,
      score: this.player.score,
    });
    this.updateHUD(true);
  }

  hitEnemy(e, damage, stun = 0, knockback = 0) {
    if (!e.alive) return;
    e.hp -= damage;
    e.stun = Math.max(e.stun, stun);
    e.hitFlash = .14;
    this.audio.hit();
    this.cameraShake = Math.max(this.cameraShake, .1);
    if (knockback) {
      const dir = new THREE.Vector3(e.mesh.position.x - this.player.pos.x, 0, e.mesh.position.z - this.player.pos.z).normalize();
      e.mesh.position.addScaledVector(dir, knockback * .12);
    }
    this.spawnImpact(e.mesh.position.clone().setY(e.mesh.position.y + 1.0), e.type === 'spider' ? 0x9dff74 : 0xffb05f);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    e.deathTimer = .8;
    e.mesh.userData.dead = true;
    const baseScore = e.type === 'elite' ? 350 : e.type === 'raider' ? 180 : e.type === 'skeleton' ? 220 : 100;
    this.player.score += baseScore;
    this.audio.hit();
    this.spawnImpact(e.mesh.position.clone().setY(e.mesh.position.y + 1), 0xffcf73);
    this.updateHUD(true);
  }

  wakeBoss() {
    if (!this.boss || this.boss.awake) return;
    this.boss.awake = true;
    this.boss.state = 'chase';
    this.audio.roar();
    this.ui.toast('THE GUARDIAN AWAKENS', '');
    this.ui.showBoss?.(this.boss.maxHp, this.boss.maxHp);
    this.ui.hint?.('<b>Attack its glowing chest.</b> Keep moving when it raises both arms.', 5000);
    this.cameraShake = 1.1;
    this.updateHUD(true);
  }

  damageBoss(damage, melee = false) {
    const b = this.boss;
    if (!b || !b.awake || b.dead) return;
    b.hp = Math.max(0, b.hp - damage);
    b.hitFlash = .16;
    this.audio.bossHit();
    this.ui.showBoss?.(b.hp, b.maxHp);
    this.spawnImpact(b.mesh.position.clone().setY(2.5), 0xffa34a);
    if (b.hp <= 0) this.killBoss();
    this.updateHUD(true);
  }

  killBoss() {
    const b = this.boss;
    if (!b || b.dead) return;
    b.dead = true;
    b.state = 'dead';
    b.deathTimer = 2.5;
    this.bossDefeated = true;
    this.player.score += 3000;
    this.audio.roar();
    this.audio.relic();
    this.ui.hideBoss?.();
    this.ui.toast('THE GUARDIAN FALLS', 'gold');
    this.ui.hint?.('The Sun Disc is unsealed. <b>Claim your final relic.</b>', 5000);
    this.bossRelicTimer = 2.2;
    this.cameraShake = 1.4;
  }

  updateBoss(dt, time) {
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    if (!b.awake) {
      b.mesh.userData.animate?.(time, false);
      return;
    }
    if (b.dead) {
      b.deathTimer -= dt;
      b.mesh.rotation.z = Math.min(1.2, b.mesh.rotation.z + dt * .8);
      b.mesh.position.y = Math.max(-1.3, b.mesh.position.y - dt * .6);
      if (b.deathTimer <= 0) b.mesh.visible = false;
      if (this.bossRelicTimer > 0) {
        this.bossRelicTimer -= dt;
        if (this.bossRelicTimer <= 0) {
          this.level.relic.locked = false;
          this.level.relic.mesh.visible = true;
          this.level.relic.halo.visible = true;
          this.level.relic.light.visible = true;
          this.ui.toast('THE SUN DISC IS UNSEALED', 'gold');
          this.audio.relic();
          this.updateHUD(true);
        }
      }
      return;
    }
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    const dx = p.pos.x - b.mesh.position.x, dz = p.pos.z - b.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    b.mesh.rotation.y = Math.atan2(dx, dz);
    b.cooldown = Math.max(0, b.cooldown - dt);
    const enraged = b.hp < b.maxHp * .48;

    if (b.state === 'slam') {
      b.attackTimer -= dt;
      b.mesh.userData.animate?.(time, false);
      // arms rise during the wind-up
      const wind = clamp(1 - b.attackTimer / 1.25, 0, 1);
      if (b.mesh.userData.arms) {
        b.mesh.userData.arms[0].arm.rotation.x = -1.5 * Math.min(1, wind * 2);
        b.mesh.userData.arms[1].arm.rotation.x = -1.5 * Math.min(1, wind * 2);
      }
      if (!b.hitDone && b.attackTimer < .42) {
        b.hitDone = true;
        this.shockwave(b.mesh.position.clone(), 6.2, 0xff7a3b);
        this.cameraShake = 1.0;
        if (dist < 6.4 && p.pos.y < 2.0) this.hurtPlayer(1, 'boss', b);
        this.audio.roar();
      }
      if (b.attackTimer <= 0) {
        b.state = 'chase';
        b.cooldown = enraged ? 1.1 : 1.6;
        if (b.mesh.userData.arms) { b.mesh.userData.arms[0].arm.rotation.x = 0; b.mesh.userData.arms[1].arm.rotation.x = 0; }
      }
    } else if (b.state === 'throw') {
      b.attackTimer -= dt;
      const wind = clamp(1 - b.attackTimer / 1.0, 0, 1);
      if (!b.projectileDone && b.attackTimer < .45) {
        b.projectileDone = true;
        this.bossProjectile(b.mesh.position.clone().setY(3.0), p.pos.clone().setY(1.0), enraged);
      }
      if (b.attackTimer <= 0) { b.state = 'chase'; b.cooldown = enraged ? 1.4 : 2.1; }
    } else {
      // chase
      if (dist > 5.7) {
        const speed = enraged ? 3.5 : 2.6;
        const step = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(speed * dt);
        const nx = b.mesh.position.x + step.x, nz = b.mesh.position.z + step.z;
        if (Math.abs(nx) < 9.8 && this.groundUnder(nx, nz, 1.0)) { b.mesh.position.x = nx; b.mesh.position.z = nz; }
        b.mesh.userData.animate?.(time, true);
      } else {
        b.mesh.userData.animate?.(time, false);
        if (b.cooldown <= 0) {
          b.state = 'slam'; b.attackTimer = 1.25; b.hitDone = false;
          this.audio.roar();
        }
      }
      if (b.cooldown <= 0 && dist > 9 && Math.random() < dt * .48) {
        b.state = 'throw'; b.attackTimer = 1.0; b.projectileDone = false;
      }
    }
    b.mesh.position.y = b.y + (b.hitFlash > 0 ? Math.sin(time * 80) * .05 : 0);
  }

  shockwave(pos, radius, color = 0xffc06a) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(.4, .55, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(pos).setY(.12);
    this.scene.add(ring);
    this.effects.push({ type: 'ring', mesh: ring, life: .55, max: .55, radius });
  }

  bossProjectile(from, to, enraged) {
    const dir = to.clone().sub(from).normalize();
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(.34, 0),
      new THREE.MeshStandardMaterial({ color: 0xff8b42, emissive: 0xff3c00, emissiveIntensity: 3.3, roughness: .4 })
    );
    mesh.position.copy(from);
    this.scene.add(mesh);
    const light = new THREE.PointLight(0xff6b2b, 5, 8, 2); mesh.add(light);
    this.enemyShots.push({ mesh, pos: from.clone(), vel: dir.multiplyScalar(enraged ? 13 : 10), life: 5, radius: .5, boss: true });
    this.audio._noise(.2, .14, 'bandpass', 600, .8);
  }

  updateEnemies(dt, time) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.deathTimer > 0) {
          e.deathTimer -= dt;
          e.mesh.scale.multiplyScalar(1 - dt * .8);
          e.mesh.position.y = Math.max(-1, e.mesh.position.y - dt * .55);
          if (e.deathTimer <= 0) e.mesh.visible = false;
        }
        continue;
      }
      const dx = p.pos.x - e.mesh.position.x, dz = p.pos.z - e.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      e.stun = Math.max(0, e.stun - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (dist > 32) continue;
      const active = dist < 25;
      const yaw = Math.atan2(dx, dz);
      if (active && e.stun <= 0) {
        e.mesh.rotation.y = angleLerp(e.mesh.rotation.y, yaw, Math.min(1, dt * 7));
        const armed = (e.type === 'raider' || e.type === 'elite') && !e.disarmed;
        if (dist < 17 && dist > 3.0 && armed && e.cooldown <= 0 && Math.random() < dt * .8) {
          e.attackTimer = .55;
          e.cooldown = 2.3 + Math.random() * 1.4;
          e.windup = true;
        }
        if (e.windup) {
          e.attackTimer -= dt;
          if (e.attackTimer <= 0) {
            e.windup = false;
            this.enemyShoot(e);
          }
          e.mesh.userData.animate?.(time, false, true);
        } else if (dist > (e.type === 'spider' || e.type === 'scorpion' ? 1.4 : 2.0)) {
          const nx = e.mesh.position.x + dx / Math.max(1, dist) * e.speed * dt;
          const nz = e.mesh.position.z + dz / Math.max(1, dist) * e.speed * dt;
          const g = this.groundUnder(nx, nz, 1.6);
          if (g && Math.abs(g.top - e.mesh.position.y) < .7 && Math.abs(nx) < 5.9) {
            e.mesh.position.x = nx; e.mesh.position.z = nz;
          }
          e.mesh.userData.animate?.(time, true, false);
        } else {
          e.mesh.userData.animate?.(time, false, false);
          if (e.cooldown <= 0) {
            e.cooldown = 1.2;
            this.hurtPlayer(1, 'enemy', e);
            e.mesh.userData.animate?.(time, false, true);
          }
        }
      } else {
        // idle / stun sway
        if (e.stun > 0) e.mesh.rotation.z = Math.sin(time * 35) * .09;
        else { e.mesh.rotation.z *= .9; e.mesh.userData.animate?.(time, false); }
      }
      // face + flash
      if (e.hitFlash > 0) e.mesh.position.y = e.y + Math.sin(time * 90) * .04;
      else e.mesh.position.y = e.y;
    }
    // enemy shots
    for (const s of this.enemyShots) {
      s.life -= dt;
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      if (s.life <= 0) { s.mesh.visible = false; continue; }
      const py = p.pos.y + (p.crouching ? .55 : 1.0);
      if (Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < s.radius + .35 && Math.abs(s.pos.y - py) < .65) {
        this.hurtPlayer(1, 'projectile', s);
        s.life = 0; s.mesh.visible = false;
        this.spawnImpact(s.pos.clone(), 0xff8545);
      }
    }
    for (let i = this.enemyShots.length - 1; i >= 0; i--) if (this.enemyShots[i].life <= 0) this.enemyShots.splice(i, 1);
  }

  enemyShoot(e) {
    const p = this.player;
    const from = e.mesh.position.clone().setY(e.type === 'elite' ? 2.1 : 1.35);
    const to = p.pos.clone().setY(p.pos.y + .8);
    const dir = to.sub(from).normalize();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffa45b }));
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.enemyShots.push({ mesh, pos: from.clone(), vel: dir.multiplyScalar(11), life: 3, radius: .2 });
    this.audio._noise(.12, .12, 'highpass', 1700, .7);
    this.spawnImpact(from, 0xffb45c);
  }

  hurtPlayer(amount, source, inst) {
    const p = this.player;
    if (this.state !== 'playing' || p.invuln > 0 || this.completed) return;
    p.health -= amount;
    p.invuln = 1.15;
    this.audio.hurt();
    this.cameraShake = Math.max(this.cameraShake, .75);
    this.ui.damage?.();
    this.spawnImpact(p.pos.clone().setY(p.pos.y + 1.1), 0xd34b2a);
    this.updateHUD(true);
    if (p.health <= 0) {
      this.die(source === 'fall' ? 'THE DEPTHS CLAIM YOU' : 'THE TEMPLE CLAIMS YOU');
    }
  }

  die(message) {
    if (this.state !== 'playing') return;
    this.state = 'dead';
    this.deadTimer = 1.85;
    this.audio.roar();
    this.ui.fade?.(true);
    this.ui.toast(message, '');
    if (document.pointerLockElement) document.exitPointerLock?.();
  }

  respawn() {
    const p = this.player;
    p.health = p.maxHealth;
    p.ammo = Math.max(p.ammo, 4);
    p.pos.copy(this.checkpointPos);
    p.vel.set(0, 0, 0);
    p.grounded = false;
    p.invuln = 2.2;
    p.swinging = false;
    this.swing = null;
    this.enemyShots.forEach(s => { s.life = 0; s.mesh.visible = false; });
    this.enemyShots = [];
    this.state = 'playing';
    this.ui.fade?.(false);
    this.snapCamera();
    this.cameraShake = 0;
    this.updateHUD(true);
    this.ui.hint?.('Back on your feet. <b>The temple remembers.</b>', 2600);
  }

  updateEffects(dt) {
    for (const fx of this.effects) {
      fx.life -= dt;
      if (fx.type === 'ring') {
        const t = 1 - fx.life / fx.max;
        const sc = 1 + t * fx.radius * 1.7;
        fx.mesh.scale.set(sc, sc, sc);
        fx.mesh.material.opacity = .8 * (1 - t);
      } else if (fx.type === 'tracer') {
        fx.mesh.material.opacity = Math.max(0, fx.life / .12) * .9;
      } else if (fx.type === 'impact') {
        for (const m of fx.mesh.children) {
          m.position.addScaledVector(m.userData.vel, dt);
          m.userData.vel.y -= 9 * dt;
        }
        fx.material.opacity = Math.max(0, fx.life / .35);
      } else if (fx.type === 'muzzle') {
        fx.mesh.scale.setScalar(1 + (1 - fx.life / .1) * 2);
        fx.mesh.material.opacity = Math.max(0, fx.life / .1);
        if (fx.light) fx.light.intensity = Math.max(0, fx.life / .1) * 7;
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      if (fx.life <= 0) {
        this.scene.remove(fx.mesh);
        if (fx.type === 'muzzle' && fx.light) this.scene.remove(fx.light);
        if (fx.type === 'impact') fx.material.dispose();
        fx.mesh.geometry?.dispose();
        this.effects.splice(i, 1);
      }
    }
    if (this.whipFx && !this.whipFx.swing) {
      this.whipFx.timer -= dt;
      this.whipFx.line.material.opacity = clamp(this.whipFx.timer / .25, 0, 1);
      if (this.whipFx.timer <= 0) {
        this.scene.remove(this.whipFx.line);
        this.whipFx = null;
      }
    }
  }

  updateCamera(dt, instant = false) {
    if (!this.player) return;
    const p = this.player;
    const targetY = p.pos.y + (p.crouching ? .9 : 1.35);
    const dist = this.cameraDistance + (p.moveSpeed > 5 ? .4 : 0) + (p.swinging ? 1.0 : 0);
    const pitchCos = Math.cos(this.cameraPitch);
    const desired = new THREE.Vector3(
      p.pos.x + Math.sin(this.cameraYaw) * dist * pitchCos,
      targetY + Math.sin(this.cameraPitch) * dist,
      p.pos.z + Math.cos(this.cameraYaw) * dist * pitchCos
    );
    const lookAhead = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw)).multiplyScalar(2.8);
    const lookAt = new THREE.Vector3(p.pos.x, targetY - .08, p.pos.z).add(lookAhead);
    if (instant) {
      this.cameraPos.copy(desired);
      this.cameraLook.copy(lookAt);
    } else {
      const lambda = 9;
      this.cameraPos.x = damp(this.cameraPos.x, desired.x, lambda, dt);
      this.cameraPos.y = damp(this.cameraPos.y, desired.y, lambda, dt);
      this.cameraPos.z = damp(this.cameraPos.z, desired.z, lambda, dt);
      this.cameraLook.x = damp(this.cameraLook.x, lookAt.x, lambda, dt);
      this.cameraLook.y = damp(this.cameraLook.y, lookAt.y, lambda, dt);
      this.cameraLook.z = damp(this.cameraLook.z, lookAt.z, lambda, dt);
    }
    let shakeX = 0, shakeY = 0;
    if (this.cameraShake > 0) {
      const s = this.cameraShake;
      shakeX = Math.sin(this.cameraShakeSeed + performance.now() * .04) * .09 * s;
      shakeY = Math.cos(this.cameraShakeSeed + performance.now() * .05) * .07 * s;
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.7);
    }
    this.camera.position.copy(this.cameraPos).add(new THREE.Vector3(shakeX, shakeY, shakeX * .4));
    this.camera.lookAt(this.cameraLook);
    const targetFov = p.swinging ? 72 : p.moveSpeed > 5.8 ? 66 : 62;
    this.camera.fov = damp(this.camera.fov, targetFov, 4, dt);
    this.camera.updateProjectionMatrix();
  }

  updateMenu(dt) {
    this.menuTime += dt;
    if (!this.level) return;
    const t = this.menuTime;
    this.camera.position.set(Math.sin(t * .09) * 5.5, 3.7 + Math.sin(t * .15) * .25, 15.2);
    this.camera.lookAt(Math.sin(t * .07) * 1.5, 2.2, -19);
    // animate only environment
    const fake = { player: { pos: new THREE.Vector3(0, .02, 7.6), grounded: true, crouching: false } };
    this.level.update(dt, t, { player: fake.player, playerOnGround: true, hurtPlayer() {}, audio: this.audio, notify() {}, shakeCamera() {}, wakeBoss() {} });
    this.playerMesh.visible = false;
  }

  update(dt, time) {
    if (this.state === 'menu') { this.updateMenu(dt); return; }
    if (this.state === 'paused' || this.state === 'complete' || this.state === 'ending') {
      if (this.level) this.level.update(Math.min(dt, .016), time, { player: this.player, playerOnGround: this.player.grounded, hurtPlayer() {}, audio: this.audio, notify() {}, shakeCamera() {}, wakeBoss() {} });
      this.updateCamera(dt);
      this.updateEffects(dt);
      return;
    }
    if (this.state === 'dead') {
      this.deadTimer -= dt;
      this.updateEffects(dt);
      this.updateCamera(dt);
      this.level?.update(dt, time, this);
      if (this.deadTimer <= 0) this.respawn();
      return;
    }
    if (this.state !== 'playing') return;
    this.elapsed += dt;
    this.updatePlayer(dt, time);
    if (this.state !== 'playing') return;
    this.level.update(dt, time, this);
    this.updateEnemies(dt, time);
    this.updateBoss(dt, time);
    this.updateEffects(dt);
    this.updateCamera(dt);
    this.uiTimer -= dt;
    if (this.uiTimer <= 0) { this.uiTimer = .12; this.updateHUD(false); }
  }

  updateHUD(force = false) {
    if (!this.level || !this.player) return;
    const p = this.player;
    const relic = this.level.relic;
    const dist = relic ? Math.max(0, Math.hypot(p.pos.x - relic.x, p.pos.z - relic.z)) : 0;
    let objective = `Recover the ${this.level.info.relic}`;
    if (this.levelNumber === 20 && this.boss && !this.bossDefeated) objective = 'Defeat the Guardian of the Sun';
    if (this.levelNumber === 20 && this.bossDefeated && !relic?.collected) objective = 'Claim the Sun Disc';
    if (relic?.collected) objective = 'Relic recovered';
    this.ui.setHUD?.({
      level: this.levelNumber, info: this.level.info, biome: this.level.info.biome,
      health: p.health, maxHealth: p.maxHealth, ammo: p.ammo,
      idols: this.idolsFound, totalIdols: this.level.idols.length,
      score: p.score, objective, distance: dist,
      playerZ: p.pos.z, relicZ: relic?.z ?? 0, startZ: this.levelStartZ,
      secrets: this.level.secretDoors.map((s, i) => ({ z: s.z ?? 0, found: i < this.idolsFound })),
      yaw: this.cameraYaw, playerX: p.pos.x, playerZ: p.pos.z,
      boss: this.boss && this.boss.awake && !this.boss.dead,
    }, force);
  }

  hint(text, ms = 4500) {
    if (!text) return;
    this.ui.hint?.(text, ms);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    const dtRaw = Math.min(this.clock.getDelta(), .05);
    const time = this.clock.elapsedTime;
    if (this.state === 'playing' || this.state === 'dead') this.update(dtRaw, time);
    else this.update(dtRaw, time);
    this.render();
    requestAnimationFrame(() => this.loop());
  }
}
