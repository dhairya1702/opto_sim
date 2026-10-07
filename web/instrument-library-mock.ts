import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import "./instrument-library-mock.css";

type ToolGroup = "EXAMINATION" | "SENSORY" | "BINOCULAR VISION";
type Builder = () => THREE.Group;
type ToolStudy = {
  id: string;
  label: string;
  group: ToolGroup;
  currentNote: string;
  proposedNote: string;
  brief: string;
  current: Builder;
  proposed: Builder;
};

const palette = {
  old: new THREE.MeshStandardMaterial({ color: "#596669", roughness: .76, metalness: .03 }),
  shell: new THREE.MeshStandardMaterial({ color: "#24383b", roughness: .54, metalness: .11 }),
  grip: new THREE.MeshStandardMaterial({ color: "#17383a", roughness: .73, metalness: .02 }),
  metal: new THREE.MeshStandardMaterial({ color: "#a8b6b0", roughness: .30, metalness: .72 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: "#4c5f5e", roughness: .36, metalness: .54 }),
  accent: new THREE.MeshStandardMaterial({ color: "#d39b42", roughness: .42, metalness: .42 }),
  paper: new THREE.MeshStandardMaterial({ color: "#f3f0df", roughness: .84 }),
  red: new THREE.MeshStandardMaterial({ color: "#a92f3b", roughness: .43 }),
  green: new THREE.MeshStandardMaterial({ color: "#2c9a6a", roughness: .43 }),
  teal: new THREE.MeshStandardMaterial({ color: "#3f827a", roughness: .52, metalness: .12 }),
  rubber: new THREE.MeshStandardMaterial({ color: "#091719", roughness: .88 }),
  glass: new THREE.MeshPhysicalMaterial({ color: "#9fded7", roughness: .12, transmission: .38, thickness: .01, transparent: true, opacity: .68 }),
  redGlass: new THREE.MeshPhysicalMaterial({ color: "#d83d4b", roughness: .17, transmission: .3, thickness: .01, transparent: true, opacity: .78 }),
  greenGlass: new THREE.MeshPhysicalMaterial({ color: "#35b773", roughness: .17, transmission: .3, thickness: .01, transparent: true, opacity: .72 }),
};

function mesh<T extends THREE.BufferGeometry>(geometry: T, material: THREE.Material, parent: THREE.Object3D, p: THREE.Vector3Tuple = [0, 0, 0], r: THREE.Vector3Tuple = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...p); object.rotation.set(...r);
  object.castShadow = true; object.receiveShadow = true; parent.add(object);
  return object;
}
function box(parent: THREE.Object3D, size: THREE.Vector3Tuple, p: THREE.Vector3Tuple, material = palette.old, r: THREE.Vector3Tuple = [0, 0, 0]) { return mesh(new THREE.BoxGeometry(...size), material, parent, p, r); }
function cylinder(parent: THREE.Object3D, radius: number, height: number, p: THREE.Vector3Tuple, material = palette.old, r: THREE.Vector3Tuple = [0, 0, 0], segments = 28) { return mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material, parent, p, r); }
function torus(parent: THREE.Object3D, radius: number, tube: number, p: THREE.Vector3Tuple, material: THREE.Material, r: THREE.Vector3Tuple = [Math.PI / 2, 0, 0]) { return mesh(new THREE.TorusGeometry(radius, tube, 10, 36), material, parent, p, r); }
function capsule(parent: THREE.Object3D, radius: number, length: number, p: THREE.Vector3Tuple, material: THREE.Material, r: THREE.Vector3Tuple = [0, 0, 0]) { return mesh(new THREE.CapsuleGeometry(radius, length, 6, 16), material, parent, p, r); }
function lens(parent: THREE.Object3D, radius: number, p: THREE.Vector3Tuple, material = palette.glass) { return cylinder(parent, radius, .007, p, material, [Math.PI / 2, 0, 0], 36); }
function moldedHandle(parent: THREE.Object3D, height = .18, width = .025, p: THREE.Vector3Tuple = [0, .07, 0]) {
  const points = [[width * .80, -height / 2], [width, -height * .42], [width * .92, 0], [width, height * .38], [width * 1.14, height / 2]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(points, 32), palette.grip, parent, p);
  for (let i = -2; i <= 2; i += 1) torus(parent, width * .94, .0011, [p[0], p[1] + i * height * .12, p[2]], palette.darkMetal);
}
function roundedPlate(parent: THREE.Object3D, width: number, height: number, depth: number, p: THREE.Vector3Tuple, material: THREE.Material, radius = .012) {
  const x = width / 2, y = height / 2, rr = Math.min(radius, x * .7, y * .7);
  const shape = new THREE.Shape();
  shape.moveTo(-x + rr, -y); shape.lineTo(x - rr, -y); shape.quadraticCurveTo(x, -y, x, -y + rr);
  shape.lineTo(x, y - rr); shape.quadraticCurveTo(x, y, x - rr, y); shape.lineTo(-x + rr, y);
  shape.quadraticCurveTo(-x, y, -x, y - rr); shape.lineTo(-x, -y + rr); shape.quadraticCurveTo(-x, -y, -x + rr, -y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, bevelSize: Math.min(.003, depth * .2), bevelThickness: .002, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, material, parent, p);
}
function oldWand(head = false) { const g = new THREE.Group(); cylinder(g, .016, .22, [0, .10, 0]); if (head) box(g, [.045, .04, .025], [0, .225, 0]); return g; }

