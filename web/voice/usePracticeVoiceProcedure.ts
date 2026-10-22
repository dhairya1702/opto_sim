import { useLayoutEffect, useRef } from "react";
import { registerPracticeVoice, type PracticeVoiceSnapshot } from "./practiceRegistry";

export function usePracticeVoiceProcedure(lessonId: string, active: boolean, snapshot: PracticeVoiceSnapshot) {
  const registration = useRef<ReturnType<typeof registerPracticeVoice> | null>(null);
  useLayoutEffect(() => {
    if (!active) return;
    const owner = registerPracticeVoice(lessonId, snapshot);
    registration.current = owner;
    return () => { owner.dispose(); if (registration.current === owner) registration.current = null; };
  }, [lessonId, active]);
  useLayoutEffect(() => { registration.current?.update(snapshot); });
}
