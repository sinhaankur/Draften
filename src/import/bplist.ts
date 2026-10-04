/**
 * bplist — a compact reader for Apple binary property lists (`bplist00`).
 *
 * OmniGraffle documents are a gzipped binary plist (the `data.plist` inside the
 * `.graffle` package, or the whole single-file `.graffle`). To open those files
 * we decode the plist ourselves — no native dependency, runs in the browser.
 *
 * The format is well-specified:
 *   - 8-byte header "bplist00"
 *   - a body of typed objects
 *   - an offset table (object_i → byte offset)
 *   - a 32-byte trailer: offset-int-size, object-ref-size, num-objects,
 *     top-object index, offset-table start.
 * See CoreFoundation's CFBinaryPList.c. We support the object types that appear
 * in real OmniGraffle files: null/bool, int, real, date, data, ASCII+UTF16
 * strings, UID, array, set, dict.
 */

type PlistValue =
  | null
  | boolean
  | number
  | string
  | Uint8Array
  | Date
  | { uid: number }
  | PlistValue[]
  | { [k: string]: PlistValue };

export function parseBinaryPlist(bytes: Uint8Array): PlistValue {
  if (!bytes || bytes.length < 40) throw new Error("File too small to be a binary plist");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let magic = "";
  for (let i = 0; i < 6; i++) magic += String.fromCharCode(bytes[i]);
  if (magic !== "bplist") throw new Error("Not a binary plist");

  // ── trailer (last 32 bytes) ──
  const tStart = bytes.length - 32;
  const offsetSize = dv.getUint8(tStart + 6);
  const refSize = dv.getUint8(tStart + 7);
  const numObjects = readUInt(dv, tStart + 8, 8);
  const topObject = readUInt(dv, tStart + 16, 8);
  const offsetTableOffset = readUInt(dv, tStart + 24, 8);

  // ── offset table ──
  const offsets: number[] = [];
  for (let i = 0; i < numObjects; i++) {
    offsets.push(readUInt(dv, offsetTableOffset + i * offsetSize, offsetSize));
  }

  const cache = new Map<number, PlistValue>();

  function readObject(index: number): PlistValue {
    if (cache.has(index)) return cache.get(index)!;
    let pos = offsets[index];
    const marker = dv.getUint8(pos);
    const type = marker >> 4;
    const info = marker & 0x0f;
    pos++;

    let value: PlistValue;
    switch (type) {
      case 0x0: // null / bool / fill
        value = info === 0x8 ? false : info === 0x9 ? true : null;
        break;
      case 0x1: { // int (2^info bytes, big-endian)
        const n = 1 << info;
        value = readInt(dv, pos, n);
        break;
      }
      case 0x2: { // real
        const n = 1 << info;
        value = n === 4 ? dv.getFloat32(pos) : dv.getFloat64(pos);
        break;
      }
      case 0x3: // date (8-byte float, seconds since 2001-01-01)
        value = new Date((dv.getFloat64(pos) + 978307200) * 1000);
        break;
      case 0x4: { // data
        const [len, p] = readLength(dv, info, pos);
        value = bytes.slice(p, p + len);
        break;
      }
      case 0x5: { // ASCII string
        const [len, p] = readLength(dv, info, pos);
        value = asciiString(bytes, p, len);
        break;
      }
      case 0x6: { // UTF-16 BE string
        const [len, p] = readLength(dv, info, pos);
        value = utf16String(dv, p, len);
        break;
      }
      case 0x8: // UID (used by keyed archives)
        value = { uid: readUInt(dv, pos, info + 1) };
        break;
      case 0xa: // array
      case 0xc: { // set
        const [count, p] = readLength(dv, info, pos);
        const arr: PlistValue[] = [];
        for (let i = 0; i < count; i++) arr.push(readObject(readUInt(dv, p + i * refSize, refSize)));
        value = arr;
        break;
      }
      case 0xd: { // dict
        const [count, p] = readLength(dv, info, pos);
        const obj: { [k: string]: PlistValue } = {};
        for (let i = 0; i < count; i++) {
          const key = readObject(readUInt(dv, p + i * refSize, refSize));
          const val = readObject(readUInt(dv, p + (count + i) * refSize, refSize));
          obj[String(key)] = val;
        }
        value = obj;
        break;
      }
      default:
        value = null;
    }
    cache.set(index, value);
    return value;
  }

  return readObject(topObject);
}

/** When `info === 0xf`, the real length is an int object that follows. */
function readLength(dv: DataView, info: number, pos: number): [number, number] {
  if (info !== 0x0f) return [info, pos];
  const marker = dv.getUint8(pos);
  const intBytes = 1 << (marker & 0x0f);
  const len = readUInt(dv, pos + 1, intBytes);
  return [len, pos + 1 + intBytes];
}

function readUInt(dv: DataView, pos: number, size: number): number {
  let n = 0;
  for (let i = 0; i < size; i++) n = n * 256 + dv.getUint8(pos + i);
  return n;
}
function readInt(dv: DataView, pos: number, size: number): number {
  // bplist ints are signed only at 8 bytes; smaller are unsigned in practice.
  if (size === 8) return Number(dv.getBigInt64(pos));
  return readUInt(dv, pos, size);
}
function asciiString(bytes: Uint8Array, pos: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[pos + i]);
  return s;
}
function utf16String(dv: DataView, pos: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(dv.getUint16(pos + i * 2));
  return s;
}