function oldPaddle(pinhole = false) { const g = new THREE.Group(); box(g, [.024, .19, .017], [0, .075, 0]); mesh(new THREE.SphereGeometry(.073, 24, 16), palette.old, g, [0, .22, 0]).scale.set(1, 1.08, .17); if (pinhole) torus(g, .009, .003, [0, .22, .014], palette.metal, [0, 0, 0]); return g; }
function proposedPaddle(pinhole = false, cover = false) { const g = new THREE.Group(); capsule(g, .014, .135, [0, .075, 0], palette.grip); roundedPlate(g, .13, .145, .016, [0, .205, 0], palette.shell, .055); torus(g, .052, .006, [0, .205, .011], cover ? palette.teal : palette.darkMetal, [0, 0, 0]); if (pinhole) { cylinder(g, .014, .007, [0, .205, .017], palette.metal, [Math.PI / 2, 0, 0]); cylinder(g, .003, .009, [0, .205, .022], palette.rubber, [Math.PI / 2, 0, 0]); } box(g, [.034, .014, .023], [0, -.007, 0], palette.accent); return g; }
function proposedPenlight() { const g = new THREE.Group(); const points = [[.014, -.10], [.017, -.092], [.016, .065], [.020, .082], [.021, .098]].map(([x,y]) => new THREE.Vector2(x,y)); mesh(new THREE.LatheGeometry(points, 32), palette.grip, g, [0,.105,0]); cylinder(g,.023,.023,[0,.215,0],palette.metal); cylinder(g,.018,.008,[0,.232,0],palette.glass); capsule(g,.005,.022,[.018,.13,0],palette.accent,[0,0,Math.PI/2]); box(g,[.007,.07,.005],[-.019,.09,0],palette.darkMetal); return g; }
function proposedMotility() { const g = new THREE.Group(); moldedHandle(g,.17,.010,[0,.07,0]); cylinder(g,.009,.09,[0,.20,0],palette.metal); cylinder(g,.023,.009,[0,.255,0],palette.shell,[Math.PI/2,0,0]); cylinder(g,.014,.011,[0,.255,.008],palette.red,[Math.PI/2,0,0]); torus(g,.018,.003,[0,.255,.014],palette.accent,[0,0,0]); return g; }

