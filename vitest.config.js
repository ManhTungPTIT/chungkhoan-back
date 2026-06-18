import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["my-app/src/**/*.test.js"],
  },
});
