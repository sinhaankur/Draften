import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { applyPlatformClass } from "./env";
import { registerBuiltins } from "./plugins/builtins";
import "./index.css";

// Tag the OS + shell so the window chrome adapts per platform (mac/win/linux/web).
applyPlatformClass();
// Register built-in plugins (importers, AI providers) before the app mounts.
registerBuiltins();
// Re-enable any GitHub-installed plugins the user added (non-blocking).
import("./api/github-plugins").then((m) => m.restoreInstalled()).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
