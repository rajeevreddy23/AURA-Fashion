import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function fits(page: any) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    )
    .toBe(true);
}
test("reference workspace navigation and live colorway trays work", async ({
  page,
}, info) => {
  if (info.project.name === "desktop")
    await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/studio");
  await expect(page.getByLabel("Advanced project name")).toHaveValue(
    "Royal bridal lehenga",
  );
  await expect(
    page.getByTestId("garment-viewport").locator("canvas"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "3D Fashion Design Studio" }),
  ).toBeVisible();
  await fits(page);
  await page.screenshot({
    path: `test-results/reference-studio-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Fabrics & Materials", exact: true })
    .click();
  await expect(page.getByLabel("Advanced fabric color")).toBeVisible();
  await page
    .getByRole("button", { name: "Apply Emerald velvet", exact: true })
    .click();
  await expect(page.getByLabel("Advanced fabric color")).toHaveValue("#075b4b");
  if (!info.project.use.hasTouch) {
    await page
      .getByRole("button", { name: "Use Royal ruby colorway", exact: true })
      .click();
    await expect(page.getByLabel("Advanced fabric color")).toHaveValue(
      "#9f1839",
    );
  }
  await page.getByRole("link", { name: "Costing & BOM", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export BOM CSV", exact: true }),
  ).toBeVisible();
  await fits(page);
});
test("mobile companion landing page searches the real collection", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Get started", exact: true }),
  ).toBeVisible();
  await fits(page);
  await expect
    .poll(() =>
      page
        .locator(".aura-home img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: `test-results/reference-home-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Search dresses and designs", exact: true })
    .fill("Royal Silk Saree");
  await page
    .getByRole("textbox", { name: "Search dresses and designs", exact: true })
    .press("Enter");
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue(
    "Royal Silk Saree",
  );
  await expect(page.locator(".product-card")).toHaveCount(1);
  await expect(page.locator(".product-card")).toContainText("Royal Silk Saree");
  await fits(page);
});
test("photo-first try-on permits preview and removal without enabling an unconfigured charge", async ({
  page,
}, info) => {
  await page.goto("/tryon?product=w4");
  await expect(
    page.getByRole("heading", { name: "Upload your photo", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Your try-on photo", { exact: true }).setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(
    page.getByAltText("Your selected photo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", { name: /^Pay .* for one try-on$/ }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(
    page.getByAltText("Your selected photo", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(
    await page.evaluate(() => sessionStorage.getItem("aura-tryon-handoff-v1")),
  ).toBeNull();
  await fits(page);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/reference-tryon-${info.project.name}.png`,
    fullPage: true,
  });
});