function oldPrism() { const g = new THREE.Group(); box(g,[.034,.15,.028],[0,-.075,0]); box(g,[.09,.29,.018],[0,.13,0]); for(let i=0;i<8;i++) cylinder(g,.024,.012,[0,.015+i*.032,.012],palette.glass,[Math.PI/2,0,0],4); return g; }
function proposedPrism() { const g = new THREE.Group(); moldedHandle(g,.16,.017,[0,.03,0]); roundedPlate(g,.105,.285,.012,[0,.225,0],palette.darkMetal,.018); for(let i=0;i<8;i++){ const h=.021+i*.0018; const prism=mesh(new THREE.CylinderGeometry(h*.82,h,.014,3),palette.glass,g,[0,.118+i*.032,.012],[Math.PI/2,0,(i%2?1:-1)*Math.PI/2]); prism.scale.x=1.2; box(g,[.012,.005,.004],[.040,.118+i*.032,.023],i===4?palette.accent:palette.metal); } return g; }

function oldCard(cross=false) { const g=new THREE.Group(); cylinder(g,.009,.14,[0,.05,0]); if(cross){box(g,[.23,.18,.006],[0,.18,0],palette.paper); box(g,[.03,.24,.007],[0,.18,.002],palette.paper);} else box(g,[.24,.16,.008],[0,.18,0],palette.paper); return g; }
function proposedNearCard() { const g=new THREE.Group(); moldedHandle(g,.15,.012,[0,.04,0]); roundedPlate(g,.24,.17,.009,[0,.20,0],palette.paper,.014); roundedPlate(g,.012,.15,.012,[-.108,.20,0],palette.teal,.004); for(let i=0;i<5;i++) box(g,[.12-i*.014,.004,.002],[.015,.245-i*.022,.007],i===0?palette.red:palette.darkMetal); return g; }
function proposedThorington() { const g=new THREE.Group(); moldedHandle(g,.15,.012,[0,.035,0]); roundedPlate(g,.235,.17,.008,[0,.205,0],palette.paper,.012); box(g,[.025,.22,.010],[0,.205,0],palette.paper); torus(g,.009,.003,[0,.205,.009],palette.darkMetal,[0,0,0]); for(let i=-5;i<=5;i++){if(i===0)continue;box(g,[.002,.012,.002],[i*.018,.205,.008],palette.teal);box(g,[.012,.002,.002],[0,.205+i*.014,.008],palette.teal);} return g; }

function oldFrame(colored?:"red-green"|"polarised") { const g=new THREE.Group(); for(const x of [-.048,.048]){torus(g,.034,.012,[x,.16,0],palette.old,[0,0,0]); if(colored) lens(g,.029,[x,.16,.006],colored==="red-green"?(x<0?palette.redGlass:palette.greenGlass):palette.glass);} box(g,[.035,.012,.02],[0,.177,0]); cylinder(g,.006,.16,[-.115,.16,-.08],palette.old,[Math.PI/2,0,0]); cylinder(g,.006,.16,[.115,.16,-.08],palette.old,[Math.PI/2,0,0]); return g; }
function proposedFrame(colored?:"red-green"|"polarised") { const g=new THREE.Group(); for(const x of [-.052,.052]){torus(g,.038,.006,[x,.17,0],palette.shell,[0,0,0]); torus(g,.032,.002,[x,.17,.006],palette.metal,[0,0,0]); if(colored) lens(g,.031,[x,.17,.004],colored==="red-green"?(x<0?palette.redGlass:palette.greenGlass):palette.glass); cylinder(g,.006,.018,[x,.216,0],palette.accent);} const bridge=new THREE.CatmullRomCurve3([new THREE.Vector3(-.014,.177,0),new THREE.Vector3(0,.187,.004),new THREE.Vector3(.014,.177,0)]);mesh(new THREE.TubeGeometry(bridge,16,.004,10,false),palette.metal,g); cylinder(g,.004,.17,[-.113,.17,-.075],palette.darkMetal,[Math.PI/2,0,.10]); cylinder(g,.004,.17,[.113,.17,-.075],palette.darkMetal,[Math.PI/2,0,-.10]); if(!colored){box(g,[.018,.038,.012],[-.014,.132,.01],palette.metal);box(g,[.018,.038,.012],[.014,.132,.01],palette.metal);} return g; }

