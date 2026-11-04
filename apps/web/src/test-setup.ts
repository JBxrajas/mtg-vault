import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { resetLocale } from "./i18n";

// Unmount rendered components between tests (a no-op in Node-environment tests).
// Every test starts in English whatever the language of the machine running it, and one that switches language
// cannot leak it into the next.
beforeEach(() => resetLocale());
afterEach(() => {
  cleanup();
  resetLocale();
});
