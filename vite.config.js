import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist",
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // injectManifest (rather than the default generateSW) means the
      // service worker at src/sw.js is used as-is, with the precache
      // manifest injected into it at build time — needed because push
      // notifications require a custom `push` event listener, which
      // generateSW's auto-generated worker has no way to add.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
      },
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Kwenta — Budget Ledger",
        short_name: "Kwenta",
        description:
          "Sulit sa bawat piso — a ledger-style income and expense tracker for the Philippines.",
        start_url: "/",
        display: "standalone",
        background_color: "#0e211b",
        theme_color: "#0e211b",
        orientation: "portrait",
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