function oldWorth() { const g=oldWand(); cylinder(g,.06,.012,[0,.225,0],palette.old,[Math.PI/2,0,0]); for(const [x,y,m] of [[0,.03,palette.red],[-.025,0,palette.green],[.025,0,palette.green],[0,-.03,palette.paper]] as const)cylinder(g,.009,.014,[x,.225+y,.008],m,[Math.PI/2,0,0]); return g; }
function proposedWorth() { const g=new THREE.Group(); moldedHandle(g,.15,.013,[0,.04,0]); roundedPlate(g,.135,.135,.024,[0,.205,0],palette.shell,.042); cylinder(g,.055,.010,[0,.205,.018],palette.rubber,[Math.PI/2,0,0]); for(const [x,y,m] of [[0,.03,palette.red],[-.025,0,palette.green],[.025,0,palette.green],[0,-.03,palette.paper]] as const)cylinder(g,.009,.006,[x,.205+y,.026],m,[Math.PI/2,0,0]); capsule(g,.006,.014,[.045,.125,.016],palette.accent,[0,0,Math.PI/2]); return g; }

function oldBook() { const g=new THREE.Group(); cylinder(g,.012,.06,[0,.03,0]); box(g,[.22,.15,.01],[0,.14,0],palette.paper); return g; }
function proposedBook() { const g=new THREE.Group(); moldedHandle(g,.10,.011,[0,.01,0]); roundedPlate(g,.125,.17,.009,[-.064,.16,0],palette.paper,.010); roundedPlate(g,.125,.17,.009,[.064,.16,0],palette.paper,.010); cylinder(g,.004,.17,[0,.16,.003],palette.darkMetal); for(const x of [-.085,-.04,.04,.085]){torus(g,.016,.002,[x,.17,.008],palette.teal,[0,0,0]);cylinder(g,.005,.003,[x,.17,.010],palette.accent,[Math.PI/2,0,0]);} return g; }

function oldMaddox() { const g=oldWand(); torus(g,.055,.012,[0,.22,0],palette.old,[0,0,0]); lens(g,.048,[0,.22,.006],palette.redGlass); return g; }
function proposedMaddox() { const g=new THREE.Group(); moldedHandle(g,.17,.013,[0,.06,0]); torus(g,.061,.007,[0,.225,0],palette.shell,[0,0,0]); lens(g,.053,[0,.225,.005],palette.redGlass); for(let x=-.038;x<=.038;x+=.012)cylinder(g,.0017,.095,[x,.225,.011],palette.red,[0,0,0],10); box(g,[.034,.018,.022],[0,-.005,0],palette.accent); return g; }

function oldFlipper(prism=false) { const g=new THREE.Group(); box(g,[.03,.19,.022],[0,.055,0]); box(g,[.18,.025,.019],[0,.14,0]); for(const x of [-.088,.088]){torus(g,.05,.010,[x,.20,0],palette.old,[0,0,0]); if(prism) mesh(new THREE.CylinderGeometry(.037,.03,.009,3),palette.glass,g,[x,.20,.006],[Math.PI/2,0,0]); else lens(g,.043,[x,.20,.006]);} return g; }
function proposedFlipper(prism=false, trial=false) { const g=new THREE.Group(); moldedHandle(g,.16,.014,[0,.055,0]); const bridge=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.135,0),new THREE.Vector3(-.04,.158,0),new THREE.Vector3(-.086,.18,0)]);mesh(new THREE.TubeGeometry(bridge,16,.007,12,false),palette.shell,g);const bridge2=bridge.clone();bridge2.points=bridge.points.map(v=>new THREE.Vector3(-v.x,v.y,v.z));mesh(new THREE.TubeGeometry(bridge2,16,.007,12,false),palette.shell,g);for(const x of [-.09,.09]){torus(g,.052,.007,[x,.205,0],palette.shell,[0,0,0]);torus(g,.044,.002,[x,.205,.007],palette.metal,[0,0,0]);if(prism)mesh(new THREE.CylinderGeometry(.043,.034,.008,3),palette.glass,g,[x,.205,.006],[Math.PI/2,0,x<0?Math.PI/2:-Math.PI/2]);else lens(g,.041,[x,.205,.006],trial?(x<0?palette.redGlass:palette.glass):palette.glass);}box(g,[.038,.016,.023],[0,-.006,0],palette.accent);return g; }

