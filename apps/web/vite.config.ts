import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/klimop-mvp/',
  server: { host: true, port: 5174, strictPort: true }
})
