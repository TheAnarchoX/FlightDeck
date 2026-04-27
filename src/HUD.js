// ── HUD — DOM telemetry overlay ───────────────────────────────────────────────

const $ = id => document.getElementById(id);

function fmt(n, dec = 1) {
  return n.toFixed(dec);
}

function fmtTime(sec) {
  const s = Math.abs(sec);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const sign = sec < 0 ? 'T- ' : 'T+ ';
  return `${sign}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export class HUD {
  constructor(game) {
    this._game     = game;
    this._eventLog = $('event-log');
    this._maxEvents = 6;
  }

  reset() {
    $('alt-val').textContent    = '0.0';
    $('alt-km').textContent     = '0.000 km';
    $('alt-unit').textContent   = 'm';
    $('vel-val').textContent    = '0.0';
    $('vel-kmh').textContent    = '0 km/h';
    $('gf-val').textContent     = '1.00';
    $('accel-ms2').textContent  = '0.00 m/s²';
    $('fuel-val').textContent   = '100.0';
    $('fuel-bar').style.width   = '100%';
    $('stage-val').textContent  = 'S1';
    $('thr-val').textContent    = '0';
    $('thr-bar').style.width    = '0%';
    $('dynp-val').textContent   = '0.0';
    $('dynp-status').textContent = 'NOMINAL';
    $('dynp-status').className  = '';
    $('met').textContent        = 'T- 00:00:10';
    $('mission-phase').textContent = 'PRE-LAUNCH';
    $('btn-launch').textContent = 'LAUNCH';
    if (this._eventLog) this._eventLog.innerHTML = '';
  }

  update(_dt, s, state, missionTime) {
    // ── Altitude ────────────────────────────────────────────────────────────
    const alt = s.altitude;
    if (alt >= 1000) {
      $('alt-val').textContent  = fmt(alt / 1000, 2);
      $('alt-unit').textContent = 'km';
    } else {
      $('alt-val').textContent  = fmt(alt, 1);
      $('alt-unit').textContent = 'm';
    }
    $('alt-km').textContent = `${fmt(alt / 1000, 3)} km`;

    // ── Velocity ────────────────────────────────────────────────────────────
    const vel = s.velocity;
    $('vel-val').textContent  = fmt(vel, 1);
    $('vel-kmh').textContent  = `${fmt(vel * 3.6, 0)} km/h`;

    // ── G-Force ─────────────────────────────────────────────────────────────
    const g = s.gForce;
    $('gf-val').textContent    = fmt(Math.abs(g), 2);
    $('accel-ms2').textContent = `${fmt(s.acceleration, 2)} m/s²`;

    // Colour-code g-force
    const gEl = $('gf-val');
    if (Math.abs(g) > 4)      gEl.style.color = 'var(--c-danger)';
    else if (Math.abs(g) > 2.5) gEl.style.color = 'var(--c-warning)';
    else                       gEl.style.color = '';

    // ── Fuel ────────────────────────────────────────────────────────────────
    const fuelPct = s.fuelRatio * 100;
    $('fuel-val').textContent  = fmt(fuelPct, 1);
    $('fuel-bar').style.width  = `${Math.max(0, fuelPct)}%`;

    // Colour fuel bar
    const fuelBar = $('fuel-bar');
    if (fuelPct < 10)       fuelBar.style.background = 'var(--c-danger)';
    else if (fuelPct < 25)  fuelBar.style.background = 'var(--c-warning)';
    else                    fuelBar.style.background = '';

    // ── Stage / Throttle ─────────────────────────────────────────────────────
    $('stage-val').textContent = `S${s.stage}`;
    const thrPct = Math.round(s.throttle * 100);
    $('thr-val').textContent   = thrPct;
    $('thr-bar').style.width   = `${thrPct}%`;

    // ── Dynamic pressure ─────────────────────────────────────────────────────
    const qkPa = s.dynamicPressure / 1000;
    $('dynp-val').textContent = fmt(qkPa, 1);

    const dynpStatus = $('dynp-status');
    if (qkPa > 45) {
      dynpStatus.textContent = 'MAX-Q ⚠';
      dynpStatus.className   = 'maxq-flash';
    } else {
      dynpStatus.textContent = qkPa > 20 ? 'HIGH Q' : 'NOMINAL';
      dynpStatus.className   = '';
    }

    // ── MET clock ────────────────────────────────────────────────────────────
    let metSec = missionTime;
    if (state === 'IDLE')      metSec = -10;
    if (state === 'COUNTDOWN') metSec = -(this._game._countdown);
    $('met').textContent = fmtTime(metSec);

    // ── Phase label ──────────────────────────────────────────────────────────
    const labels = {
      IDLE:      'PRE-LAUNCH',
      COUNTDOWN: 'TERMINAL COUNT',
      IGNITION:  'IGNITION',
      FLIGHT:    s.stage === 2 ? 'S2 FLIGHT' : 'S1 FLIGHT',
      STAGING:   'STAGE SEPARATION',
      COASTING:  'COAST / FREE-FALL',
    };
    $('mission-phase').textContent = labels[state] ?? state;
  }

  // ── Event log ─────────────────────────────────────────────────────────────
  logEvent(msg, cls = '') {
    if (!this._eventLog) return;
    const div = document.createElement('div');
    div.className   = `ev ${cls}`;
    div.textContent = `› ${msg}`;
    this._eventLog.prepend(div);

    // Keep max N events
    while (this._eventLog.children.length > this._maxEvents) {
      this._eventLog.removeChild(this._eventLog.lastChild);
    }
  }
}
