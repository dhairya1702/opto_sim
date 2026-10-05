import type { ThreeElements } from "@react-three/fiber";
import { Box, Cylinder, Ring } from "../../scene/Models";

export const XR_CLINIC_TOOL_IDS = [
  "penlight",
  "occluder",
  "prism-bar",
  "maddox-rod",
  "near-target",
  "lens-flipper",
] as const;

export type XRClinicToolId = (typeof XR_CLINIC_TOOL_IDS)[number];

type ToolVisualProps = ThreeElements["group"] & {
  selected?: boolean;
  powered?: boolean;
};

export type XRClinicToolModelProps = ToolVisualProps & {
  tool: XRClinicToolId;
};

const dark = "#26383c";
const metal = "#9caaa9";
const teal = "#3f7774";
const selectedColor = "#8de3d3";

function ToolGroup({ selected = false, children, ...props }: ToolVisualProps) {
  return (
    <group {...props}>
      {children}
      {selected && (
        <pointLight
          position={[0, 0.04, 0]}
          color={selectedColor}
          intensity={0.35}
          distance={0.35}
          decay={2}
        />
      )}
    </group>
  );
}

/**
 * Metre-scale penlight. Its origin sits at the controller grip and its lens
 * points down local -Z, matching the usual WebXR controller pointing axis.
 */
export function XRPenlight({ selected, powered = false, ...props }: ToolVisualProps) {
  return (
    <ToolGroup selected={selected} {...props}>
      <Cylinder p={[0, 0, -0.015]} radius={0.017} h={0.19} c={dark} r={[Math.PI / 2, 0, 0]} />
      <Cylinder p={[0, 0, -0.11]} radius={0.024} h={0.025} c={metal} r={[Math.PI / 2, 0, 0]} />
      <Cylinder p={[0, 0, -0.125]} radius={0.019} h={0.006} c={powered ? "#fff4b6" : "#b6cbca"} r={[Math.PI / 2, 0, 0]} />
      <Cylinder p={[0, 0, 0.086]} radius={0.018} h={0.012} c="#647476" r={[Math.PI / 2, 0, 0]} />
      <mesh position={[0.017, 0.008, -0.055]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.006, 0.018, 4, 8]} />
        <meshStandardMaterial color={powered ? "#90d8c9" : "#607174"} roughness={0.45} />
      </mesh>
      {powered && <pointLight position={[0, 0, -0.13]} color="#fff5ce" intensity={0.35} distance={0.45} decay={2} />}
    </ToolGroup>
  );
}

/** A solid cover-test paddle, with the grip origin near the handle centre. */
export function XROccluder({ selected, ...props }: ToolVisualProps) {
  return (
    <ToolGroup selected={selected} {...props}>
      <Box p={[0, 0.075, 0]} s={[0.024, 0.19, 0.017]} c={dark} radius={0.008} />
      <mesh position={[0, 0.22, 0]} scale={[1, 1.08, 0.17]} castShadow>
        <sphereGeometry args={[0.073, 28, 18]} />
        <meshStandardMaterial color="#31464b" roughness={0.56} />
      </mesh>
      <Ring p={[0, 0.22, 0.014]} radius={0.061} c="#78908f" rotation={[Math.PI / 2, 0, 0]} />
      <Box p={[0, -0.025, 0]} s={[0.038, 0.022, 0.024]} c="#78908f" radius={0.006} />
    </ToolGroup>
  );
}

/** A hand-held stepped prism bar. Individual cells are visual guides only. */
export function XRPrismBar({ selected, ...props }: ToolVisualProps) {
  const cells = Array.from({ length: 8 }, (_, index) => index);
  return (
    <ToolGroup selected={selected} {...props}>
      <Box p={[0, -0.075, 0]} s={[0.034, 0.15, 0.028]} c={dark} radius={0.008} />
      <Box p={[-.041, .128, 0]} s={[.009, .29, .018]} c="#485d60" radius={.003} />
      <Box p={[.041, .128, 0]} s={[.009, .29, .018]} c="#485d60" radius={.003} />
      {cells.map((index) => (
        <group key={index} position={[0, 0.015 + index * 0.032, 0.012]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.027, 0.022, 0.012, 4]} />
            <meshPhysicalMaterial color="#b9e1dc" transparent opacity={0.62} roughness={0.18} transmission={0.18} thickness={0.008} />
          </mesh>
          <Box p={[0.031, 0, -0.002]} s={[0.012, 0.005, 0.004]} c="#dcebea" />
        </group>
      ))}
      <Box p={[0, 0.284, 0]} s={[0.066, 0.018, 0.024]} c={teal} radius={0.007} />
    </ToolGroup>
  );
}

/** Red grooved Maddox lens mounted in a hand-held trial-lens paddle. */
export function XRMaddoxRod({ selected, ...props }: ToolVisualProps) {
  return (
    <ToolGroup selected={selected} {...props}>
      <Box p={[0, 0.06, 0]} s={[0.025, 0.17, 0.018]} c={dark} radius={0.008} />
      <Ring p={[0, 0.19, 0]} radius={0.065} c="#26353a" rotation={[Math.PI / 2, 0, 0]} />
      <mesh position={[0, 0.19, 0]} rotation={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.012, 32]} />
        <meshPhysicalMaterial color="#a92735" transparent opacity={0.78} roughness={0.3} transmission={0.12} />
      </mesh>
      {[-0.036, -0.024, -0.012, 0, 0.012, 0.024, 0.036].map((x) => (
        <Cylinder key={x} p={[x, 0.19, 0.009]} radius={0.0022} h={0.1} c="#df6970" />
      ))}
      <Box p={[0, -0.035, 0]} s={[0.04, 0.022, 0.025]} c="#78898a" radius={0.007} />
    </ToolGroup>
  );
}

