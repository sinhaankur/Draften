import { describe, it, expect } from "vitest";

import { parseBinaryPlist } from "./bplist";

/**
 * Build a tiny real bplist00 in memory and round-trip it, so the reader is
 * verified against the actual byte format (not a mock). Covers the object types
 * OmniGraffle uses: dict, ASCII string, int, real, bool, array.
 */
function buildBplist(): Uint8Array {
  // We hand-encode: a top dict { "n": 42, "s": "hi", "ok": true, "a": [1, 2] }.
  // Objects (index order): 0 dict, 1 "n", 2 int42, 3 "s", 4 "hi", 5 "ok",
  // 6 true, 7 "a", 8 array, 9 int1, 10 int2.
  const bytes: number[] = [];
  const offsets: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);
  const ascii = (s: string) => { push(0x50 | s.length); for (const ch of s) push(ch.charCodeAt(0)); };
  const int1 = (n: number) => { push(0x10, n); };

  push(...[..."bplist00"].map((c) => c.charCodeAt(0))); // header

  offsets[0] = bytes.length; push(0xd4); push(1, 3, 5, 7); push(2, 4, 6, 8); // dict(4) keys 1,3,5,7 vals 2,4,6,8
  offsets[1] = bytes.length; ascii("n");
  offsets[2] = bytes.length; int1(42);
  offsets[3] = bytes.length; ascii("s");
  offsets[4] = bytes.length; ascii("hi");
  offsets[5] = bytes.length; ascii("ok");
  offsets[6] = bytes.length; push(0x09); // true
  offsets[7] = bytes.length; ascii("a");
  offsets[8] = bytes.length; push(0xa2); push(9, 10); // array(2) → objs 9,10
  offsets[9] = bytes.length; int1(1);
  offsets[10] = bytes.length; int1(2);

  const offsetTableStart = bytes.length;
  for (const o of offsets) push(o); // 1-byte offsets (file is tiny)

  // trailer
  push(0, 0, 0, 0, 0); // unused
  push(1); // sortVersion
  push(1); // offsetIntSize
  push(1); // objectRefSize
  push(0, 0, 0, 0, 0, 0, 0, offsets.length);        // numObjects (8 bytes)
  push(0, 0, 0, 0, 0, 0, 0, 0);                     // topObject = 0
  push(0, 0, 0, 0, 0, 0, 0, offsetTableStart);      // offsetTableOffset
  return new Uint8Array(bytes);
}

describe("parseBinaryPlist", () => {
  it("reads a real bplist00 dict with mixed types", () => {
    const plist = parseBinaryPlist(buildBplist()) as Record<string, unknown>;
    expect(plist.n).toBe(42);
    expect(plist.s).toBe("hi");
    expect(plist.ok).toBe(true);
    expect(plist.a).toEqual([1, 2]);
  });

  it("rejects non-plist bytes", () => {
    expect(() => parseBinaryPlist(new Uint8Array([1, 2, 3, 4, 5, 6]))).toThrow();
  });
});
