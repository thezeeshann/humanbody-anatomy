// Build public/body.glb from BodyParts3D (CC BY 4.0, © The Database Center for Life Science).
// Usage: node tools/build-model.mjs <bodyparts3d dir>                    (run tools/classify.mjs first)
//        node tools/build-model.mjs <bodyparts3d dir> --female <hra dir>  -> public/body-female.glb
// The female body fits the same muscles and skeleton into the Visible Human Female of the Human
// Reference Atlas and takes its skin, breasts, reproductive organs, lungs, liver and pelvis from the
// atlas (tools/female.mjs).
// Every element mesh is simplified, assigned a layer (muscle, bone, organ, vessel, skin) and a clickable
// region, then merged per layer × region. Each merged mesh keeps a table of triangle ranges -> structure
// names in extras, so a click can name the exact muscle or bone.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Document, NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptEncoder } from "meshoptimizer";
import { marchingCubes } from "isosurface";
import { femaleFit, readHra } from "./female.mjs";

const DIR = process.argv[2];
const HRA_DIR = process.argv.includes("--female") ? process.argv[process.argv.indexOf("--female") + 1] : null;
const FEMALE = !!HRA_DIR;
const OBJ = join(DIR, "obj", "isa_BP3D_4.0_obj_99");
const items = JSON.parse(readFileSync("tools/manifest.json", "utf8"));
const byName = (re) => items.filter((it) => re.test(it.name));

// ---------- geometry ----------
const objCache = new Map();
function readObj(id) {
  if (objCache.has(id)) return objCache.get(id);
  const out = parseObj(id);
  if (FEMALE) objCache.set(id, out);
  return out;
}
function parseObj(id) {
  const text = readFileSync(join(OBJ, `${id}.obj`), "utf8");
  const pos = [], nrm = [], idx = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("v ")) pos.push(...line.slice(2).trim().split(/\s+/).map(Number));
    else if (line.startsWith("vn ")) nrm.push(...line.slice(3).trim().split(/\s+/).map(Number));
    else if (line.startsWith("f ")) {
      const f = line.slice(2).trim().split(/\s+/).map((t) => parseInt(t, 10) - 1);
      for (let i = 1; i + 1 < f.length; i++) idx.push(f[0], f[i], f[i + 1]);
    }
  }
  return { pos: new Float32Array(pos), nrm: nrm.length === pos.length ? new Float32Array(nrm) : null, idx: new Uint32Array(idx) };
}
const ends = (id) => {
  const { pos } = readObj(id);
  let lo = Infinity, hi = -Infinity;
  for (let i = 2; i < pos.length; i += 3) (lo = Math.min(lo, pos[i])), (hi = Math.max(hi, pos[i]));
  const band = (hi - lo) * 0.06;
  const mean = (test) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < pos.length; i += 3) if (test(pos[i + 2])) (s[0] += pos[i]), (s[1] += pos[i + 1]), (s[2] += pos[i + 2]), n++;
    return s.map((v) => v / n);
  };
  return { top: mean((z) => z > hi - band), bot: mean((z) => z < lo + band) };
};
const mid = (...ps) => ps[0].map((_, i) => ps.reduce((s, p) => s + p[i], 0) / ps.length);
const one = (re) => {
  const hit = byName(re)[0];
  if (!hit) throw new Error(`landmark not found: ${re}`);
  return hit;
};

