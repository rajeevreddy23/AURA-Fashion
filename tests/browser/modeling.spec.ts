import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
function sampleGlb() {
  const vertices = Buffer.alloc(36);
  [-1, -1, 0, 1, -1, 0, 0, 1, 0].forEach((n, i) =>
    vertices.writeFloatLE(n, i * 4),
  );
  const json = JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, -1, 0],
        max: [1, 1, 0],
      },
    ],
  });
  const padded = Buffer.from(
    json + " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4),
  );
  const glb = Buffer.alloc(28 + padded.length + vertices.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(glb, 20);
  glb.writeUInt32LE(vertices.length, 20 + padded.length);
  glb.writeUInt32LE(0x004e4942, 24 + padded.length);
  vertices.copy(glb, 28 + padded.length);
  return glb;
}
test("local GLB import validates files and provides working model controls", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/modeling");
  await expect(
    page.getByRole("heading", { name: "AI 3D modeling", exact: true }),
  ).toBeVisible();
  const upload = page.locator("#model-import");
  await upload.setInputFiles({
    name: "invalid.glb",
    mimeType: "model/gltf-binary",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("status")).toContainText("not a valid");
  await upload.setInputFiles({
    name: "sample.glb",
    mimeType: "model/gltf-binary",
    buffer: sampleGlb(),
  });
  await expect(page.getByRole("status")).toContainText("sample.glb loaded");
  await page.getByRole("checkbox", { name: "Wireframe" }).check();
  await page.getByRole("button", { name: "Reset view" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download GLB" }).click();
  expect((await download).suggestedFilename()).toBe("sample.glb");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("dress library filters and opens an editable preset without replacing previous saved work", async ({
  page,
}) => {
  await page.goto("/looks");
  await expect(page.locator(".look-card")).toHaveCount(18);
  await page.getByLabel("Dress type").selectOption("gown");
  await expect(page.locator(".look-card")).toHaveCount(6);
  await page
    .getByRole("article")
    .filter({ hasText: "Lavender Bloom" })
    .getByRole("link", { name: "Edit this dress" })
    .click();
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Lavender Bloom",
  );
  await expect(
    page.getByTestId("garment-viewport").locator("canvas"),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Lavender Bloom",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});

test("sample dress GLBs contain textures, render in the viewer and can be downloaded", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/modeling?look=royal-ruby");
  await expect(
    page.getByRole("button", { name: "Generate with Meshy", exact: true }),
  ).toBeDisabled();
  for (const look of ["royal-ruby", "lavender-bloom", "ivory-blouse"]) {
    await page.getByLabel("Editable sample dress").selectOption(look);
    await page.getByRole("button", { name: "Preview sample in 3D" }).click();
    await expect(page.getByRole("status")).toContainText(
      "Editable sample preview loaded",
      { timeout: 30000 },
    );
    await expect(
      page.getByRole("button", { name: "Download GLB" }),
    ).toBeEnabled();
    await page.getByRole("checkbox", { name: "Wireframe" }).check();
    await page.getByRole("checkbox", { name: "Wireframe" }).uncheck();
  }
  const sampleDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download GLB" }).click();
  const saved = await sampleDownload;
  expect(saved.suggestedFilename()).toBe("sample-ivory-blouse.glb");
  await page.locator("#model-import").setInputFiles({name:saved.suggestedFilename(),mimeType:"model/gltf-binary",buffer:await fs.readFile((await saved.path())!)});
  await expect(page.getByRole("status")).toContainText(
    "sample-ivory-blouse.glb loaded",
    { timeout: 30000 },
  );
  await page.screenshot({
    path: `test-results/modeling-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
