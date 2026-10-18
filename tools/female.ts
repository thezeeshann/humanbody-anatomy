// Fit the BodyParts3D (male) muscles and skeleton into the Visible Human Female body of the Human
// Reference Atlas (HuBMAP, CC BY 4.0), and pick the female-specific structures from the atlas.
//
// BodyParts3D has no female model. The atlas has a real female skin surface, breasts, reproductive
// organs, lungs, liver, pelvis and leg bones, but no full muscle layer or skeleton. So the male model is
// warped into the female body:
//   1. Bones and joints first. The thighs and shins are mapped onto the female femurs and tibias, the
//      spine disc by disc, the pelvis by its landmarks (iliac spines, crests, pubis, ischia), the arms
//      by a rotation about the shoulder to the female arm line, and the head by a similarity. A
//      thin-plate spline through those correspondences carries every vertex.
//   2. Then the surface. Each male skin point (after step 1) is pulled to the nearest female skin point
//      (not on the hands, feet, head or breasts), while the bone landmarks stay put, through a second
//      spline. Muscles between bone and skin take the share of that pull their depth gives them.
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import type { HitPointInfo } from "three-mesh-bvh";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { join } from "node:path";

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

export type V = number[];
export type Side = "l" | "r";
// A triangle mesh from the atlas: world-space packed xyz and its triangle indices.
export interface HraMesh {
  node: string;
  pos: Float32Array;
  idx: Uint32Array;
}
// What the model builder knows of the male body, in the output frame (metres, y up, +z front).
export interface MaleBody {
  mesh(re: RegExp, layer?: string): Float32Array;
  skin: { pos: Float32Array; seg: (string | null)[] };
  disks: Record<string, V>;
  arm: Record<Side, { shoulder: V; elbow: V; wrist: V; tip: V }>;
}
export interface FemaleFit {
  warp: (P: Float32Array) => Float32Array;
  closeHands: (P: Float32Array | number[]) => Float32Array;
  floor: number;
  skin: { pos: Float32Array; idx: Uint32Array };
}
type Map3 = (p: V) => V;

// ---------- reading the atlas ----------
export async function readHra(dir: string, file: string, keep: (name: string) => boolean = () => true): Promise<HraMesh[]> {
  const doc = await io.read(join(dir, file));
  const out: HraMesh[] = [];
  doc.getRoot().listScenes()[0].traverse((n) => {
    const m = n.getMesh();
    if (!m || !keep(n.getName())) return;
    const W = n.getWorldMatrix();
    const det = W[0] * (W[5] * W[10] - W[6] * W[9]) - W[4] * (W[1] * W[10] - W[2] * W[9]) + W[8] * (W[1] * W[6] - W[2] * W[5]);
    const pos: number[] = [], idx: number[] = [];
    for (const p of m.listPrimitives()) {
      if (p.getMode() !== 4) continue;
      const a = p.getAttribute("POSITION")!, base = pos.length / 3, v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        pos.push(W[0] * v[0] + W[4] * v[1] + W[8] * v[2] + W[12], W[1] * v[0] + W[5] * v[1] + W[9] * v[2] + W[13], W[2] * v[0] + W[6] * v[1] + W[10] * v[2] + W[14]);
      }
      const ix = p.getIndices();
      const count = ix ? ix.getCount() : a.getCount();
      for (let i = 0; i < count; i += 3) {
        const t = [0, 1, 2].map((k) => base + (ix ? ix.getScalar(i + k) : i + k));
        idx.push(...(det < 0 ? [t[0], t[2], t[1]] : t));
      }
    }
    if (idx.length) out.push({ node: n.getName(), pos: new Float32Array(pos), idx: new Uint32Array(idx) });
  });
  return out;
}
const concat = (meshes: { pos: Float32Array; idx?: Uint32Array }[]) => {
  const n = meshes.reduce((s, m) => s + m.pos.length, 0);
  const pos = new Float32Array(n);
  const idx: number[] = [];
  let o = 0;
  for (const m of meshes) {
    pos.set(m.pos, o);
    if (m.idx) for (const i of m.idx) idx.push(i + o / 3);
    o += m.pos.length;
  }
  return { pos, idx: new Uint32Array(idx) };
};

