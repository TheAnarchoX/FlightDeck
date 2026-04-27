import * as THREE from 'three';
import { ParticleEmitter } from './ParticleEmitter.js';
import { CONFIG }          from './config.js';

const CFG = CONFIG.ROCKET;
const ROCKET_DECAL_TEXT = 'FALCON9';

// ── Rocket (Falcon-9 Block-5 inspired) ───────────────────────────────────────
export class Rocket {
  constructor(scene) {
    this.scene  = scene;
    this.group  = new THREE.Group();   // whole rocket

    this._s1Group = new THREE.Group(); // first-stage sub-group
    this._s2Group = new THREE.Group(); // second-stage + payload sub-group

    this._nozzleGlows  = [];   // emissive glow cones — all engines
    this._s1Glows      = [];   // stage-1 subset
    this._s2Glows      = [];   // stage-2 subset (MVac)
    this._exhaustEmitter = null;
    this._baseY = 0;           // world Y of rocket bottom when on pad
    this._pitchAngle = 0;      // current visual pitch
  }

  // ── Build & place ─────────────────────────────────────────────────────────
  init() {
    this._buildRocket();
    this.scene.add(this.group);
  }

  setOnLaunchpad(mountPos) {
    this.group.position.copy(mountPos);
    this._baseY = mountPos.y;
  }

