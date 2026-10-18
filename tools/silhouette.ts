// Debug: front + side depth-shaded vertex splats of GLB meshes → PNG. node tools/silhouette.ts out.png a.glb[:filter] b.glb ...
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const [out, ...files] = process.argv.slice(2);
const S = 300, H = 1.9, W = S * 2 * files.length, HH = Math.round(S * 2.2);
const img = new Uint8Array(W * HH * 3).fill(255), zb = new Float32Array(W * HH).fill(-1e9);
let col = 0;
for (const spec of files) {
  const [f, filt] = spec.split(":");
  const doc = await io.read(f);
  const pts: number[][] = [];
  doc.getRoot().listScenes()[0].traverse((n) => {
    const m = n.getMesh(); if (!m) return;
    if (filt && !new RegExp(filt).test(n.getName())) return;
    const Wm = n.getWorldMatrix();
    for (const p of m.listPrimitives()) { const a = p.getAttribute("POSITION")!, v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v);
        pts.push([0, 1, 2].map((r) => Wm[r] * v[0] + Wm[4 + r] * v[1] + Wm[8 + r] * v[2] + Wm[12 + r])); } }
  });
  let ymin = Infinity; for (const p of pts) ymin = Math.min(ymin, p[1]);
  for (const [view, ox] of [[0, col * 2 * S], [1, col * 2 * S + S]]) {
    for (const p of pts) {
      const u = view ? -p[2] : p[0], d = view ? p[0] : p[2];   // front looks down −z; side from the patient's left
      const px = Math.round(ox + S / 2 + (u / H) * HH), py = Math.round(HH - 10 - ((p[1] - ymin) / H) * HH);
      if (px < ox || px >= ox + S || py < 0 || py >= HH) continue;
      const k = py * W + px; if (d <= zb[k]) continue; zb[k] = d;
      const g = Math.max(0, Math.min(230, 120 - d * 500));
      img.set([g, g, g], k * 3);
    }
  }
  col++;
}
const raw = Buffer.alloc((W * 3 + 1) * HH);
for (let y = 0; y < HH; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crc = (b: Buffer) => { let c: number, t: number[] = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type: string, data: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(HH, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
