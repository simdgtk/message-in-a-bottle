import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "@webgl", replacement: fileURLToPath(new URL("./src/webgl", import.meta.url)) },
      { find: /^three$/, replacement: "three/webgpu" },
    ],
  },
  server: {
    port: 8080,
    host: true,
  },
});
