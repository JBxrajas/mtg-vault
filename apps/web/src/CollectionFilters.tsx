import {
  activeFilterCount,
  cardCategory,
  emptyFilters,
  MANA_VALUE_CAP,
  setsIn,
  type CardCategory,
  type CollectionFilters,
  type CollectionItem,
  type CollectionSort,
  type ColorFilter,
  type Condition,
  type Finish,
} from "@mtg-vault/shared";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "./i18n";
import { Tip } from "./Tip";

export type CollectionView = "list" | "cards" | "art";

const COLORS: ColorFilter[] = ["W", "U", "B", "R", "G", "C"];
const TYPES: CardCategory[] = ["Creature", "Instant", "Sorcery", "Artifact", "Enchantment", "Planeswalker", "Land", "Battle"];
const RARITY_ORDER = ["common", "uncommon", "rare", "mythic"];
const FINISHES: Finish[] = ["nonfoil", "foil", "etched"];
const CONDITIONS: Condition[] = ["NM", "LP", "MP", "HP", "DMG"];
const MANA_VALUES = Array.from({ length: MANA_VALUE_CAP + 1 }, (_, i) => i);
export const SORTS: CollectionSort[] = ["name", "set", "quantity", "price", "value", "mv"];
const VIEWS: CollectionView[] = ["list", "cards", "art"];

const toggle = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Small line icons (24×24, currentColor) so the controls read at a glance without an icon font. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
const icons = {
  search: (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  ),
  filter: (
    <Icon>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Icon>
  ),
  asc: (
    <Icon>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </Icon>
  ),
  desc: (
    <Icon>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Icon>
  ),
  list: (
    <Icon>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  ),
  cards: (
    <Icon>
      <rect x="4" y="3" width="7" height="8" rx="1.5" />
      <rect x="13" y="3" width="7" height="8" rx="1.5" />
      <rect x="4" y="13" width="7" height="8" rx="1.5" />
      <rect x="13" y="13" width="7" height="8" rx="1.5" />
    </Icon>
  ),
  art: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 16-5-5-8 8" />
    </Icon>
  ),
  close: (
    <Icon>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  ),
};

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
 * Search, sorting, view and filters for the collection. The parent keeps the state and does the filtering
 * (`filterCollection`, `sortCollection` in `packages/shared`); this only edits it. What people reach for most is
 * always in view (card type with counts, colors, mana value); rarity, finish, condition and set are in a panel.
 */
