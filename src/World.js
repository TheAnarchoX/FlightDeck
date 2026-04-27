import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// ── World: sky, terrain, lighting, stars ─────────────────────────────────────
export class World {
  constructor(scene) {
    this.scene        = scene;
    this._sky         = null;
    this._stars       = null;
    this._sunDir      = new THREE.Vector3();
    this._starsTarget = 0;
    this._starsAlpha  = 0;
  }

  init() {
    this._buildLighting();
    this._buildSky();
    this._buildTerrain();
    this._buildStars();
    this._buildDistantMountains();
  }

  // ── Lighting ──────────────────────────────────────────────────────────────
  _buildLighting() {
    // Ambient sky fill
    this.scene.add(new THREE.AmbientLight(0x6688aa, 0.32));

    // Hemisphere (sky blue / ground green)
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3d6622, 0.5));

    // Directional sun with shadows
    this._sun = new THREE.DirectionalLight(0xfff4dd, 2.8);
    this._sun.position.set(-600, 900, -1200);
    this._sun.castShadow = true;
    const s = this._sun.shadow;
    s.mapSize.set(4096, 4096);
    s.camera.near   = 1;
    s.camera.far    = 4000;
    s.camera.left   = -600;
    s.camera.right  = 600;
    s.camera.top    = 600;
    s.camera.bottom = -600;
    s.bias          = -0.0005;
    this.scene.add(this._sun);
    this.scene.add(this._sun.target); // default target at origin
  }

  // ── Sky ───────────────────────────────────────────────────────────────────
  _buildSky() {
    this._sky = new Sky();
    this._sky.scale.setScalar(450_000);
    this.scene.add(this._sky);
    this._applySkyParams({ turbidity: 2.6, rayleigh: 0.34, elevation: 24, azimuth: 205 });
  }

  _applySkyParams({ turbidity, rayleigh, elevation, azimuth }) {
    const u = this._sky.material.uniforms;
    u['turbidity'].value          = turbidity;
    u['rayleigh'].value           = rayleigh;
    u['mieCoefficient'].value     = 0.0018;
    u['mieDirectionalG'].value    = 0.86;

    const phi   = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    this._sunDir.setFromSphericalCoords(1, phi, theta);
    u['sunPosition'].value.copy(this._sunDir);
  }

  // ── Terrain ───────────────────────────────────────────────────────────────
  _buildTerrain() {
    // Main ground
    const SIZE = 24_000;
    const SEGS = 80;
    const geo  = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);

    // Procedural height — keep launchpad area flat
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getY(i); // pre-rotation y == z
      const d = Math.sqrt(x * x + z * z);
      if (d > 600) {
        const h = Math.sin(x * 0.0015) * Math.cos(z * 0.002) * 30
                + Math.sin(x * 0.004 + 1.2) * Math.cos(z * 0.0035 + 0.8) * 15;
        pos.setZ(i, h);
      }
    }
    geo.computeVertexNormals();

    const mat  = new THREE.MeshStandardMaterial({ color: 0x3d6622, roughness: 0.95, metalness: 0.0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    // Concrete apron around launchpad
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(90, 90, 0.4, 48),
      new THREE.MeshStandardMaterial({ color: 0x8a8a7e, roughness: 0.9, metalness: 0.05 })
    );
    apron.receiveShadow = true;
    this.scene.add(apron);

    // Perimeter road
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.2, 600),
      new THREE.MeshStandardMaterial({ color: 0x555550, roughness: 0.95 })
    );
    road.position.set(160, 0.1, 260);
    road.rotation.y = Math.PI / 6;
    road.receiveShadow = true;
    this.scene.add(road);
  }

  // ── Distant background mountains ──────────────────────────────────────────
  _buildDistantMountains() {
    const mtMat = new THREE.MeshStandardMaterial({ color: 0x4a6040, roughness: 1, metalness: 0 });
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist  = 6000 + Math.random() * 3000;
      const h     = 300 + Math.random() * 500;
      const w     = 800 + Math.random() * 600;
      const geo   = new THREE.ConeGeometry(w, h, 6);
      const mesh  = new THREE.Mesh(geo, mtMat);
      mesh.position.set(Math.cos(angle) * dist, h / 2 - 20, Math.sin(angle) * dist);
      mesh.rotation.y = Math.random() * Math.PI;
      this.scene.add(mesh);
    }
  }

  // ── Stars ─────────────────────────────────────────────────────────────────
  _buildStars() {
    const N    = 10_000;
    const geo  = new THREE.BufferGeometry();
    const pos  = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 380_000;
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color:           0xffffff,
      size:            500,
      sizeAttenuation: true,
      transparent:     true,
      opacity:         0,
    }));
    this._stars.frustumCulled = false;
    this.scene.add(this._stars);
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  update(_dt, altitudeM) {
    // Fade stars in above 40 km
    this._starsTarget = altitudeM > 40_000 ? Math.min(1, (altitudeM - 40_000) / 40_000) : 0;
    this._starsAlpha  += (this._starsTarget - this._starsAlpha) * 0.03;
    this._stars.material.opacity = this._starsAlpha;

    // Thin atmosphere as rocket climbs
    if (altitudeM > 5_000) {
      const t   = Math.min(1, altitudeM / 80_000);
      this._applySkyParams({
        turbidity: Math.max(0.1, 2.6  - t * 2.5),
        rayleigh:  Math.max(0.01, 0.34 - t * 0.32),
        elevation: 24,
        azimuth:   205,
      });
    }
  }
}
