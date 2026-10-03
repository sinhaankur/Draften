import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMessages, parseReply, runAssistant } from "./assistant";
import { useChangelog } from "../state/changelog";
import type { AiProvider } from "./provider";

function fakeProvider(reply: string): AiProvider {
  return {
    info: { id: "fake", label: "Fake", models: ["m1"], local: true },
    chat: async (_m, opts) => { opts?.onToken?.(reply); return reply; },
  };
}

describe("assistant · buildMessages", () => {
  it("includes the doc summary, request, and an attachment when present", () => {
    const msgs = buildMessages("make a hero", {
      summary: "1 board, no selection",
      attachment: { name: "spec.pdf", text: "Build a landing page with a hero and a form." },
    });
    expect(msgs[0].role).toBe("system");
    const user = msgs[1].content;
    expect(user).toContain("1 board");
    expect(user).toContain("spec.pdf");
    expect(user).toContain("make a hero");
  });
});

describe("assistant · parseReply", () => {
  it("parses a fenced json action block + keeps the prose message", () => {
    const r = parseReply('Here you go.\n```json\n{"actions":[{"op":"create","detail":"a button"}]}\n```');
    expect(r.message).toBe("Here you go.");
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0].op).toBe("create");
  });

  it("tolerates a bare object with no fence", () => {
    const r = parseReply('{"actions":[{"op":"tokens","detail":"brand colors"}]}');
    expect(r.actions[0].op).toBe("tokens");
  });

  it("returns empty actions (never throws) on malformed or missing JSON", () => {
    expect(parseReply("I can't do that.").actions).toEqual([]);
    expect(parseReply("```json\n{bad json}\n```").actions).toEqual([]);
  });

  it("drops entries without a string op (honest, no garbage actions)", () => {
    const r = parseReply('```json\n{"actions":[{"op":"create"},{"detail":"no op"},{"op":5}]}\n```');
    expect(r.actions).toHaveLength(1);
  });
});

describe("assistant · runAssistant", () => {
  beforeEach(() => useChangelog.getState().clear());

  it("applies actions and records ONE reviewable AI changelog entry", async () => {
    const apply = vi.fn();
    const res = await runAssistant(
      fakeProvider('Added it.\n```json\n{"actions":[{"op":"create","detail":"a sign-up form","payload":{"fields":3}}]}\n```'),
      "add a sign-up form",
      { summary: "1 board" },
      { apply },
    );
    expect(apply).toHaveBeenCalledOnce();
    expect(res.entryId).toBeTruthy();
    const log = useChangelog.getState().entries;
    expect(log).toHaveLength(1);
    expect(log[0].author).toBe("ai");
    expect(log[0].via).toContain("fake");
    expect(log[0].actions[0].op).toBe("create");
  });

  it("records nothing + applies nothing when the model returns no actions", async () => {
    const apply = vi.fn();
    const res = await runAssistant(
      fakeProvider("I'm not sure what to change."),
      "huh", { summary: "1 board" }, { apply },
    );
    expect(apply).not.toHaveBeenCalled();
    expect(res.entryId).toBeNull();
    expect(useChangelog.getState().entries).toHaveLength(0);
  });

  it("streams tokens to onToken", async () => {
    const tokens: string[] = [];
    await runAssistant(fakeProvider("hello"), "hi", { summary: "x" }, { onToken: (t) => tokens.push(t) });
    expect(tokens.join("")).toContain("hello");
  });
});
