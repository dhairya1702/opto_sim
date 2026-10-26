import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace, Vector3, Quaternion, type Mesh } from "three";
import { perfCount } from "../perf/perfFlag";
import { CLINIC_EYE_WHITE_RADII, CLINIC_IRIS_RADIUS, CLINIC_PUPIL_RADIUS } from "../interaction/clinicPatient";
import { INSTRUMENT_KIT, INSTRUMENT_KIT_ROTATION_Y } from "../interaction/clinicLayout";
import { PATIENT_BLINK_DURATION_SECONDS, patientBlinkClosure, patientBlinkDelay, patientMouthTarget } from "../interaction/patientAnimation";
import { useVoiceStatus } from "../voice/VoiceStatusContext";
import { RetinoscopeModel } from "./RetinoscopeModel";
import { ExamPaddleModel, MotilityTargetModel, NearCardModel, OphthalmoscopeModel, PenlightModel, TrialFrameModel } from "./ExamInstrumentModels";
type V = [number, number, number];
export function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  c = "#eef0ed",
  r = [0, 0, 0],
  radius = 0,
  castShadow = false,
  receiveShadow = false,
}: {
  p?: V;
  s?: V;
  c?: string;
  r?: V;
  radius?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const material = <meshStandardMaterial color={c} roughness={0.72} />;
  if (radius > 0) {
    return <RoundedBox position={p} rotation={r} args={s} radius={Math.min(radius, Math.min(...s) * .45)} smoothness={4} castShadow={castShadow} receiveShadow={receiveShadow}>
      {material}
    </RoundedBox>;
  }
  return (
    <mesh position={p} rotation={r} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={s} />
      {material}
    </mesh>
  );
}
export function Cylinder({
  p = [0, 0, 0],
  radius = 0.03,
  h = 0.3,
  c = "#7f8d8c",
  r = [0, 0, 0],
  castShadow = false,
  receiveShadow = false,
}: {
  p?: V;
  radius?: number;
  h?: number;
  c?: string;
  r?: V;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh position={p} rotation={r} castShadow={castShadow} receiveShadow={receiveShadow}>
      <cylinderGeometry args={[radius, radius, h, 20]} />
      <meshStandardMaterial color={c} metalness={0.3} roughness={0.4} />
    </mesh>
  );
}
function Orb({ p, s, c }: { p: V; s: V; c: string }) {
  return (
    <mesh position={p} scale={s} castShadow>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial color={c} roughness={0.82} />
    </mesh>
  );
}
function Limb({ a, b, r, c }: { a: V; b: V; r: number; c: string }) {
  const v = new Vector3(...b).sub(new Vector3(...a));
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), v.clone().normalize());
  return (
    <mesh
      position={new Vector3(...a).add(new Vector3(...b)).multiplyScalar(0.5)}
      quaternion={q}
      castShadow
    >
      <cylinderGeometry args={[r * 0.83, r, v.length(), 16]} />
      <meshStandardMaterial color={c} roughness={0.85} />
    </mesh>
  );
}
export function Ring({
  p,
  radius = 0.065,
  c = "#374a50",
  rotation = [0, 0, 0],
}: {
  p: V;
  radius?: number;
  c?: string;
  rotation?: V;
}) {
  return (
    <mesh position={p} rotation={rotation} castShadow>
      <torusGeometry args={[radius, 0.012, 8, 32]} />
      <meshStandardMaterial color={c} metalness={0.4} roughness={0.35} />
    </mesh>
  );
}
export type SignResolutionTier = "compact" | "panel" | "detail";
const signTextureCache = new Map<string, { texture: CanvasTexture; references: number }>();

export function signTextureDimensions(size: [number, number], tier: SignResolutionTier, fitted: boolean) {
  if (!fitted) return { width: 1024, height: 640 };
  const width = tier === "detail" ? 1536 : tier === "panel" ? 1024 : 512;
  return { width, height: Math.max(64, Math.round(width * size[1] / Math.max(.001, size[0]))) };
}

