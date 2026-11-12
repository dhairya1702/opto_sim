import compression from "compression";
import express from "express";
import { join } from "node:path";

export function mountStaticApp(app, dist) {
  // Scope compression to static/navigation responses, not voice or streaming APIs.
  app.use(compression({
    threshold: 1024,
    filter: (request, response) => !request.headers.range
      && /^(text\/|application\/(javascript|json)|image\/svg\+xml)/i.test(String(response.getHeader("content-type") ?? ""))
      && compression.filter(request, response),
  }));
  app.use(express.static(dist, {
    index: false, maxAge: 0,
    setHeaders(response, path) {
      const versioned = /\/assets\/patient-[a-f0-9]{16}\//.test(path)
        || /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[^/]+$/.test(path);
      response.setHeader("cache-control", versioned ? "public, max-age=31536000, immutable" : "no-cache");
    },
  }));
  app.use("/api", (_request, response) => response.status(404).json({ error: "Not found" }));
  app.use((request, response) => {
    // The app has a single URL; asset failures must never become HTML successes.
    if ((request.method === "GET" || request.method === "HEAD") && request.path === "/" && request.accepts("html")) {
      response.setHeader("cache-control", "no-cache");
      response.sendFile(join(dist, "index.html"));
    } else response.status(404).type("text").send("Not found");
  });
}
