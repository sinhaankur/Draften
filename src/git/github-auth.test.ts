import { afterEach, describe, expect, it, vi } from "vitest";
import { requestDeviceCode, pollForToken, signInWithGitHub, fetchGitHubUser } from "./github-auth";

afterEach(() => vi.restoreAllMocks());

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

describe("github-auth · device flow", () => {
  it("requestDeviceCode returns the user code + verification URL", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({
      device_code: "dc123", user_code: "WDJB-MJHT",
      verification_uri: "https://github.com/login/device", expires_in: 900, interval: 5,
    })));
    const d = await requestDeviceCode();
    expect(d.user_code).toBe("WDJB-MJHT");
    expect(d.verification_uri).toContain("github.com/login/device");
  });

  it("pollForToken maps GitHub's responses to statuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "authorization_pending" })));
    expect((await pollForToken("dc")).status).toBe("pending");

    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "slow_down" })));
    expect((await pollForToken("dc")).status).toBe("slow_down");

    vi.stubGlobal("fetch", vi.fn(async () => json({ access_token: "ght_abc" })));
    const ok = await pollForToken("dc");
    expect(ok.status).toBe("ok");
    expect(ok.status === "ok" && ok.token).toBe("ght_abc");

    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "access_denied" })));
    expect((await pollForToken("dc")).status).toBe("error");
  });

  it("signInWithGitHub polls through 'pending' then returns the token", async () => {
    const seq = [
      json({ device_code: "dc", user_code: "AAAA-BBBB", verification_uri: "https://github.com/login/device", expires_in: 900, interval: 0 }),
      json({ error: "authorization_pending" }),
      json({ access_token: "ght_final" }),
    ];
    let i = 0;
    vi.stubGlobal("fetch", vi.fn(async () => seq[Math.min(i++, seq.length - 1)]));
    let shownCode = "";
    const token = await signInWithGitHub({ onCode: (d) => { shownCode = d.user_code; } });
    expect(shownCode).toBe("AAAA-BBBB"); // the UI was handed the code to show
    expect(token).toBe("ght_final");
  });

  it("signInWithGitHub aborts when cancelled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      json({ device_code: "dc", user_code: "X", verification_uri: "u", expires_in: 900, interval: 0 })));
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(signInWithGitHub({ onCode: () => {}, signal: ctrl.signal })).rejects.toThrow(/cancelled/);
  });

  it("fetchGitHubUser returns the login", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ login: "sinhaankur", name: "Ankur Sinha" })));
    const u = await fetchGitHubUser("ght_abc");
    expect(u.login).toBe("sinhaankur");
  });
});
