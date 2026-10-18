// Prints world-space bounds and node names of HRA reference-organ GLBs.
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { readdirSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2], verbose = process.argv[3];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) {
  const doc = await io.read(join(dir, f));
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]; let tris = 0, meshes = 0; const names = [];
  for (const scene of doc.getRoot().listScenes()) scene.traverse((n) => {
    const m = n.getMesh(); if (!m) return; meshes++; names.push(n.getName());
    const W = n.getWorldMatrix();
    for (const p of m.listPrimitives()) {
      const a = p.getAttribute("POSITION"), v = [0, 0, 0]; const idx = p.getIndices();
      tris += (idx ? idx.getCount() : a.getCount()) / 3;
      for (let i = 0; i < a.getCount(); i += 7) { a.getElement(i, v);
        const w = [0, 1, 2].map((r) => W[r] * v[0] + W[4 + r] * v[1] + W[8 + r] * v[2] + W[12 + r]);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], w[k]); hi[k] = Math.max(hi[k], w[k]); } }
    }
  });
  console.log(f.padEnd(52), String(meshes).padStart(4), String(Math.round(tris)).padStart(8), lo.map((x) => x.toFixed(3)).join(","), "→", hi.map((x) => x.toFixed(3)).join(","));
  if (verbose) console.log("   ", names.slice(0, 60).join(" | "));
}