// ---------- landmarks from the real bones ----------
const L = {};
for (const [s, Side] of [["r", "right"], ["l", "left"]]) {
  const hum = ends(one(new RegExp(`^${Side} humerus$`, "i")).id);
  const rad = ends(one(new RegExp(`^${Side} radius$`, "i")).id);
  const uln = ends(one(new RegExp(`^${Side} ulna$`, "i")).id);
  const fem = ends(one(new RegExp(`^${Side} femur$`, "i")).id);
  const tib = ends(one(new RegExp(`^${Side} tibia$`, "i")).id);
  const capitate = one(new RegExp(`^${Side} capitate$`, "i")).c;
  const talus = one(new RegExp(`^${Side} talus$`, "i")).c;
  const fingers = byName(new RegExp(`distal phalanx of ${Side} (middle|third) finger`, "i"));
  const toes = byName(new RegExp(`distal phalanx of ${Side} (big toe|first toe|great toe|hallux)`, "i"));
  const wrist = mid(rad.bot, uln.bot);
  const elbow = mid(hum.bot, uln.top);
  const tip = fingers.length ? fingers[0].c : wrist.map((v, i) => v + (wrist[i] - elbow[i]) * 0.7);
  const knee = mid(fem.bot, tib.top);
  const toe = toes.length ? toes[0].c : [talus[0], talus[1] - 180, talus[2] - 30];
  L[s] = { shoulder: hum.top, elbow, wrist, hand: mid(capitate, tip), tip, hip: fem.top, knee, ankle: talus, toe };
}
const z = (re) => one(re).c;
const T = {
  crown: [0, -40, items.reduce((m, it) => Math.max(m, it.hi[2]), -Infinity)],
  chin: one(/^mandible$/i).c,
  c7: z(/^seventh cervical vertebra$/i),
  t1: z(/^first thoracic vertebra$/i),
  t12: z(/^twelfth thoracic vertebra$/i),
  l5: z(/^fifth lumbar vertebra$/i),
  sacrum: z(/^sacrum$/i),
};
const front = (p, dy) => [p[0], p[1] + dy, p[2]];
// Torso axes are pushed forward of the spine so the organs and front muscles sit inside them.
const SEGMENTS = [
  ["head", [0, -100, T.chin[2] + 20], [0, -90, T.crown[2] - 60], 115],
  ["neck", [0, -80, T.c7[2] - 5], [0, -90, T.chin[2] - 10], 75],
  ["chest", front(T.t12, -60), front(T.t1, -50), 165],
  ["abdomen", front(T.l5, -70), front(T.t12, -60), 160],
  ["pelvis", front(T.sacrum, -40).map((v, i) => (i === 2 ? v - 90 : v)), front(T.l5, -60), 160],
];
for (const s of ["r", "l"]) {
  const l = L[s];
  SEGMENTS.push(["upperArm", l.shoulder, l.elbow, 62], ["forearm", l.elbow, l.wrist, 52], ["hand", l.wrist, l.tip, 48], ["thigh", l.hip, l.knee, 95], ["shin", l.knee, l.ankle, 70], ["foot", l.ankle, l.toe, 60]);
}
const JOINTS = [];
for (const s of ["r", "l"]) {
  const l = L[s];
  JOINTS.push(["shoulder", l.shoulder, 55], ["elbow", l.elbow, 38], ["wrist", l.wrist, 26], ["hip", l.hip, 48], ["knee", l.knee, 48], ["ankle", l.ankle, 34]);
}
const distSeg = (p, a, b) => {
  const ab = b.map((v, i) => v - a[i]);
  const ap = p.map((v, i) => v - a[i]);
  const t = Math.max(0, Math.min(1, ap.reduce((s, v, i) => s + v * ab[i], 0) / ab.reduce((s, v) => s + v * v, 0)));
  return Math.hypot(...p.map((v, i) => v - (a[i] + ab[i] * t)));
};
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// ---------- regions ----------
const NAME_RULES = [
  [/\bheart\b|atrium|ventricle|auricle|valve|cardiac|coronary|myocardium|papillary muscle|chordae|interventricular|interatrial|pericardi|trabeculae carneae|conus arteriosus|crista terminalis|fossa ovalis/i, "heart"],
  [/humerus/i, "upperArm"],
  [/\bradius\b|\bulna\b/i, "forearm"],
  [/scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|carpal/i, "wrist"],
  [/metacarp|finger|thumb|palmar|\bhand\b|pollicis|digiti minimi brevis of .* hand|lumbrical of .* hand|interosse.* of .* hand/i, "hand"],
  [/femur/i, "thigh"],
  [/patella|menisc|cruciate|knee|popliteus/i, "knee"],
  [/tibia|fibula/i, "shin"],
  [/talus|achilles|calcaneal tendon/i, "ankle"],
  [/calcaneus|navicular|cuboid|cuneiform|metatars|\btoe\b|hallucis|plantar|of foot|digitorum brevis|abductor digiti minimi of .* foot|quadratus plantae/i, "foot"],
  [/deltoid|supraspinatus|infraspinatus|teres (major|minor)|subscapularis|scapula|clavicle|acromio|coraco|glenoid/i, "shoulder"],
  [/hip bone|ilium|ischium|pubis|pubic|sacrum|sacral|coccy|bladder|prostate|testis|epididym|penis|scrotum|ductus deferens|seminal|rectum|anal|urethra|uterus|ovary|vagina|levator ani|obturator|piriformis|gemellus|iliacus|pelvi/i, "pelvis"],
  [/gluteus|quadratus femoris|tensor fasciae latae/i, "hip"],
  [/\brib\b|costal|sternum|sternal|thoracic vertebra|intercostal|lung|bronch|trachea|pleura|diaphragm|esophag|thymus|mediastin/i, "chest"],
  [/lumbar|liver|hepat|stomach|gastric|duoden|jejun|ileum|ileal|cecum|caecum|colon|colic|sigmoid|appendi|pancrea|spleen|splenic|gallbladder|gall bladder|biliary|cystic duct|bile|kidney|renal|ureter|adrenal|suprarenal|mesenter|omentum|peritone|rectus abdominis|oblique|transversus abdominis|psoas|quadratus lumborum/i, "abdomen"],
  [/cervical vertebra|atlas|axis \(|hyoid|thyroid|cricoid|arytenoid|epiglott|larynx|laryng|pharyn|vocal|sternocleidomastoid|scalen|platysma|longus colli|longus capitis/i, "neck"],
  [/skull|cranial|cranium|frontal|parietal|occipital|temporal|sphenoid|ethmoid|nasal|lacrimal|zygomat|maxill|mandib|palat|vomer|concha|tooth|incisor|canine|molar|gingiva|tongue|brain|cerebr|cerebell|gyrus|lobe of|thalam|hypothal|hippocamp|pons|medulla oblongata|midbrain|colliculus|ventricle of brain|eye|retina|choroid|sclera|cornea|lens|iris|optic|orbit|ocul|rectus$|oblique of eye|ear\b|auricle of|cochlea|tympan|nose|alar|parotid|sublingual|submandibular|masseter|pterygoid|buccinator|orbicularis|zygomaticus|frontalis|temporalis/i, "head"],
];
// A few name rules must not fire on a different structure (e.g. "superior oblique" of the eye vs abdominal obliques).
const regionOf = (it) => {
  const n = it.name;
  if (/oblique/i.test(n) && /eye|ocul|superior oblique|inferior oblique/i.test(n)) return "head";
  if (it.layer === "skin") return "skin";
  if (/lateral ventricle|third ventricle|fourth ventricle|ventricle of brain|cerebral aqueduct/i.test(n)) return "head";
  for (const [re, region] of NAME_RULES) if (re.test(n)) return region;
  const p = it.c;
  const size = Math.hypot(...it.hi.map((v, i) => v - it.lo[i]));
  if (it.layer === "bone" && size < 140) for (const [region, q, r] of JOINTS) if (dist(p, q) < r) return region;
  let best = null, score = Infinity;
  for (const [region, a, b, r] of SEGMENTS) {
    const d = distSeg(p, a, b) / r;
    if (d < score) (score = d), (best = region);
  }
  return best;
};

// ---------- female fit ----------
// BodyParts3D: millimetres, z up, front = -y  ->  metres, y up, front = +z.
const conv = (p) => [p[0] / 1000, p[2] / 1000, -p[1] / 1000];
const convArr = (pos) => {
  const out = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) (out[i] = pos[i] / 1000), (out[i + 1] = pos[i + 2] / 1000), (out[i + 2] = -pos[i + 1] / 1000);
  return out;
};
// Male structures replaced by the female atlas, or with no female counterpart.
const FEMALE_SKIP = {
  skin: /./,
  bone: /hip bone|^sacrum$|coccy/i,
  organ: /penis|testis|epididym|seminal|prostat|scrot|ductus deferens|deferent duct|spermatic|bulbourethral|urethra|urinary bladder|bronch|trachea|caudate lobe of liver/i,
  vessel: /penis|testicular|spermatic|cremaster/i,
  muscle: /cremaster/i,
};
let FIT = null;
if (FEMALE) {
  const male = {
    mesh(re, layer = "bone") {
      const parts = items.filter((it) => re.test(it.name) && (layer === "any" || it.layer === layer)).map((it) => convArr(readObj(it.id).pos));
      const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
      let o = 0;
      for (const p of parts) out.set(p, o), (o += p.length);
      return out;
    },
    disks: {},
    arm: {},
  };
  for (const it of items) {
    const m = it.name.match(/^Intervertebral disk of (.+?)(?: vertebra)?$/i);
    if (m) male.disks[m[1].toLowerCase()] = conv(it.c);
  }
  for (const s of ["r", "l"]) male.arm[s] = { shoulder: conv(L[s].shoulder), elbow: conv(L[s].elbow), wrist: conv(L[s].wrist), tip: conv(L[s].tip) };
  const skinIt = items.find((it) => it.layer === "skin");
  const raw = readObj(skinIt.id).pos;
  const seg = [];
  for (let i = 0; i < raw.length; i += 3) {
    const p = [raw[i], raw[i + 1], raw[i + 2]];
    let best = null, score = Infinity;
    for (const [region, a, b, r] of SEGMENTS) {
      const d = distSeg(p, a, b) / r;
      if (d < score) (score = d), (best = region);
    }
    seg.push(best);
  }
  male.skin = { pos: convArr(raw), seg };
  console.time("female fit");
  FIT = await femaleFit(HRA_DIR, male);
  console.timeEnd("female fit");
}

