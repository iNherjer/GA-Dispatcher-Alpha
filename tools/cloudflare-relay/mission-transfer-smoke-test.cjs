/* Uses an isolated, random test room. No user/cloud mission state is touched. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const WebSocket = require('../../ga-tracker-client/node_modules/ws');
const core = require('../../mission-transfer-core');
async function run(url, label) {
  const syncId = `TRANSFER-${crypto.randomUUID()}`.toUpperCase(), pin = 'transport-test';
  const room = crypto.createHash('sha256').update(syncId).digest('hex');
  const sockets = [], transports = [];
  const deliveries = [], errors = [];
  async function connect(role) {
    const socket = new WebSocket(url.replace('{room}', room), { handshakeTimeout: 10000 }); sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
    socket.on('error', () => {});
    socket.send(JSON.stringify({ type: 'join', syncId, pin, relayRole: role, clientId: role === 'viewer' ? 'phone' : 'tracker' }));
    return socket;
  }
  try {
    const trackerSocket = await connect('tracker'), appSocket = await connect('viewer');
    function endpoint(socket, role) {
      const transport = core.create({ role, peer: 'phone', onError: (_, error) => errors.push(error), sendFrame: frame => {
        const packet = { type: 'gps', syncId, pin, ...(role === 'app' ? { target: 'tracker', commandOnly: true, trackerCommand: frame } : { commandAckOnly: true, trackerAck: frame }) };
        const wire = JSON.stringify(packet); assert.ok(Buffer.byteLength(wire) < 70 * 1024); socket.send(wire); return true;
      } }); transports.push(transport);
      socket.on('message', async raw => {
        try { const msg = JSON.parse(String(raw));
          if (msg.type === 'error') errors.push(msg.message);
          const result = await transport.receive(role === 'app' ? msg.trackerAck : msg.trackerCommand);
          if (result.message) deliveries.push(result.message);
        } catch (error) { errors.push(error.message); }
      }); return transport;
    }
    const tracker = endpoint(trackerSocket, 'tracker'), app = endpoint(appSocket, 'app');
    await new Promise(resolve => setTimeout(resolve, 500));
    const command = { type: 'gps', syncId, pin, trackerCommand: { type: 'mission_snapshot_update', commandId: 'smoke', missionTransferPeer: 'phone', resumeBundle: { text: 'ä🛩'.repeat(150000) } } };
    const ack = { type: 'gps', syncId, pin, trackerAck: { ...command.trackerCommand, type: 'mission_snapshot_request_ack' } };
    app.enqueue(command, 'phone'); tracker.enqueue(ack, 'phone');
    const deadline = Date.now() + 20000;
    while (deliveries.length < 2 && !errors.length && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
    assert.deepEqual(errors, []); assert.equal(deliveries.length, 2);
    assert.deepEqual(deliveries.map(JSON.stringify).sort(), [command, ack].map(JSON.stringify).sort());
    console.log(`${label}: full 900 KiB messages verified in both directions`);
  } finally { for (const tx of transports) tx.close(); for (const ws of sockets) ws.terminate(); }
}
(async () => { await run('wss://ga-relay.einherjer.workers.dev/?room={room}', 'Cloudflare'); await run('wss://websocketrelais.onrender.com/', 'Render'); })().catch(error => { console.error(error.message); process.exitCode = 1; });
