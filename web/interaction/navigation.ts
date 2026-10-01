import type { StationId } from "../domain/types";
export const stations: {
  id: StationId;
  name: string;
  action: string;
  description: string;
  position: [number, number, number];
  look: [number, number, number];
}[] = [
  {
    id: "patient",
    name: "Patient",
    action: "Arun: begin interview",
    description: "Interview & history",
    position: [0, 1.6, 1.15],
    look: [0, 1.25, -0.7],
  },
  {
    id: "trolley",
    name: "Instrument trolley",
    action: "Trolley: select examination kit",
    description: "Acuity, pupils, alignment & retinoscopy",
    position: [-0.65, 1.6, 1.7],
    look: [-1.25, 0.96, 0.65],
  },
  {
    id: "acuity",
    name: "Acuity display",
    action: "Chart: assess visual acuity",
    description: "Distance, pinhole & near acuity",
    position: [0.15, 1.6, -1.65],
    look: [0.15, 1.9, -2.44],
  },
  {
    id: "refraction",
    name: "Refraction station",
    action: "Trial frame: refine refraction",
    description: "Trial frame & lens set",
    position: [-0.65, 1.6, -0.3],
    look: [-1.43, 1, -1.2],
  },
  {
    id: "slit",
    name: "Slit-lamp station",
    action: "Slit lamp: examine anterior segment",
    description: "Anterior-segment assessment",
    position: [0.7, 1.6, 0.3],
    look: [1.35, 1.2, -0.9],
  },
  {
    id: "fundus",
    name: "Ophthalmoscope",
    action: "Ophthalmoscope: examine fundus",
    description: "Limited undilated fundus assessment",
    position: [-0.6, 1.6, 1.4],
    look: [-1.1, 1.13, 0.8],
  },
];
// World units are metres. Collision radius includes personal clearance.
export const obstacles = [
  { x: 0, z: -0.57, w: 0.86, d: 1.24 },
  { x: -1.37, z: 0.75, w: 0.92, d: 0.61 },
  { x: -1.45, z: -1.4, w: 0.85, d: 1.25 },
  { x: 1.35, z: -0.95, w: 1.02, d: 0.72 },
  { x: 1.4, z: -1.65, w: 0.55, d: 0.55 },
  { x: 1.35, z: -0.05, w: 0.52, d: 0.52 },
];
export function walkable(x: number, z: number) {
  const r = 0.19;
  return (
    Math.abs(x) < 2 - r &&
    Math.abs(z) < 2.5 - r &&
    !obstacles.some((o) => Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r)
  );
}