// ---------- colour ----------
// Atlas-style colours: muscle red-brown with a small per-muscle shift so neighbours separate,
// pale tendons and fascia, ivory bone, bluish cartilage, red arteries, blue veins, yellow nerves.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const ORGAN_COLORS = [
  [/brain|cerebr|cerebell|gyrus|lobe of|thalam|colliculus|pons|medulla|midbrain|hippocamp|white matter|grey matter|gray matter|caudate|putamen|pallid|amygdal|fornix|corpus callosum|pineal|hypothal|stria/i, "#e3a99f"],
  [/spinal cord/i, "#e8cf8a"],
  [/nerve|plexus|ganglion|ramus|optic tract|chiasm/i, "#e5c454"],
  [/eyeball|sclera|cornea|lens|vitreous|chamber of|retina|choroid|iris/i, "#f2efe8"],
  [/lung|bronch|pulmonary segment/i, "#e7a2a0"],
  [/trachea|larynx|pharyn|esophag/i, "#d99a8c"],
  [/liver|hepat|caudate lobe|quadrate lobe/i, "#8f3b2c"],
  [/gallbladder|biliary|bile|cystic duct|hepatic duct/i, "#6f8f3a"],
  [/stomach|gastric|duoden|jejun|ileum|cecum|caecum|colon|sigmoid|rectum|appendi|anal/i, "#e2a587"],
  [/pancrea/i, "#e6c08a"],
  [/spleen|splenic/i, "#7c2f3a"],
  [/kidney|renal/i, "#97382f"],
  [/ureter|bladder|urethra/i, "#e3c27a"],
  [/thyroid|thymus|adrenal|suprarenal|parotid|sublingual|submandibular|gland/i, "#d98b6b"],
  [/tongue|gingiva|lip/i, "#d0756b"],
  [/mesenter|omentum|peritone|pleura|pericardi|membrane|tentorium|falx|dura/i, "#e9d6c4"],
  [/testis|epididym|penis|scrotum|prostate|seminal|ductus deferens/i, "#d79a8a"],
];
const colorOf = (it, k) => {
  const n = it.name;
  const jitter = (c, amt) => c.map((v) => Math.min(1, Math.max(0, v * (1 + (((k * 2654435761) >>> 0) / 4294967296 - 0.5) * amt))));
  if (it.layer === "muscle") return /tendon|aponeurosis|linea alba|tendinous|retinaculum|fascia|iliotibial/i.test(n) ? jitter(hex("#efe3cf"), 0.06) : jitter(hex("#b9573f"), 0.22);
  if (it.layer === "bone") return /cartilage|menisc|disk|disc\b/i.test(n) ? hex("#d9e2e6") : /ligament|membrane/i.test(n) ? hex("#efe6d2") : /tooth|incisor|canine|molar/i.test(n) ? hex("#f7f3ea") : jitter(hex("#e9dcc0"), 0.05);
  // Pulmonary arteries carry oxygen-poor blood, so the atlas convention swaps their colours.
  if (it.layer === "vessel") return /pulmonary/i.test(n) ? (/vein/i.test(n) ? hex("#c23b2f") : hex("#3d5da6")) : /vein|venous|vena|sinus/i.test(n) ? hex("#3d5da6") : hex("#c23b2f");
  if (it.layer === "skin") return hex("#f1d9c8");
  if (/lateral ventricle|third ventricle|fourth ventricle|cerebral aqueduct/i.test(n)) return hex("#cfe0ea");
  if (/\bheart\b|atrium|ventricle|auricle|myocard|papillary|trabecul|cardiac/i.test(n)) return hex("#a8352c");
  if (/valve|chordae|leaflet|cusp/i.test(n)) return hex("#efe0c8");
  for (const [re, c] of ORGAN_COLORS) if (re.test(n)) return hex(c);
  return hex("#d9a092");
};

