export class AudioSystem {
  constructor() {
    this._ctx = null;
    this._master = null;
    this._engine = null;
    this._engineGain = null;
  }

  resume() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._master = this._ctx.createGain();
      this._master.gain.value = 0.22;
      this._master.connect(this._ctx.destination);
    }
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  beep(freq = 880, duration = 0.08) {
    const ctx = this._ready();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(this._master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  startEngine() {
    const ctx = this._ready();
    if (!ctx || this._engine) return;
    const osc = ctx.createOscillator();
    const rumble = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    rumble.type = 'triangle';
    osc.frequency.value = 54;
    rumble.frequency.value = 27;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.45);
    osc.connect(gain);
    rumble.connect(gain);
    gain.connect(this._master);
    osc.start();
    rumble.start();
    this._engine = [osc, rumble];
    this._engineGain = gain;
  }

  updateEngine(throttle, running) {
    if (!this._engineGain || !this._ctx) return;
    const target = running ? 0.25 + throttle * 0.45 : 0.0001;
    this._engineGain.gain.setTargetAtTime(target, this._ctx.currentTime, 0.08);
  }

  stopEngine() {
    if (!this._engine || !this._ctx) return;
    this._engineGain.gain.setTargetAtTime(0.0001, this._ctx.currentTime, 0.08);
    this._engine.forEach(osc => osc.stop(this._ctx.currentTime + 0.25));
    this._engine = null;
    this._engineGain = null;
  }

  stageBang() {
    const ctx = this._ready();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(36, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.55, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(this._master);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  reset() {
    this.stopEngine();
  }

  _ready() {
    this.resume();
    return this._ctx;
  }
}
