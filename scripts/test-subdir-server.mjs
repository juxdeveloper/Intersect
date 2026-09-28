import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), 'dist');
const port = 4180;
const prefix = '/subpath';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.whl': 'application/octet-stream',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (!urlPath.startsWith(prefix)) {
    res.writeHead(404);
    res.end('Not found (outside prefix)');
    return;
  }

  let relPath = urlPath.slice(prefix.length);
  if (relPath === '' || relPath === '/') {
    relPath = '/index.html';
  }

  const filePath = path.join(distDir, relPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('File not found: ' + relPath);
    return;
  }

  const ext = path.extname(filePath);
  const mime = mimeTypes[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, () => {
  console.log(`Subpath static server listening on http://localhost:${port}${prefix}/`);
});
