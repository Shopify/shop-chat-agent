import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["test/**/*.test.js"],
    globalSetup: ["test/global-setup.js"],
    setupFiles: ["test/setup.js"],
    fileParallelism: false,
  },
});