function oldFixation() { const g=oldWand(true); return g; }
function proposedFixation() { const g=new THREE.Group(); moldedHandle(g,.18,.011,[0,.07,0]); cylinder(g,.010,.07,[0,.205,0],palette.metal); const head=roundedPlate(g,.085,.085,.018,[0,.275,0],palette.paper,.018); head.rotation.y=.12; for(const radius of [.030,.020,.010])torus(g,radius,.003,[0,.275,.012],radius===.02?palette.accent:palette.shell,[0,0,0]); return g; }

const studies: ToolStudy[] = [
  { id:"distance",label:"Acuity occluder",group:"EXAMINATION",currentNote:"Flat paddle",proposedNote:"Molded viewing paddle",brief:"A continuous grip and softly shaped head make the occluder feel manufactured while retaining a simple, unmistakable silhouette.",current:()=>oldPaddle(),proposed:()=>proposedPaddle() },
  { id:"pinhole",label:"Pinhole occluder",group:"EXAMINATION",currentNote:"Paddle with surface dot",proposedNote:"Rimmed pinhole insert",brief:"The pinhole becomes a physical insert with visible depth, while the shared paddle body keeps the acuity tools related.",current:()=>oldPaddle(true),proposed:()=>proposedPaddle(true) },
  { id:"cover",label:"Cover occluder",group:"EXAMINATION",currentNote:"Generic paddle",proposedNote:"High-contrast cover face",brief:"A teal face ring distinguishes cover testing at a glance without changing the familiar paddle grip.",current:()=>oldPaddle(),proposed:()=>proposedPaddle(false,true) },
  { id:"pupils",label:"Penlight",group:"EXAMINATION",currentNote:"Uniform cylinder",proposedNote:"Tapered pocket light",brief:"A lens collar, pocket clip, tactile switch and end cap turn the generic tube into a readable handheld light.",current:()=>oldWand(),proposed:proposedPenlight },
  { id:"motility",label:"Motility target",group:"EXAMINATION",currentNote:"Thin cylinder",proposedNote:"Dedicated red fixation wand",brief:"The smaller grip and isolated red target make this read as a fixation wand rather than another penlight.",current:()=>oldWand(true),proposed:proposedMotility },
  { id:"near",label:"Near vision card",group:"EXAMINATION",currentNote:"Flat rectangle",proposedNote:"Handled reading card",brief:"A molded handle, reinforced spine and stepped reading marks give the card thickness and a clear way to hold it.",current:()=>oldCard(),proposed:proposedNearCard },
  { id:"subjective",label:"Trial frame",group:"EXAMINATION",currentNote:"Rings and rods",proposedNote:"Layered adjustable frame",brief:"Lens slots, bridge curvature, adjustment blocks and temples create real negative space and a believable fitting mechanism.",current:()=>oldFrame(),proposed:()=>proposedFrame() },
  { id:"prism",label:"Prism bar",group:"EXAMINATION",currentNote:"Box rail",proposedNote:"Stepped prism cells",brief:"Individually changing prism cells sit inside a rounded protective rail with a proper lower grip and selected-cell marker.",current:oldPrism,proposed:proposedPrism },
  { id:"worth",label:"Worth four-dot target",group:"SENSORY",currentNote:"Disk on a stick",proposedNote:"Illuminated target housing",brief:"A compact rounded housing, inset black field and side control give the four-dot target a purposeful illuminated form.",current:oldWorth,proposed:proposedWorth },
  { id:"red-green",label:"Red/green glasses",group:"SENSORY",currentNote:"Rings and straight arms",proposedNote:"Fitted filter frame",brief:"Curved bridge, slim temples and seated filter lenses make the glasses look wearable while keeping OD/OS colours obvious.",current:()=>oldFrame("red-green"),proposed:()=>proposedFrame("red-green") },
  { id:"polarised",label:"Polarised glasses",group:"SENSORY",currentNote:"Grey transparent rings",proposedNote:"Fitted polarised frame",brief:"The same sensory frame family carries neutral filters with thin lens seats and curved wearing geometry.",current:()=>oldFrame("polarised"),proposed:()=>proposedFrame("polarised") },
  { id:"stereo",label:"Stereo booklet",group:"SENSORY",currentNote:"Single flat page",proposedNote:"Hinged two-page booklet",brief:"Two rounded pages, a visible hinge and printed target cells make the object read as a booklet from every angle.",current:oldBook,proposed:proposedBook },
  { id:"maddox",label:"Maddox rod",group:"BINOCULAR VISION",currentNote:"Red disk in a ring",proposedNote:"Grooved trial-lens paddle",brief:"A proper lens cell, translucent insert and raised parallel rods communicate the optical element rather than a painted red circle.",current:oldMaddox,proposed:proposedMaddox },
  { id:"thorington",label:"Thorington card",group:"BINOCULAR VISION",currentNote:"Crossed rectangles",proposedNote:"Numbered cross card",brief:"A rounded card, reinforced vertical scale, central aperture and physical grip make the cross scale coherent.",current:()=>oldCard(true),proposed:proposedThorington },
  { id:"trial-lens",label:"Trial lens pair",group:"BINOCULAR VISION",currentNote:"Two rings on a bar",proposedNote:"Paired lens paddle",brief:"Layered metal rims and a curved bridge give the paired trial lenses depth while preserving quick left/right comparison.",current:()=>oldFlipper(),proposed:()=>proposedFlipper(false,true) },
  { id:"lens-flipper",label:"±2 D lens flipper",group:"BINOCULAR VISION",currentNote:"Box crossbar",proposedNote:"Curved dual-lens flipper",brief:"The bridge flows out of a tapered handle into distinct lens cells, removing the current T-shaped block construction.",current:()=>oldFlipper(),proposed:()=>proposedFlipper() },
  { id:"prism-flipper",label:"12 BO / 3 BI flipper",group:"BINOCULAR VISION",currentNote:"Box crossbar with triangles",proposedNote:"Protected dual-prism flipper",brief:"Two oriented wedge cells sit in rounded guards with a curved central bridge and deliberate hand grip.",current:()=>oldFlipper(true),proposed:()=>proposedFlipper(true) },
  { id:"fixation",label:"Fixation target",group:"BINOCULAR VISION",currentNote:"Box on a wand",proposedNote:"Reversible target wand",brief:"A thin stem and rounded target housing produce a clear fixation object with concentric high-contrast marks.",current:oldFixation,proposed:proposedFixation },
];

