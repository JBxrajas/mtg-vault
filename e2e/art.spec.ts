import { expect, test } from "@playwright/test";
import { commanderDeck, mockApi, mockScryfall } from "./support";

test.beforeEach(async ({ page }) => {
  await mockApi(page, commanderDeck());
  await mockScryfall(page);
});

test("a stack opens its high-resolution art in another window, with the artist", async ({ page, context }, info) => {
  await page.goto("/#/collection");
  const link = page.locator(".stack", { hasText: "Lightning Bolt" }).getByRole("link", { name: /high-resolution art/i });
  const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
  await popup.waitForLoadState();

  await expect(popup.getByRole("heading", { name: "High-resolution art" })).toBeVisible();
  await expect(popup.getByText("Christopher Moeller", { exact: true })).toBeVisible();
  await expect(popup.getByRole("link", { name: /More art by Christopher Moeller/ })).toBeVisible();
  const art = popup.getByAltText("Lightning Bolt");
  await expect(art).toBeVisible();
  const box = (await art.boundingBox())!;
  const width = info.project.name === "phone" ? 390 : 1280;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(await popup.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await popup.getByRole("button", { name: "Full card" }).click();
  await expect(popup.getByText(/745 × 1040/)).toBeVisible();
});

test("the art view shows a gallery that fits the screen and follows the filters", async ({ page }, info) => {
  await page.goto("/#/collection");
  await page.getByRole("button", { name: "Art", exact: true }).click();
  const tiles = page.locator(".art-gallery li");
  await expect(tiles).toHaveCount(3);
  await expect(page.locator(".stacks")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByLabel("Search your collection").fill("sol");
  await expect(tiles).toHaveCount(1);
  const box = (await tiles.first().boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(info.project.name === "phone" ? 390 : 1280);
});

test("prices can be shown in Mexican pesos with a rate the user sets", async ({ page }) => {
  await page.goto("/#/collection");
  await expect(page.locator(".stack").first()).toContainText("$");
  await page.getByRole("button", { name: "Mexican pesos" }).click();
  await expect(page.locator(".stack").first()).toContainText("MX$");
  const rate = page.getByRole("spinbutton", { name: /1 USD =/ });
  await rate.fill("20");
  await expect(page.locator(".stack").first()).toContainText("MX$100.00 each"); // $5 × 20
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
