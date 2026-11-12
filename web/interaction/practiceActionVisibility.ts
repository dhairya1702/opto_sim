/** Presentation only: procedure/voice handlers retain their own authority checks. */
export function visiblePracticeActions<T extends { visible?: boolean; disabled?: boolean }>(actions: readonly T[], recordingOrComplete = false): T[] {
  return recordingOrComplete ? [] : actions.filter(action => action.visible !== false && !action.disabled);
}
