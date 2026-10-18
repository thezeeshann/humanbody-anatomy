import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { computeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { CONTENT, type Region } from "./content.ts";
import { createListener } from "./listen.ts";
import { mountLoader, mountPanelScroll, mountSelect } from "./ui.tsx";

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const stage = document.querySelector<HTMLElement>(".hb-stage")!;
const canvas = document.querySelector<HTMLCanvasElement>(".hb-canvas")!;
const tip = document.querySelector<HTMLElement>(".hb-tip")!;
const readout = document.querySelector<HTMLElement>("[data-readout]")!;
const figTitle = document.querySelector<HTMLElement>("[data-title]")!;
const loading = document.querySelector<HTMLElement>(".hb-loading")!;
mountLoader(loading.querySelector<HTMLElement>(".hb-skel")!);
const progress = document.querySelector<HTMLElement>(".hb-progress")!;
const panel = document.querySelector<HTMLElement>(".hb-panel")!;
const { viewport: panelScroll, body: panelBody } = mountPanelScroll(panel.querySelector<HTMLElement>(".hb-panel-scroll")!);
const still = matchMedia("(prefers-reduced-motion: reduce)");

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(1.5, 3, 2.5);
const rim = new THREE.DirectionalLight(0xfff1e6, 0.9);
rim.position.set(-2, 2, -2.5);
scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xe9e4dc, 0.6));

const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
camera.position.set(0, 1.0, 3.95);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.86, 0);
controls.enableDamping = true;
// The mouse does everything: dragging turns the body and moves the view up and down (handled below),
// the wheel zooms. The controls keep only the zoom.
controls.enableRotate = false;
controls.enablePan = false;
controls.zoomToCursor = true;
controls.minDistance = 0.6;
controls.maxDistance = 6;
controls.minPolarAngle = 0.35;
controls.maxPolarAngle = Math.PI / 2 + 0.12;
controls.update();

// The display stand: a turned plinth with a slate-blue top ring, and a soft contact shadow.
const stand = new THREE.Group();
const plinthMat = new THREE.MeshStandardMaterial({ color: 0xc8d3e0, roughness: 0.55, metalness: 0.05 });
const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.05, 96), plinthMat);
plinth.position.y = -0.025;
const ringMat = new THREE.MeshStandardMaterial({ color: 0x5b7fa6, roughness: 0.45 });
const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.006, 12, 128), ringMat);
ring.rotation.x = Math.PI / 2;
const shadowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(40,40,30,0.42)");
  grad.addColorStop(0.55, "rgba(40,40,30,0.14)");
  grad.addColorStop(1, "rgba(40,40,30,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -0.051;
const footShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 }));
footShadow.rotation.x = -Math.PI / 2;
footShadow.position.y = 0.0015;
stand.add(shadow, plinth, ring, footShadow);
scene.add(stand);

const body = new THREE.Group();
scene.add(body);

// ---------- materials ----------
const MAT = {
  muscle: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.52, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color(0xffc4b0) }),
  bone: () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68 }),
  organ: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
  vessel: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.38, clearcoat: 0.4 }),
  // Lungs are drawn as translucent tissue so the bronchi show through.
  lung: () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.3, transparent: true, opacity: 0.72, depthWrite: false }),
  skin: () =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0xb9b2aa) }, uAlpha: { value: 0.55 } },
      vertexShader: `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), 3.); gl_FragColor = vec4(uColor, f * uAlpha); }`,
    }),
};
// Selection colours, in solid paint rather than fades: the chosen region is washed light yellow and the
// exact structure that was clicked turns red. A hovered structure gets a lighter yellow. Each vertex
// carries its structure's number in the merged mesh, which the shader compares with the picked one.
interface Highlight {
  uRegion: { value: number };
  uPick: { value: number };
  uHover: { value: number };
  target: number; // where uRegion is easing to
}
const highlightable = <M extends THREE.Material>(mat: M): M => {
  const u: Highlight = (mat.userData.hl = { uRegion: { value: 0 }, uPick: { value: -1 }, uHover: { value: -1 }, target: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float part; uniform float uPick; uniform float uHover; varying float vPick; varying float vHover;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPick = 1. - step(.5, abs(part - uPick));\nvHover = 1. - step(.5, abs(part - uHover));");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uRegion; varying float vPick; varying float vHover;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.42), uRegion * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.86, 0.38), vHover * 0.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.004, 0.004), vPick * 0.95);`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += (vec3(0.16, 0.11, 0.0) * uRegion + vec3(0.14, 0.1, 0.0) * vHover) * (1. - vPick) + vec3(0.05, 0.0, 0.0) * vPick;");
  };
  return mat;
};

