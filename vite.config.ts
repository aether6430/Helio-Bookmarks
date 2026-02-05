import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "./" : "/",
  root: "web",
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5174",
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
}));
