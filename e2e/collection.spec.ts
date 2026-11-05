import { expect, test } from "@playwright/test";
import { commanderDeck, mockApi } from "./support";

test("a card in the collection can be enlarged, by hover on a computer and by button on a phone", async ({ page }, info) => {
  await mockApi(page, commanderDeck());
  await page.goto("/#/collection");
  const row = page.locator(".stack", { hasText: "Lightning Bolt" });
  await expect(row).toBeVisible();
  const enlarge = row.getByRole("button", { name: "Enlarge Lightning Bolt" });

  if (info.project.name === "phone") {
    await expect(enlarge).toBeVisible();
    await enlarge.click();
    await expect(page.getByRole("dialog", { name: "Lightning Bolt" }).locator("img")).toBeVisible();
  } else {
    await row.locator(".thumb-wrap > img").hover();
    const floating = page.locator(".floating-preview");
    await expect(floating).toBeVisible();
    const box = (await floating.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    await enlarge.click();
    await expect(page.getByRole("dialog", { name: "Lightning Bolt" })).toBeVisible();
    await expect(floating).toBeHidden();
  }
});

test("the search and the filters narrow the list in the browser, and fit the screen", async ({ page }, info) => {
  await mockApi(page, commanderDeck());
  await page.goto("/#/collection");
  await expect(page.locator(".stack")).toHaveCount(3);

  await page.getByLabel("Search your collection").fill("llan");
  await expect(page.locator(".stack")).toHaveCount(1);
  await page.getByLabel("Search your collection").fill("");
  await expect(page.locator(".stack")).toHaveCount(3);

  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.locator(".filter-panel")).toBeVisible();
  await page.getByRole("button", { name: "Colorless", exact: true }).click();
  await expect(page.locator(".stack")).toHaveCount(1);
  await expect(page.locator(".stack")).toContainText("Sol Ring");

  // Nothing sticks out of the window, and the toggles are big enough to tap.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = (await page.getByRole("button", { name: "Colorless", exact: true }).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(36);
  if (info.project.name === "phone") expect(box.x + box.width).toBeLessThanOrEqual(390);

  // What is on can be turned off from its own chip, and the quick type chips are in view without opening anything.
  await page.getByRole("button", { name: "Remove filter: Colorless" }).click();
  await expect(page.locator(".stack")).toHaveCount(3);
  await page.getByRole("group", { name: "Type" }).getByRole("button", { name: /^Artifact/ }).click();
  await expect(page.locator(".stack")).toHaveCount(1);
});
