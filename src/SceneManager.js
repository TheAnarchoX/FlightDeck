import * as THREE from 'three';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';
import { CONFIG }          from './config.js';

export class SceneManager {
  constructor() {
    this.scene    = null;
    this.camera   = null;
    this.renderer = null;
    this.composer = null;
    this._canvas  = document.getElementById('game-canvas');
  }

  async init() {
    this._buildScene();
    this._buildCamera();
    this._buildRenderer();
    this._buildPostProcessing();
    this._buildResizeHandler();
  }

  // ── Scene ─────────────────────────────────────────────────────────────────
  _buildScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x99bbdd, 0.000018);
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  _buildCamera() {
    const { FOV, NEAR, FAR } = CONFIG.CAMERA;
    this.camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, NEAR, FAR);
  }

  // ── Renderer ──────────────────────────────────────────────────────────────
  _buildRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:           this._canvas,
      antialias:        true,
      powerPreference: 'high-performance',
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure  = 1.0;
    this.renderer.outputColorSpace    = THREE.SRGBColorSpace;
  }

  // ── Post-processing ───────────────────────────────────────────────────────
  _buildPostProcessing() {
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Bloom — lights up engine exhausts and emissive materials
    this.bloomPass = new UnrealBloomPass(size, 0.75, 0.45, 0.82);
    this.composer.addPass(this.bloomPass);

    this.composer.addPass(new OutputPass());
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  _buildResizeHandler() {
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    });
  }

  // ── Atmosphere updates (called every frame) ───────────────────────────────
  updateAtmosphere(altitudeM) {
    // Gradually remove fog and crank bloom as we leave the atmosphere
    if (altitudeM < 20_000) {
      const t = altitudeM / 20_000;
      this.scene.fog.density = 0.000018 * (1 - t * 0.6);
      this.bloomPass.strength = 0.75 + t * 0.25;
    } else if (altitudeM < 80_000) {
      const t = (altitudeM - 20_000) / 60_000;
      this.scene.fog.density = 0.000007 * (1 - t);
      this.bloomPass.strength = 1.0 + t * 0.5;
    } else {
      this.scene.fog.density = 0;
      this.bloomPass.strength = 1.8;
    }
  }

  render() {
    this.composer.render();
  }
}
