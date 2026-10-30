import "dotenv/config";
import path from "node:path";
import express from "express";
import { createApp } from "./server/app";
const app = createApp();
async function start() {
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 3000);
  app.listen(port, "0.0.0.0", () =>
    console.log(`AURA Fashion: http://localhost:${port}`),
  );
}
start().catch(() => {
  console.error("Could not start AURA Fashion.");
  process.exitCode = 1;
});
