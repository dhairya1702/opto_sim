import * as THREE from "three";
import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import "./bruckner-scope-prototype.css";

type Action = "fixation" | "aperture" | "scope" | "recenter";
type TeleportTarget = { x: number; z: number };

function required<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Bruckner prototype element unavailable: ${selector}`);
  return element;
}

const canvas = required<HTMLCanvasElement>("#clinic-canvas");
const prompt = required<HTMLElement>("#interaction-prompt");
const scopeCaption = required<HTMLElement>("#scope-caption");
const scopeStatus = required<HTMLElement>("#scope-status");
const errorOutput = required<HTMLElement>("#prototype-error");

window.addEventListener("error", event => {
  errorOutput.hidden = false;
  errorOutput.textContent = `Prototype error: ${event.message}`;
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType("local-floor");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#10282b");
scene.fog = new THREE.Fog("#10282b", 7.5, 13);
const camera = new THREE.PerspectiveCamera(58, 1, .03, 40);
camera.position.set(0, 1.62, 2.35);
scene.add(camera);

const world = new THREE.Group();
scene.add(world);
const interactives: THREE.Object3D[] = [];
const floorPads: THREE.Mesh[] = [];

const palette = {
  wall: new THREE.MeshStandardMaterial({ color: "#dce2d9", roughness: .96 }),
  tealWall: new THREE.MeshStandardMaterial({ color: "#174347", roughness: .88 }),
  floor: new THREE.MeshStandardMaterial({ color: "#b7b5a6", roughness: .82 }),
  wood: new THREE.MeshStandardMaterial({ color: "#8d6542", roughness: .72 }),
  brass: new THREE.MeshStandardMaterial({ color: "#b58d4b", metalness: .55, roughness: .34 }),
  dark: new THREE.MeshStandardMaterial({ color: "#14282a", roughness: .66 }),
  skin: new THREE.MeshPhysicalMaterial({ color: "#9a684c", roughness: .57, clearcoat: .08 }),
  shirt: new THREE.MeshStandardMaterial({ color: "#dddfd4", roughness: .82 }),
  hair: new THREE.MeshStandardMaterial({ color: "#201c1c", roughness: .9 }),
  sclera: new THREE.MeshPhysicalMaterial({ color: "#f0ece2", roughness: .26, clearcoat: .5 }),
  iris: new THREE.MeshPhysicalMaterial({ color: "#62462f", roughness: .34, clearcoat: .45 }),
  pupil: new THREE.MeshBasicMaterial({ color: "#090d0e" }),
  reflex: new THREE.MeshBasicMaterial({ color: "#ff7c2f", transparent: true, opacity: .8, blending: THREE.AdditiveBlending }),
};

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, position: THREE.Vector3Tuple, rotation: THREE.Vector3Tuple = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent: THREE.Object3D, size: THREE.Vector3Tuple, position: THREE.Vector3Tuple, material: THREE.Material, rotation: THREE.Vector3Tuple = [0, 0, 0]) {
  return mesh(new THREE.BoxGeometry(...size), material, parent, position, rotation);
}

function orb(parent: THREE.Object3D, position: THREE.Vector3Tuple, scale: THREE.Vector3Tuple, material: THREE.Material) {
  const object = mesh(new THREE.SphereGeometry(1, 40, 28), material, parent, position);
  object.scale.set(...scale);
  return object;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function textTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const surface = document.createElement("canvas");
  surface.width = width;
  surface.height = height;
  const ctx = surface.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable.");
  draw(ctx);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return { surface, ctx, texture };
}

// Clinic shell.
box(world, [7.2, .08, 7.2], [0, -.04, 0], palette.floor);
box(world, [7.2, 3.4, .12], [0, 1.7, -3.4], palette.tealWall);
box(world, [.12, 3.4, 7.2], [-3.55, 1.7, 0], palette.wall);
box(world, [.12, 3.4, 7.2], [3.55, 1.7, 0], palette.wall);
box(world, [7.2, .10, 7.2], [0, 3.4, 0], palette.wall);
box(world, [1.6, .68, .55], [-2.35, .34, -1.25], palette.wood);
box(world, [1.62, .035, .57], [-2.35, .70, -1.25], palette.brass);
box(world, [1.34, .76, .48], [2.42, .38, -1.38], palette.wood);

// Patient and chair, deliberately stylized but materially richer than the current app.
const patient = new THREE.Group();
patient.position.set(0, 0, -2.12);
world.add(patient);
box(patient, [.58, .82, .14], [0, .76, .23], palette.dark);
box(patient, [.64, .12, .58], [0, .43, .08], palette.dark);
orb(patient, [0, 1.47, 0], [.285, .34, .255], palette.skin);
orb(patient, [0, 1.77, -.015], [.285, .12, .245], palette.hair);
orb(patient, [0, .92, .03], [.42, .55, .23], palette.shirt);
box(patient, [.62, .25, .24], [0, .52, .02], palette.shirt);

const eyeRigs: { gaze: THREE.Group; reflex: THREE.Mesh; pupil: THREE.Mesh }[] = [];
for (const x of [-.092, .092]) {
  const gaze = new THREE.Group();
  gaze.position.set(x, 1.50, .238);
  patient.add(gaze);
  orb(gaze, [0, 0, 0], [.067, .042, .023], palette.sclera);
  const iris = orb(gaze, [0, 0, .022], [.026, .026, .006], palette.iris);
  const pupil = orb(gaze, [0, 0, .028], [.012, .012, .004], palette.pupil);
  const reflex = orb(gaze, [x < 0 ? -.004 : .004, .003, .033], [.011, .011, .003], palette.reflex);
  reflex.visible = false;
  eyeRigs.push({ gaze, reflex, pupil });
}
orb(patient, [0, 1.405, .245], [.035, .055, .04], palette.skin);
const mouth = mesh(new THREE.TorusGeometry(.045, .005, 8, 30, Math.PI), new THREE.MeshStandardMaterial({ color: "#6b4138", roughness: .7 }), patient, [0, 1.33, .235], [0, 0, Math.PI]);
mouth.scale.y = .45;

// Soft, presentation-quality room light.
scene.add(new THREE.HemisphereLight("#fffaf0", "#29474a", 2.15));
const key = new THREE.DirectionalLight("#fff3dc", 2.7);
key.position.set(-2.6, 4.8, 3.3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const patientLight = new THREE.PointLight("#ffdcb3", 8, 4.5, 2);
patientLight.position.set(0, 2.4, .2);
world.add(patientLight);
const boardLight = new THREE.PointLight("#7ce7d1", 4, 3.2, 2);
boardLight.position.set(1.3, 2.1, -1.35);
world.add(boardLight);

let fixation = false;
let largeAperture = false;
let scopeOpen = false;
let scopeInspected = false;
let pendingXRRecenter = false;

// Wall board is the only instructional/control surface.
const boardCanvas = textTexture(1024, 1320, () => undefined);
const boardMaterial = new THREE.MeshBasicMaterial({ map: boardCanvas.texture, toneMapped: false });
const board = box(world, [1.30, 1.72, .045], [1.30, 1.64, -3.29], boardMaterial);
board.castShadow = false;

function boardButton(y: number, height: number, action: Action) {
  const target = new THREE.Mesh(new THREE.PlaneGeometry(1.10, height), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  target.position.set(0, y, .031);
  target.userData.action = action;
  board.add(target);
  interactives.push(target);
}
boardButton(.45, .22, "fixation");
boardButton(-.42, .18, "aperture");
boardButton(-.68, .18, "scope");
boardButton(-.90, .13, "recenter");

function drawBoard() {
  const { ctx, surface, texture } = boardCanvas;
  ctx.clearRect(0, 0, surface.width, surface.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, surface.height);
  gradient.addColorStop(0, "#12383b");
  gradient.addColorStop(1, "#071f22");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, surface.width, surface.height);
  ctx.strokeStyle = "rgba(166,229,214,.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, surface.width - 36, surface.height - 36);
  ctx.fillStyle = "#75dfca";
  ctx.font = "800 25px system-ui";
  ctx.letterSpacing = "5px";
  ctx.fillText("PRACTICE · BINOCULAR REFLEX", 70, 92);
  ctx.fillStyle = "#f3faf7";
  ctx.font = "600 67px system-ui";
  ctx.letterSpacing = "-2px";
  ctx.fillText("Bruckner test", 68, 175);
  ctx.fillStyle = "#a9c5be";
  ctx.font = "400 27px system-ui";
  ctx.letterSpacing = "0px";
  ctx.fillText("Set up, inspect, then record what you see.", 70, 222);

  roundedRect(ctx, 68, 275, 888, 150, 34);
  ctx.fillStyle = fixation ? "#82ead1" : "#f6f1df";
  ctx.fill();
  ctx.fillStyle = fixation ? "#082521" : "#153638";
  ctx.font = "700 38px system-ui";
  ctx.fillText(fixation ? "✓  FIXATION ESTABLISHED" : "LOOK AT THE LIGHT", 125, 369);

  ctx.fillStyle = "#78dfca";
  ctx.font = "800 23px system-ui";
  ctx.letterSpacing = "4px";
  ctx.fillText("TECHNIQUE STATUS", 70, 505);
  ctx.letterSpacing = "0px";
  const rows: [string, boolean, string][] = [
    ["Fixation", fixation, fixation ? "Ready" : "Ask patient"],
    ["Large aperture", largeAperture, largeAperture ? "Selected" : "Required"],
    ["Working distance", true, "Move to about 1 m"],
    ["Both pupils illuminated", fixation && largeAperture, fixation && largeAperture ? "Aim between eyes" : "Setup first"],
    ["Scope inspection", scopeInspected, scopeInspected ? "Captured" : "Not yet"],
  ];
  rows.forEach(([label, ready, detail], index) => {
    const y = 575 + index * 94;
    ctx.beginPath();
    ctx.arc(91, y - 10, 19, 0, Math.PI * 2);
    ctx.fillStyle = ready ? "#63dfc4" : "#526d6b";
    ctx.fill();
    if (ready) {
      ctx.strokeStyle = "#082521";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(81, y - 10); ctx.lineTo(89, y - 2); ctx.lineTo(103, y - 20); ctx.stroke();
    }
    ctx.fillStyle = "#eff8f4";
    ctx.font = "540 31px system-ui";
    ctx.fillText(label, 132, y);
    ctx.fillStyle = ready ? "#8fead6" : "#91aaa5";
    ctx.font = "430 24px system-ui";
    ctx.textAlign = "right";
    ctx.fillText(detail, 926, y);
    ctx.textAlign = "left";
  });

  roundedRect(ctx, 68, 1065, 888, 108, 25);
  ctx.fillStyle = fixation && largeAperture ? "#d8ad5f" : "#29494a";
  ctx.fill();
  ctx.fillStyle = fixation && largeAperture ? "#1b1710" : "#abc0ba";
  ctx.font = "700 31px system-ui";
  ctx.fillText(scopeOpen ? "B/Y · CLOSE SCOPE" : "B/Y · OPEN SCOPE", 128, 1134);
  ctx.font = "500 22px system-ui";
  ctx.fillStyle = "#9ab1ab";
  ctx.fillText("RECENTER VIEW", 70, 1253);
  texture.needsUpdate = true;
}

// A deliberately high-resolution headset scope texture.
const scopeCanvas = textTexture(1536, 1536, () => undefined);
function almond(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.beginPath();
  ctx.moveTo(x - width / 2, y);
  ctx.bezierCurveTo(x - width * .27, y - height * .72, x + width * .27, y - height * .72, x + width / 2, y);
  ctx.bezierCurveTo(x + width * .27, y + height * .72, x - width * .27, y + height * .72, x - width / 2, y);
  ctx.closePath();
}

function drawScope() {
  const { ctx, surface, texture } = scopeCanvas;
  ctx.clearRect(0, 0, surface.width, surface.height);
  const field = ctx.createRadialGradient(768, 750, 310, 768, 750, 745);
  field.addColorStop(0, "#945f46");
  field.addColorStop(.60, "#754a38");
  field.addColorStop(.91, "#241615");
  field.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = field;
  ctx.beginPath(); ctx.arc(768, 750, 735, 0, Math.PI * 2); ctx.fill();

  const eyeY = fixation ? 700 : 670;
  const eyeShift = fixation ? 0 : 42;
  for (const [index, eyeX] of [485, 1051].entries()) {
    almond(ctx, eyeX, eyeY, 410, 180);
    const sclera = ctx.createLinearGradient(0, eyeY - 90, 0, eyeY + 90);
    sclera.addColorStop(0, "#d9c9bd"); sclera.addColorStop(.45, "#f2e8df"); sclera.addColorStop(1, "#b99180");
    ctx.fillStyle = sclera; ctx.fill();
    const irisX = eyeX + eyeShift;
    const iris = ctx.createRadialGradient(irisX - 12, eyeY - 13, 8, irisX, eyeY, 87);
    iris.addColorStop(0, "#b47a39"); iris.addColorStop(.35, "#6c4728"); iris.addColorStop(.78, "#2b201b"); iris.addColorStop(1, "#171313");
    ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(irisX, eyeY, 86, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#090c0c"; ctx.beginPath(); ctx.arc(irisX, eyeY, 39, 0, Math.PI * 2); ctx.fill();
    if (fixation && largeAperture) {
      const reflex = ctx.createRadialGradient(irisX, eyeY, 4, irisX, eyeY, 66);
      reflex.addColorStop(0, "#fff4b5"); reflex.addColorStop(.16, "#ffbe49"); reflex.addColorStop(.44, "#f2642d"); reflex.addColorStop(1, "rgba(134,22,13,0)");
      ctx.fillStyle = reflex; ctx.beginPath(); ctx.arc(irisX, eyeY, 70, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,245,.96)"; ctx.beginPath(); ctx.arc(irisX - 18, eyeY - 23, 12, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#39231f"; ctx.lineWidth = 22; almond(ctx, eyeX, eyeY, 410, 180); ctx.stroke();
    ctx.strokeStyle = "rgba(54,31,26,.72)"; ctx.lineWidth = 8;
    for (let lash = -180; lash <= 180; lash += 24) {
      ctx.beginPath(); ctx.moveTo(eyeX + lash, eyeY - 62 + Math.abs(lash) * .12); ctx.lineTo(eyeX + lash * 1.03, eyeY - 95 + Math.abs(lash) * .13); ctx.stroke();
    }
    ctx.fillStyle = "rgba(121,64,49,.38)";
    ctx.beginPath(); ctx.ellipse(eyeX, eyeY - 148, 236, 38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.26)";
    ctx.beginPath(); ctx.ellipse(eyeX - 65, eyeY - 30, 72, 15, -.18, 0, Math.PI * 2); ctx.fill();
    if (index === 0 || index === 1) { /* keep both sides deliberately symmetrical */ }
  }
  const nose = ctx.createLinearGradient(690, 0, 850, 0);
  nose.addColorStop(0, "rgba(75,40,31,0)"); nose.addColorStop(.5, "rgba(201,137,102,.58)"); nose.addColorStop(1, "rgba(75,40,31,0)");
  ctx.fillStyle = nose; ctx.beginPath(); ctx.ellipse(768, 930, 110, 330, 0, 0, Math.PI * 2); ctx.fill();

  // Optical vignette makes the image read as a headset view, not a flat card.
  const vignette = ctx.createRadialGradient(768, 750, 590, 768, 750, 760);
  vignette.addColorStop(0, "rgba(0,0,0,0)"); vignette.addColorStop(.68, "rgba(0,0,0,.08)"); vignette.addColorStop(1, "rgba(0,0,0,1)");
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, 1536, 1536);
  texture.needsUpdate = true;
}

const scopeMaterial = new THREE.MeshBasicMaterial({ map: scopeCanvas.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
const scopePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.18), scopeMaterial);
scopePlane.visible = false;
scopePlane.renderOrder = 5000;
scene.add(scopePlane);
const scopeShade = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: .94, depthTest: false, depthWrite: false }));
scopeShade.visible = false;
scopeShade.renderOrder = 4999;
scene.add(scopeShade);

// Floor rings are actual controller/mouse targets.
function floorPad(x: number, z: number, label: string) {
  const material = new THREE.MeshBasicMaterial({ color: "#62d8c0", transparent: true, opacity: .78, side: THREE.DoubleSide });
  const ring = mesh(new THREE.RingGeometry(.20, .29, 44), material, world, [x, .008, z], [-Math.PI / 2, 0, 0]);
  ring.userData.teleport = { x, z } satisfies TeleportTarget;
  ring.userData.label = label;
  interactives.push(ring);
  floorPads.push(ring);
}
floorPad(0, 1.55, "patient view");
floorPad(-1.55, .15, "instrument trolley");
floorPad(1.55, .10, "wall board");

// Minimal held ophthalmoscope silhouette; deliberately carries no UI.
const heldScope = new THREE.Group();
const scopeGrip = mesh(new THREE.CylinderGeometry(.026, .029, .23, 24), palette.dark, heldScope, [0, -.10, 0]);
scopeGrip.castShadow = false;
const scopeHead = box(heldScope, [.11, .13, .07], [0, .08, 0], palette.dark);
scopeHead.castShadow = false;
mesh(new THREE.CylinderGeometry(.026, .018, .04, 24), palette.brass, heldScope, [0, .09, -.05], [Math.PI / 2, 0, 0]).castShadow = false;
heldScope.position.set(.31, -.28, -.56);
heldScope.rotation.set(-.15, -.12, -.08);
camera.add(heldScope);

function updateButtons() {
  required<HTMLButtonElement>("#fixation-control").setAttribute("aria-pressed", String(fixation));
  required<HTMLButtonElement>("#aperture-control").setAttribute("aria-pressed", String(largeAperture));
  required<HTMLButtonElement>("#scope-control").setAttribute("aria-pressed", String(scopeOpen));
  required<HTMLButtonElement>("#fixation-control").textContent = fixation ? "Fixation established" : "Look at the light";
  required<HTMLButtonElement>("#aperture-control").textContent = largeAperture ? "Large aperture selected" : "Select large aperture";
  required<HTMLButtonElement>("#scope-control").textContent = scopeOpen ? "Close scope" : "Open scope";
}

function refreshVisuals() {
  eyeRigs.forEach((eye, index) => {
    eye.gaze.position.x = (index ? .092 : -.092) + (fixation ? 0 : .014);
    eye.reflex.visible = fixation && largeAperture;
    eye.pupil.scale.setScalar(fixation && largeAperture ? 1.34 : 1);
  });
  drawBoard();
  drawScope();
  updateButtons();
  scopeStatus.textContent = fixation && largeAperture
    ? "Equal bright reflexes visible in both pupils."
    : !fixation ? "Ask the patient to look at the light." : "Select the large aperture before inspection.";
}

function positionHeadOverlay(object: THREE.Object3D, distance: number) {
  const viewer = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  viewer.getWorldPosition(position);
  viewer.getWorldQuaternion(rotation);
  object.position.copy(position).add(new THREE.Vector3(0, 0, -distance).applyQuaternion(rotation));
  object.quaternion.copy(rotation);
}

function setScope(open: boolean) {
  scopeOpen = open;
  scopePlane.visible = open;
  scopeShade.visible = open;
  heldScope.visible = !open;
  document.body.classList.toggle("scope-open", open);
  scopeCaption.hidden = renderer.xr.isPresenting || !open;
  if (open && fixation && largeAperture) scopeInspected = true;
  refreshVisuals();
}

const desktopSpawn = new THREE.Vector3(0, 1.62, 2.35);
let yaw = 0;
let pitch = -.02;
function resetDesktopView() {
  camera.position.copy(desktopSpawn);
  yaw = 0;
  pitch = -.02;
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}

function xrViewerPose() {
  const viewer = renderer.xr.getCamera();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  viewer.getWorldPosition(position);
  viewer.getWorldQuaternion(quaternion);
  const euler = new THREE.Euler().setFromQuaternion(quaternion, "YXZ");
  return { position, yaw: euler.y };
}

function placeWorldAt(destination: TeleportTarget, alignForward = false) {
  if (!renderer.xr.isPresenting) {
    camera.position.x = destination.x;
    camera.position.z = destination.z;
    return;
  }
  const viewer = xrViewerPose();
  if (alignForward) world.rotation.y = viewer.yaw;
  const desired = new THREE.Vector3(destination.x, 0, destination.z).applyQuaternion(world.quaternion);
  world.position.set(viewer.position.x - desired.x, 0, viewer.position.z - desired.z);
}

function recenter() {
  if (renderer.xr.isPresenting) placeWorldAt({ x: 0, z: 1.55 }, true);
  else resetDesktopView();
  prompt.textContent = "Clinic centred. The patient and wall board are in front of you.";
}

function performAction(action: Action) {
  if (action === "fixation") {
    fixation = !fixation;
    prompt.textContent = fixation ? "Fixation established. Select the large aperture." : "Fixation released.";
  } else if (action === "aperture") {
    largeAperture = !largeAperture;
    prompt.textContent = largeAperture ? "Large aperture selected. Press B/Y or Open scope." : "Small aperture selected.";
  } else if (action === "scope") setScope(!scopeOpen);
  else recenter();
  refreshVisuals();
}

required<HTMLButtonElement>("#enter-clinic").addEventListener("click", () => canvas.requestPointerLock());
required<HTMLButtonElement>("#fixation-control").addEventListener("click", () => performAction("fixation"));
required<HTMLButtonElement>("#aperture-control").addEventListener("click", () => performAction("aperture"));
required<HTMLButtonElement>("#scope-control").addEventListener("click", () => performAction("scope"));
required<HTMLButtonElement>("#recenter-control").addEventListener("click", recenter);
canvas.addEventListener("click", () => { if (!renderer.xr.isPresenting && !scopeOpen) void canvas.requestPointerLock(); });

document.addEventListener("mousemove", event => {
  if (document.pointerLockElement !== canvas || scopeOpen || renderer.xr.isPresenting) return;
  yaw -= event.movementX * .0018;
  pitch = THREE.MathUtils.clamp(pitch - event.movementY * .0015, -.95, .82);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
});

const keys = new Set<string>();
document.addEventListener("keydown", event => {
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === "KeyE") interactFrom(camera);
  if (event.code === "KeyB" || event.code === "Space") { event.preventDefault(); setScope(!scopeOpen); }
  if (event.code === "KeyR") recenter();
});
document.addEventListener("keyup", event => keys.delete(event.code));
document.addEventListener("pointerlockchange", () => {
  prompt.textContent = document.pointerLockElement === canvas
    ? "Aim the centre dot at the wall board or a floor ring, then press E."
    : "Select Enter clinic to resume mouse look.";
});

const raycaster = new THREE.Raycaster();
function hitFrom(object: THREE.Object3D) {
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3(0, 0, -1);
  object.getWorldPosition(origin);
  object.getWorldQuaternion(new THREE.Quaternion()).normalize();
  direction.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion())).normalize();
  raycaster.set(origin, direction);
  return raycaster.intersectObjects(interactives, false)[0];
}

function interactFrom(object: THREE.Object3D) {
  if (scopeOpen) { setScope(false); return; }
  const hit = hitFrom(object);
  if (!hit || hit.distance > 8) { prompt.textContent = "Aim at a wall control or floor ring."; return; }
  const action = hit.object.userData.action as Action | undefined;
  const destination = hit.object.userData.teleport as TeleportTarget | undefined;
  if (action) performAction(action);
  else if (destination) {
    placeWorldAt(destination);
    prompt.textContent = `Moved to ${String(hit.object.userData.label)}.`;
  }
}

const controllerLines: THREE.Line[] = [];
for (let index = 0; index < 2; index += 1) {
  const controller = renderer.xr.getController(index);
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -4)]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: index ? "#f1c36f" : "#72e4cc", transparent: true, opacity: .78 }));
  controller.add(line);
  controller.addEventListener("selectstart", () => interactFrom(controller));
  scene.add(controller);
  controllerLines.push(line);
}

const vrButton = VRButton.createButton(renderer, { requiredFeatures: ["local-floor"] });
vrButton.id = "vr-entry";
document.body.append(vrButton);
renderer.xr.addEventListener("sessionstart", () => {
  pendingXRRecenter = true;
  scopeCaption.hidden = true;
  document.exitPointerLock?.();
});
renderer.xr.addEventListener("sessionend", () => {
  setScope(false);
  world.position.set(0, 0, 0);
  world.rotation.set(0, 0, 0);
  resetDesktopView();
});

const faceButtonDown = new Map<XRInputSource, boolean>();
const stickButtonDown = new Map<XRInputSource, boolean>();
function updateXRButtons() {
  const session = renderer.xr.getSession();
  if (!session) return;
  for (const source of session.inputSources) {
    const facePressed = Boolean(source.gamepad?.buttons[5]?.pressed);
    if (facePressed && !faceButtonDown.get(source)) setScope(!scopeOpen);
    faceButtonDown.set(source, facePressed);
    const stickPressed = Boolean(source.gamepad?.buttons[3]?.pressed);
    if (stickPressed && !stickButtonDown.get(source)) recenter();
    stickButtonDown.set(source, stickPressed);
  }
}

const clock = new THREE.Clock();
const velocity = new THREE.Vector3();
function updateDesktopMovement(dt: number) {
  if (renderer.xr.isPresenting || document.pointerLockElement !== canvas || scopeOpen) return;
  velocity.set(0, 0, 0);
  if (keys.has("KeyW") || keys.has("ArrowUp")) velocity.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) velocity.z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) velocity.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) velocity.x += 1;
  if (!velocity.lengthSq()) return;
  velocity.normalize().multiplyScalar(dt * 1.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  camera.position.add(velocity);
  camera.position.x = THREE.MathUtils.clamp(camera.position.x, -3.1, 3.1);
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -2.9, 3.0);
  camera.position.y = 1.62;
}

function updateHover() {
  const source = renderer.xr.isPresenting ? renderer.xr.getController(0) : camera;
  const hit = hitFrom(source);
  floorPads.forEach(pad => (pad.material as THREE.MeshBasicMaterial).color.set(hit?.object === pad ? "#e7bd69" : "#62d8c0"));
  if (!renderer.xr.isPresenting && document.pointerLockElement === canvas && !scopeOpen) {
    prompt.textContent = hit?.object.userData.action
      ? `E · ${String(hit.object.userData.action).replace("aperture", "large aperture").toUpperCase()}`
      : hit?.object.userData.teleport ? `E · MOVE TO ${String(hit.object.userData.label).toUpperCase()}`
        : "Aim at a wall control or floor ring.";
  }
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = renderer.getPixelRatio();
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
}

refreshVisuals();
resetDesktopView();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .05);
  resize();
  updateDesktopMovement(dt);
  updateXRButtons();
  if (renderer.xr.isPresenting && pendingXRRecenter) {
    pendingXRRecenter = false;
    placeWorldAt({ x: 0, z: 1.55 }, true);
  }
  if (scopeOpen) {
    positionHeadOverlay(scopeShade, 1.02);
    positionHeadOverlay(scopePlane, 1.0);
  }
  updateHover();
  renderer.render(scene, camera);
});