// Area-weighted vertex normals, for meshes whose shape was changed.
function normalsOf(P, I) {
  const N = new Float32Array(P.length);
  for (let i = 0; i < I.length; i += 3) {
    const [a, b, c] = [I[i] * 3, I[i + 1] * 3, I[i + 2] * 3];
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const k of [a, b, c]) (N[k] += f[0]), (N[k + 1] += f[1]), (N[k + 2] += f[2]);
  }
  for (let i = 0; i < N.length; i += 3) {
    const l = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
    (N[i] /= l), (N[i + 1] /= l), (N[i + 2] /= l);
  }
  return Array.from(N);
}

// ---------- simplify and merge ----------
const RATIO = { muscle: 0.16, bone: 0.3, organ: 0.14, vessel: 0.1, skin: 0.12 };
const SKIP = /pubic hair|hair\b/i;
await MeshoptSimplifier.ready;
await MeshoptEncoder.ready;

const groups = new Map();
const names = [];
const counts = {};
let before = 0, after = 0;
for (const it of items) {
  if (SKIP.test(it.name)) continue;
  if (FEMALE && FEMALE_SKIP[it.layer]?.test(it.name)) continue;
  const region = regionOf(it);
  const key = `${it.layer}:${region}`;
  const { pos, nrm, idx } = readObj(it.id);
  const target = Math.max(36, Math.floor((idx.length * RATIO[it.layer]) / 3) * 3);
  let out = idx;
  if (target < idx.length) {
    const [simple] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02, ["LockBorder"]);
    out = simple.length >= 36 ? simple : idx;
  }
  before += idx.length / 3;
  after += out.length / 3;
  // Compact the vertex buffer to what the simplified index buffer uses.
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const P = [], N = [], I = new Uint32Array(out.length);
  const col = colorOf(it, names.length);
  let next = 0;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (remap[v] < 0) {
      remap[v] = next++;
      // BodyParts3D: millimetres, z up, front = -y  ->  metres, y up, front = +z.
      P.push(pos[v * 3] / 1000, pos[v * 3 + 2] / 1000, -pos[v * 3 + 1] / 1000);
      if (nrm) N.push(nrm[v * 3], nrm[v * 3 + 2], -nrm[v * 3 + 1]);
    }
    I[i] = remap[v];
  }
  if (!groups.has(key)) groups.set(key, { layer: it.layer, region, chunks: [] });
  names.push(it.name);
  const chunk = { P, N, I, col, name: names.length - 1 };
  if (FEMALE) {
    chunk.P = Array.from(FIT.warp(Float32Array.from(P)));
    chunk.N = normalsOf(chunk.P, I);
    if (process.env.DEBUG_RE && new RegExp(process.env.DEBUG_RE, "i").test(it.name)) {
      let lo = [0, Infinity, 0];
      for (let i = 0; i < chunk.P.length; i += 3) if (chunk.P[i + 1] < lo[1]) lo = chunk.P.slice(i, i + 3);
      console.log("  debug", it.name, "lowest", lo.map((v) => v.toFixed(3)).join(", "));
    }
  }
  groups.get(key).chunks.push(chunk);
  counts[key] = (counts[key] ?? 0) + 1;
}

