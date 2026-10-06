/** Shared instrument settings, independent of lesson answers or consultation scoring. */
export type ScopeAperture = "small" | "large";
export type OphthalmoscopeControl = { aperture: ScopeAperture; cycle: () => void };
export const scopeBeamAngle = (aperture: ScopeAperture) => aperture === "large" ? .16 : .04;
export const nextScopeAperture = (aperture: ScopeAperture): ScopeAperture => aperture === "small" ? "large" : "small";
export const SCOPE_SELECTOR_REACH_M = .18;
