export type KrimskyMethod = "standard" | "modified";
export type KrimskyBase = "BI" | "BO";
export const krimskyCases = [
  { deviation: "Left exotropia", base: "BI" as KrimskyBase, power: 20, sign: -1 },
  { deviation: "Left esotropia", base: "BO" as KrimskyBase, power: 15, sign: 1 },
];
export function krimskyEye(method: KrimskyMethod) { return method === "standard" ? "OS" : "OD"; }
export function krimskyResidual(endpoint: number, power: number, correctBase: boolean) {
  return endpoint - (correctBase ? power : -power);
}
export function krimskyDistanceReady(distance: number) { return Math.abs(distance - 50) <= 4; }
export function krimskyReady(method: KrimskyMethod, eye: string, light: boolean, fixation: boolean, distance: number, monocularView: boolean) {
  return eye === krimskyEye(method) && light && fixation && krimskyDistanceReady(distance) && monocularView;
}
