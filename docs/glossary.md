# Glossary

## MTG
- **Oracle card:** the card as a concept, independent of printing (same name and rules text).
- **Printing:** a specific version of a card in a set, with its collector number, art and price.
- **Set:** a group of cards released together, identified by a code (for example `mh3`).
- **Collector number:** the card's number within its set.
- **Foil:** shiny finish; priced differently.
- **Condition:** physical state: NM (near mint), LP, MP, HP, DMG.
- **Format:** deck-building rules (Standard, Modern, Commander, …).

## Data model
Implemented in `packages/db` (see its README); the decisions are in [ADR 0008](adr/0008-users-collection-binders-decks.md).

**Catalog** (imported from Scryfall)
- `sets` — a set.
- `cards` — an oracle card.
- `printings` — a printing; belongs to a `card` and a `set`.
- `price_snapshots` — the price of a `printing` on a given date.

**Users** (Better Auth, username and password)
- `user`, `session`, `account`, `verification`.

**Collection**
- `collections` — a user's one collection.
- `collection_items` — inventory: a stack of identical cards (printing, finish, condition, language) with quantity and purchase data.
- `binders` — named sub-collections of the collection.
- `binder_items` — how many copies of a stack sit in a binder.

**Decks**
- `decks` — a user's deck with a format and visibility.
- `deck_cards` — oracle cards in a deck, per board (main, sideboard, maybeboard, commander). Type groups (creature, instant, …) are derived from the type line.

**Interface**
- **Deck list** — a deck as text, one `4 Lightning Bolt` line per card with a section per board; used to import and export decks ([docs/apis.md](apis.md#deck-lists-text-import-and-export)).
- **Appearance** — the user's mode (light, dark, automatic), background color or card art, kept on the device.

Terms: a **stack** is owned copies that share printing, finish, condition and language; a **binder** is a sub-collection; a **board** is the part of a deck a card sits in.
