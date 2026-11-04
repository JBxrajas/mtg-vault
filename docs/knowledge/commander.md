# Commander deckbuilding knowledge

What the deck analysis ([`packages/shared/src/knowledge.ts`](../../packages/shared/src/knowledge.ts) and [`analysis.ts`](../../packages/shared/src/analysis.ts)) knows about building a Commander deck, where each figure comes from and how far to trust it. The code carries the same source and confidence next to every number. Research dates: 2026-11-04.

**Everything here is a guide, not a rule**, except where marked official. The interface says so and no warning blocks anything.

## Confidence levels

| Level | Meaning |
|---|---|
| official | Written by Wizards of the Coast |
| simulation | Result of a statistical model or a simulation, with assumptions |
| community | Advice many players repeat; sources differ in the exact numbers |
| assumption | Our own choice, made where the sources were silent |

## Lands

- **Formula** (simulation, Frank Karsten): for a 99-card deck, `lands = 31.42 + 3.13 × average mana value of the spells − 0.28 × cheap ramp or card draw spells`. With an average of 3.0 and 10 such spells it gives 38. It comes from a regression over about 95,000 successful tournament decklists. See [`recommendedLands`](../../packages/shared/src/knowledge.ts).
- **Not verified directly:** the original ChannelFireball article could not be opened when this was written; the formula comes from summaries of it and from a third-party simulation that quotes it. Check the article before changing the constants.
- **Cheap means mana value 2 or less** (assumption). The sources read do not define the threshold. Counting a spell once even when it both ramps and draws is also ours. Both choices lean towards suggesting a few more lands.
- **Tolerance:** a deck is only flagged when its lands differ from the suggestion by more than 3 (assumption). The formula is a regression, not a threshold.
- **Cross-check** (simulation, ScrollVault, 3.75 million simulated games with a free first mulligan): cEDH 29–31 lands, combo 33–35, midrange 36–37, battlecruiser and landfall 38–40. It does not model card draw or fetch lands, and it takes Karsten's formula as its reference, so it is not an independent check. We do not use these ranges in the code yet.
- **Not modelled:** modal double-faced lands (a spell on the front face counts as a spell), colored sources per spell (how many Forests a double-green spell needs). The latter is the next thing to research.

## Roles

| Role | Usual copies | Counted from |
|---|---|---|
| Ramp | 8–12 | Mana abilities that tap for mana, Treasure makers, extra land drops, spells that put a land onto the battlefield |
| Card draw | 8–12 | "Draw N cards" for you, and "exile the top cards, you may play them" |
| Removal | 6–10 | Destroy or exile target, damage to a target, −X/−X on a target, fights |
| Board wipes | 2–4 | Destroy or exile all, damage to each creature, −X/−X to all creatures |

- **Source** (community): the ranges are the common middle of several guides ([metagame.info](https://metagame.info/en-us/mtg/articles/how-to-build-a-commander-deck-from-scratch), the [EDHREC upgrade guide](https://edhrec.com/guides/edhrec-guide-to-upgrading-your-commander-deck) and others). Ranges differ between sources; none is authoritative. One site that attributed a "10/10/3" template to The Command Zone looked like low-quality SEO and was not used.
- **Dual-purpose cards fill several roles** at once, which the guides also allow.
- **Roles are guessed from the rules text** with patterns, so they are estimates. Known limits: reminder text is ignored; a counterspell is not removal; bounce is neither removal nor a wipe; "destroy target land" is not removal; mana that comes from a triggered ability (not `{T}: Add`) is not ramp. Tests in `analysis.test.ts` pin the cases above.
- **Balance advice only appears from 60 cards** (assumption): earlier the deck is still being built and the counts would only be noise.

## Mana curve

The analysis draws the number of spells per mana value (0 to 6, and 7 or more) and the average mana value of the spells. It does **not** compare the curve with target numbers per slot: the only figures found for that came from a single video and have not been checked against another source. The tip explains the idea in words.

## Format rules shown as warnings

For Commander decks only: 100 cards, a commander on the Commander board (at most two), cards inside the commander's color identity, and one copy of each card except basic lands and cards whose text says a deck can have any number of them. They are shown as warnings and never block a change ([plan](../plan.md)). Banned cards, Partner pairs and the Companion rules are not checked.

## Commander Brackets

Source (official, in beta): [Introducing Commander Brackets Beta](https://magic.wizards.com/en/news/announcements/introducing-commander-brackets-beta), with later updates on 2025-04-22, 2025-10-21 and 2026-02-09.

| Bracket | Name | Game Changers | Idea |
|---|---|---|---|
| 1 | Exhibition | 0 | Slow, themed games; no deliberate two-card combos, no mass land denial, sparse tutors |
| 2 | Core | 0 | About an average preconstructed deck; extra turns few and not chained |
| 3 | Upgraded | up to 3 | A turn or two faster; no cheap early two-card combos; tutors not limited |
| 4 | Optimized | no limit | Can end fast; strong tutors, cheap combos and mass land denial expected |
| 5 | cEDH | no limit | Competitive and metagame-driven; only the banned list applies |

- Brackets help a table talk about power level before playing; they do not decide who may play whom, and a deck's intent counts as much as its cards.
- **The Game Changers list changes** (a card was added in February 2026 and several were removed in October 2025). It is **not stored** in the repository and the analysis does **not check it**; the interface says so and links to the announcement. Storing it needs a versioned list with its date, or a Scryfall search that exposes it (not checked).
- A third-party site says the list has 53 cards; that was not confirmed against Wizards.

## EDHREC

Not a data source. Its [terms of use](https://edhrec.com/terms) allow personal, non-commercial use only, forbid scripts that make automated requests and forbid using the site to build a similar or competing website, and its pages refuse to be shown inside another page (`X-Frame-Options: SAMEORIGIN`). The deck page therefore only **links** to a commander's EDHREC page and can open it in a **side window** the user's browser loads; nothing is fetched, proxied or copied. The same goes for any ranking that is derived from EDHREC. Using its data would need their permission. See [ADR 0013](../adr/0013-commander-knowledge-and-analysis.md).

The page slug (`atraxa-praetors-voice` for "Atraxa, Praetors' Voice") was checked against one commander. A wrong slug lands on EDHREC's own not-found page.

## Not researched yet

- Colored sources per spell, by number of colored pips.
- Per-slot curve targets, backed by more than one source.
- Archetype guides (what to count for tribal, spellslinger, voltron, …) and how a commander's cost changes the curve.
- Other formats (Brawl, Oathbreaker, 60-card formats).
