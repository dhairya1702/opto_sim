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
const camera = new THREE.PerspectiveCamera(31, 1, .01, 10);
camera.position.set(0, .22, 1.55);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, .09, 0);
controls.enableDamping = true;
controls.dampingFactor = .06;
controls.enablePan = false;
controls.minDistance = .85;
controls.maxDistance = 2.25;
controls.minPolarAngle = Math.PI * .28;
controls.maxPolarAngle = Math.PI * .70;
controls.autoRotate = true;
controls.autoRotateSpeed = .75;

const oldNeutral = new THREE.MeshStandardMaterial({ color: "#536164", roughness: .74, metalness: .04 });
const shell = new THREE.MeshStandardMaterial({ color: "#25383b", roughness: .52, metalness: .12 });
const grip = new THREE.MeshStandardMaterial({ color: "#17383a", roughness: .72, metalness: .02 });
const metal = new THREE.MeshStandardMaterial({ color: "#a8b6b0", roughness: .30, metalness: .72 });
const darkMetal = new THREE.MeshStandardMaterial({ color: "#4d5e5d", roughness: .34, metalness: .56 });
const rubber = new THREE.MeshStandardMaterial({ color: "#091719", roughness: .86, metalness: 0 });
const glass = new THREE.MeshPhysicalMaterial({ color: "#a9e4dc", roughness: .12, transmission: .38, thickness: .01, transparent: true, opacity: .84 });
const litGlass = new THREE.MeshPhysicalMaterial({ color: "#ffdda1", emissive: "#a45d12", emissiveIntensity: .35, roughness: .15, transmission: .2, thickness: .01 });
const accent = new THREE.MeshStandardMaterial({ color: "#d39b42", roughness: .42, metalness: .45 });

function mesh<T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material, parent: THREE.Object3D, position: THREE.Vector3Tuple, rotation: THREE.Vector3Tuple = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.rotation.set(...rotation);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function cylinder(parent: THREE.Object3D, radius: number, height: number, material: THREE.Material, position: THREE.Vector3Tuple, rotation: THREE.Vector3Tuple = [0, 0, 0], radialSegments = 32) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, radialSegments), material, parent, position, rotation);
}

function currentOphthalmoscope() {
  const root = new THREE.Group();
  cylinder(root, .027, .21, oldNeutral, [0, .10, 0]);
  cylinder(root, .032, .025, metal, [0, .215, 0]);
  mesh(new THREE.BoxGeometry(.09, .09, .044), oldNeutral, root, [0, .265, 0]);
  cylinder(root, .018, .012, glass, [0, .27, .026], [Math.PI / 2, 0, 0]);
  cylinder(root, .025, .012, darkMetal, [.037, .248, 0], [0, 0, Math.PI / 2]);
  root.position.set(-.23, -.075, 0);
  return root;
}

function familyHandle(parent: THREE.Object3D) {
  const profile = [
    [.023, -.052], [.026, -.047], [.027, -.030], [.025, -.004],
    [.0235, .043], [.025, .082], [.029, .099], [.031, .106],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(profile, 36), grip, parent, [0, .047, 0]);
  for (const y of [-.010, .003, .016, .029, .042, .055]) {
    mesh(new THREE.TorusGeometry(.025, .0012, 6, 28), darkMetal, parent, [0, y, 0], [Math.PI / 2, 0, 0]);
  }
  cylinder(parent, .030, .025, metal, [0, .164, 0]);
  cylinder(parent, .026, .012, accent, [0, -.003, 0]);
}

function headShape() {
  const shape = new THREE.Shape();
  shape.moveTo(-.043, -.061);
  shape.bezierCurveTo(-.061, -.047, -.067, -.018, -.064, .018);
  shape.bezierCurveTo(-.062, .054, -.038, .071, 0, .074);
  shape.bezierCurveTo(.038, .071, .062, .054, .064, .018);
  shape.bezierCurveTo(.067, -.018, .061, -.047, .043, -.061);
  shape.bezierCurveTo(.022, -.073, -.022, -.073, -.043, -.061);
  return shape;
}

