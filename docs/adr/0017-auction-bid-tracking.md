# ADR 0017 — Tracking bids in outside auctions

**Status:** accepted

## Context
The owner buys many cards in Magic auctions run in Facebook groups (Mexico City): a post per card, bids as comments, a closing time, and pick-up at a meeting point on a set day. With twenty bids open at once it is easy to miss a closing time, to forget what was won and still has to be paid or picked up, or to bid past the maximum set beforehand. The app should keep track of this as one more feature next to the collection and decks, not as a separate app.

## Decision
- **One table, `auction_bids`** (migration `0004`), owned by a user (deleting the user cascades). A row is one bid: the card, the group, the seller, the post link, my bid, the highest bid and who holds it, my maximum, the closing time, the status, the pick-up place and time, the deck the card is for, and notes.
- **The card is linked to the catalog when it can be**: `oracle_id` and, optionally, `printing_id`. `card_name` is always stored, so a card typed by hand (a Secret Lair bundle, a misspelling) is still tracked. A printing decides the card; a deck must be the user's own; deleting a deck leaves the bid without one.
- **Amounts are Mexican pesos** (`numeric(10,2)`), the currency those groups use; no currency column. The collection keeps prices in dollars, so adding a won card converts at the user's own rate (the one set for showing the collection in pesos).
- **Status is a fixed list**: winning, losing (open auction), won, lost (closed), paid, picked up. It is set by the user; the app cannot read Facebook and does not try (no scraping, no automated bids).
- **Derived, not stored**: the totals (committed if every winning bid wins plus what is won and unpaid; to pay; to pick up), the alerts (losing, closing within an hour, highest bid at or over the maximum, time passed but still open) and the order (open first by closing time). They are pure functions in `packages/shared` (`auctionTotals`, `auctionAlerts`, `sortAuctions`), tested there.
- **Marking a bid as picked up offers to add one copy to the collection** (printing and finish chosen, price paid converted to dollars, acquired today). It is an offer, not automatic, because the printing and condition are only known once the card is in hand.

- **Open only to some accounts** (added before merging, at the owner's request: it is his own tool). The API reads `AUCTIONS_USERS`, a comma-separated list of user ids or usernames, and answers `404` on every `/auctions` route to any other account, so the feature is not even visible. `GET /me` returns `features: ["auctions"]` to the accounts that have it, and the web app shows the link and the page only then. Nobody is named in the code; with the variable empty or unset nobody has the feature. The same mechanism (`apps/api/src/features.ts`) can open other features to a few accounts.

## Consequences
- `AUCTIONS_USERS` must be set in the API's Vercel environment for anyone to use the page.
- Migration `0004` must be applied to production before the API that reads it is deployed (see the `db-migration` skill).
- Only one currency is supported; a bid in dollars must be converted by hand.
- Closing times are stored as instants and shown in the device's time zone.
