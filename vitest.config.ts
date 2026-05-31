import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 与 CI 一致，避免「本地日期」用例因机器时区漂移
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
