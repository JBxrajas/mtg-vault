/**
 * Measures how well the scanner recognises cards, with simulated camera shots of real card images.
 *
 *   pnpm --filter @mtg-vault/jobs scan-eval
 *
 * It downloads some random cards from Scryfall (once, cached in `DATA_DIR/eval`), places each card on a
 * textured table in a 1280×720 frame the way a hand would (scale, offset, tilt), spoils the picture one
 * factor at a time (blur, light, noise, glare, a sleeve's haze) and runs the scanner's own pipeline
 * against the published index. It is a simulation: it says which kind of shot breaks the matching,
 * it is not the recognition rate on a real phone.
 *
 * Env: `INDEX` (default `data/art-index.bin`), `CARDS` (default 250), `SEED`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { decodeArtIndex, type ArtIndexEntry } from "@mtg-vault/shared";
import { HEADERS } from "./bulk.js";
import { recognise, recogniseSearch, type Recogniser } from "./scan-recognise.js";

const DIR = process.env.DATA_DIR ?? "data";
const INDEX = process.env.INDEX ?? `${DIR}/art-index.bin`;
const COUNT = Number(process.env.CARDS ?? 250);
const SEED = Number(process.env.SEED ?? 7);
const W = 1280;
const H = 720;
const CARD_ASPECT = 63 / 88;

interface Sample {
  oracleId: string;
  name: string;
  file: string;
}

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (lo: number, hi: number) => lo + (hi - lo) * next();
  const normal = (sd: number) => sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
  return { next, between, normal };
}
type Random = ReturnType<typeof rng>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadSamples(): Promise<Sample[]> {
  await mkdir(`${DIR}/eval`, { recursive: true });
  const listFile = `${DIR}/eval/cards.json`;
  let samples: Sample[] = [];
  try {
    samples = JSON.parse(await readFile(listFile, "utf8"));
  } catch {
    /* first run */
  }
  const seen = new Set(samples.map((s) => s.oracleId));
  while (samples.length < COUNT) {
    const res = await fetch("https://api.scryfall.com/cards/random?q=game%3Apaper+-is%3Adigital+layout%3Anormal+-is%3Aborderless+-is%3Afullart+-is%3Aextendedart", { headers: HEADERS });
    await sleep(120);
    if (!res.ok) continue;
    const card = (await res.json()) as { oracle_id: string; name: string; image_uris?: { normal: string } };
    if (!card.image_uris || seen.has(card.oracle_id)) continue;
    const image = await fetch(card.image_uris.normal, { headers: { ...HEADERS, Accept: "image/*" } });
    await sleep(120);
    if (!image.ok) continue;
    const file = `${DIR}/eval/${card.oracle_id}.jpg`;
    await writeFile(file, Buffer.from(await image.arrayBuffer()));
    samples.push({ oracleId: card.oracle_id, name: card.name, file });
    seen.add(card.oracle_id);
    await writeFile(listFile, JSON.stringify(samples));
    if (samples.length % 25 === 0) console.log(`downloaded ${samples.length}/${COUNT}`);
  }
  return samples.slice(0, COUNT);
}

/** What goes wrong in a shot. Each condition turns some of these on. */
interface Factors {
  scale: number; // how much of the frame height the card takes (the guide asks for 0.82)
  offset: number; // 0 or 1: how far the card is from the centre of the guide, in standard deviations
  tilt: number; // 0 or 1: rotation and the card seen at an angle
  blur: number; // blur sigma
  light: number; // 0 or 1: darker / brighter / uneven
  noise: number; // grain sigma
  glare: boolean;
  haze: boolean; // a sleeve softening the contrast
}
const CLEAN: Factors = { scale: 0.82, offset: 0, tilt: 0, blur: 0, light: 0, noise: 0, glare: false, haze: false };
const ALL: Record<string, Partial<Factors>> = {
  "exact framing": {},
  "scale ±8%": { scale: -1 },
  "offset (~1.5%)": { offset: 1 },
  "tilt (~3°)": { tilt: 1 },
  "blur σ≈1.2": { blur: 1.2 },
  "light": { light: 1 },
  "grain": { noise: 8 },
  "glare": { glare: true },
  "sleeve haze": { haze: true },
  "typical shot": { scale: -1, offset: 1, tilt: 1, blur: 0.8, light: 1, noise: 5, haze: true },
  "hard shot": { scale: -1, offset: 2, tilt: 2, blur: 1.5, light: 1, noise: 8, glare: true, haze: true },
};

const ONLY = process.env.ONLY?.split(",");
const CONDITIONS = Object.fromEntries(Object.entries(ALL).filter(([k]) => !ONLY || ONLY.includes(k)));

