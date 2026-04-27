import * as THREE from 'three';

// ── Launch complex geometry (LC-39A inspired) ─────────────────────────────────
export class Launchpad {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this._mountY = 9; // world Y where rocket base sits
  }

  init() {
    this._buildAll();
    this.scene.add(this.group);
  }

  getRocketMountPosition() {
    return new THREE.Vector3(0, this._mountY, 0);
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
}
