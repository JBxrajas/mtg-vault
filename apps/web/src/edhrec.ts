/** The EDHREC page slug of a card: front face, no accents or punctuation, words joined by hyphens. */
export function edhrecSlug(name: string): string {
  return (name.split("//")[0] ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`,.!?:"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Link to a commander's page on EDHREC. We only link: nothing is fetched from EDHREC, because its terms do not
 * allow automated requests. The slug rule was checked against one commander only; a wrong one lands on EDHREC's own 404.
 */
export const edhrecUrl = (commanderName: string) => `https://edhrec.com/commanders/${edhrecSlug(commanderName)}`;

/** Opens a page in a small separate window next to the deck. The new window gets no access to this one. */
export function openSideWindow(url: string, open: typeof window.open = window.open.bind(window)) {
  open(url, "mtg-vault-side", "popup,width=520,height=820,noopener,noreferrer");
}
