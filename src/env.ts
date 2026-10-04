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

/** The OS Draften is running on — drives per-platform window chrome. */
export type OS = "macos" | "windows" | "linux" | "web";
export function detectOS(): OS {
  if (typeof navigator === "undefined") return "web";
  // navigator.platform is deprecated + often EMPTY in the Tauri WebKit webview,
  // so check userAgentData + userAgent too (userAgent carries "Macintosh").
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform || "";
  const p = `${navigator.platform || ""} ${uaData}`.toLowerCase();
  const ua = (navigator.userAgent || "").toLowerCase();
  if (/mac|iphone|ipad|darwin/.test(p) || /macintosh|mac os|darwin/.test(ua)) return "macos";
  if (/win/.test(p) || /windows/.test(ua)) return "windows";
  if (/linux|x11|cros/.test(p) || /linux|x11/.test(ua)) return "linux";
  return "web";
}

/** Tag <html> with the OS + shell so CSS can adapt (traffic-light gap on mac
 *  only, native window controls on win/linux, etc.). Call once at startup. */
export function applyPlatformClass(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-os", detectOS());
  root.setAttribute("data-shell", isTauri() ? "desktop" : "web");
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
  /** Apple Intelligence on-device model bridge — macOS ONLY (the API doesn't
   *  exist on Windows/Linux). Everyone else uses WebLLM / LM Studio / the keyless
   *  deterministic engine — all cross-platform, so AI works on every OS. */
  get appleIntelligence() {
    return isTauri() && detectOS() === "macos";
  },
} as const;