// ---------- small geometry ----------
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V) => mul(a, 1 / (len(a) || 1));
const mid = (...ps: V[]) => mul(ps.reduce(add), 1 / ps.length);
function bandMean(pos: Float32Array, end: "top" | "bot", frac = 0.06) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 1; i < pos.length; i += 3) (lo = Math.min(lo, pos[i])), (hi = Math.max(hi, pos[i]));
  const cut = end === "top" ? hi - (hi - lo) * frac : lo + (hi - lo) * frac;
  const s = [0, 0, 0];
  let n = 0;
  for (let i = 0; i < pos.length; i += 3) if (end === "top" ? pos[i + 1] >= cut : pos[i + 1] <= cut) (s[0] += pos[i]), (s[1] += pos[i + 1]), (s[2] += pos[i + 2]), n++;
  return mul(s, 1 / n);
}
const centroid = (pos: ArrayLike<number>) => {
  const s = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) (s[0] += pos[i]), (s[1] += pos[i + 1]), (s[2] += pos[i + 2]);
  return mul(s, 3 / pos.length);
};
function extreme(pos: Float32Array, score: (p: V) => number): V {
  let best = -Infinity, at: V | null = null;
  for (let i = 0; i < pos.length; i += 3) {
    const p = [pos[i], pos[i + 1], pos[i + 2]];
    const s = score(p);
    if (s > best) (best = s), (at = p);
  }
  return at!;
}
// Rotation taking unit vector a onto unit vector b, as a function.
function rotBetween(a: V, b: V): Map3 {
  const v = cross(a, b), c = dot(a, b), s = len(v);
  if (s < 1e-9) return (p: V) => p.slice();
  const k = mul(v, 1 / s), ang = Math.atan2(s, c), cs = Math.cos(ang), sn = Math.sin(ang);
  return (p: V) => add(add(mul(p, cs), mul(cross(k, p), sn)), mul(k, dot(k, p) * (1 - cs)));
}
// A bone's similarity: male segment a→b onto female segment A→B (minimal rotation, isotropic scale).
function boneMap(a: V, b: V, A: V, B: V): Map3 {
  const R = rotBetween(norm(sub(b, a)), norm(sub(B, A)));
  const s = len(sub(B, A)) / len(sub(b, a));
  return (q: V) => add(A, mul(R(sub(q, a)), s));
}
// A similarity fixed by three points: a→b sets the axis and scale, c sets the roll.
function tripleMap(a: V, b: V, c: V, A: V, B: V, C: V): Map3 {
  const ortho = (p: V, q: V, r: V) => {
    const e1 = norm(sub(q, p)), x = sub(r, p), e2 = norm(sub(x, mul(e1, dot(x, e1))));
    return [e1, e2, cross(e1, e2)];
  };
  const [m1, m2, m3] = ortho(a, b, c), [f1, f2, f3] = ortho(A, B, C);
  const s = len(sub(B, A)) / len(sub(b, a));
  return (q: V) => {
    const v = sub(q, a);
    return add(A, mul(add(add(mul(f1, dot(v, m1)), mul(f2, dot(v, m2))), mul(f3, dot(v, m3))), s));
  };
}

