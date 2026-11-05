import * as THREE from 'three';

const std = (color, roughness = .8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const mat = {
  skin: std(0xb97c58, .72),
  skinDark: std(0x8f5637, .8),
  shirt: std(0xbba67b, .92),
  jacket: std(0x5b3b22, .78),
  jacketDark: std(0x3d2817, .85),
  pants: std(0x6a5a42, .9),
  boot: std(0x2f2117, .78),
  leather: std(0x382619, .64),
  hat: std(0x5a3c24, .82),
  hatBand: std(0x24170e, .9),
  hair: std(0x3c281a, .9),
  metal: std(0x947437, .3, .72),
  gun: std(0x2b2c2b, .3, .8),
  eye: std(0x17110c, .5),
  spider: std(0x2b2119, .85),
  spiderLight: std(0x8c6b35, .7),
  scorpion: std(0x5c3a1f, .7),
  bandage: std(0xc4b68f, .95),
  raider: std(0x6c5134, .9),
  raiderCloth: std(0x8f2c1f, .9),
  bone: std(0xc8bb95, .88),
  stone: std(0x454138, .97),
  stoneLight: std(0x6b604b, .95),
  gold: new THREE.MeshStandardMaterial({ color: 0xd8a746, roughness: .3, metalness: .8, emissive: 0x2c1a00, emissiveIntensity: .25 }),
  glowRed: new THREE.MeshStandardMaterial({ color: 0xff5b27, emissive: 0xff2700, emissiveIntensity: 4 }),
  glowGold: new THREE.MeshStandardMaterial({ color: 0xffd875, emissive: 0xffa516, emissiveIntensity: 2.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9d281f, transparent: true, opacity: .72, roughness: .15, metalness: .1, emissive: 0x320400, emissiveIntensity: .5 }),
  cork: std(0x8a6535, .9),
};

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
function sphere(r, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), material);
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

