import { z } from "zod";

// Leaf module: other modules import these directly instead of through index.ts, which re-exports
// them, to avoid an import cycle (index.ts re-exports modules that need these at load time).

export const conditionSchema = z.enum(["NM", "LP", "MP", "HP", "DMG"]);
export type Condition = z.infer<typeof conditionSchema>;

/** Physical finish of an owned card. Matches the `finishes` Scryfall lists per printing. */
export const finishSchema = z.enum(["nonfoil", "foil", "etched"]);
export type Finish = z.infer<typeof finishSchema>;
