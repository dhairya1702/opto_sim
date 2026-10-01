import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace, Vector3, Quaternion } from "three";
type V = [number, number, number];
export function Box({
  p = [0, 0, 0],
  s = [1, 1, 1],
  c = "#eef0ed",
  r = [0, 0, 0],
}: {
  p?: V;
  s?: V;
  c?: string;
  r?: V;
}) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} roughness={0.72} />
    </mesh>
  );
}
export function Cylinder({
  p = [0, 0, 0],
  radius = 0.03,
  h = 0.3,
  c = "#7f8d8c",
  r = [0, 0, 0],
}: {
  p?: V;
  radius?: number;
  h?: number;
  c?: string;
  r?: V;
}) {
  return (
    <mesh position={p} rotation={r} castShadow receiveShadow>
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
export function Sign({
  text,
  p,
  size = [0.7, 0.23],
  bg = "#edf2ed",
  fg = "#264e50",
  rotation = [0, 0, 0],
}: {
  text: string[];
  p: V;
  size?: [number, number];
  bg?: string;
  fg?: string;
  rotation?: V;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 512);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    text.forEach((t, i) => {
      ctx.font = `${text.length > 4 ? Math.max(24, 100 - i * 12) : 44}px sans-serif`;
      ctx.fillText(t, 384, (512 * (i + 1)) / (text.length + 1));
    });
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, [text.join("|"), bg, fg]);
  return (
    <mesh position={p} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}
export function Patient() {
  const skin = "#a97453",
    shirt = "#70899b",
    jeans = "#293d51";
  return (
    <group position={[0, 0, -0.7]}>
      <Cylinder p={[0, 0.13, 0]} radius={0.39} h={0.11} c="#b8c3c3" />
      <Cylinder p={[0, 0.34, 0]} radius={0.1} h={0.37} />
      <Box p={[0, 0.55, 0]} s={[0.62, 0.15, 0.58]} c="#234b51" />
      <Box p={[0, 0.98, -0.27]} s={[0.62, 0.87, 0.13]} c="#234b51" r={[-0.09, 0, 0]} />
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
      <Orb p={[0, 1.393, 0.111]} s={[0.032, 0.007, 0.012]} c="#684638" />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Orb p={[side * 0.13, 1.48, 0]} s={[0.024, 0.04, 0.025]} c={skin} />
          <Orb p={[side * 0.048, 1.5, 0.115]} s={[0.025, 0.011, 0.013]} c="#e6d7c5" />
          <Orb p={[side * 0.048, 1.5, 0.127]} s={[0.008, 0.009, 0.004]} c="#292626" />
          <Limb a={[side * 0.2, 1.18, -0.04]} b={[side * 0.3, 0.89, 0.03]} r={0.078} c={shirt} />
          <Limb a={[side * 0.3, 0.89, 0.03]} b={[side * 0.23, 0.78, 0.28]} r={0.05} c={skin} />
          <Orb p={[side * 0.23, 0.775, 0.29]} s={[0.055, 0.034, 0.08]} c={skin} />
          <Limb a={[side * 0.14, 0.64, -0.02]} b={[side * 0.17, 0.58, 0.42]} r={0.1} c={jeans} />
          <Limb a={[side * 0.17, 0.58, 0.42]} b={[side * 0.17, 0.14, 0.48]} r={0.075} c={jeans} />
          <Orb p={[side * 0.17, 0.085, 0.55]} s={[0.09, 0.06, 0.16]} c="#303334" />
        </group>
      ))}
      <Box p={[0, 0.28, 0.49]} s={[0.55, 0.035, 0.23]} c="#aeb9b9" />
    </group>
  );
}
export function Retinoscope({ p = [0, 0, 0], ophthalmo = false }: { p?: V; ophthalmo?: boolean }) {
  return (
    <group position={p} rotation={[0, 0, -0.12]}>
      <Cylinder p={[0, 0.1, 0]} h={0.21} radius={0.027} c="#303b41" />
      <Cylinder p={[0, 0.215, 0]} h={0.025} radius={0.032} c="#a6b8b7" />
      <Box p={[0, 0.265, 0]} s={[ophthalmo ? 0.09 : 0.065, 0.09, 0.044]} c="#26333a" />
      <Cylinder p={[0, 0.27, 0.026]} h={0.012} radius={0.018} c="#8ab2b4" r={[Math.PI / 2, 0, 0]} />
      <Cylinder
        p={[0.037, 0.248, 0]}
        h={0.012}
        radius={0.025}
        c="#697879"
        r={[0, 0, Math.PI / 2]}
      />
    </group>
  );
}
export function Paddle({ p, pinhole = false }: { p: V; pinhole?: boolean }) {
  return (
    <group position={p} rotation={[-Math.PI / 2, 0, 0]}>
      <Box p={[0, -0.06, 0]} s={[0.022, 0.19, 0.012]} c="#28363b" />
      <Orb p={[0, 0.061, 0]} s={[0.058, 0.074, 0.012]} c="#28363b" />
      {pinhole && <Orb p={[0, 0.061, 0.012]} s={[0.009, 0.009, 0.002]} c="#c3d7d5" />}
    </group>
  );
}

