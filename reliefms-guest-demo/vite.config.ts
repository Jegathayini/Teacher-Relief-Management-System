
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  base: "/Teacher-Relief-Management-System/",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
  },
})
