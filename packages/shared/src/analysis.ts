import type { Color } from "./index.js";
import { cardCategory, deckCount, type DeckCardEntry } from "./decks.js";
import { canPartner, commanderRole } from "./commander.js";
import { ADVICE_MIN_CARDS, LAND_FORMULA, LAND_TOLERANCE, ROLES, ROLE_TARGETS, recommendedLands, type Role } from "./knowledge.js";

/** What the analysis reads from a deck card. */
export type AnalyzedCard = Pick<DeckCardEntry, "name" | "typeLine" | "cmc" | "board" | "quantity" | "oracleText" | "colorIdentity">;

const FIRST_FACE = (text: string) => text.split("//")[0] ?? "";
const COUNT_WORD = "(?:a|an|one|two|three|four|five|six|seven|x|\\d+|that many)";

/**
 * Which roles a card plays, guessed from its type line and rules text. This is a heuristic: it reads the
 * text with patterns, so a card worded in an unusual way can be missed or wrongly counted. Lands have no role.
 */
export function cardRoles(card: Pick<AnalyzedCard, "typeLine" | "oracleText">): Role[] {
  if (cardCategory(card.typeLine) === "Land" || !card.oracleText) return [];
  // Reminder text between parentheses explains rules; it is not what the card does.
  const text = card.oracleText.toLowerCase().replace(/\([^)]*\)/g, "");
  const sentences = text.split(/[.\n]/).map((s) => s.trim());
  const roles: Role[] = [];

  const ramp =
    /\{t\}(?:, [^:\n]+)?: add /.test(text) ||
    /create (?:a|an|two|three|x|\d+) (?:tapped )?treasure tokens?/.test(text) ||
    /you may play an additional land/.test(text) ||
    sentences.some((s) => /search your library for [^.]*\bland\b/.test(s) && /onto the battlefield/.test(s));
  if (ramp) roles.push("ramp");

  const withoutOpponents = text.replace(/(?:each|target|an|any) opponents? draws?/g, "");
  const draw =
    new RegExp(`\\bdraws? ${COUNT_WORD} cards?`).test(withoutOpponents) ||
    /exile the top (?:a |one |two |three |\d+ )?cards? of your library[\s\S]{0,80}you may (?:play|cast)/.test(text);
  if (draw) roles.push("draw");

  const removal = sentences.some((s) => {
    if (/graveyard|you control/.test(s) || /target (?:nonbasic |basic )?lands?\b/.test(s)) return false;
    return (
      /\b(?:destroy|exile) (?:up to \w+ )?target\b/.test(s) ||
      /deals? (?:\d+|x) damage to (?:any target|target (?:creature|planeswalker|battle)|up to \w+ target)/.test(s) ||
      /target [\w -]*creature gets -(?:\d+|x)\/-(?:\d+|x)/.test(s) ||
      /\bfights? (?:target|up to)/.test(s)
    );
  });
  if (removal) roles.push("removal");

  const wipe =
    /\b(?:destroy|exile) all (?:other )?(?:[\w-]+ )?(?:creatures|permanents|artifacts|enchantments|planeswalkers)\b/.test(text) ||
    /deals? (?:\d+|x) damage to each (?:other )?creature/.test(text) ||
    /(?:all|each) creatures? (?:get|gets) -(?:\d+|x)\/-(?:\d+|x)/.test(text);
  if (wipe) roles.push("wipe");

  return roles;
}

export type WarningCode =
  | "size"
  | "no-commander"
  | "many-commanders"
  | "commander-invalid"
  | "commander-pair"
  | "colors"
  | "copies"
  | "lands-low"
  | "lands-high"
  | "role-low"
  | "role-high";

export interface Warning {
  code: WarningCode;
  /** `rule` is a Commander rule; `advice` is only a guide. Neither blocks anything. */
  kind: "rule" | "advice";
  params: Record<string, string | number>;
}

export interface DeckAnalysis {
  commanders: string[];
  /** Union of the commanders' color identity, in WUBRG order. */
  identity: Color[];
  /** Copies on the main and commander boards. */
  size: number;
  lands: number;
  /** Non-land cards of the main board. */
  spells: number;
  /** Average mana value of those spells, or 0 without spells. */
  averageMv: number;
  /** Spells by mana value: index 0 to 6, and the last slot is 7 or more. */
  curve: number[];
  roles: Record<Role, number>;
  /** Ramp or card draw spells at or below `LAND_FORMULA.cheapMaxMv`. */
  cheapRampOrDraw: number;
  suggestedLands: number;
  warnings: Warning[];
}

const COLOR_ORDER: Color[] = ["W", "U", "B", "R", "G"];
const CURVE_SLOTS = 8;
const LIST_LIMIT = 6;

/** Some cards break the one-copy rule: basic lands, and cards whose text says so ("any number of cards named…"). */
function mayRepeat(card: Pick<AnalyzedCard, "typeLine" | "oracleText">): boolean {
  if (/\bBasic\b/.test(FIRST_FACE(card.typeLine))) return true;
  return /a deck can have (?:any number|up to \w+) (?:of )?cards named/i.test(card.oracleText ?? "");
}

const names = (list: string[]) =>
  list.length > LIST_LIMIT ? `${list.slice(0, LIST_LIMIT).join(", ")}…` : list.join(", ");

/**
 * Looks at a Commander deck: lands, mana curve, roles and where it differs from the format rules and from
 * common advice. Rules and advice come back as warnings; the caller decides how to show them.
 */
