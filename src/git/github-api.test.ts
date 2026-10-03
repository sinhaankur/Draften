import { afterEach, describe, expect, it, vi } from "vitest";
import { listRepos, listCommits, commitFile, openPull } from "./github-api";

afterEach(() => vi.restoreAllMocks());
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

describe("github-api", () => {
  it("listRepos sends the auth header and returns repos", async () => {
    const f = vi.fn(async (_u?: string, _i?: RequestInit) => json([{ full_name: "sinhaankur/Draften", name: "Draften", default_branch: "main", private: false }]));
    vi.stubGlobal("fetch", f);
    const repos = await listRepos("ght_x");
    expect(repos[0].full_name).toBe("sinhaankur/Draften");
    const init = f.mock.calls[0][1] as unknown as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ght_x");
  });

  it("listCommits flattens to sha/message/author", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json([
      { sha: "abcdef1234", commit: { message: "Fix the thing\n\ndetails", author: { name: "Ankur", date: "2026-10-03" } } },
    ])));
    const c = await listCommits("t", "r/x", "main");
    expect(c[0].sha).toBe("abcdef1");       // short sha
    expect(c[0].message).toBe("Fix the thing"); // first line only
    expect(c[0].author).toBe("Ankur");
  });

  it("commitFile creates a NEW file (no prior sha)", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === "PUT") return json({ commit: { sha: "newsha" } });
      return json({ message: "Not Found" }, 404); // file doesn't exist yet
    }));
    const sha = await commitFile("t", "r/x", "main", "design.json", "{}", "Add design");
    expect(sha).toBe("newsha");
    const put = calls.find((c) => c.init?.method === "PUT")!;
    const body = JSON.parse(put.init!.body as string);
    expect(body.sha).toBeUndefined();        // new file → no sha
    expect(body.branch).toBe("main");
    expect(atob(body.content)).toBe("{}");   // base64-encoded content
  });

  it("commitFile UPDATES when the file exists (passes its sha)", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const body = JSON.parse(init.body as string);
        expect(body.sha).toBe("oldsha");     // update carries the existing sha
        return json({ commit: { sha: "updated" } });
      }
      return json({ sha: "oldsha" });        // GET → file exists
    }));
    expect(await commitFile("t", "r/x", "main", "p", "c", "m")).toBe("updated");
  });

  it("openPull posts head/base/title", async () => {
    const f = vi.fn(async (_u?: string, _i?: RequestInit) => json({ number: 12, title: "Onboarding", html_url: "u", state: "open" }));
    vi.stubGlobal("fetch", f);
    const pr = await openPull("t", "r/x", "Onboarding", "feat/onboarding", "main");
    expect(pr.number).toBe(12);
    const body = JSON.parse((f.mock.calls[0][1] as unknown as RequestInit).body as string);
    expect(body.head).toBe("feat/onboarding");
    expect(body.base).toBe("main");
  });

  it("surfaces GitHub errors honestly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ message: "Bad credentials" }, 401)));
    await expect(listRepos("bad")).rejects.toThrow(/GitHub 401/);
  });
});
