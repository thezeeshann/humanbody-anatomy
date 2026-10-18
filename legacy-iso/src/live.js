const DATA = __DATA__;
const CONTENT = DATA.content;
const stage = document.querySelector(".hb-stage");
const readout = document.querySelector("[data-readout]");
const panel = document.querySelector(".hb-panel");
const panelBody = panel.querySelector(".hb-panel-body");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// Calm, continuous turn: 12°/s idle (a full turn in 30 s), slowing to 5°/s while a part is being read.
const SPEED = 12;
const READING = 5;
let angle = DATA.start;
let speed = still.matches ? 0 : SPEED;
let frame = 0;
let last = 0;
let visible = true;
let dragging = null;
let selected = null;
let hovered = null;

const controller = TURN.mount(stage, DATA.turn, { onHold: () => {}, onFrame: () => {} });
const live = stage.querySelector("svg[data-live]");
live.style.pointerEvents = "auto";

// Every live part carries data-name="<region>.<detail>[.<side>]"; keep each part's own material so it can be restored.
const parts = [...live.querySelectorAll("[data-name]")];
for (const el of parts) el.dataset.mat0 = el.getAttribute("data-mat") ?? "";
const regionOf = (el) => {
  const name = el?.closest?.("[data-name]")?.getAttribute("data-name");
  const id = name ? name.split(".")[0] : null;
  return id && CONTENT[id] ? id : null;
};

const wrap = (a) => ((Math.round(a) % 360) + 360) % 360;
const show = () => {
  const title = selected ? CONTENT[selected].title.toUpperCase() : "—";
  const text = `θ ${wrap(angle)}° · ${title}`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.setAttribute("aria-valuenow", String(wrap(angle)));
};

function paint() {
  for (const el of parts) {
    const id = el.getAttribute("data-name").split(".")[0];
    const on = selected && id === selected;
    const mine = el.dataset.mat0;
    if (!CONTENT[id]) continue;
    el.setAttribute("data-mat", selected && !on ? "ghost" : mine);
    el.toggleAttribute("data-sel", Boolean(on));
    el.toggleAttribute("data-hover", !selected && hovered === id);
  }
  document.querySelectorAll(".hb-chip").forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.region === selected)));
}

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function open(id) {
  selected = id;
  const c = CONTENT[id];
  panelBody.innerHTML = `
    <p class="hb-system"><span class="hb-swatch" data-mat="${esc(c.color)}"></span>${esc(c.system)}</p>
    <h2>${esc(c.title)}</h2>
    <p class="hb-summary">${esc(c.summary)}</p>
    <dl class="hb-facts">${c.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    <h3>How it works</h3>
    ${c.how.map((p) => `<p>${esc(p)}</p>`).join("")}
    <h3>What's inside</h3>
    <ul class="hb-parts">${c.parts.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>
    <a class="hb-source" href="${esc(c.source)}" target="_blank" rel="noopener">Read more on innerbody.com →</a>`;
  panel.scrollTop = 0;
  panel.setAttribute("aria-hidden", "false");
  document.body.toggleAttribute("data-panel", true);
  paint();
  show();
  run();
}
function close() {
  selected = null;
  panel.setAttribute("aria-hidden", "true");
  document.body.toggleAttribute("data-panel", false);
  paint();
  show();
  run();
}
panel.querySelector(".hb-close").addEventListener("click", close);
addEventListener("keydown", (e) => {
  if (e.key === "Escape" && selected) close();
});
document.querySelectorAll(".hb-chip").forEach((chip) => chip.addEventListener("click", () => (selected === chip.dataset.region ? close() : open(chip.dataset.region))));

// Pointer: a press that barely moves is a click on a part; a horizontal drag turns the stand.
stage.addEventListener("pointerdown", (e) => {
  dragging = { x: e.clientX, angle, moved: 0, id: e.pointerId };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (dragging) {
    const dx = e.clientX - dragging.x;
    dragging.moved = Math.max(dragging.moved, Math.abs(dx));
    if (dragging.moved > 4) {
      angle = dragging.angle - dx * 0.6;
      draw();
    }
    return;
  }
  const id = regionOf(document.elementFromPoint(e.clientX, e.clientY));
  if (id !== hovered) {
    hovered = id;
    stage.style.cursor = id ? "pointer" : "grab";
    paint();
  }
});
stage.addEventListener("pointerup", (e) => {
  if (!dragging) return;
  const click = dragging.moved <= 4;
  dragging = null;
  stage.releasePointerCapture(e.pointerId);
  if (!click) return;
  const id = regionOf(document.elementFromPoint(e.clientX, e.clientY));
  if (id) open(id);
});
stage.addEventListener("pointerleave", () => {
  if (hovered) {
    hovered = null;
    paint();
  }
});
stage.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    angle += e.key === "ArrowLeft" ? 15 : -15;
    draw();
    e.preventDefault();
  }
});

function draw() {
  controller.set({ stand: angle });
  show();
}
function tick(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  const goal = still.matches ? 0 : selected ? READING : SPEED;
  speed += (goal - speed) * (1 - Math.exp(-dt * 3));
  if (!dragging) angle -= speed * dt;
  draw();
  frame = visible && (speed > 0.01 || goal > 0) ? requestAnimationFrame(tick) : 0;
}
function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting;
  if (visible) run();
}).observe(stage);
still.addEventListener("change", run);
draw();
paint();
run();
window.__hb = { open, close, set: (a) => ((angle = a), draw()), get angle() { return angle; } };
