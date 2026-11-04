import { defineConfig } from "vitest/config";

// Component tests (`*.test.tsx`) opt into jsdom with a `// @vitest-environment jsdom` first line;
// everything else runs in plain Node.
export default defineConfig({
  test: {
    include: ["apps/*/src/**/*.test.{ts,tsx}", "packages/*/src/**/*.test.ts", ".claude/hooks/*.test.ts"],
    setupFiles: ["apps/web/src/test-setup.ts"],
  },
});
