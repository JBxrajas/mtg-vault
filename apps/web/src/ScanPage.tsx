import { type ArtIndexEntry, type CardLookup, type PrintingSummary } from "@mtg-vault/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPrintings, lookupCards } from "./api";
import { fetchMe } from "./auth";
import { addToCollection } from "./collectionApi";
import { formatMoney, useCurrency } from "./currency";
import { addDeckCard, fetchDecks } from "./decksApi";
import { printingLabel } from "./format";
import { useI18n } from "./i18n";
import { ScanCamera } from "./ScanCamera";
import { loadArtIndex } from "./scan/artIndex";
import { matchPhoto } from "./scan/capture";
import { searchAroundGuide } from "./scan/search";
import { candidatesFromMatches, pickPrinting, scanPrice, type Candidates } from "./scan/identify";
import { beep, primeSound } from "./scan/sound";

/** Card languages Scryfall has, each written in itself. */
export const CARD_LANGUAGES: Record<string, string> = {
  en: "English", es: "Español", ja: "日本語", ru: "Русский", fr: "Français", de: "Deutsch", it: "Italiano", pt: "Português", ko: "한국어", zhs: "简体中文", zht: "繁體中文",
};
const LANG_KEY = "mtg-vault.scan-language";
const FINISH_KEY = { nonfoil: "finish.nonfoil", foil: "finish.foil", etched: "finish.etched" } as const;

function savedLanguage(): string {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v && v in CARD_LANGUAGES) return v;
  } catch {
    // Storage blocked: English.
  }
  return "en";
}

type Confidence = "sure" | "maybe";
interface Scanned {
  key: number;
  card: CardLookup | null;
  alternatives: CardLookup[];
  confidence: Confidence;
  printings: PrintingSummary[];
  printingId: string | null;
  finish: string;
  quantity: number;
  state: "loading" | "ready" | "added" | "error";
  error?: string;
}
type Destination = "collection" | string;

const finishOf = (p: PrintingSummary | undefined) => p?.finishes[0] ?? "nonfoil";