export function analyzeCommanderDeck(cards: AnalyzedCard[]): DeckAnalysis {
  const commanderCards = cards.filter((c) => c.board === "commander");
  const main = cards.filter((c) => c.board === "main");
  const spellCards = main.filter((c) => cardCategory(c.typeLine) !== "Land");
  const copies = (list: AnalyzedCard[]) => list.reduce((n, c) => n + c.quantity, 0);

  const lands = copies(main) - copies(spellCards);
  const spells = copies(spellCards);
  const averageMv = spells ? spellCards.reduce((n, c) => n + c.cmc * c.quantity, 0) / spells : 0;

  const curve = Array<number>(CURVE_SLOTS).fill(0);
  for (const c of spellCards) curve[Math.min(Math.floor(c.cmc), CURVE_SLOTS - 1)]! += c.quantity;

  const roles: Record<Role, number> = { ramp: 0, draw: 0, removal: 0, wipe: 0 };
  let cheapRampOrDraw = 0;
  for (const c of spellCards) {
    const found = cardRoles(c);
    for (const r of found) roles[r] += c.quantity;
    if (c.cmc <= LAND_FORMULA.cheapMaxMv && (found.includes("ramp") || found.includes("draw"))) cheapRampOrDraw += c.quantity;
  }

  const identitySet = new Set(commanderCards.flatMap((c) => c.colorIdentity));
  const identity = COLOR_ORDER.filter((c) => identitySet.has(c));
  const size = deckCount(cards);
  const suggestedLands = recommendedLands(averageMv, cheapRampOrDraw);

  const warnings: Warning[] = [];
  const rule = (code: WarningCode, params: Warning["params"] = {}) => warnings.push({ code, kind: "rule", params });
  const advice = (code: WarningCode, params: Warning["params"] = {}) => warnings.push({ code, kind: "advice", params });

  if (size !== 100) rule("size", { count: size });
  if (commanderCards.length === 0) rule("no-commander");
  else if (commanderCards.length > 2) rule("many-commanders", { count: commanderCards.length });

  const badCommanders = commanderCards.filter((c) => commanderRole(c) === null);
  if (badCommanders.length) rule("commander-invalid", { count: badCommanders.length, names: names(badCommanders.map((c) => c.name)) });
  if (commanderCards.length === 2 && !canPartner(commanderCards[0]!, commanderCards[1]!)) {
    rule("commander-pair", { names: commanderCards.map((c) => c.name).join(" + ") });
  }

  if (commanderCards.length > 0) {
    const outside = main.filter((c) => c.colorIdentity.some((color) => !identitySet.has(color)));
    if (outside.length) rule("colors", { count: outside.length, names: names(outside.map((c) => c.name)) });
  }
  const repeated = main.filter((c) => c.quantity > 1 && !mayRepeat(c));
  if (repeated.length) rule("copies", { count: repeated.length, names: names(repeated.map((c) => c.name)) });

  if (size >= ADVICE_MIN_CARDS) {
    if (lands < suggestedLands - LAND_TOLERANCE) advice("lands-low", { lands, suggested: suggestedLands });
    else if (lands > suggestedLands + LAND_TOLERANCE) advice("lands-high", { lands, suggested: suggestedLands });
    for (const role of ROLES) {
      const { min, max } = ROLE_TARGETS[role];
      if (roles[role] < min) advice("role-low", { role, count: roles[role], min, max });
      else if (roles[role] > max) advice("role-high", { role, count: roles[role], min, max });
    }
  }

  return {
    commanders: commanderCards.map((c) => c.name),
    identity,
    size,
    lands,
    spells,
    averageMv,
    curve,
    roles,
    cheapRampOrDraw,
    suggestedLands,
    warnings,
  };
}

export type CardProblemCode = "bad-commander" | "outside-identity" | "copies" | "duplicates-commander";

export interface CardProblem {
  code: CardProblemCode;
  params: Record<string, string | number>;
}

/** Key of a card in the map `cardProblems` returns. */
export const problemKey = (card: Pick<DeckCardEntry, "oracleId" | "board">) => `${card.board}:${card.oracleId}`;

/**
 * What is wrong with each card of a Commander deck, for highlighting it in the list: a commander that cannot lead,
 * a card outside the commander's colors, repeated copies, or the commander itself also in the main board. Cards
 * without a problem are not in the map.
 */
export function cardProblems(cards: (AnalyzedCard & Pick<DeckCardEntry, "oracleId">)[]): Map<string, CardProblem[]> {
  const result = new Map<string, CardProblem[]>();
  const add = (card: Pick<DeckCardEntry, "oracleId" | "board">, problem: CardProblem) =>
    result.set(problemKey(card), [...(result.get(problemKey(card)) ?? []), problem]);

  const commanderCards = cards.filter((c) => c.board === "commander");
  const identity = new Set(commanderCards.flatMap((c) => c.colorIdentity));
  const commanderIds = new Set(commanderCards.map((c) => c.oracleId));

  for (const c of commanderCards) if (commanderRole(c) === null) add(c, { code: "bad-commander", params: {} });
  for (const c of cards.filter((x) => x.board === "main")) {
    if (commanderIds.has(c.oracleId)) add(c, { code: "duplicates-commander", params: {} });
    const outside = commanderCards.length > 0 ? COLOR_ORDER.filter((color) => c.colorIdentity.includes(color) && !identity.has(color)) : [];
    if (outside.length) add(c, { code: "outside-identity", params: { colors: outside.join(" ") } });
    if (c.quantity > 1 && !mayRepeat(c)) add(c, { code: "copies", params: { count: c.quantity } });
  }
  return result;
}