export function Sign({
  text,
  p,
  size = [0.7, 0.23],
  bg = "#edf2ed",
  fg = "#264e50",
  rotation = [0, 0, 0],
  fit = false,
  transparentBackground = false,
  resolutionTier = "panel",
}: {
  text: string[];
  p: V;
  size?: [number, number];
  bg?: string;
  fg?: string;
  rotation?: V;
  /** Match the texture aspect to the physical label for readable compact XR controls. */
  fit?: boolean;
  /** Draw only glyphs so a shaped panel behind the texture defines the silhouette. */
  transparentBackground?: boolean;
  /** Pixel budget for fitted text. Reserve detail for labels that truly need it. */
  resolutionTier?: SignResolutionTier;
}) {
  const key = JSON.stringify([text, bg, fg, fit, transparentBackground, fit ? size : null, resolutionTier]);
  const texture = useMemo(() => {
    const cached = signTextureCache.get(key);
    if (cached) return cached.texture;
    const canvas = document.createElement("canvas");
    const dimensions = signTextureDimensions(size, resolutionTier, fit);
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext("2d")!;
    if (!transparentBackground) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    if (fit) ctx.textBaseline = "middle";
    text.forEach((t, i) => {
      let fontSize = fit ? canvas.height / (text.length + 1) * .85 : text.length > 4 ? Math.max(24, 100 - i * 12) : 44;
      ctx.font = `${fit ? 800 : 600} ${fontSize}px system-ui, sans-serif`;
      if (fit) {
        fontSize *= Math.min(1, canvas.width * .92 / Math.max(1, ctx.measureText(t).width));
        ctx.font = `800 ${fontSize}px system-ui, sans-serif`;
      }
      ctx.fillText(t, canvas.width / 2, (canvas.height * (i + 1)) / (text.length + 1));
    });
    perfCount("sign texture");
    perfCount("sign texels", canvas.width * canvas.height);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    if (fit) {
      // Thin XR labels otherwise fall into tiny mip levels at normal room
      // distance, turning letter strokes into an unreadable blur in-headset.
      tex.generateMipmaps = false;
      tex.minFilter = LinearFilter;
      tex.magFilter = LinearFilter;
      tex.anisotropy = 16;
    } else {
      tex.anisotropy = 8;
    }
    signTextureCache.set(key, { texture: tex, references: 0 });
    return tex;
  }, [key]);
  useEffect(() => {
    const cached = signTextureCache.get(key);
    if (!cached || cached.texture !== texture) signTextureCache.set(key, { texture, references: 1 });
    else cached.references += 1;
    return () => {
      const current = signTextureCache.get(key);
      if (!current || current.texture !== texture) return;
      current.references -= 1;
      if (current.references > 0) return;
      // StrictMode immediately replays effects. Defer disposal by one microtask
      // so the replay can reacquire the same GPU texture before it is destroyed.
      queueMicrotask(() => {
        const latest = signTextureCache.get(key);
        if (latest === current && latest.references <= 0) { latest.texture.dispose(); signTextureCache.delete(key); }
      });
    };
  }, [key, texture]);
  return (
    <mesh position={p} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent={transparentBackground} depthWrite={!transparentBackground} />
    </mesh>
  );
}

