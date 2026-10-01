import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { gazeForEye, type FixationTarget } from "../interaction/motility";
import { pupilRadiusTarget } from "../interaction/pupils";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  CatmullRomCurve3,
  Vector3,
  ShaderMaterial,
} from "three";

export type ExaminationMovement = MutableRefObject<{ x: number; y: number; used: boolean }>;

// One continuous, curved surface carries sclera, iris and pupil. No intersecting
// iris plane/sclera sphere: pupil dilation cannot expose white through the iris.
const vertexShader = `
varying vec2 eyeUV;
varying vec3 surfaceNormal;
void main(){eyeUV=uv;surfaceNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
`;
const fragmentShader = `
precision highp float;
varying vec2 eyeUV;
varying vec3 surfaceNormal;
uniform float pupilRadius;
uniform vec2 gaze;
uniform float illumination;
uniform float closure;
uniform float reflectionStrength;
uniform vec2 gazeAngle;
float noise(float n){return fract(sin(n)*43758.5453);}
void main(){
  vec2 p=(eyeUV-.5)*vec2(.30,.17);
  vec2 q=(p-gaze)/vec2(cos(gazeAngle.x),cos(gazeAngle.y));
  float r=length(q);float angle=atan(q.y,q.x);
  float opening=sin(eyeUV.x*3.14159265);
  float lidShade=pow(abs(eyeUV.y-.5)*2.,5.);
  vec3 sclera=mix(vec3(.83,.82,.77),vec3(.95,.95,.91),max(0.,1.-length(p/vec2(.18,.11))));
  float corner=pow(abs(eyeUV.x-.5)*2.,5.);
  sclera=mix(sclera,vec3(.66,.35,.33),corner*.4);
  // Sparse, quiet conjunctival vessel-like detail near the corners only.
  float vein=1.-smoothstep(.0,.00045,abs(p.y-.022*sin(p.x*76.)-.007*sin(p.x*192.)));
  float vein2=1.-smoothstep(.0,.0003,abs(p.y+.026*sin(p.x*58.+2.)+.011));
  sclera=mix(sclera,vec3(.63,.33,.32),max(vein,vein2)*corner*.26);
  float irisRadius=.050;
  float radial=clamp((r-pupilRadius)/(irisRadius-pupilRadius),0.,1.);
  float fibre=sin(angle*187.+sin(angle*39.)*3.+r*170.)*.5+.5;
  float fine=sin(angle*419.+r*350.)*.5+.5;
  float crypt=sin(angle*61.+radial*17.)*sin(angle*97.-radial*12.);
  vec3 iris=mix(vec3(.15,.105,.066),vec3(.42,.30,.14),fibre*.65+fine*.16);
  iris+=vec3(.055,.038,.012)*crypt;
  iris=mix(iris,vec3(.44,.27,.105),pow(1.-radial,3.)*.5);
  float collarette=exp(-pow((radial-.29-.025*sin(angle*29.))/.035,2.));
  iris*=1.-collarette*.23;
  iris*=1.-smoothstep(.044,.050,r)*.72;
  vec3 col=mix(sclera,iris,1.-smoothstep(.0495,.0505,r));
  col=mix(col,vec3(.009,.014,.015),1.-smoothstep(pupilRadius-.0006,pupilRadius+.0006,r));
  col*=1.-lidShade*.38;
  col*=.85+illumination*.15;
  // Small softbox reflections on the tear-film/cornea rather than opaque discs.
  float reflection=exp(-dot((q-vec2(-.015,.019))/vec2(.0035,.007),(q-vec2(-.015,.019))/vec2(.0035,.007)));
  float secondary=exp(-dot((q-vec2(.016,-.012))/vec2(.0018,.0028),(q-vec2(.016,-.012))/vec2(.0018,.0028)));
  col=mix(col,vec3(.97,.99,1.),(reflection*.82+secondary*.32)*reflectionStrength);
  float top = .067 * opening + gaze.y * .35;
  float bottom = -.053 * opening + gaze.y * .15;
  float lid = smoothstep(top - closure*.12 - .002, top - closure*.12 + .002, p.y);
  lid = max(lid, 1.-smoothstep(bottom-.002,bottom+.002,p.y));
  col=mix(col,vec3(.48,.32,.25),lid);
  gl_FragColor=vec4(col,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
function makeSurface() {
  const geometry = new BufferGeometry();
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const width = 64,
    height = 28;
  for (let row = 0; row <= height; row++)
    for (let column = 0; column <= width; column++) {
      const u = column / width,
        v = row / height,
        arc = Math.sin(u * Math.PI),
        y = (v - 0.5) * 2 * (v > 0.5 ? 0.067 : 0.053) * arc;
      positions.push((u - 0.5) * 0.3, y, 0.014 + 0.035 * arc * Math.sin(v * Math.PI));
      // UV y preserves circular iris proportions despite the almond boundary.
      uvs.push(u, 0.5 + y / 0.17);
    }
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const a = row * (width + 1) + col,
        b = a + width + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export function EyeSurface({
  x,
  pupils,
  motility,
  progress,
  movement,
  fixation,
  tracking = false,
  reducedMotion = false,
  pupilStimulus,
  ambientLevel,
  reflectionStrength = 1,
  gazeOffset,
}: {
  x: number;
  pupils: boolean;
  motility: boolean;
  progress: number;
  movement: ExaminationMovement;
  fixation?: MutableRefObject<FixationTarget>;
  tracking?: boolean;
  reducedMotion?: boolean;
  pupilStimulus?: MutableRefObject<number>;
  ambientLevel?: MutableRefObject<number>;
  reflectionStrength?: number;
  gazeOffset?: MutableRefObject<{ x: number; y: number }>;
}) {
  const geometry = useMemo(makeSurface, []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          pupilRadius: { value: 0.023 },
          gaze: { value: { x: 0, y: 0 } },
          illumination: { value: 0 },
          closure: { value: 0 },
          reflectionStrength: { value: reflectionStrength },
          gazeAngle: { value: { x: 0, y: 0 } },
        },
      }),
    [reflectionStrength],
  );
  const lids = useMemo(
    () =>
      [1, -1].map(
        (side) =>
          new CatmullRomCurve3(
            Array.from({ length: 49 }, (_, i) => {
              const u = i / 48;
              return new Vector3(
                (u - 0.5) * 0.3,
                Math.sin(u * Math.PI) * (side === 1 ? 0.067 : -0.053),
                0.015,
              );
            }),
          ),
      ),
    [],
  );
  const dilation = useRef(0.023);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  useFrame(({ clock }, dt) => {
    const lightX = movement.current.used
      ? movement.current.x * 0.38
      : Math.sin(progress * Math.PI * 3) * 0.25;
    const lit = Math.max(
      0,
      1 -
        Math.min(Math.abs(lightX - 0.2), Math.abs(lightX + 0.2)) * 6 -
        Math.abs(movement.current.y) * 0.35,
    );
    const stimulus = pupilStimulus ? pupilStimulus.current : lit;
    const target = pupils
      ? pupilRadiusTarget(ambientLevel?.current ?? 0.5, stimulus)
      : 0.023;
    dilation.current += (target - dilation.current) * (1 - Math.exp(-dt * 9));
    material.uniforms.pupilRadius.value = dilation.current;
    material.uniforms.illumination.value = pupils ? stimulus : 0.5;
    const gaze = material.uniforms.gaze.value;
    if (fixation) {
      const angles = tracking ? gazeForEye(fixation.current, x < 0 ? -0.032 : 0.032) : { yaw: 0, pitch: 0 };
      const blend = 1 - Math.exp(-Math.min(dt, 0.1) * 12);
      const angle = material.uniforms.gazeAngle.value;
      angle.x += (angles.yaw - angle.x) * blend;
      angle.y += (angles.pitch - angle.y) * blend;
      gaze.x = Math.sin(angle.x) * 0.095;
      gaze.y = Math.sin(angle.y) * 0.07;
      const cycle = clock.elapsedTime % 4.7;
      material.uniforms.closure.value = reducedMotion ? 0 : Math.max(0, 1 - Math.abs(cycle - 4.4) / 0.095);
      return;
    }
    gaze.x = (motility
      ? movement.current.used
        ? movement.current.x * 0.025
        : Math.sin(progress * Math.PI * 4) * 0.024
      : 0) + (gazeOffset?.current.x ?? 0);
    gaze.y = (motility && movement.current.used ? movement.current.y * 0.017 : 0) + (gazeOffset?.current.y ?? 0);
  });
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geometry} material={material} />
      {lids.map((curve, i) => (
        <mesh key={i}>
          <tubeGeometry args={[curve, 72, i === 0 ? 0.0038 : 0.0028, 10, false]} />
          <meshStandardMaterial color={i === 0 ? "#795749" : "#ba8f81"} roughness={0.46} />
        </mesh>
      ))}
      <mesh position={[x < 0 ? 0.145 : -0.145, -0.001, 0.016]} scale={[0.007, 0.004, 0.003]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshPhysicalMaterial color="#ba7c77" roughness={0.32} clearcoat={0.5} />
      </mesh>
    </group>
  );
}