// ---------- models ----------
// Two bodies share one viewer: each GLB is merged per layer × region and carries a triangle-range →
// structure-name table, turned here into a per-vertex structure number for the highlight.
type Sex = "male" | "female";
type Layer = keyof typeof MAT;
interface MeshInfo {
  layer: Layer;
  region: string;
  starts: number[]; // first triangle of each structure
  ids: number[]; // each structure's index into the name table
}
type BodyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material> & { userData: MeshInfo };
interface Model {
  group: THREE.Group | null;
  meshes: BodyMesh[];
  names: string[];
  promise?: Promise<Model>;
}
interface Hit {
  mesh: BodyMesh;
  part: number;
}
const FILES: Record<Sex, string> = { male: "body.glb", female: "body-female.glb" };
const models: Partial<Record<Sex, Model>> = {};
let sex: Sex = "male";
let meshes: BodyMesh[] = [];
let names: string[] = [];
const layersOn = new Set(["skin", "muscle", "bone"]);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function loadModel(which: Sex): Promise<Model> {
  if (models[which]) return models[which].promise!;
  const m: Model = (models[which] = { group: null, meshes: [], names: [] });
  m.promise = new Promise<Model>((resolve, reject) =>
    loader.load(
      `${import.meta.env.BASE_URL}${FILES[which]}`,
      (gltf) => {
        m.names = gltf.parser.json.extras?.names ?? [];
        gltf.scene.traverse((obj) => {
          if (!(obj as THREE.Mesh).isMesh) return;
          const o = obj as BodyMesh;
          const { layer, region, parts } = o.userData as unknown as { layer: Layer; region: string; parts: [start: number, id: number][] };
          const geo = o.geometry;
          // Vertex colours are stored as sRGB bytes; light them in linear space.
          const col = geo.getAttribute("color");
          if (col) {
            const lin = new Float32Array(col.count * 3);
            const c = new THREE.Color();
            for (let i = 0; i < col.count; i++) c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.SRGBColorSpace).toArray(lin, i * 3);
            geo.setAttribute("color", new THREE.BufferAttribute(lin, 3));
          }
          const starts = parts.map((p) => p[0]);
          if (layer !== "skin") {
            // Tag each vertex with its structure's number. This must happen before the BVH is built,
            // because three-mesh-bvh reorders the triangles in the index buffer.
            const idx = geo.index!.array;
            const part = new Float32Array(geo.getAttribute("position").count);
            for (let k = 0; k < starts.length; k++)
              for (let i = starts[k] * 3, end = (k + 1 < starts.length ? starts[k + 1] : idx.length / 3) * 3; i < end; i++) part[idx[i]] = k;
            geo.setAttribute("part", new THREE.BufferAttribute(part, 1));
            geo.computeBoundsTree();
          }
          o.material = layer === "skin" ? MAT.skin() : highlightable(MAT[layer]());
          o.renderOrder = layer === "skin" ? 10 : layer === "lung" ? 5 : 0;
          o.userData = { layer, region, starts, ids: parts.map((p) => p[1]) };
          m.meshes.push(o);
        });
        m.group = gltf.scene;
        resolve(m);
      },
      (e) => {
        if (e.total && which === sex) progress.textContent = `${Math.round((e.loaded / e.total) * 100)}%`;
      },
      (err) => {
        delete models[which];
        reject(err);
      },
    ),
  );
  return m.promise;
}