function ClinicFloor() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    let seed = 7;
    const random = () => {
      seed = Math.imul(seed ^ (seed >>> 15), seed | 1);
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61);
      return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296;
    };
    const rows = 8;
    const rowHeight = canvas.height / rows;
    for (let row = 0; row < rows; row += 1) {
      let x = -random() * 500;
      while (x < canvas.width) {
        const length = 360 + random() * 420;
        ctx.fillStyle = `hsl(${30 + random() * 6}, ${30 + random() * 10}%, ${60 + random() * 9}%)`;
        ctx.fillRect(x, row * rowHeight, length, rowHeight);
        for (let grain = 0; grain < 30; grain += 1) {
          const y = row * rowHeight + random() * rowHeight;
          const amplitude = 1 + random() * 3;
          const frequency = 0.003 + random() * 0.01;
          ctx.fillStyle = `rgba(95, 60, 30, ${0.04 + random() * 0.09})`;
          for (let offset = 0; offset <= length; offset += 14) {
            ctx.fillRect(x + offset, y + Math.sin(offset * frequency + grain) * amplitude, 15, 1);
          }
        }
        ctx.fillStyle = "rgba(45, 30, 18, 0.45)";
        ctx.fillRect(x, row * rowHeight, 2, rowHeight);
        x += length;
      }
      ctx.fillStyle = "rgba(45, 30, 18, 0.4)";
      ctx.fillRect(0, row * rowHeight, canvas.width, 2);
    }

    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.wrapS = RepeatWrapping;
    result.wrapT = RepeatWrapping;
    result.repeat.set(2.4, 3);
    result.anisotropy = 4;
    return result;
  }, []);

  useEffect(() => () => texture?.dispose(), [texture]);

  return <>
    <Box p={[0, -0.052, 0]} s={[4.15, 0.1, 5.15]} c="#8d7259" />
    <mesh position={[0, .002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[4.15, 5.15]} />
      <meshStandardMaterial color="#ffffff" map={texture} roughness={.48} />
    </mesh>
  </>;
}

export function ConsultingRoomShell({ xr = false }: { xr?: boolean }) {
  return <>
    <color attach="background" args={["#cfd8d4"]} />
    <ambientLight color="#fff8ed" intensity={0.38} />
    <hemisphereLight args={["#fffaf2", "#776a5c", .82]} />
    <directionalLight
      position={[-2, 4, 2]}
      color="#fff4e6"
      intensity={1.45}
      castShadow
      shadow-mapSize={[xr ? 512 : 1024, xr ? 512 : 1024]}
      shadow-camera-left={-4}
      shadow-camera-right={4}
      shadow-camera-top={4}
      shadow-camera-bottom={-4}
      shadow-bias={-0.001}
    />
    <ClinicFloor />
    <Box p={[0, 1.5, -2.55]} s={[4.2, 3, 0.1]} c="#2f4448" />
    <Box p={[-2.05, 1.5, 0]} s={[0.1, 3, 5.1]} c="#edf0e9" />
    <Box p={[2.05, 1.5, 0]} s={[0.1, 3, 5.1]} c="#d4dfdb" />
    <Box p={[0, 1.5, 2.55]} s={[4.2, 3, 0.1]} c="#e8ebe5" />
    <Box p={[0, 3.04, 0]} s={[4.2, 0.08, 5.2]} c="#f1f2eb" />
    <Box p={[0, 0.07, -2.48]} s={[4, 0.14, 0.04]} c="#b0c0bc" />
    <Box p={[-1.98, 0.07, 0]} s={[0.04, 0.14, 5]} c="#b0c0bc" />
    <Box p={[1.98, 0.07, 0]} s={[0.04, 0.14, 5]} c="#b0c0bc" />
    {[-.6, 1].map(z => <group key={z}>
      <Box p={[0, 2.96, z]} s={[.66, .04, .66]} c="#fffaf0" />
      <pointLight position={[0, 2.72, z]} color="#fff1dc" intensity={2.8} distance={5} decay={2} />
    </group>)}
    <Box p={[-1.985, 1.92, -0.25]} s={[0.035, 1.25, 1.55]} c="#9bbab8" />
    {Array.from({ length: 12 }, (_, i) => <Box key={i} p={[-1.96, 1.36 + i * 0.1, -0.25]} s={[0.025, 0.065, 1.52]} c="#edf0e5" r={[0, 0, 0.07]} />)}
    <Box p={[1.42, 1.1, 2.48]} s={[0.85, 2.2, 0.04]} c="#b4c3bc" />
    <Cylinder p={[1.12, 1.02, 2.42]} h={0.16} radius={0.014} c="#788c8a" r={[0, 0, Math.PI / 2]} />
  </>;
}

function usePatientReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  return reducedMotion;
}

