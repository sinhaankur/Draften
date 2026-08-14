import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Draften ships two ways from one codebase:
//   • as a WEBSITE on GitHub Pages (a /Draften/ project subpath), and
//   • as a NATIVE desktop app via Tauri (assets loaded relative from the shell).
// The base path differs between the two, so it's env-driven:
//   DEPLOY_TARGET=pages → "/Draften/"   (the Pages CI sets this)
//   default             → "./"          (Tauri + local dev)
const base = process.env.DEPLOY_TARGET === "pages" ? "/Draften/" : "./";

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
  base,
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
