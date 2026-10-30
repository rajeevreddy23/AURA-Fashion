import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname, basename } from "node:path";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const target = resolve(root, "dist");
if (dirname(target) !== root || basename(target) !== "dist")
  throw new Error("Invalid build output directory");
rmSync(target, { recursive: true, force: true });
