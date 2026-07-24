import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "static",
  base: "./",
  publicDir: "../public",
  plugins: [react()],
  build: {
    outDir: "../outputs/promptfall-game",
    emptyOutDir: true,
    sourcemap: true,
  },
});