export function ScanPage() {
  const { t } = useI18n();
  const prefs = useCurrency();
  const queryClient = useQueryClient();
  const { data: me, isLoading: loadingMe } = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => fetchMe(signal) });
  const { data: decks } = useQuery({ queryKey: ["decks"], queryFn: fetchDecks, enabled: !!me });

  const [index, setIndex] = useState<ArtIndexEntry[] | null>(null);
  const [progress, setProgress] = useState<number | null>(0);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [language, setLanguage] = useState(savedLanguage);
  const [destination, setDestination] = useState<Destination>("collection");
  const [camera, setCamera] = useState(false);
  const [auto, setAuto] = useState(true);
  const [items, setItems] = useState<Scanned[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [working, setWorking] = useState(0);
  const counter = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const state = useRef({ items, index, language });
  state.current = { items, index, language };

  useEffect(() => {
    if (!me) return;
    const controller = new AbortController();
    setIndexError(null);
    setProgress(0);
    loadArtIndex({ onProgress: setProgress, signal: controller.signal })
      .then(({ index }) => setIndex(index))
      .catch((e) => !controller.signal.aborted && setIndexError(e instanceof Error ? e.message : String(e)));
    return () => controller.abort();
  }, [me, attempt]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const say = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };
  const patch = (key: number, change: Partial<Scanned>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...change } : i)));

  /** Name, price and a beep for the card just recognised. */
  const announce = (card: CardLookup, printing: PrintingSummary | undefined, count: number) => {
    const price = printing ? scanPrice(printing) : null;
    const label = count > 1 ? t("scan.toast.again", { name: card.name, count }) : card.name;
    say(`${label} · ${price == null ? t("price.none") : formatMoney(price, prefs)}`);
    beep();
  };

  /** Fingerprint in, card in the list out. */
  const receive = useCallback(
    async (found: Candidates) => {
      const top = found.cards[0];
      if (!top || found.confidence === "none") {
        beep(220, 160);
        say(t("scan.toast.none"));
        return;
      }
      const key = ++counter.current;
      const confidence: Confidence = found.confidence === "sure" ? "sure" : "maybe";
      // The same card again: one more copy of the entry that is still waiting, not a new row.
      const same = state.current.items.find((i) => i.card?.oracleId === top.oracleId && i.state === "ready");
      if (same) {
        patch(same.key, { quantity: same.quantity + 1 });
        announce(same.card!, same.printings.find((p) => p.id === same.printingId), same.quantity + 1);
        return;
      }
      setItems((list) => [{ key, card: null, alternatives: [], confidence, printings: [], printingId: null, finish: "nonfoil", quantity: 1, state: "loading" }, ...list]);
      setWorking((n) => n + 1);
      try {
        const [cards, printings] = await Promise.all([lookupCards(found.cards.map((c) => c.oracleId)), fetchPrintings(top.oracleId)]);
        const card = cards.find((c) => c.oracleId === top.oracleId) ?? null;
        const printing = pickPrinting(printings, state.current.language);
        patch(key, { card, alternatives: cards.filter((c) => c.oracleId !== top.oracleId), printings, printingId: printing?.id ?? null, finish: finishOf(printing), state: card && printing ? "ready" : "error", error: card && printing ? undefined : t("scan.error.unknown") });
        if (card) announce(card, printing, 1);
      } catch (e) {
        patch(key, { state: "error", error: e instanceof Error ? e.message : String(e) });
        say(t("scan.toast.none"));
      } finally {
        setWorking((n) => n - 1);
      }
    },
    // `say` and `announce` only read the current texts and prices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, prefs],
  );

  const choose = async (key: number, card: CardLookup) => {
    const current = state.current.items.find((i) => i.key === key);
    if (!current) return;
    patch(key, { state: "loading" });
    try {
      const printings = await fetchPrintings(card.oracleId);
      const printing = pickPrinting(printings, state.current.language);
      patch(key, {
        card,
        alternatives: [current.card, ...current.alternatives].filter((c): c is CardLookup => !!c && c.oracleId !== card.oracleId),
        confidence: "sure",
        printings,
        printingId: printing?.id ?? null,
        finish: finishOf(printing),
        state: printing ? "ready" : "error",
        error: printing ? undefined : t("scan.error.unknown"),
      });
    } catch (e) {
      patch(key, { state: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const onFiles = async (files: FileList | null) => {
    const idx = state.current.index;
    if (!files || !idx) return;
    for (const file of Array.from(files)) {
      try {
        const bitmap = await createImageBitmap(file);
        const matches = matchPhoto(bitmap, idx);
        bitmap.close();
        await receive(candidatesFromMatches(matches));
      } catch {
        say(t("scan.toast.none"));
      }
    }
  };

  const ready = items.filter((i) => i.state === "ready");
  const [adding, setAdding] = useState(false);
  const addAll = async () => {
    setAdding(true);
    let added = 0;
    for (const item of ready) {
      const printing = item.printings.find((p) => p.id === item.printingId);
      if (!printing || !item.card) continue;
      try {
        if (destination === "collection") {
          await addToCollection({ printingId: printing.id, quantity: item.quantity, finish: item.finish as "nonfoil", language: printing.lang });
        } else {
          await addDeckCard(destination, { oracleId: item.card.oracleId, quantity: item.quantity, printingId: printing.id });
        }
        patch(item.key, { state: "added" });
        added++;
      } catch (e) {
        patch(item.key, { state: "error", error: e instanceof Error ? e.message : String(e) });
      }
    }
    await queryClient.invalidateQueries({ queryKey: [destination === "collection" ? "collection" : "deck"] });
    if (destination !== "collection") await queryClient.invalidateQueries({ queryKey: ["decks"] });
    setAdding(false);
    if (added) say(t("scan.addedAll", { count: added }));
  };

  if (loadingMe) return <main className="page"><p>{t("common.loading")}</p></main>;
  if (!me) {
    return (
      <main className="page">
        <h1>{t("scan.title")}</h1>
        <p>
          {t("scan.pitch")} <Link to="/login">{t("auth.signIn")}</Link>
          {t("scan.pitch.signIn")}
        </p>
      </main>
    );
  }

  return (
    <main className="page scan-page">
      <h1>{t("scan.title")}</h1>
      <div className="scan-toast" role="status" aria-live="polite">
        {toast}
      </div>

      {!index && !indexError && (
        <section className="scan-loading">
          <p>{progress == null ? t("scan.loadingIndexUnknown") : t("scan.loadingIndex", { percent: Math.round(progress * 100) })}</p>
          <progress max={1} value={progress ?? undefined} aria-label={t("scan.loadingIndexUnknown")} />
          <p className="hint">{t("scan.indexNote")}</p>
        </section>
      )}
      {indexError && (
        <section>
          <p className="error">{t("scan.indexFailed", { message: indexError })}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)}>{t("scan.retry")}</button>
        </section>
      )}

      {index && (
        <>
          <section className="scan-settings">
            <label>
              {t("scan.language")}
              <select value={language} onChange={(e) => { setLanguage(e.target.value); try { localStorage.setItem(LANG_KEY, e.target.value); } catch { /* not kept */ } }}>
                {Object.entries(CARD_LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
            <label>
              {t("scan.destination")}
              <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="collection">{t("scan.toCollection")}</option>
                {(decks ?? []).map((d) => <option key={d.id} value={d.id}>{t("scan.toDeck", { name: d.name })}</option>)}
              </select>
            </label>
          </section>

          <section className="scan-sources">
            {camera ? (
              <ScanCamera auto={auto} onCapture={(frame) => state.current.index && void receive(candidatesFromMatches(searchAroundGuide(frame, state.current.index).matches))} onStop={() => setCamera(false)} />
            ) : (
              <div className="scan-source-buttons">
                <button type="button" className="btn-primary" onClick={() => { primeSound(); setCamera(true); }}>{t("scan.camera.start")}</button>
                <label className="button">
                  {t("scan.photo")}
                  <input type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
                </label>
                <label className="button">
                  {t("scan.upload")}
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => { void onFiles(e.target.files); e.target.value = ""; }} />
                </label>
              </div>
            )}
            <label className="scan-auto">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {t("scan.auto")}
            </label>
            <p className="hint">{t("scan.uploadHint")}</p>
          </section>

          <section className="scan-list" aria-label={t("scan.list.title", { count: items.length })}>
            <h2>{t("scan.list.title", { count: items.length })}</h2>
            {items.length === 0 && <p className="hint">{t("scan.list.empty")}</p>}
            <ul>
              {items.map((item) => {
                const printing = item.printings.find((p) => p.id === item.printingId);
                return (
                  <li key={item.key} className={`scan-item ${item.state}`}>
                    {(printing?.image ?? null) && <img src={printing!.image!.small} alt="" width={63} height={88} />}
                    <div className="scan-item-body">
                      <strong>{item.card?.name ?? t("scan.identifying")}</strong>
                      {item.state === "error" && <p className="error">{item.error}</p>}
                      {item.confidence === "maybe" && item.state !== "added" && item.card && <p className="warn">{t("scan.maybe")}</p>}
                      {item.alternatives.length > 0 && item.state === "ready" && (
                        <p className="hint">
                          {t("scan.alternatives")}{" "}
                          {item.alternatives.map((alt) => (
                            <button key={alt.oracleId} type="button" className="link" onClick={() => void choose(item.key, alt)}>{alt.name}</button>
                          ))}
                        </p>
                      )}
                      {item.state === "ready" && printing && (
                        <div className="scan-item-fields">
                          <label>
                            {t("scan.printing")}
                            <select value={item.printingId ?? ""} onChange={(e) => { const p = item.printings.find((x) => x.id === e.target.value); patch(item.key, { printingId: e.target.value, finish: finishOf(p) }); }}>
                              {item.printings.map((p) => <option key={p.id} value={p.id}>{`${printingLabel(p)} · ${p.lang}`}</option>)}
                            </select>
                          </label>
                          <label>
                            {t("add.finish")}
                            <select value={item.finish} onChange={(e) => patch(item.key, { finish: e.target.value })}>
                              {(printing.finishes.length ? printing.finishes : ["nonfoil"]).map((f) => <option key={f} value={f}>{t(FINISH_KEY[f as keyof typeof FINISH_KEY] ?? "finish.nonfoil")}</option>)}
                            </select>
                          </label>
                          <label>
                            {t("add.qty")}
                            <QuantityInput value={item.quantity} onChange={(quantity) => patch(item.key, { quantity })} />
                          </label>
                        </div>
                      )}
                      {item.state === "added" && <p className="ok">{t("scan.added")}</p>}
                    </div>
                    <button type="button" onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}>{t("common.remove")}</button>
                  </li>
                );
              })}
            </ul>
            {items.length > 0 && (
              <div className="scan-list-actions">
                <button type="button" className="btn-primary" disabled={!ready.length || adding || working > 0} onClick={() => void addAll()}>
                  {adding ? t("add.adding") : t("scan.addAll", { count: ready.length })}
                </button>
                <button type="button" onClick={() => setItems([])}>{t("scan.clear")}</button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

/** A number field that can be emptied and retyped; the value is clamped to 1–9999 when it is used and on blur. */
function QuantityInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const clamp = (raw: string) => Math.max(1, Math.min(9999, Math.trunc(Number(raw)) || 1));
  // A scan of the same card raises the quantity from outside; what the user is typing is left alone.
  useEffect(() => setText((current) => (clamp(current) === value ? current : String(value))), [value]);
  return (
    <input
      type="number"
      min={1}
      max={9999}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(clamp(e.target.value));
      }}
      onBlur={() => setText(String(clamp(text)))}
    />
  );
}
