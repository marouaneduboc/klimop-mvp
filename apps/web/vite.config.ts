import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: { host: '192.168.68.107', port: 5174, strictPort: true }
})
