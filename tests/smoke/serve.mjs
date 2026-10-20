// Minimal static server for smoke tests. Mimics GitHub Pages: the site can live under a sub-path, and an unknown
// path gets 404.html (which is a copy of index.html, so client-side routes like /settings still load).
// Usage: node serve.mjs <dir> <port> [/base-path/]
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const [dir = '.', port = '8080', basePath = '/'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.dll': 'application/octet-stream', '.dat': 'application/octet-stream', '.blat': 'application/octet-stream',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
async function send(res, file, status = 200) {
  const body = await readFile(file);
  res.writeHead(status, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body);
}
http.createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(basePath)) { res.writeHead(404); return res.end('outside the site'); }
  let file = path.join(dir, url.slice(basePath.length));
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    return await send(res, file);
  } catch {
    const fallback = path.join(dir, '404.html');
    try { await stat(fallback); return await send(res, fallback, 404); } catch { return await send(res, path.join(dir, 'index.html')); }
  }
}).listen(+port, () => console.log(`serving ${dir} at http://localhost:${port}${basePath}`));
