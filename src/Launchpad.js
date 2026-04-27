import * as THREE from 'three';

// Steam starts 6 m aft of the rocket base and spreads across a 14 m trench radius.
const DELUGE_Z_CENTER_OFFSET_M = -6;
const DELUGE_Z_RADIUS_M = 14;

// ── Launch complex geometry (LC-39A inspired) ─────────────────────────────────
export class Launchpad {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this._mountY = 9; // world Y where rocket base sits
    this._deluge = null;
    this._holdDownArms = [];
    this._holdDownReleased = false;
  }

  init() {
    this._buildAll();
    this._buildWaterDeluge();
    this.scene.add(this.group);
  }

  getRocketMountPosition() {
    return new THREE.Vector3(0, this._mountY, 0);
  }

  triggerWaterDeluge() {
    if (this._deluge) this._deluge.burst();
  }

  update(dt) {
    if (this._deluge) this._deluge.update(dt);
    this._updateHoldDownArms(dt);
  }

  resetEffects() {
    if (this._deluge) this._deluge.reset();
    this.resetHoldDownArms();
  }

  releaseHoldDownArms() {
    this._holdDownReleased = true;
  }

  resetHoldDownArms() {
    this._holdDownReleased = false;
    this._holdDownArms.forEach(arm => {
      arm.rotation.y = arm.userData.closedRotation;
    });
  }

  // ── Materials ─────────────────────────────────────────────────────────────
  _mats() {
    return {
      concrete: new THREE.MeshStandardMaterial({ color: 0x8a8a7e, roughness: 0.92, metalness: 0.05 }),
      steel:    new THREE.MeshStandardMaterial({ color: 0x566677, roughness: 0.3,  metalness: 0.85 }),
      dark:     new THREE.MeshStandardMaterial({ color: 0x1e2d3d, roughness: 0.25, metalness: 0.9 }),
      rust:     new THREE.MeshStandardMaterial({ color: 0x7a4020, roughness: 0.85, metalness: 0.2 }),
      white:    new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.6,  metalness: 0.3 }),
    };
  }

  _buildAll() {
    const m = this._mats();

    // ── Launch mount pedestal ────────────────────────────────────────────────
    this._add(new THREE.CylinderGeometry(6.5, 8.5, 8, 8), m.concrete, [0, 4, 0]);
    // Table top
    this._add(new THREE.CylinderGeometry(8.5, 6.5, 1, 8), m.dark, [0, 8.5, 0]);
    // Hold-down posts (4)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      this._add(new THREE.BoxGeometry(1, 2.5, 1), m.dark, [Math.cos(a) * 3.5, 9.75, Math.sin(a) * 3.5]);
      this._addHoldDownArm(a, m.dark);
    }

    // ── Flame trench walls ───────────────────────────────────────────────────
    this._add(new THREE.BoxGeometry(5, 5, 30), new THREE.MeshStandardMaterial({ color: 0x0a0a08, roughness: 1 }), [0, -2.5, 0]);
    // Deflector ramp
    const deflGeo = new THREE.BoxGeometry(14, 0.5, 22);
    const defl    = new THREE.Mesh(deflGeo, m.concrete);
    defl.rotation.x = Math.PI / 9;
    defl.position.set(0, -0.5, 16);
    defl.receiveShadow = true;
    this.group.add(defl);

    // ── FSS — Fixed Service Structure (tower) ────────────────────────────────
    const TX = -16, TH = 108;
    const legOffsets = [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]];
    legOffsets.forEach(([dx, dz]) => {
      this._add(new THREE.BoxGeometry(1, TH, 1), m.steel, [TX + dx, TH / 2, dz]);
    });
    // Horizontal ring beams every 9 m
    for (let h = 9; h < TH; h += 9) {
      this._add(new THREE.BoxGeometry(7, 0.5, 0.4), m.dark, [TX, h, 0]);
      this._add(new THREE.BoxGeometry(0.4, 0.5, 7), m.dark, [TX, h, 0]);
      // Diagonal X-brace
      const bLen  = Math.sqrt(7 * 7 + 9 * 9);
      const bGeo  = new THREE.BoxGeometry(0.3, bLen, 0.3);
      const brace = new THREE.Mesh(bGeo, m.dark);
      brace.position.set(TX, h - 4.5, 0);
      brace.rotation.z = Math.atan2(7, 9);
      this.group.add(brace);
    }

    // ── Rotating Service Structure arms (3) ──────────────────────────────────
    [22, 44, 70].forEach(h => {
      // Arm beam
      this._add(new THREE.BoxGeometry(16, 1.2, 2), m.steel, [TX / 2 + 1.5, h, 0]);
      // Service box at end
      this._add(new THREE.BoxGeometry(4, 5, 4), m.dark, [1, h + 2.5, 0]);
    });

    // ── Water tower (sound suppression) ──────────────────────────────────────
    [[22, 18, 30], [22, -18, 24]].forEach(([x, z, h]) => {
      this._add(new THREE.CylinderGeometry(3.8, 3.8, h, 18), m.white, [x, h / 2, z]);
      this._add(new THREE.SphereGeometry(3.85, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.white, [x, h, z]);
      // Pipe
      this._add(new THREE.CylinderGeometry(0.25, 0.25, 20, 8), m.steel, [x - 4, h * 0.5 + 2, z]);
    });

    // ── Strongback ────────────────────────────────────────────────────────────
    this._add(new THREE.BoxGeometry(3.5, 82, 3.5), m.steel, [8, 41, 0]);

    // ── Perimeter fence posts ─────────────────────────────────────────────────
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const r = 60;
      this._add(new THREE.CylinderGeometry(0.15, 0.15, 2, 6), m.dark,
        [Math.cos(a) * r, 1, Math.sin(a) * r]);
    }
  }

  _add(geo, mat, [x, y, z]) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    return mesh;
  }

  _addHoldDownArm(angle, mat) {
    const pivot = new THREE.Group();
    pivot.position.set(Math.cos(angle) * 3.7, 10.9, Math.sin(angle) * 3.7);
    pivot.rotation.y = -angle;
    pivot.userData.closedRotation = -angle;
    pivot.userData.openRotation = -angle + Math.PI * 0.55;

    const claw = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.42), mat);
    claw.position.x = -1.3;
    claw.castShadow = true;
    claw.receiveShadow = true;
    pivot.add(claw);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.75), mat);
    pad.position.x = -2.8;
    pad.castShadow = true;
    pad.receiveShadow = true;
    pivot.add(pad);

    this._holdDownArms.push(pivot);
    this.group.add(pivot);
  }

  _updateHoldDownArms(dt) {
    const speed = Math.min(1, dt * 5);
    this._holdDownArms.forEach(arm => {
      const target = this._holdDownReleased ? arm.userData.openRotation : arm.userData.closedRotation;
      arm.rotation.y += (target - arm.rotation.y) * speed;
    });
  }

  _buildWaterDeluge() {
    this._deluge = new WaterDelugeSteam(this.group);
  }
}

