import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { knowledgeServerPlugin } from "./src/web/knowledgeServerPlugin";

export default defineConfig({
  plugins: [react(), knowledgeServerPlugin()],
  server: {
    port: 5177
  }
});
