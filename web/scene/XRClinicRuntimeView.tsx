import { DoubleSide } from "three";
import type { ClinicInstrumentSettings } from "./LibraryClinicEquipment";
import { SensoryClinicStation } from "./SensoryClinicEquipment";
import { ConsultationInstruments } from "./ConsultationInstruments";
import { XRSign as Sign } from "./XRClinicPanels";
import { stations } from "../interaction/navigation";
import { consultationXRArrival } from "../interaction/xrConsultationNavigation";
import { AUXILIARY_INSTRUMENT_KIT } from "../interaction/clinicLayout";
import { consultationToolDefinition, consultationPickupLabel, toolInHand, type ConsultationToolId } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime, XRClinicHand } from "../interaction/useXRClinicRuntime";
import type { FundusScopeView, BrucknerScopeView } from "./XRScopeOptics";
import { XRScopeView } from "./XRScopeView";
export function XRClinicRuntimeView({ runtime, active, preview = false, title = "VR CONSULTATION", instruction = "Explore freely · A/X · patient menu", showWallInstructions = true, showInstructionalHighlights = true, cleanHands = false, helperHand, helperReady = false, fundusView, brucknerView, sensoryStation, instrumentSettings, selectableEquipment }: {
  instrumentSettings?: ClinicInstrumentSettings;
  selectableEquipment?: readonly ConsultationToolId[];
  runtime: XRClinicRuntime;
  sensoryStation?: "worth" | "stereo" | "four-prism";
  active: boolean;
  preview?: boolean;
  title?: string;
  instruction?: string;
  /** Guided lessons can replace the generic wall placard with their own coach. */
  showWallInstructions?: boolean;
  showInstructionalHighlights?: boolean;
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
    {showGuides && showWallInstructions && <group userData={{ xrWallWelcome: true }}>
      <Sign text={active
        ? [title, "Grip once · pick up / transfer · again · place", "Trigger · use · A/X · menu · free-hand B/Y · VR controls", instruction]
        : ["DESKTOP VR PREVIEW", "WASD + mouse · inspect the clinic", "E / click · select tools", "Floor rings · headset destinations"]
      } p={[-1.15, 1.72, -2.455]} size={[.72, .30]} bg="#153b3c" fg="#e8fff9" />
    </group>}
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
    {showGuides && <group position={[...AUXILIARY_INSTRUMENT_KIT.xrArrival]} userData={active ? { xrTeleport: [...AUXILIARY_INSTRUMENT_KIT.xrArrival] } : { xrPreviewPad: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.22, .3, 32]} />
        <meshBasicMaterial color="#4fae9d" transparent opacity={.72} />
      </mesh>
      <Sign text={["EXTENDED INSTRUMENT KIT"]} p={[0, .008, 0]} size={[.46, .1]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9" />
    </group>}
    {(active || preview) && <>
      <SensoryClinicStation active={active} runtime={runtime} distanceLetter={sensoryStation === "four-prism"} showFittingGuides={showInstructionalHighlights} />
      <ConsultationInstruments equipment={runtime.equipment} selectable={selectableEquipment} scopeControl={{ aperture: runtime.scopeAperture, cycle: runtime.cycleScopeAperture }} settings={instrumentSettings} fundusView={fundusView} brucknerView={brucknerView} state={tools} highlighted={highlighted} returnedAt={returnedAt} register={registerTool} />
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
      <group ref={hoverMarker} visible={false} userData={{ xrIgnoreRay: true, xrHoverOutline: true }}>
        {([.5, -.5] as const).map(y => <mesh key={`horizontal-${y}`} position={[0, y, .025]} renderOrder={1100}>
          <planeGeometry args={[1, .055]} /><meshBasicMaterial color="#a9ffe5" depthTest={false} depthWrite={false} />
        </mesh>)}
        {([.5, -.5] as const).map(x => <mesh key={`vertical-${x}`} position={[x, 0, .025]} renderOrder={1100}>
          <planeGeometry args={[.018, 1]} /><meshBasicMaterial color="#a9ffe5" depthTest={false} depthWrite={false} />
        </mesh>)}
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
      {showWallInstructions && handlingMessage && <Sign text={[handlingMessage]} p={[-1.15, 1.48, -2.45]} size={[.72, .08]} bg="#173a3e" fg="#e8fff9" />}
    </>}
  </>;
}
