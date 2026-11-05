import * as THREE from 'three';
import { mulberry32 } from './utils.js';

const cache = new Map();

function canvasTexture(key, draw, { repeat = [1, 1], srgb = true, bump = false } = {}) {
  const cacheKey = `${key}:${repeat.join(',')}:${bump}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  draw(ctx, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...repeat);
  texture.anisotropy = 4;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(cacheKey, texture);
  return texture;
}

function grain(ctx, w, h, rng, count, alpha, light) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h, s = 0.4 + rng() * 2.2;
    const c = light ? 255 : 0;
    ctx.fillStyle = `rgba(${c},${c},${c},${alpha * (0.25 + rng())})`;
    ctx.fillRect(x, y, s, s);
  }
}

function cracks(ctx, w, h, rng, count, color) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let c = 0; c < count; c++) {
    let x = rng() * w, y = rng() * h;
    ctx.lineWidth = 0.5 + rng() * 1.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 5 + Math.floor(rng() * 10);
    for (let i = 0; i < steps; i++) {
      x += (rng() - 0.5) * 46; y += (rng() - 0.45) * 35;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function moss(ctx, w, h, rng, count, alpha = 0.16) {
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h, r = 4 + rng() * 34;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(62,84,38,${alpha + rng() * alpha})`);
    g.addColorStop(1, 'rgba(45,66,27,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}

const STONE_PALETTES = {
  jungle: { base: '#686a54', light: '#84856a', dark: '#383b2d', line: 'rgba(28,31,22,.55)', moss: true },
  temple: { base: '#9c8055', light: '#c0a270', dark: '#60482b', line: 'rgba(52,38,22,.53)', moss: true },
  catacomb: { base: '#4b4e50', light: '#676b6b', dark: '#25292c', line: 'rgba(13,17,18,.64)', moss: true },
  lost: { base: '#7e5d31', light: '#b38a47', dark: '#402b12', line: 'rgba(39,25,10,.55)', moss: false },
};

export function stoneTexture(theme = 'temple', type = 'floor') {
  const p = STONE_PALETTES[theme] || STONE_PALETTES.temple;
  return canvasTexture(`stone-${theme}-${type}`, (ctx, size) => {
    const rng = mulberry32(theme.length * 917 + type.length * 43 + (theme === 'catacomb' ? 71 : 3));
    ctx.fillStyle = p.base; ctx.fillRect(0, 0, size, size);
    const tile = type === 'floor' ? 128 : 170;
    for (let row = 0; row < size / tile + 1; row++) {
      const offset = row % 2 ? tile * 0.5 : 0;
      for (let col = -1; col < size / tile + 1; col++) {
        const x = col * tile + offset, y = row * tile;
        const shade = 0.78 + rng() * 0.36;
        ctx.fillStyle = `rgba(${Math.floor(255 * shade * 0.65)},${Math.floor(255 * shade * 0.65)},${Math.floor(255 * shade * 0.6)},.12)`;
        ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
        if (rng() > 0.42) {
          ctx.fillStyle = `rgba(255,241,203,${0.018 + rng() * 0.038})`;
          ctx.fillRect(x + 4, y + 3, tile - 8, 2 + rng() * 5);
        }
        if (rng() > 0.55) {
          ctx.fillStyle = `rgba(12,10,7,${0.04 + rng() * 0.09})`;
          ctx.fillRect(x + 5 + rng() * 60, y + 5 + rng() * 70, 12 + rng() * 50, 3 + rng() * 10);
        }
      }
      ctx.strokeStyle = p.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, row * tile); ctx.lineTo(size, row * tile); ctx.stroke();
      for (let x = row % 2 ? tile * 0.5 : 0; x < size; x += tile) {
        ctx.beginPath(); ctx.moveTo(x, row * tile); ctx.lineTo(x, row * tile + tile); ctx.stroke();
      }
      if (rng() > 0.45) {
        ctx.fillStyle = 'rgba(25,23,16,.1)';
        ctx.fillRect(0, row * tile + tile - 3, size, 3);
      }
    }
    grain(ctx, size, size, rng, 6500, 0.13, true);
    grain(ctx, size, size, rng, 4200, 0.16, false);
    cracks(ctx, size, size, rng, type === 'floor' ? 9 : 5, `rgba(25,23,16,.32)`);
    if (p.moss) moss(ctx, size, size, rng, type === 'floor' ? 9 : 14, 0.11);
    // damp edge staining
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, 'rgba(0,0,0,.1)'); grad.addColorStop(0.4, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  }, { repeat: [1, 1] });
}