function PatientFaceAnimation({ skin }: { skin: string }) {
  const voiceStatus = useVoiceStatus();
  const reducedMotion = usePatientReducedMotion();
  const eyelids = useRef<Array<Mesh | null>>([]);
  const mouthInterior = useRef<Mesh | null>(null);
  const lowerLip = useRef<Mesh | null>(null);
  const nextBlinkAt = useRef<number | null>(null);
  const blinkStartedAt = useRef<number | null>(null);
  const mouthOpen = useRef(0);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;
    if (nextBlinkAt.current === null) nextBlinkAt.current = elapsed + patientBlinkDelay(Math.random());
    if (blinkStartedAt.current === null && elapsed >= nextBlinkAt.current) blinkStartedAt.current = elapsed;

    let closure = 0;
    if (blinkStartedAt.current !== null) {
      const blinkElapsed = elapsed - blinkStartedAt.current;
      closure = patientBlinkClosure(blinkElapsed);
      if (blinkElapsed >= PATIENT_BLINK_DURATION_SECONDS) {
        blinkStartedAt.current = null;
        nextBlinkAt.current = elapsed + patientBlinkDelay(Math.random());
      }
    }
    eyelids.current.forEach(lid => {
      if (!lid) return;
      lid.visible = closure > 0.015;
      lid.scale.y = Math.max(0.0001, 0.014 * closure);
    });

    const target = patientMouthTarget(elapsed, voiceStatus === "speaking", reducedMotion);
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * (target > mouthOpen.current ? 18 : 13));
    mouthOpen.current += (target - mouthOpen.current) * blend;
    const opening = mouthOpen.current;
    if (mouthInterior.current) {
      mouthInterior.current.visible = opening > 0.025;
      mouthInterior.current.scale.y = Math.max(0.0001, 0.0105 * opening);
    }
    if (lowerLip.current) lowerLip.current.position.y = 1.39 - 0.012 * opening;
  });

  return <>
    {[-1, 1].map((side, index) => (
      <mesh
        key={side}
        ref={node => { eyelids.current[index] = node; }}
        position={[side * 0.048, 1.5, 0.135]}
        scale={[0.03, 0.0001, 0.006]}
        visible={false}
        raycast={() => null}
        userData={{ patientFaceAnimation: "blink" }}
      >
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color={skin} roughness={0.82} />
      </mesh>
    ))}
    <mesh ref={mouthInterior} position={[0, 1.393, 0.124]} scale={[0.027, 0.0001, 0.006]}
      visible={false} raycast={() => null} userData={{ patientFaceAnimation: "mouth" }}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshStandardMaterial color="#35201f" roughness={0.9} />
    </mesh>
    <mesh position={[0, 1.397, 0.128]} scale={[0.032, 0.0045, 0.007]} raycast={() => null}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshStandardMaterial color="#684638" roughness={0.86} />
    </mesh>
    <mesh ref={lowerLip} position={[0, 1.39, 0.128]} scale={[0.031, 0.0045, 0.007]} raycast={() => null}>
      <sphereGeometry args={[1, 24, 12]} />
      <meshStandardMaterial color="#684638" roughness={0.86} />
    </mesh>
  </>;
}

