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

/**
 * Dev/preview: proxy API through Vite so HTTPS pages (mkcert or basicSsl) can reach
 * an HTTP uvicorn on :8000 without mixed-content / wrong-scheme failures.
 * Phone on LAN talks only to Vite; Vite forwards /health /sync /tts to localhost:8000.
 */
const apiProxy = {
  '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  '/sync': { target: 'http://127.0.0.1:8000', changeOrigin: true },
  '/tts': { target: 'http://127.0.0.1:8000', changeOrigin: true },
} as const

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

/** After build, rewrite public/sw.js into dist with hashed JS/CSS in the precache list. */
function swPrecacheBundles(): PluginOption {
  return {
    name: 'sw-precache-bundles',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      const swPath = path.join(distDir, 'sw.js')
      if (!fs.existsSync(swPath)) return
      const assetsDir = path.join(distDir, 'assets')
      const bundleUrls: string[] = []
      if (fs.existsSync(assetsDir)) {
        for (const name of fs.readdirSync(assetsDir)) {
          if (/\.(js|css)$/i.test(name)) bundleUrls.push(`./assets/${name}`)
        }
      }
      bundleUrls.sort()
      let sw = fs.readFileSync(swPath, 'utf8')
      // Bump cache name so old shells without bundles are dropped.
      sw = sw.replace(/const CACHE = 'klimop-shell-v\d+'/, "const CACHE = 'klimop-shell-v2'")
      const marker = 'const PRECACHE = ['
      const start = sw.indexOf(marker)
      if (start < 0) return
      const end = sw.indexOf(']', start)
      if (end < 0) return
      const existing = sw.slice(start + marker.length, end)
      const extras = bundleUrls.map((u) => `  '${u}',`).join('\n')
      // Avoid duplicating if plugin re-runs
      const extraBlock = extras ? `\n${extras}\n` : '\n'
      if (!bundleUrls.some((u) => existing.includes(u))) {
        sw = sw.slice(0, end) + extraBlock + sw.slice(end)
        fs.writeFileSync(swPath, sw)
      }
    },
  }
}

const plugins: PluginOption[] = [react(), listenAudioNoSpaFallback(), swPrecacheBundles()]
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
    proxy: { ...apiProxy },
    ...(https ? { https } : {}),
  },
  preview: {
    host: '0.0.0.0',
    port: 5175,
    proxy: { ...apiProxy },
    ...(https ? { https } : {}),
  },
})
