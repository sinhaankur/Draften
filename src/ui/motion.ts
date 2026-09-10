// motion.ts — Draften's house motion, matching sinhaankur.com's feel.
// Motion is functional, not decoration: it shows where things come from (spatial),
// gives sub-Doherty-threshold feedback (<400ms, most <200ms), and eases with the
// site's signature ease-out curve. Reuse these tokens so everything moves the same.
//
// © Ankur Sinha.

/** The house ease-out curve from sinhaankur.com (crisp, settles gently). */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** Duration tokens (seconds). Keep interactions snappy — Doherty threshold. */
export const DUR = {
  fast: 0.14,   // hovers, taps, micro-feedback
  base: 0.22,   // panels, toggles
  slow: 0.32,   // overlays, larger moves
} as const;

/** A spring that feels physical but quick — for drawers/panels sliding in. */
export const SPRING = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.9 };

// ── reusable variants ─────────────────────────────────────────────────────────

/** Slide-over drawer (from a side). dir: -1 = from left, 1 = from right. */
export const drawer = (dir: -1 | 1) => ({
  initial: { x: dir * 24, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: dir * 24, opacity: 0 },
  transition: SPRING,
});

/** Overlay/modal — fade + a slight rise. */
export const overlay = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8, scale: 0.98 },
  transition: { duration: DUR.slow, ease: EASE },
};

/** Scrim behind a drawer/modal. */
export const scrim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: DUR.base, ease: EASE },
};

/** A short toast/note that rises in, then can be dismissed. */
export const toast = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 14 },
  transition: { duration: DUR.base, ease: EASE },
};

/** Item enter — for list rows / component cards appearing (stagger-friendly). */
export const item = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DUR.base, ease: EASE },
};

/** Micro press feedback for buttons/tiles (use whileTap / whileHover). */
export const press = { whileHover: { y: -1 }, whileTap: { scale: 0.97 }, transition: { duration: DUR.fast, ease: EASE } };
