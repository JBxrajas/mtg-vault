import { z } from "zod";

export const conditionSchema = z.enum(["NM", "LP", "MP", "HP", "DMG"]);
export type Condition = z.infer<typeof conditionSchema>;

export const collectionEntrySchema = z.object({
  printingId: z.string().uuid(),
  quantity: z.number().int().positive(),
  foil: z.boolean().default(false),
  condition: conditionSchema.default("NM"),
  language: z.string().default("en"),
  purchasePrice: z.number().nonnegative().optional(),
});
export type CollectionEntry = z.infer<typeof collectionEntrySchema>;
