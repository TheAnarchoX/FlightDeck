import { CONFIG } from './config.js';

const G0 = CONFIG.GRAVITY_SEA_LEVEL;
const RE = CONFIG.EARTH_RADIUS;
const P0 = CONFIG.ATM_DENSITY_SL;
const H0 = CONFIG.ATM_SCALE_HEIGHT;

// ── Physics engine (1-D vertical ascent, RK4 integration) ────────────────────
export class PhysicsEngine {
  constructor() {
    this.stage = 1;
    this.reset();
  }

  reset() {
    this.stage = 1;

    // State vector
    this._altitude = 0;   // m
    this._velocity = 0;   // m/s
    this._accel    = 0;   // m/s²

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

    // Consume fuel
    this._burnFuel(dt);

    // Update cached dynamics
    const rho             = this._rho(this._altitude);
    this._dynPressure     = 0.5 * rho * this._velocity * this._velocity;
    this._maxQ            = Math.max(this._maxQ, this._dynPressure);
  }

  // ── Net acceleration (used inside RK4) ────────────────────────────────────
  _accelAt(alt, vel) {
    const mass   = this._totalMass();
    const g      = G0 * Math.pow(RE / (RE + Math.max(0, alt)), 2);
    const rho    = this._rho(alt);
    const thrust = this._thrust(rho);
    const drag   = this._drag(rho, vel);

    return (thrust - mass * g - drag) / mass;
  }

  _rho(alt) {
    return P0 * Math.exp(-Math.max(0, alt) / H0);
  }

  _thrust(rho) {
    if (!this._running || this._throttle <= 0) return 0;
    const cfg  = this.stage === 1 ? CONFIG.ROCKET.STAGE1 : CONFIG.ROCKET.STAGE2;
    // Slight vacuum bonus
    const vacBonus = 1 + (1 - Math.min(1, rho / P0)) * 0.09;
    return this._throttle * cfg.MAX_THRUST * vacBonus;
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
    const flow = (cfg.FUEL_MASS / cfg.BURN_TIME) * this._throttle;

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
           + R.PAYLOAD_MASS;
    }
    return R.STAGE2.DRY_MASS + this._s2Fuel + R.PAYLOAD_MASS;
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

    return {
      altitude:       this._altitude,
      velocity:       this._velocity,
      acceleration:   this._accel,
      gForce:         1 + this._accel / G0,
      mass:           this._totalMass(),
      throttle:       this._throttle,
      fuelRatio:      Math.max(0, fuelRatio),
      fuelRemaining:  fuel,
      stage:          this.stage,
      engineRunning:  this._running,
      dynamicPressure: this._dynPressure,
      maxQ:           this._maxQ,
    };
  }
}
