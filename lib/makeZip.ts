/** Minimal ZIP builder using STORE method (no compression). */

// CRC-32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(v: number) { return [(v >>> 0) & 0xff, (v >>> 8) & 0xff]; }
function u32(v: number) { return [(v >>> 0) & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]; }

export interface ZipEntry { name: string; data: Uint8Array }

export function makeZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const localOffsets: number[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // signature
      0x14, 0x00,             // version needed
      0x00, 0x00,             // flags
      0x00, 0x00,             // compression (STORE)
      0x00, 0x00, 0x00, 0x00, // last mod time/date
      ...u32(crc),
      ...u32(size),           // compressed size
      ...u32(size),           // uncompressed size
      ...u16(nameBytes.length),
      0x00, 0x00,             // extra field length
      ...nameBytes,
    ]);

    localOffsets.push(offset);
    parts.push(local, entry.data);
    offset += local.length + size;
  }

  const centralParts: Uint8Array[] = [];
  let centralSize = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const nameBytes = enc.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const central = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, // signature
      0x14, 0x00,             // version made by
      0x14, 0x00,             // version needed
      0x00, 0x00,             // flags
      0x00, 0x00,             // compression (STORE)
      0x00, 0x00, 0x00, 0x00, // last mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0x00, 0x00,             // extra field length
      0x00, 0x00,             // file comment length
      0x00, 0x00,             // disk number start
      0x00, 0x00,             // internal attributes
      0x00, 0x00, 0x00, 0x00, // external attributes
      ...u32(localOffsets[i]),
      ...nameBytes,
    ]);

    centralParts.push(central);
    centralSize += central.length;
  }

  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, // signature
    0x00, 0x00,             // disk number
    0x00, 0x00,             // disk with central directory
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),         // central directory offset
    0x00, 0x00,             // comment length
  ]);

  const all = [...parts, ...centralParts, eocd].map((u) => u.buffer as ArrayBuffer);
  return new Blob(all, { type: "application/zip" });
}
