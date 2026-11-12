import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { CLINIC_EYE_WHITE_RADII } from "../interaction/clinicPatient";
import { detailedPatientPoint } from "../interaction/detailedPatient";
import { patientMouthTarget } from "../interaction/patientAnimation";
import { useVoiceStatus } from "../voice/VoiceStatusContext";

type MeshData = { name: string; positions: number[]; uvs: number[]; indices: number[]; texture: string; center: number[] | null; blink?: number[] };
const asset = "/assets/patient-prototype/";
let prepared: { data: MeshData[]; textures: Map<string, THREE.Texture> } | null = null;
let pending: Promise<void> | null = null;

/** CPU-side asset cache; render instances own and dispose their GPU resources. */
export function preloadDetailedPatient(): Promise<void> {
  if (prepared) return Promise.resolve();
  if (pending) return pending;
  pending = (async () => {
    const response = await fetch(asset + "patient.json");
    if (!response.ok) throw new Error("Patient model is unavailable");
    const data = await response.json() as MeshData[];
    if (!Array.isArray(data) || !data.some(part => part.name === "skin")) throw new Error("Invalid patient model");
    const textures = new Map<string, THREE.Texture>();
    try {
      // Sequential loading keeps failure cleanup complete and bounded.
      for (const name of new Set(data.filter(part => !part.center).map(part => part.texture))) {
        const texture = await new THREE.TextureLoader().loadAsync(asset + name);
        texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; textures.set(name, texture);
      }
      prepared = { data, textures };
    } catch (error) { textures.forEach(texture => texture.dispose()); throw error; }
  })().finally(() => { pending = null; });
  return pending;
}

function transformPoints(points: number[]) {
  const result = new Float32Array(points.length);
  for (let i = 0; i < points.length; i += 3) result.set(detailedPatientPoint(points[i], points[i + 1], points[i + 2]), i);
  return result;
}

