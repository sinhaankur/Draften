/**
 * components — reusable components / symbols (Figma/Sketch), on the Excalidraw canvas.
 *
 * A component is a captured group of elements (a "master"). Dropping it creates an
 * INSTANCE — a clone tagged with the component id. Editing the master and running
 * "sync" re-stamps every instance to match, keeping each instance's position. This
 * is the honest version of symbols for a canvas that has no native symbol concept:
 * explicit capture + explicit sync, no magic, always inspectable.
 *
 * Components are OPT-IN — the app designs fine without them; you enable the library
 * only when you want reuse. The pure functions here (capture/stamp/sync) take and
 * return plain element arrays, so they're unit-tested without Excalidraw.
 */

export interface El {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  customData?: Record<string, unknown> | null;
  [k: string]: unknown;
}

export interface ComponentDef {
  id: string;
  name: string;
  /** master elements, normalized so the group's top-left is (0,0) */
  elements: El[];
  width: number;
  height: number;
  createdAt: number;
}

const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

/** Bounding box of a set of elements. */
export function boundsOf(els: El[]): { x: number; y: number; width: number; height: number } {
  if (!els.length) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...els.map((e) => e.x));
  const minY = Math.min(...els.map((e) => e.y));
  const maxX = Math.max(...els.map((e) => e.x + (e.width ?? 0)));
  const maxY = Math.max(...els.map((e) => e.y + (e.height ?? 0)));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Capture selected elements into a component master. Elements are normalized to a
 * (0,0) origin so the master is position-independent; stamping re-adds an offset.
 */
export function captureComponent(selected: El[], name: string): ComponentDef {
  const b = boundsOf(selected);
  const elements = selected.map((e) => ({ ...e, x: e.x - b.x, y: e.y - b.y }));
  return { id: rid("cmp"), name: name.trim() || "Component", elements, width: b.width, height: b.height, createdAt: Date.now() };
}

/**
 * Stamp an instance of a component at (x,y). Returns fresh elements (new ids),
 * each tagged with { componentId, instanceId } so instances can be found + synced.
 */
export function stampInstance(def: ComponentDef, x: number, y: number): El[] {
  const instanceId = rid("inst");
  return def.elements.map((e) => ({
    ...e,
    id: rid("el"),
    x: e.x + x,
    y: e.y + y,
    seed: Math.floor(Math.random() * 1e9),
    customData: { ...(e.customData ?? {}), componentId: def.id, instanceId },
  }));
}

/** Group a scene's instance elements by instanceId (only those of this def). */
export function instancesOf(def: ComponentDef, scene: El[]): Map<string, El[]> {
  const byInstance = new Map<string, El[]>();
  for (const e of scene) {
    const cd = e.customData as { componentId?: string; instanceId?: string } | null | undefined;
    if (cd?.componentId === def.id && cd.instanceId) {
      const list = byInstance.get(cd.instanceId) ?? [];
      list.push(e);
      byInstance.set(cd.instanceId, list);
    }
  }
  return byInstance;
}

/**
 * Re-stamp every instance of a def to match the (edited) master, preserving each
 * instance's top-left position. Returns a NEW scene array with old instance
 * elements removed and fresh ones inserted. The master definition is unchanged.
 */
export function syncInstances(def: ComponentDef, scene: El[]): { scene: El[]; synced: number } {
  const byInstance = instancesOf(def, scene);
  if (!byInstance.size) return { scene, synced: 0 };

  const instanceIds = new Set(byInstance.keys());
  // keep everything that isn't an instance element of this def
  const kept = scene.filter((e) => {
    const cd = e.customData as { componentId?: string; instanceId?: string } | null | undefined;
    return !(cd?.componentId === def.id && cd.instanceId && instanceIds.has(cd.instanceId));
  });

  const fresh: El[] = [];
  for (const [instanceId, els] of byInstance) {
    const pos = boundsOf(els); // where this instance currently sits
    for (const e of def.elements) {
      fresh.push({
        ...e,
        id: rid("el"),
        x: e.x + pos.x,
        y: e.y + pos.y,
        seed: Math.floor(Math.random() * 1e9),
        customData: { ...(e.customData ?? {}), componentId: def.id, instanceId },
      });
    }
  }
  return { scene: [...kept, ...fresh], synced: byInstance.size };
}

/** How many instances of a def exist in a scene. */
export function instanceCount(def: ComponentDef, scene: El[]): number {
  return instancesOf(def, scene).size;
}
