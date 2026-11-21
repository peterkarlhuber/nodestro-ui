// Deterministic npm-compatible tarballs: the same files give the same bytes on every platform and Node version.
//
// - ustar entries under package/, sorted by path, mode 0644, uid/gid 0, no user or group names,
//   mtime 1985-10-26T08:15:00Z (the fixed time npm pack uses);
// - gzip without name and time, OS byte 255 ("unknown");
// - the deflate stream uses stored (uncompressed) blocks written here, not zlib's compressor: zlib's output can
//   differ between zlib versions and CPU-specific code paths, a stored stream cannot. The packages are small text
//   files, so the size cost is irrelevant.
import { createHash } from "node:crypto";
import { crc32 } from "node:zlib";

const BLOCK = 512;
export const MTIME = 499162500; // 1985-10-26T08:15:00.000Z, as npm pack
const MAX_STORED = 65535;

function field(buffer, offset, length, text) {
  const bytes = Buffer.from(text, "utf-8");
  if (bytes.length > length) throw new Error(`tar field too long: ${text}`);
  bytes.copy(buffer, offset);
}

function octal(value, length) {
  return `${value.toString(8).padStart(length - 1, "0")}\0`;
}

function entry(path, data) {
  if (Buffer.byteLength(path) > 100) throw new Error(`path longer than 100 bytes: ${path}`);
  const header = Buffer.alloc(BLOCK);
  field(header, 0, 100, path);
  field(header, 100, 8, octal(0o644, 8));
  field(header, 108, 8, octal(0, 8));
  field(header, 116, 8, octal(0, 8));
  field(header, 124, 12, octal(data.length, 12));
  field(header, 136, 12, octal(MTIME, 12));
  field(header, 148, 8, "        ");
  field(header, 156, 1, "0");
  field(header, 257, 6, "ustar\0");
  field(header, 263, 2, "00");
  let sum = 0;
  for (const byte of header) sum += byte;
  field(header, 148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
  const padding = Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK);
  return Buffer.concat([header, data, padding]);
}

/** A tar archive of path -> Buffer, every entry under package/, sorted. */
export function tar(files) {
  const paths = [...files.keys()].sort();
  for (const path of paths) {
    if (path.startsWith("/") || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new Error(`unsafe path: ${path}`);
    }
  }
  const parts = paths.map((path) => entry(`package/${path}`, files.get(path)));
  parts.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(parts);
}

/** gzip (RFC 1952) with stored deflate blocks (RFC 1951, BTYPE 00) and a fixed header. */
export function gzipStored(data) {
  const header = Buffer.from([0x1f, 0x8b, 8, 0, 0, 0, 0, 0, 0, 255]);
  const blocks = [];
  let offset = 0;
  do {
    const length = Math.min(MAX_STORED, data.length - offset);
    const last = offset + length >= data.length;
    const head = Buffer.alloc(5);
    head[0] = last ? 1 : 0;
    head.writeUInt16LE(length, 1);
    head.writeUInt16LE(~length & 0xffff, 3);
    blocks.push(head, data.subarray(offset, offset + length));
    offset += length;
  } while (offset < data.length);
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(data) >>> 0, 0);
  trailer.writeUInt32LE(data.length % 2 ** 32, 4);
  return Buffer.concat([header, ...blocks, trailer]);
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** The integrity string npm writes into package-lock.json for this tarball. */
export function integrity(buffer) {
  return `sha512-${createHash("sha512").update(buffer).digest("base64")}`;
}
