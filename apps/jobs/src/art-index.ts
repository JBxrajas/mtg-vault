import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import sharp from "sharp";
import { artHash, decodeArtIndex, encodeArtIndex, HASH_HEIGHT, HASH_WIDTH, type ArtIndexEntry } from "@mtg-vault/shared";
import { artSources, type ArtSource, type ScryfallArtCard } from "./art-faces.js";
import { downloadBulk, HEADERS } from "./bulk.js";

const BULK_TYPE = "default_cards";
const DIR = process.env.DATA_DIR ?? "data";
const OUT = process.env.OUT ?? `${DIR}/art-index.bin`;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);
/** Stop after this many new illustrations; for testing only. */
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
/** Fail the job when more than this share of the downloads fails, so a bad run never replaces a good index. */
const MAX_FAILURE_RATE = 0.02;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same shrinking the browser must reproduce: grey, 17×16, stretched to fit. */
async function fingerprint(image: Buffer): Promise<Uint8Array> {
  const pixels = await sharp(image).grayscale().resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill" }).raw().toBuffer();
  return artHash(pixels);
}

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    let retry = true;
    try {
      const res = await fetch(url, { headers: { ...HEADERS, Accept: "image/*" } });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      retry = res.status === 429 || res.status >= 500;
      throw new Error(`${url}: ${res.status}`);
    } catch (e) {
      if (!retry || attempt >= 4) throw e;
      await sleep(500 * 2 ** attempt);
    }
  }
}

/** Every illustration of every paper printing, first printing wins. */
async function readSources(file: string): Promise<Map<string, ArtSource>> {
  const found = new Map<string, ArtSource>();
  const lines = createInterface({ input: createReadStream(file).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim() || line === "[" || line === "]") continue;
    for (const source of artSources(JSON.parse(line.replace(/,$/, "")) as ScryfallArtCard)) {
      if (!found.has(source.illustrationId)) found.set(source.illustrationId, source);
    }
  }
  return found;
}

async function loadPrevious(path: string): Promise<Map<string, ArtIndexEntry>> {
  try {
    return new Map(decodeArtIndex(await readFile(path)).map((e) => [e.illustrationId, e]));
  } catch {
    return new Map();
  }
}

await mkdir(dirname(OUT), { recursive: true });
const file = `${DIR}/${BULK_TYPE}.jsonl.gz`;
if (!process.env.SKIP_DOWNLOAD) await downloadBulk(BULK_TYPE, file);

const sources = await readSources(file);
const previous = await loadPrevious(OUT);
const entries = new Map<string, ArtIndexEntry>();
const todo: ArtSource[] = [];
for (const s of sources.values()) {
  const old = previous.get(s.illustrationId);
  if (old && old.oracleId === s.oracleId) entries.set(s.illustrationId, old);
  else todo.push(s);
}
const batch = todo.slice(0, LIMIT);
console.log(`illustrations: ${sources.size}, already indexed: ${entries.size}, to fingerprint: ${batch.length}`);

let next = 0;
let failed = 0;
async function worker() {
  while (next < batch.length) {
    const s = batch[next++]!;
    try {
      entries.set(s.illustrationId, { illustrationId: s.illustrationId, oracleId: s.oracleId, hash: await fingerprint(await download(s.url)) });
    } catch (e) {
      failed++;
      console.warn(`skipped ${s.illustrationId}: ${e instanceof Error ? e.message : e}`);
    }
    if (next % 1000 === 0) console.log(`  ${next}/${batch.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

if (batch.length && failed / batch.length > MAX_FAILURE_RATE) {
  throw new Error(`${failed} of ${batch.length} downloads failed; keeping the previous index`);
}
const sorted = [...entries.values()].sort((a, b) => a.illustrationId.localeCompare(b.illustrationId));
const bytes = encodeArtIndex(sorted);
await writeFile(`${OUT}.tmp`, bytes);
await rename(`${OUT}.tmp`, OUT);
console.log(`wrote ${OUT}: ${sorted.length} entries, ${(bytes.length / 1e6).toFixed(2)} MB, ${failed} failed`);