async function shoot(cardFile: string, f: Factors, r: Random): Promise<{ data: Buffer; width: number; height: number }> {
  // A textured table: coarse random colour blotches, enlarged.
  const blotches = Buffer.from(Array.from({ length: 32 * 18 * 3 }, () => Math.floor(r.between(60, 190))));
  const table = await sharp(blotches, { raw: { width: 32, height: 18, channels: 3 } }).resize(W, H, { kernel: "cubic" }).png().toBuffer();

  const scale = f.scale === -1 ? r.between(0.74, 0.9) : f.scale;
  const cardH = Math.round(scale * H);
  const cardW = Math.round(cardH * CARD_ASPECT);
  const angle = f.tilt ? r.normal(2.2 * f.tilt) * (Math.PI / 180) : 0;
  const k = f.tilt ? 0.03 * f.tilt : 0;
  const a = [
    [Math.cos(angle) * (1 - Math.abs(r.normal(k))), -Math.sin(angle) + r.normal(k)],
    [Math.sin(angle) + r.normal(k), Math.cos(angle) * (1 - Math.abs(r.normal(k)))],
  ] as [[number, number], [number, number]];
  let card = sharp(cardFile).resize(cardW, cardH, { kernel: "lanczos3" }).ensureAlpha();
  if (f.tilt) card = sharp(await card.png().toBuffer()).affine(a, { background: { r: 0, g: 0, b: 0, alpha: 0 }, interpolator: "bicubic" });
  let cardBuf = await card.png().toBuffer();

  if (f.haze) cardBuf = await sharp(cardBuf).linear(0.78, 28).toBuffer();
  if (f.light) {
    const gain = r.between(0.6, 1.25);
    cardBuf = await sharp(cardBuf).modulate({ brightness: gain, saturation: r.between(0.7, 1.15) }).gamma(r.between(1, 1.6)).toBuffer();
  }
  if (f.glare) {
    const meta = await sharp(cardBuf).metadata();
    const cx = r.between(0.2, 0.8) * (meta.width ?? 1);
    const cy = r.between(0.2, 0.8) * (meta.height ?? 1);
    const rad = r.between(0.2, 0.45) * (meta.width ?? 1);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}"><defs><radialGradient id="g" cx="${cx}" cy="${cy}" r="${rad}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="white" stop-opacity="0.85"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
    cardBuf = await sharp(cardBuf).composite([{ input: Buffer.from(svg), blend: "over" }]).toBuffer();
  }

  const left = Math.round((W - cardW) / 2 + (f.offset ? r.normal(0.015 * W * f.offset) : 0));
  const top = Math.round((H - cardH) / 2 + (f.offset ? r.normal(0.02 * H * f.offset) : 0));
  const cardMeta = await sharp(cardBuf).metadata();
  const shot = sharp(table).composite([{ input: cardBuf, left: Math.max(0, Math.min(W - (cardMeta.width ?? 0), left)), top: Math.max(0, Math.min(H - (cardMeta.height ?? 0), top)) }]);
  let image = await shot.png().toBuffer();
  if (f.blur > 0) image = await sharp(image).blur(Math.max(0.3, f.blur * r.between(0.7, 1.3))).toBuffer();
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (f.noise > 0) {
    for (let i = 0; i < data.length; i += 4) {
      const n = r.normal(f.noise);
      data[i] = Math.max(0, Math.min(255, data[i]! + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + n));
    }
  }
  return { data, width: info.width, height: info.height };
}

async function main() {
  const index: ArtIndexEntry[] = decodeArtIndex(new Uint8Array(await readFile(INDEX)));
  console.log(`index: ${index.length} illustrations`);
  const samples = await loadSamples();
  const recogniser: Recogniser = process.env.VARIANT === "search" ? recogniseSearch : recognise;
  const rows: string[] = [];
  for (const [name, change] of Object.entries(CONDITIONS)) {
    const r = rng(SEED);
    const f: Factors = { ...CLEAN, ...change };
    let first = 0;
    let sureRight = 0;
    let sureWrong = 0;
    let none = 0;
    const correct: number[] = [];
    const calibration = (globalThis as { __cal?: Record<string, [number, number, boolean][]> });
    calibration.__cal ??= {};
    calibration.__cal[name] = [];
    const wrong: number[] = [];
    for (const s of samples) {
      const shot = await shoot(s.file, f, r);
      const found = recogniser(shot.data, shot.width, shot.height, index);
      if (found.confidence === "none" || !found.cards[0]) {
        none++;
        continue;
      }
      const ok = found.cards[0].oracleId === s.oracleId;
      calibration.__cal![name]!.push([found.cards[0].distance, found.gap ?? 999, ok]);
      if (ok) {
        first++;
        correct.push(found.cards[0].distance);
        if (found.confidence === "sure") sureRight++;
      } else {
        wrong.push(found.cards[0].distance);
        if (found.confidence === "sure") sureWrong++;
      }
    }
    const n = samples.length;
    const pct = (x: number) => `${((100 * x) / n).toFixed(0)}%`.padStart(4);
    const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : "-");
    rows.push(`${name.padEnd(16)} right ${pct(first)}  none ${pct(none)}  wrong ${pct(n - first - none)}  (sure+right ${pct(sureRight)}, sure+wrong ${pct(sureWrong)})  distance right ${med(correct)} / wrong ${med(wrong)}`);
    console.log(rows.at(-1));
    if (process.env.CAL) await writeFile(process.env.CAL, JSON.stringify((globalThis as { __cal?: unknown }).__cal));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