/** Cut the cosmetic skin away from the canonical oval; never mask the eyes. */
function clearEyeOpenings(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec3 patientPoint;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\npatientPoint=position;");
    shader.fragmentShader = "varying vec3 patientPoint;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
      vec2 eyeOffset=vec2((abs(patientPoint.x)-.048)/${CLINIC_EYE_WHITE_RADII[0]},(patientPoint.y-1.5)/${CLINIC_EYE_WHITE_RADII[1]});
      if(patientPoint.z>.07 && dot(eyeOffset,eyeOffset)<1.) discard;`);
  };
}

/** Visual adapter only. All examination decisions remain in existing controllers. */
export function DetailedPatient() {
  const { gl } = useThree();
  useEffect(() => {
    gl.domElement?.setAttribute?.("data-patient-appearance", "detailed");
    return () => gl.domElement?.removeAttribute?.("data-patient-appearance");
  }, [gl]);
  const voiceStatus = useVoiceStatus();
  const mouth = useRef(0);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const query = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = query.matches; }; update();
    query.addEventListener("change", update); return () => query.removeEventListener("change", update);
  }, []);
  const meshes = useMemo(() => {
    if (!prepared) throw new Error("Select and load the detailed patient before entering the clinic");
    const assets = prepared;
    return assets.data.filter(part => !part.center).map(part => {
      const geometry = new THREE.BufferGeometry();
      const positions = transformPoints(part.positions);
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(part.uvs, 2));
      // Feet are enclosed by shoes; omit their hidden skin to prevent toes
      // protruding through the sole while retaining the ankle transition.
      const indices = part.name === "skin" ? part.indices.filter((_, i) => {
        const start = i - i % 3;
        return !part.indices.slice(start, start + 3).every(index => part.positions[index * 3 + 1] < .245);
      }) : part.indices;
      geometry.setIndex(indices); geometry.computeVertexNormals();
      if (part.blink?.length) {
        const mouthShape = positions.slice();
        for (let i = 0; i < part.positions.length; i += 3) {
          const x = part.positions[i], y = part.positions[i + 1], z = part.positions[i + 2];
          if (z > .13 && y < 1.355 && y > 1.29 && Math.abs(x) < .045) {
            mouthShape[i + 1] -= .006 * Math.exp(-((x / .035) ** 2) - (((y - 1.335) / .025) ** 2));
          }
        }
        geometry.morphAttributes.position = [new THREE.BufferAttribute(mouthShape, 3)];
        geometry.morphAttributes.normal = [mouthShape].map(shape => {
          const copy = geometry.clone(); copy.setAttribute("position", new THREE.BufferAttribute(shape, 3)); copy.computeVertexNormals();
          const normal = copy.getAttribute("normal").clone(); copy.dispose(); return normal;
        });
      }
      const map = assets.textures.get(part.texture)?.clone();
      if (map) map.needsUpdate = true;
      const hair = part.name === "hair" || part.name === "brows";
      const material = new THREE.MeshStandardMaterial({ map,
        color: part.name === "skin" ? "#c3a38b" : part.name === "brows" ? "#675047" : "#ffffff",
        roughness: hair ? .85 : .72, side: hair ? THREE.DoubleSide : THREE.FrontSide, alphaTest: hair ? .25 : 0 });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `detailed-patient-${part.name}`;
      mesh.userData.patientPart = part.name;
      if (part.name === "skin") clearEyeOpenings(material);
      return mesh;
    });
  }, []);
  useEffect(() => () => meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); }), [meshes]);
  useFrame(({ clock }, delta) => {
    const now = clock.elapsedTime;
    const target = patientMouthTarget(now, voiceStatus === "speaking", reducedMotion.current);
    mouth.current += (target - mouth.current) * (1 - Math.exp(-Math.min(delta, .1) * 18));
    for (const mesh of meshes) {
      const part: unknown = mesh.userData.patientPart;
      if (part === "skin" && mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = mouth.current;
    }
  });
  return <group position={[0, 0, -.7]} userData={{ patientAppearance: "detailed" }}>
    {meshes.map(mesh => <primitive key={mesh.name} object={mesh} />)}
    <DetailedChair />
    {[-1, 1].map(side => <group key={side} position={[side * .197, .222, .485]}>
      <RoundedBox args={[.14, .035, .34]} radius={.015} position={[0, -.035, 0]}><meshStandardMaterial color="#202b2d" /></RoundedBox>
      <mesh scale={[.073, .068, .17]}><sphereGeometry args={[1, 32, 24]} /><meshStandardMaterial color="#334044" roughness={.85} /></mesh>
    </group>)}
  </group>;
}
function DetailedChair(){
  const cushion='#315c62', metal='#889b9b';
  const box=(key:string,p:[number,number,number],s:[number,number,number],color:string,r=.035)=><RoundedBox key={key} position={p} args={s} radius={r} smoothness={6} castShadow><meshStandardMaterial color={color} roughness={.65}/></RoundedBox>;
  return <group>
    <mesh position={[0,.055,.01]} receiveShadow><cylinderGeometry args={[.34,.39,.09,64]}/><meshStandardMaterial color={metal} metalness={.65} roughness={.3}/></mesh>
    <mesh position={[0,.28,.01]} castShadow><cylinderGeometry args={[.065,.09,.41,32]}/><meshStandardMaterial color={metal} metalness={.7} roughness={.24}/></mesh>
    {box('seat',[0,.58,.14],[.55,.14,.57],cushion,.065)}
    <group rotation={[-.08,0,0]}>{box('back',[0,1.01,-.17],[.49,.77,.13],cushion,.06)}</group>
    {box('head',[0,1.42,-.13],[.29,.20,.095],cushion,.045)}
    {[-1,1].map(s=><group key={s}>{box('support'+s,[s*.34,.70,.06],[.035,.28,.035],metal,.012)}{box('arm'+s,[s*.34,.86,.15],[.11,.065,.43],cushion,.03)}</group>)}
    {box('foot',[0,.16,.60],[.44,.045,.22],metal,.015)}
  </group>;
}