/** A fixation wand with a high-contrast near target on each face. */
export function XRNearTarget({ selected, ...props }: ToolVisualProps) {
  return (
    <ToolGroup selected={selected} {...props}>
      <Box p={[0, 0.07, 0]} s={[0.025, 0.19, 0.018]} c={dark} radius={0.008} />
      <Box p={[0, 0.245, 0]} s={[0.125, 0.17, 0.012]} c="#f4f1df" radius={0.012} />
      {[0.044, 0.03, 0.016].map((radius, index) => (
        <mesh key={radius} position={[0, 0.255, 0.009 + index * 0.0003]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius, radius, 0.002, 32]} />
          <meshStandardMaterial color={index % 2 === 0 ? "#223b40" : "#f0d45e"} roughness={0.7} />
        </mesh>
      ))}
      <Box p={[0, 0.18, 0.01]} s={[0.086, 0.009, 0.002]} c={teal} />
      <Box p={[0, -0.035, 0]} s={[0.04, 0.022, 0.025]} c="#78898a" radius={0.007} />
    </ToolGroup>
  );
}

function FlipperLens({ x, color }: { x: number; color: string }) {
  return (
    <group position={[x, 0.17, 0]}>
      <Ring p={[0, 0, 0]} radius={0.057} c={dark} rotation={[Math.PI / 2, 0, 0]} />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.049, 0.049, 0.007, 32]} />
        <meshPhysicalMaterial color={color} transparent opacity={0.32} transmission={0.4} roughness={0.12} thickness={0.008} />
      </mesh>
      <Box p={[0, -0.071, 0]} s={[0.032, 0.047, 0.015]} c={dark} radius={0.006} />
    </group>
  );
}

/** Two-sided lens flipper with a central grip and clearly different lens tints. */
export function XRLensFlipper({ selected, ...props }: ToolVisualProps) {
  return (
    <ToolGroup selected={selected} {...props}>
      <Box p={[0, 0.035, 0]} s={[0.03, 0.19, 0.022]} c={dark} radius={0.009} />
      <Box p={[0, 0.11, 0]} s={[0.18, 0.025, 0.019]} c={dark} radius={0.007} />
      <FlipperLens x={-0.088} color="#8ecfe0" />
      <FlipperLens x={0.088} color="#e4bd80" />
      <Box p={[0, -0.06, 0]} s={[0.045, 0.026, 0.029]} c="#78898a" radius={0.007} />
    </ToolGroup>
  );
}

/** Renders any registered clinic tool with a common spatial contract. */
export function XRClinicToolModel({ tool, ...props }: XRClinicToolModelProps) {
  switch (tool) {
    case "penlight": return <XRPenlight {...props} />;
    case "occluder": return <XROccluder {...props} />;
    case "prism-bar": return <XRPrismBar {...props} />;
    case "maddox-rod": return <XRMaddoxRod {...props} />;
    case "near-target": return <XRNearTarget {...props} />;
    case "lens-flipper": return <XRLensFlipper {...props} />;
  }
}

/** A compact foam-lined kit that can hold the six shared Practice tools. */
export function XRInstrumentKitSurface(props: ThreeElements["group"]) {
  const slots: Array<[number, number]> = [
    [-0.46, -0.22], [0, -0.22], [0.46, -0.22],
    [-0.46, 0.22], [0, 0.22], [0.46, 0.22],
  ];
  return (
    <group {...props}>
      <Box p={[0, 0, 0]} s={[1.35, 0.055, 0.82]} c="#39484a" radius={0.025} />
      <Box p={[0, 0.032, 0]} s={[1.27, 0.025, 0.74]} c="#657374" radius={0.018} />
      {slots.map(([x, z], index) => (
        <Box
          key={`${x}-${z}`}
          p={[x, 0.046, z]}
          s={[index === 0 ? .11 : .14, .004, .29]}
          c="#566668"
          radius={.025}
        />
      ))}
      <Box p={[0, 0.24, -0.43]} s={[1.35, 0.42, 0.035]} c="#39484a" radius={0.022} />
      <Box p={[0, 0.24, -0.409]} s={[1.27, 0.34, 0.01]} c="#526466" radius={0.014} />
      <Cylinder p={[0, 0.052, -0.422]} radius={0.013} h={0.92} c={metal} r={[0, 0, Math.PI / 2]} />
      <Box p={[0, -0.03, 0.43]} s={[0.18, 0.026, 0.026]} c="#263638" radius={0.009} />
    </group>
  );
}

/** Rounded clinic cabinet and work surface for the instrument-selection area. */
export function XRInstrumentCabinet(props: ThreeElements["group"]) {
  return (
    <group {...props}>
      <Box p={[0, 0.46, 0]} s={[1.55, 0.9, 0.9]} c="#d8e0dc" radius={0.045} />
      <Box p={[0, 0.925, 0]} s={[1.65, 0.055, 1]} c="#edf0e9" radius={0.022} />
      <Box p={[0, 1.055, -0.455]} s={[1.58, 0.23, 0.035]} c="#dce5e1" radius={0.016} />
      <Box p={[-0.38, 0.51, 0.456]} s={[0.7, 0.72, 0.018]} c="#c7d2cf" radius={0.022} />
      <Box p={[0.38, 0.51, 0.456]} s={[0.7, 0.72, 0.018]} c="#c7d2cf" radius={0.022} />
      <Cylinder p={[-0.04, 0.51, 0.31]} radius={0.009} h={0.15} c="#6f8583" />
      <Cylinder p={[0.04, 0.51, 0.31]} radius={0.009} h={0.15} c="#6f8583" />
      <Box p={[0, 0.08, 0.02]} s={[1.38, 0.08, 0.76]} c="#b5c3c0" radius={0.022} />
    </group>
  );
}