class WaterDelugeSteam {
  constructor(parent) {
    this._N = 900;
    this._age = new Float32Array(this._N).fill(-1);
    this._life = new Float32Array(this._N);
    this._pos = new Float32Array(this._N * 3);
    this._col = new Float32Array(this._N * 3);
    this._vel = [];
    this._active = false;

    for (let i = 0; i < this._N; i++) this._vel.push(new THREE.Vector3());

    this._geo = new THREE.BufferGeometry();
    this._posAttr = new THREE.BufferAttribute(this._pos, 3);
    this._colAttr = new THREE.BufferAttribute(this._col, 3);
    this._posAttr.setUsage(THREE.DynamicDrawUsage);
    this._colAttr.setUsage(THREE.DynamicDrawUsage);
    this._geo.setAttribute('position', this._posAttr);
    this._geo.setAttribute('color', this._colAttr);

    this._mat = new THREE.PointsMaterial({
      size:            10,
      map:             this._buildTex(),
      alphaMap:        this._buildTex(),
      vertexColors:    true,
      transparent:     true,
      opacity:         0.42,
      depthWrite:      false,
      blending:        THREE.NormalBlending,
      sizeAttenuation: true,
    });

    this._points = new THREE.Points(this._geo, this._mat);
    this._points.frustumCulled = false;
    this._points.visible = false;
    parent.add(this._points);
  }

  _buildTex() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.45, 'rgba(220,230,235,0.38)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  burst() {
    this._active = true;
    this._points.visible = true;

    for (let i = 0; i < this._N; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 12;
      this._pos[i*3] = Math.cos(angle) * radius;
      this._pos[i*3+1] = 1 + Math.random() * 5;
      this._pos[i*3+2] = DELUGE_Z_CENTER_OFFSET_M + Math.sin(angle) * radius + Math.random() * DELUGE_Z_RADIUS_M;

      const speed = 7 + Math.random() * 24;
      this._vel[i].set(
        Math.cos(angle) * speed,
        4 + Math.random() * 13,
        Math.sin(angle) * speed + (Math.random() - 0.5) * 12
      );

      this._age[i] = 0;
      this._life[i] = 2.2 + Math.random() * 2.4;
      this._col[i*3] = 0.72;
      this._col[i*3+1] = 0.78;
      this._col[i*3+2] = 0.82;
    }

    this._posAttr.needsUpdate = true;
    this._colAttr.needsUpdate = true;
  }

  update(dt) {
    if (!this._active) return;

    let live = 0;
    for (let i = 0; i < this._N; i++) {
      if (this._age[i] < 0) continue;

      this._age[i] += dt;
      const t = this._age[i] / this._life[i];
      if (t >= 1) {
        this._age[i] = -1;
        this._col[i*3] = 0;
        this._col[i*3+1] = 0;
        this._col[i*3+2] = 0;
        continue;
      }

      live++;
      const v = this._vel[i];
      this._pos[i*3] += v.x * dt;
      this._pos[i*3+1] += v.y * dt;
      this._pos[i*3+2] += v.z * dt;
      v.multiplyScalar(0.992);
      v.y += 2.8 * dt;

      const fade = (1 - t) * 0.82;
      this._col[i*3] = fade;
      this._col[i*3+1] = fade * 0.96;
      this._col[i*3+2] = fade * 0.9;
    }

    this._posAttr.needsUpdate = true;
    this._colAttr.needsUpdate = true;
    if (live === 0) this.reset();
  }

  reset() {
    this._active = false;
    this._age.fill(-1);
    this._col.fill(0);
    this._points.visible = false;
    this._colAttr.needsUpdate = true;
  }
}