  // ── Materials ─────────────────────────────────────────────────────────────
  _mat(color, rough = 0.35, metal = 0.5, emissive = 0x000000, emissiveInt = 0) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive, emissiveIntensity: emissiveInt });
  }

  // ── Geometry builder helpers ──────────────────────────────────────────────
  _mesh(geo, mat, [x, y, z] = [0, 0, 0]) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }

  // ── Full rocket assembly ──────────────────────────────────────────────────
  _buildRocket() {
    const D = CFG.DIAMETER;
    const R = D / 2;

    const matBody   = this._mat(0xf0f0f0, 0.3, 0.4);
    const matDark   = this._mat(0x1a1a22, 0.4, 0.7);
    const matEngine = this._mat(0x30303e, 0.2, 0.9);
    const matStripe = this._mat(0x111118, 0.3, 0.8);
    const matFin    = this._mat(0x181822, 0.3, 0.75);
    const matNozzle = this._mat(0x3a3a48, 0.15, 0.95);
    const matDecal  = this._buildFalconDecalMaterial();

    // ── Stage 1 (42.6 m body) ─────────────────────────────────────────────
    const S1H = CFG.STAGE1.HEIGHT;

    // Main cylinder
    this._s1Group.add(this._mesh(new THREE.CylinderGeometry(R, R, S1H, 32), matBody, [0, S1H / 2, 0]));
    this._addFalconDecals(R, S1H, matDecal);

    // LOX header stripe ~72 % up
    this._s1Group.add(this._mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 2.8, 32), matStripe, [0, S1H * 0.72, 0]));

    // Engine section (skirt — slightly wider)
    this._s1Group.add(this._mesh(new THREE.CylinderGeometry(R * 1.18, R * 1.22, 2.8, 32), matDark, [0, 1.4, 0]));

    // 4 landing legs (folded — simple fins for now)
    for (let i = 0; i < 4; i++) {
      const a    = (i / 4) * Math.PI * 2;
      const fin  = this._buildFin(matFin);
      fin.rotation.y = a;
      fin.position.y = 0;
      this._s1Group.add(fin);
    }

    // 9 Merlin engine bells: 1 centre + 8 outer
    this._addEngineCluster(R, matEngine, matNozzle, this._s1Group);

    // ── Interstage ────────────────────────────────────────────────────────
    const ISH = 1.2;
    this._s1Group.add(this._mesh(new THREE.CylinderGeometry(R, R, ISH, 32), matDark, [0, S1H + ISH / 2, 0]));

    // ── Stage 2 (12.6 m body) ─────────────────────────────────────────────
    const S2H  = CFG.STAGE2.HEIGHT;
    const S2R  = R * 0.92; // nearly same diameter

    this._s2Group.add(this._mesh(new THREE.CylinderGeometry(S2R, S2R, S2H, 32), matBody, [0, S2H / 2, 0]));

    // MVac nozzle (large vacuum bell, points down)
    const mvacGeo = new THREE.CylinderGeometry(0.38, 0.85, 2.8, 20, 1, true);
    const mvac    = new THREE.Mesh(mvacGeo, matNozzle);
    mvac.position.set(0, -1.4, 0);
    mvac.rotation.x = Math.PI;
    this._s2Group.add(mvac);

    // MVac glow
    const mvacGlow = this._makeNozzleGlow(0, -3.5, 0, 0.9, 4.5);
    this._s2Group.add(mvacGlow);
    this._nozzleGlows.push(mvacGlow);
    this._s2Glows.push(mvacGlow);

    // ── Fairing / nose cone ────────────────────────────────────────────────
    const FH = CFG.FAIRING_HEIGHT;
    this._s2Group.add(this._mesh(new THREE.CylinderGeometry(0, S2R, FH, 32), matBody, [0, S2H + FH / 2, 0]));
    // Tip
    this._s2Group.add(this._mesh(new THREE.SphereGeometry(S2R * 0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      matDark, [0, S2H + FH, 0]));

    // Position s2 on top of s1 + interstage
    this._s2Group.position.y = S1H + ISH;

    // ── Assemble ─────────────────────────────────────────────────────────
    this.group.add(this._s1Group);
    this.group.add(this._s2Group);

    // ── Exhaust particle emitter ──────────────────────────────────────────
    this._exhaustEmitter = new ParticleEmitter(this.scene, {
      count:      3500,
      speed:      78,
      spread:     0.22,
      lifetime:   1.15,
      size:       3.2,
      opacity:    0.55,
      spawnRate:  0.14,
      startColor: new THREE.Color(0xffb15a),
      endColor:   new THREE.Color(0x220800),
    });
    this._exhaustActive = false;
  }

  // ── Engine cluster ────────────────────────────────────────────────────────
  _addEngineCluster(R, matEngine, matNozzle, parent) {
    // Centre
    this._addSingleEngine(0, 0, matEngine, matNozzle, parent);
    // 8 outer
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this._addSingleEngine(Math.cos(a) * R * 0.52, Math.sin(a) * R * 0.52, matEngine, matNozzle, parent);
    }
  }

  _buildFalconDecalMaterial() {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 1024;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111118';
    ctx.font = 'bold 96px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const chars = ROCKET_DECAL_TEXT.split('');
    chars.forEach((ch, i) => {
      ctx.fillText(ch, c.width / 2, 120 + i * 104);
    });

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
      map:         tex,
      transparent: true,
      depthWrite:  false,
      side:        THREE.DoubleSide,
    });
  }

  _addFalconDecals(R, S1H, matDecal) {
    const positions = [
      { pos: [0, S1H * 0.44, R + 0.025], rot: [0, 0, 0] },
      { pos: [0, S1H * 0.44, -R - 0.025], rot: [0, Math.PI, 0] },
    ];

    positions.forEach(({ pos, rot }) => {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 22), matDecal);
      decal.position.set(...pos);
      decal.rotation.set(...rot);
      this._s1Group.add(decal);
    });
  }

  _addSingleEngine(x, z, matEngine, matNozzle, parent) {
    // Turbopump body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.75, 12), matEngine);
    body.position.set(x, 0.7, z);
    parent.add(body);

    // Nozzle bell (opens downward)
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.48, 1.4, 14, 1, true), matNozzle);
    bell.position.set(x, 0, z);
    bell.rotation.x = Math.PI;
    parent.add(bell);

    // Exhaust glow cone
    const glow = this._makeNozzleGlow(x, -2.2, z, 0.4, 2.8);
    parent.add(glow);
    this._nozzleGlows.push(glow);
    this._s1Glows.push(glow);
  }

  _makeNozzleGlow(x, y, z, r, h) {
    const geo = new THREE.ConeGeometry(r, h, 14);
    const mat = new THREE.MeshBasicMaterial({
      color:       0xff5500,
      transparent: true,
      opacity:     0,
      side:        THREE.BackSide,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  }

  // ── Fins ─────────────────────────────────────────────────────────────────
  _buildFin(mat) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(4.5, -5);
    shape.lineTo(5.5, 0);
    shape.lineTo(0.6, 5.5);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
    const fin = new THREE.Mesh(geo, mat);
    fin.castShadow = true;

    // Position flush to rocket side, tip pointing outward
    const group = new THREE.Group();
    fin.rotation.x = Math.PI / 2;
    fin.position.set(CFG.DIAMETER / 2, -2.5, -0.06);
    group.add(fin);
    return group;
  }

  // ── Engine events ─────────────────────────────────────────────────────────
  igniteEngines() {
    this._s1Glows.forEach(g => { g.material.opacity = 0.38; });
    this._exhaustActive = true;
    this._exhaustEmitter.setActive(true);
  }

  igniteStage2() {
    this._s2Glows.forEach(g => { g.material.opacity = 0.42; });
    this._exhaustActive = true;
    this._exhaustEmitter.setActive(true);
  }

  cutEngines() {
    this._setGlow(0);
    this._exhaustActive = false;
    this._exhaustEmitter.setActive(false);
  }

  _setGlow(opacity) {
    this._nozzleGlows.forEach(g => { g.material.opacity = opacity; });
  }

  // ── Staging ───────────────────────────────────────────────────────────────
  performStaging() {
    // Detach s1 — clone it and let it drift
    const falling = this._s1Group.clone();
    falling.position.copy(this.group.position);
    falling.position.y += this._s1Group.position.y;
    this.scene.add(falling);

    this.group.remove(this._s1Group);

    // Animate s1 falling + tumbling
    let vy = -8;
    const drift = () => {
      vy -= 0.3;
      falling.position.y    += vy * 0.016;
      falling.rotation.z    += 0.008;
      falling.rotation.x    += 0.002;
      if (falling.position.y > -1000) requestAnimationFrame(drift);
      else this.scene.remove(falling);
    };
    requestAnimationFrame(drift);

    // Move s2 to base of group
    this._s2Group.position.y = 0;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  update(dt, physState) {
    // Lift rocket body with altitude
    this.group.position.y = this._baseY + physState.altitude;

    // Gravity-turn pitch programme (subtle)
    if (physState.altitude > 500 && physState.altitude < 80_000) {
      const target = Math.min(0.25, physState.altitude / 120_000);
      this._pitchAngle += (target - this._pitchAngle) * 0.005;
      this.group.rotation.z = this._pitchAngle;
    }

    // Engine glow flicker
    if (physState.engineRunning && this._exhaustActive) {
      const flicker = 0.55 + Math.random() * 0.45;
      this._nozzleGlows.forEach(g => {
        g.material.opacity = g.material.opacity > 0 ? flicker * 0.38 : 0;
      });
    }

    // Update exhaust emitter position (at nozzle)
    if (this._exhaustEmitter) {
      const wp = new THREE.Vector3();
      this.group.getWorldPosition(wp);
      // Offset to nozzle bottom
      const nozzleOffset = new THREE.Vector3(0, -1, 0).applyQuaternion(this.group.quaternion);
      wp.add(nozzleOffset);
      this._exhaustEmitter.setEmitPosition(wp);
      this._exhaustEmitter.update(dt);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  reset() {
    // Restore s1 if removed
    if (!this.group.children.includes(this._s1Group)) {
      this.group.add(this._s1Group);
    }
    this._s2Group.position.y = CFG.STAGE1.HEIGHT + 1.2;
    this.group.rotation.set(0, 0, 0);
    this._pitchAngle = 0;
    this.cutEngines(); // zeroes all glow opacities
  }
}
