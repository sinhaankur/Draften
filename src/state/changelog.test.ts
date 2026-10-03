import { beforeEach, describe, expect, it } from "vitest";
import { useChangelog } from "./changelog";

const rec = (summary: string, author: "ai" | "you" = "you") =>
  useChangelog.getState().record({ author, summary, actions: [{ op: "test", detail: summary }] });

describe("changelog", () => {
  beforeEach(() => useChangelog.getState().clear());

  it("records entries and advances the cursor", () => {
    rec("one");
    rec("two");
    const s = useChangelog.getState();
    expect(s.entries.length).toBe(2);
    expect(s.cursor).toBe(2);
    expect(s.active().map((e) => e.summary)).toEqual(["one", "two"]);
  });

  it("undo/redo move the cursor without deleting", () => {
    rec("one");
    rec("two");
    const cl = useChangelog.getState();
    expect(cl.undo()?.summary).toBe("two");
    expect(useChangelog.getState().active().map((e) => e.summary)).toEqual(["one"]);
    expect(useChangelog.getState().canRedo()).toBe(true);
    expect(useChangelog.getState().redo()?.summary).toBe("two");
    expect(useChangelog.getState().active().length).toBe(2);
  });

  it("a new change after undo discards the redo tail (a fresh branch)", () => {
    rec("one");
    rec("two");
    useChangelog.getState().undo(); // back to after "one"
    rec("three"); // branches off "one"
    const s = useChangelog.getState();
    expect(s.active().map((e) => e.summary)).toEqual(["one", "three"]);
    expect(s.canRedo()).toBe(false); // "two" is gone
  });

  it("revertTo sets the cursor just after an entry", () => {
    const a = rec("one");
    rec("two");
    rec("three");
    useChangelog.getState().revertTo(a.id);
    expect(useChangelog.getState().active().map((e) => e.summary)).toEqual(["one"]);
  });

  it("records provenance (author + via) for AI changes", () => {
    useChangelog.getState().record({
      author: "ai", via: "webllm/Llama-3.2", summary: "AI added a sign-up form",
      actions: [{ op: "create", target: "form", detail: "3 fields" }],
    });
    const e = useChangelog.getState().entries[0];
    expect(e.author).toBe("ai");
    expect(e.via).toContain("webllm");
    expect(e.actions[0].op).toBe("create");
  });

  it("canUndo/canRedo reflect the cursor bounds", () => {
    expect(useChangelog.getState().canUndo()).toBe(false);
    rec("one");
    expect(useChangelog.getState().canUndo()).toBe(true);
    expect(useChangelog.getState().canRedo()).toBe(false);
  });
});
