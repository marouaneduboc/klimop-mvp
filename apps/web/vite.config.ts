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

/** Missing listen MP3s must 404 (not SPA index.html) so the client falls back to TTS fast. */
function listenAudioNoSpaFallback(): PluginOption {
  const publicListenDir = path.resolve(__dirname, 'public/audio/listen')
  const isListenMp3 = (rawUrl: string | undefined) => {
    const pathOnly = (rawUrl || '').split('?')[0] || ''
    return /\/audio\/listen\/[^/]+\.mp3$/i.test(pathOnly)
  }
  const listenFileName = (rawUrl: string | undefined) => {
    const pathOnly = decodeURIComponent((rawUrl || '').split('?')[0] || '')
    const m = pathOnly.match(/\/audio\/listen\/([^/]+\.mp3)$/i)
    return m?.[1] || null
  }
  const guard = (
    req: { url?: string },
    res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
    next: () => void,
  ) => {
    if (!isListenMp3(req.url)) {
      next()
      return
    }
    const name = listenFileName(req.url)
    if (name && fs.existsSync(path.join(publicListenDir, name))) {
      next()
      return
    }
    // Pre-middleware: stop before Vite SPA HTML fallback.
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Listen clip not found')
  }
  return {
    name: 'listen-audio-no-spa',
    configureServer(server) {
      // Register BEFORE internal middlewares (do not return a post-hook).
      server.middlewares.use(guard)
    },
    configurePreviewServer(server) {
      server.middlewares.use(guard)
    },
  }
}

const plugins: PluginOption[] = [react(), listenAudioNoSpaFallback()]
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