export function createExplorer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const hips = new THREE.Group(); hips.position.y = .92; body.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  torso.add(box(.54, .58, .29, mat.shirt, 0, .42, 0));
  torso.add(box(.62, .54, .34, mat.jacket, 0, .42, .01));
  torso.add(box(.16, .5, .36, mat.shirt, 0, .43, .008));
  torso.add(box(.64, .1, .38, mat.leather, 0, .17, 0));
  torso.add(box(.13, .11, .04, mat.metal, 0, .17, .21));
  // jacket lapels
  const lapelL = box(.12, .42, .045, mat.jacketDark, -.13, .48, .185); lapelL.rotation.z = -.18; torso.add(lapelL);
  const lapelR = box(.12, .42, .045, mat.jacketDark, .13, .48, .185); lapelR.rotation.z = .18; torso.add(lapelR);
  // bandolier / satchel strap
  const strap = box(.09, .9, .05, mat.leather, .02, .44, .19); strap.rotation.z = .52; torso.add(strap);
  const satchel = box(.34, .28, .18, mat.leather, -.42, .08, .02); satchel.rotation.z = -.04; torso.add(satchel);
  torso.add(box(.075, .13, .055, mat.metal, -.42, .19, .11));
  // coiled whip
  const coil = new THREE.Mesh(new THREE.TorusGeometry(.13, .025, 5, 12), mat.leather);
  coil.rotation.x = Math.PI / 2; coil.position.set(.35, .12, .01); coil.castShadow = true; torso.add(coil);

  const head = new THREE.Group(); head.position.y = .78; torso.add(head);
  head.add(cyl(.095, .11, .17, 8, mat.skin, 0, .02, 0));
  head.add(sphere(.22, mat.skin, 0, .17, 0, 1, 1.04, .9));
  head.add(sphere(.225, mat.hair, 0, .235, -.03, 1.03, .9, .98));
  head.add(sphere(.055, mat.skin, 0, .13, .19));
  const eyeL = sphere(.017, mat.eye, -.08, .2, .187); head.add(eyeL);
  const eyeR = sphere(.017, mat.eye, .08, .2, .187); head.add(eyeR);
  head.add(sphere(.09, mat.hair, 0, .07, -.12, 1.2, .55, .6)); // stubble
  head.add(sphere(.045, mat.skinDark, -.215, .16, .015, .5, 1, .7));
  head.add(sphere(.045, mat.skinDark, .215, .16, .015, .5, 1, .7));
  // fedora
  const hat = new THREE.Group(); hat.position.y = .33; head.add(hat);
  hat.add(cyl(.46, .48, .035, 24, mat.hat, 0, 0, 0));
  hat.add(cyl(.245, .295, .25, 16, mat.hat, 0, .13, 0));
  hat.add(cyl(.297, .3, .055, 16, mat.hatBand, 0, .035, 0));
  const pinch = box(.17, .055, .09, mat.hatBand, 0, .255, 0); pinch.rotation.x = .08; hat.add(pinch);

  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(side * .36, .62, 0);
    arm.add(cyl(.09, .082, .31, 8, mat.jacket, 0, -.16, 0));
    const forearm = new THREE.Group(); forearm.position.y = -.3; arm.add(forearm);
    forearm.add(cyl(.075, .07, .3, 8, mat.jacket, 0, -.15, 0));
    forearm.add(cyl(.074, .064, .07, 8, mat.shirt, 0, -.3, 0));
    forearm.add(sphere(.075, mat.skin, 0, -.37, 0, 1, .75, .75));
    if (side < 0) {
      const hand = box(.1, .1, .12, mat.skin, 0, -.38, .02); forearm.add(hand);
    }
    arm.userData.forearm = forearm;
    return arm;
  };
  const leftArm = makeArm(-1); const rightArm = makeArm(1); torso.add(leftArm); torso.add(rightArm);

  const makeLeg = (side) => {
    const leg = new THREE.Group(); leg.position.set(side * .16, -.02, 0);
    leg.add(cyl(.11, .095, .42, 8, mat.pants, 0, -.22, 0));
    const lower = new THREE.Group(); lower.position.y = -.44; leg.add(lower);
    lower.add(cyl(.09, .075, .38, 8, mat.pants, 0, -.19, 0));
    lower.add(box(.19, .17, .34, mat.boot, 0, -.42, .065));
    lower.add(box(.205, .055, .36, mat.leather, 0, -.34, .06));
    leg.userData.lower = lower;
    return leg;
  };
  const leftLeg = makeLeg(-1); const rightLeg = makeLeg(1); hips.add(leftLeg); hips.add(rightLeg);

  // web belt loops
  torso.add(box(.09, .13, .02, mat.hatBand, -.22, .17, .19));
  torso.add(box(.09, .13, .02, mat.hatBand, .23, .17, .19));

  // poncho-ish shoulder dust cloth for silhouette
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.255, .045, 5, 12), mat.jacketDark);
  collar.rotation.x = Math.PI / 2; collar.position.y = .71; collar.scale.z = .7; collar.castShadow = true; torso.add(collar);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.userData.rig = {
    body, torso, head, hat, leftArm, rightArm, leftLeg, rightLeg,
    time: 0, moveBlend: 0, crouchBlend: 0, attack: 0, attackType: '',
    update(dt, state) {
      this.time += dt;
      const moving = state.moveSpeed > .1 && state.grounded;
      this.moveBlend += ((moving ? 1 : 0) - this.moveBlend) * Math.min(1, dt * 10);
      const crouch = state.crouch ? 1 : 0;
      this.crouchBlend += (crouch - this.crouchBlend) * Math.min(1, dt * 9);
      const run = Math.min(1.45, state.moveSpeed / 4.6);
      const stride = Math.sin(this.time * (5 + run * 4));
      const stride2 = Math.cos(this.time * (2.5 + run * 2));
      const bob = this.moveBlend * Math.abs(Math.sin(this.time * (5 + run * 4))) * (.035 + run * .02);
      body.position.y = bob - this.crouchBlend * .3;
      body.rotation.x = run * .07 + this.crouchBlend * .1;
      body.rotation.z = stride2 * .025 * this.moveBlend;
      torso.rotation.y = -stride * .08 * this.moveBlend;
      head.rotation.y = stride * .03 * this.moveBlend;
      leftLeg.rotation.x = stride * (.58 + run * .22) * this.moveBlend + this.crouchBlend * .5;
      rightLeg.rotation.x = -stride * (.58 + run * .22) * this.moveBlend + this.crouchBlend * .5;
      leftLeg.userData.lower.rotation.x = Math.max(0, -stride) * .48 * this.moveBlend - this.crouchBlend * .85;
      rightLeg.userData.lower.rotation.x = Math.max(0, stride) * .48 * this.moveBlend - this.crouchBlend * .85;
      leftArm.rotation.x = -stride * (.42 + run * .25) * this.moveBlend - .04;
      rightArm.rotation.x = stride * (.42 + run * .25) * this.moveBlend - .08;
      leftArm.rotation.z = -.13 + this.crouchBlend * .18;
      rightArm.rotation.z = .13 - this.crouchBlend * .18;
      leftArm.userData.forearm.rotation.x = -.22 - Math.max(0, stride) * .25 * this.moveBlend;
      rightArm.userData.forearm.rotation.x = -.22 - Math.max(0, -stride) * .25 * this.moveBlend;
      if (state.attack > 0) {
        this.attack = state.attack;
        if (state.attackType === 'whip') {
          rightArm.rotation.x = -1.45 + Math.sin(state.attack * Math.PI) * -0.7;
          rightArm.rotation.z = .1;
          rightArm.userData.forearm.rotation.x = -.5;
          torso.rotation.y = -.25;
        } else if (state.attackType === 'punch') {
          rightArm.rotation.x = -1.35 * Math.sin(state.attack * Math.PI) - .1;
          rightArm.rotation.z = -.1;
          rightArm.userData.forearm.rotation.x = -.4;
          torso.rotation.y = -.28 * Math.sin(state.attack * Math.PI);
        } else if (state.attackType === 'shoot') {
          rightArm.rotation.x = -1.55;
          rightArm.rotation.z = .12;
          rightArm.userData.forearm.rotation.x = -.1;
        }
      }
      if (state.airborne) {
        leftLeg.rotation.x = -.35; rightLeg.rotation.x = .3;
        leftArm.rotation.x = -.5; rightArm.rotation.x = -.55;
      }
    }
  };
  return root;
}

