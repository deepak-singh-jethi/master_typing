import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  define: {
    __BUILD_ID__: JSON.stringify(process.env.VITE_BUILD_ID || process.env.npm_package_version || "development"),
  },

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
