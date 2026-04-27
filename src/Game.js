import * as THREE from 'three';
import { SceneManager }     from './SceneManager.js';
import { World }             from './World.js';
import { Launchpad }         from './Launchpad.js';
import { Rocket }            from './Rocket.js';
import { PhysicsEngine }     from './PhysicsEngine.js';
import { CameraController }  from './CameraController.js';
import { HUD }               from './HUD.js';
import { CONFIG }            from './config.js';

// ── Game states ───────────────────────────────────────────────────────────────
const STATE = {
  IDLE:       'IDLE',
  COUNTDOWN:  'COUNTDOWN',
  IGNITION:   'IGNITION',
  FLIGHT:     'FLIGHT',
  STAGING:    'STAGING',
  COASTING:   'COASTING',
};

export class Game {
  constructor() {
    this.state       = STATE.IDLE;
    this.missionTime = 0;
    this._countdown  = 10;
    this._clock      = new THREE.Clock(false);
    this._accumulator = 0;

    // flags
    this._maxQLogged   = false;
    this._starsLogged  = false;
    this._stagingTimer = 0;
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  async init() {
    this.sceneMgr  = new SceneManager();
    await this.sceneMgr.init();

    this.world     = new World(this.sceneMgr.scene);
    this.world.init();

    this.launchpad = new Launchpad(this.sceneMgr.scene);
    this.launchpad.init();

    this.rocket    = new Rocket(this.sceneMgr.scene);
    this.rocket.init();
    this.rocket.setOnLaunchpad(this.launchpad.getRocketMountPosition());

    this.physics   = new PhysicsEngine();
    this.camera    = new CameraController(this.sceneMgr.camera, this.rocket);
    this.camera.setView('PAD');
    this.hud       = new HUD(this);

    this._setupInput();
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  _setupInput() {
    document.addEventListener('keydown', e => {
      switch (e.code) {
        case 'Space':        e.preventDefault(); this.triggerLaunch(); break;
        case 'ArrowUp':
        case 'KeyW':         this.physics.adjustThrottle(+0.1);  break;
        case 'ArrowDown':
        case 'KeyS':         this.physics.adjustThrottle(-0.1);  break;
        case 'KeyC':         this.cycleCam();     break;
        case 'KeyR':         this.reset();        break;
        case 'KeyF':         this.camera.toggleFollow(); break;
      }
    });
  }

  // ── Public API (called by HUD buttons) ────────────────────────────────────
  triggerLaunch() {
    if (this.state === STATE.IDLE) {
      this._beginCountdown();
    } else if ([STATE.COUNTDOWN, STATE.FLIGHT, STATE.STAGING, STATE.COASTING].includes(this.state)) {
      this._abort();
    }
  }

  cycleCam() { this.camera.cycleView(); }

  reset() {
    this.state       = STATE.IDLE;
    this.missionTime = 0;
    this._countdown  = 10;
    this._maxQLogged  = false;
    this._starsLogged = false;

    this.physics.reset();
    this.rocket.reset();
    this.rocket.setOnLaunchpad(this.launchpad.getRocketMountPosition());
    this.camera.setView('PAD');
    this.hud.reset();

    const overlay = document.getElementById('countdown-overlay');
    overlay.classList.remove('vis');
    overlay.textContent = '';
    document.getElementById('btn-launch').textContent = 'LAUNCH';
    document.getElementById('launch-seq-display').textContent = '';
  }

  // ── Internal state transitions ────────────────────────────────────────────
  _beginCountdown() {
    this.state      = STATE.COUNTDOWN;
    this._countdown = 10;
    document.getElementById('btn-launch').textContent = 'ABORT';
    this.hud.logEvent('LAUNCH SEQUENCE INITIATED', 'ok');
    this.hud.logEvent('TERMINAL COUNT: T-10', 'ok');
  }

  _abort() {
    this.hud.logEvent('LAUNCH ABORT COMMANDED', 'err');
    this.reset();
  }

  _ignite() {
    this.state = STATE.FLIGHT;
    this.physics.ignite();
    this.rocket.igniteEngines();
    this.camera.setView('LAUNCH');
    this.hud.logEvent('MAIN ENGINE START', 'ok');
    this.hud.logEvent('LIFTOFF! WE HAVE LIFTOFF!', 'ok');
    document.getElementById('launch-seq-display').textContent = '';
  }

  _stageSeparation() {
    this.state = STATE.STAGING;
    this._stagingTimer = 3.0;
    this.physics.cutEngines();
    this.physics.performStaging(); // advances physics stage to 2
    this.rocket.performStaging();
    this.hud.logEvent('MECO — MAIN ENGINE CUTOFF', 'ok');
    this.hud.logEvent('STAGE 1 SEPARATION', 'ok');
  }

  _stage2Ignition() {
    this.state = STATE.FLIGHT;
    this.physics.igniteStage2();
    this.rocket.igniteStage2();
    this.hud.logEvent('MVac ENGINE START', 'ok');
  }

  // ── Game Loop ─────────────────────────────────────────────────────────────
  start() {
    this._clock.start();
    requestAnimationFrame(ts => this._loop(ts));
  }

  _loop(ts) {
    requestAnimationFrame(nts => this._loop(nts));

    const raw = this._clock.getDelta();
    const dt  = Math.min(raw, 0.05); // cap at 50 ms to avoid spiral-of-death

    this._accumulator += dt;
    const FDT = CONFIG.FIXED_TIMESTEP;

    while (this._accumulator >= FDT) {
      this._fixedUpdate(FDT);
      this._accumulator -= FDT;
    }

    const physState = this.physics.getState();
    this._variableUpdate(dt, physState);
    this.sceneMgr.render();
  }

  // ── Fixed-rate physics/logic update ──────────────────────────────────────
  _fixedUpdate(dt) {
    switch (this.state) {
      case STATE.COUNTDOWN:
        this._tickCountdown(dt);
        break;

      case STATE.FLIGHT:
        this.missionTime += dt;
        this.physics.update(dt);
        this._checkMilestones();
        break;

      case STATE.STAGING:
        this.missionTime   += dt;
        this._stagingTimer -= dt;
        this.physics.update(dt); // coasting during staging
        if (this._stagingTimer <= 0) this._stage2Ignition();
        break;

      case STATE.COASTING:
        this.missionTime += dt;
        this.physics.update(dt);
        break;
    }
  }

  // ── Variable-rate visual/camera update ───────────────────────────────────
  _variableUpdate(dt, physState) {
    this.rocket.update(dt, physState);
    this.world.update(dt, physState.altitude);
    this.camera.update(dt, physState);
    this.hud.update(dt, physState, this.state, this.missionTime);
    this.sceneMgr.updateAtmosphere(physState.altitude);
  }

  // ── Countdown ticker ──────────────────────────────────────────────────────
  _tickCountdown(dt) {
    this._countdown -= dt;
    const overlay = document.getElementById('countdown-overlay');
    const display = document.getElementById('launch-seq-display');
    const tick    = Math.ceil(this._countdown);

    if (this._countdown > 0) {
      overlay.textContent = tick;
      overlay.classList.add('vis');
      display.textContent = `T- 00:00:${String(tick).padStart(2, '0')}`;
    } else {
      overlay.textContent = 'IGNITION';
      display.textContent = 'IGNITION';
      this.state = STATE.IGNITION; // freeze countdown logic
      setTimeout(() => {
        overlay.classList.remove('vis');
        overlay.textContent = '';
        this._ignite();
      }, 1400);
    }
  }

  // ── Flight milestones ─────────────────────────────────────────────────────
  _checkMilestones() {
    const s = this.physics.getState();

    if (!this._maxQLogged && s.altitude > 8_000 && s.dynamicPressure > 40_000) {
      this.hud.logEvent('MAX-Q — MAXIMUM DYNAMIC PRESSURE', 'warn');
      this._maxQLogged = true;
    }

    if (!this._starsLogged && s.altitude > 80_000) {
      this.hud.logEvent('ENTERING UPPER ATMOSPHERE', 'ok');
      this._starsLogged = true;
    }

    // Stage 1 burnout
    if (this.physics.stage === 1 && s.fuelRatio <= 0 && this.state === STATE.FLIGHT) {
      this._stageSeparation();
    }

    // Stage 2 burnout
    if (this.physics.stage === 2 && s.fuelRatio <= 0 && this.state === STATE.FLIGHT) {
      this.state = STATE.COASTING;
      this.hud.logEvent('SECO — SECOND ENGINE CUTOFF', 'ok');
      this.rocket.cutEngines();
    }
  }
}
