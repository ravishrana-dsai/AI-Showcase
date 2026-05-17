const http = require('http');

const INGEST_PORT = 9877;

function startIngestServer(recordCall) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST' || req.url !== '/ingest') { res.writeHead(404); res.end(); return; }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const p = JSON.parse(body);
        recordCall({
          product:          p.product          || 'Claude.ai',
          model:            p.model            || 'unknown',
          inputTokens:      p.inputTokens      || 0,
          cacheWriteTokens: p.cacheWriteTokens || 0,
          cacheReadTokens:  p.cacheReadTokens  || 0,
          outputTokens:     p.outputTokens     || 0,
          timestamp:        p.timestamp        || new Date().toISOString(),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  });

  server.listen(INGEST_PORT, '127.0.0.1', () => {
    console.log(`Ingest server listening on 127.0.0.1:${INGEST_PORT}`);
  });

  server.on('error', e => console.error('Ingest server error:', e.message));

  return server;
}

module.exports = { startIngestServer, INGEST_PORT };
