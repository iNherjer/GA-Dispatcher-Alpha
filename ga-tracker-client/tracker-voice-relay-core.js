'use strict';

// No arbitrary HTTP proxy: only playback of already generated mission audio.
function handleVoiceRelay(service, command = {}, audioControl = null) {
  const clientId = String(command.clientId || '').trim().slice(0, 160);
  if (!clientId) throw new Error('invalid_client_id');
  const effectId = String(command.effectId || '').trim().slice(0, 220);
  switch (command.action) {
    case 'settings':
      if (!audioControl) throw new Error('audio_control_unavailable');
      return audioControl.snapshot();
    case 'settings_update':
      if (!audioControl) throw new Error('audio_control_unavailable');
      return audioControl.update(command);
    case 'next': {
      const job = service.getNextPlayback(clientId, String(command.deviceId || ''));
      return { available: Boolean(job), job };
    }
    case 'claim': return service.claimPlayback({ effectId, clientId, deviceId: command.deviceId, leaseMs: audioControl ? 5000 : 120000 });
    case 'renew': return service.renewPlayback({ ...command, effectId, clientId });
    case 'release': return service.releasePlayback({ effectId, clientId, completed: command.completed === true, retryable: command.retryable === true, deviceSwitch: command.deviceSwitch === true, position: command.position, error: command.error });
    case 'audio':
    case 'cue': {
      if (audioControl && audioControl.snapshot().target.deviceId !== command.deviceId) throw new Error('audio_device_not_selected');
      const clip = command.action === 'cue' ? service.getCueAudio(effectId) : service.getAudio(effectId);
      if (!clip) throw new Error('voice_audio_not_found');
      const offset = Number(command.offset || 0);
      if (!Number.isSafeInteger(offset) || offset < 0 || offset >= clip.body.length || clip.body.length > 8 * 1024 * 1024) throw new Error('voice_audio_range_invalid');
      const bytes = clip.body.subarray(offset, offset + 24 * 1024);
      return { offset, total: clip.body.length, contentType: clip.contentType, data: bytes.toString('base64') };
    }
    default: throw new Error('voice_relay_action_invalid');
  }
}
module.exports = { handleVoiceRelay };
