import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./patient-mock.css";

window.addEventListener("error", event => {
  const output = document.querySelector<HTMLElement>("#patient-error");
  if (!output) return;
  output.hidden = false;
  output.textContent = `Patient preview error: ${event.message}`;
});

type Point = [number, number, number];
type EyeRig = { gaze: THREE.Group; pupil: THREE.Mesh; baseX: number };

function requiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Patient study element unavailable: ${selector}`);
  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#patient-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e7ebe4");
scene.fog = new THREE.Fog("#e7ebe4", 3.2, 6);
const camera = new THREE.PerspectiveCamera(30, 1, .01, 10);
camera.position.set(0, 1.25, 4.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, .9, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = .9;
controls.maxDistance = 5;

const materials = {
  skin: new THREE.MeshPhysicalMaterial({ color: "#a97453", roughness: .62, clearcoat: .08, sheen: .12, sheenColor: new THREE.Color("#d99b79") }),
  oldSkin: new THREE.MeshStandardMaterial({ color: "#a97453", roughness: .86 }),
  shirt: new THREE.MeshStandardMaterial({ color: "#617f94", roughness: .76 }),
  oldShirt: new THREE.MeshStandardMaterial({ color: "#70899b", roughness: .86 }),
  jeans: new THREE.MeshStandardMaterial({ color: "#293d51", roughness: .82 }),
  hair: new THREE.MeshStandardMaterial({ color: "#242124", roughness: .88 }),
  sclera: new THREE.MeshPhysicalMaterial({ color: "#eee9de", roughness: .28, clearcoat: .55 }),
  iris: new THREE.MeshPhysicalMaterial({ color: "#6b5137", roughness: .38, clearcoat: .4 }),
  pupil: new THREE.MeshBasicMaterial({ color: "#101314" }),
  highlight: new THREE.MeshBasicMaterial({ color: "#f8ffff", transparent: true, opacity: .82 }),
  lip: new THREE.MeshStandardMaterial({ color: "#75483f", roughness: .58 }),
  shoe: new THREE.MeshStandardMaterial({ color: "#303334", roughness: .8 }),
  chair: new THREE.MeshStandardMaterial({ color: "#234b51", roughness: .74 }),
  metal: new THREE.MeshStandardMaterial({ color: "#aeb9b9", roughness: .4, metalness: .5 }),
};

function mesh<T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material, parent: THREE.Object3D, p: Point = [0, 0, 0], r: Point = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...p);
  object.rotation.set(...r);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function orb(parent: THREE.Object3D, p: Point, scale: Point, material: THREE.Material, segments = 32) {
  const object = mesh(new THREE.SphereGeometry(1, segments, Math.max(16, segments / 2)), material, parent, p);
  object.scale.set(...scale);
  return object;
}

function cylinder(parent: THREE.Object3D, p: Point, radius: number, height: number, material: THREE.Material, rotation: Point = [0, 0, 0]) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, 24), material, parent, p, rotation);
}

function limb(parent: THREE.Object3D, a: Point, b: Point, radius: number, material: THREE.Material) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const object = mesh(
    new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length() - radius * 2), 8, 20),
    material,
    parent,
    start.clone().add(end).multiplyScalar(.5).toArray() as Point,
  );
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return object;
}

function humanHeadGeometry() {
  const geometry = new THREE.SphereGeometry(1, 56, 40);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    // A single continuous skull: wider at the temples, narrowing through the jaw.
    const jaw = y < -.12 ? .72 + .28 * Math.max(0, (y + 1) / .88) : 1;
    const temple = 1 - Math.max(0, y - .60) * .08;
    const chin = y < -.72 ? (y + .72) * .025 : 0;
    positions.setXYZ(index, x * .126 * jaw * temple, y * .172 + chin, z * .116);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function addChair(parent: THREE.Object3D) {
  cylinder(parent, [0, .13, 0], .39, .11, materials.metal);
  cylinder(parent, [0, .34, 0], .10, .37, materials.metal);
  mesh(new THREE.BoxGeometry(.62, .15, .58), materials.chair, parent, [0, .55, 0]);
  mesh(new THREE.BoxGeometry(.62, .87, .13), materials.chair, parent, [0, .98, -.27], [-.09, 0, 0]);
  for (const side of [-1, 1]) {
    cylinder(parent, [side * .36, .65, .03], .024, .34, materials.metal);
    mesh(new THREE.BoxGeometry(.12, .07, .52), materials.chair, parent, [side * .36, .83, .04]);
  }
  mesh(new THREE.BoxGeometry(.55, .035, .23), materials.metal, parent, [0, .28, .49]);
}

function currentPatient() {
  const root = new THREE.Group();
  const eyes: EyeRig[] = [];
  addChair(root);
  orb(root, [0, .98, -.04], [.245, .33, .16], materials.oldShirt);
  cylinder(root, [0, 1.3, -.015], .065, .13, materials.oldSkin);
  orb(root, [0, 1.48, 0], [.13, .18, .13], materials.oldSkin);
  orb(root, [0, 1.57, -.03], [.139, .11, .126], materials.hair);
  orb(root, [0, 1.46, .128], [.024, .04, .03], materials.oldSkin);
  orb(root, [0, 1.393, .111], [.032, .007, .012], materials.lip);
  for (const side of [-1, 1]) {
    orb(root, [side * .13, 1.48, 0], [.024, .04, .025], materials.oldSkin);
    orb(root, [side * .048, 1.5, .115], [.025, .011, .013], materials.sclera);
    const gaze = new THREE.Group();
    gaze.position.set(side * .048, 1.5, .129);
    root.add(gaze);
    const pupil = mesh(new THREE.CircleGeometry(.008, 24), materials.pupil, gaze);
    eyes.push({ gaze, pupil, baseX: side * .048 });
    limb(root, [side * .2, 1.18, -.04], [side * .3, .89, .03], .078, materials.oldShirt);
    limb(root, [side * .3, .89, .03], [side * .23, .78, .28], .05, materials.oldSkin);
    orb(root, [side * .23, .775, .29], [.055, .034, .08], materials.oldSkin);
    limb(root, [side * .14, .64, -.02], [side * .17, .58, .42], .10, materials.jeans);
    limb(root, [side * .17, .58, .42], [side * .17, .14, .48], .075, materials.jeans);
    orb(root, [side * .17, .085, .55], [.09, .06, .16], materials.shoe);
  }
  return { root, eyes };
}

function proposedEye(root: THREE.Group, side: number): EyeRig {
  const x = side * .048;
  orb(root, [x, 1.5, .113], [.019, .0085, .008], materials.sclera, 36);
  const gaze = new THREE.Group();
  gaze.position.set(x, 1.5, .122);
  root.add(gaze);
  mesh(new THREE.CircleGeometry(.0067, 36), materials.iris, gaze);
  const pupil = mesh(new THREE.CircleGeometry(.0042, 36), materials.pupil, gaze, [0, 0, .001]);
  mesh(new THREE.CircleGeometry(.0012, 18), materials.highlight, gaze, [-.0018, .0024, .002]);
  const upper = new THREE.CatmullRomCurve3([new THREE.Vector3(-.020, 0, 0), new THREE.Vector3(0, .009, .002), new THREE.Vector3(.020, 0, 0)]);
  const lower = new THREE.CatmullRomCurve3([new THREE.Vector3(-.019, 0, 0), new THREE.Vector3(0, -.0065, .001), new THREE.Vector3(.019, 0, 0)]);
  mesh(new THREE.TubeGeometry(upper, 24, .0018, 10, false), materials.skin, root, [x, 1.5, .125]);
  mesh(new THREE.TubeGeometry(lower, 24, .0012, 10, false), materials.skin, root, [x, 1.5, .125]);
  return { gaze, pupil, baseX: x };
}

function addFinger(root: THREE.Group, side: number, index: number) {
  mesh(
    new THREE.CapsuleGeometry(.006, .032, 5, 10),
    materials.skin,
    root,
    [side * (.205 + index * .009), .765 - index * .002, .35 + index * .007],
    [Math.PI / 2, 0, side * .12],
  );
}

function proposedPatient() {
  const root = new THREE.Group();
  addChair(root);
  orb(root, [0, .98, -.05], [.23, .32, .145], materials.shirt, 40);
  orb(root, [0, 1.15, -.045], [.255, .12, .14], materials.shirt, 40);
  const collar = new THREE.CatmullRomCurve3([new THREE.Vector3(-.07, 1.245, .015), new THREE.Vector3(0, 1.20, .055), new THREE.Vector3(.07, 1.245, .015)]);
  mesh(new THREE.TubeGeometry(collar, 24, .009, 12, false), materials.shirt, root);
  cylinder(root, [0, 1.31, -.012], .062, .14, materials.skin);

  mesh(humanHeadGeometry(), materials.skin, root, [0, 1.48, 0]);
  orb(root, [0, 1.455, .124], [.014, .027, .017], materials.skin, 32);
  const mouth = new THREE.CatmullRomCurve3([new THREE.Vector3(-.027, 0, 0), new THREE.Vector3(0, -.003, .002), new THREE.Vector3(.027, 0, 0)]);
  mesh(new THREE.TubeGeometry(mouth, 24, .0018, 10, false), materials.lip, root, [0, 1.405, .114]);
  for (const side of [-1, 1]) {
    orb(root, [side * .122, 1.49, -.002], [.018, .034, .020], materials.skin, 28);
    const brow = new THREE.CatmullRomCurve3([new THREE.Vector3(-.019, 0, 0), new THREE.Vector3(0, .004, .002), new THREE.Vector3(.019, 0, 0)]);
    mesh(new THREE.TubeGeometry(brow, 20, .0018, 8, false), materials.hair, root, [side * .048, 1.526, .119], [0, 0, side * -.05]);
  }
  orb(root, [0, 1.588, -.020], [.130, .100, .116], materials.hair, 40);
  for (const x of [-.075, -.025, .025, .075]) orb(root, [x, 1.568, .048], [.038, .052, .044], materials.hair, 28);
  const eyes = [proposedEye(root, -1), proposedEye(root, 1)];

  for (const side of [-1, 1]) {
    limb(root, [side * .19, 1.18, -.03], [side * .29, .91, .03], .073, materials.shirt);
    limb(root, [side * .29, .91, .03], [side * .23, .79, .27], .047, materials.skin);
    orb(root, [side * .23, .78, .30], [.052, .032, .075], materials.skin, 28);
    for (let finger = 0; finger < 4; finger += 1) addFinger(root, side, finger);
    limb(root, [side * .14, .65, -.02], [side * .18, .58, .42], .092, materials.jeans);
    limb(root, [side * .18, .58, .42], [side * .18, .15, .49], .069, materials.jeans);
    orb(root, [side * .18, .09, .56], [.087, .055, .15], materials.shoe, 28);
  }
  return { root, eyes };
}

const current = currentPatient();
const proposed = proposedPatient();
current.root.position.x = -.58;
proposed.root.position.x = .58;
scene.add(current.root, proposed.root);

scene.add(new THREE.HemisphereLight("#fffdf5", "#687779", 2));
const key = new THREE.DirectionalLight("#ffffff", 3);
key.position.set(-2, 4, 3);
key.castShadow = true;
scene.add(key);
const fill = new THREE.DirectionalLight("#9edbd2", 1.4);
fill.position.set(2, 1, -2);
scene.add(fill);
const floor = mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: "#e7ebe4", roughness: 1 }), scene, [0, -.01, 0], [-Math.PI / 2, 0, 0]);
floor.castShadow = false;

const allEyes = [...current.eyes, ...proposed.eyes];
let lightOn = false;
const lightButton = requiredElement<HTMLButtonElement>("#light-button");
lightButton.addEventListener("click", () => {
  lightOn = !lightOn;
  allEyes.forEach(eye => eye.pupil.scale.setScalar(lightOn ? .56 : 1));
  lightButton.textContent = lightOn ? "Light on" : "Light off";
  lightButton.setAttribute("aria-pressed", String(lightOn));
});

function setGaze(x: number, y: number, selected: string) {
  allEyes.forEach(eye => eye.gaze.position.set(eye.baseX + x, 1.5 + y, .127));
  document.querySelectorAll<HTMLButtonElement>("[data-gaze]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.gaze === selected)));
}
document.querySelectorAll<HTMLButtonElement>("[data-gaze]").forEach(button => button.addEventListener("click", () => {
  const selected = button.dataset.gaze ?? "centre";
  setGaze(selected === "left" ? -.009 : selected === "right" ? .009 : 0, selected === "up" ? .006 : 0, selected);
}));

document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(button => button.addEventListener("click", () => {
  const face = button.dataset.view === "face";
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
  camera.position.set(0, face ? 1.50 : 1.25, face ? 1.9 : 4.2);
  controls.target.set(0, face ? 1.49 : .9, 0);
  controls.update();
}));

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
