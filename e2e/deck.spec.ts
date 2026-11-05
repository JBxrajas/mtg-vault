import { expect, test } from "@playwright/test";
import { commanderDeck, mockApi } from "./support";

test.beforeEach(async ({ page }) => {
  await mockApi(page, commanderDeck());
});

test("the page does not scroll sideways", async ({ page }) => {
  await page.goto("/#/decks/d1");
  await expect(page.getByRole("region", { name: "Deck commander" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("the commander bar stays in view below the top bar while the deck scrolls", async ({ page }) => {
  await page.goto("/#/decks/d1");
  const bar = page.getByRole("region", { name: "Deck commander" });
  await expect(bar).toBeVisible();

  await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);

  const topbar = await page.locator(".topbar").boundingBox();
  const box = await bar.boundingBox();
  expect(topbar && box).toBeTruthy();
  // Not hidden behind the top bar: it starts where the top bar ends (a pixel of rounding allowed)...
  expect(box!.y).toBeGreaterThanOrEqual(topbar!.y + topbar!.height - 1);
  expect(box!.y).toBeLessThan(topbar!.y + topbar!.height + 40);
  // ...and what is under its centre is the bar itself, not something drawn over it.
  const covered = await bar.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !el.contains(top);
  });
  expect(covered).toBe(false);
});

test("the commander bar is still there on the other board tabs", async ({ page }) => {
  await page.goto("/#/decks/d1");
  await page.getByRole("button", { name: /Sideboard/ }).click();
  await expect(page.getByRole("region", { name: "Deck commander" })).toContainText("Iroh, Grand Lotus");
});
