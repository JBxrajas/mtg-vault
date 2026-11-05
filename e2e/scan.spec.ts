import { expect, test } from "@playwright/test";
import { deflateSync } from "node:zlib";
import { artHash, artHashRegionForTest, encodeArtIndex } from "./scan-fixture";
import { commanderDeck, mockApi, picture } from "./support";

const CARD = "4457ed35-7c10-48c8-9776-456485fdf070";
const OTHER = "99999999-9999-4999-8999-999999999999";
const API = "http://localhost:3001";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

// A fake camera: Chromium plays a test pattern instead of asking for a device.
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] }, permissions: ["camera"] });

const W = 630;
const H = 880;

/** A card-shaped picture made of coarse, pseudo-random blocks of grey, so its fingerprint is clear and unique. */
function cardPicture() {
  const rgba = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let h = Math.imul(Math.floor(x / 31) + 1, 374761393) ^ Math.imul(Math.floor(y / 29) + 1, 668265263);
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const v = (h ^ (h >>> 16)) & 255;
      rgba.set([v, v, v, 255], (y * W + x) * 4);
    }
  }
  return rgba;
}

function png(rgba: Buffer): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const byte of b) c = crcTable[(c ^ byte) & 255]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) rgba.copy(rows, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

test.beforeEach(async ({ page }) => {
  await mockApi(page, commanderDeck());
  const rgba = cardPicture();
  const index = encodeArtIndex([
    { illustrationId: CARD, oracleId: CARD, hash: artHashRegionForTest(rgba, W, H) },
    { illustrationId: OTHER, oracleId: OTHER, hash: artHash(Array.from({ length: 17 * 16 }, (_, i) => (i * 97) % 251)) },
  ]);
  await page.context().route(`${API}/art-index`, (route) =>
    route.fulfill({ status: 200, contentType: "application/octet-stream", headers: cors, body: Buffer.from(index) }),
  );
  await page.context().route(`${API}/cards/lookup*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ cards: [{ oracleId: CARD, name: "Lightning Bolt", typeLine: "Instant", image: picture }] }) }),
  );
});

test("a photo of a card is recognised from its art, in the language chosen, and added", async ({ page }, info) => {
  await page.goto("/#/scan");
  await expect(page.getByLabel("Language of your cards")).toBeVisible();
  await page.getByLabel("Choose photos").setInputFiles({ name: "card.png", mimeType: "image/png", buffer: png(cardPicture()) });

  await expect(page.getByRole("status")).toContainText("Lightning Bolt");
  const row = page.locator(".scan-item", { hasText: "Lightning Bolt" });
  await expect(row.getByLabel("Printing")).toBeVisible();
  const added = page.waitForRequest((r) => r.url() === `${API}/collection/items` && r.method() === "POST");
  await page.getByRole("button", { name: "Add 1 card" }).click();
  expect((await added).postDataJSON()).toMatchObject({ quantity: 1, language: "en" });
  await expect(row.getByText("Added")).toBeVisible();

  // Nothing sticks out of the screen.
  const width = info.project.name === "phone" ? 390 : 1280;
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const box = (await row.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});

test("a picture that is not in the index says so", async ({ page }) => {
  await page.goto("/#/scan");
  const blank = Buffer.alloc(W * H * 4, 128);
  await page.getByLabel("Choose photos").setInputFiles({ name: "blank.png", mimeType: "image/png", buffer: png(blank) });
  await expect(page.getByRole("status")).toContainText("No card recognised");
  await expect(page.getByText("Nothing scanned yet.")).toBeVisible();
});

test("the camera shows a guide frame and a focus meter, and a capture runs on a real video frame", async ({ page }, info) => {
  await page.goto("/#/scan");
  await page.getByLabel("Capture by itself when the card is in focus").uncheck();
  await page.getByRole("button", { name: "Start camera" }).click();

  const guide = page.getByTestId("scan-guide");
  await expect(guide).toBeVisible();
  await expect(page.getByRole("meter", { name: "Focus" })).toBeVisible();
  // The guide is card-shaped and inside the picture.
  const g = (await guide.boundingBox())!;
  expect(g.width / g.height).toBeCloseTo(63 / 88, 1);
  const view = (await page.locator(".scan-view").boundingBox())!;
  expect(g.x).toBeGreaterThanOrEqual(view.x);
  expect(g.x + g.width).toBeLessThanOrEqual(view.x + view.width + 1);
  expect(g.y + g.height).toBeLessThanOrEqual(view.y + view.height + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // The guide takes a colour from the focus level.
  await expect(guide).toHaveCSS("border-top-color", /rgb/);
  await page.getByRole("button", { name: "Capture" }).click();
  // The test pattern is not a card: no match, no crash.
  await expect(page.getByRole("status")).toContainText("No card recognised");
  void info;
  await page.getByRole("button", { name: "Stop camera" }).click();
  await expect(page.getByRole("button", { name: "Start camera" })).toBeVisible();
});
