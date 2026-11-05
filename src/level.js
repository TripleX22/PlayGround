import * as THREE from 'three';
import { makeMaterialSet } from './textures.js';
import { createIdol, createRelic, createPotion, createTorch, createEnemy } from './character.js';
import { mulberry32, randRange, pick, chance, clamp } from './utils.js';

export const BIOMES = {
  1: { id: 'jungle', name: 'THE JUNGLE', short: 'JUNGLE', subtitle: 'GREEN HELL', chapter: 'I' },
  2: { id: 'temple', name: 'THE MAYA TEMPLE', short: 'MAYA TEMPLE', subtitle: 'CITY OF STONE', chapter: 'II' },
  3: { id: 'catacomb', name: 'THE CATACOMBS', short: 'CATACOMBS', subtitle: 'BELOW THE EARTH', chapter: 'III' },
  4: { id: 'lost', name: 'THE LOST CITY', short: 'LOST CITY', subtitle: 'GOLDEN RUIN', chapter: 'IV' },
};

export const LEVELS = [
  { n: 1, name: 'The Serpent Trail', relic: 'Serpent Mask', biome: 1, diff: 1, hint: 'Move with the left stick. Reach the relic at the end of the trail.' },
  { n: 2, name: 'Mossback Ruins', relic: 'Jade Jaguar', biome: 1, diff: 1, hint: 'Jump across broken ground. Your whip can shatter cracked walls.' },
  { n: 3, name: 'Vinefall Gorge', relic: 'Crystal Skull', biome: 1, diff: 1, hint: 'Whip the gold rings overhead to swing across the gorge.' },
  { n: 4, name: 'The Sunken Idol', relic: 'River Chalice', biome: 1, diff: 2, hint: 'Spider nests hide in the ruins. Punch or shoot them before they swarm.' },
  { n: 5, name: 'Temple of Roots', relic: 'Rootbound Crown', biome: 1, diff: 2, hint: 'Two golden idols are hidden in every temple. Look for cracked walls.' },
  { n: 6, name: 'Step of the Jaguar', relic: 'Jaguar Idol', biome: 2, diff: 2, hint: 'Pressure plates open sealed gates. Step on the glowing stone.' },
  { n: 7, name: 'The Whispering Halls', relic: 'Whispering Mask', biome: 2, diff: 2, hint: 'Raiders carry guns. Whip them to disarm, then close in.' },
  { n: 8, name: 'The Sun Gate', relic: 'Solar Disc', biome: 2, diff: 3, hint: 'Dart traps fire at chest height. Crouch beneath them.' },
  { n: 9, name: 'Serpent’s Stair', relic: 'Feathered Serpent', biome: 2, diff: 3, hint: 'One lever opens a hidden vault. Press USE beside it.' },
  { n: 10, name: 'Heart of the Maya', relic: 'Maya Heart', biome: 2, diff: 3, hint: 'The temple guards its heart well. Keep moving.' },
  { n: 11, name: 'Bone Vestibule', relic: 'Bone Chalice', biome: 3, diff: 3, hint: 'Beneath the earth, the dead do not rest. Watch the floor.' },
  { n: 12, name: 'The Hollow Choir', relic: 'Choir Bell', biome: 3, diff: 4, hint: 'Collapsing floors fall a heartbeat after you touch them.' },
  { n: 13, name: 'Drowned Crypts', relic: 'Drowned Crown', biome: 3, diff: 4, hint: 'Use the whip rings to cross the flooded chasms.' },
  { n: 14, name: 'Hall of Skulls', relic: 'Obsidian Skull', biome: 3, diff: 4, hint: 'Skeletons fear gunfire. Save a round for the dark.' },
  { n: 15, name: 'The Deep Sanctum', relic: 'Sanctum Key', biome: 3, diff: 4, hint: 'Two secrets. Two paths. The temple rewards the curious.' },
  { n: 16, name: 'The Gilded Approach', relic: 'Gilded Serpent', biome: 4, diff: 4, hint: 'The lost city is awake. Its guardians are not merciful.' },
  { n: 17, name: 'Bridge of Ghosts', relic: 'Ghost Fan', biome: 4, diff: 5, hint: 'Do not stop on the vanishing bridge. Run.' },
  { n: 18, name: 'Citadel of Ash', relic: 'Ash Scepter', biome: 4, diff: 5, hint: 'Elite guardians take many hits. Use your revolver.' },
  { n: 19, name: 'Throne of the Sun', relic: 'Sun Crown', biome: 4, diff: 5, hint: 'The final threshold. Beyond lies the Sun Disc.' },
  { n: 20, name: 'The Final Relic', relic: 'Sun Disc', biome: 4, diff: 6, boss: true, hint: 'The Guardian of the Sun cannot be reasoned with. Defeat it.' },
];

const ROOM_NAMES = {
  jungle: ['Vine-Choked Causeway', 'Mosswater Hall', 'Rootbound Passage', 'The Green Maw', 'Idol Alcove', 'Canopy Walk', 'Sunken Colonnade'],
  temple: ['Hall of Glyphs', 'Jaguar Gallery', 'Sun Gate', 'Serpent Colonnade', 'Offerings Hall', 'Moon Chamber', 'The Long Stair'],
  catacomb: ['Ossuary', 'Whispering Vault', 'Drowned Crypt', 'Skull Hall', 'Bone Choir', 'The Cold Deep', 'Sealed Sanctum'],
  lost: ['Gilded Approach', 'Bridge of Ghosts', 'Ash Courtyard', 'Citadel Steps', 'Sun Throne', 'Fallen Plaza', 'The Last Gate'],
};

const RELIC_TYPES = { 'Serpent Mask': 0, 'Jade Jaguar': 4, 'Crystal Skull': 2, 'River Chalice': 3, 'Rootbound Crown': 1, 'Jaguar Idol': 4, 'Whispering Mask': 0, 'Solar Disc': 1, 'Feathered Serpent': 0, 'Maya Heart': 1, 'Bone Chalice': 3, 'Choir Bell': 1, 'Drowned Crown': 1, 'Obsidian Skull': 2, 'Sanctum Key': 4, 'Gilded Serpent': 0, 'Ghost Fan': 1, 'Ash Scepter': 4, 'Sun Crown': 1, 'Sun Disc': 1 };

const M = {};
function materials(theme, renderer) {
  if (!M[theme]) M[theme] = makeMaterialSet(theme, renderer);
  return M[theme];
}

function mesh(geo, material, parent, x = 0, y = 0, z = 0, cast = true, receive = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m);
  return m;
}

function boxMesh(w, h, d, material, parent, x, y, z, cast = true) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z, cast, true);
}

function cylinder(rt, rb, h, seg, material, parent, x, y, z, cast = true) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material, parent, x, y, z, cast, true);
}

const THEME = {
  jungle: {
    fog: 0x2f3d27, fogDensity: 0.012, skyTop: 0x8d9b63, skyBottom: 0xd6b66d, sun: 0xffd89c, sunIntensity: 2.3,
    ambient: 0x8ea078, ambientIntensity: 1.25, hemiGround: 0x2e321d, sunPos: [-40, 55, 28], wallH: 3.4,
  },
  temple: {
    fog: 0x4d3822, fogDensity: 0.0135, skyTop: 0x473521, skyBottom: 0xd08e4c, sun: 0xffb866, sunIntensity: 2.0,
    ambient: 0x9a7550, ambientIntensity: 1.05, hemiGround: 0x2f2011, sunPos: [-58, 62, 22], wallH: 6.3,
  },
  catacomb: {
    fog: 0x10171a, fogDensity: 0.024, skyTop: 0x080d0e, skyBottom: 0x131b19, sun: 0x7ca49c, sunIntensity: .35,
    ambient: 0x32423f, ambientIntensity: .75, hemiGround: 0x050606, sunPos: [0, 30, 20], wallH: 5.7,
  },
  lost: {
    fog: 0x4c2c1a, fogDensity: 0.014, skyTop: 0x2d1721, skyBottom: 0xe68b45, sun: 0xff9e54, sunIntensity: 2.5,
    ambient: 0x8f5c3b, ambientIntensity: 1.0, hemiGround: 0x27120a, sunPos: [-45, 34, 30], wallH: 5.7,
  },
};

