import { defineConfig } from "tsup";

// Vercel runs only apps/api, and the workspace packages export TypeScript source,
// so they are bundled in. Third-party dependencies stay external (installed by Vercel).
export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  outDir: ".",
  noExternal: ["@mtg-vault/shared", "@mtg-vault/db"],
});
