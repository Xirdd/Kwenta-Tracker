import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
  },
  plugins: [
    VitePWA({
      // The new service worker installs in the background, takes over on the
      // next load, and old precaches get cleaned up — no update prompt needed.
      registerType: "autoUpdate",

      // injectManifest (not generateSW) so src/sw.js is used as-is. Push
      // notifications need a custom `push` listener, and all runtime caching
      // rules now live in that file too — NOTE: with injectManifest, a
      // `workbox: { runtimeCaching }` block here would be silently ignored.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectRegister: "auto",

      injectManifest: {
        // Everything the app shell needs to boot with zero network: HTML, JS,
        // CSS, icons, and any self-hosted fonts.
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff,woff2,webmanifest}"],
        // Default is 2 MiB per file. The main bundle (supabase-js + jspdf) is
        // well under this today, but a file over the limit is skipped from the
        // precache with only a build warning — which would silently break
        // offline. Headroom is cheap insurance.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },

      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],

      manifest: {
        id: "/",
        name: "Kwenta Tracker",
        short_name: "Kwenta",
        description:
          "Sulit sa bawat piso — a ledger-style income and expense tracker for the Philippines.",
        lang: "en-PH",
        categories: ["finance", "productivity"],
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0e211b",
        theme_color: "#0e211b",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
});
