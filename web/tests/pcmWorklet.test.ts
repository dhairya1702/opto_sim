import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

describe("PCM audio worklet", () => {
  it("stays idle until activated and aggregates render quanta into 20 ms frames", async () => {
    let Processor: (new () => { port: { onmessage?: (event: { data: unknown }) => void; postMessage: ReturnType<typeof vi.fn> }; process: (inputs: Float32Array[][]) => boolean }) | undefined;
    class AudioWorkletProcessorMock {
      port = { onmessage: undefined as ((event: { data: unknown }) => void) | undefined, postMessage: vi.fn() };
    }
    const source = await readFile(new URL("../../public/voice/pcm-worklet.js", import.meta.url), "utf8");
    const load = new Function("AudioWorkletProcessor", "sampleRate", "registerProcessor", source);
    load(AudioWorkletProcessorMock, 48_000, (_name: string, registered: typeof Processor) => { Processor = registered; });
    expect(Processor).toBeDefined();
    const worklet = new Processor!();
    const quantum = new Float32Array(128).fill(.5);

    worklet.process([[quantum]]);
    expect(worklet.port.postMessage).not.toHaveBeenCalled();
    worklet.port.onmessage?.({ data: { type: "active", active: true } });
    for (let index = 0; index < 8; index += 1) worklet.process([[quantum]]);

    expect(worklet.port.postMessage).toHaveBeenCalledTimes(1);
    const [{ pcm, rms }, transfer] = worklet.port.postMessage.mock.calls[0];
    expect(pcm).toBeInstanceOf(ArrayBuffer);
    expect(pcm.byteLength).toBe(960 * Int16Array.BYTES_PER_ELEMENT);
    expect(rms).toBeGreaterThan(16_000);
    expect(transfer).toEqual([pcm]);
    worklet.port.onmessage?.({ data: { type: "active", active: false } });
    worklet.process([[quantum]]);
    expect(worklet.port.postMessage).toHaveBeenCalledTimes(1);
  });
});
