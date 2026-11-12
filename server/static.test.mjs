import { afterAll, beforeAll, expect, it } from "vitest";
import express from "express";
import { createServer, get } from "node:http";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mountStaticApp } from "./static.mjs";

let server, root, base;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "opto-static-"));
  await mkdir(join(root, "assets/patient-0123456789abcdef"), { recursive: true });
  await mkdir(join(root, "assets/patient-prototype"), { recursive: true });
  await writeFile(join(root, "index.html"), "<!doctype html><title>Opto</title>");
  await writeFile(join(root, "assets/app-abcdefgh.js"), "export default 1");
  await writeFile(join(root, "assets/patient-0123456789abcdef/patient.json"), "{}");
  await writeFile(join(root, "assets/patient-prototype/patient.json"), "{}");
  await writeFile(join(root, "assets/large-abcdefgh.js"), "/* speed regression */".repeat(500));
  await writeFile(join(root, "assets/large-abcdefgh.png"), Buffer.alloc(4096, 42));
  const app = express(); mountStaticApp(app, root);
  server = createServer(app);
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  base = "http://127.0.0.1:" + server.address().port;
});
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (root) await rm(root, { recursive: true, force: true });
});
it("only caches content-versioned assets immutably", async () => {
  for (const path of ["/assets/app-abcdefgh.js", "/assets/patient-0123456789abcdef/patient.json"]) {
    const response = await fetch(base + path);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("immutable");
  }
  for (const path of ["/", "/assets/patient-prototype/patient.json"]) {
    const response = await fetch(base + path);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-cache");
  }
});
it("does not turn missing modules, APIs or non-navigation requests into HTML success", async () => {
  for (const path of ["/assets/missing.js", "/audio/missing.mp3", "/unknown"]) {
    const response = await fetch(base + path);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).not.toContain("text/html");
  }
  const api = await fetch(base + "/api/missing");
  expect(api.status).toBe(404); expect(await api.json()).toEqual({ error: "Not found" });
  expect((await fetch(base + "/", { method: "POST" })).status).toBe(404);
  expect((await fetch(base + "/", { headers: { accept: "application/json" } })).status).toBe(404);
  expect((await fetch(base + "/", { method: "HEAD", headers: { accept: "text/html" } })).status).toBe(200);
});


function raw(path, headers) {
  return new Promise((resolve, reject) => {
    get(base + path, { headers }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    }).on("error", reject);
  });
}
it("negotiates gzip/Brotli with unchanged content, MIME and cache policy", async () => {
  const original = Buffer.from("/* speed regression */".repeat(500));
  for (const encoding of ["gzip", "br"]) {
    const result = await raw("/assets/large-abcdefgh.js", { "accept-encoding": encoding });
    expect(result.headers["content-encoding"]).toBe(encoding);
    expect(result.headers.vary).toContain("Accept-Encoding");
    expect(result.headers["content-type"]).toContain("javascript");
    expect(result.headers["cache-control"]).toContain("immutable");
    expect(result.body.length).toBeLessThan(original.length);
    expect((encoding === "br" ? brotliDecompressSync : gunzipSync)(result.body)).toEqual(original);
  }
  const identity = await raw("/assets/large-abcdefgh.js", { "accept-encoding": "identity" });
  expect(identity.headers["content-encoding"]).toBeUndefined();
  expect(identity.body).toEqual(original);
  const conditional = await raw("/assets/large-abcdefgh.js", { "accept-encoding": "gzip", "if-none-match": identity.headers.etag });
  expect(conditional.status).toBe(304); expect(conditional.body.length).toBe(0);
});
it("keeps binary files and byte-range requests uncompressed", async () => {
  const image = await raw("/assets/large-abcdefgh.png", { "accept-encoding": "br, gzip" });
  expect(image.headers["content-encoding"]).toBeUndefined();
  expect(image.body.length).toBe(4096);
  const range = await raw("/assets/large-abcdefgh.js", { "accept-encoding": "gzip", range: "bytes=0-9" });
  expect(range.status).toBe(206);
  expect(range.headers["content-encoding"]).toBeUndefined();
  expect(range.body.length).toBe(10);
});