function createSky(theme) {
  const geo = new THREE.SphereGeometry(280, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(theme.skyTop) },
      bottom: { value: new THREE.Color(theme.skyBottom) },
      sun: { value: new THREE.Color(theme.sun) },
      sunDir: { value: new THREE.Vector3(-0.72, 0.42, -0.3).normalize() },
    },
    vertexShader: `varying vec3 vWorld; void main(){ vWorld = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 bottom; uniform vec3 sun; uniform vec3 sunDir; varying vec3 vWorld;
      void main(){
        vec3 d = normalize(vWorld);
        float h = clamp(d.y * .72 + .32, 0.0, 1.0);
        vec3 c = mix(bottom, top, smoothstep(0.02, 0.85, h));
        float glow = pow(max(dot(d, sunDir), 0.0), 14.0);
        float core = pow(max(dot(d, sunDir), 0.0), 180.0);
        c += sun * glow * .18 + sun * core * 1.4;
        c *= 0.94 + .06 * sin(d.x * 8.0 + d.z * 5.0);
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  return sky;
}

function makeDustTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,239,195,1)'); g.addColorStop(.28, 'rgba(255,231,175,.72)'); g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const DUST_TEX = makeDustTexture();

function makeParticles(count, range, theme, color = 0xffe0a3, size = .12, opacity = .5) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    const p = {
      x: randRange(Math.random, -range.w, range.w),
      y: randRange(Math.random, .5, range.h),
      z: randRange(Math.random, range.z0, range.z1),
      vx: randRange(Math.random, -.04, .04), vy: randRange(Math.random, .005, .05), vz: randRange(Math.random, -.025, .025),
      phase: Math.random() * 10,
    };
    data.push(p);
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: DUST_TEX, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return { points: pts, data, geo, range };
}

function updateParticles(particles, dt, time) {
  const arr = particles.geo.attributes.position.array;
  for (let i = 0; i < particles.data.length; i++) {
    const p = particles.data[i];
    p.x += (p.vx + Math.sin(time * .4 + p.phase) * .01) * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    if (p.y > particles.range.h) p.y = .4;
    if (p.x < -particles.range.w) p.x = particles.range.w;
    if (p.x > particles.range.w) p.x = -particles.range.w;
    arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z;
  }
  particles.geo.attributes.position.needsUpdate = true;
}

export function getLevelInfo(n) {
  return LEVELS[clamp(n, 1, 20) - 1];
}

export function buildLevel(levelNumber, renderer) {
  const index = clamp(levelNumber, 1, 20);
  const info = LEVELS[index - 1];
  const biomeId = ['jungle', 'temple', 'catacomb', 'lost'][info.biome - 1];
  const theme = THEME[biomeId];
  const mats = materials(biomeId, renderer);
  const rng = mulberry32(9001 + index * 1471);
  const root = new THREE.Group();
  const surfaces = [];
  const colliders = [];
  const breakables = [];
  const secretDoors = [];
  const traps = [];
  const levers = [];
  const idols = [];
  const potions = [];
  const pickups = [];
  const checkpoints = [];
  const hooks = [];
  const plates = [];
  const gates = [];
  const torches = [];
  const particles = [];
  const debris = [];
  const projectiles = [];
  const enemies = [];
  const roomExtras = [];
  let currentZ = 12;
  const levelStart = 12;

  const halfW = 6.1;

  function addSurface(x, z, w, d, top, material, opts = {}) {
    const height = opts.height ?? .7;
    const meshObj = boxMesh(w, height, d, material || mats.floor, root, x, top - height / 2, z, true);
    if (opts.trim !== false) {
      boxMesh(w + .16, .17, .18, mats.trim, root, x, top - .08, z - d / 2, true);
      boxMesh(w + .16, .17, .18, mats.trim, root, x, top - .08, z + d / 2, true);
    }
    const surface = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, top, mesh: meshObj, active: true, ...opts };
    surfaces.push(surface);
    return surface;
  }

  function addCollider(x, z, w, h, d, opts = {}) {
    const y0 = opts.y0 ?? 0;
    const c = { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, minY: y0, maxY: y0 + h, active: true, ...opts };
    colliders.push(c);
    return c;
  }

  function wallSide(side, zNear, zFar, openCenter = null, openSize = 3.7) {
    const h = theme.wallH;
    const x = side * 6.58;
    const segments = [];
    if (openCenter !== null) {
      const a0 = zNear, a1 = openCenter + openSize / 2;
      const b0 = openCenter - openSize / 2, b1 = zFar;
      if (a0 - a1 > .2) segments.push([a1, a0]);
      if (b0 - b1 > .2) segments.push([b1, b0]);
    } else {
      segments.push([zFar, zNear]);
    }
    for (const [za, zb] of segments) {
      const d = Math.abs(za - zb);
      if (d < .1) continue;
      const z = (za + zb) / 2;
      boxMesh(.78, h, d, mats.wall, root, x, h / 2, z, true);
      // top trim and base
      boxMesh(.94, .24, d, mats.trim, root, x, h - .1, z, true);
      boxMesh(.94, .2, d, mats.trim, root, x, .1, z, true);
      addCollider(x, z, .82, h, d);
      // wall reliefs
      if (h > 4 && d > 4) {
        const count = Math.max(1, Math.floor(d / 5));
        for (let i = 0; i < count; i++) {
          const relief = mesh(new THREE.PlaneGeometry(2.2, 2.7), mats.glyph, root, side * 6.16, 2.5, z - d / 2 + (i + .5) * (d / count), false, false);
          relief.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        }
      }
      // moss strip for jungle
      if (biomeId === 'jungle') {
        boxMesh(.84, .3, d * .9, mats.moss, root, x - side * .02, h - .35, z, false);
      }
    }
    return segments;
  }

  function addRoomWalls(room) {
    wallSide(-1, room.zNear, room.zFar, room.secret?.side === -1 ? room.secret.z : null, room.secret?.side === -1 ? 3.8 : 3.7);
    wallSide(1, room.zNear, room.zFar, room.secret?.side === 1 ? room.secret.z : null, room.secret?.side === 1 ? 3.8 : 3.7);
  }

  function addArch(z, h = theme.wallH) {
    const mat = mats.trim;
    for (const s of [-1, 1]) {
      boxMesh(.85, h, .85, mat, root, s * 6.05, h / 2, z, true);
      boxMesh(1.15, .35, 1.15, mat, root, s * 6.05, h - .15, z, true);
    }
    boxMesh(12.8, .58, .8, mat, root, 0, h - .25, z, true);
    // carved keystone
    const key = boxMesh(.9, .95, .5, mats.bronze, root, 0, h - .55, z + .23, true);
    key.rotation.z = Math.PI / 4;
  }

  function addColumn(x, z, h, style = biomeId) {
    const mat = style === 'lost' ? mats.darkStone : mats.stoneProp;
    const trim = style === 'lost' ? mats.gold : mats.trim;
    if (style === 'temple') {
      boxMesh(.82, h, .82, mat, root, x, h / 2, z, true);
      boxMesh(1.12, .3, 1.12, trim, root, x, h - .12, z, true);
      boxMesh(1.04, .22, 1.04, trim, root, x, .11, z, true);
      for (let i = 1; i < 4; i++) boxMesh(.88, .09, .88, trim, root, x, h * i / 4, z, true);
    } else if (style === 'catacomb') {
      cylinder(.32, .39, h, 9, mat, root, x, h / 2, z, true);
      boxMesh(1.0, .26, 1.0, trim, root, x, h - .12, z, true);
      boxMesh(.9, .22, .9, trim, root, x, .11, z, true);
    } else if (style === 'lost') {
      boxMesh(.92, h, .92, mat, root, x, h / 2, z, true);
      boxMesh(1.18, .19, 1.18, trim, root, x, h - .4, z, true);
      boxMesh(1.25, .3, 1.25, trim, root, x, .14, z, true);
      for (const s of [-1, 1]) boxMesh(.11, h * .72, .11, trim, root, x + s * .42, h * .42, z, true);
    } else {
      cylinder(.36, .48, h, 7, mat, root, x, h / 2, z, true);
      boxMesh(.95, .25, .95, trim, root, x, .12, z, true);
      boxMesh(.86, .2, .86, mats.moss, root, x, h - .16, z, true);
    }
  }

  function addTorch(x, y, z, color) {
    const lightColor = color || (biomeId === 'catacomb' ? 0x6cffba : biomeId === 'lost' ? 0xff9b44 : 0xffa04a);
    const torch = createTorch(mats.flame);
    torch.group.position.set(x, y, z);
    torch.group.scale.setScalar(biomeId === 'catacomb' ? .9 : 1);
    root.add(torch.group);
    const light = new THREE.PointLight(lightColor, biomeId === 'catacomb' ? 5 : 4, 10, 2);
    light.position.set(x, y + .8, z);
    root.add(light);
    torches.push({ group: torch.group, flame: torch.flame, light, phase: rng() * 10, baseIntensity: biomeId === 'catacomb' ? 5 : 4 });
    return torch;
  }

  function addBanner(side, z, w = 2.2, h = 3.8) {
    const banner = mesh(new THREE.PlaneGeometry(w, h, 1, 4), mats.cloth, root, side * 6.15, 4.1, z, false, false);
    banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    banner.material = mats.cloth;
    const pole = cylinder(.05, .05, w + .3, 5, mats.bronze, root, side * 6.2, 4.1 + h / 2, z, true);
    pole.rotation.x = Math.PI / 2;
    return banner;
  }

  function addVines(x, z, top, length, count = 5) {
    for (let i = 0; i < count; i++) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x + randRange(rng, -.8, .8), top, z + randRange(rng, -.5, .5)),
        new THREE.Vector3(x + randRange(rng, -.2, .2), top - length * .45, z + randRange(rng, -.7, .7)),
        new THREE.Vector3(x + randRange(rng, -.5, .5), top - length, z + randRange(rng, -.6, .6)),
      ]);
      const tube = mesh(new THREE.TubeGeometry(curve, 7, .025 + rng() * .02, 4, false), mats.moss, root, 0, 0, 0, false, false);
      if (rng() > .35) {
        for (let j = 0; j < 4; j++) {
          const leaf = mesh(new THREE.SphereGeometry(.16, 5, 3), mats.leaf, root, 0, 0, 0, false, false);
          dashLeaf(leaf, curve, .2 + j * .18, rng);
        }
      }
    }
  }
  function dashLeaf(leaf, curve, t, rng) {
    const p = curve.getPoint(t);
    leaf.position.copy(p);
    leaf.position.x += randRange(rng, -.2, .2);
    leaf.position.z += randRange(rng, -.2, .2);
    leaf.scale.set(2.4, .2, .8);
    leaf.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  }

  function addStatue(x, z, side) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; root.add(g);
    const s = biomeId === 'lost' ? mats.gold : mats.stoneProp;
    boxMesh(.9, 1.6, .8, s, g, 0, .8, 0, true);
    boxMesh(.68, .52, .55, s, g, 0, 1.85, 0, true);
    const head = mesh(new THREE.DodecahedronGeometry(.4, 0), s, g, 0, 2.32, .04, true);
    boxMesh(.5, .16, .5, s, g, 0, 2.52, 0, true);
    boxMesh(.34, .12, .12, mats.gold, g, 0, 2.57, .22, true);
    boxMesh(.18, .08, .05, mats.glowGreen, g, -.12, 2.35, .35, false);
    boxMesh(.18, .08, .05, mats.glowGreen, g, .12, 2.35, .35, false);
    for (const s2 of [-1, 1]) {
      boxMesh(.22, 1.1, .26, s, g, s2 * .52, 1.1, .1, true);
      boxMesh(.2, .35, .45, s, g, s2 * .52, .42, .1, true);
    }
  }

  function addTree(x, z, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); root.add(g);
    const trunk = cylinder(.24, .58, 7.2, 7, mats.bark, g, 0, 3.6, 0, false);
    trunk.rotation.z = randRange(rng, -.05, .05);
    for (let i = 0; i < 4; i++) {
      const branch = cylinder(.04, .16, 2.2, 5, mats.bark, g, randRange(rng, -1.2, 1.2), 5.2 + i * .5, randRange(rng, -.8, .8), false);
      branch.rotation.z = randRange(rng, -.9, .9); branch.rotation.x = randRange(rng, -.5, .5);
    }
    for (let i = 0; i < 5; i++) {
      const leaf = mesh(new THREE.DodecahedronGeometry(1.5 + rng() * .9, 0), i % 2 ? mats.leaf : mats.leafLight, g, randRange(rng, -2.1, 2.1), 7 + rng() * 2.6, randRange(rng, -2.1, 2.1), false, false);
      leaf.scale.y = .65;
    }
  }

  function addRock(x, z, scale = 1) {
    const rock = mesh(new THREE.DodecahedronGeometry(randRange(rng, .7, 1.4), 0), mats.stoneProp, root, x, randRange(rng, .1, .5), z, true, true);
    rock.scale.set(scale, scale * randRange(rng, .6, 1.1), scale);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
  }

  function addPot(x, z) {
    const pot = mesh(new THREE.SphereGeometry(.32, 8, 6), biomeId === 'lost' ? mats.gold : mats.stoneProp, root, x, .32, z, true);
    pot.scale.set(1, 1.25, 1);
    cylinder(.13, .18, .18, 7, mats.trim, root, x, .6, z, true);
    if (biomeId === 'temple') pot.material = mats.bronze;
  }

  function addCrates(x, z) {
    for (let i = 0; i < 3; i++) {
      const c = boxMesh(.8, .7, .8, mats.wood, root, x + randRange(rng, -.5, .5), .35 + (i === 2 ? .7 : 0), z + randRange(rng, -.5, .5), true);
      c.rotation.y = rng() * .4;
    }
  }

  function addCeiling(zNear, zFar) {
    const d = Math.abs(zNear - zFar);
    boxMesh(13.2, .6, d, mats.wall, root, 0, theme.wallH, (zNear + zFar) / 2, true);
    for (let z = zFar + 1.5; z < zNear; z += 4.2) {
      boxMesh(13.4, .42, .6, mats.trim, root, 0, theme.wallH - .22, z, true);
    }
  }

  function addRoomDressing(room, roomIndex) {
    const len = room.zNear - room.zFar;
    const count = Math.max(1, Math.round(len / 7));
    for (let i = 0; i < count; i++) {
      const z = room.zNear - 3.2 - i * (len - 5) / Math.max(1, count - 1 || 1);
      if (i % 2 === 0) addColumn(-5.56, z, theme.wallH * .78, biomeId);
      if (biomeId !== 'jungle') addColumn(5.56, z + 1.8, theme.wallH * .72, biomeId);
      if (biomeId === 'jungle') addTree(randRange(rng, 8.2, 15), z + randRange(rng, -2, 2), randRange(rng, .8, 1.3));
    }
    if (biomeId === 'jungle') {
      for (let i = 0; i < 3; i++) addTree(randRange(rng, -20, -9), randRange(rng, room.zFar, room.zNear), randRange(rng, .9, 1.6));
      addVines(-6.0, room.zNear - 2, 8.5, randRange(rng, 3, 6), 4);
      addVines(6.0, room.zNear - 6, 8.5, randRange(rng, 3, 6), 4);
      for (let i = 0; i < 5; i++) addRock(randRange(rng, -5.4, 5.4), randRange(rng, room.zFar + 1, room.zNear - 1), randRange(rng, .4, .9));
      for (let i = 0; i < 2; i++) addPot(randRange(rng, -4, 4), randRange(rng, room.zFar + 2, room.zNear - 2));
      addTorch(-5.95, 2.2, room.zNear - 1.3);
    } else if (biomeId === 'temple') {
      addArch(room.zNear - .8);
      if (len > 16) addArch(room.zNear - len * .55);
      addBanner(-1, room.zNear - 4.2); addBanner(1, room.zFar + 4.5);
      addStatue(-4.8, room.zFar + 2.6, -1); addStatue(4.8, room.zFar + 2.6, 1);
      for (let i = 0; i < 2; i++) addPot(randRange(rng, -4, 4), randRange(rng, room.zFar + 1.5, room.zNear - 1.5));
      addCrates(4.2, room.zNear - 3);
      if (roomIndex % 2) addTorch(5.95, 2.6, room.zNear - 2.4);
      else addTorch(-5.95, 2.6, room.zFar + 2.2);
    } else if (biomeId === 'catacomb') {
      addArch(room.zNear - .8, 5.6);
      for (let i = 0; i < 4; i++) {
        const z = room.zFar + 2 + i * (len - 4) / 4;
        const skull = mesh(new THREE.SphereGeometry(.24, 8, 6), mats.bone, root, (i % 2 ? 1 : -1) * 5.55, randRange(rng, 1.4, 3.3), z, true);
        skull.scale.set(1, 1.1, .95);
        boxMesh(.22, .18, .16, mats.bone, root, skull.position.x, skull.position.y - .16, z + .08, true);
        boxMesh(.06, .05, .03, mats.glowGreen, root, skull.position.x - .08, skull.position.y + .03, z + .2, false);
        boxMesh(.06, .05, .03, mats.glowGreen, root, skull.position.x + .08, skull.position.y + .03, z + .2, false);
      }
      for (let i = 0; i < 3; i++) {
        const candle = cylinder(.055, .07, .2, 6, mats.bone, root, randRange(rng, -4.8, 4.8), .1, randRange(rng, room.zFar + 2, room.zNear - 2), true);
        const flame = mesh(new THREE.ConeGeometry(.035, .12, 5), mats.flame, root, candle.position.x, .26, candle.position.z, false);
      }
      addBanner(-1, room.zNear - 5, 2.0, 3.2);
      addTorch(-5.95, 2.5, room.zFar + 2.6, 0x68ffb3);
    } else {
      addArch(room.zNear - .8);
      addBanner(-1, room.zNear - 4.5, 2.4, 4.2);
      addBanner(1, room.zFar + 4.5, 2.4, 4.2);
      for (let i = 0; i < 2; i++) {
        const obelisk = boxMesh(.9, 5.2, .9, mats.darkStone, root, (i ? 1 : -1) * 5.34, 2.6, room.zNear - 3 - rng() * (len - 6), true);
        boxMesh(1.06, .24, 1.06, mats.gold, root, obelisk.position.x, 4.2, obelisk.position.z, true);
        boxMesh(.7, .3, .7, mats.gold, root, obelisk.position.x, 5.25, obelisk.position.z, true);
      }
      for (let i = 0; i < 3; i++) addPot(randRange(rng, -4.2, 4.2), randRange(rng, room.zFar + 1.5, room.zNear - 1.5));
      addTorch(5.95, 2.5, room.zNear - 2.2, 0xff8a3d);
    }
  }

  function addSecret(room, side, type, idx, zOverride = null) {
    const z = zOverride ?? room.z;
    const xWall = side * 6.58;
    const farX = side * 13.1;
    // secret floor, slightly raised
    addSurface(side * 9.6, z, 6.4, 8.6, .06, mats.floor, { trim: false });
    // far wall + side walls
    boxMesh(.7, 4.2, 8.6, mats.wall, root, farX, 2.1, z, true);
    addCollider(farX, z, .78, 4.2, 8.6);
    for (const zz of [z - 4.3, z + 4.3]) {
      boxMesh(6.6, 4.2, .7, mats.wall, root, side * 9.7, 2.1, zz, true);
      addCollider(side * 9.7, zz, 6.7, 4.2, .78);
      boxMesh(6.8, .2, .95, mats.trim, root, side * 9.7, 4.1, zz, false);
    }
    // ceiling bits
    boxMesh(6.6, .6, 8.6, mats.wall, root, side * 9.6, 4.3, z, true);
    // opening threshold
    boxMesh(.38, 4.0, 4.1, mats.trim, root, side * 6.5, 2.0, z, true);
    // pedestal
    const pedX = side * 10.4;
    cylinder(.48, .62, .85, 12, mats.stoneProp, root, pedX, .485, z, true);
    cylinder(.63, .66, .16, 12, mats.trim, root, pedX, .94, z, true);
    const idol = createIdol();
    idol.position.set(pedX, 1.15, z);
    idol.scale.setScalar(.65);
    root.add(idol);
    idols.push({ mesh: idol, x: pedX, y: 1.25, z, collected: false, secret: idx, baseY: 1.15, phase: rng() * 6 });
    const potion = createPotion();
    potion.position.set(pedX - side * 1.5, .13, z + 2.4);
    root.add(potion);
    potions.push({ mesh: potion, x: potion.position.x, y: .55, z: potion.position.z, collected: false });
    const light = new THREE.PointLight(0xffc85b, 4.2, 8, 2);
    light.position.set(pedX, 2.7, z);
    root.add(light);
    torches.push({ light, baseIntensity: 4.2, phase: rng() * 10, secret: true });
    // detail
    addPot(farX - side * 1.2, z - 3.0);
    addPot(farX - side * 1.5, z + 3.1);
    addVines(farX - side * .4, z + 3.5, 4.2, 2.8, 2);

    if (type === 'break') {
      const wallMat = mats.wall.clone();
      wallMat.color = new THREE.Color(0xbda679);
      const falseWall = boxMesh(.7, 3.5, 3.8, wallMat, root, xWall, 1.75, z, true);
      const crack = mesh(new THREE.PlaneGeometry(2.2, 2.3), mats.glyph, root, side * 6.2, 2.0, z, false, false);
      crack.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      const rune = mesh(new THREE.TorusGeometry(.24, .045, 5, 12), mats.gold, root, side * 6.17, 2.1, z, false, false);
      rune.rotation.y = Math.PI / 2;
      const collider = addCollider(xWall, z, .78, 3.8, 3.9, { secret: true });
      const data = { mesh: falseWall, crack, rune, collider, broken: false, x: xWall, y: 1.8, z, side, secret: idx, health: 1, type: 'wall' };
      breakables.push(data);
      secretDoors.push(data);
    } else {
      // ornate secret door and wall lever
      const door = new THREE.Group(); door.position.set(side * 6.55, 0, z); root.add(door);
      boxMesh(.34, 3.3, 3.5, mats.trim, door, 0, 1.65, 0, true);
      for (let i = -1; i <= 1; i++) boxMesh(.2, 3.0, .24, mats.gold, door, side * .12, 1.6, i * 1.05, true);
      const collider = addCollider(side * 6.58, z, .65, 3.5, 3.6, { secret: true });
      const leverBase = new THREE.Group();
      leverBase.position.set(side * 5.72, 1.7, z + 3.0);
      root.add(leverBase);
      boxMesh(.14, .6, .3, mats.bronze, leverBase, 0, 0, 0, true);
      const handle = new THREE.Group(); handle.position.set(side * -.1, .15, 0); leverBase.add(handle);
      const arm = boxMesh(.07, .56, .07, mats.metal, handle, 0, .24, 0, true);
      arm.rotation.z = side * .35;
      sphereMesh(.1, mats.gold, handle, 0, .51, 0, true);
      const lever = { group: handle, base: leverBase, x: side * 5.72, y: 1.7, z: z + 3.0, active: false, door, collider, secret: idx, type: 'secret' };
      levers.push(lever);
      secretDoors.push(lever);
    }
  }

  function sphereMesh(r, material, parent, x, y, z, cast = true) {
    return mesh(new THREE.SphereGeometry(r, 10, 7), material, parent, x, y, z, cast);
  }

  function addCheckpoint(z) {
    const g = new THREE.Group(); g.position.set(0, 0, z); root.add(g);
    const ring = mesh(new THREE.TorusGeometry(1.2, .1, 6, 24), mats.gold, g, 0, .1, 0, false);
    ring.rotation.x = Math.PI / 2;
    addColumn(-2.1, z, 2.8, biomeId); addColumn(2.1, z, 2.8, biomeId);
    boxMesh(5.2, .3, .5, mats.trim, g, 0, 2.9, 0, true);
    const flame = mesh(new THREE.ConeGeometry(.26, .7, 7), mats.flame, g, -2.1, 3.35, 0, false);
    const flame2 = mesh(new THREE.ConeGeometry(.26, .7, 7), mats.flame, g, 2.1, 3.35, 0, false);
    const light = new THREE.PointLight(0xffb25e, 4, 9, 2); light.position.set(0, 3.4, z); root.add(light);
    torches.push({ light, flame, flame2, baseIntensity: 4, phase: rng() * 10 });
    checkpoints.push({ x: 0, y: 0, z, active: false, mesh: g, light, ring });
  }

  function addHook(x, y, z) {
    const g = new THREE.Group(); g.position.set(x, y, z); root.add(g);
    const ring = mesh(new THREE.TorusGeometry(.48, .075, 8, 20), mats.gold, g, 0, 0, 0, true);
    ring.rotation.x = Math.PI / 2;
    const chain = cylinder(.045, .045, 3.2, 5, mats.bronze, g, 0, 1.75, 0, true);
    for (let i = 0; i < 4; i++) {
      const link = mesh(new THREE.TorusGeometry(.12, .025, 4, 8), mats.bronze, g, 0, 1.1 + i * .38, 0, false);
      link.rotation.x = i % 2 ? 0 : Math.PI / 2;
    }
    const light = new THREE.PointLight(0xffc85a, 1.3, 4, 2); light.position.y = -.2; g.add(light);
    hooks.push({ mesh: g, ring, x, y, z });
  }

  function addSpikeTrap(x, z, w = 4.2, d = 2.6, phase = 0, period = 2.8) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    boxMesh(w, .18, d, mats.darkStone, g, 0, .04, 0, true);
    for (let ix = 0; ix < Math.floor(w / .5); ix++) {
      for (let iz = 0; iz < Math.floor(d / .5); iz++) {
        const cone = mesh(new THREE.ConeGeometry(.075, .58, 4), mats.metal, g, -w / 2 + .28 + ix * .5, .3, -d / 2 + .28 + iz * .5, false);
      }
    }
    const trap = {
      type: 'spikes', x, z, w, d, group: g, active: false, phase, period, timer: 0,
      update(dt, t, player, game) {
        const cycle = (t + this.phase) % this.period;
        this.active = cycle < this.period * .45;
        const targetY = this.active ? .42 : -.7;
        g.position.y += (targetY - g.position.y) * Math.min(1, dt * 14);
        if (this.active && game.playerOnGround && Math.abs(player.pos.z - z) < d / 2 + .2 && Math.abs(player.pos.x - x) < w / 2 && player.pos.y < .8) {
          game.hurtPlayer(1, 'spikes', this);
        }
      },
    };
    traps.push(trap);
  }

  function addDartTrap(x, z, side) {
    const g = new THREE.Group(); g.position.set(side * 6.2, 1.25, z); g.rotation.y = side > 0 ? Math.PI : 0; root.add(g);
    boxMesh(.4, .55, .75, mats.metal, g, 0, 0, 0, true);
    const hole = mesh(new THREE.CircleGeometry(.12, 8), mats.black, g, 0, 0, .38, false);
    const glow = mesh(new THREE.CircleGeometry(.085, 8), mats.ember, g, 0, 0, .39, false);
    const trap = {
      type: 'dart', x, z, side, group: g, glow, cooldown: 1 + rng() * 1.4, warning: 0, active: false,
      update(dt, t, player, game) {
        const dist = player.pos.distanceTo(new THREE.Vector3(this.x, 1.25, this.z));
        if (dist > 22 || Math.abs(player.pos.z - this.z) > 14) return;
        this.cooldown -= dt;
        this.glow.material = this.cooldown < .45 ? mats.ember : mats.glowGreen;
        if (this.cooldown <= 0) {
          this.cooldown = Math.max(1.6, 2.7 - levelNumber * .04);
          const p = new THREE.Vector3(this.x - side * .35, 1.2, this.z);
          const dir = new THREE.Vector3(-side, 0, 0);
          const proj = mesh(new THREE.CylinderGeometry(.035, .035, .45, 5), mats.metal, root, p.x, p.y, p.z, false);
          proj.rotation.z = Math.PI / 2;
          projectiles.push({ mesh: proj, pos: p, dir, life: 1.4, speed: 15 });
          game.audio._noise(.08, .13, 'highpass', 3000, .8);
        }
      },
    };
    traps.push(trap);
  }

  function addSwingBlade(x, z, phase = 0) {
    const pivot = new THREE.Group(); pivot.position.set(x, 5.7, z); root.add(pivot);
    const arm = cylinder(.08, .08, 3.1, 6, mats.bronze, pivot, 0, -1.55, 0, true);
    const blade = mesh(new THREE.CylinderGeometry(1.25, 1.25, .09, 16, 1, false, 0, Math.PI), mats.metal, pivot, 0, -3.15, 0, true);
    blade.rotation.z = Math.PI;
    blade.rotation.x = Math.PI / 2;
    const warning = new THREE.PointLight(0xff5e37, .2, 5, 2); warning.position.set(x, 3, z); root.add(warning);
    const trap = {
      type: 'blade', x, z, pivot, blade, phase, warning, active: true,
      update(dt, t, player, game) {
        const a = Math.sin(t * 1.65 + phase) * 1.08;
        pivot.rotation.z = a;
        const bx = x + Math.sin(a) * 3.0;
        const by = 5.7 - Math.cos(a) * 3.0;
        if (Math.hypot(player.pos.x - bx, player.pos.z - z) < 1.2 && player.pos.y < by + 1.6 && player.pos.y + 1.8 > by - .5) game.hurtPlayer(1, 'blade', this);
      },
    };
    traps.push(trap);
  }

  function addCeilingSpikes(z, w = 5.8, d = 3.4) {
    const g = new THREE.Group(); g.position.set(0, 6.1, z); root.add(g);
    boxMesh(w, .6, d, mats.stoneProp, g, 0, 0, 0, true);
    for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 3; iz++) {
      mesh(new THREE.ConeGeometry(.12, 1.0, 4), mats.metal, g, -w / 2 + .6 + ix * 1.15, -.75, -d / 2 + .58 + iz * 1.1, false).rotation.z = Math.PI;
    }
    const trap = {
      type: 'ceiling', x: 0, z, w, d, group: g, state: 0, timer: 0, active: false,
      update(dt, t, player, game) {
        const inside = Math.abs(player.pos.z - z) < d / 2 + 1.5 && Math.abs(player.pos.x) < w / 2;
        if (inside && this.state === 0) { this.state = 1; this.timer = .65; }
        if (this.state === 1) {
          this.timer -= dt;
          if (this.timer <= 0) this.state = 2;
        } else if (this.state === 2) {
          g.position.y += (2.55 - g.position.y) * Math.min(1, dt * 4);
          this.active = g.position.y < 3.7;
          if (this.active && inside) game.hurtPlayer(1, 'ceiling', this);
          if (g.position.y < 2.68) { this.state = 3; this.timer = .8; }
        } else if (this.state === 3) {
          this.timer -= dt;
          if (this.timer <= 0) { this.state = 4; this.active = false; }
        } else if (this.state === 4) {
          g.position.y += (6.1 - g.position.y) * Math.min(1, dt * 3);
          if (g.position.y > 6.0) this.state = 0;
        }
      },
    };
    traps.push(trap);
  }

  function addPressureGate(room) {
    const gateZ = room.zFar + 6.0;
    const plateZ = gateZ + 4.6;
    const gate = new THREE.Group(); gate.position.set(0, 0, gateZ); root.add(gate);
    boxMesh(13.0, .7, .8, mats.trim, gate, 0, 5.3, 0, true);
    for (const s of [-1, 1]) boxMesh(.8, 6.2, .9, mats.trim, gate, s * 6.0, 3.1, 0, true);
    for (let i = -5; i <= 5; i++) {
      const bar = boxMesh(.16, 5.4, .16, mats.metal, gate, i * .95, 2.7, 0, true);
      if (i % 2 === 0) boxMesh(.36, .18, .3, mats.gold, gate, i * .95, 1.2, 0, true);
    }
    const collider = addCollider(0, gateZ, 12.2, 5.6, .8, { gate: true });
    const plateGroup = new THREE.Group(); plateGroup.position.set(0, 0, plateZ); root.add(plateGroup);
    boxMesh(3.2, .15, 3.2, mats.stoneProp, plateGroup, 0, .08, 0, true);
    const rune = mesh(new THREE.TorusGeometry(.72, .07, 5, 16), mats.glowGreen, plateGroup, 0, .19, 0, false);
    rune.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0x64ffc0, 2.2, 5, 2); light.position.set(0, .7, plateZ); root.add(light);
    const p = { x: 0, z: plateZ, r: 1.8, pressed: false, group: plateGroup, rune, light, gateZ, collider, gate };
    plates.push(p);
    const gateData = { group: gate, collider, open: false, y: 0, plate: p };
    gates.push(gateData);
    p.gateData = gateData;
    return p;
  }

  function addRelicRoom(room) {
    const z = room.zFar + 5.2;
    addSurface(0, z, 11.5, 9.4, .45, mats.floor, { trim: true });
    cylinder(1.1, 1.45, 1.1, 8, mats.stoneProp, root, 0, 1.0, z, true);
    cylinder(1.55, 1.55, .18, 8, mats.trim, root, 0, 1.6, z, true);
    const rc = createRelic(RELIC_TYPES[info.relic] ?? 1);
    rc.scale.setScalar(1.25);
    rc.position.set(0, 2.35, z);
    root.add(rc);
    const glow = new THREE.PointLight(0xffcf6b, 6, 12, 2); glow.position.set(0, 3.4, z); root.add(glow);
    const halo = mesh(new THREE.TorusGeometry(.8, .025, 5, 24), mats.glowGold, root, 0, 2.35, z, false);
    halo.rotation.x = Math.PI / 2;
    const relic = { mesh: rc, halo, light: glow, x: 0, y: 2.35, z, collected: false, baseY: 2.35, locked: !!info.boss };
    // decorative braziers
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 4.1, 0, z); root.add(g);
      cylinder(.38, .5, .85, 8, mats.stoneProp, g, 0, .42, 0, true);
      const flame = mesh(new THREE.ConeGeometry(.34, .9, 7), mats.flame, g, 0, 1.25, 0, false);
      const l = new THREE.PointLight(0xffa64f, 4, 9, 2); l.position.set(s * 4.1, 1.4, z); root.add(l);
      torches.push({ light: l, flame, baseIntensity: 4, phase: rng() * 10 });
    }
    return relic;
  }

  function addBossArena(room) {
    const z = (room.zNear + room.zFar) / 2;
    const depth = room.zNear - room.zFar;
    addSurface(0, z, 23, depth, .05, mats.floor, { trim: false });
    // extended walls for the arena
    for (const s of [-1, 1]) {
      boxMesh(.8, 7.5, depth, mats.wall, root, s * 11.6, 3.75, z, true);
      addCollider(s * 11.6, z, .82, 7.5, depth);
      for (let i = 0; i < 4; i++) {
        const cz = room.zFar + 3 + i * 6;
        addColumn(s * 9.8, cz, 5.4, 'lost');
        addTorch(s * 10.5, 2.8, cz, 0xff7a32);
      }
    }
    addArch(room.zNear - 1.2);
    // giant sun relief behind the guardian
    const sun = mesh(new THREE.CylinderGeometry(3.0, 3.0, .25, 32), mats.gold, root, 0, 5.0, room.zFar + 2.2, true);
    sun.rotation.x = Math.PI / 2;
    for (let i = 0; i < 24; i++) {
      const ray = boxMesh(.2, 1.2, .2, mats.gold, root, Math.cos(i / 24 * Math.PI * 2) * 3.75, 5.0 + Math.sin(i / 24 * Math.PI * 2) * 3.75, room.zFar + 2.3, true);
      ray.rotation.z = -i / 24 * Math.PI * 2;
    }
    // relic dais
    const rz = room.zFar + 5.4;
    addSurface(0, rz, 9.5, 7.4, .45, mats.floor, { trim: true });
    cylinder(1.1, 1.45, 1.1, 8, mats.stoneProp, root, 0, 1.0, rz, true);
    cylinder(1.55, 1.55, .18, 8, mats.trim, root, 0, 1.6, rz, true);
    const rc = createRelic(RELIC_TYPES[info.relic] ?? 1);
    rc.scale.setScalar(1.3);
    rc.position.set(0, 2.35, rz);
    root.add(rc);
    const glow = new THREE.PointLight(0xffcf6b, 6, 12, 2); glow.position.set(0, 3.4, rz); root.add(glow);
    const halo = mesh(new THREE.TorusGeometry(.85, .028, 5, 24), mats.glowGold, root, 0, 2.35, rz, false);
    halo.rotation.x = Math.PI / 2;
    const relic = { mesh: rc, halo, light: glow, x: 0, y: 2.35, z: rz, collected: false, baseY: 2.35, locked: true };
    rc.visible = false; halo.visible = false; glow.visible = false;
    for (const s of [-1, 1]) {
      boxMesh(2.2, .7, 2.2, mats.darkStone, root, s * 5.5, .35, room.zFar + 8, true);
      addTorch(s * 5.5, 1.4, room.zFar + 8, 0xff6a28);
    }
    // boss spawn
    enemies.push({ type: 'boss', x: 0, z: room.zFar + 10.5, y: .05, hp: 56, boss: true });
    return { relic, bossTriggerZ: room.zNear - 8 };
  }

  // --- build rooms ---
  const roomCount = info.boss ? 4 : 7;
  const rooms = [];
  const gapBase = info.diff <= 2 ? 1.9 : info.diff <= 4 ? 2.35 : 2.7;
  let roomZNear = currentZ;
  for (let r = 0; r < roomCount; r++) {
    const startRoom = r === 0;
    const finalNormal = !info.boss && r === roomCount - 1;
    let depth = startRoom ? 18 : finalNormal ? 23 : (info.diff >= 4 ? 21 : 19) + Math.round(rng() * 3);
    if (info.boss) depth = r === 0 ? 17 : 19 + Math.round(rng() * 2);
    const zFar = roomZNear - depth;
    let type = 'normal';
    if (startRoom) type = 'start';
    else if (finalNormal) type = 'final';
    else if (info.boss && r === roomCount - 1) type = 'boss';
    else {
      const pool = info.diff <= 2 ? ['normal', 'combat', 'trap'] : info.diff <= 3 ? ['normal', 'combat', 'trap', 'plate', 'chasm'] : ['combat', 'trap', 'chasm', 'plate', 'collapse'];
      type = pick(rng, pool);
    }
    if (r === 1 && info.diff >= 2) type = 'plate';
    if (r === 2 && info.diff >= 3) type = chance(rng, .55) ? 'chasm' : 'trap';
    const room = { index: r, zNear: roomZNear, zFar, z: (roomZNear + zFar) / 2, depth, type, secret: null };
    rooms.push(room);
    // Plan both hidden vaults before the walls are built so their doorways
    // remain real openings in the collision shell.
    if (r > 0 && r < roomCount - 1 && type !== 'final' && type !== 'boss') {
      const vaultZ = (type === 'chasm' || type === 'collapse') ? room.zNear - 2.3 : room.z;
      if (!rooms.some(x => x.secret?.idx === 0) && (r === (info.boss ? 1 : 2) || r === 3)) {
        room.secret = { side: info.boss ? -1 : 1, z: vaultZ, type: 'break', idx: 0 };
      } else if (!rooms.some(x => x.secret?.idx === 1) && r === (info.boss ? 2 : 4)) {
        room.secret = { side: -1, z: vaultZ, type: 'lever', idx: 1 };
      }
    }
    if (type !== 'boss') addRoomWalls(room);
    addArch(room.zNear - .8);

    if (type === 'chasm') {
      // ledges and stepping stones
      addSurface(0, room.zNear - 2.6, 12.2, 5.2, 0, mats.floor);
      addSurface(0, room.zFar + 2.6, 12.2, 5.2, 0, mats.floor);
      const stoneCount = info.diff >= 4 ? 4 : 3;
      const space = (room.depth - 10) / stoneCount;
      for (let i = 0; i < stoneCount; i++) {
        const sz = room.zNear - 5.2 - space * (i + .5);
        const sx = Math.sin((i + r) * 1.7) * 2.1;
        addSurface(sx, sz, 3.2, 3.0, .08 + Math.sin(i) * .08, mats.stoneProp, { height: 1.4, trim: false });
        cylinder(.35, .75, 2.8, 7, mats.stoneProp, root, sx, -1.4, sz, true);
      }
      // water at the bottom
      const water = mesh(new THREE.PlaneGeometry(24, room.depth + 3), mats.water, root, 0, -2.4, room.z, false, false);
      water.rotation.x = -Math.PI / 2;
      if (rng() > .4) addHook(0, 6.8, room.z);
      if (biomeId === 'jungle') {
        for (let i = 0; i < 4; i++) addVines((i % 2 ? 1 : -1) * 5.9, room.zNear - 2 - i * 3.5, 8, 3 + rng() * 4, 3);
      }
      addRoomDressing(room, r);
    } else if (type === 'collapse') {
      // a floor of unstable tiles
      addSurface(0, room.zNear - 2.2, 12.2, 4.4, 0, mats.floor);
      addSurface(0, room.zFar + 2.2, 12.2, 4.4, 0, mats.floor);
      const rows = 5;
      const zStart = room.zNear - 4.9;
      const zEnd = room.zFar + 4.9;
      const rowDepth = (zStart - zEnd) / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < 3; col++) {
          const sx = -4 + col * 4;
          const sz = zStart - row * rowDepth - rowDepth / 2;
          const tile = addSurface(sx, sz, 3.7, Math.max(2.1, rowDepth - .15), 0, mats.floor, { trim: false, collapse: true });
          tile.fallState = 0; tile.fallTimer = 0; tile.originY = 0; tile.collapseDelay = .4 + rng() * .5; tile.respawn = 3.4;
          tile.row = row; tile.col = col;
        }
      }
      addRoomDressing(room, r);
      if (rng() > .4) addTorch(-5.9, 2.4, room.zNear - 2.2);
    } else {
      addSurface(0, room.z, 12.2, room.depth, 0, mats.floor);
      addRoomDressing(room, r);
    }

    // gates / traps
    if (type === 'plate') {
      const plate = addPressureGate(room);
      if (rng() > .5) addDartTrap(-1, room.zNear - 3.2, -1);
    } else if (type === 'trap') {
      addSpikeTrap(randRange(rng, -2.2, 2.2), room.zNear - 5.6, randRange(rng, 3.5, 5.0), 2.4, rng() * 2);
      if (info.diff >= 3) addDartTrap(1, room.zFar + 4.4, 1);
      if (info.diff >= 4) addSwingBlade(0, room.z - 1.5, rng() * 3);
      if (info.diff >= 3 && rng() > .5) addCeilingSpikes(room.zFar + 7.2);
    } else if (type === 'combat') {
      if (info.diff >= 2) addSpikeTrap(randRange(rng, -2.4, 2.4), room.zFar + 4.2, 3.0, 2.0, rng() * 2);
      if (info.diff >= 4 && rng() > .5) addDartTrap(-1, room.zNear - 4, -1);
    } else if (type === 'chasm') {
      if (info.diff >= 4) addDartTrap(1, room.zFar + 3.2, 1);
    }

    if (room.secret) addSecret(room, room.secret.side, room.secret.type, room.secret.idx, room.secret.z);

    // enemies in rooms (not start / final / chasm stepping zone; but ledges okay)
    if (r > 0 && r < roomCount - 1 || (info.boss && r === 2)) {
      let count = (type === 'combat' ? 2 : 1) + (info.diff >= 4 ? 1 : 0);
      if (info.diff >= 5 && rng() > .4) count++;
      const types = info.biome === 1 ? ['spider', 'spider', 'scorpion', 'spider'] : info.biome === 2 ? ['raider', 'scorpion', 'raider', 'spider'] : info.biome === 3 ? ['skeleton', 'skeleton', 'raider', 'scorpion'] : ['elite', 'skeleton', 'raider', 'elite'];
      for (let i = 0; i < count; i++) {
        if (type === 'chasm' && i > 0) continue;
        const x = type === 'chasm' ? 0 : randRange(rng, -3.6, 3.6);
        const z = type === 'chasm' ? room.zNear - 2.6 : randRange(rng, room.zFar + 3, room.zNear - 4);
        const t = r === 0 ? 'spider' : pick(rng, types);
        enemies.push({ type: t, x, z, y: 0, hp: t === 'elite' ? 5 + Math.floor(index / 5) : t === 'skeleton' ? 2 : 1, elite: t === 'elite' });
      }
    }

    // path potion and ammo
    if (r === 2 || r === 4) {
      const p = createPotion();
      p.position.set(randRange(rng, -4, 4), .08, room.z + randRange(rng, -2, 2));
      root.add(p);
      potions.push({ mesh: p, x: p.position.x, y: .5, z: p.position.z, collected: false });
    }
    if (r === 3 || r === 5) {
      const ammo = new THREE.Group();
      ammo.position.set(randRange(rng, -4, 4), .4, room.z + 2);
      boxMesh(.5, .32, .36, mats.weathered || mats.wood, ammo, 0, 0, 0, true);
      for (let i = 0; i < 3; i++) cylinder(.035, .035, .18, 5, mats.metal, ammo, -.12 + i * .12, .18, 0, true);
      root.add(ammo);
      pickups.push({ mesh: ammo, x: ammo.position.x, y: .6, z: ammo.position.z, collected: false, type: 'ammo' });
    }

    if (r === 2) addCheckpoint(room.zNear - 2.5);

    roomZNear = zFar - gapBase;
  }

  // end room / boss arena
  if (info.boss) {
    const arenaRoom = rooms[rooms.length - 1];
    arenaRoom.type = 'boss';
    const bossPart = addBossArena({ zNear: arenaRoom.zNear + 3, zFar: arenaRoom.zFar - 1 });
    roomExtras.push(bossPart);
    // final room architecture
    for (const s of [-1, 1]) { addStatue(s * 9.6, arenaRoom.zFar + 6, s); addTorch(s * 10.2, 2.8, arenaRoom.zNear - 3); }
    addDartTrap(-1, arenaRoom.zFar + 12, -1);
    if (biomeId === 'lost') {
      for (let i = 0; i < 3; i++) addVines((i % 2 ? 1 : -1) * 11.2, arenaRoom.zNear - 3 - i * 3, 7.5, 2.5, 2);
    }
  } else {
    const finalRoom = rooms[rooms.length - 1];
    const relic = addRelicRoom(finalRoom);
    // final decorations
    addStatue(-4.6, finalRoom.zFar + 2.2, -1);
    addStatue(4.6, finalRoom.zFar + 2.2, 1);
    addArch(finalRoom.zFar + 1);
    roomExtras.push({ relic, bossTriggerZ: null });
  }

  // hooks above gaps and some rooms
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    const gapCenter = (a.zFar + b.zNear) / 2;
    if (info.diff >= 2 && (i % 2 === 0 || info.diff >= 4)) addHook(0, 6.6, gapCenter);
  }
  for (let i = 2; i < rooms.length; i += 3) addHook(0, 6.4, rooms[i].z + 1.5);

  // mid checkpoint if not already (r=2 handled)
  // environment beyond path
  if (biomeId === 'jungle') {
    addSurface(0, 12 - (rooms[rooms.length - 1].zFar - 30) / 2, 80, 60, -3.4, mats.moss, { trim: false, height: 2 });
    for (let i = 0; i < 32; i++) addTree(randRange(rng, -30, 30), randRange(rng, rooms[rooms.length - 1].zFar - 35, 30), randRange(rng, .7, 1.8));
    const water = mesh(new THREE.PlaneGeometry(160, 220), mats.water, root, 0, -2.6, -50, false, false);
    water.rotation.x = -Math.PI / 2;
  } else if (biomeId === 'temple' || biomeId === 'lost') {
    // distant ziggurats
    for (let i = 0; i < 3; i++) {
      const px = (i - 1) * 42 + randRange(rng, -7, 7);
      const pz = rooms[rooms.length - 1].zFar - 35 - i * 15;
      const g = new THREE.Group(); g.position.set(px, 0, pz); root.add(g);
      for (let s = 0; s < 5; s++) boxMesh(38 - s * 6, 5, 30 - s * 5, mats.stoneProp, g, 0, 2.5 + s * 4.7, 0, false);
      const cap = boxMesh(6, 4, 6, mats.darkStone, g, 0, 27, 0, false);
      const fl = new THREE.PointLight(0xffb15a, 3, 20, 2); fl.position.set(px, 26, pz); root.add(fl);
    }
    for (let i = 0; i < 12; i++) addRock(randRange(rng, -50, 50), randRange(rng, rooms[rooms.length - 1].zFar - 30, 20), randRange(rng, 1, 3));
  } else {
    // catacomb burial niches beyond walls
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : -1;
      const z = 8 - i * 13;
      boxMesh(2.2, 3.2, 4.5, mats.wallDark, root, side * 10.5, 1.6, z, false);
      for (let j = 0; j < 3; j++) {
        const skull = mesh(new THREE.SphereGeometry(.3, 7, 5), mats.bone, root, side * 9.3, .8 + j * .9, z, true);
      }
      const light = new THREE.PointLight(0x45ffaa, 1.2, 6, 2); light.position.set(side * 9, 2, z); root.add(light);
    }
  }

  // sky dome and lighting
  const sky = createSky(theme); root.add(sky);
  const hemi = new THREE.HemisphereLight(theme.skyTop, theme.hemiGround, theme.ambientIntensity * .72);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(theme.sun, theme.sunIntensity);
  sun.position.set(...theme.sunPos).add(new THREE.Vector3(0, 20, -10));
  sun.target.position.set(0, 0, -25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 110;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = .04;
  sun.shadow.camera.updateProjectionMatrix();
  sun.target = sun.target;
  root.add(sun); root.add(sun.target);
  const fill = new THREE.PointLight(biomeId === 'catacomb' ? 0x287b68 : 0xffc88a, biomeId === 'catacomb' ? 1.8 : 1.0, 18, 2);
  fill.position.set(0, 4, 3); root.add(fill);

  // particles
  const range = { w: 10, h: 8, z0: rooms[rooms.length - 1].zFar - 5, z1: 12 };
  const dust = makeParticles(biomeId === 'catacomb' ? 220 : 330, range, biomeId, biomeId === 'catacomb' ? 0x8fffd0 : 0xffe2a6, biomeId === 'catacomb' ? .055 : .085, biomeId === 'catacomb' ? .32 : .5);
  root.add(dust.points); particles.push(dust);
  if (biomeId === 'jungle' || biomeId === 'lost') {
    const flies = makeParticles(70, range, biomeId, biomeId === 'lost' ? 0xffa35b : 0xc8ff80, .12, .8);
    root.add(flies.points); particles.push(flies);
  }
  if (biomeId === 'lost' || biomeId === 'temple') {
    // light shafts
    for (let i = 0; i < 5; i++) {
      const z = 3 - i * 27;
      const shaftMat = new THREE.MeshBasicMaterial({ color: biomeId === 'lost' ? 0xff9b52 : 0xffcb83, transparent: true, opacity: .035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const shaft = mesh(new THREE.ConeGeometry(3.8, 18, 12, 1, true), shaftMat, root, (i % 2 ? 1 : -1) * 2.8, 8, z, false, false);
      shaft.rotation.z = .18 * (i % 2 ? 1 : -1);
    }
  }

  // colliders for unavoidable side? invisible bound at ends to prevent running off back
  addCollider(0, levelStart + 1.2, 13, 6, 1, { invisible: true });
  addCollider(0, rooms[rooms.length - 1].zFar - 2.5, 14, 6, 1, { invisible: true });

  const relicPart = roomExtras[roomExtras.length - 1]?.relic;
  const bossTriggerZ = roomExtras[roomExtras.length - 1]?.bossTriggerZ;
  const length = levelStart - rooms[rooms.length - 1].zFar;

  const level = {
    index, info, biomeId, theme, root, surfaces, colliders, breakables, secretDoors, traps, levers, idols, potions, pickups,
    checkpoints, hooks, plates, gates, torches, particles, debris, projectiles, enemies, rooms, sun, hemi, sky, relic: relicPart,
    bossTriggerZ, length, startPos: new THREE.Vector3(0, .02, 7.6), checkpointZ: checkpoints[0]?.z ?? null,
    roomNames: ROOM_NAMES[biomeId],
    secretCount: secretDoors.length,
    update(dt, t, game) {
      level.t = t;
      for (const torch of torches) {
        if (torch.flame) {
          torch.flame.scale.set(1 + Math.sin(t * 9 + torch.phase) * .13, 1 + Math.sin(t * 13 + torch.phase) * .2, 1);
          torch.flame.rotation.z = Math.sin(t * 5 + torch.phase) * .12;
        }
        if (torch.flame2) torch.flame2.scale.y = 1 + Math.sin(t * 11 + torch.phase) * .18;
        if (torch.light) torch.light.intensity = torch.baseIntensity * (.84 + Math.sin(t * 11 + torch.phase) * .08 + Math.sin(t * 24 + torch.phase * 2) * .05);
      }
      for (const trap of traps) trap.update?.(dt, t, game.player, game);
      for (const p of projectiles) {
        p.pos.addScaledVector(p.dir, p.speed * dt);
        p.mesh.position.copy(p.pos);
        p.life -= dt;
        const d = Math.hypot(p.pos.x - game.player.pos.x, p.pos.z - game.player.pos.z);
        if (d < .65 && Math.abs(p.pos.y - (game.player.pos.y + (game.player.crouching ? .5 : .95))) < .8) {
          game.hurtPlayer(1, 'dart', p); p.life = 0;
        }
        if (p.life <= 0) { root.remove(p.mesh); p.mesh.geometry.dispose(); }
      }
      for (let i = projectiles.length - 1; i >= 0; i--) if (projectiles[i].life <= 0) projectiles.splice(i, 1);
      // falling floors
      for (const s of surfaces) {
        if (!s.collapse) continue;
        if (!s.active) {
          s.respawn -= dt;
          if (s.respawn <= 0) {
            s.active = true; s.fallState = 0; s.mesh.visible = true; s.mesh.position.y = -.35; s.fallTimer = 0;
          }
          continue;
        }
        const over = Math.abs(game.player.pos.x - (s.minX + s.maxX) / 2) < (s.maxX - s.minX) / 2 + .3 && Math.abs(game.player.pos.z - (s.minZ + s.maxZ) / 2) < (s.maxZ - s.minZ) / 2 + .3 && Math.abs(game.player.pos.y - s.top) < .35 && game.player.grounded;
        if (over && s.fallState === 0) { s.fallState = 1; s.fallTimer = s.collapseDelay; }
        if (s.fallState === 1) {
          s.fallTimer -= dt;
          s.mesh.position.x = (s.minX + s.maxX) / 2 + Math.sin(t * 80) * .035;
          if (s.fallTimer <= 0) { s.fallState = 2; s.active = false; s.mesh.visible = false; s.respawn = 3.2; }
        }
      }
      // pressure plates
      for (const p of plates) {
        if (!p.pressed) {
          const over = Math.hypot(game.player.pos.x - p.x, game.player.pos.z - p.z) < p.r && Math.abs(game.player.pos.y) < .7;
          if (over) {
            p.pressed = true;
            p.rune.material = mats.gold;
            p.light.color.setHex(0xffc25a);
            p.light.intensity = 4;
            p.gateData.open = true;
            p.gateData.collider.active = false;
            game.notify('THE SUN GATE OPENS', 'gold');
            game.audio.gate();
            game.shakeCamera(.35);
          }
        }
        if (p.gateData.open) {
          p.gate.position.y += (5.7 - p.gate.position.y) * Math.min(1, dt * 2.8);
        }
      }
      // secret levers open animation
      for (const l of levers) {
        if (l.active) {
          l.door.position.y += (4.5 - l.door.position.y) * Math.min(1, dt * 2.4);
        }
      }
      // break debris
      for (const d of debris) {
        d.vel.y -= 14 * dt;
        d.mesh.position.addScaledVector(d.vel, dt);
        d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt;
        d.life -= dt;
        if (d.life <= 0) d.mesh.visible = false;
      }
      // floating idols
      for (const idol of idols) {
        if (!idol.collected) {
          idol.mesh.position.y = idol.baseY + Math.sin(t * 1.8 + idol.phase) * .08;
          idol.mesh.rotation.y = t * 1.2 + idol.phase;
        }
      }
      if (level.relic && !level.relic.collected) {
        level.relic.mesh.rotation.y = t * .65;
        level.relic.mesh.position.y = level.relic.baseY + Math.sin(t * 1.25) * .1;
        level.relic.halo.rotation.z = t * .8;
        level.relic.halo.material.emissiveIntensity = 2.2 + Math.sin(t * 2.4) * .4;
        if (!level.relic.mesh.visible && !level.relic.locked) {
          level.relic.mesh.visible = true; level.relic.halo.visible = true; level.relic.light.visible = true;
        }
      }
      if (level.bossTriggerZ && game.boss && !game.boss.awake && game.player.pos.z < level.bossTriggerZ) {
        game.wakeBoss();
      }
      for (const hook of hooks) {
        hook.ring.rotation.z = t * .3;
        hook.mesh.position.y = hook.y + Math.sin(t * 1.3 + hook.z) * .05;
      }
      for (const particle of particles) updateParticles(particle, dt, t);
      // checkpoint ring rotation
      for (const c of checkpoints) {
        c.ring.rotation.z = t * .4;
        c.light.intensity = (c.active ? 5.5 : 3.2) * (1 + Math.sin(t * 6) * .08);
      }
      // keep sun shadow around player
      if (sun) {
        sun.position.set(game.player.pos.x + theme.sunPos[0] * .45, 34, game.player.pos.z + 21);
        sun.target.position.set(game.player.pos.x, 0, game.player.pos.z - 8);
        sun.target.updateMatrixWorld();
      }
      // animate enemies is in game
    },
    breakWall(data) {
      if (data.broken) return false;
      data.broken = true;
      data.mesh.visible = false; data.crack.visible = false; data.rune.visible = false;
      data.collider.active = false;
      const p = data.mesh.position;
      for (let i = 0; i < 12; i++) {
        const geo = new THREE.DodecahedronGeometry(randRange(rng, .12, .38), 0);
        const d = mesh(geo, mats.wall, root, p.x + randRange(rng, -.5, .5), randRange(rng, .4, 3.2), p.z + randRange(rng, -1.7, 1.7), true);
        debris.push({ mesh: d, vel: new THREE.Vector3(randRange(rng, -3, 3), randRange(rng, 1, 5), randRange(rng, -3, 3)), spin: new THREE.Vector3(rng() * 8, rng() * 8, rng() * 8), life: 2.2 });
      }
      return true;
    },
    pullLever(l) {
      if (l.type !== 'secret' || l.active) return false;
      l.active = true;
      l.collider.active = false;
      l.group.rotation.z = -l.group.rotation.z * 1.9;
      return true;
    },
    removeProjectile(p) { p.life = 0; },
  };

  // bosses relic references need align
  if (info.boss) {
    const bp = roomExtras[0];
    level.relic = bp.relic;
    level.bossTriggerZ = bp.bossTriggerZ;
  }

  level.root.updateMatrixWorld(true);
  return level;
}
