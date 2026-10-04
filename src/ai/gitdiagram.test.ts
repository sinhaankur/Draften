import { describe, it, expect } from "vitest";

import { buildGitDiagram } from "./gitdiagram";
import type { TreeEntry } from "../git/github-api";

const tree: TreeEntry[] = [
  { path: "README.md", type: "blob", size: 100 },
  { path: "package.json", type: "blob", size: 50 },
  { path: "src", type: "tree" },
  { path: "src/App.tsx", type: "blob", size: 2000 },
  { path: "src/main.tsx", type: "blob", size: 300 },
  { path: "src/ui", type: "tree" },
  { path: "src/ui/Panel.tsx", type: "blob", size: 900 },
  { path: "components", type: "tree" },
  { path: "components/Button.tsx", type: "blob", size: 400 },
  { path: "tests", type: "tree" },
  { path: "tests/app.test.ts", type: "blob", size: 200 },
];

describe("buildGitDiagram", () => {
  const doc = buildGitDiagram(tree, { repo: "me/app", branch: "main" });

  it("makes one diagram board titled after the repo", () => {
    expect(doc.boards).toHaveLength(1);
    expect(doc.boards[0].kind).toBe("diagram");
    expect(doc.boards[0].name).toContain("me/app");
  });

  it("creates a grouped frame per top-level directory + a root group", () => {
    const frames = Object.values(doc.nodes).filter((n) => n.type === "frame");
    const names = frames.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["src", "components", "tests", "(root)"]));
  });

  it("puts files inside their group's frame as shapes", () => {
    const srcFrame = Object.values(doc.nodes).find((n) => n.type === "frame" && n.name === "src") as any;
    const kids = srcFrame.children.map((id: string) => doc.nodes[id]);
    // App.tsx + main.tsx should be shapes within src
    const shapeLabels = kids.filter((n: any) => n.type === "shape").map((n: any) => n.label);
    expect(shapeLabels).toEqual(expect.arrayContaining(["App.tsx", "main.tsx"]));
  });

  it("counts files per group in the subtitle (recursive) + notes sub-folders", () => {
    const texts = Object.values(doc.nodes).filter((n) => n.type === "text").map((n: any) => n.text);
    // src has 3 files total (App.tsx, main.tsx, ui/Panel.tsx) + a sub-folder
    expect(texts.some((t) => /3 files/.test(t) && /sub-folder/.test(t))).toBe(true);
  });

  it("links source to the components/api-style groups with connectors", () => {
    const connectors = Object.values(doc.nodes).filter((n) => n.type === "connector");
    expect(connectors.length).toBeGreaterThanOrEqual(1);
    expect(connectors.some((c) => c.name.includes("components"))).toBe(true);
  });

  it("handles an empty tree without throwing", () => {
    const empty = buildGitDiagram([], { repo: "me/empty" });
    expect(empty.boards).toHaveLength(1);
  });
});
