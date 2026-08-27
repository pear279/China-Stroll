import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
  },
})
