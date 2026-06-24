import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "frontend/src"),
      "@contracts": path.resolve(templateRoot, "backend/contracts"),
      "@db": path.resolve(templateRoot, "backend/db"),
    },
  },
  test: {
    environment: "node",
    include: ["backend/api/**/*.test.ts", "backend/api/**/*.spec.ts"],
  },
});
