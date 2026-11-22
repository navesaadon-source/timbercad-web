import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

// GitHub Pages: base "./" + HashRouter works on any repo path / custom domain.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), tailwindcss(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { outDir: mode === "demo" ? "dist-demo" : "dist", assetsInlineLimit: mode === "demo" ? 100000000 : 4096 },
}));
