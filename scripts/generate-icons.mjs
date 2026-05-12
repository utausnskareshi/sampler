// Pure Node PNG icon generator (no external deps).
// Generates app icons used by the PWA manifest and apple-touch-icon.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/icons");

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[i] = c;
}
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = data.length;
  const out = Buffer.alloc(8 + len + 4);
  out.writeUInt32BE(len, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crcBuf = Buffer.concat([Buffer.from(type, "ascii"), data]);
  out.writeUInt32BE(crc32(crcBuf), 8 + len);
  return out;
}
function encodePNG(width, height, getPixel) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const o = y * (stride + 1) + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PAD_COLORS = [
  [255, 86, 95],
  [255, 200, 60],
  [80, 220, 180],
  [120, 130, 255],
];

function inRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return false;
  const lx = x - x0;
  const ly = y - y0;
  const dx = Math.max(0, Math.max(r - lx, lx - (w - r)));
  const dy = Math.max(0, Math.max(r - ly, ly - (h - r)));
  return dx * dx + dy * dy <= r * r;
}

function makeIcon(size, { maskable = false } = {}) {
  const bg = [15, 15, 18, 255];
  const padSize = size * 0.32;
  const gap = size * 0.05;
  const total = padSize * 2 + gap;
  const start = (size - total) / 2;
  const radius = maskable ? 0 : size * 0.18;
  const padRadius = padSize * 0.16;
  return encodePNG(size, size, (x, y) => {
    if (!maskable && !inRoundedRect(x, y, 0, 0, size, size, radius)) {
      return [0, 0, 0, 0];
    }
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const px = start + col * (padSize + gap);
        const py = start + row * (padSize + gap);
        if (inRoundedRect(x, y, px, py, padSize, padSize, padRadius)) {
          const c = PAD_COLORS[row * 2 + col];
          return [c[0], c[1], c[2], 255];
        }
      }
    }
    return bg;
  });
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  const buf = makeIcon(t.size, { maskable: !!t.maskable });
  writeFileSync(resolve(OUT_DIR, t.name), buf);
  console.log(`generated ${t.name} (${t.size}x${t.size})`);
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0f0f12"/>
  <rect x="10" y="10" width="20" height="20" rx="4" fill="#ff565f"/>
  <rect x="34" y="10" width="20" height="20" rx="4" fill="#ffc83c"/>
  <rect x="10" y="34" width="20" height="20" rx="4" fill="#50dcb4"/>
  <rect x="34" y="34" width="20" height="20" rx="4" fill="#7882ff"/>
</svg>`;
writeFileSync(resolve(ROOT, "public/favicon.svg"), favicon);
console.log("generated favicon.svg");
