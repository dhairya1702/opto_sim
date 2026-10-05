import { DoubleSide } from "three";
import { Box, Cylinder, Ring } from "./Models";
import { XRSign } from "./XRClinicPanels";
import { LIBRARY_SOCKETS } from "../interaction/xrLibraryEquipment";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";
export type ClinicInstrumentSetting = { power?: number; base?: string; angle?: number; side?: string; point?: boolean };
export type ClinicInstrumentSettings = Partial<Record<ConsultationToolId, ClinicInstrumentSetting>>;
export function LibraryInstrumentModel({ id, setting = {} }: { id: ConsultationToolId; setting?: ClinicInstrumentSetting }) {
  return <group>
    <Cylinder p={[0, 0, 0]} h={.14} radius={.009} c="#607b79" />
    <group position={[0, .10, 0]}>
      {id === "maddox" ? <group rotation={[0, 0, (setting.angle ?? 90) * Math.PI / 180]}>
        <Ring p={[0, 0, 0]} radius={.025} c="#8d4549" />
        <mesh><circleGeometry args={[.023, 24]} /><meshBasicMaterial color="#e4464f" transparent opacity={.3} side={DoubleSide} /></mesh>
        {[-.015, -.0075, 0, .0075, .015].map(y => <Box key={y} p={[0, y, .002]} s={[.04, .0015, .003]} c="#cc585e" />)}
      </group> : id === "thorington" ? <group>
        <Box p={[-.065, 0, 0]} s={[.11, .18, .006]} c="#f1eddf" /><Box p={[.065, 0, 0]} s={[.11, .18, .006]} c="#f1eddf" /><Box p={[0, .05, 0]} s={[.02, .08, .006]} c="#f1eddf" /><Box p={[0, -.05, 0]} s={[.02, .08, .006]} c="#f1eddf" />
        <mesh position={[0, 0, -.004]}><ringGeometry args={[.006, .010, 24]} /><meshBasicMaterial color="#263c39" side={DoubleSide} /></mesh>
        {Array.from({ length: 21 }, (_, i) => i - 10).filter(i => i !== 0).map(i => <group key={i}>
          <Box p={[i * .010, 0, -.004]} s={[.001, .009, .001]} c="#244b47" />
          <Box p={[0, i * .007, -.004]} s={[.009, .001, .001]} c="#244b47" />
          <XRSign text={[String(Math.abs(i))]} p={[i * .010, .014, -.005]} size={[.008, .008]} rotation={[0, Math.PI, 0]} bg="#f1eddf" fg="#244b47" />
          <XRSign text={[String(Math.abs(i))]} p={[.014, i * .007, -.005]} size={[.008, .006]} rotation={[0, Math.PI, 0]} bg="#f1eddf" fg="#244b47" />
        </group>)}
        <XRSign text={["THORINGTON · 40 CM", "CENTRE LIGHT THROUGH HOLE"]} p={[0, .06, .005]} size={[.23, .04]} bg="#f1eddf" fg="#244b47" />
      </group> : id === "fixation" ? <group>
        <Box s={[.07, .07, .006]} c="#f1eddf" />
        {[-1, 1].map(side => <mesh key={side} position={[0, 0, side * .004]}><ringGeometry args={[.005, .017, 4]} /><meshBasicMaterial color="#2b6256" side={DoubleSide} /></mesh>)}
      </group> : <group>
        {[-.048, .048].map(x => <group key={x} position={[x, 0, 0]}>
          <Ring p={[0, 0, 0]} radius={.030} c={setting.side === "minus" || (setting.power ?? 0) < 0 ? "#b04f61" : "#488da0"} />
          <mesh><circleGeometry args={[.028, 24]} /><meshBasicMaterial color="#c7eae3" transparent opacity={.22} side={DoubleSide} /></mesh>
          {id === "prism-flipper" && <mesh rotation={[0, 0, setting.side === "BI" ? Math.PI / 2 : -Math.PI / 2]}><coneGeometry args={[.010, .024, 3]} /><meshBasicMaterial color="#d5eee4" side={DoubleSide} /></mesh>}
        </group>)}
        <Box p={[0, .01, 0]} s={[.04, .008, .008]} c="#354d53" />
      </group>}
    </group>
    {id !== "fixation" && id !== "maddox" && id !== "thorington" && <XRSign text={[id === "prism-flipper" ? setting.side === "BI" ? "3Δ BI" : "12Δ BO" : id === "lens-flipper" ? setting.side === "minus" ? "−2.00 D" : "+2.00 D" : `${(setting.power ?? 0).toFixed(2)} D`]} p={[0, .04, .014]} size={[.12, .025]} bg="#173a3e" fg="#e8fff9" />}
  </group>;
}
export function LibraryEquipmentTray({ active = false, equipment = [] }: { active?: boolean; equipment?: readonly ConsultationToolId[] }) {
  return <>
    {([[.65, 1.75, "LENSES / FLIPPERS"], [0, .25, "PATIENT FITTING"]] as const).map(([x, z, label]) => <group key={label} position={[x, .012, z]} userData={active ? { xrTeleport: [x, 0, z] } : { xrPreviewPad: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.19, .26, 32]} /><meshBasicMaterial color="#4fae9d" transparent opacity={.65}/></mesh>
      <XRSign text={[label]} p={[0, .008, 0]} size={[.33, .08]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9"/>
    </group>)}
    {LIBRARY_SOCKETS.filter(socket => socket.fittingLayer && equipment.includes(socket.tool)).map(socket => <group key={socket.id} position={[...socket.position]} userData={{ xrIgnoreRay: true }}><mesh><ringGeometry args={[.009, .012, 20]}/><meshBasicMaterial color="#f1da96" transparent opacity={.5} side={DoubleSide}/></mesh></group>)}
    <group userData={{ xrIgnoreRay: true }}>
    <Box p={[1.31, .85, 1.75]} s={[.92, .06, .76]} c="#d9e1d9" radius={.02} />
    <Cylinder p={[1.31, .43, 1.75]} h={.82} radius={.045} c="#9bafaa" />
    <Box p={[1.31, .02, 1.75]} s={[.65, .03, .40]} c="#8ca39f" />
    <XRSign text={["RODS · LENSES · FLIPPERS"]} p={[1.31, .72, 2.14]} size={[.68, .06]} bg="#173a3e" fg="#e8fff9" />
  </group></>;
}

export function LibraryNearStand() {
  return <group userData={{ xrIgnoreRay: true }}>
    <Cylinder p={[.26, .68, -.18]} h={1.34} radius={.01} c="#78948e" />
    <Box p={[.13, 1.36, -.18]} s={[.28, .016, .05]} c="#78948e" />
    <Box p={[.26, .025, -.18]} s={[.22, .025, .22]} c="#78948e" />
    <XRSign text={["NEAR TARGET · RELEASE AT 40 CM"]} p={[.30, 1.20, -.16]} size={[.28, .06]} bg="#173a3e" fg="#e8fff9" />
  </group>;
}
