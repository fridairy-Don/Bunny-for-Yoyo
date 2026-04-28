import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal Vitest config. We run in jsdom so React-DOM hooks have a
// document, and surface the standard jest-dom matchers via setup.ts.
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
