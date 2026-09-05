import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@identity-aa-sdk/core": path.resolve(__dirname, "../packages/core/src"),
      "@identity-aa-sdk/clerk": path.resolve(__dirname, "../packages/clerk/src"),
      "@identity-aa-sdk/react": path.resolve(__dirname, "../packages/react/src"),
    },
  },
  server: {
    port: 3000,
  },
});
