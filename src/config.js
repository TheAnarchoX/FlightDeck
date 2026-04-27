// ── Game & Physics Constants ──────────────────────────────────────────────────

export const CONFIG = {
  // Rendering
  TARGET_FPS: 60,
  FIXED_TIMESTEP: 1 / 60,

  // Earth
  GRAVITY_SEA_LEVEL: 9.81,   // m/s²
  EARTH_RADIUS:      6_371_000, // m
  ATM_DENSITY_SL:    1.225,  // kg/m³  (sea-level)
  ATM_SCALE_HEIGHT:  8_500,  // m      (barometric scale height)

  // ── Rocket: Falcon-9 Block-5 inspired ──────────────────────────────────────
  ROCKET: {
    DIAMETER: 3.7,   // m

    STAGE1: {
      DRY_MASS:   22_200,   // kg
      FUEL_MASS: 411_000,   // kg
      MAX_THRUST:  7_607_000, // N  (9 × Merlin 1D SL)
      ISP_SL:     282,      // s
      ISP_VAC:    311,      // s
      BURN_TIME:  162,      // s  (approximate)
      HEIGHT:      42.6,    // m  (visual)
    },

    STAGE2: {
      DRY_MASS:    4_900,   // kg
      FUEL_MASS: 107_500,   // kg
      MAX_THRUST:    934_000, // N  (1 × Merlin Vacuum)
      ISP_VAC:    348,      // s
      BURN_TIME:  397,      // s
      HEIGHT:      12.6,    // m  (visual)
    },

    PAYLOAD_MASS: 15_000,   // kg
    FAIRING_HEIGHT: 13.1,   // m  (visual)
  },

  // Camera
  CAMERA: {
    FOV:  60,
    NEAR: 0.5,
    FAR:  2_000_000,
  },
};