export function sandTexture() {
  return canvasTexture('sand', (ctx, size) => {
    const rng = mulberry32(33);
    ctx.fillStyle = '#9f8151'; ctx.fillRect(0, 0, size, size);
    grain(ctx, size, size, rng, 14000, 0.11, true);
    grain(ctx, size, size, rng, 8000, 0.08, false);
    for (let i = 0; i < 20; i++) {
      ctx.strokeStyle = `rgba(70,52,30,${0.06 + rng() * 0.06})`; ctx.lineWidth = 1 + rng() * 2;
      ctx.beginPath(); const y = rng() * size;
      ctx.moveTo(0, y);
      for (let x = 0; x < size; x += 34) ctx.lineTo(x, y + Math.sin(x * 0.03) * 8 + (rng() - 0.5) * 7);
      ctx.stroke();
    }
  }, { repeat: [4, 4] });
}

export function barkTexture() {
  return canvasTexture('bark', (ctx, size) => {
    const rng = mulberry32(44);
    ctx.fillStyle = '#493723'; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 80; i++) {
      ctx.strokeStyle = `rgba(${20 + rng() * 32},${16 + rng() * 25},${9 + rng() * 16},${0.3 + rng() * 0.5})`;
      ctx.lineWidth = 1 + rng() * 8;
      ctx.beginPath(); const x = rng() * size;
      ctx.moveTo(x, 0);
      for (let y = 0; y < size; y += 20) ctx.lineTo(x + Math.sin(y * 0.03 + i) * 7, y);
      ctx.stroke();
    }
    grain(ctx, size, size, rng, 3000, 0.16, true);
  }, { repeat: [1, 2] });
}

