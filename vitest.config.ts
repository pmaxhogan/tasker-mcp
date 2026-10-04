import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Device tests need a live emulator or phone; they run via npm run test:device only.
    exclude: ["test/device/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["**/*.d.ts", "dist/**", "src/index.ts"],
    },
  },
});