function spider() {
  const g = new THREE.Group();
  const body = sphere(.36, mat.spider, 0, .3, 0, 1.15, .7, 1.35); g.add(body);
  g.add(sphere(.22, mat.spiderLight, 0, .35, -.35, 1, .8, 1));
  g.add(sphere(.055, mat.glowRed, -.1, .39, .35));
  g.add(sphere(.055, mat.glowRed, .1, .39, .35));
  g.add(box(.09, .06, .1, mat.bone, -.1, .23, .42));
  g.add(box(.09, .06, .1, mat.bone, .1, .23, .42));
  const legs = [];
  for (let s of [-1, 1]) for (let i = 0; i < 4; i++) {
    const hip = new THREE.Group(); hip.position.set(s * .22, .28, -.18 + i * .15);
    const upper = cyl(.035, .025, .38, 5, mat.spider, s * .18, .12, 0); upper.rotation.z = s * -1; hip.add(upper);
    const lower = cyl(.025, .015, .36, 5, mat.spider, s * .36, -.05, 0); lower.rotation.z = s * .7; hip.add(lower);
    g.add(hip); legs.push(hip);
  }
  g.userData.legs = legs;
  g.userData.animate = (t, moving, attacking) => {
    legs.forEach((l, i) => { l.rotation.z = Math.sin(t * (moving ? 8 : 3) + i * 1.3) * (moving ? .22 : .05); });
    body.position.y = .3 + Math.sin(t * 3) * .015;
    if (attacking) g.position.y = .08 + Math.abs(Math.sin(attacking * Math.PI * 5)) * .08;
  };
  return g;
}

