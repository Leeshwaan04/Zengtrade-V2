// TradePro — minimal Claude proxy (Node 18+, zero dependencies).
//
// Why this exists: TradePro is a static, client-side app. A browser must NEVER
// hold an Anthropic API key (it would be visible to every visitor). This proxy
// keeps the key server-side, forwards chat requests to the Messages API, and
// streams the SSE response back to the browser. Point the app's AI settings at
// http://localhost:8787/v1/messages
//
// Run:  ANTHROPIC_API_KEY=sk-ant-... node proxy/claude-proxy.mjs
//
// Security:
//  - The key is read from the environment and never logged or echoed.
//  - CORS is restricted to localhost origins by default (set ALLOW_ORIGIN to override).
//  - Request bodies are capped and never persisted.

import http from 'node:http';

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('✗ Set ANTHROPIC_API_KEY in the environment first.'); process.exit(1); }

const PORT = Number(process.env.PORT || 8787);
const UPSTREAM = 'https://api.anthropic.com/v1/messages';
const ALLOW = process.env.ALLOW_ORIGIN || ''; // explicit override; otherwise localhost-only

function setCors(req, res) {
  const o = req.headers.origin || '';
  const ok = ALLOW ? o === ALLOW
    : (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || o === 'null' || o === '');
  if (ok && o) res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  return ok;
}

const server = http.createServer((req, res) => {
  const ok = setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(ok ? 204 : 403); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('POST only'); return; }
  if (!ok) { res.writeHead(403); res.end('origin not allowed'); return; }

  let body = '';
  req.on('data', c => { body += c; if (body.length > 1_000_000) req.destroy(); });
  req.on('end', async () => {
    try {
      const upstream = await fetch(UPSTREAM, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
        body,
      });
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
      if (upstream.body) {
        const reader = upstream.body.getReader();
        for (;;) { const { value, done } = await reader.read(); if (done) break; res.write(Buffer.from(value)); }
      }
      res.end();
    } catch (e) {
      res.writeHead(502); res.end(JSON.stringify({ error: { message: 'proxy upstream error: ' + String(e && e.message || e) } }));
    }
  });
});

server.listen(PORT, () => console.log(`✓ Claude proxy → POST http://localhost:${PORT}/v1/messages  (model handled by the app; key stays here)`));
