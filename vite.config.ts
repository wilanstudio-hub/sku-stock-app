import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Remove `crossorigin` attribute from all script/link tags in the built HTML.
    // iOS 26 beta WebKit has a regression where crossorigin module loading
    // crashes the renderer before any JavaScript executes.
    {
      name: "remove-crossorigin",
      transformIndexHtml(html: string) {
        return html.replace(/\scrossorigin(?:="[^"]*")?/g, "");
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // Disable modulepreload polyfill — avoids inline JS that runs before our
    // code and may trigger iOS 26 beta WebKit crash during module bootstrapping.
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // PDF export — already lazy-loaded, keep isolated
          if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("pdfExport")) {
            return "pdf";
          }
          // Supabase — large auth + realtime client
          if (id.includes("@supabase")) {
            return "supabase";
          }
          // React core
          if (id.includes("react-dom") || id.includes("react-router")) {
            return "react";
          }
          // Radix UI + shadcn (lots of small packages, keep together)
          if (id.includes("@radix-ui") || id.includes("cmdk") || id.includes("vaul") || id.includes("lucide")) {
            return "ui";
          }
          // TanStack Query
          if (id.includes("@tanstack")) {
            return "query";
          }
        },
      },
    },
  },
}));
