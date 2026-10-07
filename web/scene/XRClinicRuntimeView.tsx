import { DoubleSide } from "three";
import type { ClinicInstrumentSettings } from "./LibraryClinicEquipment";
import { SensoryClinicStation } from "./SensoryClinicEquipment";
import { ConsultationInstruments } from "./ConsultationInstruments";
import { XRSign as Sign } from "./XRClinicPanels";
import { stations } from "../interaction/navigation";
import { consultationXRArrival } from "../interaction/xrConsultationNavigation";
import { consultationToolDefinition, consultationPickupLabel, toolInHand } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime, XRClinicHand } from "../interaction/useXRClinicRuntime";
import type { FundusScopeView, BrucknerScopeView } from "./XRScopeOptics";
import { XRScopeView } from "./XRScopeView";
export function XRClinicRuntimeView({ runtime, active, preview = false, title = "VR CONSULTATION", instruction = "Explore freely · A/X · patient menu", cleanHands = false, helperHand, helperReady = false, fundusView, brucknerView, sensoryStation, instrumentSettings }: {
  instrumentSettings?: ClinicInstrumentSettings;
  runtime: XRClinicRuntime;
  sensoryStation?: "worth" | "stereo" | "four-prism";
  active: boolean;
  preview?: boolean;
  title?: string;
  instruction?: string;
  cleanHands?: boolean;
  helperHand?: XRClinicHand | null;
  helperReady?: boolean;
  fundusView?: FundusScopeView;
  brucknerView?: BrucknerScopeView;
}) {
  const { tools, slots, highlighted, returnedAt, registerTool, hoverMarker, pickupHints, handlingMessage } = runtime;
  const showGuides = active || preview;
  return <>
    <XRScopeView active={active && !preview && runtime.scopeViewHand !== null} brucknerView={brucknerView} fundusView={fundusView} />
    {showGuides && <Sign text={active
      ? [title, "Grip once · pick up / transfer · again · place", "Trigger · use · A/X · menu · B/Y · scope", instruction]
      : ["DESKTOP VR PREVIEW", "WASD + mouse · inspect the clinic", "E / click · select tools", "Floor rings · headset destinations"]
    } p={[0, 1.42, 1.38]} size={[.82, .38]} bg="#153b3c" fg="#e8fff9" />}
    {showGuides && stations.filter(station => station.id !== "fundus").map(station => {
      const arrival = consultationXRArrival(station.id, station.position);
      return <group key={station.id} position={[arrival[0], .012, arrival[2]]} userData={active ? { xrTeleport: arrival } : { xrPreviewPad: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.22, .3, 32]} />
        <meshBasicMaterial color="#4fae9d" transparent opacity={.72} />
      </mesh>
      <Sign text={[station.name.toUpperCase()]} p={[0, .008, 0]} size={[.42, .1]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9" />
    </group>;
    })}
    {(active || preview) && <>
      <SensoryClinicStation active={active} runtime={runtime} distanceLetter={sensoryStation === "four-prism"} />
      <ConsultationInstruments equipment={runtime.equipment} scopeControl={{ aperture: runtime.scopeAperture, cycle: runtime.cycleScopeAperture }} settings={instrumentSettings} fundusView={fundusView} brucknerView={brucknerView} state={tools} highlighted={highlighted} returnedAt={returnedAt} register={registerTool} />
      {active && (["left", "right"] as const).map(hand => <group key={hand} visible={false}
        ref={object => { if (object) runtime.placementMarkers.current.set(hand, object); else runtime.placementMarkers.current.delete(hand); }}
        userData={{ xrIgnoreRay: true, xrPlacementPreview: hand }}>
        {(["place", "return"] as const).map(kind => <group key={kind} name={kind}>
          <mesh name="outline">
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color={kind === "place" ? "#78e8b1" : "#ffcd70"} wireframe />
          </mesh>
          <group name="label" position={[0, .22, 0]}>
            <Sign text={[kind === "place" ? "GRIP AGAIN · PLACE HERE" : "GRIP AGAIN · RETURN TO REST"]}
              p={[0, 0, 0]} size={[.36, .055]} bg={kind === "place" ? "#153d2c" : "#493519"} fg="#fff9ed" />
          </group>
        </group>)}
      </group>)}
      <group ref={hoverMarker} visible={false} userData={{ xrIgnoreRay: true }}>
        <mesh renderOrder={1100}><boxGeometry args={[1, 1, 1]} /><meshBasicMaterial color="#b0ffe7" wireframe depthTest={false} depthWrite={false} /></mesh>
      </group>
      {active && slots.map((slot, index) => {
        const id = slot.hand ? toolInHand(tools, slot.hand) : null;
        return <group key={index} userData={{ xrIgnoreRay: true }}>
          <primitive object={slot.grip}>
            <mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[.025, .075, 5, 10]} /><meshStandardMaterial color={slot.hand === "left" ? "#6a8fa0" : "#72ae9f"} roughness={.5} /></mesh>
            {!cleanHands && <Sign text={[slot.panel ? "MENU · A/X TO RETURN" : id ? `${consultationToolDefinition(id).label}${consultationToolDefinition(id).illuminates ? tools[id].powered ? " · LIGHT ON" : consultationToolDefinition(id).powerMode === "persistent" ? " · LIGHT OFF · USE SWITCH" : " · TRIGGER FOR LIGHT" : ""}` : slot.hand ? consultationPickupLabel(pickupHints[slot.hand]) : "BRING HAND TO A TOOL"]} p={[0, .075, 0]} size={[.26, .042]} rotation={[-Math.PI / 2, 0, 0]} bg={slot.panel ? "#176b5e" : "#173a3e"} fg="#e8fff9" />}
            {helperHand && slot.hand && helperHand !== slot.hand && !id && !slot.panel && <group position={[0, 0, -.1]}>
              <mesh><sphereGeometry args={[.018, 20, 14]} /><meshBasicMaterial color={helperReady ? "#f06b55" : "#a16960"} /></mesh>
              <mesh position={[0, 0, .001]}><ringGeometry args={[.026, .032, 24]} /><meshBasicMaterial color="#fff2c5" side={DoubleSide} /></mesh>
            </group>}
          </primitive>
          <primitive object={slot.ray}>
            <mesh name="clinic-pointer-beam" position={[0, 0, -.8]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.6, 1]} renderOrder={1101}>
              <cylinderGeometry args={[.0015, .0015, 1, 8]} /><meshBasicMaterial color={slot.panel ? "#c2f3ff" : "#78d2c2"} transparent opacity={.75} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh name="clinic-pointer-dot" visible={false} renderOrder={1102}>
              <sphereGeometry args={[.005, 12, 8]} /><meshBasicMaterial color="#b0ffe7" depthTest={false} depthWrite={false} />
            </mesh>
          </primitive>
        </group>;
      })}
      {handlingMessage && <Sign text={[handlingMessage]} p={[0, 1.12, 1.38]} size={[.82, .08]} bg="#173a3e" fg="#e8fff9" />}
    </>}
  </>;
}
