// Tiny zero-dependency static server for the reel.
// Also accepts POST /save?name=file.mp4 so the in-page exporter can drop
// finished renders straight into ./renders instead of the Downloads folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || process.argv[2] || 5199);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'POST' && url.pathname === '/save') {
      const raw = path.basename(url.searchParams.get('name') || 'render.mp4');
      const name = raw.replace(/[^\w.\-]/g, '_');
      const sub = (url.searchParams.get('dir') || '').replace(/[^\w\-]/g, '');
      const dir = path.join(root, 'renders', sub);
      fs.mkdirSync(dir, { recursive: true });
      const out = fs.createWriteStream(path.join(dir, name));
      req.pipe(out);
      out.on('finish', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: `renders/${sub ? sub + '/' : ''}${name}` }));
      });
      out.on('error', (e) => {
        res.writeHead(500);
        res.end(String(e));
      });
      return;
    }

    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, path.normalize(p));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      const type = MIME[path.extname(file)] || 'application/octet-stream';
      // Byte ranges, so exported MP4s can be scrubbed when opened in the browser.
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, st.size - Number(range[2]));
        const end = range[1] && range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
        if (start > end || start >= st.size) {
          res.writeHead(416, { 'content-range': `bytes */${st.size}` });
          res.end();
          return;
        }
        res.writeHead(206, {
          'content-type': type,
          'content-range': `bytes ${start}-${end}/${st.size}`,
          'content-length': end - start + 1,
          'accept-ranges': 'bytes',
          'cache-control': 'no-store',
        });
        fs.createReadStream(file, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, {
        'content-type': type,
        'content-length': st.size,
        'accept-ranges': 'bytes',
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Presentation animator → http://localhost:${port}`);
  });
