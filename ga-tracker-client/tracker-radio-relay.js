'use strict';
function createRadioRelay(execute, now = Date.now) {
  const requests = new Map();
  let timestamps = [];
  return function(command) {
    if (typeof command.clientId !== 'string' || !command.clientId || command.clientId.length > 220
      || typeof command.commandId !== 'string' || !command.commandId || command.commandId.length > 220) return Promise.resolve({ok:false,error:'radio_command_invalid'});
    const key = command.clientId + ':' + command.commandId;
    const fingerprint = JSON.stringify(command.payload);
    for (const [id, entry] of requests) if (now() - entry.at > 600000) requests.delete(id);
    const previous = requests.get(key);
    if (previous) return previous.fingerprint === fingerprint ? previous.promise : Promise.resolve({ok:false,error:'command_id_conflict'});
    timestamps = timestamps.filter(at => now() - at < 60000);
    if (timestamps.length >= 60) return Promise.resolve({ok:false,error:'radio_rate_limited'});
    if (requests.size >= 256) return Promise.resolve({ok:false,error:'radio_rate_limited'});
    timestamps.push(now());
    const promise = Promise.resolve().then(() => execute(command.payload || {})).catch(error => ({ok:false,error:error.message}));
    requests.set(key,{fingerprint,promise,at:now()});
    return promise;
  };
}
function hasRadioPin(envelope, command, expectedPin) {
  return Boolean(expectedPin) && String(command.pin || envelope.pin || '') === String(expectedPin);
}
module.exports = {createRadioRelay, hasRadioPin};
