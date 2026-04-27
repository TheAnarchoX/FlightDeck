import * as THREE from 'three';

// Camera views
const VIEWS = ['PAD', 'LAUNCH', 'CHASE', 'ORBIT', 'WIDE'];

export class CameraController {
  constructor(camera, rocket) {
    this._cam    = camera;
    this._rocket = rocket;
    this._view   = 'PAD';
    this._follow = true;

    // Smooth targets
    this._targetPos = new THREE.Vector3();
    this._targetLook = new THREE.Vector3();

    // Orbit state (for PAD view)
    this._orbitAngle  = 0.4;  // radians horizontal
    this._orbitPhi    = 0.35; // radians vertical (from y-axis)
    this._orbitRadius = 90;

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
      this._orbitPhi    = Math.max(0.05, Math.min(1.3, this._orbitPhi + dy * 0.004));
      this._lastMouse   = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('mouseup',   () => { this._dragging = false; });
    canvas.addEventListener('mouseleave',() => { this._dragging = false; });

    canvas.addEventListener('wheel', e => {
      this._orbitRadius = Math.max(30, Math.min(400, this._orbitRadius + e.deltaY * 0.1));
    });
  }

  setView(name) {
    if (VIEWS.includes(name)) this._view = name;
  }

  cycleView() {
    const idx  = VIEWS.indexOf(this._view);
    this._view = VIEWS[(idx + 1) % VIEWS.length];
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
        const py = r * Math.cos(this._orbitPhi) + 10;
        const pz = r * Math.sin(this._orbitPhi) * Math.sin(this._orbitAngle);
        desiredPos = new THREE.Vector3(px, py, pz);
        lookAt     = new THREE.Vector3(0, 25, 0);
        break;
      }

      // ── Launch: camera stays low, watches rocket rise ────────────────────
      case 'LAUNCH': {
        const d = Math.max(60, Math.min(300, 60 + alt * 0.003));
        desiredPos = new THREE.Vector3(-d * 0.6, Math.max(15, rocketPos.y * 0.35), d * 0.8);
        lookAt     = rocketPos.clone();
        break;
      }

      // ── Chase: tight follow from behind and slightly below ────────────────
      case 'CHASE': {
        const offset = new THREE.Vector3(0, -8, 25)
          .applyQuaternion(this._rocket.group.quaternion);
        desiredPos = rocketPos.clone().add(offset);
        lookAt     = rocketPos.clone().add(new THREE.Vector3(0, 5, 0));
        break;
      }

      // ── Orbit: wide-arc follow at medium altitude ─────────────────────────
      case 'ORBIT': {
        this._orbitAngle += 0.002; // auto-rotate
        const r  = Math.max(80, alt * 0.15 + 80);
        desiredPos = new THREE.Vector3(
          rocketPos.x + r * Math.cos(this._orbitAngle),
          rocketPos.y + r * 0.4,
          rocketPos.z + r * Math.sin(this._orbitAngle)
        );
        lookAt = rocketPos.clone();
        break;
      }

      // ── Wide: pulls far back to see the curvature illusion ───────────────
      case 'WIDE': {
        const dist = Math.max(200, alt * 0.5 + 200);
        desiredPos = new THREE.Vector3(-dist * 0.5, rocketPos.y + dist * 0.3, dist * 0.9);
        lookAt     = rocketPos.clone();
        break;
      }

      default:
        desiredPos = new THREE.Vector3(0, 50, 90);
        lookAt     = new THREE.Vector3(0, 30, 0);
    }

    // Smooth camera interpolation
    const speed = this._view === 'PAD' ? 5 : 3;
    this._targetPos.lerp(desiredPos, speed * dt);
    this._targetLook.lerp(lookAt,   speed * dt);

    this._cam.position.copy(this._targetPos);
    this._cam.lookAt(this._targetLook);
  }
}
