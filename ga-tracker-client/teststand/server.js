'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
async function startServer(simulator, { port = 0, trackerPort = 0 } = {}) {
  const token = crypto.randomBytes(24).toString('hex');
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace('__TOKEN__', token);
  const server = http.createServer(async (req, res) => {
    const reply = (code, value, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(type.startsWith('application/json') ? JSON.stringify(value) : value); };
    if (req.headers.host !== `127.0.0.1:${server.address().port}`) return reply(403, { error: 'loopback_host_required' });
    if (req.method === 'GET' && req.url === '/') return reply(200, html, 'text/html; charset=utf-8');
    if (req.method === 'GET' && req.url === '/state') return reply(200, simulator.snapshot());
    if (req.method === 'GET' && req.url === '/journal') return reply(200, simulator.journal);
    if (req.method === 'GET' && req.url === '/tracker') {
      if (!trackerPort) return reply(200, { mode: 'Simulator-Demo ohne Tracker' });
      const request = http.get({ hostname: '127.0.0.1', port: trackerPort, path: '/api/v1/status', timeout: 1500 }, response => {
        let body = ''; response.on('data', b => { body += b; if (body.length > 2 * 1024 * 1024) request.destroy(); });
        response.on('end', () => { try { reply(200, JSON.parse(body)); } catch (_) { reply(502, { error: 'tracker_response_invalid' }); } });
      });
      request.on('timeout', () => request.destroy(new Error('tracker_timeout')));
      request.on('error', () => reply(200, { mode: 'Tracker wartet auf Anmeldung oder startet', efbUrl: `http://127.0.0.1:${trackerPort}/efb/v1/` }));
      return;
    }
    if (req.method === 'POST' && req.url === '/control') {
      if (req.headers['x-teststand-token'] !== token || !String(req.headers['content-type']).startsWith('application/json')) return reply(403, { error: 'token_required' });
      let body = ''; try { for await (const chunk of req) { body += chunk; if (body.length > 8192) return reply(413, { error: 'too_large' }); } simulator.control(JSON.parse(body)); reply(200, { ok: true }); } catch (error) { reply(400, { error: error.message }); }
      return;
    }
    reply(404, { error: 'not_found' });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
module.exports = { startServer };
