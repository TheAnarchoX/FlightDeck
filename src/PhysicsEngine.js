import { CONFIG } from './config.js';

const G0 = CONFIG.GRAVITY_SEA_LEVEL;
const RE = CONFIG.EARTH_RADIUS;
const P0 = CONFIG.ATM_DENSITY_SL;
const H0 = CONFIG.ATM_SCALE_HEIGHT;

// ── Physics engine (2-D gravity-turn ascent, RK4 vertical integration) ────────
export class PhysicsEngine {
  constructor() {
    this.stage = 1;
    this._settings = {
      engineCount: 9,
      payloadMass: CONFIG.ROCKET.PAYLOAD_MASS,
      orbitTargetAltitude: 200_000,
    };
    this.reset();
  }

  reset() {
    this.stage = 1;

    // State vector
    this._altitude = 0;   // m
    this._velocity = 0;   // m/s
    this._downrange = 0;  // m
    this._horizontalVelocity = 0; // m/s
    this._accel    = 0;   // m/s²
    this._horizontalAccel = 0; // m/s²
    this._pitchAngle = 0; // radians from vertical

    // Propellant bookkeeping
    this._s1Fuel = CONFIG.ROCKET.STAGE1.FUEL_MASS;
    this._s2Fuel = CONFIG.ROCKET.STAGE2.FUEL_MASS;

    // Throttle [0, 1]
    this._throttle = 0;
    this._running  = false;

    // Derived / cached
    this._dynPressure = 0;
    this._maxQ        = 0;
  }

  // ── Control ───────────────────────────────────────────────────────────────
  ignite() {
    this._running  = true;
    this._throttle = 1.0;
  }

  igniteStage2() {
    this.stage     = 2; // ensure stage is correct
    this._running  = true;
    this._throttle = 1.0;
  }

  cutEngines() {
    this._running  = false;
    this._throttle = 0;
  }

  adjustThrottle(delta) {
    this._throttle = Math.max(0, Math.min(1, this._throttle + delta));
  }

  setThrottle(value) {
    this._throttle = Math.max(0, Math.min(1, value));
  }

  applySettings(settings) {
    this._settings = {
      ...this._settings,
      engineCount: Math.max(1, Math.min(9, Number(settings.engineCount) || this._settings.engineCount)),
      payloadMass: Math.max(1_000, Math.min(50_000, Number(settings.payloadMass) || this._settings.payloadMass)),
      orbitTargetAltitude: Math.max(100_000, Math.min(500_000, Number(settings.orbitTargetAltitude) || this._settings.orbitTargetAltitude)),
    };
  }

  // ── Integrate one timestep ────────────────────────────────────────────────
  update(dt) {
    // RK4 for velocity & altitude
    const k1 = this._accelAt(this._altitude, this._velocity);
    const k2 = this._accelAt(this._altitude + this._velocity * dt / 2,
                              this._velocity + k1 * dt / 2);
    const k3 = this._accelAt(this._altitude + this._velocity * dt / 2 + k1 * dt * dt / 4,
                              this._velocity + k2 * dt / 2);
    const k4 = this._accelAt(this._altitude + this._velocity * dt,
                              this._velocity + k3 * dt);

    this._accel     = (k1 + 2 * k2 + 2 * k3 + k4) / 6;
    this._velocity += this._accel * dt;
    this._altitude += this._velocity * dt;

    if (this._altitude < 0) { this._altitude = 0; this._velocity = Math.max(0, this._velocity); }

    // Horizontal component for the gravity turn.
    const rho = this._rho(this._altitude);
    const mass = this._totalMass();
    this._pitchAngle = this._pitchForAltitude(this._altitude);
    const hDrag = this._drag(rho, this._horizontalVelocity);
    this._horizontalAccel = (this._thrust(rho) * Math.sin(this._pitchAngle) - hDrag) / mass;
    this._horizontalVelocity += this._horizontalAccel * dt;
    this._downrange += this._horizontalVelocity * dt;

    // Consume fuel
    this._burnFuel(dt);

    // Update cached dynamics
    const speed           = Math.hypot(this._velocity, this._horizontalVelocity);
    this._dynPressure     = 0.5 * rho * speed * speed;
    this._maxQ            = Math.max(this._maxQ, this._dynPressure);
  }

