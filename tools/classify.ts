// Classify every BodyParts3D element mesh into a display layer and a clickable body region.
// Usage: node tools/classify.ts <bodyparts3d dir with obj/ and isa_element_parts.txt> [out.json]
// Reads OBJ headers and vertices only; writes a manifest the model builder consumes.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Vec3 = [number, number, number];
type Layer = "muscle" | "bone" | "vessel" | "skin" | "organ";
export interface ManifestItem {
  id: string;
  name: string;
  layer: Layer;
  side: "" | "l" | "r";
  c: number[];
  lo: number[];
  hi: number[];
  tris: number;
}

const DIR = process.argv[2];
const OUT = process.argv[3] ?? "tools/manifest.json";
const OBJ = join(DIR, "obj", "isa_BP3D_4.0_obj_99");

// IS-A categories (FMA concept ids) that decide the layer.
const CAT = {
  muscle: ["FMA5022", "FMA85453", "FMA10474", "FMA9721"],
  bone: ["FMA5018", "FMA55107", "FMA21496"],
  vessel: ["FMA50720", "FMA50723", "FMA50722"],
};
const member = new Map<string, Set<string>>();
for (const line of readFileSync(join(DIR, "isa_element_parts.txt"), "utf8").split("\n").slice(1)) {
  const [concept, , el] = line.split("\t");
  if (!el) continue;
  if (!member.has(el)) member.set(el, new Set());
  member.get(el)!.add(concept);
}

const layerOf = (id: string, name: string): Layer => {
  const set = member.get(id) ?? new Set<string>();
  const n = name.toLowerCase();
  if (/tendon|aponeurosis|linea alba|tendinous|retinaculum|fascia lata|iliotibial|interspinal|levatores|rotatores|intertransvers|multifid|semispinal|lumbrical|interosse/.test(n)) return "muscle";
  if (/arter|palmar arch|plantar arch|venous arch/.test(n)) return "vessel";
  if (CAT.muscle.some((c) => set.has(c))) return "muscle";
  if (CAT.bone.some((c) => set.has(c)) || /\b(bone|vertebra|rib|sternum|tooth|teeth|incisor|canine|molar|premolar|meniscus|cartilage|ligament|disc)\b/.test(n)) return "bone";
  if (CAT.vessel.some((c) => set.has(c)) || /artery|vein|venous|arterial|aorta|vena cava|sinus of dura/.test(n)) return "vessel";
  if (/\bskin\b|integument/.test(n)) return "skin";
  return "organ";
};

const files = readdirSync(OBJ).filter((f) => f.endsWith(".obj")).sort();
const items: ManifestItem[] = [];
for (const file of files) {
  const text = readFileSync(join(OBJ, file), "utf8");
  const id = file.replace(".obj", "");
  const name = (text.match(/# English name : (.*)/)?.[1] ?? id).trim();
  let sx = 0, sy = 0, sz = 0, n = 0;
  const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
  let tris = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) {
      const p = line.slice(2).trim().split(/\s+/).map(Number);
      sx += p[0]; sy += p[1]; sz += p[2]; n++;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
    } else if (line.startsWith("f ")) tris += line.trim().split(/\s+/).length - 3;
  }
  const side = /\bright\b/i.test(name) ? "r" : /\bleft\b/i.test(name) ? "l" : "";
  items.push({ id, name, layer: layerOf(id, name), side, c: [sx / n, sy / n, sz / n].map((v) => +v.toFixed(1)), lo: lo.map((v) => +v.toFixed(1)), hi: hi.map((v) => +v.toFixed(1)), tris });
}
writeFileSync(OUT, JSON.stringify(items));
const by: Partial<Record<Layer, { count: number; tris: number }>> = {};
for (const it of items) (by[it.layer] ??= { count: 0, tris: 0 }), by[it.layer]!.count++, (by[it.layer]!.tris += it.tris);
console.log(`classified ${items.length} meshes`, by);
