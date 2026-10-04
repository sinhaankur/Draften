import { App } from "./App";
import { ErrorBoundary } from "./ui/ErrorBoundary";

/**
 * Shell — one app, one experience.
 *
 * There is no "design preview" mode and no static mockup toggle. The functional
 * React app IS Draften — full stop. (The v2 mockup lives only in docs/ as a
 * build-time design reference; it is never shown to the user.)
 *
 * Wrapped in an ErrorBoundary so a single runtime error is caught + shown with a
 * reload, never leaving the packaged app blank or "everything broken".
 */
export function Shell() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