// ---------- derived lung surfaces ----------
// BodyParts3D models each lung as its segmental airway trees and vessels, with no parenchyma mesh.
// Each lung's surface is derived from its own airway tree: a distance field from the airway vertices is
// closed (dilate 18 mm, erode back to 8 mm proud of the tips), iso-surfaced, smoothed and simplified.
function organShell(concept, { layers = ["organ"], close = 18, proud = 8 } = {}) {
  const ids = new Set();
  for (const line of readFileSync(join(DIR, "partof_element_parts.txt"), "utf8").split("\n")) {
    const [c, , el] = line.split("\t");
    if (c === concept && el) ids.add(el.trim());
  }
  const pts = [];
  for (const it of items) if (ids.has(it.id) && layers.includes(it.layer)) pts.push(readObj(it.id).pos);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const pos of pts) for (let i = 0; i < pos.length; i += 3) for (let a = 0; a < 3; a++) (lo[a] = Math.min(lo[a], pos[i + a])), (hi[a] = Math.max(hi[a], pos[i + a]));
  const V = 4, M = 36;
  const o = lo.map((v) => v - M);
  const n = hi.map((v, a) => Math.ceil((v - lo[a] + 2 * M) / V) + 1);
  const at = (x, y, z) => x + n[0] * (y + n[1] * z);
  const BIG = 1e9;
  const chamfer = (D) => {
    const w = [];
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy || dz) w.push([dx, dy, dz, V * Math.hypot(dx, dy, dz)]);
    const fwd = w.filter(([dx, dy, dz]) => dz < 0 || (dz === 0 && (dy < 0 || (dy === 0 && dx < 0))));
    const bwd = w.filter((x) => !fwd.includes(x));
    const pass = (ws, rev) => {
      for (let zi = 0; zi < n[2]; zi++) for (let yi = 0; yi < n[1]; yi++) for (let xi = 0; xi < n[0]; xi++) {
        const z = rev ? n[2] - 1 - zi : zi, y = rev ? n[1] - 1 - yi : yi, x = rev ? n[0] - 1 - xi : xi;
        let d = D[at(x, y, z)];
        for (const [dx, dy, dz, c] of ws) {
          const X = x + dx, Y = y + dy, Z = z + dz;
          if (X < 0 || Y < 0 || Z < 0 || X >= n[0] || Y >= n[1] || Z >= n[2]) continue;
          d = Math.min(d, D[at(X, Y, Z)] + c);
        }
        D[at(x, y, z)] = d;
      }
    };
    pass(fwd, false);
    pass(bwd, true);
    return D;
  };
  const D = new Float32Array(n[0] * n[1] * n[2]).fill(BIG);
  for (const pos of pts) for (let i = 0; i < pos.length; i += 3) D[at(...[0, 1, 2].map((a) => Math.round((pos[i + a] - o[a]) / V)))] = 0;
  chamfer(D);
  const E = new Float32Array(D.length);
  for (let i = 0; i < D.length; i++) E[i] = D[i] <= close ? BIG : 0;
  chamfer(E);
  const { positions, cells } = marchingCubes(n, (x, y, z) => close - proud - E[at(Math.round(x), Math.round(y), Math.round(z))], [[0, 0, 0], n.map((v) => v - 1)]);
  // Marching cubes emits unshared vertices per triangle: weld them so smoothing sees the real neighbours.
  const weld = new Map();
  let P = [];
  const vmap = positions.map(([x, y, z]) => {
    const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!weld.has(k)) weld.set(k, P.push([o[0] + x * V, o[1] + y * V, o[2] + z * V]) - 1);
    return weld.get(k);
  });
  const tris = cells.map((c) => c.map((v) => vmap[v])).filter(([a, b, c]) => a !== b && b !== c && a !== c);
  cells.length = 0;
  cells.push(...tris);
  // Taubin smoothing removes the voxel terraces without shrinking the lung.
  const nb = P.map(() => new Set());
  for (const [a, b, c] of cells) nb[a].add(b).add(c), nb[b].add(a).add(c), nb[c].add(a).add(b);
  for (let it = 0; it < 24; it++) for (const f of [0.6, -0.63]) {
    P = P.map((p, i) => {
      if (!nb[i].size) return p;
      const m = [0, 0, 0];
      for (const j of nb[i]) for (let a = 0; a < 3; a++) m[a] += P[j][a] / nb[i].size;
      return p.map((v, a) => v + f * (m[a] - v));
    });
  }
  const pos = new Float32Array(P.flat());
  let idx = new Uint32Array(cells.flat());
  const [simple] = MeshoptSimplifier.simplify(idx, pos, 3, Math.floor(idx.length * 0.12 / 3) * 3, 0.01, []);
  idx = simple;
  // Outward winding: flip if the signed volume is negative.
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]].map((v) => pos.subarray(v * 3, v * 3 + 3));
    vol += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  if (vol < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const [ia, ib, ic] = [idx[i], idx[i + 1], idx[i + 2]];
    const a = pos.subarray(ia * 3, ia * 3 + 3), b = pos.subarray(ib * 3, ib * 3 + 3), c = pos.subarray(ic * 3, ic * 3 + 3);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const f = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    for (const k of [ia, ib, ic]) for (let a2 = 0; a2 < 3; a2++) nrm[k * 3 + a2] += f[a2];
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    (nrm[i] /= l), (nrm[i + 1] /= l), (nrm[i + 2] /= l);
  }
  return { pos, nrm, idx };
}
const SHELLS = [
  ["FMA7309", "Right lung", "chest", "#eba5a3", {}],
  ["FMA7310", "Left lung", "chest", "#eba5a3", {}],
  ["FMA7197", "Liver", "abdomen", "#9a4434", { layers: ["organ", "vessel"], close: 26, proud: 6 }],
];
for (const [concept, name, region, color, opts] of FEMALE ? [] : SHELLS) {
  const { pos, nrm, idx } = organShell(concept, opts);
  const remap = new Int32Array(pos.length / 3).fill(-1);
  const P = [], N = [], I = new Uint32Array(idx.length);
  let next = 0;
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    if (remap[v] < 0) (remap[v] = next++), P.push(pos[v * 3] / 1000, pos[v * 3 + 2] / 1000, -pos[v * 3 + 1] / 1000), N.push(nrm[v * 3], nrm[v * 3 + 2], -nrm[v * 3 + 1]);
    I[i] = remap[v];
  }
  const key = `lung:${region}`;
  if (!groups.has(key)) groups.set(key, { layer: "lung", region, chunks: [] });
  names.push(`${name} (surface derived from its airways and vessels)`.replace("Right lung (surface derived from its airways and vessels)", "Right lung (surface derived from its airways)").replace("Left lung (surface derived from its airways and vessels)", "Left lung (surface derived from its airways)"));
  groups.get(key).chunks.push({ P, N, I, col: hex(color), name: names.length - 1 });
  counts[key] = (counts[key] ?? 0) + 1;
  after += I.length / 3;
}

