// ── HUD — DOM telemetry overlay ───────────────────────────────────────────────

const $ = id => document.getElementById(id);
const MAX_TELEMETRY_SAMPLES = 180;

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
    this._graph = $('telemetry-graph');
    this._graphCtx = this._graph?.getContext('2d');
    this._samples = [];
    this._sampleTimer = 0;
    this._tipTimer = 0;
  }

  reset() {
    $('alt-val').textContent    = '0.0';
    $('alt-km').textContent     = '0.000 km';
    $('range-km').textContent   = '0.00 km downrange';
    $('alt-unit').textContent   = 'm';
    $('vel-val').textContent    = '0.0';
    $('vel-kmh').textContent    = '0 km/h';
    $('vel-components').textContent = 'V:0 · H:0 m/s';
    $('gf-val').textContent     = '1.00';
    $('accel-ms2').textContent  = '0.00 m/s²';
    $('fuel-val').textContent   = '100.0';
    $('fuel-bar').style.width   = '100%';
    $('stage-val').textContent  = 'S1';
    $('thr-val').textContent    = '0';
    $('thr-bar').style.width    = '0%';
    if ($('touch-throttle')) $('touch-throttle').value = '0';
    $('dynp-val').textContent   = '0.0';
    $('dynp-status').textContent = 'NOMINAL';
    $('dynp-status').className  = '';
    $('met').textContent        = 'T- 00:00:10';
    $('mission-phase').textContent = 'PRE-LAUNCH';
    $('btn-launch').textContent = 'LAUNCH';
    if (this._eventLog) this._eventLog.innerHTML = '';
    this._samples = [];
    this._sampleTimer = 0;
    this._drawGraph();
    const tip = $('edu-tip');
    if (tip) tip.classList.remove('vis');
  }

  update(dt, s, state, missionTime) {
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
    $('range-km').textContent = `${fmt((s.downrange ?? 0) / 1000, 2)} km downrange`;

    // ── Velocity ────────────────────────────────────────────────────────────
    const vel = s.velocity;
    $('vel-val').textContent  = fmt(vel, 1);
    $('vel-kmh').textContent  = `${fmt(vel * 3.6, 0)} km/h`;
    $('vel-components').textContent = `V:${fmt(s.verticalVelocity ?? vel, 0)} · H:${fmt(s.horizontalVelocity ?? 0, 0)} m/s`;

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
    if ($('touch-throttle') && document.activeElement !== $('touch-throttle')) {
      $('touch-throttle').value = String(thrPct);
    }

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
    this._updateGraph(dt, s, missionTime, state);
    this._updateTip(dt);
  }

  showTip(id) {
    const tips = {
      countdown: {
        title: 'DID YOU KNOW?',
        body: 'The final countdown arms sound suppression, clears the pad, and commits the vehicle to an automated launch sequence.',
      },
      maxq: {
        title: 'MAX-Q',
        body: 'Max-Q is peak aerodynamic stress. Rockets often throttle down here to protect the airframe.',
      },
      staging: {
        title: 'WHY STAGE?',
        body: 'Dropping empty tanks removes dead weight, giving the upper stage a much better mass ratio.',
      },
      'upper-atmosphere': {
        title: 'THIN AIR',
        body: 'Above most of the atmosphere, drag fades and engines perform closer to their vacuum rating.',
      },
      target: {
        title: 'TARGET ALTITUDE',
        body: 'Altitude alone is not orbit: the vehicle still needs enough horizontal speed to keep falling around Earth.',
      },
    };
    const tip = tips[id];
    const el = $('edu-tip');
    if (!tip || !el) return;
    $('edu-tip-title').textContent = tip.title;
    $('edu-tip-body').textContent = tip.body;
    el.classList.add('vis');
    this._tipTimer = 8;
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

  _updateGraph(dt, s, missionTime, state) {
    if (!this._graphCtx) return;
    if (state === 'IDLE') {
      this._drawGraph();
      return;
    }

    this._sampleTimer += dt;
    if (this._sampleTimer < 0.25) return;
    this._sampleTimer = 0;
    this._samples.push({
      t: Math.max(0, missionTime),
      alt: Math.max(0, s.altitude),
      vel: Math.max(0, s.velocity),
    });
    while (this._samples.length > MAX_TELEMETRY_SAMPLES) this._samples.shift();
    this._drawGraph();
  }

  _drawGraph() {
    if (!this._graphCtx || !this._graph) return;
    const ctx = this._graphCtx;
    const w = this._graph.width;
    const h = this._graph.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 8, 20, 0.74)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += w / 4) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += h / 3) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    this._plotMetric('alt', '#00e5ff', h * 0.88);
    this._plotMetric('vel', '#ff7700', h * 0.62);

    ctx.font = '10px Courier New, monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.fillText('ALT', 8, 14);
    ctx.fillStyle = '#ff7700';
    ctx.fillText('VEL', 44, 14);
  }

  _plotMetric(key, color, fallbackMax) {
    const ctx = this._graphCtx;
    const samples = this._samples;
    if (!samples.length) return;
    const w = this._graph.width;
    const h = this._graph.height;
    const max = Math.max(fallbackMax, ...samples.map(s => s[key]));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    samples.forEach((sample, i) => {
      const x = samples.length === 1 ? 0 : (i / (samples.length - 1)) * w;
      const y = h - Math.min(1, sample[key] / max) * (h - 18) - 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  _updateTip(dt) {
    if (this._tipTimer <= 0) return;
    this._tipTimer -= dt;
    if (this._tipTimer <= 0) $('edu-tip')?.classList.remove('vis');
  }
}
