import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the same build can be loaded from Electron (file://).
  base: "./",
  server: { port: 5173 },
});
