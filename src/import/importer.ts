/**
 * The importer plugin contract.
 *
 * "Easy import from any design tool" = one interface, many plugins. Each importer
 * maps a foreign file (or API payload) INTO the Draften document model. Adding
 * XD, Visio, draw.io, etc. is writing a new `Importer` — no core changes. Sketch,
 * Figma, and OmniGraffle are the first three built on this same contract.
 */

import type { DraftenDocument, ImportSource } from "../model/document";

export interface ImportInput {
  /** raw bytes of the file (Sketch zip, OmniGraffle gz, XD, …) */
  bytes?: Uint8Array;
  /** original filename (for extension sniffing + naming) */
  filename?: string;
  /** for API-based sources (Figma): auth + file key instead of bytes */
  api?: { token: string; fileKey: string };
}

export interface ImportResult {
  document: DraftenDocument;
  /** non-fatal notes: unsupported features, approximations made, dropped data */
  warnings: string[];
}

export interface Importer {
  /** stable id, e.g. "sketch", "figma", "omnigraffle", "xd" */
  id: ImportSource | string;
  /** human label for the Open dialog */
  label: string;
  /** file extensions this importer claims, e.g. [".sketch"] */
  extensions: string[];
  /** true if this importer pulls from an API rather than a local file */
  apiBased?: boolean;

  /**
   * Cheap check: could this importer handle the input? (extension / magic bytes)
   * The registry uses this to pick an importer automatically.
   */
  canImport(input: ImportInput): boolean;

  /** Do the import. Throws on unrecoverable errors; use `warnings` otherwise. */
  import(input: ImportInput): Promise<ImportResult>;
}

/** A registry so importers are discoverable + pluggable (open-source plugins). */
export class ImporterRegistry {
  private importers: Importer[] = [];

  register(importer: Importer): void {
    this.importers.push(importer);
  }

  all(): readonly Importer[] {
    return this.importers;
  }

  /** Pick the first importer that claims the input (extension then magic bytes). */
  pick(input: ImportInput): Importer | undefined {
    const ext = input.filename?.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    if (ext) {
      const byExt = this.importers.find((i) => i.extensions.includes(ext));
      if (byExt) return byExt;
    }
    return this.importers.find((i) => i.canImport(input));
  }
}

/** The app's singleton registry (importers self-register at startup). */
export const importers = new ImporterRegistry();