export function Patient({ xr = false }: { xr?: boolean }) {
  const skin = "#a97453",
    shirt = "#70899b",
    jeans = "#293d51";
  return (
    <group position={[0, 0, -0.7]}>
      <Cylinder p={[0, 0.13, 0]} radius={0.39} h={0.11} c="#b8c3c3" />
      <Cylinder p={[0, 0.34, 0]} radius={0.1} h={0.37} />
      <Box p={[0, 0.55, 0]} s={[0.62, 0.15, 0.58]} c="#234b51" radius={.035} />
      <Box p={[0, 0.98, -0.27]} s={[0.62, 0.87, 0.13]} c="#234b51" r={[-0.09, 0, 0]} radius={.035} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Cylinder p={[side * 0.36, 0.65, 0.03]} radius={0.024} h={0.34} />
          <Box p={[side * 0.36, 0.83, 0.04]} s={[0.12, 0.07, 0.52]} c="#234b51" />
        </group>
      ))}
      <Orb p={[0, 0.98, -0.04]} s={[0.245, 0.33, 0.16]} c={shirt} />
      <Cylinder p={[0, 1.3, -0.015]} radius={0.065} h={0.13} c={skin} />
      <Orb p={[0, 1.48, 0]} s={[0.13, 0.18, 0.13]} c={skin} />
      <Orb p={[0, 1.57, -0.03]} s={[0.139, 0.11, 0.126]} c="#272627" />
      <Orb p={[0, 1.46, 0.128]} s={[0.024, 0.04, 0.03]} c={skin} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Orb p={[side * 0.13, 1.48, 0]} s={[0.024, 0.04, 0.025]} c={skin} />
          <Orb p={[side * 0.048, 1.5, 0.115]} s={CLINIC_EYE_WHITE_RADII} c="#e6d7c5" />
          {xr ? <group position={[side * .048, 1.5, .129]}>
            <group userData={{ consultationGaze: side < 0 ? "OD" : "OS" }}>
              <mesh><circleGeometry args={[CLINIC_IRIS_RADIUS, 24]} /><meshStandardMaterial color="#695342" /></mesh>
              <mesh position={[0, 0, .001]} userData={{ consultationPupil: side < 0 ? "OD" : "OS" }}>
                <circleGeometry args={[CLINIC_PUPIL_RADIUS, 24]} /><meshBasicMaterial color="#17191a" />
              </mesh>
            </group>
          </group> : <Orb p={[side * 0.048, 1.5, 0.127]} s={[0.008, 0.009, 0.004]} c="#292626" />}
          <Limb a={[side * 0.2, 1.18, -0.04]} b={[side * 0.3, 0.89, 0.03]} r={0.078} c={shirt} />
          <Limb a={[side * 0.3, 0.89, 0.03]} b={[side * 0.23, 0.78, 0.28]} r={0.05} c={skin} />
          <Orb p={[side * 0.23, 0.775, 0.29]} s={[0.055, 0.034, 0.08]} c={skin} />
          <Limb a={[side * 0.14, 0.64, -0.02]} b={[side * 0.17, 0.58, 0.42]} r={0.1} c={jeans} />
          <Limb a={[side * 0.17, 0.58, 0.42]} b={[side * 0.17, 0.14, 0.48]} r={0.075} c={jeans} />
          <Orb p={[side * 0.17, 0.085, 0.55]} s={[0.09, 0.06, 0.16]} c="#303334" />
        </group>
      ))}
      <PatientFaceAnimation skin={skin} />
      <Box p={[0, 0.28, 0.49]} s={[0.55, 0.035, 0.23]} c="#aeb9b9" radius={.015} />
    </group>
  );
}
export function Retinoscope({ p = [0, 0, 0], ophthalmo = false, r = [0, 0, -.12], showApertureSelector = true }: { p?: V; ophthalmo?: boolean; r?: V; showApertureSelector?: boolean }) {
  if (!ophthalmo) return <RetinoscopeModel p={p} r={r} />;
  return <OphthalmoscopeModel p={p} r={r} showApertureSelector={showApertureSelector} />;
}
export function Paddle({ p, pinhole = false, cover = false }: { p: V; pinhole?: boolean; cover?: boolean }) {
  return (
    <group position={p} rotation={[-Math.PI / 2, 0, 0]}>
      <ExamPaddleModel pinhole={pinhole} cover={cover} />
    </group>
  );
}

export function NearVisionCard({ p = [0, 0, 0], r = [0, 0, 0], isolated = false }: { p?: V; r?: V; isolated?: boolean }) {
  return (
    <group position={p} rotation={r}>
      <NearCardModel isolated={isolated} />
    </group>
  );
}

