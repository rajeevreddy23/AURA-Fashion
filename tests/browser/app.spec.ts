import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
const draftKey = "aura-design-v1:guest";
async function saved(page: any) {
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  return page.evaluate(
    (key: string) => JSON.parse(localStorage.getItem(key) || "null"),
    draftKey,
  );
}
async function overflow(page: any) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}
test("editor autosaves, undoes and redoes; accessible detail movement and synchronized 3D work", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/sketch");
  await expect(page.getByTestId("preview-3d")).toHaveAttribute(
    "data-texture-ready",
    "true",
  );
  const before = await page.getByTestId("preview-3d").screenshot();
  await page.getByRole("button", { name: "Add ★", exact: true }).click();
  await expect(page.locator("[data-layer]")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("[data-layer]")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator("[data-layer]")).toHaveCount(1);
  await page.locator("[data-layer]").click();
  await page.getByTestId("drawing-surface").focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(async () => (await saved(page)).layers[0].x).toBe(261);
  await page.getByLabel("Design name").fill("My celebration shirt");
  await saved(page);
  await page.reload();
  await expect(page.getByLabel("Design name")).toHaveValue(
    "My celebration shirt",
  );
  await expect(page.locator("[data-layer]")).toHaveCount(1);
  await expect(page.getByTestId("preview-3d")).toHaveAttribute(
    "data-texture-ready",
    "true",
  );
  const after = await page.getByTestId("preview-3d").screenshot();
  expect(after.equals(before)).toBe(false);
  await overflow(page);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/studio-${info.project.name}.png`,
    fullPage: true,
  });
});
test("pointer drawing is one undo action; touch drag works at scaled canvas coordinates", async ({
  page,
}, info) => {
  await page.goto("/sketch");
  await page.getByRole("button", { name: "Pen", exact: true }).click();
  await page.getByTestId("drawing-surface").scrollIntoViewIfNeeded();
  const box = (await page.getByTestId("drawing-surface").boundingBox())!;
  const x = box.x + box.width * 0.4,
    y = box.y + box.height * 0.4;
  if (info.project.use.hasTouch) {
    const c = await page.context().newCDPSession(page);
    await c.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await c.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 30, y: y + 30 }],
    });
    await c.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await c.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 30, y + 30, { steps: 5 });
    await page.mouse.up();
  }
  await expect(page.locator("[data-layer]")).toHaveCount(1);
  const d = await saved(page);
  expect(d.layers[0].points.length).toBeGreaterThan(2);
  expect(d.layers[0].points[0].x).toBeCloseTo(240, 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator("[data-layer]")).toHaveCount(0);
});
test("advanced design export, import validation and unsupported 3D state are honest", async ({
  page,
}) => {
  await page.goto("/sketch");
  await page.getByRole("button", { name: "Add ♥", exact: true }).click();
  await page
    .getByRole("button", { name: "+ Advanced tools", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save design file", exact: true })
    .click();
  const file = await downloadPromise;
  const parsed = JSON.parse(await fs.readFile((await file.path())!, "utf8"));
  expect(parsed.layers[0].text).toBe("♥");
  await page.locator('input[accept="application/json,.json"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole("alert")).toContainText(
    "not a supported AURA design file",
  );
  await expect(page.locator("[data-layer]")).toHaveCount(1);
  await page.getByRole("button", { name: "Saree panel", exact: true }).click();
  await expect(
    page.getByText("3D is not supported for the saree panel.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("preview-3d")).toHaveCount(0);
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PNG", exact: true }).click();
  expect((await pngDownload).suggestedFilename()).toBe("aura-design.png");
  await overflow(page);
});
test("main pages fit the screen and unavailable payments cannot be activated", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "/",
    "/shopping",
    "/designs",
    "/tryon",
    "/subscription",
    "/boutique",
    "/profile",
    "/cart",
    "/login",
    "/product/m1",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await overflow(page);
    if (path === "/subscription") {
      await expect(
        page.getByRole("button", { name: "Buy one upload", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Buy publishing pass", exact: true }),
      ).toBeDisabled();
    }
    if (path === "/shopping") {
      await expect(
        page.getByRole("button", { name: "Try-on unavailable" }).first(),
      ).toBeDisabled();
      await page
        .getByLabel("Search", { exact: true })
        .fill("nonexistent-garment");
      await expect(page.getByText("No designs here yet")).toBeVisible();
    }
  }
  expect(errors).toEqual([]);
});

test("details support native drop and touch or mouse dragging", async ({
  page,
}, info) => {
  await page.goto("/sketch");
  const surface = page.getByTestId("drawing-surface");
  const detail = page.getByRole("button", { name: "Add ◆", exact: true });
  if (info.project.use.hasTouch) await detail.tap();
  else await detail.dragTo(surface, { targetPosition: { x: 260, y: 260 } });
  await expect(page.locator("[data-layer]")).toHaveCount(1);
  await surface.scrollIntoViewIfNeeded();
  const before = await saved(page);
  const layer = before.layers[0];
  const box = (await surface.boundingBox())!;
  const x = box.x + ((layer.x + 50) * box.width) / 600,
    y = box.y + ((layer.y + 50) * box.height) / 600;
  if (info.project.use.hasTouch) {
    const c = await page.context().newCDPSession(page);
    await c.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await c.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 20, y: y + 15 }],
    });
    await c.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await c.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y + 15, { steps: 4 });
    await page.mouse.up();
  }
  await expect
    .poll(async () => (await saved(page)).layers[0].x)
    .toBeGreaterThan(layer.x + 5);
});