// Points of a frame around a male segment: stations along it with a ring of four around each.
function frame(a: V, b: V, rad: number, ts = [0.2, 0.35, 0.5, 0.65, 0.8]) {
  const d = norm(sub(b, a));
  const u = norm(cross(d, Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), w = cross(d, u);
  const out: V[] = [];
  for (const t of ts) {
    const c = add(a, mul(sub(b, a), t));
    out.push(c, add(c, mul(u, rad)), add(c, mul(u, -rad)), add(c, mul(w, rad)), add(c, mul(w, -rad)));
  }
  return out;
}

// ---------- thin-plate spline (3D, kernel r) ----------
function tps(src: V[], dst: V[], lambda = 0) {
  const n = src.length, N = n + 4;
  const A = new Float64Array(N * N), B = new Float64Array(N * 3);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i * N + j] = len(sub(src[i], src[j])) + (i === j ? lambda : 0);
    const row = [1, ...src[i]];
    for (let k = 0; k < 4; k++) (A[i * N + n + k] = row[k]), (A[(n + k) * N + i] = row[k]);
    for (let c = 0; c < 3; c++) B[i * 3 + c] = dst[i][c] - src[i][c];
  }
  // Gaussian elimination with partial pivoting, three right-hand sides.
  for (let col = 0; col < N; col++) {
    let p = col;
    for (let r = col + 1; r < N; r++) if (Math.abs(A[r * N + col]) > Math.abs(A[p * N + col])) p = r;
    if (p !== col) {
      for (let k = 0; k < N; k++) [A[col * N + k], A[p * N + k]] = [A[p * N + k], A[col * N + k]];
      for (let c = 0; c < 3; c++) [B[col * 3 + c], B[p * 3 + c]] = [B[p * 3 + c], B[col * 3 + c]];
    }
    const piv = A[col * N + col];
    if (Math.abs(piv) < 1e-14) throw new Error("singular spline system (duplicate landmarks?)");
    for (let r = col + 1; r < N; r++) {
      const f = A[r * N + col] / piv;
      if (!f) continue;
      for (let k = col; k < N; k++) A[r * N + k] -= f * A[col * N + k];
      for (let c = 0; c < 3; c++) B[r * 3 + c] -= f * B[col * 3 + c];
    }
  }
  const X = new Float64Array(N * 3);
  for (let r = N - 1; r >= 0; r--)
    for (let c = 0; c < 3; c++) {
      let s = B[r * 3 + c];
      for (let k = r + 1; k < N; k++) s -= A[r * N + k] * X[k * 3 + c];
      X[r * 3 + c] = s / A[r * N + r];
    }
  const S = new Float64Array(src.flat());
  // Returns a function that maps a packed xyz array in place.
  return (P: Float32Array) => {
    for (let v = 0; v < P.length; v += 3) {
      const x = P[v], y = P[v + 1], z = P[v + 2];
      let dx = X[n * 3] + X[(n + 1) * 3] * x + X[(n + 2) * 3] * y + X[(n + 3) * 3] * z;
      let dy = X[n * 3 + 1] + X[(n + 1) * 3 + 1] * x + X[(n + 2) * 3 + 1] * y + X[(n + 3) * 3 + 1] * z;
      let dz = X[n * 3 + 2] + X[(n + 1) * 3 + 2] * x + X[(n + 2) * 3 + 2] * y + X[(n + 3) * 3 + 2] * z;
      for (let i = 0; i < n; i++) {
        const r = Math.hypot(x - S[i * 3], y - S[i * 3 + 1], z - S[i * 3 + 2]);
        dx += X[i * 3] * r;
        dy += X[i * 3 + 1] * r;
        dz += X[i * 3 + 2] * r;
      }
      P[v] = x + dx;
      P[v + 1] = y + dy;
      P[v + 2] = z + dz;
    }
    return P;
  };
}
// Drop landmarks closer than `eps` to one already kept (a spline can't take two at one place).
function dedupe(src: V[], dst: V[], eps = 0.006): [V[], V[]] {
  const S: V[] = [], D: V[] = [];
  const grid = new Map<string, number[]>();
  const keyOf = (p: V) => p.map((v) => Math.floor(v / eps)).join(",");
  outer: for (let i = 0; i < src.length; i++) {
    const p = src[i];
    const k = p.map((v) => Math.floor(v / eps));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = grid.get(`${k[0] + dx},${k[1] + dy},${k[2] + dz}`);
      if (list) for (const j of list) if (len(sub(S[j], p)) < eps) continue outer;
    }
    const key = keyOf(p);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(S.length);
    S.push(p);
    D.push(dst[i]);
  }
  return [S, D];
}
// Even spread of sample points: one per voxel of size `cell`.
function spread(points: V[], cell: number) {
  const seen = new Set<string>(), out: V[] = [];
  for (const p of points) {
    const k = p.map((v) => Math.floor(v / cell)).join(",");
    if (!seen.has(k)) seen.add(k), out.push(p);
  }
  return out;
}
const bvhOf = ({ pos, idx }: { pos: Float32Array; idx: Uint32Array }) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return { g, bvh: new MeshBVH(g) };
};

