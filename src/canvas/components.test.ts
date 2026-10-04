import { describe, it, expect } from "vitest";

import { boundsOf, captureComponent, instanceCount, instancesOf, stampInstance, syncInstances, type El } from "./components";

const el = (id: string, x: number, y: number, w = 40, h = 20, extra: Partial<El> = {}): El =>
  ({ id, type: "rectangle", x, y, width: w, height: h, ...extra });

describe("boundsOf", () => {
  it("computes the group bounding box", () => {
    expect(boundsOf([el("a", 10, 10, 40, 20), el("b", 60, 30, 20, 50)])).toEqual({ x: 10, y: 10, width: 70, height: 70 });
  });
});

describe("captureComponent", () => {
  it("normalizes elements to a (0,0) origin + records size", () => {
    const def = captureComponent([el("a", 100, 100), el("b", 150, 120)], "Button");
    expect(def.name).toBe("Button");
    expect(def.width).toBe(90); // (150+40) - 100
    expect(def.elements[0].x).toBe(0);   // 100 - 100
    expect(def.elements[1].x).toBe(50);  // 150 - 100
    expect(def.elements[1].y).toBe(20);  // 120 - 100
  });
  it("defaults the name", () => {
    expect(captureComponent([el("a", 0, 0)], "  ").name).toBe("Component");
  });
});

describe("stampInstance", () => {
  const def = captureComponent([el("a", 0, 0), el("b", 50, 0)], "Card");

  it("clones with new ids at the drop position, tagged with componentId + instanceId", () => {
    const inst = stampInstance(def, 200, 300);
    expect(inst).toHaveLength(2);
    expect(inst[0].id).not.toBe("a");
    expect(inst[0].x).toBe(200);
    expect(inst[1].x).toBe(250);
    const cd0 = inst[0].customData as { componentId: string; instanceId: string };
    const cd1 = inst[1].customData as { componentId: string; instanceId: string };
    expect(cd0.componentId).toBe(def.id);
    expect(cd0.instanceId).toBe(cd1.instanceId); // same instance
  });

  it("two stamps get different instanceIds", () => {
    const a = stampInstance(def, 0, 0)[0].customData as { instanceId: string };
    const b = stampInstance(def, 0, 0)[0].customData as { instanceId: string };
    expect(a.instanceId).not.toBe(b.instanceId);
  });
});

describe("instancesOf + instanceCount", () => {
  it("groups instance elements by instanceId", () => {
    const def = captureComponent([el("a", 0, 0), el("b", 30, 0)], "X");
    const scene: El[] = [
      el("bg", 0, 0),
      ...stampInstance(def, 100, 0),
      ...stampInstance(def, 400, 0),
    ];
    expect(instanceCount(def, scene)).toBe(2);
    expect([...instancesOf(def, scene).values()][0]).toHaveLength(2);
  });
});

describe("syncInstances (edit master → instances update)", () => {
  it("re-stamps every instance to match the master, keeping positions", () => {
    const def = captureComponent([el("a", 0, 0, 40, 20)], "Btn");
    let scene: El[] = [el("bg", 0, 0), ...stampInstance(def, 100, 100), ...stampInstance(def, 500, 200)];

    // edit the master: the element becomes taller
    const edited = { ...def, elements: [{ ...def.elements[0], height: 60 }], height: 60 };
    const res = syncInstances(edited, scene);
    expect(res.synced).toBe(2);

    const instEls = res.scene.filter((e) => (e.customData as { componentId?: string } | undefined)?.componentId === def.id);
    expect(instEls).toHaveLength(2);
    expect(instEls.every((e) => e.height === 60)).toBe(true);
    // positions preserved (one at x=100, one at x=500)
    expect(instEls.map((e) => e.x).sort((a, b) => a - b)).toEqual([100, 500]);
    // the non-instance background is untouched
    expect(res.scene.some((e) => e.id === "bg")).toBe(true);
  });

  it("is a no-op when there are no instances", () => {
    const def = captureComponent([el("a", 0, 0)], "Y");
    const scene = [el("bg", 0, 0)];
    expect(syncInstances(def, scene)).toEqual({ scene, synced: 0 });
  });
});
