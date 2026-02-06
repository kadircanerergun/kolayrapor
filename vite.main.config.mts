import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Inject update feed URL at build time so it survives Vite bundling
    "process.env.UPDATE_FEED_URL": JSON.stringify(
      process.env.UPDATE_FEED_URL || ""
    ),
  },
  build: {
    rollupOptions: {
      external: [
        "playwright",
        "playwright-core",
        /^playwright.*/,
        "module",
      ],
    },
  },
});
