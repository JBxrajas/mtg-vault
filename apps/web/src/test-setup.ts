import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount rendered components between tests (a no-op in Node-environment tests).
afterEach(() => cleanup());