  // ── Net acceleration (used inside RK4) ────────────────────────────────────
  _accelAt(alt, vel) {
    const mass   = this._totalMass();
    const g      = G0 * Math.pow(RE / (RE + Math.max(0, alt)), 2);
    const rho    = this._rho(alt);
    const thrust = this._thrust(rho) * Math.cos(this._pitchForAltitude(alt));
    const drag   = this._drag(rho, vel);

    return (thrust - mass * g - drag) / mass;
  }

  _rho(alt) {
    return P0 * Math.exp(-Math.max(0, alt) / H0);
  }

  _thrust(rho) {
    if (!this._running || this._throttle <= 0) return 0;
    const cfg  = this.stage === 1 ? CONFIG.ROCKET.STAGE1 : CONFIG.ROCKET.STAGE2;
    const engineRatio = this.stage === 1 ? this._settings.engineCount / 9 : 1;
    // Slight vacuum bonus
    const vacBonus = 1 + (1 - Math.min(1, rho / P0)) * 0.09;
    return this._throttle * cfg.MAX_THRUST * vacBonus * engineRatio;
  }

  _pitchForAltitude(alt) {
    if (alt < 500) return 0;
    const t = Math.min(1, (alt - 500) / 90_000);
    const smooth = t * t * (3 - 2 * t);
    return smooth * GRAVITY_TURN_MAX_ANGLE_RAD;
  }

  _drag(rho, vel) {
    if (vel <= 0) return 0;
    const D  = CONFIG.ROCKET.DIAMETER;
    const A  = Math.PI * (D / 2) ** 2;
    const Cd = 0.25;
    return 0.5 * rho * vel * vel * Cd * A;
  }

  _burnFuel(dt) {
    if (!this._running || this._throttle <= 0) return;
    const cfg  = this.stage === 1 ? CONFIG.ROCKET.STAGE1 : CONFIG.ROCKET.STAGE2;
    const engineRatio = this.stage === 1 ? this._settings.engineCount / 9 : 1;
    const flow = (cfg.FUEL_MASS / cfg.BURN_TIME) * this._throttle * engineRatio;

    if (this.stage === 1) {
      this._s1Fuel = Math.max(0, this._s1Fuel - flow * dt);
      if (this._s1Fuel <= 0) this._running = false;
    } else {
      this._s2Fuel = Math.max(0, this._s2Fuel - flow * dt);
      if (this._s2Fuel <= 0) this._running = false;
    }
  }

  _totalMass() {
    const R = CONFIG.ROCKET;
    if (this.stage === 1) {
      return R.STAGE1.DRY_MASS + this._s1Fuel
           + R.STAGE2.DRY_MASS + this._s2Fuel
           + this._settings.payloadMass;
    }
    return R.STAGE2.DRY_MASS + this._s2Fuel + this._settings.payloadMass;
  }

  // ── Stage transition ──────────────────────────────────────────────────────
  performStaging() {
    this.stage     = 2;
    this._running  = false;
    this._throttle = 0;
  }

  // ── State snapshot ────────────────────────────────────────────────────────
  getState() {
    const cfg      = this.stage === 1 ? CONFIG.ROCKET.STAGE1 : CONFIG.ROCKET.STAGE2;
    const fuel     = this.stage === 1 ? this._s1Fuel : this._s2Fuel;
    const fuelRatio = fuel / cfg.FUEL_MASS;
    const speed = Math.hypot(this._velocity, this._horizontalVelocity);

    return {
      altitude:       this._altitude,
      downrange:      this._downrange,
      velocity:       speed,
      verticalVelocity: this._velocity,
      horizontalVelocity: this._horizontalVelocity,
      acceleration:   this._accel,
      horizontalAcceleration: this._horizontalAccel,
      gForce:         1 + this._accel / G0,
      mass:           this._totalMass(),
      throttle:       this._throttle,
      fuelRatio:      Math.max(0, fuelRatio),
      fuelRemaining:  fuel,
      stage:          this.stage,
      engineRunning:  this._running,
      dynamicPressure: this._dynPressure,
      maxQ:           this._maxQ,
      pitchAngle:     this._pitchAngle,
      orbitTargetAltitude: this._settings.orbitTargetAltitude,
    };
  }
}

const GRAVITY_TURN_MAX_ANGLE_RAD = Math.PI * 0.42;
