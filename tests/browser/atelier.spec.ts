import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
async function open(page: any) {
  await page.goto("/studio");
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Royal bridal lehenga",
  );
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="garment-viewport"] canvas'),
  ).toBeVisible();
}
async function section(page: any, name: string) {
  await page.getByRole("button", { name, exact: true }).first().click();
}
async function overflow(page: any) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
}
test("measured components persist, undo, lock and change the assembled garment", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const before = await page.getByTestId("garment-viewport").screenshot();
  await page
    .locator(".component-name")
    .filter({ hasText: "Lehenga panel" })
    .click();
  await page
    .getByRole("spinbutton", { name: "Top width", exact: true })
    .fill("12");
  await expect(
    page.getByRole("spinbutton", { name: "Top width", exact: true }),
  ).toHaveValue("12");
  await page
    .getByRole("button", { name: "Advanced undo", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Top width", exact: true }),
  ).toHaveValue("10");
  await page
    .getByRole("button", { name: "Advanced redo", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Top width", exact: true }),
  ).toHaveValue("12");
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  const after = await page.getByTestId("garment-viewport").screenshot();
  expect(before.equals(after)).toBe(false);
  await page
    .getByRole("button", { name: "Lock Lehenga panel", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Top width", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Unlock Lehenga panel", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Top width", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".component-name")
    .filter({ hasText: "Lehenga panel" })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Top width", exact: true }),
  ).toHaveValue("12");
  await overflow(page);
  expect(errors).toEqual([]);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/atelier-${info.project.name}.png`,
    fullPage: true,
  });
});
test("fabric, revisions, editable exports and unsafe import rejection work without an API", async ({
  page,
}) => {
  await open(page);
  await section(page, "Fabrics");
  await page
    .getByRole("button", { name: "Apply Emerald velvet", exact: true })
    .click();
  await expect(page.getByLabel("Advanced fabric color")).toHaveValue("#075b4b");
  await section(page, "Versions");
  await page
    .getByLabel("Version name", { exact: true })
    .fill("Emerald original");
  await page
    .getByRole("button", { name: "Save named version", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Version saved");
  await page.getByLabel("Advanced project name").fill("Changed version");
  await page
    .getByRole("button", { name: "Restore version", exact: true })
    .click();
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Royal bridal lehenga",
  );
  const exported = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project", exact: true })
    .click();
  const download = await exported;
  const data = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(data.version).toBe(2);
  expect(data.materials[0].color).toBe("#075b4b");
  expect(data.pieces.length).toBe(6);
  await page
    .locator('input[aria-label="Import advanced AURA project"]')
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"version":999,"name":"<script>bad</script>"}'),
    });
  await expect(page.getByRole("alert")).toContainText(
    "not a supported AURA project",
  );
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Royal bridal lehenga",
  );
  await overflow(page);
});
test("costing, trims, cloth controls and printable tech pack use the current project", async ({
  page,
}) => {
  await open(page);
  await section(page, "Trims & details");
  await page.getByRole("button", { name: "Add detail", exact: true }).click();
  await expect(page.getByLabel("Detail name", { exact: true })).toHaveValue(
    "Decorative border",
  );
  await section(page, "Costing & BOM");
  await page
    .getByRole("spinbutton", { name: "Labour estimate", exact: true })
    .fill("2450");
  const csvPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export BOM CSV", exact: true })
    .click();
  const csv = await csvPromise;
  expect(await fs.readFile((await csv.path())!, "utf8")).toContain("2450");
  await section(page, "Cloth preview");
  await page
    .getByRole("button", { name: "Run cloth preview", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause cloth preview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pause cloth preview", exact: true })
    .click();
  await section(page, "Tech pack");
  await expect(page.locator("#aura-techpack")).toContainText(
    "Royal bridal lehenga",
  );
  await expect(page.locator("#aura-techpack")).toContainText(
    "Decorative border",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#aura-techpack")).toBeVisible();
  await expect(page.getByTestId("garment-viewport")).not.toBeVisible();
  await page.emulateMedia({ media: "screen" });
});
test("advanced workspace has no serious or critical automated accessibility issues", async ({
  page,
}) => {
  await open(page);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    r.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
    JSON.stringify(
      r.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  ).toEqual([]);
});

test("patterns support touch or mouse placement, keyboard movement and measured export", async ({
  page,
}, info) => {
  await open(page);
  await page.getByRole("button", { name: "2D pattern", exact: true }).click();
  const pattern = page.getByRole("button", { name: /^Blouse front pattern/ });
  await pattern.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await section(page, "Components");
  await expect(
    page.getByRole("spinbutton", { name: "Sheet X", exact: true }),
  ).toHaveValue("18");
  await page
    .getByRole("button", { name: "Advanced undo", exact: true })
    .click();
  await expect(
    page.getByRole("spinbutton", { name: "Sheet X", exact: true }),
  ).toHaveValue("8");
  await pattern.scrollIntoViewIfNeeded();
  const box = (await pattern.boundingBox())!;
  const x = box.x + box.width * 0.5,
    y = box.y + box.height * 0.65;
  if (info.project.use.hasTouch) {
    const c = await page.context().newCDPSession(page);
    await c.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await c.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 18, y: y + 10 }],
    });
    await c.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await c.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 18, y + 10, { steps: 5 });
    await page.mouse.up();
  }
  await section(page, "Components");
  await expect
    .poll(async () =>
      Number(
        await page
          .getByRole("spinbutton", { name: "Sheet X", exact: true })
          .inputValue(),
      ),
    )
    .toBeGreaterThan(8);
  const output = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export selected pattern", exact: true })
    .click();
  const text = await fs.readFile((await (await output).path())!, "utf8");
  expect(text).toContain('mm"');
  expect(text).toContain("Blouse front");
  await overflow(page);
});

test("project switching retains work and external services stay disabled without setup", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("Advanced project name").fill("My retained design");
  await section(page, "My designs");
  await page
    .getByRole("combobox", { name: "Start from", exact: true })
    .selectOption("blouse");
  await page
    .getByRole("button", { name: "Create new project", exact: true })
    .click();
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Signature blouse",
  );
  const previous = page
    .locator(".project-library-card")
    .filter({ hasText: "My retained design" });
  await previous
    .getByRole("button", { name: "Open project", exact: true })
    .click();
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "My retained design",
  );
  await section(page, "AI & services");
  await expect(
    page.getByRole("button", { name: /^Render this 3D concept/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", {
      name: "Publish using one upload entitlement",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("link", {
      name: "Manage uploads & access requests",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Designs with a story." }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^My uploads/ }).click();
  await expect(
    page.getByText("Your uploaded designs will appear here"),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Access requests/ }).click();
  await expect(page.getByText("No access requests yet")).toBeVisible();
  await overflow(page);
});

test("a storage failure preserves the open design and permits a recovery export", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    indexedDB.open = () => {
      throw new DOMException("Storage is full", "QuotaExceededError");
    };
  });
  await page.getByLabel("Advanced project name").fill("Recover this design");
  await expect(
    page.getByText("Save failed — export a backup", { exact: true }),
  ).toBeVisible();
  const output = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export project", exact: true })
    .click();
  const project = JSON.parse(
    await fs.readFile((await (await output).path())!, "utf8"),
  );
  expect(project.name).toBe("Recover this design");
  expect(project.pieces).toHaveLength(6);
});
