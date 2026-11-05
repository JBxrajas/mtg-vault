import { expect, test } from "@playwright/test";
import { commanderDeck, mockApi } from "./support";

test("the guided deck shows the commander and its printings as pictures that fit the screen", async ({ page }, info) => {
  await mockApi(page, commanderDeck());
  await page.goto("/#/decks");
  await page.getByText("New Commander deck (guided)").click();
  await page.getByLabel("Name your new deck").fill("Tea time");
  await page.getByRole("button", { name: "Next: choose the commander" }).click();

  await page.getByLabel("Search for your commander").fill("iroh");
  await page.getByRole("button", { name: /Iroh, Grand Lotus/ }).click();

  const big = page.locator(".chooser-big");
  await expect(big).toBeVisible();
  const box = (await big.boundingBox())!;
  const width = info.project.name === "phone" ? 390 : 1280;
  expect(box.width).toBeGreaterThan(200);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);

  // One thumbnail per printing, and the chosen one is marked.
  const strip = page.locator(".strip-item");
  await expect(strip).toHaveCount(3);
  await strip.nth(1).click();
  await expect(strip.nth(1)).toHaveAttribute("aria-pressed", "true");

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Use Iroh, Grand Lotus as commander" }).click();
  await expect(page.getByRole("region", { name: "Your commander" }).locator("img")).toBeVisible();
});
