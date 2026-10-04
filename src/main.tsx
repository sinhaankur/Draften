import React from "react";
import ReactDOM from "react-dom/client";

// Self-hosted fonts — bundled so they ALWAYS render (offline, desktop, no Google
// Fonts dependency). Geist (UI), Geist Mono (code), Source Serif 4 (display),
// Inter (canvas design text). The "amazing fonts", loaded reliably.
import "@fontsource/geist-sans/400.css";
import "@fontsource/geist-sans/500.css";
import "@fontsource/geist-sans/600.css";
import "@fontsource/geist-sans/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource-variable/source-serif-4";
import "@fontsource-variable/inter";

import { Shell } from "./Shell";
import { applyPlatformClass } from "./env";
import { registerBuiltins } from "./plugins/builtins";
import "./index.css";
import "./sketch-tokens.css"; // Sketch's reverse-engineered neutral palette (after index.css so it wins)

// Tag the OS + shell so the window chrome adapts per platform (mac/win/linux/web).
applyPlatformClass();
// Register built-in plugins (importers, AI providers) before the app mounts.
registerBuiltins();
// Re-enable any GitHub-installed plugins the user added (non-blocking).
import("./api/github-plugins").then((m) => m.restoreInstalled()).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Shell />
  </React.StrictMode>,
);
