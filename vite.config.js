import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // use relative paths so `file://` loads built assets correctly
  server: { port: 5173 },
});