async function showSex(which: Sex) {
  sex = which;
  document.querySelectorAll<HTMLElement>("[data-sex]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.sex === which)));
  figTitle.textContent = which === "female" ? "Female body" : "Male body";
  document.body.dataset.sex = which;
  if (!models[which]?.group) {
    // Clear the stage so the skeleton stands in for the body being fetched.
    body.clear();
    meshes = [];
    hovered = null;
    hoverHit = null;
    tip.hidden = true;
    loading.hidden = false;
    progress.textContent = "0%";
  }
  let m;
  try {
    m = await loadModel(which);
  } catch (err) {
    progress.textContent = "failed";
    console.error(err);
    return;
  }
  if (sex !== which) return; // switched again while loading
  body.clear();
  body.add(m.group!);
  meshes = m.meshes;
  names = m.names;
  hovered = null;
  hoverHit = null;
  chips.querySelectorAll<HTMLElement>(".hb-chip").forEach((b) => (b.textContent = contentOf(b.dataset.region!).title));
  loading.hidden = true;
  applyLayers();
  if (selected) open(selected, "");
}
document.querySelectorAll<HTMLElement>("[data-sex]").forEach((b) => b.addEventListener("click", () => b.dataset.sex !== sex && showSex(b.dataset.sex as Sex)));

function applyLayers() {
  for (const m of meshes) m.visible = layersOn.has(m.userData.layer === "lung" ? "organ" : m.userData.layer);
  tip.hidden = true;
  document.querySelectorAll<HTMLElement>("[data-layer]").forEach((b) => b.setAttribute("aria-pressed", String(layersOn.has(b.dataset.layer!))));
  paint();
}
document.querySelectorAll<HTMLElement>("[data-layer]").forEach((b) =>
  b.addEventListener("click", () => {
    const l = b.dataset.layer!;
    layersOn.has(l) ? layersOn.delete(l) : layersOn.add(l);
    applyLayers();
  }),
);

// ---------- picking ----------
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
const ndc = new THREE.Vector2();
function pick(clientX: number, clientY: number): { region: string | null; structure: string; mesh: BodyMesh; part: number } | null {
  const r = canvas.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const targets = meshes.filter((m) => m.visible && m.userData.layer !== "skin");
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (!hit) return null;
  const mesh = hit.object as BodyMesh;
  const { region, ids } = mesh.userData;
  const part = mesh.geometry.getAttribute("part").getX(hit.face!.a);
  return { region: CONTENT[region] ? region : null, structure: names[ids[part]] ?? "", mesh, part };
}

let hovered: string | null = null; // region id under the pointer
let hoverHit: Hit | null = null; // structure under the pointer
let selected: string | null = null;
let selectedStructure = "";
let selectedHit: Hit | null = null;
function paint() {
  for (const m of meshes) {
    if (m.userData.layer === "skin") continue;
    const hl: Highlight = m.material.userData.hl;
    hl.target = selected && m.userData.region === selected ? 1 : 0;
    hl.uPick.value = selectedHit?.mesh === m ? selectedHit.part : -1;
    hl.uHover.value = hoverHit?.mesh === m && !(selectedHit?.mesh === m && selectedHit.part === hoverHit.part) ? hoverHit.part : -1;
  }
}

// ---------- panel ----------
const esc = (t: string) => String(t).replace(/[&<>"]/g, (c) => (({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }) as Record<string, string>)[c]);
const contentOf = (id: string): Region => {
  const c = CONTENT[id];
  return sex === "female" && c.female ? { ...c, ...c.female } : c;
};
const chips = document.querySelector<HTMLElement>(".hb-chips")!;
chips.innerHTML = Object.entries(CONTENT).map(([id, c]) => `<button class="hb-chip" type="button" data-region="${id}">${esc(c.title)}</button>`).join("");
chips.querySelectorAll<HTMLElement>(".hb-chip").forEach((chip) => chip.addEventListener("click", () => (selected === chip.dataset.region ? close() : open(chip.dataset.region!, ""))));

const voiceStore = mountSelect(panel.querySelector<HTMLElement>(".hb-voice-host")!, { label: "Voice", onChange: (key) => listener.setVoice(key) });
const listener = createListener({
  root: panelBody,
  scroller: panelScroll,
  player: panel.querySelector<HTMLElement>(".hb-player")!,
  onVoices: (items, value) => voiceStore.set({ items, value }),
});
mountSelect(panel.querySelector<HTMLElement>(".hb-rate-host")!, {
  label: "Reading speed",
  minWidth: "min-w-24",
  items: ["0.8", "1", "1.2", "1.5"].map((v) => ({ value: v, label: `${v}×` })),
  value: listener.rate,
  onChange: (v) => listener.setRate(v),
});
const setMode = (mode: string) => {
  panel.dataset.mode = mode;
  panel.querySelectorAll<HTMLElement>(".hb-modes [data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  if (mode === "listen") listener.state === "idle" && listener.play();
  else listener.stop();
};
panel.querySelectorAll<HTMLElement>(".hb-modes [data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode!)));

function open(id: string, structure: string, hit: Hit | null = null) {
  selected = id;
  selectedStructure = structure;
  selectedHit = hit;
  const c = contentOf(id);
  const say = (s: string) => esc(s.replace(/\s+/g, " "));
  const factsSay = c.facts.map(([k, v]) => `${k}: ${v}.`).join(" ");
  const partsSay = `What's inside. ${c.parts.join(". ")}.`;
  panelBody.innerHTML = `
    <p class="hb-system">${esc(c.system)}</p>
    <h2 data-block>${esc(c.title)}</h2>
    ${structure ? `<p class="hb-picked" data-block data-say="${say(`You clicked the ${structure}.`)}"><span>You clicked</span> ${esc(structure)}</p>` : ""}
    <p class="hb-summary" data-block>${esc(c.summary)}</p>
    <dl class="hb-facts" data-block data-say="${say(factsSay)}">${c.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <h3 data-block>How it works</h3>
    ${c.how.map((p) => `<p data-block>${esc(p)}</p>`).join("")}
    <h3>What's inside</h3>
    <ul class="hb-parts" data-block data-say="${say(partsSay)}">${c.parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
    <a class="hb-source" href="${esc(c.source)}" target="_blank" rel="noopener">Read more on innerbody.com →</a>`;
  panelScroll.scrollTop = 0;
  panel.setAttribute("aria-hidden", "false");
  document.body.toggleAttribute("data-panel", true);
  chips.querySelectorAll<HTMLElement>(".hb-chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.region === id)));
  listener.load({ autoplay: panel.dataset.mode === "listen" });
  paint();
}
function close() {
  selected = null;
  selectedStructure = "";
  selectedHit = null;
  listener.stop();
  panel.setAttribute("aria-hidden", "true");
  document.body.toggleAttribute("data-panel", false);
  chips.querySelectorAll(".hb-chip").forEach((b) => b.setAttribute("aria-pressed", "false"));
  paint();
}
panel.querySelector(".hb-close")!.addEventListener("click", close);
addEventListener("keydown", (e) => e.key === "Escape" && selected && close());

// ---------- pointer: pointer cursor over parts, click selects, drag turns and moves ----------
// Sideways drag turns the body; up/down drag slides the view along it, so the body follows the mouse.
let down: { x: number; y: number; lx: number; ly: number; id: number; moved?: boolean } | null = null;
canvas.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (down) {
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) {
      down.moved = true;
      stage.style.cursor = "grabbing";
      tip.hidden = true;
    }
    if (down.moved) {
      const dx = e.clientX - down.lx, dy = e.clientY - down.ly;
      body.rotation.y += dx * 0.009;
      const perPx = (2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / stage.clientHeight;
      moveLift(controls.target.y + dy * perPx);
    }
    down.lx = e.clientX;
    down.ly = e.clientY;
    return;
  }
  const hit = pick(e.clientX, e.clientY);
  const id = hit?.region ?? null;
  stage.style.cursor = id ? "pointer" : "grab";
  if (hit && id) {
    const r = stage.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(hit.structure)}</b><span>${esc(contentOf(id).title)}</span>`;
    tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
    tip.hidden = false;
  } else tip.hidden = true;
  const next = hit && id ? { mesh: hit.mesh, part: hit.part } : null;
  if (id !== hovered || next?.mesh !== hoverHit?.mesh || next?.part !== hoverHit?.part) {
    hovered = id;
    hoverHit = next;
    paint();
  }
});
canvas.addEventListener("pointercancel", () => {
  down = null;
  stage.style.cursor = "grab";
});
canvas.addEventListener("pointerup", (e) => {
  const click = down && !down.moved;
  down = null;
  if (!click) {
    stage.style.cursor = "grab";
    return;
  }
  const hit = pick(e.clientX, e.clientY);
  if (hit?.region) open(hit.region, hit.structure, { mesh: hit.mesh, part: hit.part });
  stage.style.cursor = hit?.region ? "pointer" : "grab";
});
canvas.addEventListener("pointerleave", () => {
  tip.hidden = true;
  if (hovered || hoverHit) (hovered = null), (hoverHit = null), paint();
});

// ---------- view height: slide the camera and its target up and down the body ----------
const LIFT = { min: 0.1, max: 1.62 };
let liftGoal: number | null = null;
const moveLift = (y: number) => {
  const dy = Math.min(LIFT.max, Math.max(LIFT.min, y)) - controls.target.y;
  controls.target.y += dy;
  camera.position.y += dy;
};
const nudge = (dir: number) => (liftGoal = Math.min(LIFT.max, Math.max(LIFT.min, (liftGoal ?? controls.target.y) + dir * 0.2)));
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") body.rotation.y += e.key === "ArrowLeft" ? -0.26 : 0.26;
  else if (e.key === "ArrowUp" || e.key === "ArrowDown") nudge(e.key === "ArrowUp" ? 1 : -1);
  else return;
  e.preventDefault();
});

// Zooming to the cursor slides the view sideways. Close in that helps reach a hand or a foot, but from
// the starting distance out the body always stands in the middle: the sideways room shrinks to nothing
// as the camera backs off, so zooming out also brings the body back to the centre.
const CENTRE = { free: 1.2, home: camera.position.distanceTo(controls.target), room: 0.6 };
function keepCentred() {
  const t = Math.min(1, Math.max(0, (camera.position.distanceTo(controls.target) - CENTRE.free) / (CENTRE.home - CENTRE.free)));
  const room = CENTRE.room * (1 - t), off = Math.hypot(controls.target.x, controls.target.z);
  if (off <= room) return;
  const s = room / off, dx = controls.target.x * (s - 1), dz = controls.target.z * (s - 1);
  controls.target.x += dx;
  controls.target.z += dz;
  camera.position.x += dx;
  camera.position.z += dz;
}

// ---------- loop: the body stands still; only eased highlights and the view move ----------
function resize() {
  const { clientWidth: w, clientHeight: h } = stage;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}
let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const k = still.matches ? 1 : 1 - Math.exp(-dt * 9);
  for (const m of meshes) {
    const hl: Highlight | undefined = m.material.userData.hl;
    if (hl) hl.uRegion.value += (hl.target - hl.uRegion.value) * k;
  }
  if (liftGoal !== null) {
    moveLift(controls.target.y + (liftGoal - controls.target.y) * (still.matches ? 1 : 1 - Math.exp(-dt * 7)));
    if (Math.abs(liftGoal - controls.target.y) < 0.002) liftGoal = null;
  }
  stand.rotation.y = body.rotation.y;
  resize();
  controls.update();
  keepCentred();
  renderer.render(scene, camera);
  const text = `${sex.toUpperCase()} · ${selected ? `${contentOf(selected).title.toUpperCase()}${selectedStructure ? ` — ${selectedStructure}` : ""}` : "—"}`;
  if (readout.textContent !== text) readout.textContent = text;
});

showSex("male");

// A handle for the headless-Chrome check scripts.
declare global {
  interface Window {
    __hb: Record<string, unknown>;
  }
}
window.__hb = {
  open, close, pick, renderer, camera, controls, body, layersOn, applyLayers, showSex, listener, setMode,
  get ready() { return meshes.length > 0 && !!models[sex]?.group; },
  get sex() { return sex; },
};
