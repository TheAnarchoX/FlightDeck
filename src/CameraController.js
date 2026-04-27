import * as THREE from 'three';

// Camera views
const VIEWS = ['PAD', 'LAUNCH', 'CHASE', 'ORBIT', 'WIDE'];

export class CameraController {
  constructor(camera, rocket) {
    this._cam    = camera;
    this._rocket = rocket;
    this._view   = 'PAD';
    this._follow = true;
    this._firstFrame = true; // snap camera on first update

    // Orbit state (for PAD view)
    this._orbitAngle  = -0.6; // radians horizontal — nice 3/4 angle
    this._orbitPhi    = 0.55; // radians from y-axis — mid-height
    this._orbitRadius = 190;  // metres — far enough to see the full 70 m rocket

    // Smooth targets (initialised in first update)
    this._targetPos  = new THREE.Vector3();
    this._targetLook = new THREE.Vector3(0, 40, 0);

    // Mouse drag for pad orbit
    this._dragging   = false;
    this._lastMouse  = { x: 0, y: 0 };
    this._setupMouseOrbit();
  }

  _setupMouseOrbit() {
    const canvas = document.getElementById('game-canvas');

    canvas.addEventListener('mousedown', e => {
      this._dragging  = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._orbitAngle += dx * 0.005;
      this._orbitPhi    = Math.max(0.1, Math.min(1.4, this._orbitPhi + dy * 0.004));
      this._lastMouse   = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mouseup',   () => { this._dragging = false; });
    canvas.addEventListener('mouseleave',() => { this._dragging = false; });

    canvas.addEventListener('wheel', e => {
      this._orbitRadius = Math.max(40, Math.min(500, this._orbitRadius + e.deltaY * 0.15));
    });
  }

  setView(name) {
    if (VIEWS.includes(name)) {
      this._view = name;
      this._firstFrame = true;
    }
  }

  cycleView() {
    const idx  = VIEWS.indexOf(this._view);
    this._view = VIEWS[(idx + 1) % VIEWS.length];
    this._firstFrame = true; // snap to new view immediately
  }

  toggleFollow() { this._follow = !this._follow; }

  // ── Per-frame update ──────────────────────────────────────────────────────
  update(dt, physState) {
    const rocketPos = this._rocket.group.position.clone();
    const alt       = physState.altitude;

    let desiredPos, lookAt;

    switch (this._view) {

      // ── Static pad orbit (mouse-draggable) ──────────────────────────────
      case 'PAD': {
        const r  = this._orbitRadius;
        const px = r * Math.sin(this._orbitPhi) * Math.cos(this._orbitAngle);
        const py = r * Math.cos(this._orbitPhi) + 15;
        const pz = r * Math.sin(this._orbitPhi) * Math.sin(this._orbitAngle);
        desiredPos = new THREE.Vector3(px, py, pz);
        lookAt     = new THREE.Vector3(0, 38, 0); // look at mid-rocket
        break;
      }

      // ── Launch: camera stays at ground level, watches rocket rise ────────
      case 'LAUNCH': {
        const d = Math.max(100, Math.min(400, 100 + alt * 0.004));
        desiredPos = new THREE.Vector3(
          -d * 0.55,
          Math.max(12, rocketPos.y * 0.28 + 12),
          d * 0.75
        );
        lookAt = rocketPos.clone().add(new THREE.Vector3(0, 10, 0));
        break;
      }

      // ── Chase: tight follow from behind and slightly below ────────────────
      case 'CHASE': {
        const offset = new THREE.Vector3(0, -10, 30)
          .applyQuaternion(this._rocket.group.quaternion);
        desiredPos = rocketPos.clone().add(offset);
        lookAt     = rocketPos.clone().add(new THREE.Vector3(0, 8, 0));
        break;
      }

      // ── Orbit: wide-arc follow at medium altitude ─────────────────────────
      case 'ORBIT': {
        this._orbitAngle += 0.0015; // slow auto-rotate
        const r  = Math.max(100, alt * 0.12 + 100);
        desiredPos = new THREE.Vector3(
          rocketPos.x + r * Math.cos(this._orbitAngle),
          rocketPos.y + r * 0.35,
          rocketPos.z + r * Math.sin(this._orbitAngle)
        );
        lookAt = rocketPos.clone();
        break;
      }

      // ── Wide: pulls far back to show full trajectory ──────────────────────
      case 'WIDE': {
        const dist = Math.max(250, alt * 0.4 + 250);
        desiredPos = new THREE.Vector3(
          -dist * 0.4,
          rocketPos.y + dist * 0.25,
          dist * 0.85
        );
        lookAt = rocketPos.clone();
        break;
      }

      default:
        desiredPos = new THREE.Vector3(0, 60, 120);
        lookAt     = new THREE.Vector3(0, 40, 0);
    }

    // On first frame (or after setView), snap immediately; then lerp
    if (this._firstFrame) {
      this._targetPos.copy(desiredPos);
      this._targetLook.copy(lookAt);
      this._firstFrame = false;
    }

    // Smooth camera interpolation
    const speed = this._view === 'PAD' ? 6 : 3.5;
    this._targetPos.lerp(desiredPos, speed * dt);
    this._targetLook.lerp(lookAt,   speed * dt);

    this._cam.position.copy(this._targetPos);
    this._cam.lookAt(this._targetLook);
  }
}
