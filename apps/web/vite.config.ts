import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  // Use relative paths so the built app works on GitHub Pages subpaths.
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: false,
  },
  preview: {
    host: '0.0.0.0',
    port: 5175,
  },
})
