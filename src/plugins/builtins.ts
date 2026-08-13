/**
 * Built-in plugin registration.
 *
 * Draften's importers, AI providers, tools, and panels are all plugins (the app
 * is open-source + extensible). The built-ins register here at startup; third
 * parties register the same way against the public registries. Keeping this in
 * one file makes the extension surface obvious.
 */

import { aiProviders } from "../ai/provider";
import { DeterministicProvider } from "../ai/providers";
import { PdfImporter } from "../import/pdf";
import { SketchImporter } from "../import/sketch";
import { importers } from "../import/importer";

let registered = false;

export function registerBuiltins(): void {
  if (registered) return;
  registered = true;

  // ── importers (the "open any design tool" pipeline) ──
  importers.register(new SketchImporter());
  importers.register(new PdfImporter());
  // Figma (REST API), OmniGraffle (Rust plist), XD, draw.io importers register
  // here once built; each is just another Importer against the same contract.

  // ── AI providers, cheapest-capable first ──
  // The deterministic provider is always available (no key, no model, offline) so
  // "generate a design system" works out of the box. Apple Intelligence / tiny
  // WebLLM / cloud tiers register on top when the device/user allows (see
  // ai/providers.ts + pickBestAvailable()).
  aiProviders.register(new DeterministicProvider());
}
