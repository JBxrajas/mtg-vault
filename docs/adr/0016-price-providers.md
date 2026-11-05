# ADR 0016 — Choose the price provider

**Status:** proposed (not built)

## Context
Scryfall's `usd` is TCGplayer's price, `eur` is Cardmarket's and `tix` is MTGO's, so they differ from what other stores charge. The owner wants to choose another provider: Card Kingdom and Star City Games.
- **Card Kingdom:** no public API was found. [MTGJSON](https://mtgjson.com/data-models/price/price-formats) publishes its prices (retail and buylist, foil and normal) along with TCGplayer's, Cardmarket's and Cardsphere's.
- **Star City Games:** no public API and not in MTGJSON. Its `robots.txt` does not block product pages for general bots (it blocks search, cart, accounts and the deckbuilder, and asks AI crawlers for a 10 s delay). Its terms of use were **not found**, so we do not know whether automated access is allowed.

## Decision
1. **A provider setting** (Scryfall / TCGplayer, Cardmarket, Card Kingdom, later Star City Games), kept on the device like the currency, used by the collection, printings, decks and the scanner toast.
2. **Source: MTGJSON** for Card Kingdom. A job downloads the price file, matches each entry to our printings (MTGJSON lists Scryfall ids in its identifiers; the match rate must be measured) and stores **only the latest price per printing and provider**, with no history, in a compact table (printing id, provider, amount in cents, foil flag). Size to be measured; it must fit in what ADR 0015 frees.
3. **Star City Games only with permission.** The owner asks SCG for a feed or their written authorization, or confirms their terms allow it. If so, the job runs slowly, identifies itself in `User-Agent`, reads only prices and does not copy images or texts. Until then it is not built. A provider is a name plus a function that returns prices, so adding it later changes only the job.
4. **Buylist prices** are stored only if the owner wants them (open question).

## Alternatives considered
- **Scrape Card Kingdom or SCG pages directly:** fragile, may break their terms, and not stable.
- **Keep history per provider:** the existing history costs 13 MB for one provider; it would multiply. Not now.

## Consequences
- MTGJSON's terms, file size and Scryfall-id coverage are unverified and are the first things to check.
- A price from another provider can be missing for a printing; the interface falls back to Scryfall's and says so.
