/** Existing fictional push-up endpoints, measured from the illustrative spectacle plane. */
export const pushUpBlurCm = { OD: 10, OS: 11, OU: 12 } as const;
export const pushUpAmplitude = (distanceCm: number) => 100 / distanceCm;
