import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true,
    port: 8080,
    // Same-origin API calls in dev — forwarded to the Assure+_MS backend.
    // Port 8008: 8000 (RAFMS) and 8001 are already taken on this machine.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8008",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
