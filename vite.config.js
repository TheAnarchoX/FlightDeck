import { defineConfig } from 'vite';

// When building for GitHub Pages the workflow sets VITE_BASE_URL=/FlightDeck/
// For local dev / preview it falls back to relative paths.
const base = process.env.VITE_BASE_URL ?? './';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    target: 'esnext',
  },
  server: {
    port: 3000,
    open: false,
  },
});
