# ADR 0013 — Commander knowledge base and deck analysis, without EDHREC data

**Status:** accepted

## Context
We want the deck page to help build a Commander deck: how many lands, how the mana curve looks, whether the deck has enough ramp, card draw and removal, and which brackets exist. We also looked at integrating EDHREC. It has no official API; the JSON endpoints its own pages use are undocumented. Its terms of use allow personal, non-commercial use only, forbid scripts that make automated requests and forbid using the site to build a competing website, and it sends `X-Frame-Options: SAMEORIGIN`, so a browser refuses to show it inside our page.

## Decision
- **The knowledge is data in `packages/shared`** ([`knowledge.ts`](../../packages/shared/src/knowledge.ts)), each figure with its source and a confidence level (official, simulation, community, assumption), explained in [docs/knowledge/commander.md](../knowledge/commander.md). The analysis ([`analysis.ts`](../../packages/shared/src/analysis.ts)) is pure and unit tested, so the API or the desktop app can reuse it.
- **Roles are guessed from the oracle text** with patterns, not from outside tags. They are estimates and the interface says so. The API only has to return `oracleText` and `colorIdentity` with each deck card.
- **Lands follow Karsten's published formula**, shown as a suggestion with a tolerance. Everything else is advice or a rule shown as a **non-blocking warning**.
- **The Game Changers list is not stored or checked.** It changes with every announcement; storing a copy would go stale silently. The brackets guide says so and links to Wizards.
- **EDHREC is a link, not a data source.** The deck page links to a commander's page (new tab, `noopener noreferrer`) and can open it in a side window (`window.open` with `popup,noopener,noreferrer`) loaded by the user's own browser. We do not embed it, proxy it, strip its frame protection, scrape it or republish its data. Nothing derived from EDHREC is used either.
- The panel shows for Commander decks only.

## Alternatives considered
- **Embed EDHREC in an iframe:** refused by the site itself. Proxying the page to remove the header would bypass a protection it set on purpose and would copy its content.
- **Fetch EDHREC's JSON in a job and cache it:** automated requests and reuse of data that the terms do not allow. It stays possible only with their permission.
- **Scryfall's `otag` (Tagger) searches for roles:** more precise than patterns, but not part of the bulk data; each tag would need a search request. Worth revisiting if the patterns prove too weak.

## Consequences
- The deck detail response grows by `oracleText` and `colorIdentity` per card.
- The figures are only as good as their sources; the knowledge document says which were not verified directly (the Karsten article) and which are assumptions (what counts as a cheap spell).
- Suggestions of cards from the user's collection that fit a commander are not done yet; they need a server-side query on color identity and roles.