export function clothTexture(theme = 'temple') {
  return canvasTexture(`cloth-${theme}`, (ctx, size) => {
    const rng = mulberry32(theme.length * 66);
    const base = theme === 'catacomb' ? '#4c2a24' : theme === 'lost' ? '#7b271a' : '#6d3823';
    ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(${rng() > .5 ? '255,220,160' : '0,0,0'},${0.02 + rng() * .03})`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 30 + rng() * 100);
    }
    ctx.strokeStyle = 'rgba(220,180,95,.26)'; ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, size - 28, size - 28);
    ctx.beginPath(); ctx.arc(size / 2, size / 2, 74, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size / 2, 70); ctx.lineTo(size / 2 + 60, size / 2); ctx.lineTo(size / 2, size - 70); ctx.lineTo(size / 2 - 60, size / 2); ctx.closePath(); ctx.stroke();
    grain(ctx, size, size, rng, 2000, .08, false);
  }, { repeat: [1, 2] });
}

export function glyphTexture(theme = 'temple') {
  return canvasTexture(`glyph-${theme}`, (ctx, size) => {
    const rng = mulberry32(theme.length * 188 + 4);
    ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = theme === 'lost' ? 'rgba(255,205,98,.46)' : theme === 'catacomb' ? 'rgba(111,204,150,.28)' : 'rgba(66,49,27,.44)';
    ctx.lineWidth = 5;
    for (let i = 0; i < 13; i++) {
      const x = 40 + rng() * 430, y = 70 + rng() * 370, s = 18 + rng() * 34;
      ctx.beginPath();
      if (rng() > .5) { ctx.arc(x, y, s, 0, Math.PI * 1.3); }
      else { ctx.moveTo(x, y); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s * .4, y + s); ctx.closePath(); }
      ctx.stroke();
      if (rng() > .6) { ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke(); }
    }
  }, { repeat: [1, 1] });
}

export function goldTexture() {
  return canvasTexture('gold', (ctx, size) => {
    const rng = mulberry32(77);
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#8c5e14'); g.addColorStop(.22, '#e8ba4f'); g.addColorStop(.44, '#a56c16'); g.addColorStop(.66, '#f6d77c'); g.addColorStop(1, '#76500f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    grain(ctx, size, size, rng, 4500, .08, true);
    ctx.strokeStyle = 'rgba(50,29,3,.26)'; ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(rng() * size, rng() * size, 8 + rng() * 80, rng() * 6, rng() * 6); ctx.stroke(); }
  }, { repeat: [1, 1] });
}

export function smokeTexture() {
  return canvasTexture('smoke', (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,225,170,.8)'); g.addColorStop(.25, 'rgba(255,170,80,.25)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }, { repeat: [1, 1] });
}

export function makeMaterialSet(theme, renderer) {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const prep = (tex, repeatX, repeatY) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.anisotropy = maxAniso;
    return t;
  };
  const floorMap = prep(stoneTexture(theme, 'floor'), 3, 5);
  const wallMap = prep(stoneTexture(theme, 'wall'), 2, 2);
  const glyph = prep(glyphTexture(theme), 1, 1);
  const mats = {
    floor: new THREE.MeshStandardMaterial({ map: floorMap, bumpMap: floorMap, bumpScale: 0.08, roughness: 0.92, metalness: 0.02, color: 0xffffff }),
    wall: new THREE.MeshStandardMaterial({ map: wallMap, bumpMap: wallMap, bumpScale: 0.12, roughness: 0.94 }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x5d5544, roughness: 1 }),
    trim: new THREE.MeshStandardMaterial({ color: theme === 'catacomb' ? 0x2b3031 : 0x74572f, roughness: .82, metalness: .05 }),
    glyph: new THREE.MeshStandardMaterial({ map: glyph, transparent: true, opacity: .72, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }),
    gold: new THREE.MeshStandardMaterial({ map: goldTexture(), color: 0xffdf88, roughness: .32, metalness: .78, emissive: 0x4a2d00, emissiveIntensity: .22 }),
    bronze: new THREE.MeshStandardMaterial({ color: 0x8b6127, roughness: .42, metalness: .72 }),
    stoneProp: new THREE.MeshStandardMaterial({ color: theme === 'catacomb' ? 0x515353 : theme === 'lost' ? 0x6e552e : 0x817358, roughness: .95 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x2d2a22, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ map: barkTexture(), color: 0x9b7a54, roughness: .9 }),
    cloth: new THREE.MeshStandardMaterial({ map: clothTexture(theme), roughness: .94, side: THREE.DoubleSide }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd8cda7, roughness: .8 }),
    ember: new THREE.MeshStandardMaterial({ color: 0xff9d43, emissive: 0xff6218, emissiveIntensity: 3.2, roughness: .2 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffb15c, transparent: true, opacity: .82, blending: THREE.AdditiveBlending, depthWrite: false }),
    water: new THREE.MeshStandardMaterial({ color: theme === 'catacomb' ? 0x18332f : 0x325c4f, transparent: true, opacity: .64, roughness: .18, metalness: .25 }),
    moss: new THREE.MeshStandardMaterial({ color: 0x455a32, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3e5e2c, roughness: .9, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x607b36, roughness: .9, side: THREE.DoubleSide }),
    bark: new THREE.MeshStandardMaterial({ map: barkTexture(), color: 0x7f6548, roughness: 1 }),
    sand: new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x5d4527, roughness: 1 }),
    black: new THREE.MeshStandardMaterial({ color: 0x090806, roughness: 1 }),
    glowGreen: new THREE.MeshStandardMaterial({ color: 0x79ffc9, emissive: 0x20d77b, emissiveIntensity: 2.4, roughness: .4 }),
  };
  return mats;
}

export function disposeThemeCache() {
  // Textures are intentionally kept for the life of the page; levels reuse the
  // material cache and cloning textures per level would waste GPU memory.
}