// ---------- closing the hands ----------
// The atlas woman holds her fingers fanned wide. Each hand gets a frame from its skin: u along the hand
// from the wrist, v across the palm, w through it, and a pivot (see PASSES). Seen from that pivot each finger covers a band of angles with empty gaps between them. The gaps are shrunk and the
// fingers kept, so every finger turns in towards the middle of the hand at its own width.
// Share of each gap between the fingers that stays open: little on the skin, more between the finger
// bones, where the gap is flesh.
const GAP_KEEP = { skin: 0.05, inner: 0.25 };
// Two passes per hand. The thumb grows from the carpus and the atlas holds it out almost square to the
// hand, so it turns about a pivot by the wrist, by its distance from there. Then the four fingers turn
// about a pivot just short of the knuckles, more towards the tips. u0 is the pivot as a fraction of the
// hand length; read(u, r) picks the points whose angles mark the fingers; reach(u, r) is how much of the
// turn a point takes (u along the hand from the wrist and r from the pivot, in metres; L the hand length).
interface Pass {
  name: string;
  u0: number;
  read: (u: number, r: number, L: number) => boolean;
  reach: (u: number, r: number, L: number) => number;
}
interface HandFrame extends Pass {
  wrist: V;
  pivot: V;
  e1: V;
  e2: V;
  e3: V;
  L: number;
  to: number[];
}
const PASSES: Pass[] = [
  { name: "thumb", u0: 0.05, read: (u, r) => r > 0.05, reach: (u, r) => smooth(0.025, 0.055, r) * smooth(-0.01, 0.015, u) },
  { name: "fingers", u0: 0.35, read: (u, r, L) => u > 0.6 * L, reach: (u, r, L) => smooth(0.4 * L, 0.62 * L, u) * (1 - smooth(L + 0.01, L + 0.05, u)) },
];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function handFrame(pos: Float32Array, wrist: V, armDir: V, side: number, keep: number, pass: Pass): HandFrame {
  const pts: V[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    const p = [pos[i], pos[i + 1], pos[i + 2]], d = sub(p, wrist), u = dot(d, armDir);
    if (u > 0.005 && u < 0.24 && len(sub(d, mul(armDir, u))) < 0.09 && side * p[0] > 0) pts.push(p);
  }
  const c = centroid(pts.flat());
  // Principal axes by power iteration on the covariance: e1 along the hand, e2 across the palm.
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = sub(p, c);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
  }
  const axis = (deflate: V[]) => {
    let v = [0.3, 0.5, 0.8];
    for (let it = 0; it < 60; it++) {
      for (const e of deflate) v = sub(v, mul(e, dot(v, e)));
      v = norm(C.map((row) => dot(row, v)));
    }
    return v;
  };
  let e1 = axis([]);
  if (dot(e1, armDir) < 0) e1 = mul(e1, -1);
  const e2 = axis([e1]), e3 = cross(e1, e2);
  let L = 0;
  for (const p of pts) L = Math.max(L, dot(sub(p, wrist), e1));
  const pivot = add(add(wrist, mul(e1, pass.u0 * L)), mul(e2, dot(sub(c, wrist), e2)));
  // Angle density of the fingers seen from the pivot, in 1° bins from -180° to 180°.
  const dens: number[] = new Array(361).fill(0);
  for (const p of pts) {
    const d = sub(p, pivot), a = dot(d, e1), b = dot(d, e2);
    if (pass.read(dot(sub(p, wrist), e1), Math.hypot(a, b), L)) dens[Math.round((Math.atan2(b, a) * 180) / Math.PI) + 180]++;
  }
  const sm = dens.map((_, i) => (dens[i - 1] ?? 0) * 0.25 + dens[i] * 0.5 + (dens[i + 1] ?? 0) * 0.25);
  const peak = [...sm].sort((x, y) => y - x)[Math.floor(sm.filter(Boolean).length * 0.2)] || 1;
  // New angle for each old one: full steps across a finger, short steps across a gap, measured out
  // from the middle of the hand so both sides close towards it.
  const slope = sm.map((n) => keep + (1 - keep) * smooth(0.15, 0.45, n / peak));
  const to: number[] = new Array(361).fill(0);
  for (let i = 181; i <= 360; i++) to[i] = to[i - 1] + (slope[i - 1] + slope[i]) / 2;
  for (let i = 179; i >= 0; i--) to[i] = to[i + 1] - (slope[i + 1] + slope[i]) / 2;
  const first = sm.findIndex((n) => n > 0.15 * peak), last = sm.findLastIndex((n) => n > 0.15 * peak);
  console.log(`  female: hand fan, ${pass.name} pass (${keep === GAP_KEEP.skin ? "skin" : "bones"}) ${last - first}° → ${(to[last] - to[first]).toFixed(0)}°`);
  return { wrist, pivot, e1, e2, e3, L, to, ...pass };
}
// The frames of both passes for one hand, each read from the points as the passes before left them.
function handFrames(pos: Float32Array, wrist: V, armDir: V, side: number, keep: number) {
  let P: Float32Array = Float32Array.from(pos);
  return PASSES.map((pass) => {
    const h = handFrame(P, wrist, armDir, side, keep, pass);
    P = closeHands(P, [h]);
    return h;
  });
}
function closeHands(P: Float32Array | number[], hands: HandFrame[]) {
  const out = P instanceof Float32Array ? P : Float32Array.from(P);
  for (const h of hands) {
    for (let i = 0; i < out.length; i += 3) {
      const d = [out[i] - h.pivot[0], out[i + 1] - h.pivot[1], out[i + 2] - h.pivot[2]];
      const a = dot(d, h.e1), b = dot(d, h.e2), w = dot(d, h.e3), u = a + h.u0 * h.L, r = Math.hypot(a, b);
      // The pass's own reach, fading out at the edges of the hand box.
      const s = h.reach(u, r, h.L) * (1 - smooth(0.05, 0.08, Math.abs(w))) * (1 - smooth(0.11, 0.15, r));
      if (!s) continue;
      const phi = (Math.atan2(b, a) * 180) / Math.PI, x = Math.max(0, Math.min(359.999, phi + 180)), k = Math.floor(x);
      const turn = ((h.to[k] + (h.to[k + 1] - h.to[k]) * (x - k) - phi) * s * Math.PI) / 180;
      const cs = Math.cos(turn), sn = Math.sin(turn), da = a * cs - b * sn - a, db = a * sn + b * cs - b;
      for (let j = 0; j < 3; j++) out[i + j] += h.e1[j] * da + h.e2[j] * db;
    }
  }
  return out;
}