function scorpion() {
  const g = new THREE.Group();
  g.add(sphere(.35, mat.scorpion, 0, .28, 0, 1.1, .55, 1.5));
  g.add(sphere(.23, mat.spiderLight, 0, .34, -.38, 1, .7, .9));
  const claws = [];
  for (let s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * .25, .28, .32); g.add(arm);
    arm.add(cyl(.05, .04, .35, 5, mat.scorpion, s * .12, 0, .1).rotateZ(Math.PI / 2));
    const claw = sphere(.13, mat.scorpion, s * .25, .01, .25, 1.35, .55, 1); arm.add(claw);
    claws.push(arm);
  }
  const tail = new THREE.Group(); tail.position.set(0, .38, -.4); g.add(tail);
  for (let i = 0; i < 4; i++) {
    const seg = sphere(.09 - i * .012, mat.scorpion, 0, i * .12, -i * .04, 1, 1.3, .8); tail.add(seg);
  }
  tail.add(sphere(.08, mat.glowRed, 0, .52, -.15));
  const legs = [];
  for (let s of [-1, 1]) for (let i = 0; i < 3; i++) {
    const l = cyl(.023, .015, .34, 5, mat.scorpion, s * .25, .18, -.15 + i * .18);
    l.rotation.z = s * -.85; g.add(l); legs.push(l);
  }
  g.userData.animate = (t, moving) => {
    claws.forEach((c, i) => { c.rotation.x = Math.sin(t * 4 + i * 2) * .15; });
    tail.rotation.x = -.35 + Math.sin(t * 2.5) * .06;
    legs.forEach((l, i) => { l.rotation.z = Math.sign(l.position.x) * -.85 + Math.sin(t * 9 + i) * .1; });
  };
  return g;
}

function raider(elite = false) {
  const g = new THREE.Group();
  const scale = elite ? 1.14 : 1;
  g.scale.setScalar(scale);
  const hips = new THREE.Group(); hips.position.y = .9; g.add(hips);
  hips.add(box(.5, .5, .28, mat.raider, 0, .2, 0));
  hips.add(box(.55, .3, .32, mat.leather, 0, .05, 0));
  const torso = box(.55, .54, .3, elite ? mat.leather : mat.raider, 0, .53, 0); hips.add(torso);
  hips.add(box(.44, .58, .06, mat.raiderCloth, 0, .5, .17));
  hips.add(box(.1, .42, .04, mat.leather, .13, .53, .2));
  const head = new THREE.Group(); head.position.y = .82; hips.add(head);
  head.add(sphere(.19, mat.skinDark, 0, .1, 0));
  head.add(box(.38, .1, .36, elite ? mat.leather : mat.raiderCloth, 0, .25, 0));
  head.add(box(.42, .08, .38, elite ? mat.leather : mat.raiderCloth, 0, .22, -.03));
  head.add(box(.08, .06, .02, mat.eye, -.075, .12, .18));
  head.add(box(.08, .06, .02, mat.eye, .075, .12, .18));
  if (elite) {
    head.add(box(.46, .11, .4, mat.metal, 0, .08, 0));
    g.add(cyl(.62, .7, .16, 8, mat.metal, 0, .76, 0));
    g.add(box(.8, .24, .5, mat.metal, 0, .68, 0));
  }
  const arms = [];
  for (let s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * .34, .7, 0);
    arm.add(cyl(.08, .07, .58, 6, mat.raider, 0, -.28, 0));
    arm.add(sphere(.07, mat.skinDark, 0, -.6, 0));
    if (s > 0) {
      const gun = new THREE.Group(); gun.position.set(0, -.62, .04); arm.add(gun);
      gun.add(box(.08, .1, .34, mat.gun, 0, 0, .18));
      gun.add(box(.08, .18, .1, mat.gun, 0, -.1, .02));
      arm.userData.gun = gun;
    }
    arms.push(arm); hips.add(arm);
  }
  const legs = [];
  for (let s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * .14, .04, 0);
    leg.add(cyl(.1, .08, .8, 6, mat.raider, 0, -.4, 0));
    leg.add(box(.18, .12, .3, mat.boot, 0, -.82, .05));
    legs.push(leg); hips.add(leg);
  }
  g.userData.arms = arms; g.userData.legs = legs; g.userData.torso = torso;
  g.userData.animate = (t, moving, attacking) => {
    const s = Math.sin(t * 7);
    if (moving) {
      legs[0].rotation.x = s * .5; legs[1].rotation.x = -s * .5;
      arms[0].rotation.x = -s * .3; arms[1].rotation.x = s * .3;
    } else {
      legs[0].rotation.x *= .9; legs[1].rotation.x *= .9;
      arms[0].rotation.x = Math.sin(t * 1.4) * .04;
      arms[1].rotation.x = -.15 + Math.sin(t * 1.4) * .04;
    }
    if (attacking) {
      arms[1].rotation.x = -1.35;
      torso.rotation.y = -.15;
    }
    if (elite) g.userData.torso.rotation.z = Math.sin(t * 1.2) * .01;
  };
  return g;
}

