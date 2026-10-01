import { expect, it } from "vitest";
import { stereoDistanceReady, stereoLastCorrect, stereoPatientReply, stereoStopped, type StereoReply } from "../interaction/stereoPractice";
it("accepts the illustrative 40 cm working range", () => {
  expect(stereoDistanceReady(38)).toBe(true);
  expect(stereoDistanceReady(42)).toBe(true);
  expect(stereoDistanceReady(37)).toBe(false);
  expect(stereoDistanceReady(43)).toBe(false);
});
it("stops after two errors and retains the last correct threshold", () => {
  const replies: StereoReply[] = [];
  for (let index = 0; index < 6; index++) {
    const reply = stereoPatientReply(index);
    expect(reply).not.toBeNull();
    if (reply) replies.push(reply);
    expect(stereoStopped(replies)).toBe(index === 5);
  }
  expect(stereoLastCorrect(replies)).toBe(100);
});
it("does not treat isolated errors as a stopping endpoint", () => {
  const correct = { level: 100, selected: 1, target: 1, correct: true };
  const wrong = { level: 60, selected: 0, target: 1, correct: false };
  expect(stereoStopped([wrong, correct, wrong])).toBe(false);
  expect(stereoLastCorrect([])).toBeNull();
  expect(stereoPatientReply(6)).toBeNull();
});
