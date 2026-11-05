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