function skeleton() {
  const g = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = .88; g.add(hips);
  hips.add(box(.5, .22, .24, mat.bone, 0, .18, 0));
  for (let i = 0; i < 3; i++) hips.add(cyl(.22 - i * .04, .23 - i * .04, .07, 8, mat.bone, 0, .42 + i * .13, 0));
  hips.add(box(.08, .55, .08, mat.bone, 0, .42, -.1));
  const head = new THREE.Group(); head.position.y = .98; hips.add(head);
  head.add(sphere(.18, mat.bone, 0, 0, 0, 1, 1.15, .9));
  head.add(box(.22, .13, .17, mat.bone, 0, -.1, .09));
  head.add(sphere(.04, mat.glowRed, -.07, .03, .15)); head.add(sphere(.04, mat.glowRed, .07, .03, .15));
  head.add(cyl(.16, .22, .14, 8, mat.metal, 0, .12, 0));
  const arms = [];
  for (let s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * .28, .62, 0);
    arm.add(cyl(.035, .03, .38, 5, mat.bone, 0, -.19, 0));
    arm.add(cyl(.03, .025, .35, 5, mat.bone, 0, -.52, 0));
    arm.add(box(.18, .04, .06, mat.bone, s * .04, -.54, 0));
    arms.push(arm); hips.add(arm);
  }
  const legs = [];
  for (let s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * .13, .02, 0);
    leg.add(cyl(.055, .04, .78, 5, mat.bone, 0, -.39, 0));
    leg.add(box(.16, .06, .26, mat.bone, 0, -.79, .05));
    legs.push(leg); hips.add(leg);
  }
  const sword = box(.06, .78, .1, mat.metal, 0, -.45, .02); arms[0].add(sword);
  g.userData.arms = arms; g.userData.legs = legs;
  g.userData.animate = (t, moving, attacking) => {
    const s = Math.sin(t * 6.5);
    if (moving) { legs[0].rotation.x = s * .5; legs[1].rotation.x = -s * .5; arms[0].rotation.x = -s * .22; arms[1].rotation.x = s * .22; }
    if (attacking) { arms[0].rotation.x = -1.5 + Math.sin(attacking * Math.PI) * .6; arms[0].rotation.z = -.5; }
  };
  return g;
}