export function NearVisionCard({ p = [0, 0, 0], r = [0, 0, 0] }: { p?: V; r?: V }) {
  return (
    <group position={p} rotation={r}>
      <Box s={[0.24, 0.008, 0.16]} c="#fcfdf7" />
      <Sign
        text={["NEAR VISION", "N6  N8  N10", "Reading sample", "40 cm"]}
        p={[0, 0.005, 0]}
        size={[0.22, 0.14]}
        rotation={[-Math.PI / 2, 0, 0]}
        bg="#fffef7"
        fg="#1f3538"
      />
      <Box p={[0, -0.006, 0.071]} s={[0.24, 0.018, 0.018]} c="#3e7774" />
    </group>
  );
}

export function Trolley({ held }: { held?: string }) {
  return (
    <group position={[-1.37, 0, 0.75]}>
      <Box p={[0, 0.86, 0]} s={[0.84, 0.035, 0.55]} c="#d9e1de" />
      <Box p={[0, 0.4, 0]} s={[0.84, 0.035, 0.55]} c="#c1cecd" />
      {[-0.37, 0.37].flatMap((x) =>
        [-0.22, 0.22].map((z) => (
          <group key={`${x}${z}`}>
            <Cylinder p={[x, 0.47, z]} h={0.82} radius={0.018} />
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
      <Box p={[-0.17, 0.5, 0]} s={[0.36, 0.17, 0.33]} c="#e9ebe7" />
      {held !== "distance" && (
        <group userData={{ examId: "distance" }}>
          <Paddle p={[-0.25, 0.895, -0.05]} />
        </group>
      )}
      {held !== "pinhole" && (
        <group userData={{ examId: "pinhole" }}>
          <Paddle p={[-0.08, 0.895, -0.05]} pinhole />
        </group>
      )}
      {held !== "pupils" && (
        <group userData={{ examId: "pupils" }}>
          <Cylinder
            p={[0.08, 0.9, 0.07]}
            h={0.22}
            radius={0.018}
            c="#b6bfc0"
            r={[Math.PI / 2, 0, 0]}
          />
        </group>
      )}
      {held !== "motility" && (
        <group userData={{ examId: "motility" }}>
          <Cylinder
            p={[0.19, 0.9, 0.06]}
            h={0.23}
            radius={0.009}
            c="#667b8b"
            r={[Math.PI / 2, 0, 0]}
          />
        </group>
      )}
      {held !== "objective" && (
        <group userData={{ examId: "objective" }}>
          <Retinoscope p={[0.28, 0.88, -0.13]} />
        </group>
      )}
      {held !== "near" && (
        <group userData={{ examId: "near" }}>
          <NearVisionCard p={[-0.2, 0.899, 0.17]} />
        </group>
      )}
      <Sign text={["EXAMINATION KIT"]} p={[0, 0.77, 0.279]} size={[0.48, 0.07]} />
    </group>
  );
}
export function Refraction() {
  return (
    <group position={[-1.45, 0, -1.4]}>
      <Box p={[0, 0.85, 0]} s={[0.85, 0.06, 1.2]} c="#deddd4" />
      <Box p={[0, 0.4, -0.2]} s={[0.75, 0.8, 0.65]} c="#e9eeea" />
      {[0.24, 0.48, 0.7].map((y) => (
        <group key={y}>
          <Box p={[0, y, 0.129]} s={[0.72, 0.01, 0.005]} c="#b9c4be" />
          <Box p={[0, y - 0.08, 0.145]} s={[0.22, 0.015, 0.024]} c="#7c9392" />
        </group>
      ))}
      <Box p={[0, 0.914, -0.16]} s={[0.68, 0.07, 0.51]} c="#434f54" />
      {Array.from({ length: 18 }, (_, i) => (
        <Ring
          key={i}
          p={[-0.26 + (i % 6) * 0.104, 0.96, -0.32 + Math.floor(i / 6) * 0.15]}
          radius={0.038}
          c={i < 9 ? "#a9bebc" : "#779098"}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      ))}
      <group position={[0, 0.97, 0.32]} rotation={[-0.7, 0, 0]}>
        <Ring p={[-0.078, 0, 0]} c="#922e2e" />
        <Ring p={[0.078, 0, 0]} c="#283948" />
        <Box p={[0, 0.017, 0]} s={[0.035, 0.012, 0.02]} c="#b2bab9" />
        <Cylinder p={[-0.148, 0, -0.08]} h={0.16} radius={0.006} r={[Math.PI / 2, 0, 0]} />
        <Cylinder p={[0.148, 0, -0.08]} h={0.16} radius={0.006} r={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
}
export function SlitLamp() {
  return (
    <group position={[1.35, 0, -0.95]}>
      <Box p={[0, 0.84, 0]} s={[1.0, 0.065, 0.7]} c="#dfe5e2" />
      <Cylinder p={[0, 0.4, 0]} h={0.8} radius={0.065} />
      <Box p={[0, 0.05, 0]} s={[0.7, 0.05, 0.48]} c="#9baaaa" />
      <Box p={[0, 0.91, 0.03]} s={[0.5, 0.07, 0.32]} c="#d7dfda" />
      <Cylinder p={[-0.08, 1.1, 0.08]} h={0.34} radius={0.035} c="#e5e6da" />
      <Box p={[-0.08, 1.29, 0.08]} s={[0.26, 0.12, 0.22]} c="#e4e8df" />
      {[-0.15, -0.02].map((x) => (
        <group key={x}>
          <Cylinder
            p={[x, 1.33, 0.22]}
            h={0.19}
            radius={0.035}
            c="#303c40"
            r={[Math.PI / 2 - 0.25, 0, 0]}
          />
          <Cylinder
            p={[x, 1.35, 0.32]}
            h={0.035}
            radius={0.042}
            c="#18282d"
            r={[Math.PI / 2 - 0.25, 0, 0]}
          />
        </group>
      ))}
      <Cylinder p={[0.19, 1.23, -0.07]} h={0.53} radius={0.036} c="#303b3e" />
      <Box p={[0.19, 1.5, -0.07]} s={[0.09, 0.12, 0.1]} c="#dfdfd1" />
      {[-0.28, 0.28].map((x) => (
        <Cylinder key={x} p={[x, 1.23, -0.25]} h={0.68} radius={0.015} c="#a8b8b7" />
      ))}
      <Box p={[0, 1.53, -0.25]} s={[0.58, 0.035, 0.065]} c="#dfe5df" />
      <Box p={[0, 1.12, -0.25]} s={[0.25, 0.035, 0.11]} c="#6e9594" />
      <Cylinder p={[-0.28, 1.01, 0.15]} h={0.18} radius={0.018} c="#293d42" />
      <Orb p={[-0.28, 1.11, 0.15]} s={[0.034, 0.035, 0.034]} c="#293d42" />
      <Stool p={[0.05, 0, -0.7]} />
      <Stool p={[0, 0, 0.9]} />
    </group>
  );
}
function Stool({ p }: { p: V }) {
  return (
    <group position={p}>
      <Cylinder p={[0, 0.51, 0]} h={0.09} radius={0.23} c="#537c7d" />
      <Cylinder p={[0, 0.29, 0]} h={0.4} radius={0.027} />
      <Cylinder p={[0, 0.08, 0]} h={0.035} radius={0.23} c="#9aacab" />
    </group>
  );
}