// ---------- female atlas structures ----------
// [file, keep (node name), layer, region, simplify ratio]. Layer "lung" is drawn translucent.
const HRA_PARTS = [
  ["3d-vh-f-skin.glb", /skin/, "skin", "skin", 0.14],
  ...["l", "r"].flatMap((s) => [
    [`3d-vh-f-mammary-gland-${s}.glb`, /_fat_/, "lung", "chest", 0.02],
    [`3d-vh-f-mammary-gland-${s}.glb`, /mammary_lobes|lactiferous|nipple|areola_/, "organ", "chest", 0.06],
    [`3d-vh-f-ovary-${s}.glb`, /ovary/, "organ", "pelvis", 1],
    [`3d-vh-f-fallopian-tube-${s}.glb`, /./, "organ", "pelvis", 0.3],
  ]),
  ["3d-vh-f-uterus.glb", /body_of_uterus|fundus|cervix$|lower_uterine|cervicovaginal|cornua/, "organ", "pelvis", 0.3],
  ["3d-vh-f-urinary-bladder.glb", /fundus|trigone/, "organ", "pelvis", 0.12],
  ["3d-vh-f-pelvis.glb", /compact_bone|sacrum|coccyx/, "bone", "pelvis", 0.35],
  ["3d-vh-f-lung.glb", /bronchopulmonary_segm/, "lung", "chest", 0.3],
  ["3d-vh-f-lung.glb", /_bronch(us|i)$/, "organ", "chest", 0.3],
  ["3d-vh-f-main-bronchus.glb", /main_bronchus$/, "organ", "chest", 0.2],
  ["3d-vh-f-trachea.glb", /trachea$|carina/, "organ", "chest", 0.2],
  ["3d-vh-f-liver.glb", /capsule_of_the_liver|falciform|round_ligament/, "organ", "abdomen", 0.25],
  ["3d-vh-f-blood-vasculature.glb", /uterine/, "vessel", "pelvis", 0.3],
];
const ORDINAL = { L: "Left", R: "Right" };
const prettyHra = (node) => {
  let n = node.replace(/^VH_F_/, "").replace(/segmennt|segm$/, "segment").replace("jejenum", "jejunum").replace("_of_the_", "_of_");
  let side = "";
  const m = n.match(/_([LR])$/);
  if (m) (side = ORDINAL[m[1]]), (n = n.slice(0, -2));
  n = n.replace(/_/g, " ").replace(/\bfibria\b/, "fimbriae").replace(/ bronchopulmonary segment/, " segment of lung").replace(/^capsule of liver$/, "liver").replace(/^fat$/, "breast fat");
  if (/^(left|right) /.test(n)) (side = n.startsWith("left") ? "Left" : "Right"), (n = n.replace(/^(left|right) /, ""));
  if (/^lingula /.test(n)) side = side || "Left";
  const full = (side ? `${side} ${n}` : n).trim();
  return full[0].toUpperCase() + full.slice(1);
};
const hraTris = {};
function weld({ pos, idx }) {
  const map = new Map(), P = [], remap = new Uint32Array(pos.length / 3);
  for (let v = 0; v < pos.length / 3; v++) {
    const key = `${Math.round(pos[v * 3] * 1e5)},${Math.round(pos[v * 3 + 1] * 1e5)},${Math.round(pos[v * 3 + 2] * 1e5)}`;
    if (!map.has(key)) map.set(key, P.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) / 3 - 1);
    remap[v] = map.get(key);
  }
  const I = [];
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [remap[idx[i]], remap[idx[i + 1]], remap[idx[i + 2]]];
    if (a !== b && b !== c && a !== c) I.push(a, b, c);
  }
  return { pos: new Float32Array(P), idx: new Uint32Array(I) };
}
if (FEMALE) {
  for (const [file, keep, layer, region, ratio] of HRA_PARTS) {
    for (const raw of await readHra(HRA_DIR, file, (n) => keep.test(n))) {
      const name = prettyHra(raw.node);
      // Atlas meshes split vertices along UV and normal seams; weld them so simplification can work.
      const m = weld(raw);
      const target = Math.max(36, Math.floor((m.idx.length * ratio) / 3) * 3);
      let out = m.idx;
      if (target < m.idx.length) {
        const [simple] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, target, 0.02, ["LockBorder"]);
        out = simple.length >= 36 ? simple : m.idx;
      }
      before += m.idx.length / 3;
      after += out.length / 3;
      hraTris[file] = (hraTris[file] ?? 0) + out.length / 3;
      const remap = new Int32Array(m.pos.length / 3).fill(-1);
      const P = [], I = new Uint32Array(out.length);
      let next = 0;
      for (let i = 0; i < out.length; i++) {
        const v = out[i];
        if (remap[v] < 0) (remap[v] = next++), P.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]);
        I[i] = remap[v];
      }
      // The atlas woman holds her fingers fanned; draw them together like the fitted hand inside.
      if (layer === "skin") FIT.closeHands(P).forEach((v, i) => (P[i] = v));
      const fake = { name, layer: layer === "lung" ? "organ" : layer };
      const col = /breast fat/i.test(name) ? hex("#f2d48c") : /areola|nipple/i.test(name) ? hex("#c98a76") : /mammary lobes|lactiferous/i.test(name) ? hex("#e7b7a6") : /uterus|cervix|cornua|cervicovaginal/i.test(name) ? hex("#c4625a") : /ovary/i.test(name) ? hex("#e9c3b0") : /tube|ostium|fimbri|infundibulum|ampulla|isthmus/i.test(name) ? hex("#dd9a86") : /segment of lung/i.test(name) ? hex("#eba5a3") : /^liver$/i.test(name) ? hex("#8f3b2c") : /ligament/i.test(name) && region === "abdomen" ? hex("#e9d6c4") : colorOf(fake, names.length);
      const key = `${layer}:${region}`;
      if (!groups.has(key)) groups.set(key, { layer, region, chunks: [] });
      names.push(name);
      groups.get(key).chunks.push({ P, N: normalsOf(P, I), I, col, name: names.length - 1 });
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
}