export function createEnemy(type) {
  let g;
  if (type === 'spider') g = spider();
  else if (type === 'scorpion') g = scorpion();
  else if (type === 'skeleton') g = skeleton();
  else if (type === 'elite') g = raider(true);
  else g = raider(false);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createBoss() {
  const g = new THREE.Group();
  const body = new THREE.Group(); body.position.y = .1; g.add(body);
  body.add(box(1.6, 1.7, 1.05, mat.stone, 0, 2.25, 0));
  body.add(box(1.9, .55, 1.2, mat.stoneLight, 0, 3.0, 0));
  body.add(box(1.3, .45, 1.05, mat.bone, 0, 3.06, 0));
  // monolithic head
  const head = new THREE.Group(); head.position.y = 3.65; body.add(head);
  head.add(box(1.0, .9, .85, mat.stoneLight, 0, 0, 0));
  head.add(box(.72, .35, .28, mat.stone, 0, -.25, .46));
  head.add(box(.34, .26, .12, mat.bone, -.21, .05, .43));
  head.add(box(.34, .26, .12, mat.bone, .21, .05, .43));
  head.add(box(.22, .08, .03, mat.glowRed, -.21, .07, .5));
  head.add(box(.22, .08, .03, mat.glowRed, .21, .07, .5));
  head.add(box(.16, .1, .1, mat.gold, 0, -.2, .47));
  head.add(cyl(.66, .55, .38, 8, mat.gold, 0, .44, 0));
  for (let i = 0; i < 5; i++) {
    const plume = box(.1, .42 + Math.sin(i) * .1, .1, i % 2 ? mat.raiderCloth : mat.gold, -.36 + i * .18, .75, 0);
    plume.rotation.z = (i - 2) * .1; head.add(plume);
  }
  // shoulders and arms
  const arms = [];
  for (let s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 1.02, 2.8, 0);
    arm.add(box(.58, .86, .62, mat.stone, 0, -.38, 0));
    const lower = new THREE.Group(); lower.position.y = -.82; arm.add(lower);
    lower.add(box(.48, 1.1, .5, mat.stone, 0, -.5, 0));
    lower.add(box(.58, .45, .58, mat.stoneLight, 0, -1.0, 0));
    lower.add(box(.64, .16, .68, mat.gold, 0, -.68, 0));
    arms.push({ arm, lower }); body.add(arm);
  }
  // legs
  const legs = [];
  for (let s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(s * .48, 1.45, 0);
    leg.add(box(.52, 1.2, .55, mat.stone, 0, -.58, 0));
    leg.add(box(.62, .3, .9, mat.stoneLight, 0, -1.16, .12));
    legs.push(leg); body.add(leg);
  }
  // chest sun disc
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .12, 20), mat.gold);
  disc.rotation.x = Math.PI / 2; disc.position.set(0, 2.35, .58); body.add(disc);
  for (let i = 0; i < 12; i++) {
    const ray = box(.07, .34, .05, mat.gold, 0, 0, 0);
    ray.position.set(Math.cos(i / 12 * Math.PI * 2) * .65, 2.35 + Math.sin(i / 12 * Math.PI * 2) * .65, .58);
    ray.rotation.z = -i / 12 * Math.PI * 2; body.add(ray);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData = { body, head, arms, legs, animate(t, moving) {
    const s = Math.sin(t * 2.2);
    if (moving) {
      legs[0].rotation.x = s * .28; legs[1].rotation.x = -s * .28;
      arms[0].arm.rotation.x = -s * .2; arms[1].arm.rotation.x = s * .2;
    }
    head.rotation.y = Math.sin(t * .55) * .12;
    body.position.y = .1 + Math.sin(t * 1.4) * .025;
  } };
  return g;
}

