/**
 * Simple static file server for Playwright E2E tests.
 * Serves the built renderer from out/renderer/.
 *
 * The CSP meta tag is stripped so that addInitScript works in Playwright.
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 5199
const RENDERER_DIR = path.resolve(__dirname, '..', 'out', 'renderer')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
}

const server = http.createServer((req, res) => {
  let urlPath = req.url === '/' ? '/index.html' : req.url
  const filePath = path.join(RENDERER_DIR, urlPath)

  const ext = path.extname(filePath).toLowerCase()
  const mime = MIME_TYPES[ext] || 'application/octet-stream'

  try {
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // SPA fallback: serve index.html for all non-file routes
      const indexPath = path.join(RENDERER_DIR, 'index.html')
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf-8')
        // Strip CSP meta tag so addInitScript works
        html = html.replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html)
        return
      }
      res.writeHead(404)
      res.end('Not found')
      return
    }

    let content = fs.readFileSync(filePath)
    if (ext === '.html') {
      // Strip CSP from any HTML file
      content = content.toString().replace(/<meta[^>]*Content-Security-Policy[^>]*>/gi, '')
      res.writeHead(200, { 'Content-Type': mime })
      res.end(content)
    } else {
      res.writeHead(200, { 'Content-Type': mime })
      res.end(content)
    }
  } catch (e) {
    res.writeHead(500)
    res.end('Internal error')
  }
})

server.listen(PORT, () => {
  console.log(`[e2e-server] http://localhost:${PORT}`)
  console.log(`[e2e-server] serving ${RENDERER_DIR}`)
})