// ---------- the fit ----------
const FAT_FOLLOW = 0.4;
// male: { mesh(re) -> Float32Array of all matching male meshes in the output frame (metres, y up, +z front),
//         skin: { pos, seg } with seg[i] the body segment of each skin vertex, disks: { level: centroid }, tip: { r, l } }
export async function femaleFit(hraDir: string, male: MaleBody): Promise<FemaleFit> {
  const log = (...a: unknown[]) => console.log("  female:", ...a);
  const H = (f: string, keep?: (name: string) => boolean) => readHra(hraDir, f, keep);
  const skin = concat(await H("3d-vh-f-skin.glb"));
  const knees: Record<Side, HraMesh[]> = { l: await H("3d-vh-f-knee-l.glb"), r: await H("3d-vh-f-knee-r.glb") };
  const pelvis = await H("3d-vh-f-pelvis.glb");
  const disks = await H("3d-vh-f-intervertebral-disk.glb", (n) => !/nucleus/.test(n));
  const sternumF = concat(await H("3d-vh-f-sternum.glb")), manubriumF = concat(await H("3d-vh-f-manubrium.glb"));
  const mammary = concat([...(await H("3d-vh-f-mammary-gland-l.glb")), ...(await H("3d-vh-f-mammary-gland-r.glb"))]);

  const fem = (s: Side, re: RegExp) => concat(knees[s].filter((m) => re.test(m.node)));
  const ySkin = (pos: Float32Array) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 1; i < pos.length; i += 3) (lo = Math.min(lo, pos[i])), (hi = Math.max(hi, pos[i]));
    return [lo, hi];
  };
  const [fFloor, fCrown] = ySkin(skin.pos), [mFloor, mCrown] = ySkin(male.skin.pos);
  const k = (fCrown - fFloor) / (mCrown - mFloor);
  log(`heights male ${(mCrown - mFloor).toFixed(3)} m, female ${(fCrown - fFloor).toFixed(3)} m, scale ${k.toFixed(3)}`);

  const src: V[] = [], dst: V[] = [];
  const pin = (m: V, f: V) => (src.push(m), dst.push(f));

  // Legs: femur and tibia ends of both bodies.
  const legMaps = {} as Record<Side, { m: Record<"hip" | "knee" | "ankle", V>; f: Record<"hip" | "knee" | "ankle", V>; shin: Map3 }>;
  for (const s of ["l", "r"] as const) {
    const Side = s === "l" ? "Left" : "Right";
    const mF = male.mesh(new RegExp(`^${Side} femur$`, "i")), mT = male.mesh(new RegExp(`^${Side} tibia$`, "i"));
    const fF = fem(s, /_femur_/), fT = fem(s, /_tibia_/);
    const m = { hip: bandMean(mF, "top"), knee: mid(bandMean(mF, "bot"), bandMean(mT, "top")), ankle: bandMean(mT, "bot") };
    const f = { hip: bandMean(fF.pos, "top"), knee: mid(bandMean(fF.pos, "bot"), bandMean(fT.pos, "top")), ankle: bandMean(fT.pos, "bot") };
    // The axes only, without twist: the atlas tibias are turned out against their feet, and the male
    // feet must keep pointing forward like the female skin's.
    const thigh = boneMap(m.hip, m.knee, f.hip, f.knee), shin = boneMap(m.knee, m.ankle, f.knee, f.ankle);
    legMaps[s] = { m, f, shin };
    for (const p of frame(m.hip, m.knee, 0.045)) pin(p, thigh(p));
    for (const p of frame(m.knee, m.ankle, 0.03)) pin(p, shin(p));
    pin(m.knee, f.knee);
    // The foot: heel, toe and ankle of the male foot onto the female foot's, heel and toe from the skin.
    const side = s === "l" ? 1 : -1;
    const footEnds = (pos: Float32Array, floor: number, ankle: V) => {
      const near = (p: V) => p[1] < floor + 0.035 && Math.sign(p[0]) === side && Math.abs(p[0] - ankle[0]) < 0.09;
      return { heel: extreme(pos, (p) => (near(p) ? -p[2] : -Infinity)), toe: extreme(pos, (p) => (near(p) ? p[2] : -Infinity)) };
    };
    const mf = footEnds(male.skin.pos, mFloor, m.ankle), ff = footEnds(skin.pos, fFloor, f.ankle);
    const footMap = tripleMap(mf.heel, mf.toe, m.ankle, ff.heel, ff.toe, f.ankle);
    const turn = (e: { heel: V; toe: V }) => (Math.atan2(e.toe[0] - e.heel[0], e.toe[2] - e.heel[2]) * 180) / Math.PI;
    log(`${s} foot: male toe-out ${turn(mf).toFixed(1)}°, female ${turn(ff).toFixed(1)}°, length ×${(len(sub(ff.toe, ff.heel)) / len(sub(mf.toe, mf.heel))).toFixed(3)}`);
    const foot = male.mesh(new RegExp(`^${Side} (talus|calcaneus|navicular|cuboid)$|^${Side} (first|second|third|fourth|fifth) metatarsal|phalanx of ${Side.toLowerCase()} .*toe`, "i"));
    for (const p of spread(Array.from({ length: foot.length / 3 }, (_, i) => [foot[i * 3], foot[i * 3 + 1], foot[i * 3 + 2]]), 0.025)) pin(p, footMap(p));
  }

  // Spine: disc centres level by level.
  const LEVELS = ["axis", "third cervical", "fourth cervical", "fifth cervical", "sixth cervical", "seventh cervical", ...["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"].map((o) => `${o} thoracic`), ...["first", "second", "third", "fourth", "fifth"].map((o) => `${o} lumbar`)];
  const spine: { m: V; f: V }[] = [];
  for (const lv of LEVELS) {
    const fm = disks.find((d) => d.node === `VH_F_intervertebral_disk_of_${lv.replace(" ", "_")}_vertebra` || (lv === "axis" && d.node === "VH_F_intervertebral_disk_of_axis"));
    const mp = male.disks[lv];
    if (!fm || !mp) continue;
    spine.push({ m: mp, f: centroid(fm.pos) });
  }
  spine.sort((a, b) => a.m[1] - b.m[1]);
  log(`spine levels matched: ${spine.length}`);
  for (const { m, f } of spine) pin(m, f);
  // Map a male point by the spine level at its height (for the ribs, vertebrae and head).
  const byLevel = (q: V) => {
    let i = 0;
    while (i < spine.length - 2 && spine[i + 1].m[1] < q[1]) i++;
    const a = spine[i], b = spine[i + 1];
    const t = Math.max(0, Math.min(1, (q[1] - a.m[1]) / (b.m[1] - a.m[1])));
    const mc = add(a.m, mul(sub(b.m, a.m), t)), fc = add(a.f, mul(sub(b.f, a.f), t));
    // Above or below the matched discs, carry on with the end segment's offset.
    const over = q[1] > b.m[1] ? q[1] - b.m[1] : q[1] < a.m[1] && i === 0 ? q[1] - a.m[1] : 0;
    return add(add(fc, [0, over * k, 0]), mul(sub(q, add(mc, [0, over, 0])), k));
  };
  // Ribs and vertebrae ride with their spine level.
  const cage = male.mesh(/\brib\b|thoracic vertebra|lumbar vertebra|cervical vertebra|^atlas|^axis/i);
  const cagePts = spread(Array.from({ length: cage.length / 3 }, (_, i) => [cage[i * 3], cage[i * 3 + 1], cage[i * 3 + 2]]), 0.04);
  for (const p of cagePts) pin(p, byLevel(p));

  // Pelvis landmarks on each hip bone.
  const hipF = (s: Side) => concat(pelvis.filter((m) => new RegExp(`_compact_bone_${s.toUpperCase()}$`).test(m.node)));
  const sacrumF = concat(pelvis.filter((m) => /sacrum/.test(m.node))), coccyxF = concat(pelvis.filter((m) => /coccyx/.test(m.node)));
  const pelvisMarks = (pos: Float32Array, side: number) => {
    return [
      extreme(pos, (p) => p[2] + 0.3 * p[1]), // anterior superior iliac spine
      extreme(pos, (p) => p[1]), // top of the iliac crest
      extreme(pos, (p) => -side * p[0]), // pubic symphysis face (the most medial point)
      extreme(pos, (p) => -p[1]), // ischial tuberosity
      extreme(pos, (p) => side * p[0]), // widest point of the ala
    ];
  };
  for (const [s, side] of [["l", 1], ["r", -1]] as const) {
    const mm = pelvisMarks(male.mesh(new RegExp(`^${s === "l" ? "Left" : "Right"} hip bone$`, "i")), side), fm = pelvisMarks(hipF(s).pos, side);
    mm.forEach((p, i) => pin(p, fm[i]));
  }
  const mSac = male.mesh(/^sacrum$/i), mCoc = male.mesh(/coccy/i);
  pin(centroid(mSac), centroid(sacrumF.pos));
  pin(extreme(mSac, (p) => p[1] + p[2] * 0.5), extreme(sacrumF.pos, (p) => p[1] + p[2] * 0.5));
  if (mCoc.length) pin(extreme(mCoc, (p) => -p[1]), extreme(coccyxF.pos, (p) => -p[1]));

  // Sternum: top of the manubrium and the lower end of the body of the sternum.
  const mMan = male.mesh(/^manubrium$/i, "any"), mSt = male.mesh(/^body of sternum$/i, "any");
  pin(extreme(mMan, (p) => p[1]), extreme(manubriumF.pos, (p) => p[1]));
  pin(extreme(mSt, (p) => -p[1]), extreme(sternumF.pos, (p) => -p[1]));
  pin(centroid(mSt), centroid(sternumF.pos));

  // Head: a similarity about the head centroid from the skin, scaled by head height above the axis disc.
  const axisM = spine.find((x) => x.m === male.disks.axis) ?? spine[spine.length - 1];
  const headOf = (pos: Float32Array, yFrom: number) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < pos.length; i += 3) if (pos[i + 1] > yFrom && Math.abs(pos[i]) < 0.13) (s[0] += pos[i]), (s[1] += pos[i + 1]), (s[2] += pos[i + 2]), n++;
    return mul(s, 1 / n);
  };
  const mHead = headOf(male.skin.pos, axisM.m[1] + 0.04), fHead = headOf(skin.pos, axisM.f[1] + 0.04);
  const kh = (fCrown - axisM.f[1]) / (mCrown - axisM.m[1]);
  const head = (q: V) => add(fHead, mul(sub(q, mHead), kh));
  const skull = male.mesh(/skull|frontal bone|parietal|occipital bone|temporal bone|mandible|maxilla|zygomatic bone|sphenoid/i);
  for (const p of spread(Array.from({ length: skull.length / 3 }, (_, i) => [skull[i * 3], skull[i * 3 + 1], skull[i * 3 + 2]]), 0.04)) pin(p, head(p));
  log(`head scale ${kh.toFixed(3)}`);

  // Arms: rotate each male arm about its shoulder onto the female arm line (shoulder to fingertip),
  // after moving the shoulder in or out to match the width over the deltoids.
  const armMaps = {} as Record<Side, Map3>;
  const hands: HandFrame[] = [], handBones: { bones: Float32Array; wF: V; dir: V; side: number }[] = [];
  for (const [s, side] of [["l", 1], ["r", -1]] as const) {
    const L = male.arm[s];
    const sh0 = byLevel(L.shoulder);
    const widthAt = (pos: Float32Array, y: number, keepI?: (i: number) => boolean) => {
      let best = -Infinity;
      for (let i = 0; i < pos.length; i += 3) if (Math.abs(pos[i + 1] - y) < 0.015 && (!keepI || keepI(i / 3))) best = Math.max(best, side * pos[i]);
      return best;
    };
    const mWide = byLevel([widthAt(male.skin.pos, L.shoulder[1]) * side, L.shoulder[1], L.shoulder[2]])[0] * side;
    const fWide = widthAt(skin.pos, sh0[1]);
    const shF: V = [sh0[0] + side * (fWide - mWide), sh0[1], sh0[2]];
    // Female fingertip: the skin point furthest from the shoulder along the arm, found in two passes.
    // Only points well out to the side and above the knees can be on the hand.
    const onArm = (p: V) => side * (p[0] - shF[0]) > 0.08 && p[1] > legMaps[s].f.knee[1] + 0.15;
    let dir = norm(sub(extreme(skin.pos, (p) => (onArm(p) ? side * p[0] : -Infinity)), shF));
    let tipF = extreme(skin.pos, (p) => (onArm(p) ? dot(sub(p, shF), dir) : -Infinity));
    dir = norm(sub(tipF, shF));
    tipF = extreme(skin.pos, (p) => (onArm(p) ? dot(sub(p, shF), dir) : -Infinity));
    const map = boneMap(L.shoulder, L.tip, shF, tipF);
    armMaps[s] = map;
    log(`${s} arm: shoulder shift ${((fWide - mWide) * 100).toFixed(1)} cm, abduction ${((Math.acos(-norm(sub(tipF, shF))[1]) * 180) / Math.PI).toFixed(1)}°, length ×${(len(sub(tipF, shF)) / len(sub(L.tip, L.shoulder))).toFixed(3)}`);
    for (const [a, b, r] of [[L.shoulder, L.elbow, 0.03], [L.elbow, L.wrist, 0.025]] as const) for (const p of frame(a, b, r)) pin(p, map(p));
    pin(L.elbow, map(L.elbow));
    pin(L.wrist, map(L.wrist));
    // The hand moves as one rigid piece, scaled down by the body height. A ring along the hand's axis
    // alone let the spline fan the fingers and widen the palm, so every hand bone is pinned.
    const wF = map(L.wrist), hs = (k * 0.97) / (len(sub(tipF, shF)) / len(sub(L.tip, L.shoulder)));
    const hand = (p: V) => add(wF, mul(sub(map(p), wF), hs));
    const Side = s === "l" ? "Left" : "Right";
    const bones = male.mesh(new RegExp(`^${Side} (scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)$|^${Side} \\w+ metacarpal|phalanx of ${Side.toLowerCase()} .*(finger|thumb)`, "i"));
    const handPts = spread(Array.from({ length: bones.length / 3 }, (_, i) => [bones[i * 3], bones[i * 3 + 1], bones[i * 3 + 2]]), 0.012);
    for (const p of handPts) pin(p, hand(p));
    log(`${s} hand: ${handPts.length} pins, scale ×${(k * 0.97).toFixed(3)}`);
    hands.push(...handFrames(skin.pos, wF, norm(sub(tipF, shF)), side, GAP_KEEP.skin));
    handBones.push({ bones, wF, dir: norm(sub(tipF, shF)), side });
  }

  let [S1, D1] = dedupe(src, dst);
  log(`stage 1: ${S1.length} bone landmarks`);
  const warp1 = tps(S1, D1, 0);

  // ---------- stage 2: pull the surface onto the female skin ----------
  const skinBVH = bvhOf(skin), mamBVH = bvhOf(mammary);
  const mSkin = warp1(Float32Array.from(male.skin.pos));
  const hit = {} as HitPointInfo, hit2 = {} as HitPointInfo;
  const cand: [V, V][] = [];
  const OK = new Set<string | null>(["chest", "abdomen", "pelvis", "neck", "upperArm", "forearm", "thigh", "shin"]);
  for (let i = 0; i < mSkin.length; i += 3) {
    if (!OK.has(male.skin.seg[i / 3])) continue;
    const p = new THREE.Vector3(mSkin[i], mSkin[i + 1], mSkin[i + 2]);
    skinBVH.bvh.closestPointToPoint(p, hit);
    let d = sub(hit.point.toArray(), p.toArray());
    if (len(d) > 0.07) continue;
    // Where the female skin lies further out, most of the difference is subcutaneous fat: the muscles
    // only follow part of the way. Where it lies further in, they follow all the way.
    const f = hit.faceIndex * 3, [a, b, c] = [skin.idx[f], skin.idx[f + 1], skin.idx[f + 2]].map((v) => [skin.pos[v * 3], skin.pos[v * 3 + 1], skin.pos[v * 3 + 2]]);
    const outward = dot(d, cross(sub(b, a), sub(c, a))) > 0;
    if (outward) d = mul(d, FAT_FOLLOW);
    // Leave the breasts to the mammary glands; the chest muscles stay on the chest wall.
    mamBVH.bvh.closestPointToPoint(hit.point, hit2);
    if (hit2.distance < 0.025) continue;
    cand.push([p.toArray(), add(p.toArray(), d)]);
  }
  const keepS = new Set(spread(cand.map((c) => c[0]), 0.035).map((p) => p.join()));
  const skinPairs = cand.filter((c) => keepS.has(c[0].join()));
  // Bone landmarks stay where stage 1 put them.
  const fixed = D1.filter((_, i) => !cagePts.includes(S1[i]));
  const [S2, D2] = dedupe([...fixed, ...skinPairs.map((c) => c[0])], [...fixed, ...skinPairs.map((c) => c[1])], 0.012);
  log(`stage 2: ${skinPairs.length} skin pulls, ${S2.length} landmarks in all`);
  const warp2 = tps(S2, D2, 0.004);
  // The fitted hands keep the male hand's open fan; close it by its own finger bones.
  const inner = handBones.flatMap((h) => handFrames(warp2(warp1(Float32Array.from(h.bones))), h.wF, h.dir, h.side, GAP_KEEP.inner));
  return {
    warp: (P: Float32Array) => closeHands(warp2(warp1(P)), inner),
    closeHands: (P: Float32Array | number[]) => closeHands(P, hands),
    floor: fFloor,
    skin,
  };
}