export function createIdol() {
  const g = new THREE.Group();
  g.add(box(.14, .25, .1, mat.gold, 0, .12, 0));
  g.add(box(.24, .08, .12, mat.gold, 0, .27, 0));
  g.add(sphere(.11, mat.gold, 0, .39, 0, 1, 1.05, .9));
  g.add(box(.07, .09, .04, mat.gold, -.15, .22, 0));
  g.add(box(.07, .09, .04, mat.gold, .15, .22, 0));
  g.add(box(.05, .12, .04, mat.gold, -.07, .01, 0));
  g.add(box(.05, .12, .04, mat.gold, .07, .01, 0));
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function createRelic(type = 0) {
  const g = new THREE.Group();
  if (type % 5 === 0) {
    // serpent mask
    g.add(sphere(.38, mat.gold, 0, .1, 0, 1.25, .9, .5));
    g.add(box(.28, .2, .22, mat.gold, -.4, .05, .08));
    g.add(box(.28, .2, .22, mat.gold, .4, .05, .08));
    g.add(box(.12, .08, .08, mat.glowGold, -.15, .18, .25));
    g.add(box(.12, .08, .08, mat.glowGold, .15, .18, .25));
    for (let i = 0; i < 4; i++) g.add(box(.08, .25, .05, mat.gold, -.15 + i * .1, .38, 0));
  } else if (type % 5 === 1) {
    // sun disc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .12, 24), mat.gold);
    disc.rotation.x = Math.PI / 2; g.add(disc);
    for (let i = 0; i < 16; i++) {
      const ray = box(.07, .25, .08, mat.gold);
      const a = i / 16 * Math.PI * 2;
      ray.position.set(Math.cos(a) * .55, Math.sin(a) * .55, 0);
      ray.rotation.z = a - Math.PI / 2; g.add(ray);
    }
    g.add(new THREE.Mesh(new THREE.TorusGeometry(.2, .03, 6, 20), mat.gold));
  } else if (type % 5 === 2) {
    // crystal skull
    g.add(sphere(.33, mat.bone, 0, .12, 0, .95, 1.15, .95));
    g.add(box(.26, .2, .25, mat.bone, 0, -.14, .16));
    g.add(sphere(.075, new THREE.MeshStandardMaterial({ color: 0xffcc60, emissive: 0xff9c1e, emissiveIntensity: 2 }), -.13, .13, .29));
    g.add(sphere(.075, new THREE.MeshStandardMaterial({ color: 0xffcc60, emissive: 0xff9c1e, emissiveIntensity: 2 }), .13, .13, .29));
    for (let i = 0; i < 7; i++) g.add(box(.05, .09, .04, mat.bone, -.18 + i * .06, -.22, .3));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(.37, .035, 6, 18), mat.gold));
  } else if (type % 5 === 3) {
    // chalice
    g.add(cyl(.24, .13, .35, 14, mat.gold, 0, .18, 0));
    g.add(cyl(.05, .1, .28, 10, mat.gold, 0, -.08, 0));
    g.add(cyl(.18, .16, .06, 14, mat.gold, 0, -.24, 0));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(.25, .028, 6, 18), mat.gold).rotateX(Math.PI / 2).translateY(.28));
    g.add(sphere(.07, mat.glowGold, 0, .43, 0));
  } else {
    // jaguar figurine
    g.add(sphere(.28, mat.gold, 0, .18, 0, .9, .85, 1.4));
    g.add(sphere(.21, mat.gold, 0, .36, .28, 1, .9, .9));
    g.add(box(.09, .16, .06, mat.gold, -.14, .53, .3));
    g.add(box(.09, .16, .06, mat.gold, .14, .53, .3));
    g.add(box(.07, .06, .04, mat.glowGold, -.08, .39, .44));
    g.add(box(.07, .06, .04, mat.glowGold, .08, .39, .44));
    for (const s of [-1, 1]) g.add(box(.12, .34, .12, mat.gold, s * .17, -.05, .25));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function createPotion() {
  const g = new THREE.Group();
  g.add(cyl(.09, .13, .26, 10, mat.glass, 0, .13, 0));
  g.add(cyl(.045, .055, .09, 8, mat.glass, 0, .3, 0));
  g.add(cyl(.048, .05, .05, 8, mat.cork, 0, .36, 0));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(.1, .018, 5, 12), mat.metal).rotateX(Math.PI / 2).translateY(.25));
  const glow = new THREE.PointLight(0xff593b, .7, 2.4, 2);
  glow.position.y = .15; g.add(glow);
  return g;
}

export function createTorch(flameMaterial) {
  const g = new THREE.Group();
  g.add(cyl(.12, .16, .5, 8, mat.leather, 0, 0, 0));
  g.add(cyl(.06, .1, .32, 8, mat.wood, 0, .35, 0));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.13, .45, 8), flameMaterial);
  flame.position.y = .66; g.add(flame);
  return { group: g, flame };
}
