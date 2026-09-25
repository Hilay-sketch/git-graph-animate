import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@gitgraph/react": fileURLToPath(
        new URL("../src/index.tsx", import.meta.url),
      ),
    },
  },
});
