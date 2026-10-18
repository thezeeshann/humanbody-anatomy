// Human body anatomy: an articulated anatomy mannequin standing on a turning display stand.
// The stand's platter and everything on it is one turn group; each body region is a convex kit part
// whose name is `<region>.<detail>`, so a click maps straight to the region's entry in content.mjs.
// World units: 1 unit = 1 cm of a 172 cm adult. z up, platter top at z = 0, the body faces +y at rest.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import * as G from "../kit/lathe.mjs";
import * as A from "../kit/audit.mjs";
import { turning } from "../kit/turn-build.mjs";
import * as TA from "../kit/turn-audit.mjs";
import { turnScript } from "../scripts/inline-kit.mjs";
import { CONTENT } from "./content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const argv = process.argv.slice(2);

const WIDTH = 560;
const HEIGHT = 760;
const AZIMUTH = 45;
const ELEVATION = 24;

// ---------------- the stand ----------------
const PLINTH = { x: -50, y: -50, w: 100, d: 100, r: 7 };
const PLINTH_Z = -18;
const PLINTH_H = 10;
const TOP = PLINTH_Z + PLINTH_H; // -8
const FOOT_H = 4;
const SCALE_R = 42;
const COLLAR_R = 30;
const PLATTER_R = 34;
const PLATTER_Z = -4;

// ---------------- the body (a 172 cm adult) ----------------
const B = (() => {
  const chest = { z0: 110, z1: 138, r0: 12, r1: 16.5 };
  const slope = (chest.r1 - chest.r0) / (chest.z1 - chest.z0);
  const cosA = 1 / Math.hypot(1, slope);
  const chestR = (z) => chest.r0 + slope * (z - chest.z0);
  // A ball of radius r tangent to the chest cone at height z sits r / cos(α) out from the cone.
  const onChest = (z, r) => chestR(z) + r / cosA;
  const sh = { z: 132, r: 6.5 };
  sh.x = onChest(sh.z, sh.r);
  return {
    head: { r: 9.2, c0: 157.2, c1: 162 },
    neck: { z: 143, r: 5 },
    chest,
    abdomen: { z0: 98, z1: 110, r0: 11.5, r1: 12 },
    pelvis: { z0: 88, z1: 98, r0: 13.5, r1: 11.5 },
    hip: { x: 8, z: 81, r: 7 },
    thigh: { r: 6.5, len: 10 },
    knee: { r: 5.2 },
    shin: { r: 4.8 },
    ankle: { r: 3.6 },
    foot: { h: 6 },
    shoulder: sh,
    arm: { tilt: 8, upper: { r: 4.4, len: 13 }, elbow: { r: 4 }, fore: { r: 3.6, len: 11 }, wrist: { r: 2.6 } },
    heart: { z: 122, r: 3.4, dir: G.unit3([-0.38, 0.92, 0]), at: onChest(122, 3.4) },
    onChest,
  };
})();

const SIDES = [["r", 1], ["l", -1]]; // facing +y, the body's right is +x

