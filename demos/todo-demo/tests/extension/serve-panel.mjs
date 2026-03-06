import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve } from 'node:path'

const DIST = resolve(import.meta.dirname, '../../../../packages/devtools/dist')
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }

createServer(async (req, res) => {
  const file = resolve(DIST, (req.url ?? '/').slice(1) || 'index.html')
  try {
    const data = await readFile(file)
    const ext = extname(file)
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}).listen(5180, () => console.log('Panel server listening on http://localhost:5180'))
