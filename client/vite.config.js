import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3040, // Set your desired port number
    open: true, // Optional: automatically opens the browser
    // proxy: {
    //   '/api': 'http://localhost:5060'
    // }
  },
});
