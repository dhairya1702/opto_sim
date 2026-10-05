export type ConsultationInputState = {
  panel: boolean;
  gripDown: boolean;
  triggerDown: boolean;
  triggerRoute: "tool" | "panel" | null;
};
export const initialConsultationInput = (): ConsultationInputState => ({ panel: false, gripDown: false, triggerDown: false, triggerRoute: null });
export function pressConsultationGrip(state: ConsultationInputState): ConsultationInputState {
  return state.gripDown ? state : { ...state, gripDown: true, triggerRoute: null };
}
export function releaseConsultationGrip(state: ConsultationInputState): ConsultationInputState {
  return { ...state, gripDown: false, triggerRoute: null };
}
export function toggleConsultationPanel(state: ConsultationInputState): ConsultationInputState {
  return { ...state, panel: !state.panel, triggerRoute: null };
}
export function pressConsultationTrigger(state: ConsultationInputState, hasTool: boolean): ConsultationInputState {
  return state.triggerDown ? state : { ...state, triggerDown: true, triggerRoute: state.panel || !hasTool ? "panel" : "tool" };
}
export function releaseConsultationTrigger(state: ConsultationInputState): ConsultationInputState {
  return { ...state, triggerDown: false, triggerRoute: null };
}
/** Keep held-button edges latched; interruption must never synthesize a fresh action. */
export function interruptConsultationInput(state: ConsultationInputState): ConsultationInputState {
  return { ...state, triggerRoute: null };
}