const reach = [];
for (let i = 0; i < 24; i++) {
  const a = (i / 24) * Math.PI * 2;
  for (const z of [0, 172]) reach.push([37 * Math.cos(a), 37 * Math.sin(a), z]);
}
export const P = k.fitProjection([...k.boxCorners(PLINTH, PLINTH_Z - FOOT_H, TOP), ...reach], WIDTH, HEIGHT, { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION });
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const mat = (name, svg) => `<g data-mat="${name}">${svg}</g>`;
const VERT = (x, y) => G.frameOf([x, y, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const frameOf = (o, a, u) => {
  const axis = G.unit3(a);
  const uu = G.unit3(G.sub3(u, G.mul3(axis, G.dot3(u, axis))));
  return { o, a: axis, u: uu, v: G.cross3(axis, uu) };
};
const add = (p, d, t) => [p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t];

export const R = A.recorder(P);
const put = (item) => R.put({ ...item, shapes: item.shapes.map((shape, index) => R.solid(Object.assign(shape, { name: shape.name ?? (index ? `${item.name}#${index + 1}` : item.name) }))) });

function stand() {
  // Feet, plinth, inlaid degree scale, bearing collar.
  for (const [x, y] of k.corners(PLINTH, 10)) {
    const svg = mat("slate", S(k.cylinder(x, y, 5.6, PLINTH_Z - FOOT_H, 1.2, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 4.4, PLINTH_Z - FOOT_H + 1.2, FOOT_H - 1.2, P, 28), { tone: "mid" }));
    put({ name: `stand.foot.${x}.${y}`, layer: "back", at: [x, y, PLINTH_Z - FOOT_H], svg, shapes: [A.cylinder(x, y, 5.6, PLINTH_Z - FOOT_H, 1.2, { ground: true }), A.cylinder(x, y, 4.4, PLINTH_Z - FOOT_H + 1.2, FOOT_H - 1.2)] });
  }
  const screws = k.corners(PLINTH, 5.5);
  const plinth = S(k.slabOf(PLINTH, PLINTH_Z, PLINTH_H, P, 8, 1.4), { tone: "mid", inner: L(k.sideSeam(PLINTH, PLINTH_Z + 3.4, P, 8), { tone: "faint" }) }) +
    L(k.planOutline(k.insetPlan(PLINTH, 3.2), TOP, P), { tone: "faint" }) +
    L(screws.map(([x, y]) => k.ring(x, y, 1.6, TOP, P, 16)).join(""), { tone: "lo" }) + D(screws.map(([x, y]) => at([x, y, TOP])), { size: 0.5 });
  put({ name: "stand.plinth", layer: "back", at: [0, 0, PLINTH_Z], bias: 4, svg: mat("bench", plinth), shapes: [A.slab(PLINTH, PLINTH_Z, PLINTH_H, { ground: true })] });

  // A cream degree ring inlaid in the plinth top: 72 ticks, a major every 30°.
  // Ticks hang from the inlay's outer edge; minors end on an inner rule, majors run on to the second.
  const ticks = k.radialTicks(0, 0, SCALE_R, 72, 6, TOP + 0.4, [2.6, 5.2], P);
  const scaleRules = L(k.ring(0, 0, SCALE_R - 2.6, TOP + 0.4, P, 144), { tone: "lo" }) + L(k.ring(0, 0, SCALE_R - 5.2, TOP + 0.4, P, 144), { tone: "lo" });
  const scale = S(k.cylinder(0, 0, SCALE_R, TOP, 0.4, P, 144), { tone: "mid", flat: true }) + scaleRules + L(ticks.minor, { tone: "mid" }) + L(ticks.major, { tone: "hi" });
  put({ name: "stand.scale", layer: "back", at: [0, 0, TOP], svg: mat("cream", scale), shapes: [A.cylinder(0, 0, SCALE_R, TOP, 0.4)] });

  const collar = S(k.cylinder(0, 0, COLLAR_R, TOP + 0.4, PLATTER_Z - TOP - 0.4, P, 72, 0.4), { tone: "mid", inner: L(k.ring(0, 0, COLLAR_R, TOP + 2, P, 72), { tone: "faint" }) });
  put({ name: "stand.collar", layer: "back", at: [0, 0, TOP + 0.4], svg: mat("grey", collar), shapes: [A.cylinder(0, 0, COLLAR_R, TOP + 0.4, PLATTER_Z - TOP - 0.4)] });

  // Index wedge at the front: the zero the readout counts from (the one red accent on the stand).
  const t = (AZIMUTH * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  const wedge = [[SCALE_R + 0.8, -0.8], [SCALE_R + 0.8, 0.8], [SCALE_R + 6.6, 2.6], [SCALE_R + 6.6, -2.6]].map(([r, w]) => [c * r - s * w, s * r + c * w]);
  put({ name: "stand.index", layer: "back", at: [c * (SCALE_R + 3), s * (SCALE_R + 3), TOP], svg: mat("red", S(k.extrude(wedge, TOP, 1.6, P, { bevel: 0.3 }), { tone: "hi" })), shapes: [A.extruded(wedge, TOP, 1.6)] });

  // Label plate on the front-left corner: three engraved rule lines and two screws.
  const LABEL = { x: 27, y: -46, w: 18, d: 9, r: 1.2 };
  const lz = TOP + 0.8;
  const rules = [1, 2, 3].map((i) => k.lineOnTop([LABEL.x + 3, LABEL.y + 1.2 + i * 1.8], [LABEL.x + LABEL.w - 3 - (i === 3 ? 5 : 0), LABEL.y + 1.2 + i * 1.8], lz, P)).join("");
  const labelScrews = [[LABEL.x + 1.6, LABEL.y + LABEL.d / 2], [LABEL.x + LABEL.w - 1.6, LABEL.y + LABEL.d / 2]];
  const label = S(k.slabOf(LABEL, TOP, 0.8, P, 4, 0.3), { tone: "mid" }) + L(rules, { tone: "lo", free: true }) + D(labelScrews.map(([x, y]) => at([x, y, lz])), { size: 0.45 });
  put({ name: "stand.label", layer: "back", at: [LABEL.x, LABEL.y, TOP], svg: mat("cream", label), shapes: [A.slab(LABEL, TOP, 0.8)] });

  // Drive box on the back corner: vents on top, a pilot lamp, and the speed knob beside it.
  const BOX = { x: -46, y: -46, w: 16, d: 14, r: 2 };
  const bz = TOP + 9;
  const vents = [0, 1, 2, 3, 4].map((i) => k.planOutline({ x: BOX.x + 3, y: BOX.y + 2.6 + i * 1.9, w: 8, d: 0.9, r: 0.45 }, bz, P, 3)).join("");
  const box = S(k.slabOf(BOX, TOP, 9, P, 6, 0.8), { tone: "mid", inner: L(k.sideSeam(BOX, TOP + 2.4, P, 6), { tone: "faint" }) }) + L(vents, { tone: "lo" });
  put({ name: "stand.drive", layer: "back", at: [BOX.x, BOX.y, TOP], svg: mat("slate", box), shapes: [A.slab(BOX, TOP, 9)] });
  const lamp = S(k.cylinder(BOX.x + BOX.w - 2.6, BOX.y + BOX.d - 2.6, 1.3, bz, 1, P, 20), { tone: "hi" });
  put({ name: "stand.lamp", layer: "back", at: [BOX.x + BOX.w - 2.6, BOX.y + BOX.d - 2.6, bz], svg: mat("red", lamp), shapes: [A.cylinder(BOX.x + BOX.w - 2.6, BOX.y + BOX.d - 2.6, 1.3, bz, 1)] });
  const KNOB = [-42, 40];
  const knob = S(k.cylinder(KNOB[0], KNOB[1], 3.6, TOP, 3.4, P, 40, 0.4), { tone: "mid", inner: L(k.knurl(KNOB[0], KNOB[1], 3.6, TOP + 0.6, TOP + 2.8, 36, P).front, { tone: "lo" }) }) + D([at([KNOB[0], KNOB[1], TOP + 3.4])], { size: 0.5 });
  put({ name: "stand.knob", layer: "back", at: [KNOB[0], KNOB[1], TOP], svg: mat("grey", knob), shapes: [A.cylinder(KNOB[0], KNOB[1], 3.6, TOP, 3.4)] });
}

// ---------------- live: the platter and the body ----------------
export const T = turning(P, { recorder: R });
const spin = T.group("stand", { turn: { pivot: [0, 0] } });
const body = T.layer("body");
T.stack(["back", "body"]);
export const follow = (values) => values;
export const poses = () => Array.from({ length: 721 }, (_, i) => ({ stand: i * 0.5 }));

const L_ = { group: spin, layer: body };
const ball = (name, c, r, material, extra = {}) => T.ball({ name, ...L_, c, r, tone: "hi", crease: "lo", material, ...extra });
const capsule = (name, a, b, r, material, extra = {}) => {
  const dir = G.sub3(b, a);
  const len = G.len3(dir);
  const up = Math.abs(dir[2]) > 0.99 * len ? [1, 0, 0] : [0, 0, 1];
  return T.round({ name, ...L_, F: frameOf(a, dir, up), s0: 0, s1: len, r, ends: ["dome", "dome"], tone: "hi", crease: "lo", material, ...extra });
};

// Platter: knurled rim, a bolt circle, and a centre cap the feet stand either side of.
T.round({ name: "stand.platter", ...L_, F: VERT(0, 0), s0: PLATTER_Z, s1: 0, r: PLATTER_R, tone: "mid", crease: "lo", material: "grey", details: { ribs: { s0: PLATTER_Z + 0.7, s1: -0.7, count: 160, seams: true, tone: "lo" }, seams: [PLATTER_Z + 0.7, -0.7], bolts: [{ s: 0, r: 29.5, count: 12, size: 0.5, phase: 0.5, tone: "mid" }] } });

function bodyParts() {
  const { head, neck, chest, abdomen, pelvis, hip, thigh, knee, shin, ankle, foot, shoulder, arm, heart } = B;
  // Head: a vertical capsule with eyes and ears; the eyes fade as the face turns away.
  const eyes = [-1, 1].map((sx) => {
    const a = (sx * 24 * Math.PI) / 180;
    return { at: [160.4, head.r * Math.sin(a), head.r * Math.cos(a)], normal: [Math.sin(a), Math.cos(a), 0], size: 1.25, tone: "hi" };
  });
  T.round({ name: "head.skull", ...L_, F: VERT(0, 0), s0: head.c0, s1: head.c1, r: head.r, ends: ["dome", "dome"], fixed: false, tone: "hi", crease: "lo", material: "teal", details: { dots: eyes, rings: eyes.map((e) => ({ at: e.at, normal: e.normal, r: 1.9, tone: "mid" })) } });
  for (const [side, sx] of SIDES) ball(`head.ear.${side}`, [sx * (head.r + 2), 0, 159.4], 2, "teal");
  ball("neck.cervical", [0, 0, neck.z], neck.r, "cream");

  ball("head.nose", [0, head.r + 1.5, 158.2], 1.5, "teal");
  // Rib seams ring the chest; a bead of vertebrae runs down its back, each bead tangent to the cone.
  T.round({ name: "chest.ribcage", ...L_, F: VERT(0, 0), s0: chest.z0, s1: chest.z1, r: [chest.r0, chest.r1], fixed: false, tone: "hi", crease: "lo", material: "orange", details: { seams: [115, 120, 125, 130] } });
  for (let i = 0; i < 7; i++) {
    const z = 113 + i * 3.6;
    ball(`chest.vertebra.${i + 1}`, [0, -B.onChest(z, 1.3), z], 1.3, "cream");
  }
  ball("heart.heart", [heart.dir[0] * heart.at, heart.dir[1] * heart.at, heart.z], heart.r, "red");
  const navelR = abdomen.r0 + ((abdomen.r1 - abdomen.r0) * (103 - abdomen.z0)) / (abdomen.z1 - abdomen.z0);
  T.round({ name: "abdomen.belly", ...L_, F: VERT(0, 0), s0: abdomen.z0, s1: abdomen.z1, r: [abdomen.r0, abdomen.r1], fixed: false, tone: "hi", crease: "lo", material: "gold", details: { seams: [104.5], dots: [{ at: [102.6, 0, navelR], normal: [0, 1, 0], size: 0.9, tone: "hi" }] } });
  T.round({ name: "pelvis.girdle", ...L_, F: VERT(0, 0), s0: pelvis.z0, s1: pelvis.z1, r: [pelvis.r0, pelvis.r1], tone: "hi", crease: "lo", material: "slate" });

  for (const [side, sx] of SIDES) {
    // Leg: hip ball under the pelvis, thigh, knee with its kneecap, shin, ankle, foot. Every contact is tangent or flush.
    const x = sx * hip.x;
    const H = [x, 0, hip.z];
    ball(`hip.joint.${side}`, H, hip.r, "cream");
    const t0 = [x, 0, hip.z - hip.r - thigh.r];
    const t1 = [x, 0, t0[2] - thigh.len];
    capsule(`thigh.femur.${side}`, t1, t0, thigh.r, "peach");
    const K = [x, 0, t1[2] - thigh.r - knee.r];
    ball(`knee.joint.${side}`, K, knee.r, "cream");
    ball(`knee.patella.${side}`, [x, knee.r + 1.6, K[2]], 1.6, "cream");
    const ankleC = [x, 0, foot.h + ankle.r];
    const s0 = [x, 0, K[2] - knee.r - shin.r];
    const s1 = [x, 0, ankleC[2] + ankle.r + shin.r];
    capsule(`shin.tibia.${side}`, s1, s0, shin.r, "peach");
    ball(`ankle.joint.${side}`, ankleC, ankle.r, "cream");
    const outline = [[-3.4, -6], [3.4, -6], [4.6, 3], [4.8, 11], [3.4, 16.4], [0.6, 18.2], [-2.6, 17.6], [-4.4, 12], [-4.6, 3]].map(([px, py]) => [x + sx * px, py]);
    T.prism({ name: `foot.sole.${side}`, ...L_, F: { o: [0, 0, 0], a: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, polygon: outline, round: 1.2, s0: 0, s1: foot.h, bevel: 0.5, tone: "hi", crease: "lo", material: "brown", details: { seams: [1.2] } });

    // Arm: shoulder ball on the chest cone, then upper arm, elbow, forearm, wrist and a flat hand, hanging 8° out.
    const tilt = (arm.tilt * Math.PI) / 180;
    const d = [sx * Math.sin(tilt), 0, -Math.cos(tilt)];
    const Sh = [sx * shoulder.x, 0, shoulder.z];
    ball(`shoulder.joint.${side}`, Sh, shoulder.r, "cream");
    const u0 = add(Sh, d, shoulder.r + arm.upper.r);
    const u1 = add(u0, d, arm.upper.len);
    capsule(`upperArm.humerus.${side}`, u0, u1, arm.upper.r, "peach");
    const E = add(u1, d, arm.upper.r + arm.elbow.r);
    ball(`elbow.joint.${side}`, E, arm.elbow.r, "cream");
    const f0 = add(E, d, arm.elbow.r + arm.fore.r);
    const f1 = add(f0, d, arm.fore.len);
    capsule(`forearm.radius.${side}`, f0, f1, arm.fore.r, "peach");
    const W = add(f1, d, arm.fore.r + arm.wrist.r);
    ball(`wrist.carpals.${side}`, W, arm.wrist.r, "cream");
    const o = add(W, d, arm.wrist.r);
    const lateral = [Math.cos(tilt), 0, sx * Math.sin(tilt)];
    const F = frameOf(o, lateral, [0, 1, 0]);
    const sign = Math.sign(G.dot3(F.v, d));
    const palm = [[-4.2, 0], [4.2, 0], [4.6, 7], [3.8, 13.6], [1.6, 16.2], [-1.6, 16.2], [-3.8, 13.6], [-4.6, 7]].map(([u, t]) => [u, sign * t]);
    T.prism({ name: `hand.palm.${side}`, ...L_, F, polygon: palm, round: 0.8, s0: -1.5, s1: 1.5, bevel: 0.4, tone: "hi", crease: "lo", material: "brown" });
  }
}

stand();
bodyParts();

const verify = argv.includes("--verify");
const out = T.build({ statics: R.items, poses, verify });
A.settle(R, P);
const layerOf = (name) => R.items.filter((item) => item.layer === name).sort((a, b) => a.key - b.key).map((item) => item.svg);
const BACK = [`<path class="iso-halo" d="${k.haloOf(PLINTH, PLINTH_Z - FOOT_H, PLINTH_H, P)}"/>`, ...layerOf("back")];
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  TA.orbitOrExit(T, R, P, { sweep: { at: (x) => follow({ stand: x }), from: 0, to: 360, frame: 0.3 }, quick: argv.includes("--quick"), only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null, log: argv.includes("--verbose") ? (text) => console.log(`  … ${text}`) : null });
}

// ---------------- the page ----------------
const ALT = "An articulated anatomy mannequin, coloured by body region, standing on a turning display stand with a degree scale, a red index, a drive box and a label plate.";
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: ALT, body: BACK });
const stage = `<div class="iso-stage iso-turn hb-stage" tabindex="0" role="slider" aria-label="Anatomy model: drag to turn it, use the arrow keys to turn, click a body part to read about it" aria-valuemin="0" aria-valuemax="359" aria-valuenow="0">${backSvg}${out.layerSvg("body", { width: WIDTH, height: HEIGHT })}</div>`;

const REGIONS = Object.keys(CONTENT);
const swatch = (color) => `<span class="hb-swatch" data-mat="${color}"></span>`;
const legendColors = [["teal", "Nervous"], ["orange", "Respiratory"], ["red", "Heart"], ["gold", "Digestive"], ["slate", "Pelvis"], ["peach", "Muscle & bone"], ["cream", "Joints"], ["brown", "Hands & feet"]];
const chips = REGIONS.map((id) => `<button class="hb-chip" type="button" data-region="${id}">${swatch(CONTENT[id].color)}${CONTENT[id].title}</button>`).join("");
const plate = k.plateHtml({
  fig: "Fig 1",
  title: "Human body",
  hint: "Click a part · drag to turn",
  readout: "θ 0° · —",
  keys: [],
  caption: "",
  body: stage,
});
const DATA = { turn: out.data, content: CONTENT, start: -45 };
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const CSS = k.ISO_CSS + out.css + readFileSync(join(HERE, "page.css"), "utf8");

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Human Body Anatomy</title><meta name="description" content="An interactive 3D anatomy model. Click any part of the body to learn what it is and how it works."><style>${CSS}</style></head>
<body class="iso" data-theme="light"><div class="hb-app">
<main class="hb-main">
  <section class="hb-fig">${plate}</section>
  <section class="hb-side">
    <header class="hb-head"><p class="hb-kicker">Interactive anatomy</p><h1>The Human Body</h1><p class="hb-lede">A 172 cm adult as an articulated anatomy model on a turning stand. Click any part of the body, or pick one below, to see what it is and how it works.</p></header>
    <div class="hb-legend" aria-label="Colour key">${legendColors.map(([c, label]) => `<span class="hb-key">${swatch(c)}${label}</span>`).join("")}</div>
    <nav class="hb-chips" aria-label="Body parts">${chips}</nav>
    <p class="hb-credit">Facts drawn from <a href="https://www.innerbody.com/htm/body.html" target="_blank" rel="noopener">innerbody.com</a>. Drawn with the Anatomy kit; palette after the community Geneva drive figure by @nader0913.</p>
  </section>
</main>
<aside class="hb-panel" aria-live="polite" aria-hidden="true" tabindex="-1">
  <button class="hb-close" type="button" aria-label="Close panel">×</button>
  <div class="hb-panel-body"></div>
</aside>
</div>
<script type="module">${(turnScript() + LIVE).replace(/<\/(script)/gi, "<\\/$1")}</script></body></html>`;

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const name = verify ? "index-verify.html" : "index.html";
  writeFileSync(join(ROOT, name), page);
  console.log(`wrote ${name} · ${(page.length / 1024).toFixed(0)} KB · ${out.report.parts} parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.framed} framed, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s`);
}

export { out };
