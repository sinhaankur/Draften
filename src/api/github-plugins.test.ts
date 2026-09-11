import { describe, it, expect } from "vitest";

import { resolvePluginUrl, validatePlugin } from "./github-plugins";

describe("github plugin install — URL resolution", () => {
  it("passes raw.githubusercontent URLs through", () => {
    const u = "https://raw.githubusercontent.com/a/b/main/p.js";
    expect(resolvePluginUrl(u)).toBe(u);
  });
  it("converts a github.com blob URL to raw", () => {
    expect(resolvePluginUrl("https://github.com/a/b/blob/main/dir/p.js"))
      .toBe("https://raw.githubusercontent.com/a/b/main/dir/p.js");
  });
  it("expands owner/repo to the convention path on main", () => {
    expect(resolvePluginUrl("sinhaankur/draften-hello"))
      .toBe("https://raw.githubusercontent.com/sinhaankur/draften-hello/main/draften-plugin.js");
  });
  it("supports owner/repo@branch", () => {
    expect(resolvePluginUrl("sinhaankur/draften-hello@dev"))
      .toBe("https://raw.githubusercontent.com/sinhaankur/draften-hello/dev/draften-plugin.js");
  });
  it("passes any other direct module URL", () => {
    expect(resolvePluginUrl("https://cdn.example.com/x.js")).toBe("https://cdn.example.com/x.js");
  });
  it("rejects nonsense", () => {
    expect(() => resolvePluginUrl("not a url or repo!!")).toThrow(/Can't resolve/);
  });
});

describe("plugin validation", () => {
  const good = { id: "x", name: "X", activate() {} };
  it("accepts a valid plugin", () => {
    expect(() => validatePlugin(good)).not.toThrow();
  });
  it("rejects missing id", () => {
    expect(() => validatePlugin({ name: "X", activate() {} })).toThrow(/id/);
  });
  it("rejects missing name", () => {
    expect(() => validatePlugin({ id: "x", activate() {} })).toThrow(/name/);
  });
  it("rejects missing activate", () => {
    expect(() => validatePlugin({ id: "x", name: "X" })).toThrow(/activate/);
  });
  it("rejects non-objects", () => {
    expect(() => validatePlugin(null)).toThrow();
  });
});
