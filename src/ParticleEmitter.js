import * as THREE from 'three';

// ── Engine-exhaust particle system ────────────────────────────────────────────
//
// Uses BufferGeometry + PointsMaterial with additive blending so that overlapping
// particles add brightness — works perfectly with the UnrealBloomPass.
export class ParticleEmitter {
  constructor(scene, opts = {}) {
    this.scene   = scene;
    this._active = false;

    const o = {
      count:      opts.count      ?? 2000,
      speed:      opts.speed      ?? 70,
      spread:     opts.spread     ?? 0.3,   // radians half-angle
      lifetime:   opts.lifetime   ?? 1.4,
      size:       opts.size       ?? 4.5,
      startColor: opts.startColor ?? new THREE.Color(0xffffff),
      endColor:   opts.endColor   ?? new THREE.Color(0x220500),
    };
    this._opts = o;

    this._emitPos = new THREE.Vector3();
    this._dir     = new THREE.Vector3(0, -1, 0); // downward

    this._N      = o.count;
    this._pos    = new Float32Array(this._N * 3);
    this._col    = new Float32Array(this._N * 3);
    this._vel    = [];
    this._age    = new Float32Array(this._N).fill(-1);
    this._life   = new Float32Array(this._N);
    this._next   = 0;

    for (let i = 0; i < this._N; i++) this._vel.push(new THREE.Vector3());

    this._buildGPU();
  }

  // ── GPU objects ──────────────────────────────────────────────────────────
  _buildGPU() {
    this._geo = new THREE.BufferGeometry();

    // Position is updated every frame
    this._posAttr = new THREE.BufferAttribute(this._pos, 3);
    this._posAttr.setUsage(THREE.DynamicDrawUsage);
    this._geo.setAttribute('position', this._posAttr);

    // Per-vertex colour carries the alpha baked into blue channel (trick)
    this._colAttr = new THREE.BufferAttribute(this._col, 3);
    this._colAttr.setUsage(THREE.DynamicDrawUsage);
    this._geo.setAttribute('color', this._colAttr);

    // Circular soft-dot texture
    const tex = this._buildTex();

    this._mat = new THREE.PointsMaterial({
      size:            this._opts.size,
      map:             tex,
      alphaMap:        tex,
      vertexColors:    true,
      transparent:     true,
      depthWrite:      false,
      blending:        THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    this._points = new THREE.Points(this._geo, this._mat);
    this._points.frustumCulled = false;
    this.scene.add(this._points);
  }

  _buildTex() {
    const c   = document.createElement('canvas');
    c.width   = 64; c.height = 64;
    const ctx = c.getContext('2d');
    const g   = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0,    'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,180,80,0.8)');
    g.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // ── Public API ───────────────────────────────────────────────────────────
  setActive(v) {
    this._active = v;
    if (!v) {
      this._age.fill(-1);
      this._col.fill(0);
      this._colAttr.needsUpdate = true;
    }
  }

  setEmitPosition(v) { this._emitPos.copy(v); }

  // ── Per-frame update ──────────────────────────────────────────────────────
  update(dt) {
    const { speed, spread, lifetime, startColor, endColor } = this._opts;
    const N = this._N;

    // Spawn new particles when active
    if (this._active) {
      const toSpawn = Math.min(Math.floor(N * 0.35 * dt * 60), N / 4);
      for (let k = 0; k < toSpawn; k++) {
        this._spawn(this._next, speed, spread, lifetime);
        this._next = (this._next + 1) % N;
      }
    }

    // Advance all live particles
    const tmpColor = new THREE.Color();
    for (let i = 0; i < N; i++) {
      if (this._age[i] < 0) continue;

      this._age[i] += dt;
      if (this._age[i] >= this._life[i]) {
        this._age[i]      = -1;
        this._col[i*3]    = 0;
        this._col[i*3+1]  = 0;
        this._col[i*3+2]  = 0;
        continue;
      }

      const t  = this._age[i] / this._life[i]; // 0→1
      const vx = this._vel[i];

      this._pos[i*3]   += vx.x * dt;
      this._pos[i*3+1] += vx.y * dt;
      this._pos[i*3+2] += vx.z * dt;

      // Light drag + slight gravity spread
      vx.y -= 4 * dt;
      vx.multiplyScalar(0.998);

      // Colour & brightness
      tmpColor.copy(startColor).lerp(endColor, t);
      const bright = (1 - t * t);       // quadratic fade
      this._col[i*3]   = tmpColor.r * bright;
      this._col[i*3+1] = tmpColor.g * bright;
      this._col[i*3+2] = tmpColor.b * bright;
    }

    this._posAttr.needsUpdate = true;
    this._colAttr.needsUpdate = true;
  }

  // ── Spawn single particle ─────────────────────────────────────────────────
  _spawn(i, speed, spread, lifetime) {
    // Start at nozzle exit with slight jitter
    this._pos[i*3]   = this._emitPos.x + (Math.random() - 0.5) * 1.2;
    this._pos[i*3+1] = this._emitPos.y + (Math.random() - 0.5) * 0.4;
    this._pos[i*3+2] = this._emitPos.z + (Math.random() - 0.5) * 1.2;

    // Velocity with spread cone (downward)
    const sa   = Math.random() * spread;
    const sr   = Math.random() * Math.PI * 2;
    const sinA = Math.sin(sa);
    const cosA = Math.cos(sa);
    const vx   = sinA * Math.cos(sr);
    const vy   = -cosA;                  // downward
    const vz   = sinA * Math.sin(sr);
    const s    = speed * (0.65 + Math.random() * 0.7);

    this._vel[i].set(vx * s, vy * s, vz * s);

    this._age[i]  = 0;
    this._life[i] = lifetime * (0.75 + Math.random() * 0.5);

    // White-hot at birth
    this._col[i*3]   = 1;
    this._col[i*3+1] = 0.95;
    this._col[i*3+2] = 0.85;
  }
}
