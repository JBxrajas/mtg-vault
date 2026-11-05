import { expect, test, type Page } from "@playwright/test";
import { card, commanderDeck, mockApi, mockScryfall } from "./support";

// A phone is narrow and Spanish text is longer, so this is where things stick out. Each screen must fit the window.
const WIDTHS = [360, 390];
const LANGUAGES = ["en", "es"] as const;

async function fits(page: Page) {
  return page.evaluate(() => {
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && !el.closest("[hidden]"))
      .filter((el) => getComputedStyle(el).position !== "fixed" && !el.closest(".printing-strip, .tabs, .quick, .curve, pre"))
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`.slice(0, 60));
    return { scrolls: document.documentElement.scrollWidth > window.innerWidth, wide };
  });
}

for (const language of LANGUAGES) {
  for (const width of WIDTHS) {
    test.describe(`${language} at ${width} px`, () => {
      test.beforeEach(async ({ page }, info) => {
        test.skip(info.project.name !== "phone", "sets its own phone widths");
        await page.setViewportSize({ width, height: 800 });
        await page.addInitScript((l) => localStorage.setItem("mtg-vault.locale", l), language);
      });

      test("deck with a commander", async ({ page }) => {
        await mockApi(page, commanderDeck());
        await page.goto("/#/decks/d1");
        await expect(page.locator(".commander-bar")).toBeVisible();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });

      test("deck without a commander: the chooser, with a card picked", async ({ page }) => {
        const bare = commanderDeck();
        bare.cards = [card({ oracleId: "x", name: "Sol Ring" })];
        await mockApi(page, bare);
        await page.goto("/#/decks/d1");
        await page.locator(".commander-setup input[type=search]").fill("iroh");
        await page.locator(".chooser-card").first().click();
        await expect(page.locator(".chooser-big")).toBeVisible();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });

      test("collection with the filters open", async ({ page }) => {
        await mockApi(page, commanderDeck());
        await page.goto("/#/collection");
        await page.locator(".filters-toggle").click();
        await page.locator(".chips.mv .chip").nth(2).click();
        await expect(page.locator(".filter-panel")).toBeVisible();
        await expect(page.locator(".active-filters")).toBeVisible();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });

      test("collection: pesos, art view and an open filter panel", async ({ page }) => {
        await mockApi(page, commanderDeck());
        await page.goto("/#/collection");
        await page.locator(".currency .chip").nth(1).click();
        await page.locator(".segmented button", { hasText: /^(Art|Arte)$/ }).click();
        await expect(page.locator(".art-gallery")).toBeVisible();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });

      test("the art page", async ({ page }) => {
        await mockApi(page, commanderDeck());
        await mockScryfall(page);
        await page.goto("/#/art/bba5ea18-4e58-42a8-b613-2178706476a6");
        await expect(page.locator(".art-figure img")).toBeVisible();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });

      test("deck tools open", async ({ page }) => {
        await mockApi(page, commanderDeck());
        await page.goto("/#/decks/d1");
        await page.locator(".import > summary").first().click();
        await expect(page.locator(".decklist textarea").first()).toBeVisible();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });

      test("decks page with the guided start open at every step", async ({ page }) => {
        await mockApi(page, commanderDeck());
        await page.goto("/#/decks");
        await page.locator(".wizard > summary").click();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
        await page.locator(".wizard-step input").fill("Tea time");
        await page.locator(".wizard-step button[type=submit]").click();
        await page.locator(".chooser input[type=search]").fill("iroh");
        await page.locator(".chooser-card").first().click();
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
        await page.locator(".chooser-picked .btn-primary").click();
        await page.locator(".wizard input[type=file]").evaluate((el) => ((el as HTMLElement).style.width = "900px")); // a Spanish browser's file picker is this wide
        expect(await fits(page)).toEqual({ scrolls: false, wide: [] });
      });
    });
  }
}