type TrolleyKit = Pick<typeof INSTRUMENT_KIT, "x" | "z" | "width" | "depth" | "surfaceY" | "lowerShelfY">;
export function Trolley({ held, portable = true, kit = INSTRUMENT_KIT, rotationY = INSTRUMENT_KIT_ROTATION_Y }: {
  held?: string;
  portable?: boolean;
  kit?: TrolleyKit;
  rotationY?: number;
}) {
  return (
    <group position={[kit.x, 0, kit.z]} rotation={[0, rotationY, 0]}>
      <Box p={[0, kit.surfaceY - .0175, 0]} s={[kit.width, .035, kit.depth]} c="#d9e1de" radius={.015} />
      <Box p={[0, kit.lowerShelfY - .0175, 0]} s={[kit.width, .035, kit.depth]} c="#b9c9c6" radius={.015} />
      {[-kit.width / 2 + .05, kit.width / 2 - .05].flatMap((x) =>
        [-kit.depth / 2 + .05, kit.depth / 2 - .05].map((z) => (
          <group key={`${x}${z}`}>
            <Cylinder p={[x, .47, z]} h={.82} radius={0.018} />
            <Cylinder
              p={[x, 0.06, z]}
              h={0.025}
              radius={0.046}
              c="#35464a"
              r={[0, 0, Math.PI / 2]}
            />
          </group>
        )),
      )}
      {portable && held !== "distance" && (
        <group userData={{ examId: "distance", xrGrabbable: true }}>
          <Paddle p={[-.78, .895, .08]} />
        </group>
      )}
      {portable && held !== "pinhole" && (
        <group userData={{ examId: "pinhole", xrGrabbable: true }}>
          <Paddle p={[-.61, .895, .08]} pinhole />
        </group>
      )}
      {portable && held !== "cover" && (
        <group userData={{ examId: "cover", xrGrabbable: true }}>
          <Paddle p={[-.44, .895, .08]} cover />
        </group>
      )}
      {portable && held !== "pupils" && (
        <group userData={{ examId: "pupils", xrGrabbable: true }}>
          <PenlightModel p={[-.29, .9, .08]} r={[Math.PI / 2, 0, 0]} />
        </group>
      )}
      {portable && held !== "motility" && (
        <group userData={{ examId: "motility", xrGrabbable: true }}>
          <MotilityTargetModel p={[-.17, .9, .08]} r={[Math.PI / 2, 0, 0]} />
        </group>
      )}
      {portable && held !== "objective" && (
        <group userData={{ examId: "objective", xrGrabbable: true }}>
          <Retinoscope p={[.10, .88, .08]} />
        </group>
      )}
      {portable && held !== "near" && (
        <group userData={{ examId: "near", xrGrabbable: true }}>
          <NearVisionCard p={[.33, .899, .08]} />
        </group>
      )}
    </group>
  );
}
export function Refraction({ portable = true }: { portable?: boolean }) {
  return (
    <group position={[-1.45, 0, -1.4]}>
      <Box p={[0, 0.85, 0]} s={[0.85, 0.06, 1.2]} c="#deddd4" radius={.025} />
      <Box p={[0, 0.4, -0.2]} s={[0.75, 0.8, 0.65]} c="#e9eeea" radius={.035} />
      {[0.24, 0.48, 0.7].map((y) => (
        <group key={y}>
          <Box p={[0, y, 0.129]} s={[0.72, 0.01, 0.005]} c="#b9c4be" />
          <Box p={[0, y - 0.08, 0.145]} s={[0.22, 0.015, 0.024]} c="#7c9392" />
        </group>
      ))}
      <Box p={[0, 0.914, -0.16]} s={[0.68, 0.07, 0.51]} c="#434f54" radius={.02} />
      {Array.from({ length: 18 }, (_, i) => (
        <Ring
          key={i}
          p={[-0.26 + (i % 6) * 0.104, 0.96, -0.32 + Math.floor(i / 6) * 0.15]}
          radius={0.038}
          c={i < 9 ? "#a9bebc" : "#779098"}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
      {portable && <group
        position={[0, 0.97, 0.32]}
        rotation={[-0.7, 0, 0]}
        userData={{ examId: "subjective", xrGrabbable: true }}
      >
        <TrialFrameModel />
      </group>}
    </group>
  );
}
