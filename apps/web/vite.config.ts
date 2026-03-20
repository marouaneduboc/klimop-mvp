import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  // Use relative paths so the built app works on GitHub Pages subpaths.
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true }
})