function proposedOphthalmoscope() {
  const root = new THREE.Group();
  familyHandle(root);

  const neckPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, .176, 0),
    new THREE.Vector3(0, .194, 0),
    new THREE.Vector3(0, .207, 0),
    new THREE.Vector3(0, .218, 0),
  ]);
  mesh(new THREE.TubeGeometry(neckPath, 16, .019, 20, false), shell, root, [0, 0, 0]);

  const housing = new THREE.ExtrudeGeometry(headShape(), {
    depth: .046,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: .006,
    bevelThickness: .004,
    curveSegments: 18,
  });
  housing.translate(0, 0, -.023);
  mesh(housing, shell, root, [0, .273, 0]);

  // Patient-facing illumination window and protective rim.
  cylinder(root, .024, .013, metal, [0, .289, .030], [Math.PI / 2, 0, 0]);
  cylinder(root, .016, .007, litGlass, [0, .289, .040], [Math.PI / 2, 0, 0]);
  mesh(new THREE.TorusGeometry(.025, .0045, 10, 36), rubber, root, [0, .289, .045]);

  // Examiner-facing eye cup and viewing aperture.
  cylinder(root, .026, .018, rubber, [0, .298, -.031], [Math.PI / 2, 0, 0]);
  cylinder(root, .012, .021, darkMetal, [0, .298, -.043], [Math.PI / 2, 0, 0]);
  cylinder(root, .0055, .023, rubber, [0, .298, -.054], [Math.PI / 2, 0, 0]);

  // Indexed lens wheel on the rear face.
  cylinder(root, .044, .009, darkMetal, [0, .267, -.030], [Math.PI / 2, 0, 0], 40);
  cylinder(root, .036, .004, shell, [0, .267, -.037], [Math.PI / 2, 0, 0], 40);
  for (let index = 0; index < 12; index += 1) {
    const angle = index / 12 * Math.PI * 2;
    cylinder(root, .0032, .0025, index === 2 ? accent : metal, [Math.sin(angle) * .029, .267 + Math.cos(angle) * .029, -.041], [Math.PI / 2, 0, 0], 14);
  }

  // Lower aperture selector and side focus wheel.
  cylinder(root, .021, .010, darkMetal, [0, .222, -.027], [Math.PI / 2, 0, 0], 28);
  mesh(new THREE.BoxGeometry(.005, .012, .004), accent, root, [0, .236, -.034], [0, 0, .15]);
  const focus = new THREE.Group();
  focus.position.set(.071, .266, 0);
  focus.rotation.z = Math.PI / 2;
  root.add(focus);
  cylinder(focus, .024, .014, darkMetal, [0, 0, 0]);
  for (let index = 0; index < 16; index += 1) {
    const angle = index / 16 * Math.PI * 2;
    mesh(new THREE.BoxGeometry(.006, .004, .012), metal, focus, [0, Math.cos(angle) * .022, Math.sin(angle) * .022], [angle, 0, 0]);
  }

  root.position.set(.23, -.075, 0);
  return root;
}

const comparison = new THREE.Group();
comparison.add(currentOphthalmoscope(), proposedOphthalmoscope());
scene.add(comparison);

function pedestal(x: number, proposed: boolean) {
  const root = new THREE.Group();
  root.position.set(x, -.225, 0);
  mesh(new THREE.CylinderGeometry(.115, .13, .022, 48), new THREE.MeshStandardMaterial({ color: proposed ? "#d5ddd4" : "#d1d5cf", roughness: .88 }), root, [0, 0, 0]);
  mesh(new THREE.TorusGeometry(.105, .0022, 8, 48), new THREE.MeshStandardMaterial({ color: proposed ? "#33736d" : "#858c87", roughness: .6 }), root, [0, .012, 0], [Math.PI / 2, 0, 0]);
  scene.add(root);
}
pedestal(-.23, false);
pedestal(.23, true);

scene.add(new THREE.HemisphereLight("#f7fff8", "#78837d", 2.15));
const key = new THREE.DirectionalLight("#ffffff", 3.2);
key.position.set(-1.5, 2.2, 2.4);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const rim = new THREE.DirectionalLight("#9edbd2", 2.0);
rim.position.set(1.5, .8, -1.4);
scene.add(rim);
const floor = mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: "#e7ebe4", roughness: 1 }), scene, [0, -.238, 0], [-Math.PI / 2, 0, 0]);
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
  camera.position.set(0, .22, 1.55);
  controls.target.set(0, .09, 0);
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
