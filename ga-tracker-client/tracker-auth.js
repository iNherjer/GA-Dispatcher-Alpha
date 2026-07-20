const https = require('https');

const DEFAULT_AUTH_URL = 'https://ga-proxy.einherjer.workers.dev/api/auth/verify';

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
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json'
      },
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size <= 64 * 1024) chunks.push(chunk);
      });
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch (_) {}
        resolve({ status: Number(response.statusCode) || 0, data });
      });
    });
    request.on('timeout', () => request.destroy(new Error('Zeitüberschreitung bei der Konto-Prüfung')));
    request.on('error', reject);
    request.end(body);
  });
}

async function verifyTrackerCredentials(syncId, pin, options = {}) {
  const requestedId = String(syncId || '').trim();
  const requestedPin = String(pin || '').trim();
  if (!requestedId || !requestedPin) {
    return { ok: false, code: 'credentials_missing', message: 'Pilot-ID und PIN fehlen.' };
  }

  const request = typeof options.request === 'function' ? options.request : postJson;
  let response;
  try {
    response = await request(options.authUrl || DEFAULT_AUTH_URL, {
      pilotId: requestedId,
      pin: requestedPin
    }, options.timeoutMs || 10000);
  } catch (error) {
    return {
      ok: false,
      code: 'auth_unavailable',
      message: `Konto-Prüfung nicht erreichbar: ${error?.message || error}`
    };
  }

  if (response?.status === 200 && response?.data?.ok && response?.data?.pilotId) {
    return { ok: true, pilotId: String(response.data.pilotId).trim() };
  }
  if (response?.status === 404) {
    return {
      ok: false,
      code: 'pilot_not_found',
      message: 'Pilot-ID nicht gefunden. Bitte Eingabe prüfen.'
    };
  }
  if (response?.status === 401) {
    return { ok: false, code: 'pin_invalid', message: 'Der PIN für diese Pilot-ID ist falsch.' };
  }
  if (response?.status === 409) {
    return { ok: false, code: 'pilot_id_collision', message: 'Pilot-ID ist nicht eindeutig. Bitte Support kontaktieren.' };
  }
  return {
    ok: false,
    code: response?.data?.code || 'auth_failed',
    message: response?.data?.error || `Konto-Prüfung fehlgeschlagen (HTTP ${response?.status || 0}).`
  };
}

module.exports = {
  DEFAULT_AUTH_URL,
  postJson,
  verifyTrackerCredentials
};
