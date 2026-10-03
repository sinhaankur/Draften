import { afterEach, describe, expect, it, vi } from "vitest";
import { LmStudioProvider, probeLmStudio } from "./providers";

/** Build a ReadableStream that emits OpenAI-style SSE chunks. */
function sseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(ctrl) {
      if (i < chunks.length) ctrl.enqueue(enc.encode(chunks[i++]));
      else ctrl.close();
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe("LmStudioProvider", () => {
  it("streams tokens from the OpenAI SSE format and returns the full text", async () => {
    const body = sseStream([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n',
      "data: [DONE]\n",
    ]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));

    const tokens: string[] = [];
    const p = new LmStudioProvider();
    const out = await p.chat([{ role: "user", content: "hi" }], { onToken: (t) => tokens.push(t) });
    expect(out).toBe("Hello");
    expect(tokens).toEqual(["Hel", "lo"]);
  });

  it("refresh() picks up the server's loaded models", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ data: [{ id: "qwen2.5-7b" }, { id: "llama-3.1-8b" }] }), { status: 200 })));
    const p = new LmStudioProvider();
    const models = await p.refresh();
    expect(models).toContain("qwen2.5-7b");
    expect(p.info.models[0]).toBe("qwen2.5-7b");
  });

  it("gives a clear error when the server isn't running", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const p = new LmStudioProvider();
    await expect(p.chat([{ role: "user", content: "hi" }])).rejects.toThrow(/LM Studio isn't reachable/);
  });

  it("probeLmStudio reflects reachability", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect(await probeLmStudio()).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    expect(await probeLmStudio()).toBe(false);
  });

  it("is marked local (no key, private)", () => {
    expect(new LmStudioProvider().info.local).toBe(true);
  });
});
