import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
for (const node of doc.getRoot().listNodes()) {
  if (!/^lung/.test(node.getName())) continue;
  const prim = node.getMesh().listPrimitives()[0];
  const pos = prim.getAttribute("POSITION"), idx = prim.getIndices().getArray();
  let area = 0, zero = 0;
  const p = (i) => pos.getElement(i, []);
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [p(idx[i]), p(idx[i + 1]), p(idx[i + 2])];
    const u = a.map((v, k) => b[k] - v), v = a.map((x, k) => c[k] - x);
    const cr = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
    area += cr; if (cr < 1e-12) zero++;
  }
  console.log(node.getName(), "tris", idx.length / 3, "area(local)", area.toFixed(4), "degenerate", zero, "scale", node.getScale(), "mode", prim.getMode(), "first", p(0), p(1), p(2));
}