if (FEMALE) console.log("atlas triangles", hraTris);

// Feet on the floor, body centred on the turn axis.
let minY = Infinity, sx = 0, sz = 0, n = 0;
for (const g of groups.values()) for (const c of g.chunks) for (let i = 0; i < c.P.length; i += 3) (minY = Math.min(minY, c.P[i + 1])), (sx += c.P[i]), (sz += c.P[i + 2]), n++;
const OX = sx / n, OZ = sz / n;

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene("body");
for (const [key, g] of [...groups.entries()].sort()) {
  const total = g.chunks.reduce((s, c) => s + c.P.length, 0);
  const tri = g.chunks.reduce((s, c) => s + c.I.length, 0);
  const P = new Float32Array(total), N = new Float32Array(total), C = new Uint8Array((total / 3) * 4), I = new Uint32Array(tri);
  const parts = [];
  let vo = 0, io = 0;
  for (const c of g.chunks) {
    for (let i = 0; i < c.P.length; i += 3) (P[vo + i] = c.P[i] - OX), (P[vo + i + 1] = c.P[i + 1] - minY), (P[vo + i + 2] = c.P[i + 2] - OZ);
    if (c.N.length) N.set(c.N, vo);
    for (let v = vo / 3; v < (vo + c.P.length) / 3; v++) (C[v * 4] = c.col[0] * 255), (C[v * 4 + 1] = c.col[1] * 255), (C[v * 4 + 2] = c.col[2] * 255), (C[v * 4 + 3] = 255);
    const base = vo / 3;
    parts.push([io / 3, c.name]);
    for (let i = 0; i < c.I.length; i++) I[io + i] = c.I[i] + base;
    vo += c.P.length;
    io += c.I.length;
  }
  const prim = doc.createPrimitive()
    .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(P).setBuffer(buffer))
    .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(N).setBuffer(buffer))
    .setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(C).setNormalized(true).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType("SCALAR").setArray(I).setBuffer(buffer));
  const mesh = doc.createMesh(key).addPrimitive(prim);
  scene.addChild(doc.createNode(key).setMesh(mesh).setExtras({ layer: g.layer, region: g.region, parts }));
}
doc.getRoot().setExtras({
  names,
  credit: FEMALE
    ? "Muscles, skeleton, organs and vessels adapted from BodyParts3D, © The Database Center for Life Science, CC BY 4.0; skin, breasts, reproductive organs, bladder, lungs, liver and pelvis from the Human Reference Atlas 3D reference organs (Visible Human Female), HuBMAP, CC BY 4.0"
    : "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International",
});

doc.createExtension(KHRMeshQuantization).setRequired(true);
await doc.transform(quantize({ quantizePosition: 14, quantizeNormal: 10 }), meshopt({ encoder: MeshoptEncoder, level: "high" }));
mkdirSync("public", { recursive: true });
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const glb = await io.writeBinary(doc);
writeFileSync(FEMALE ? "public/body-female.glb" : "public/body.glb", glb);

const summary = {};
for (const [key, c] of Object.entries(counts)) {
  const [layer, region] = key.split(":");
  (summary[region] ??= {})[layer] = c;
}
console.table(summary);
console.log(`triangles ${before.toLocaleString()} -> ${after.toLocaleString()} · ${groups.size} meshes · ${(glb.byteLength / 1048576).toFixed(1)} MB`);
