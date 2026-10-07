import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./instrument-mock.css";

function requiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required instrument-study element is unavailable: ${selector}`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#instrument-canvas");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e7ebe4");
scene.fog = new THREE.Fog("#e7ebe4", 2.3, 4.4);

const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 10);
camera.position.set(0, 0.22, 1.55);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.09, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.minDistance = 0.85;
controls.maxDistance = 2.25;
controls.minPolarAngle = Math.PI * 0.28;
controls.maxPolarAngle = Math.PI * 0.70;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.75;

const neutral = new THREE.MeshStandardMaterial({ color: "#27373a", roughness: 0.54, metalness: 0.12 });
const oldNeutral = new THREE.MeshStandardMaterial({ color: "#536164", roughness: 0.74, metalness: 0.04 });
const grip = new THREE.MeshStandardMaterial({ color: "#17383a", roughness: 0.72, metalness: 0.02 });
const metal = new THREE.MeshStandardMaterial({ color: "#a8b6b0", roughness: 0.30, metalness: 0.72 });
const darkMetal = new THREE.MeshStandardMaterial({ color: "#4d5e5d", roughness: 0.34, metalness: 0.56 });
const glass = new THREE.MeshPhysicalMaterial({ color: "#a9e4dc", roughness: 0.12, metalness: 0, transmission: 0.38, thickness: 0.01, transparent: true, opacity: 0.84 });
const aperture = new THREE.MeshStandardMaterial({ color: "#071214", roughness: 0.46, metalness: 0.1 });
const accent = new THREE.MeshStandardMaterial({ color: "#d39b42", roughness: 0.42, metalness: 0.45 });

function mesh<T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material, parent: THREE.Object3D, position: THREE.Vector3Tuple, rotation: THREE.Vector3Tuple = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function cylinder(parent: THREE.Object3D, radius: number, height: number, material: THREE.Material, position: THREE.Vector3Tuple, rotation: THREE.Vector3Tuple = [0, 0, 0], radialSegments = 28) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material, parent, position, rotation);
}

function currentRetinoscope() {
  const root = new THREE.Group();
  root.name = "Current retinoscope";
  cylinder(root, 0.027, 0.21, oldNeutral, [0, 0.10, 0]);
  cylinder(root, 0.032, 0.025, metal, [0, 0.215, 0]);
  mesh(new THREE.BoxGeometry(0.065, 0.09, 0.044), oldNeutral, root, [0, 0.265, 0]);
  cylinder(root, 0.018, 0.012, glass, [0, 0.27, 0.026], [Math.PI / 2, 0, 0]);
  cylinder(root, 0.025, 0.012, darkMetal, [0.037, 0.248, 0], [0, 0, Math.PI / 2]);
  root.position.set(-0.23, -0.075, 0);
  return root;
}

function improvedHandle(parent: THREE.Object3D) {
  const profile = [
    [0.022, -0.145], [0.025, -0.137], [0.026, -0.112], [0.024, -0.070],
    [0.0225, 0.005], [0.024, 0.066], [0.028, 0.092], [0.030, 0.101],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(profile, 36), grip, parent, [0, 0.045, 0]);
  for (const y of [-0.055, -0.043, -0.031, -0.019, -0.007, 0.005]) {
    mesh(new THREE.TorusGeometry(0.024, 0.0012, 6, 28), darkMetal, parent, [0, y + 0.045, 0], [Math.PI / 2, 0, 0]);
  }
  cylinder(parent, 0.029, 0.024, metal, [0, 0.154, 0]);
  cylinder(parent, 0.025, 0.012, accent, [0, -0.103, 0]);
}

function improvedHead(parent: THREE.Object3D) {
  const neckPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.162, 0),
    new THREE.Vector3(0.002, 0.184, 0),
    new THREE.Vector3(0.012, 0.199, 0),
    new THREE.Vector3(0.016, 0.214, 0),
  ]);
  mesh(new THREE.TubeGeometry(neckPath, 18, 0.018, 20, false), neutral, parent, [0, 0, 0]);

  const shape = new THREE.Shape();
  shape.moveTo(-0.031, -0.047);
  shape.bezierCurveTo(-0.043, -0.035, -0.045, -0.005, -0.040, 0.022);
  shape.bezierCurveTo(-0.036, 0.047, -0.018, 0.058, 0.010, 0.056);
  shape.bezierCurveTo(0.036, 0.054, 0.047, 0.035, 0.045, 0.010);
  shape.bezierCurveTo(0.043, -0.015, 0.036, -0.039, 0.018, -0.049);
  shape.bezierCurveTo(0.002, -0.057, -0.019, -0.055, -0.031, -0.047);
  const housingGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.043,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.004,
    curveSegments: 18,
  });
  housingGeometry.translate(0, 0, -0.0215);
  mesh(housingGeometry, neutral, parent, [0.012, 0.257, 0]);

  cylinder(parent, 0.022, 0.012, metal, [0.011, 0.272, 0.027], [Math.PI / 2, 0, 0]);
  cylinder(parent, 0.015, 0.006, glass, [0.011, 0.272, 0.036], [Math.PI / 2, 0, 0]);
  cylinder(parent, 0.012, 0.010, darkMetal, [0.011, 0.285, -0.026], [Math.PI / 2, 0, 0]);
  cylinder(parent, 0.0065, 0.012, aperture, [0.011, 0.285, -0.036], [Math.PI / 2, 0, 0]);

  const dial = cylinder(parent, 0.024, 0.014, darkMetal, [0.056, 0.25, 0], [0, 0, Math.PI / 2], 32);
  for (let index = 0; index < 16; index += 1) {
    const angle = index / 16 * Math.PI * 2;
    mesh(
      new THREE.BoxGeometry(0.006, 0.004, 0.012),
      metal,
      dial,
      [0, Math.cos(angle) * 0.022, Math.sin(angle) * 0.022],
      [angle, 0, 0],
    );
  }
  mesh(new THREE.CapsuleGeometry(0.005, 0.017, 4, 10), accent, parent, [-0.036, 0.246, 0.026], [0, 0, -0.12]);
}

function proposedRetinoscope() {
  const root = new THREE.Group();
  root.name = "Proposed retinoscope";
  improvedHandle(root);
  improvedHead(root);
  root.position.set(0.23, -0.052, 0);
  return root;
}

const comparison = new THREE.Group();
comparison.add(currentRetinoscope(), proposedRetinoscope());
scene.add(comparison);

function pedestal(x: number, proposed: boolean) {
  const root = new THREE.Group();
  root.position.set(x, -0.225, 0);
  mesh(new THREE.CylinderGeometry(0.115, 0.13, 0.022, 48), new THREE.MeshStandardMaterial({ color: proposed ? "#d5ddd4" : "#d1d5cf", roughness: 0.88 }), root, [0, 0, 0]);
  const ringMaterial = new THREE.MeshStandardMaterial({ color: proposed ? "#33736d" : "#858c87", roughness: 0.6 });
  mesh(new THREE.TorusGeometry(0.105, 0.0022, 8, 48), ringMaterial, root, [0, 0.012, 0], [Math.PI / 2, 0, 0]);
  scene.add(root);
}
pedestal(-0.23, false);
pedestal(0.23, true);

scene.add(new THREE.HemisphereLight("#f7fff8", "#78837d", 2.15));
const key = new THREE.DirectionalLight("#ffffff", 3.2);
key.position.set(-1.5, 2.2, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rim = new THREE.DirectionalLight("#9edbd2", 2.0);
rim.position.set(1.5, 0.8, -1.4);
scene.add(rim);

const floor = mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: "#e7ebe4", roughness: 1 }), scene, [0, -0.238, 0], [-Math.PI / 2, 0, 0]);
floor.receiveShadow = true;
floor.castShadow = false;

let spinning = true;
const spinButton = document.querySelector<HTMLButtonElement>("#spin-button");
const resetButton = document.querySelector<HTMLButtonElement>("#reset-button");
spinButton?.addEventListener("click", () => {
  spinning = !spinning;
  controls.autoRotate = spinning;
  spinButton.textContent = spinning ? "Pause rotation" : "Resume rotation";
  spinButton.setAttribute("aria-pressed", String(spinning));
});
resetButton?.addEventListener("click", () => {
  camera.position.set(0, 0.22, 1.55);
  controls.target.set(0, 0.09, 0);
  controls.reset();
});
controls.addEventListener("start", () => {
  if (!spinning) return;
  spinning = false;
  controls.autoRotate = false;
  if (spinButton) {
    spinButton.textContent = "Resume rotation";
    spinButton.setAttribute("aria-pressed", "false");
  }
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * renderer.getPixelRatio()) || canvas.height !== Math.round(height * renderer.getPixelRatio())) {
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
}

function render() {
  resize();
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();
