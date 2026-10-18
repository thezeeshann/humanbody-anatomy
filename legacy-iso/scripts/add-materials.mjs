// Adds the Geneva-drive pastel ramps (community figure by @nader0913) to the kit's material table.
// Run once after copying kit/turn.mjs from the skill: node scripts/add-materials.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "kit", "turn.mjs");
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (c, w, t) => "#" + hex(c).map((v, i) => Math.round(v + (hex(w)[i] - v) * t).toString(16).padStart(2, "0")).join("");
const W = "#ffffff", K = "#1b1d22";

// Same ramp as the Geneva figure's scene.mjs, laid out in the kit's material key order:
// paper, face, top, shade-0..3, lit-top, lit-shade, hi, mid, lo, faint, dot, lit | tube body, shine, shade, edge.
function ramp(b, { top = 0.5, s3 = 0.3, s2 = 0.12, s1 = -0.04, s0 = -0.2, ink = 0.62 } = {}) {
  const tone = (t) => (t >= 0 ? mix(b, W, t) : mix(b, K, -t));
  const hi = mix(b, K, ink);
  return [tone(s2), tone(s2 + 0.08), tone(top), tone(s0), tone(s1), tone(s2), tone(s3), tone(top + 0.08), tone(s3), hi, mix(b, K, ink - 0.2), mix(b, K, ink - 0.38), mix(b, K, 0.12), mix(b, K, 0.7), mix(b, K, ink + 0.08), tone(s2), tone(top), tone(s0), hi];
}
const dark = (b) => ramp(mix(b, K, 0.55), { top: 0.1, s3: 0.06, s2: 0.02, s1: -0.04, s0: -0.1, ink: -0.6 });

export const PASTELS = {
  teal: ["#2f9e9a"],
  orange: ["#e8823a"],
  peach: ["#ef9d68", { top: 0.6, s3: 0.42, s2: 0.26, s1: 0.1, s0: -0.06 }],
  gold: ["#d9a441"],
  red: ["#d6453d", { top: 0.46, s3: 0.28, s2: 0.1, s1: -0.05, s0: -0.22, ink: 0.66 }],
  slate: ["#5b7fa6", { top: 0.5, s3: 0.32, s2: 0.14, s1: -0.02, s0: -0.18 }],
  bench: ["#5b7fa6", { top: 0.66, s3: 0.5, s2: 0.34, s1: 0.16, s0: 0.0 }],
  cream: ["#efe7d4", { top: 0.6, s3: 0.3, s2: 0.1, s1: -0.06, s0: -0.16, ink: 0.72 }],
  brown: ["#4a4038", { top: 0.22, s3: 0.16, s2: 0.06, s1: -0.04, s0: -0.14, ink: 0.62 }],
  grey: ["#8d939b", { top: 0.6, s3: 0.4, s2: 0.2, s1: 0.02, s0: -0.14, ink: 0.66 }],
  ghost: ["#c9ccd1", { top: 0.75, s3: 0.6, s2: 0.45, s1: 0.3, s0: 0.15, ink: 0.42 }],
};

let src = readFileSync(FILE, "utf8");
src = src.replace(/\n\/\/ pastels:begin[\s\S]*?\/\/ pastels:end\n/, "\n");
const entries = Object.entries(PASTELS).map(([name, [b, o]]) => `  ${name}: { light: ${JSON.stringify(ramp(b, o))}, dark: ${JSON.stringify(dark(b))} },`).join("\n");
const block = `\n// pastels:begin\nObject.assign(T3_MATERIALS, {\n${entries}\n});\n// pastels:end\n`;
src = src.replace(/(\nfunction t3MaterialCss\(\))/, `${block}$1`);
writeFileSync(FILE, src);
console.log(`added ${Object.keys(PASTELS).length} pastel materials to kit/turn.mjs`);
