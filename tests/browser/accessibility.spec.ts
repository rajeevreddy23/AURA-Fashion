import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
test("core creation and commerce pages have no serious automated accessibility violations", async ({
  page,
}) => {
  for (const path of [
    "/sketch",
    "/shopping",
    "/tryon",
    "/subscription",
    "/boutique",
  ]) {
    await page.goto(path);
    await expect(page.locator("h2").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact || ""),
      ),
      `${path}: ${JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
});
