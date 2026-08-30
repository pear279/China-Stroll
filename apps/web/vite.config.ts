import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "China Stroll",
        short_name: "China Stroll",
        description: "A calm Beijing companion for planning and exploring together.",
        theme_color: "#f4f0e8",
        background_color: "#f4f0e8",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        globIgnores: ["assets/TravelMap-*.js", "assets/maplibre-gl-worker-*.js"],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith("/places/") && url.pathname.endsWith(".webp"),
          handler: "CacheFirst",
          options: {
            cacheName: "reviewed-place-images",
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
          },
        }],
        navigateFallback: "/index.html"
      }
    })
  ],
  server: { port: 5173 },
  build: { outDir: "../../dist/web", emptyOutDir: true }
})
