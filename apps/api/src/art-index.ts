/** Where the weekly `art-index` workflow publishes the file; override with `ART_INDEX_URL`. */
export const defaultArtIndexUrl = "https://github.com/JBxrajas/mtg-vault/releases/download/art-index/art-index.bin";

export const artIndexUrl = (): string => process.env.ART_INDEX_URL || defaultArtIndexUrl;
