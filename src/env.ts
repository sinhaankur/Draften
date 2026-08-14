/**
 * Runtime environment detection.
 *
 * Draften ships from one codebase as both a **website** (GitHub Pages) and a
 * **native desktop app** (Tauri). Some capabilities exist only in the desktop
 * shell (local file open/save, OmniGraffle plist decode, Apple Intelligence).
 * The app detects where it's running and lights those up only when present —
 * the web build gracefully does without, never pretending.
 */

/** True when running inside the Tauri native shell (vs a plain browser tab). */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri injects these globals; either is a reliable signal across v1/v2.
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI__" in w || "__TAURI_INTERNALS__" in w;
}

/** True when running as the hosted website (no native shell). */
export function isWeb(): boolean {
  return !isTauri();
}

/**
 * Capabilities gate. The UI reads these to show/hide native-only affordances
 * (e.g. "Open .graffle from disk" or the Apple Intelligence AI tier) so the web
 * build never offers something it can't deliver.
 */
export const capabilities = {
  /** native file dialogs + filesystem (Tauri only; web uses the File API) */
  get nativeFiles() {
    return isTauri();
  },
  /** OmniGraffle gzip+plist decode via the Rust command */
  get omnigraffle() {
    return isTauri();
  },
  /** Apple Intelligence on-device model bridge (macOS Tauri build) */
  get appleIntelligence() {
    return isTauri();
  },
} as const;
