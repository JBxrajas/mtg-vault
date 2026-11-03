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
Implemented in `packages/db` (see its README): `sets`, `cards`, `printings` and `price_snapshots`. Planned for phase 3: collections and decks.

- `sets` — a set.
- `cards` — an oracle card.
- `printings` — a printing; belongs to a `card` and a `set`.
- `collection_entry` — one entry in a user's collection: `printing`, quantity, foil, condition, language, purchase price.
- `deck` and `deck_entry` — decks.
- `price_snapshots` — the price of a `printing` on a given date.
