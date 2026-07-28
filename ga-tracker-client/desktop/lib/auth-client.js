const https = require('node:https');

const AUTH_URL = 'https://ga-proxy.einherjer.workers.dev/api/auth/verify';

function postJson(url, payload, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload || {});
    const target = new URL(url);
    const request = https.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes <= 64 * 1024) chunks.push(chunk);
      });
      response.on('end', () => {
        let data = null;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
        resolve({ status: Number(response.statusCode) || 0, data });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Zeitüberschreitung bei der Konto-Prüfung')));
    request.on('error', reject);
    request.end(body);
  });
}

async function verifyCredentials(pilotId, pin, options = {}) {
  const requestedId = String(pilotId || '').trim();
  const requestedPin = String(pin || '').trim();
  if (!requestedId || !/^\d{4}$/.test(requestedPin)) {
    return { ok: false, message: 'Bitte Pilot-ID und vierstelligen PIN eingeben.' };
  }

  let response;
  try {
    response = await (options.request || postJson)(
      options.authUrl || AUTH_URL,
      { pilotId: requestedId, pin: requestedPin },
      options.timeoutMs || 10000
    );
  } catch (error) {
    return { ok: false, message: `Konto-Prüfung nicht erreichbar: ${error?.message || error}` };
  }

  if (response?.status === 200 && response?.data?.ok && response?.data?.pilotId) {
    return { ok: true, pilotId: String(response.data.pilotId).trim() };
  }
  if (response?.status === 404) return { ok: false, message: 'Pilot-ID nicht gefunden.' };
  if (response?.status === 401) return { ok: false, message: 'Der PIN für diese Pilot-ID ist falsch.' };
  return {
    ok: false,
    message: String(response?.data?.error || `Konto-Prüfung fehlgeschlagen (HTTP ${response?.status || 0}).`)
  };
}

module.exports = { AUTH_URL, postJson, verifyCredentials };
