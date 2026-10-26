import { expect, test } from "@playwright/test";

test("owns the microphone only while the Practice clinic is active", async ({ page }) => {
  await page.addInitScript(() => {
    const probe = { acquired: 0, stopped: 0, contextsClosed: 0 };
    (window as typeof window & { __practiceVoiceProbe: typeof probe }).__practiceVoiceProbe = probe;
    const getUserMedia = async () => {
      probe.acquired += 1;
      return { getTracks: () => [{ stop: () => { probe.stopped += 1; } }] };
    };
    if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: getUserMedia });
    else Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
    class MockAudioContext {
      sampleRate = 48000;
      audioWorklet = { addModule: async () => undefined };
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      async close() { probe.contextsClosed += 1; }
    }
    class MockAudioWorkletNode { port = { onmessage: null }; disconnect() {} }
    class MockWebSocket extends EventTarget {
      static OPEN = 1;
      readyState = 0;
      binaryType = "";
      send() {}
      close() { this.readyState = 3; }
    }
    Object.defineProperty(window, "AudioContext", { configurable: true, value: MockAudioContext });
    Object.defineProperty(window, "AudioWorkletNode", { configurable: true, value: MockAudioWorkletNode });
    Object.defineProperty(window, "WebSocket", { configurable: true, value: MockWebSocket });
  });
  await page.route("**/api/voice/access", route => route.fulfill({ status: 200, body: "{}", contentType: "application/json" }));
  const probe = () => page.evaluate(() => (window as typeof window & { __practiceVoiceProbe: { acquired: number; stopped: number; contextsClosed: number } }).__practiceVoiceProbe);

  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: "Guided Practice" }).click();
  await page.getByRole("button", { name: "VR mode" }).click();
  await page.getByRole("button", { name: "Enable voice" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();
  await expect(page.getByRole("button", { name: "Enter", exact: true })).toBeVisible();
  await page.waitForTimeout(200);
  expect(await probe()).toEqual({ acquired: 0, stopped: 0, contextsClosed: 0 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(await probe()).toEqual({ acquired: 0, stopped: 0, contextsClosed: 0 });

  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();
  await expect.poll(async () => (await probe()).acquired).toBe(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(async () => await probe()).toEqual({ acquired: 1, stopped: 1, contextsClosed: 1 });
});

test("keeps the home page and configures each practice test at its launcher", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Practice clinical skills/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Test yourself with a patient/ })).toBeVisible();

  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await expect(page.getByRole("heading", { name: "Extraocular motilities" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guided Practice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keyboard + mouse" })).toHaveCount(0);

  await page.getByRole("button", { name: "Guided Practice" }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();

  await expect(page.locator(".motility-guided-step")).toContainText("Next step");
  await expect(page.getByLabel("Show H-pattern guides")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: "Test", exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Test" }).click();

  await expect(page.locator(".motility-guided-step")).toHaveCount(0);
  await expect(page.getByLabel("Show H-pattern guides")).toHaveCount(0);
});

for (const kind of ["Guided Practice", "Test"] as const) {
  test(`chooses Krimsky method after ${kind} and before controls`, async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Practice clinical skills/ }).click();
    await page.getByRole("button", { name: /1.4.*Krimsky/ }).click();
    await expect(page.getByRole("group", { name: "Krimsky method", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: kind, exact: true }).click();
    await expect(page.getByRole("button", { name: "Keyboard + mouse" })).toHaveCount(0);
    await page.getByRole("button", { name: "Modified Krimsky", exact: true }).click();
    await page.getByRole("button", { name: "Keyboard + mouse" }).click();
    await page.getByRole("button", { name: "Disable voice" }).click();
    await page.getByRole("button", { name: `Start ${kind}`, exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Modified Krimsky");
  });
}
