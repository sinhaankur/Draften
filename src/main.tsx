import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./App";
import { registerBuiltins } from "./plugins/builtins";
import "./index.css";

// Register built-in plugins (importers, AI providers) before the app mounts.
registerBuiltins();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
