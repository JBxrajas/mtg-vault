import {
  activeFilterCount,
  setsIn,
  type CardCategory,
  type CollectionFilters,
  type CollectionItem,
  type CollectionSort,
  type ColorFilter,
  type Condition,
  type Finish,
} from "@mtg-vault/shared";
import { useMemo } from "react";
import { useI18n } from "./i18n";
import { Tip } from "./Tip";

const COLORS: ColorFilter[] = ["W", "U", "B", "R", "G", "C"];
const TYPES: CardCategory[] = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];
const RARITY_ORDER = ["common", "uncommon", "rare", "mythic"];
const FINISHES: Finish[] = ["nonfoil", "foil", "etched"];
const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
export const SORTS: CollectionSort[] = ["name", "set", "quantity", "price", "value", "mv"];

const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Chips<T extends string>(props: { label: string; options: { value: T; text: string }[]; selected: T[]; onChange: (next: T[]) => void }) {
  return (
    <div className="filter-group" role="group" aria-label={props.label}>
      <span className="filter-title">{props.label}</span>
      <div className="chips">
        {props.options.map((o) => (
          <button key={o.value} type="button" className={props.selected.includes(o.value) ? "chip on" : "chip"} aria-pressed={props.selected.includes(o.value)} onClick={() => props.onChange(toggle(props.selected, o.value))}>
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Search box, sorting and filters for the collection list. The parent keeps the state and does the filtering
 * (`filterCollection`, `sortCollection` in `packages/shared`); this only edits it.
 */
export function CollectionFilterBar(props: {
  items: CollectionItem[];
  filters: CollectionFilters;
  onFilters: (next: CollectionFilters) => void;
  sort: CollectionSort;
  desc: boolean;
  onSort: (sort: CollectionSort, desc: boolean) => void;
}) {
  const { t } = useI18n();
  const { filters: f, onFilters } = props;
  const set = (patch: Partial<CollectionFilters>) => onFilters({ ...f, ...patch });
  const sets = useMemo(() => setsIn(props.items), [props.items]);
  const rarities = useMemo(() => {
    const present = new Set(props.items.map((i) => i.rarity));
    return [...RARITY_ORDER.filter((r) => present.has(r)), ...[...present].filter((r) => !RARITY_ORDER.includes(r)).sort()];
  }, [props.items]);
  const active = activeFilterCount(f);
  const number = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Math.max(0, Number(v)));

  return (
    <section className="filter-bar" aria-label={t("filters.region")}>
      <div className="filter-top">
        <input
          type="search"
          aria-label={t("collection.search")}
          placeholder={t("collection.searchPlaceholder")}
          value={f.text}
          onChange={(e) => set({ text: e.target.value })}
        />
        <label className="sort">
          <span className="sub">{t("collection.sort")}</span>
          <select value={props.sort} onChange={(e) => props.onSort(e.target.value as CollectionSort, props.desc)}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sort.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={props.desc ? "chip on" : "chip"} aria-pressed={props.desc} onClick={() => props.onSort(props.sort, !props.desc)}>
          {t("sort.desc")}
        </button>
      </div>

      <details className="filters" open={active > 0 ? true : undefined}>
        <summary>
          {t("filters.title")}
          {active > 0 && <span className="badge">{active}</span>}
          <Tip label={t("filters.tip.label")}>{t("filters.tip.text")}</Tip>
        </summary>

        <div className="filter-group" role="group" aria-label={t("filters.colors")}>
          <span className="filter-title">{t("filters.colors")}</span>
          <div className="chips">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={f.colors.includes(c) ? "color-toggle on" : "color-toggle"}
                aria-pressed={f.colors.includes(c)}
                aria-label={t(`color.${c}`)}
                title={t(`color.${c}`)}
                onClick={() => set({ colors: toggle(f.colors, c) })}
              >
                <span className={`pip pip-${c === "C" ? "n" : c.toLowerCase()}`} aria-hidden="true">
                  {c}
                </span>
              </button>
            ))}
          </div>
        </div>

        <Chips label={t("filters.type")} options={TYPES.map((v) => ({ value: v, text: t(`category.${v}`) }))} selected={f.types} onChange={(types) => set({ types })} />
        <Chips label={t("filters.rarity")} options={rarities.map((v) => ({ value: v, text: cap(v) }))} selected={f.rarities} onChange={(next) => set({ rarities: next })} />
        <Chips label={t("filters.finish")} options={FINISHES.map((v) => ({ value: v, text: t(`finish.${v}`) }))} selected={f.finishes} onChange={(finishes) => set({ finishes })} />
        <Chips label={t("filters.condition")} options={CONDITIONS.map((v) => ({ value: v, text: v }))} selected={f.conditions} onChange={(conditions) => set({ conditions })} />

        <div className="filter-row">
          <label>
            <span className="filter-title">{t("filters.set")}</span>
            <select value={f.sets[0] ?? ""} onChange={(e) => set({ sets: e.target.value ? [e.target.value] : [] })}>
              <option value="">{t("filters.anySet")}</option>
              {sets.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code.toUpperCase()}) · {s.count}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-title">{t("filters.mvMin")}</span>
            <input type="number" inputMode="numeric" min={0} value={f.mvMin ?? ""} onChange={(e) => set({ mvMin: number(e.target.value) })} />
          </label>
          <label>
            <span className="filter-title">{t("filters.mvMax")}</span>
            <input type="number" inputMode="numeric" min={0} value={f.mvMax ?? ""} onChange={(e) => set({ mvMax: number(e.target.value) })} />
          </label>
        </div>

        <button type="button" className="link" disabled={active === 0} onClick={() => onFilters({ ...f, text: "", colors: [], types: [], rarities: [], sets: [], finishes: [], conditions: [], mvMin: null, mvMax: null })}>
          {t("filters.clear")}
        </button>
      </details>
    </section>
  );
}
