import { Game } from './Game.js';

// ── Bootstrap ────────────────────────────────────────────────────────────────
const progress = (pct, msg) => {
  const bar    = document.getElementById('ld-bar');
  const status = document.getElementById('ld-status');
  if (bar)    bar.style.width = `${pct}%`;
  if (status) status.textContent = msg;
};

async function bootstrap() {
  progress(10, 'LOADING THREE.JS...');
  await new Promise(r => setTimeout(r, 100));

  progress(30, 'BUILDING SCENE...');
  const game = new Game();
  window.gameInstance = game;

  progress(55, 'CONSTRUCTING LAUNCH COMPLEX...');
  await game.init();

  progress(85, 'ARMING SYSTEMS...');
  await new Promise(r => setTimeout(r, 200));

  progress(100, 'GO FOR LAUNCH');
  await new Promise(r => setTimeout(r, 400));

  document.getElementById('loading-screen').classList.add('hidden');

  game.start();
}

bootstrap().catch(err => {
  console.error('FlightDeck boot error:', err);
  const s = document.getElementById('ld-status');
  if (s) s.textContent = 'ERROR — CHECK CONSOLE';
});
