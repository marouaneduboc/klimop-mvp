import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

const certDir = path.resolve(__dirname, 'certs')
const certFile = path.join(certDir, 'local-cert.pem')
const keyFile = path.join(certDir, 'local-key.pem')
const hasMkcert = fs.existsSync(certFile) && fs.existsSync(keyFile)
/** Escape hatch: KLIMOP_HTTP=1 keeps plain HTTP (localhost mic still works). */
const forceHttp = process.env.KLIMOP_HTTP === '1'

const plugins: PluginOption[] = [react()]
let https: { key: Buffer; cert: Buffer } | undefined

if (!forceHttp) {
  if (hasMkcert) {
    https = {
      key: fs.readFileSync(keyFile),
      cert: fs.readFileSync(certFile),
    }
  } else {
    // Untrusted self-signed; phone must tap through browser warning.
    plugins.push(basicSsl())
  }
}

export default defineConfig({
  // Use relative paths so the built app works on GitHub Pages subpaths.
  base: './',
  plugins,
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: false,
    ...(https ? { https } : {}),
  },
  preview: {
    host: '0.0.0.0',
    port: 5175,
    ...(https ? { https } : {}),
  },
})
