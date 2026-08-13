import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config tuned for Tauri: fixed dev port, no clearing the Rust logs, and
// env-var prefixing so Tauri can inject build-time values.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // don't watch the Rust side from Vite — Tauri owns that
      ignored: ["**/src-tauri/**"],
    },
  },
  // Tauri expects a fixed, relative base so the built assets load from the shell.
  base: "./",
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