export function CollectionFilterBar(props: {
  items: CollectionItem[];
  filters: CollectionFilters;
  onFilters: (next: CollectionFilters) => void;
  sort: CollectionSort;
  desc: boolean;
  onSort: (sort: CollectionSort, desc: boolean) => void;
  view: CollectionView;
  onView: (view: CollectionView) => void;
}) {
  const { t } = useI18n();
  const { filters: f, onFilters } = props;
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<CollectionFilters>) => onFilters({ ...f, ...patch });
  const sets = useMemo(() => setsIn(props.items), [props.items]);
  const rarities = useMemo(() => {
    const present = new Set(props.items.map((i) => i.rarity));
    return [...RARITY_ORDER.filter((r) => present.has(r)), ...[...present].filter((r) => !RARITY_ORDER.includes(r)).sort()];
  }, [props.items]);
  const typeCounts = useMemo(() => {
    const counts = new Map<CardCategory, number>();
    for (const i of props.items) {
      const c = cardCategory(i.typeLine ?? "");
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return counts;
  }, [props.items]);
  const active = activeFilterCount(f);
  // Filters that live in the panel, for the badge on its button.
  const inPanel = [f.rarities, f.sets, f.finishes, f.conditions].filter((l) => l.length > 0).length;

  // What is on, each with the way to turn it off, so nothing filters the list without showing it.
  const chips: { key: string; text: string; off: () => void }[] = [
    ...(f.text.trim() ? [{ key: "text", text: `“${f.text.trim()}”`, off: () => set({ text: "" }) }] : []),
    ...f.colors.map((c) => ({ key: `color-${c}`, text: t(`color.${c}`), off: () => set({ colors: f.colors.filter((v) => v !== c) }) })),
    ...f.types.map((v) => ({ key: `type-${v}`, text: t(`category.${v}`), off: () => set({ types: f.types.filter((x) => x !== v) }) })),
    ...f.manaValues.map((n) => ({ key: `mv-${n}`, text: t("filters.mvChip", { value: n === MANA_VALUE_CAP ? `${n}+` : String(n) }), off: () => set({ manaValues: f.manaValues.filter((x) => x !== n) }) })),
    ...f.rarities.map((v) => ({ key: `rarity-${v}`, text: cap(v), off: () => set({ rarities: f.rarities.filter((x) => x !== v) }) })),
    ...f.finishes.map((v) => ({ key: `finish-${v}`, text: t(`finish.${v}`), off: () => set({ finishes: f.finishes.filter((x) => x !== v) }) })),
    ...f.conditions.map((v) => ({ key: `condition-${v}`, text: v, off: () => set({ conditions: f.conditions.filter((x) => x !== v) }) })),
    ...f.sets.map((v) => ({ key: `set-${v}`, text: v.toUpperCase(), off: () => set({ sets: f.sets.filter((x) => x !== v) }) })),
  ];

  return (
    <section className="filter-bar" aria-label={t("filters.region")}>
      <div className="toolbar">
        <div className="search-field">
          {icons.search}
          <input type="search" aria-label={t("collection.search")} placeholder={t("collection.searchPlaceholder")} value={f.text} onChange={(e) => set({ text: e.target.value })} />
        </div>

        <div className="sort-field">
          <label>
            <span className="sr-only">{t("collection.sort")}</span>
            <select value={props.sort} onChange={(e) => props.onSort(e.target.value as CollectionSort, props.desc)}>
              {SORTS.map((s) => (
                <option key={s} value={s}>
                  {t(`sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="icon-button" aria-pressed={props.desc} aria-label={t("sort.desc")} title={t("sort.desc")} onClick={() => props.onSort(props.sort, !props.desc)}>
            {props.desc ? icons.desc : icons.asc}
          </button>
        </div>

        <div className="segmented" role="group" aria-label={t("collection.view")}>
          {VIEWS.map((v) => (
            <button key={v} type="button" className={props.view === v ? "on" : undefined} aria-pressed={props.view === v} onClick={() => props.onView(v)}>
              {icons[v]}
              <span>{t(`collection.view.${v}`)}</span>
            </button>
          ))}
        </div>

        <span className="filters-toggle-wrap">
          <button type="button" className="filters-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
            {icons.filter}
            <span>{t("filters.title")}</span>
            {inPanel > 0 && <span className="badge">{inPanel}</span>}
          </button>
          <Tip label={t("filters.tip.label")}>{t("filters.tip.text")}</Tip>
        </span>
      </div>

      <div className="quick" role="group" aria-label={t("filters.type")}>
        <button type="button" className={f.types.length === 0 ? "chip on" : "chip"} aria-pressed={f.types.length === 0} onClick={() => set({ types: [] })}>
          {t("filters.all")} <small>{props.items.length}</small>
        </button>
        {TYPES.filter((v) => (typeCounts.get(v) ?? 0) > 0 || f.types.includes(v)).map((v) => (
          <button key={v} type="button" className={f.types.includes(v) ? "chip on" : "chip"} aria-pressed={f.types.includes(v)} onClick={() => set({ types: toggle(f.types, v) })}>
            {t(`category.${v}`)} <small>{typeCounts.get(v) ?? 0}</small>
          </button>
        ))}
      </div>

      <div className="refine">
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
                onClick={() => set({ colors: c === "C" ? (f.colors.includes("C") ? [] : ["C"]) : toggle(f.colors.filter((v) => v !== "C"), c) })}
              >
                <span className={`pip pip-${c === "C" ? "n" : c.toLowerCase()}`} aria-hidden="true">
                  {c}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group" role="group" aria-label={t("filters.manaValue")}>
          <span className="filter-title">{t("filters.manaValue")}</span>
          <div className="chips mv">
            {MANA_VALUES.map((n) => {
              const label = n === MANA_VALUE_CAP ? `${n}+` : String(n);
              const on = f.manaValues.includes(n);
              return (
                <button key={n} type="button" className={on ? "chip on" : "chip"} aria-pressed={on} aria-label={t("filters.mvChip", { value: label })} onClick={() => set({ manaValues: toggle(f.manaValues, n).sort((a, b) => a - b) })}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {open && (
        <div className="filter-panel" id={panelId}>
          <Chips label={t("filters.rarity")} options={rarities.map((v) => ({ value: v, text: cap(v) }))} selected={f.rarities} onChange={(next) => set({ rarities: next })} />
          <Chips label={t("filters.finish")} options={FINISHES.map((v) => ({ value: v, text: t(`finish.${v}`) }))} selected={f.finishes} onChange={(finishes) => set({ finishes })} />
          <Chips label={t("filters.condition")} options={CONDITIONS.map((v) => ({ value: v, text: v }))} selected={f.conditions} onChange={(conditions) => set({ conditions })} />
          <label className="filter-group">
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
        </div>
      )}

      {active > 0 && (
        <div className="active-filters" role="group" aria-label={t("filters.active")}>
          {chips.map((c) => (
            <button key={c.key} type="button" className="chip on removable" aria-label={t("filters.remove", { name: c.text })} onClick={c.off}>
              {c.text}
              {icons.close}
            </button>
          ))}
          <button type="button" className="link" onClick={() => onFilters(emptyFilters())}>
            {t("filters.clear")}
          </button>
        </div>
      )}
    </section>
  );
}
