// The Hidden Energy System: live quiz server.
// Serves the static site and runs the game engine over WebSockets.
//   npm start            -> http://localhost:3000
//   PORT=8080 npm start  -> another port
//   PUBLIC_URL=https://my-quiz.onrender.com npm start  -> QR code points there

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Hub } from './shared/engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const ANSWER_SECONDS = Number(process.env.ANSWER_SECONDS) || undefined; // for rehearsals/tests only

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.webm': 'video/webm', '.mp4': 'video/mp4',
};

// Short, friendly routes.
const ROUTES = { '/': '/index.html', '/host': '/host.html', '/play': '/play.html', '/join': '/play.html', '/online': '/play.html', '/classroom': '/host.html' };

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = decodeURIComponent(url.pathname);

  if (p === '/healthz') return send(res, 200, 'ok');
  if (p === '/api/info') {
    return send(res, 200, JSON.stringify({ publicUrl: process.env.PUBLIC_URL || null, lan: lanAddresses(), port: PORT }), MIME['.json'], { 'Cache-Control': 'no-store' });
  }
  if (/^\/join\/\d{4,5}$/.test(p)) p = '/play.html'; // /join/4821 -> player page, code read client-side
  // Dev mode: big screen and phone side by side with practice bots (the built preview).
  if (p === '/dev' || p === '/dev/') {
    return fs.readFile(path.join(PUBLIC, '..', 'docs', 'index.html'), (err, buf) => {
      if (err) return send(res, 404, 'Not found');
      send(res, 200, buf, MIME['.html'], { 'Cache-Control': 'no-cache' });
    });
  }
  p = ROUTES[p] || p;

  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    const cache = ext === '.html' ? 'no-cache' : (/\.(woff2|png|jpe?g|webp|mp3|wav|ogg)$/.test(ext) ? 'public, max-age=604800' : 'no-cache');
    // A reload (the big screen reloads after Back; phones rejoin) asks "still the
    // same?" and gets a tiny 304 instead of the whole file again.
    const etag = `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
    const head = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, ETag: etag, 'X-Content-Type-Options': 'nosniff', ...(TEXT.test(ext) ? { Vary: 'Accept-Encoding' } : {}) };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, head); return res.end(); }
    // Text files go out gzipped (about a third of the size), made once and kept.
    if (TEXT.test(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      return gzipped(file, etag, (gz) => {
        if (!gz) return send(res, 500, 'Error');
        res.writeHead(200, { ...head, 'Content-Encoding': 'gzip', 'Content-Length': gz.length });
        res.end(req.method === 'HEAD' ? undefined : gz);
      });
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});

const TEXT = /^\.(html|js|mjs|css|json|svg)$/;
const gzCache = new Map(); // file -> { etag, gz }
function gzipped(file, etag, cb) {
  const hit = gzCache.get(file);
  if (hit && hit.etag === etag) return cb(hit.gz);
  fs.readFile(file, (err, buf) => {
    if (err) return cb(null);
    zlib.gzip(buf, { level: 9 }, (e, gz) => { if (e) return cb(null); gzCache.set(file, { etag, gz }); cb(gz); });
  });
}

const hub = new Hub({ answerSeconds: ANSWER_SECONDS });
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

wss.on('connection', (ws) => {
  const conn = {
    send(obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); },
  };
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Light flood guard: at most 30 messages per second per socket.
  let windowStart = Date.now(), count = 0;
  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; count = 0; }
    if (++count > 30) return;
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    hub.handle(conn, msg);
  });
  ws.on('close', () => hub.drop(conn));
  ws.on('error', () => {});
});

// Drop dead sockets (phones that went to sleep) so "everyone answered" stays accurate.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
  hub.sweep();
}, 10_000).unref();

server.listen(PORT, () => {
  console.log(`\n  The Hidden Energy System is live\n`);
  console.log(`  Host screen:   http://localhost:${PORT}/host`);
  for (const ip of lanAddresses()) console.log(`  On your Wi-Fi: http://${ip}:${PORT}/host`);
  if (process.env.PUBLIC_URL) console.log(`  Public URL:    ${process.env.PUBLIC_URL}`);
  console.log('');
});
