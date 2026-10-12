import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import "./room-environment-mock.css";

/* Concept mock. Footprint and station positions mirror web/scene/Models.tsx + Room.tsx. */

window.addEventListener("error", event => {
  const out = document.querySelector<HTMLElement>("#room-error");
  if (!out) return;
  out.hidden = false;
  out.textContent = `Room preview error: ${event.message}`;
});

type V3 = [number, number, number];
const $ = <T extends Element>(s: string) => {
  const e = document.querySelector<T>(s);
  if (!e) throw new Error(`Missing element ${s}`);
  return e;
};

const stage = $<HTMLElement>("#stage");
const canvas = $<HTMLCanvasElement>("#room-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(70, 1.6, 0.03, 40);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxDistance = 9;

// Real room bounds (matching ConsultingRoomShell)
const W = 4.0, D = 5.0, H = 3.0; // interior faces at x ±2.0, z ±2.5
const X = W / 2, Z = D / 2;

/* ---------- helpers ---------- */
function place<T extends THREE.Object3D>(o: T, parent: THREE.Object3D, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s?: V3) {
  o.position.set(...p); o.rotation.set(...r); if (s) o.scale.set(...s); parent.add(o); return o;
}
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, p?: V3, r?: V3, s?: V3) => place(new THREE.Mesh(g, m), parent, p, r, s);
const box = (w: number, h: number, d: number, m: THREE.Material, parent: THREE.Object3D, p?: V3, r?: V3) => mesh(new THREE.BoxGeometry(w, h, d), m, parent, p, r);
const rbox = (w: number, h: number, d: number, rad: number, m: THREE.Material, parent: THREE.Object3D, p?: V3, r?: V3) =>
  mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(rad, w / 2.01, h / 2.01, d / 2.01)), m, parent, p, r);
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, parent: THREE.Object3D, p?: V3, r?: V3) => mesh(new THREE.CylinderGeometry(rt, rb, h, 32), m, parent, p, r);
const plane = (w: number, h: number, m: THREE.Material, parent: THREE.Object3D, p: V3, r: V3) => mesh(new THREE.PlaneGeometry(w, h), m, parent, p, r);
function rod(a: V3, b: V3, rad: number, m: THREE.Material, parent: THREE.Object3D) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va);
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(rad, dir.length(), 6, 16), m);
  o.position.copy(va).add(vb).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  parent.add(o); return o;
}
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number], srgb = true) {
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"); if (!ctx) throw new Error("2D canvas unavailable");
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

/* ---------- procedural textures ---------- */
const plankTex = tex(1024, 1024, (c, w, h) => {
  const r = rng(7), rows = 8, rh = h / rows;
  for (let row = 0; row < rows; row++) {
    let x = -r() * 500;
    while (x < w) {
      const len = 360 + r() * 420;
      c.fillStyle = `hsl(${30 + r() * 6}, ${30 + r() * 10}%, ${60 + r() * 9}%)`;
      c.fillRect(x, row * rh, len, rh);
      for (let g = 0; g < 30; g++) {
        const y0 = row * rh + r() * rh;
        c.strokeStyle = `rgba(95,60,30,${0.04 + r() * 0.09})`;
        c.lineWidth = 0.6 + r() * 1.5;
        c.beginPath(); c.moveTo(x, y0);
        const a = 1 + r() * 3, f = 0.003 + r() * 0.01;
        for (let px = 0; px <= len; px += 14) c.lineTo(x + px, y0 + Math.sin(px * f + g) * a);
        c.stroke();
      }
      c.fillStyle = "rgba(45,30,18,.45)"; c.fillRect(x, row * rh, 2, rh);
      x += len;
    }
    c.fillStyle = "rgba(45,30,18,.4)"; c.fillRect(0, row * rh, w, 2);
  }
}, [2.4, 3]);
const paint = (base: string, seed: number, amt: number) => tex(256, 256, (c, w, h) => {
  c.fillStyle = base; c.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let i = 0; i < w * h * 0.15; i++) { const v = r() > 0.5 ? 255 : 0; c.fillStyle = `rgba(${v},${v},${v},${r() * amt})`; c.fillRect(r() * w, r() * h, 1, 1); }
}, [8, 6]);
const ceilingTex = tex(512, 512, (c, w, h) => {
  c.fillStyle = "#f2f1ec"; c.fillRect(0, 0, w, h);
  const r = rng(5);
  for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(120,120,110,${r() * 0.12})`; c.fillRect(r() * w, r() * h, 1.5, 1.5); }
  c.fillStyle = "#c9c8c0"; c.fillRect(0, 0, w, 6); c.fillRect(0, 0, 6, h);
}, [6.7, 8.3]);
const chartTex = tex(768, 1024, (c, w, h) => {
  c.fillStyle = "#fbfbf8"; c.fillRect(0, 0, w, h);
  const letters = "CDHKNORSVZ", r = rng(3);
  let size = 120, y = 50, lm = 1.0;
  c.textBaseline = "top";
  while (size > 10 && y + size < h - 50) {
    c.font = `700 ${size}px Helvetica, Arial, sans-serif`; c.fillStyle = "#121212";
    const n = size > 90 ? 3 : 5, sp = size * 1.3;
    for (let i = 0; i < n; i++) c.fillText(letters[Math.floor(r() * 10)] ?? "C", w / 2 - (sp * n) / 2 + i * sp + size * 0.1, y);
    c.font = "500 18px Helvetica"; c.fillStyle = "#9a9f9f"; c.fillText(lm.toFixed(1), w - 60, y + size / 2 - 9);
    y += size + Math.max(16, size * 0.45); size *= 0.794; lm -= 0.1;
  }
  c.font = "500 16px Helvetica"; c.fillStyle = "#a5aaaa"; c.fillText("Illustrative · not calibrated", 24, h - 34);
});
const posterTex = tex(512, 700, (c, w, h) => {
  c.fillStyle = "#f6f3ec"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#2f4a4f"; c.font = "700 32px Helvetica"; c.fillText("THE HUMAN EYE", 40, 70);
  c.fillStyle = "#77807f"; c.font = "16px Helvetica"; c.fillText("Schematic section", 40, 98);
  const cx = 250, cy = 380;
  c.fillStyle = "#fff8ef"; c.strokeStyle = "#e1d3c2"; c.lineWidth = 10;
  c.beginPath(); c.arc(cx, cy, 160, 0, 7); c.fill(); c.stroke();
  c.strokeStyle = "#c2443a"; c.lineWidth = 6; c.beginPath(); c.arc(cx, cy, 148, 2, 4.3); c.stroke();
  c.strokeStyle = "#8bb8d0"; c.lineWidth = 5; c.beginPath(); c.arc(cx + 120, cy, 70, -0.9, 0.9); c.stroke();
  c.fillStyle = "#d9c7a0"; c.beginPath(); c.ellipse(cx + 118, cy, 20, 48, 0, 0, 7); c.fill();
  c.fillStyle = "#e9b84f"; c.fillRect(cx - 240, cy - 22, 90, 44);
});
const plaqueTex = tex(512, 160, (c, w, h) => {
  c.fillStyle = "#2f4448"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#e9efe9"; c.font = "600 54px Helvetica"; c.fillText("Consultation 01", 34, 82);
  c.fillStyle = "#9fc2bb"; c.font = "500 30px Helvetica"; c.fillText("Optometry", 34, 128);
});
const oldSignTex = tex(768, 260, (c, w, h) => {
  c.fillStyle = "#edf2ed"; c.fillRect(0, 0, w, h); c.fillStyle = "#264e50"; c.textAlign = "center";
  c.font = "44px sans-serif"; c.fillText("CONSULTATION 01", w / 2, h / 3); c.fillText("OPTOMETRY", w / 2, (2 * h) / 3);
});
const oldChartTex = tex(512, 768, (c, w, h) => {
  c.fillStyle = "#f8faf3"; c.fillRect(0, 0, w, h); c.fillStyle = "#24363b"; c.textAlign = "center";
  ["E", "F  P", "T  O  Z", "L  P  E  D", "P E C F D", "E D F C Z P", "SIMULATED DISPLAY"].forEach((t, i) => {
    c.font = `${Math.max(24, 100 - i * 12)}px sans-serif`; c.fillText(t, w / 2, (h * (i + 1)) / 8);
  });
});
const shadowTex = tex(128, 128, (c, w) => {
  const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  g.addColorStop(0, "rgba(0,0,0,.5)"); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(0, 0, w, w);
}, undefined, false);

/* ---------- materials ---------- */
const std = (color: string, roughness = 0.6, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const P = {
  floor: std("#fff", 0.45, 0, { map: plankTex }),
  wall: std("#fff", 0.92, 0, { map: paint("#ebe7df", 4, 0.045) }),
  slate: std("#fff", 0.9, 0, { map: paint("#2f4448", 5, 0.05) }),
  ceiling: std("#fff", 0.95, 0, { map: ceilingTex }),
  trim: std("#dcd6cc", 0.55),
  white: std("#f3f1ec", 0.42),
  shell: std("#ecebe6", 0.38),
  oak: std("#fff", 0.5, 0, { map: plankTex.clone() }),
  chrome: std("#e6e9eb", 0.14, 1),
  brushed: std("#c3c8cc", 0.33, 1),
  dark: std("#25282b", 0.4, 0.5),
  black: std("#1b1d1f", 0.45),
  leather: new THREE.MeshPhysicalMaterial({ color: "#2b3236", roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color("#617079") }),
  stoolSeat: new THREE.MeshPhysicalMaterial({ color: "#3d5c5e", roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color("#9fc") }),
  screen: new THREE.MeshStandardMaterial({ color: "#000", emissive: "#fff", emissiveMap: chartTex, emissiveIntensity: 0.95, roughness: 0.2 }),
  poster: std("#fff", 0.7, 0, { map: posterTex }),
  plaque: std("#fff", 0.5, 0, { map: plaqueTex }),
  led: new THREE.MeshStandardMaterial({ color: "#fff", emissive: "#fff6ea", emissiveIntensity: 1.5 }),
  sky: new THREE.MeshBasicMaterial({ color: "#dce9f5" }),
  slat: std("#efede8", 0.55),
  glassBlue: new THREE.MeshPhysicalMaterial({ color: "#d9eef0", roughness: 0.05, transmission: 0.9, thickness: 0.01, transparent: true }),
  fakeShadow: new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: "#000" }),
  clay: std("#c9c3ba", 0.7),
  clayDark: std("#8f8a83", 0.75),
};
const C = (c: string) => std(c, 0.82);

/* ---------- neutral clay patient (shared stand-in; eyes at existing anchor y 1.5, z -0.573) ---------- */
function clayPatient(parent: THREE.Object3D) {
  const g = place(new THREE.Group(), parent, [0, 0, -0.63]);
  mesh(new THREE.SphereGeometry(1, 48, 32), P.clay, g, [0, 1.5, 0.0], [0, 0, 0], [0.078, 0.108, 0.095]);
  cyl(0.045, 0.05, 0.12, P.clay, g, [0, 1.36, -0.02]);
  mesh(new THREE.CapsuleGeometry(0.15, 0.26, 8, 24), P.clayDark, g, [0, 1.08, -0.05], [0, 0, 0], [1.15, 1, 0.7]);
  for (const s of [-1, 1]) {
    rod([s * 0.19, 1.22, -0.06], [s * 0.25, 0.98, 0.0], 0.045, P.clayDark, g);
    rod([s * 0.25, 0.98, 0.0], [s * 0.28, 0.9, 0.26], 0.037, P.clayDark, g);
    rod([s * 0.1, 0.72, 0.0], [s * 0.1, 0.7, 0.36], 0.065, P.clayDark, g);
    rod([s * 0.1, 0.68, 0.38], [s * 0.1, 0.16, 0.42], 0.05, P.clayDark, g);
    mesh(new THREE.SphereGeometry(0.0118, 24, 16), std("#efe9df", 0.3), g, [s * 0.048, 1.5, 0.057]);
    mesh(new THREE.CircleGeometry(0.0055, 24), std("#3b2a1e", 0.4), g, [s * 0.048, 1.5, 0.0689]);
  }
  return g;
}

/* ========== CURRENT ROOM (faithful to ConsultingRoomShell colours/primitives) ========== */
const current = new THREE.Group();
{
  const r = current;
  box(4.15, 0.1, 5.15, C("#d0d1c9"), r, [0, -0.05, 0]);
  for (let i = 0; i < 7; i++) box(0.004, 0.002, 5, C("#b9bdb6"), r, [-1.5 + i * 0.5, 0.002, 0]);
  for (let i = 0; i < 9; i++) box(4, 0.002, 0.004, C("#b9bdb6"), r, [0, 0.003, -2 + i * 0.5]);
  box(4.2, 3, 0.1, C("#e3e8e2"), r, [0, 1.5, -2.55]);
  box(0.1, 3, 5.1, C("#edf0e9"), r, [-2.05, 1.5, 0]);
  box(0.1, 3, 5.1, C("#d4dfdb"), r, [2.05, 1.5, 0]);
  box(4.2, 3, 0.1, C("#e8ebe5"), r, [0, 1.5, 2.55]);
  box(4.2, 0.08, 5.2, C("#f1f2eb"), r, [0, 3.04, 0]);
  box(4, 0.14, 0.04, C("#b0c0bc"), r, [0, 0.07, -2.48]);
  box(0.04, 0.14, 5, C("#b0c0bc"), r, [-1.98, 0.07, 0]);
  box(0.04, 0.14, 5, C("#b0c0bc"), r, [1.98, 0.07, 0]);
  box(1.4, 0.04, 0.65, C("#fafbf0"), r, [0, 2.96, -0.6]);
  box(0.035, 1.25, 1.55, C("#9bbab8"), r, [-1.985, 1.92, -0.25]);
  for (let i = 0; i < 12; i++) box(0.025, 0.065, 1.52, C("#edf0e5"), r, [-1.96, 1.36 + i * 0.1, -0.25], [0, 0, 0.07]);
  box(0.85, 2.2, 0.04, C("#b4c3bc"), r, [1.42, 1.1, 2.48]);
  plane(0.95, 0.33, new THREE.MeshBasicMaterial({ map: oldSignTex }), r, [-1.15, 2.28, -2.485], [0, 0, 0]);
  box(0.72, 1.04, 0.08, C("#273d42"), r, [0.05, 1.84, -2.445]);
  plane(0.65, 0.97, new THREE.MeshBasicMaterial({ map: oldChartTex }), r, [0.05, 1.84, -2.398], [0, 0, 0]);
  // chair
  const chair = place(new THREE.Group(), r, [0, 0, -0.63]);
  cyl(0.28, 0.3, 0.05, C("#7f8d8c"), chair, [0, 0.03, 0]);
  cyl(0.06, 0.06, 0.4, C("#7f8d8c"), chair, [0, 0.25, 0]);
  rbox(0.55, 0.12, 0.5, 0.04, C("#234b51"), chair, [0, 0.5, 0]);
  rbox(0.55, 0.8, 0.1, 0.04, C("#234b51"), chair, [0, 0.95, -0.25]);
  // trolley
  const t = place(new THREE.Group(), r, [-1.37, 0, 0.75]);
  box(0.84, 0.035, 0.55, C("#d9e1de"), t, [0, 0.86, 0]); box(0.84, 0.035, 0.55, C("#c1cecd"), t, [0, 0.4, 0]);
  for (const x of [-0.37, 0.37]) for (const z of [-0.22, 0.22]) cyl(0.018, 0.018, 0.82, C("#7f8d8c"), t, [x, 0.47, z]);
  // refraction cabinet
  const rf = place(new THREE.Group(), r, [-1.45, 0, -1.4]);
  box(0.85, 0.06, 1.2, C("#deddd4"), rf, [0, 0.85, 0]); box(0.75, 0.8, 0.65, C("#e9eeea"), rf, [0, 0.4, -0.2]);
  for (let i = 0; i < 18; i++) mesh(new THREE.TorusGeometry(0.035, 0.008, 8, 20), C("#9fb4b6"), rf, [-0.3 + (i % 6) * 0.12, 0.9, -0.4 + Math.floor(i / 6) * 0.14], [Math.PI / 2, 0, 0]);
  // slit lamp
  const sl = place(new THREE.Group(), r, [1.35, 0, -0.95]);
  box(1.0, 0.065, 0.7, C("#dfe5e2"), sl, [0, 0.84, 0]); cyl(0.065, 0.065, 0.8, C("#7f8d8c"), sl, [0, 0.4, 0]);
  box(0.7, 0.05, 0.48, C("#9baaaa"), sl, [0, 0.05, 0]); box(0.5, 0.07, 0.32, C("#d7dfda"), sl, [0, 0.91, 0.03]);
  cyl(0.035, 0.035, 0.34, C("#e5e6da"), sl, [-0.08, 1.1, 0.08]); box(0.26, 0.12, 0.22, C("#e4e8df"), sl, [-0.08, 1.29, 0.08]);
  clayPatient(r);
}
const currentLights = new THREE.Group();
{
  currentLights.add(new THREE.AmbientLight("#fff", 0.55));
  currentLights.add(new THREE.HemisphereLight("#fffdf5", "#687779", 1.05));
  const d = new THREE.DirectionalLight("#fff", 1.65); d.position.set(-2, 4, 2); d.castShadow = true;
  d.shadow.mapSize.set(1024, 1024); Object.assign(d.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); d.shadow.bias = -0.001;
  currentLights.add(d);
  const pl = new THREE.PointLight("#fff8df", 2.2, 5); pl.position.set(0, 2.7, -0.6); currentLights.add(pl);
  current.add(currentLights);
}

/* ========== PROPOSED ROOM ========== */
const proposed = new THREE.Group();
const slats: THREE.Mesh[] = [];
{
  const r = proposed;
  plane(W, D, P.floor, r, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  plane(W, H, P.slate, r, [0, H / 2, -Z], [0, 0, 0]);
  plane(W, H, P.wall, r, [0, H / 2, Z], [0, Math.PI, 0]);
  plane(D, H, P.wall, r, [-X, H / 2, 0], [0, Math.PI / 2, 0]);
  plane(D, H, P.wall, r, [X, H / 2, 0], [0, -Math.PI / 2, 0]);
  plane(W, D, P.ceiling, r, [0, H, 0], [Math.PI / 2, 0, 0]);
  // skirting + shadow gap
  box(W, 0.1, 0.018, P.trim, r, [0, 0.05, -Z + 0.009]);
  box(W, 0.1, 0.018, P.trim, r, [0, 0.05, Z - 0.009]);
  box(0.018, 0.1, D, P.trim, r, [-X + 0.009, 0.05, 0]);
  box(0.018, 0.1, D, P.trim, r, [X - 0.009, 0.05, 0]);
  // recessed LED panels (over chair and over examiner)
  for (const z of [-0.6, 1.0]) { box(0.64, 0.02, 0.64, P.trim, r, [0, H - 0.006, z]); box(0.6, 0.012, 0.6, P.led, r, [0, H - 0.016, z]); }
  // downlight over worktop
  for (const z of [-0.2, 1.2]) cyl(0.05, 0.05, 0.01, P.led, r, [-1.65, H - 0.01, z]);

  // acuity LCD at existing anchor (0.05, 1.84, rear wall)
  const lcd = place(new THREE.Group(), r, [0.05, 1.84, -Z + 0.03]);
  rbox(0.7, 0.95, 0.04, 0.01, P.black, lcd);
  plane(0.64, 0.86, P.screen, lcd, [0, 0.01, 0.021], [0, 0, 0]);
  box(0.16, 0.12, 0.03, P.dark, lcd, [0, 0, -0.03]);
  // plaque, poster, clock
  plane(0.42, 0.13, P.plaque, r, [0.05, 2.5, -Z + 0.01], [0, 0, 0]);
  const poster = place(new THREE.Group(), r, [1.15, 1.6, -Z + 0.02]);
  rbox(0.5, 0.68, 0.025, 0.004, P.oak, poster); plane(0.44, 0.6, P.poster, poster, [0, 0, 0.014], [0, 0, 0]);
  const clock = place(new THREE.Group(), r, [1.15, 2.35, -Z + 0.03], [Math.PI / 2, 0, 0]);
  cyl(0.14, 0.14, 0.03, P.brushed, clock); cyl(0.128, 0.128, 0.032, std("#fbfbf8", 0.6), clock);
  box(0.007, 0.002, 0.09, P.black, clock, [0, -0.018, -0.035]); box(0.005, 0.002, 0.065, P.black, clock, [0.02, -0.018, 0.015], [0, 1.1, 0]);

  // left wall: window with blinds above worktop (matches current blind location x -2, z -0.25)
  const win = place(new THREE.Group(), r, [-X + 0.005, 1.92, -0.25], [0, Math.PI / 2, 0]);
  plane(1.5, 1.2, P.sky, win, [0, 0, -0.04], [0, 0, 0]);
  box(1.62, 0.06, 0.1, P.white, win, [0, 0.63, 0]); box(1.62, 0.05, 0.16, P.white, win, [0, -0.63, 0.03]);
  box(0.06, 1.32, 0.1, P.white, win, [0.78, 0, 0]); box(0.06, 1.32, 0.1, P.white, win, [-0.78, 0, 0]);
  box(0.03, 1.2, 0.03, P.white, win, [0, 0, -0.02]);
  for (let i = 0; i < 26; i++) slats.push(box(1.5, 0.045, 0.002, P.slat, win, [0, 0.58 - i * 0.046, 0.025], [-0.9, 0, 0]));

  // left wall: base units + worktop + sink, upper cabinets (towards front, clear of trolley/refraction)
  const wk = place(new THREE.Group(), r, [-X + 0.3, 0, 1.78]);
  box(0.56, 0.1, 1.2, std("#cfcac1", 0.8), wk, [0.02, 0.05, 0]);
  for (let i = 0; i < 2; i++) {
    const z = -0.3 + i * 0.6;
    rbox(0.58, 0.78, 0.58, 0.006, P.white, wk, [0, 0.49, z]);
    box(0.015, 0.012, 0.18, P.brushed, wk, [0.295, 0.8, z]);
  }
  box(0.62, 0.035, 1.24, P.oak, wk, [0.01, 0.9, 0]);
  rbox(0.36, 0.02, 0.42, 0.01, P.chrome, wk, [0.02, 0.92, 0.25]);
  mesh(new THREE.TorusGeometry(0.075, 0.009, 12, 32, Math.PI), P.chrome, wk, [-0.17, 0.99, 0.25], [0, Math.PI / 2, 0]);
  cyl(0.012, 0.016, 0.09, P.chrome, wk, [-0.245, 0.96, 0.25]);
  rbox(0.1, 0.24, 0.09, 0.02, std("#f6f6f4", 0.35), r, [-X + 0.05, 1.3, 1.35]);
  rbox(0.12, 0.3, 0.26, 0.02, std("#f6f6f4", 0.35), r, [-X + 0.06, 1.45, 2.2]);

  // front wall: door with frame + handle (current door x 1.42)
  const door = place(new THREE.Group(), r, [1.42, 1.06, Z - 0.02], [0, Math.PI, 0]);
  box(1.0, 2.16, 0.05, P.white, door, [0, 0, -0.01]);
  box(0.88, 2.08, 0.045, P.oak, door, [0, -0.03, 0.012]);
  cyl(0.011, 0.011, 0.14, P.brushed, door, [0.34, 0, 0.06], [0, 0, Math.PI / 2]);
  box(0.06, 0.1, 0.012, P.white, r, [0.8, 1.2, Z - 0.006]);
  cyl(0.15, 0.13, 0.4, std("#8a9196", 0.45, 0.4), r, [1.75, 0.2, 2.15]);

  // patient chair (station at 0, -0.63)
  const ch = place(new THREE.Group(), r, [0, 0, -0.63]);
  cyl(0.3, 0.33, 0.04, P.brushed, ch, [0, 0.02, 0]);
  cyl(0.075, 0.075, 0.36, P.chrome, ch, [0, 0.22, 0]);
  rbox(0.38, 0.08, 0.38, 0.02, P.dark, ch, [0, 0.42, 0]);
  rbox(0.54, 0.12, 0.54, 0.05, P.leather, ch, [0, 0.52, 0.02]);
  rbox(0.54, 0.74, 0.12, 0.05, P.leather, ch, [0, 0.96, -0.26], [-0.08, 0, 0]);
  rbox(0.28, 0.15, 0.09, 0.04, P.leather, ch, [0, 1.44, -0.16]);
  cyl(0.012, 0.012, 0.16, P.chrome, ch, [0, 1.32, -0.22]);
  for (const s of [-1, 1]) { rbox(0.08, 0.05, 0.46, 0.02, P.leather, ch, [s * 0.32, 0.74, 0.05]); cyl(0.012, 0.012, 0.18, P.chrome, ch, [s * 0.32, 0.64, 0.02]); }
  rbox(0.48, 0.03, 0.2, 0.01, P.brushed, ch, [0, 0.1, 0.48]);
  rod([0, 0.42, 0.2], [0, 0.11, 0.42], 0.018, P.chrome, ch);
  clayPatient(r);

  // examiner stool
  const st = place(new THREE.Group(), r, [0.1, 0, 0.4]);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; rod([0, 0.07, 0], [Math.cos(a) * 0.26, 0.05, Math.sin(a) * 0.26], 0.016, P.dark, st); mesh(new THREE.SphereGeometry(0.025, 16, 12), P.black, st, [Math.cos(a) * 0.26, 0.025, Math.sin(a) * 0.26]); }
  cyl(0.025, 0.025, 0.42, P.chrome, st, [0, 0.28, 0]); rbox(0.42, 0.08, 0.42, 0.04, P.stoolSeat, st, [0, 0.52, 0]);

  // trolley (station -1.37, 0.75)
  const tr = place(new THREE.Group(), r, [-1.37, 0, 0.75]);
  for (const x of [-0.37, 0.37]) for (const z of [-0.22, 0.22]) { cyl(0.012, 0.012, 0.84, P.chrome, tr, [x, 0.47, z]); mesh(new THREE.SphereGeometry(0.026, 16, 12), P.black, tr, [x, 0.03, z]); }
  rbox(0.84, 0.025, 0.55, 0.01, P.brushed, tr, [0, 0.4, 0]);
  rbox(0.86, 0.03, 0.57, 0.012, P.brushed, tr, [0, 0.86, 0]);
  rbox(0.78, 0.014, 0.49, 0.008, std("#26292c", 0.95), tr, [0, 0.882, 0]);
  rbox(0.6, 0.12, 0.45, 0.01, P.white, tr, [0, 0.76, 0]);
  box(0.16, 0.012, 0.012, P.brushed, tr, [0, 0.76, 0.232]);

  // refraction unit (station -1.45, -1.4): cabinet + column + phoropter arm
  const rf = place(new THREE.Group(), r, [-1.45, 0, -1.4]);
  rbox(0.8, 0.82, 0.66, 0.02, P.white, rf, [0, 0.41, -0.2]);
  for (const y of [0.24, 0.5, 0.72]) box(0.2, 0.012, 0.012, P.brushed, rf, [0, y, 0.135]);
  rbox(0.86, 0.045, 1.2, 0.015, P.oak, rf, [0, 0.845, 0]);
  cyl(0.05, 0.055, 1.25, P.shell, rf, [0.25, 1.48, -0.42]);
  rbox(0.55, 0.05, 0.06, 0.02, P.shell, rf, [0.48, 2.06, -0.3], [0, -0.5, 0]);
  const ph = place(new THREE.Group(), rf, [0.66, 1.86, -0.12], [0, -0.3, 0]);
  rbox(0.34, 0.18, 0.08, 0.03, P.shell, ph);
  for (const x of [-0.08, 0.08]) { cyl(0.055, 0.055, 0.09, std("#d8d4cb", 0.35), ph, [x, 0, 0], [Math.PI / 2, 0, 0]); cyl(0.016, 0.016, 0.095, P.black, ph, [x, 0, 0], [Math.PI / 2, 0, 0]); }
  rod([0, 0, 0], [0.18, 0.16, 0.0], 0.012, P.shell, ph);
  // trial lens case on worktop
  rbox(0.5, 0.06, 0.34, 0.01, std("#1f3b40", 0.5), rf, [-0.05, 0.9, 0.25]);
  for (let i = 0; i < 24; i++) cyl(0.017, 0.017, 0.004, P.glassBlue, rf, [-0.25 + (i % 8) * 0.057, 0.935, 0.17 + Math.floor(i / 8) * 0.08]);

  // slit lamp (station 1.35, -0.95) on an instrument table
  const sl = place(new THREE.Group(), r, [1.35, 0, -0.95], [0, -0.35, 0]);
  rbox(0.62, 0.06, 0.5, 0.02, P.dark, sl, [0, 0.03, 0]);
  cyl(0.055, 0.075, 0.76, P.shell, sl, [0, 0.42, 0]);
  rbox(0.9, 0.04, 0.6, 0.015, P.shell, sl, [0, 0.82, 0]);
  rbox(0.4, 0.05, 0.3, 0.012, P.dark, sl, [0, 0.865, 0.04]);
  for (const x of [-0.13, 0.13]) cyl(0.009, 0.009, 0.5, P.chrome, sl, [x, 1.12, -0.13]);
  box(0.28, 0.022, 0.022, P.chrome, sl, [0, 1.37, -0.13]);
  rbox(0.11, 0.02, 0.05, 0.008, P.black, sl, [0, 1.04, -0.14]);
  cyl(0.022, 0.026, 0.24, P.shell, sl, [0, 1.0, 0.06]);
  const scope = place(new THREE.Group(), sl, [0, 1.16, 0.08], [-0.2, 0, 0]);
  rbox(0.11, 0.13, 0.22, 0.03, P.shell, scope);
  for (const x of [-0.032, 0.032]) cyl(0.015, 0.015, 0.11, P.black, scope, [x, 0.035, 0.14], [Math.PI / 2 - 0.4, 0, 0]);
  cyl(0.03, 0.03, 0.26, P.shell, sl, [0.12, 1.14, 0.0]);
  cyl(0.02, 0.02, 0.06, P.black, sl, [0.12, 1.3, 0.0]);

  // fake contact shadows (would be baked on Quest)
  for (const [x, z, sx, sz] of [[0, -0.63, 1.1, 1.1], [-1.37, 0.75, 1.2, 0.85], [-1.45, -1.5, 1.1, 0.95], [1.35, -0.95, 0.9, 0.75], [0.1, 0.4, 0.7, 0.7], [-X + 0.3, 1.78, 0.9, 1.5]] as [number, number, number, number][]) {
    plane(sx, sz, P.fakeShadow, r, [x, 0.003, z], [-Math.PI / 2, 0, 0]);
  }
}

// proposed lights
const ceilingPanels = [-0.6, 1.0].map(z => { const l = new THREE.RectAreaLight("#fff5e8", 6, 0.6, 0.6); l.position.set(0, H - 0.02, z); l.lookAt(0, 0, z); proposed.add(l); return l; });
const windowLight = new THREE.RectAreaLight("#dce9ff", 3.2, 1.5, 1.2);
windowLight.position.set(-X + 0.05, 1.92, -0.25); windowLight.lookAt(1, 1.6, -0.25); proposed.add(windowLight);
const key = new THREE.SpotLight("#fff4e6", 16, 6, 0.8, 0.9, 1.6);
key.position.set(0.3, H - 0.05, 0.4); key.target.position.set(0, 1.0, -0.63);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02; key.shadow.radius = 5;
proposed.add(key, key.target);
const chartGlow = new THREE.RectAreaLight("#f2f5ff", 1.2, 0.64, 0.86);
chartGlow.position.set(0.05, 1.84, -Z + 0.08); chartGlow.lookAt(0.05, 1.84, 0); proposed.add(chartGlow);
const hemi = new THREE.HemisphereLight("#fffaf2", "#7c6d5c", 0.35); proposed.add(hemi);

for (const root of [current, proposed]) root.traverse(o => {
  if (!(o instanceof THREE.Mesh)) return;
  const m = o.material;
  const emissive = m === P.led || m === P.sky || m === P.screen || m === P.fakeShadow || m instanceof THREE.MeshBasicMaterial;
  o.castShadow = !emissive && !(o.geometry instanceof THREE.PlaneGeometry);
  o.receiveShadow = !emissive;
});
scene.add(current, proposed);

/* ---------- state ---------- */
let version: "current" | "proposed" = "proposed";
let dim = false;
const views: Record<string, { pos: V3; target: V3 }> = {
  seat: { pos: [0.1, 1.5, 0.45], target: [0, 1.35, -0.8] },
  door: { pos: [1.3, 1.65, 2.3], target: [-0.4, 1.0, -1.2] },
  wall: { pos: [0.6, 1.5, 0.0], target: [-1.8, 1.0, 1.3] },
  top: { pos: [0.01, 6.6, 0.3], target: [0, 0, 0] },
};
const tween = { t: 1, start: 0, fromP: new THREE.Vector3(), fromT: new THREE.Vector3(), toP: new THREE.Vector3(), toT: new THREE.Vector3() };
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
function setView(name: string) {
  const v = views[name]; if (!v) return;
  tween.fromP.copy(camera.position); tween.fromT.copy(controls.target);
  tween.toP.set(...v.pos); tween.toT.set(...v.target); tween.t = reduce.matches ? 1 : 0; tween.start = performance.now();
  if (reduce.matches) { camera.position.copy(tween.toP); controls.target.copy(tween.toT); }
  press("data-view", name);
}
function press(attr: string, value: string) {
  document.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach(b => b.setAttribute("aria-pressed", String(b.getAttribute(attr) === value)));
}
function apply() {
  current.visible = version === "current";
  proposed.visible = version === "proposed";
  scene.background = new THREE.Color(version === "current" ? "#d4dedb" : "#1a2022");
  scene.environment = version === "proposed" ? envMap : null;
  renderer.toneMapping = version === "proposed" ? THREE.NeutralToneMapping : THREE.NoToneMapping;
  press("data-room", version); press("data-light", dim ? "dim" : "consult");
}
document.querySelectorAll<HTMLButtonElement>("[data-room]").forEach(b => b.addEventListener("click", () => { version = b.dataset.room === "current" ? "current" : "proposed"; apply(); }));
document.querySelectorAll<HTMLButtonElement>("[data-light]").forEach(b => b.addEventListener("click", () => { dim = b.dataset.light === "dim"; apply(); }));
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(b => b.addEventListener("click", () => setView(b.dataset.view ?? "seat")));

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();
camera.position.set(...views.seat!.pos); controls.target.set(...views.seat!.target);
apply();

const ease = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
renderer.setAnimationLoop(now => {
  if (tween.t < 1) {
    tween.t = Math.min(1, (now - tween.start) / 1100);
    const e = ease(tween.t);
    camera.position.lerpVectors(tween.fromP, tween.toP, e); controls.target.lerpVectors(tween.fromT, tween.toT, e);
  }
  controls.update();
  const lvl = dim ? 0.07 : 1;
  for (const l of ceilingPanels) l.intensity = 6 * lvl;
  key.intensity = 16 * lvl;
  hemi.intensity = dim ? 0.06 : 0.35;
  windowLight.intensity = dim ? 0.25 : 3.2;
  scene.environmentIntensity = dim ? 0.06 : 0.4;
  P.led.emissiveIntensity = dim ? 0.08 : 1.5;
  P.sky.color.set(dim ? "#30373b" : "#dce9f5");
  for (const s of slats) s.rotation.x = dim ? -1.5 : -0.9;
  for (const l of currentLights.children) if ("intensity" in l) l.visible = !dim || l instanceof THREE.AmbientLight;
  renderer.render(scene, camera);
});
