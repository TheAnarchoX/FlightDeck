# FlightDeck — Development Roadmap

> Status: **Foundation / v0.1** — Basic launchpad, pre-built rocket, launch sequence, physics, HUD.

---

## ✅ v0.1 — Foundation (current)

- [x] Three.js + Vite project scaffolding
- [x] WebGL renderer with ACES tone-mapping
- [x] Post-processing: UnrealBloom (engine glow)
- [x] Physically-based sky (Three.js Sky shader + atmospheric scattering)
- [x] Procedural terrain with height variation
- [x] Full 3-D launch complex (FSS tower, service arms, flame trench, water tanks)
- [x] Falcon-9-inspired multi-stage rocket model (procedural geometry)
  - [x] 9-engine Merlin cluster with nozzle bells
  - [x] Engine nozzle glow cones (additive blending)
  - [x] Grid-fin placeholders / landing legs
  - [x] MVac upper-stage vacuum engine
  - [x] Fairing/nose cone
- [x] Additive particle exhaust system (3 500 particles, bloom-reactive)
- [x] 1-D rocket physics engine (RK4 integration)
  - [x] Variable gravity (inverse-square law)
  - [x] Exponential atmosphere model
  - [x] Aerodynamic drag (Cd × frontal area)
  - [x] Fuel consumption / mass decrease
  - [x] Vacuum thrust correction
- [x] Two-stage separation (visual + physics)
- [x] Flight milestones: Max-Q, upper-atmosphere transition
- [x] Mission-control HUD (altitude, velocity, g-force, fuel, stage, dynamic pressure)
- [x] MET countdown clock (T- / T+)
- [x] Keyboard controls (Space, ↑↓ throttle, C camera, R reset)
- [x] 5-view camera system (PAD orbit, LAUNCH track, CHASE, ORBIT, WIDE)
- [x] Mouse-drag pad orbit + scroll zoom
- [x] Event log strip
- [x] Loading screen

---

## 🔧 v0.2 — Polish & Education Layer

- [x] 3-D model improvements (normal maps, decal textures for "FALCON" lettering)
- [x] Realistic launch-pad hold-down arm animation (swing out at T-0)
- [x] Water deluge system (steam particle burst at ignition)
- [x] Sound system (engine roar, countdown beeps, stage-sep bang) — Web Audio API
- [x] Gravity-turn pitch programme (2-D trajectory, not just 1-D)
- [x] Telemetry graph: velocity vs time, altitude vs time (canvas overlay)
- [x] "Did you know?" pop-up panels tied to flight events
  - e.g. "At Max-Q the aerodynamic load on Falcon 9 is ~3 300 kN"
- [x] Mobile touch controls (virtual throttle slider + launch button)
- [x] Settings panel: engine count, payload mass, orbit target altitude

---

## 🚀 v0.3 — 2-D Trajectory & Map View

- [ ] Full 2-D trajectory simulation (horizontal + vertical velocity components)
- [ ] Pitch/yaw control by player (WASD steers)
- [ ] Orbit map overlay (mini-map showing trajectory arc and target orbit)
- [ ] Apoapsis / periapsis display
- [ ] Re-entry interface (angle of attack, heat shield temp display)
- [ ] Simple landing legs animation (deploy on descent)
- [ ] First-stage boostback + landing burn (SpaceX-style)

---

## 🌍 v0.4 — World & Multiple Launch Sites

- [ ] Spherical Earth model (switch to planet-scale scene at high altitude)
- [ ] Multiple launch sites: KSC LC-39A, Vandenberg SLC-4E, Boca Chica Starbase
- [ ] Cloud layer (billboard sprite system)
- [ ] Day/night cycle driven by real UTC time
- [ ] City lights on night side

---

## 🛰 v0.5 — Rocket Builder

- [ ] Drag-and-drop rocket assembly UI
  - [ ] Fuel tank types (LOX/kerosene, LOX/LH2, hypergolic, solid)
  - [ ] Engine catalogue (Merlin, Raptor, RL-10, Vulcain 2, RD-180, SSME, Rutherford…)
  - [ ] Fairing / payload module selection
  - [ ] Grid fins, landing legs toggles
- [ ] Real-time Δv budget display (Tsiolkovsky rocket equation)
- [ ] Structural integrity simulation (TWR at liftoff, max-q stress)
- [ ] Save / load custom rocket designs (localStorage)

---

## 🎓 v0.6 — Education Module

- [ ] Interactive lessons:
  - [ ] "What is specific impulse (Isp)?"
  - [ ] "The Tsiolkovsky Rocket Equation"
  - [ ] "Staging and why it matters"
  - [ ] "Orbital mechanics: Hohmann transfer"
  - [ ] "Atmospheric re-entry physics"
  - [ ] "Propellant types: pros and cons"
- [ ] Lesson gates: unlock rocket parts as you complete lessons
- [ ] Quiz mini-games after each lesson
- [ ] Glossary panel (hover any HUD term → tooltip explanation)

---

## 🌐 v0.7 — Missions & Scenarios

- [ ] Mission selection screen (inspired by KSP)
  - [ ] Mission 1: Reach 100 km (Kármán line)
  - [ ] Mission 2: Achieve stable Low Earth Orbit
  - [ ] Mission 3: Land first stage on drone ship
  - [ ] Mission 4: Deploy payload to GTO
  - [ ] Mission 5: Lunar free-return trajectory
- [ ] Scoring system: Δv efficiency, landing accuracy, mission time
- [ ] Leaderboard (optional, anonymous)

---

## 🔬 v0.8 — Advanced Physics & Engines

- [ ] Multi-engine gimbal (thrust vector control)
- [ ] Propellant cross-feed
- [ ] Ullage motors / RCS thrusters
- [ ] Aerobraking and heat shield ablation
- [ ] Solid rocket booster strap-ons (SRB jettison)
- [ ] Nuclear thermal propulsion tech-tree option
- [ ] Ion engine (low-thrust, high-Isp) for deep-space missions

---

## 🎮 v0.9 — UX & Accessibility

- [ ] Full gamepad support (Xbox / DualSense mapping)
- [ ] Colour-blind friendly HUD palettes
- [ ] Multi-language support (i18n)
- [ ] Accessibility: screen-reader telemetry announcements
- [ ] Tutorial overlay with animated arrows for new players

---

## 🏁 v1.0 — Release

- [ ] All v0.x milestones complete and stable
- [ ] PWA manifest (offline play, installable)
- [ ] WebGPU renderer path (Three.js WebGPURenderer) as opt-in high-perf mode
- [ ] Full test suite (Vitest unit tests for physics engine)
- [ ] CI/CD pipeline (GitHub Actions → GitHub Pages deploy)
- [ ] Complete "Rocketry 101" curriculum (10 lessons)
- [ ] Press kit and project README polish

---

## 💡 Future / Nice-to-Have (post v1.0)

- [ ] Multiplayer: race to orbit with friends
- [ ] Procedurally generated alien planets
- [ ] Space station docking mini-game
- [ ] VR / AR mode (WebXR)
- [ ] Real launch data import (parse NASA TLE / SpaceX telemetry streams)
