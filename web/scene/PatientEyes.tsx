import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import { CLINIC_EYE_WHITE_RADII, CLINIC_IRIS_RADIUS, CLINIC_PUPIL_RADIUS } from "../interaction/clinicPatient";
import { PATIENT_BLINK_DURATION_SECONDS, patientBlinkClosure, patientBlinkDelay } from "../interaction/patientAnimation";

function EyeOrb({ p, s, c }: { p: [number, number, number]; s: [number, number, number]; c: string }) {
  return <mesh position={p} scale={s} castShadow><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color={c} roughness={.82} /></mesh>;
}
/** The rendered objects are the controller targets: no proxy or frame-copy adapter. */
export function PatientEyes({ xr, skin }: { xr: boolean; skin: string }) {
  const eyelids = useRef<Array<Mesh | null>>([]);
  const nextBlinkAt = useRef<number | null>(null);
  const blinkStartedAt = useRef<number | null>(null);
  useFrame(({ clock }) => {
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

  });
  return <>
    {[-1, 1].map(side => <group key={side}>
      <EyeOrb p={[side * 0.048, 1.5, 0.115]} s={CLINIC_EYE_WHITE_RADII} c="#e6d7c5" />
      {xr ? <group position={[side * .048, 1.5, .129]}>
        <group userData={{ consultationGaze: side < 0 ? "OD" : "OS" }}>
          <mesh><circleGeometry args={[CLINIC_IRIS_RADIUS, 24]} /><meshStandardMaterial color="#695342" /></mesh>
          <mesh position={[0, 0, .001]} userData={{ consultationPupil: side < 0 ? "OD" : "OS" }}>
            <circleGeometry args={[CLINIC_PUPIL_RADIUS, 24]} /><meshBasicMaterial color="#17191a" />
          </mesh>
        </group>
      </group> : <EyeOrb p={[side * 0.048, 1.5, 0.127]} s={[0.008, 0.009, 0.004]} c="#292626" />}
    </group>)}
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
  </>;
}