function requiredElement<T extends Element>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Instrument Design Lab element is unavailable: ${selector}`);
  return element;
}
const canvas = requiredElement<HTMLCanvasElement>("#instrument-canvas");
const list = requiredElement<HTMLDivElement>("#instrument-list");
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true }); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; renderer.shadowMap.enabled=true;
const scene=new THREE.Scene(); scene.background=new THREE.Color("#e7ebe4"); scene.fog=new THREE.Fog("#e7ebe4",2.3,4.4);
const camera=new THREE.PerspectiveCamera(31,1,.01,10); camera.position.set(0,.18,1.5);
const controls=new OrbitControls(camera,canvas); controls.target.set(0,.08,0); controls.enableDamping=true; controls.enablePan=false; controls.minDistance=.8; controls.maxDistance=2.2; controls.autoRotate=true; controls.autoRotateSpeed=.75;
scene.add(new THREE.HemisphereLight("#f7fff8","#78837d",2.15)); const key=new THREE.DirectionalLight("#fff",3.2);key.position.set(-1.5,2.2,2.4);key.castShadow=true;scene.add(key);const rim=new THREE.DirectionalLight("#9edbd2",2);rim.position.set(1.5,.8,-1.4);scene.add(rim);
const floor=mesh(new THREE.PlaneGeometry(6,6),new THREE.MeshStandardMaterial({color:"#e7ebe4",roughness:1}),scene,[0,-.205,0],[-Math.PI/2,0,0]);floor.castShadow=false;
for(const [x,color] of [[-.24,"#858c87"],[.24,"#33736d"]] as const){const p=new THREE.Group();p.position.set(x,-.193,0);mesh(new THREE.CylinderGeometry(.115,.13,.022,48),new THREE.MeshStandardMaterial({color:"#d5ddd4",roughness:.88}),p);torus(p,.105,.0022,[0,.012,0],new THREE.MeshStandardMaterial({color,roughness:.6}));scene.add(p);}
const comparison=new THREE.Group();scene.add(comparison);

const title=(id:string)=>document.querySelector<HTMLElement>(id);
function placePair(a:THREE.Group,b:THREE.Group){const ba=new THREE.Box3().setFromObject(a),bb=new THREE.Box3().setFromObject(b);const sa=ba.getSize(new THREE.Vector3()),sb=bb.getSize(new THREE.Vector3());const scale=.34/Math.max(sa.x,sa.y,sa.z,sb.x,sb.y,sb.z);for(const [g,bounds,x] of [[a,ba,-.24],[b,bb,.24]] as const){const center=bounds.getCenter(new THREE.Vector3());g.scale.setScalar(scale);g.position.set(x-center.x*scale,-.18-bounds.min.y*scale,-center.z*scale);comparison.add(g);}}
function selectStudy(study:ToolStudy){comparison.clear();placePair(study.current(),study.proposed());title("#tool-name")!.textContent=study.label;title("#tool-brief")!.textContent=study.brief;title("#current-title")!.textContent="Primitive model";title("#current-note")!.textContent=study.currentNote;title("#proposed-title")!.textContent="Shaped concept";title("#proposed-note")!.textContent=study.proposedNote;list.querySelectorAll("button").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.tool===study.id)));}
for(const group of ["EXAMINATION","SENSORY","BINOCULAR VISION"] as ToolGroup[]){const section=document.createElement("section");section.className="catalog-group";const heading=document.createElement("h3");heading.textContent=group;section.append(heading);for(const study of studies.filter(candidate=>candidate.group===group)){const button=document.createElement("button");button.type="button";button.dataset.tool=study.id;button.textContent=study.label;button.setAttribute("aria-pressed","false");button.addEventListener("click",()=>selectStudy(study));section.append(button);}list.append(section);}
selectStudy(studies[0]);

let spinning=true;const spin=document.querySelector<HTMLButtonElement>("#spin-button");spin?.addEventListener("click",()=>{spinning=!spinning;controls.autoRotate=spinning;spin.textContent=spinning?"Pause rotation":"Resume rotation";spin.setAttribute("aria-pressed",String(spinning));});document.querySelector("#reset-button")?.addEventListener("click",()=>{camera.position.set(0,.18,1.5);controls.target.set(0,.08,0);controls.reset();});controls.addEventListener("start",()=>{if(!spinning)return;spinning=false;controls.autoRotate=false;if(spin){spin.textContent="Resume rotation";spin.setAttribute("aria-pressed","false");}});
function render(){const width=canvas.clientWidth,height=canvas.clientHeight;if(canvas.width!==Math.round(width*renderer.getPixelRatio())||canvas.height!==Math.round(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();}controls.update();renderer.render(scene,camera);requestAnimationFrame(render);}render();
