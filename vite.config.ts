import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Social cards need an absolute image URL: build with SITE_URL=https://your.site to get one. Without it
// the image path stays relative, which link previews in most chat apps still follow.
const site = (process.env.SITE_URL ?? "").replace(/\/$/, "");
const siteUrl: Plugin = { name: "site-url", transformIndexHtml: (html) => html.replaceAll("%SITE_URL%", site) };

export default defineConfig({
  plugins: [react(), tailwindcss(), siteUrl],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
