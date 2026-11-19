'use strict';

// English translation: passengers speak the language the mission was written in.
const assert = require('node:assert/strict');
const test = require('node:test');
const boardingVoiceCore = require('../mission-boarding-voice-core.js');
const outputLanguage = require('../mission-output-language.js');
const distress = require('./tracker-mission-distress-voice-core.js');
const { createTrackerVoiceService } = require('./tracker-voice-service');
const { createMissionVoiceLanguage } = require('./tracker-mission-voice-scope.js');

function geminiService(language, calls) {
  return createTrackerVoiceService({
    provider: 'gemini', apiKey: 'key', ...(language ? { missionLanguage: () => language } : {}),
    fetchRemote: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body });
      if (/tts/.test(url)) return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from('pcm').toString('base64'), mimeType: 'audio/mpeg' } }] } }] }) };
      return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Thanks for the smooth flight.' }] } }] }) };
    }
  });
}

test('German mission: prompt and TTS request stay exactly as before', async () => {
  for (const language of [null, 'de']) {
    const calls = [];
    const service = geminiService(language, calls);
    const job = service.request({ effectId: 'run-1:farewell', kind: 'farewell', prompt: 'Sag tschüss.', fallbackText: 'Tschüss.', speaker: { gender: 'male' } });
    await service.wait(job.effectId);
    const text = calls.find(call => !/tts/.test(call.url));
    assert.equal(text.body.contents[0].parts[0].text, 'Sag tschüss.');
  }
});

test('English mission: directive on the prompt, English delivery, no German clip', async () => {
  const calls = [];
  const service = geminiService('en', calls);
  const job = service.request({ effectId: 'run-2:distress', kind: 'pax_distress', prompt: 'Dir ist übel.', fallbackText: 'Mir ist schlecht.',
    speaker: { gender: 'female' }, ttsStyle: distress.TTS_STYLE.sick });
  await service.wait(job.effectId);
  const text = calls.find(call => !/tts/.test(call.url));
  assert.equal(text.body.contents[0].parts[0].text, 'Dir ist übel.' + outputLanguage.DIRECTIVE);
  const tts = calls.find(call => /tts/.test(call.url));
  assert.ok(JSON.stringify(tts.body).includes(distress.TTS_STYLE_EN.sick));
  assert.equal(JSON.stringify(tts.body).includes('Sprich auf Deutsch'), false);
});

test('explicit request language wins; German fingerprint unchanged', () => {
  const service = createTrackerVoiceService({ provider: 'gemini', apiKey: 'key', missionLanguage: () => 'en', fetchRemote: async () => ({ ok: false }) });
  const a = service.request({ effectId: 'run-3:a', text: 'Hallo.', language: 'de' });
  assert.equal(a.status, 'pending');
});

test('TTS styles: German default unchanged, English for English missions', () => {
  const club = { taskDomain: 'club_utility' };
  assert.match(boardingVoiceCore.conversationalTtsStyle(club, ''), /^Sprich auf Deutsch/);
  assert.match(boardingVoiceCore.conversationalTtsStyle(club, '', 'en'), /^Speak in English/);
  assert.equal(boardingVoiceCore.conversationalTtsStyle({}, '', 'en'), '');
  assert.match(boardingVoiceCore.ttsInput('Hi.', club, '', 'en'), /Text to speak:\nHi\.$/);
  assert.match(boardingVoiceCore.ttsInput('Hallo.', club, ''), /Zu sprechender Text:\nHallo\.$/);
  assert.equal(distress.ttsStyleForLanguage(distress.TTS_STYLE.queasy, 'de'), distress.TTS_STYLE.queasy);
  assert.equal(distress.ttsStyleForLanguage('custom', 'en'), 'custom');
});

test('mission language comes from the active run of the same mission', () => {
  const manager = run => ({ getActiveRunView: () => run });
  const run = { missionId: 'm1', resumeBundle: { missionState: { currentMissionData: { outputLanguage: 'en' } } } };
  assert.equal(createMissionVoiceLanguage(manager(run))({ missionId: 'm1' }), 'en');
  assert.equal(createMissionVoiceLanguage(manager(run))(null), 'en');
  assert.equal(createMissionVoiceLanguage(manager(run))({ missionId: 'other' }), 'de');
  assert.equal(createMissionVoiceLanguage(manager({ missionId: 'm1', resumeBundle: { missionState: { currentMissionData: {} } } }))(null), 'de');
  assert.equal(createMissionVoiceLanguage(manager(null))(null), 'de');
});

test('English mission: fixed German lines and fallbacks are translated before speaking', async () => {
  const calls = [];
  const service = geminiService('en', calls);
  const job = service.request({ effectId: 'run-4:train', kind: 'poi', prompt: '', fallbackText: 'Steilkurve links, 45 Grad.', taskDomain: 'training',
    staticClipKey: 'training_steep_turn_left', speaker: { gender: 'male' } });
  const ready = await service.wait(job.effectId);
  const text = calls.find(call => !/tts/.test(call.url));
  assert.match(text.body.contents[0].parts[0].text, /^Translate this spoken passenger or crew line into natural, idiomatic English\./);
  assert.match(text.body.contents[0].parts[0].text, /Steilkurve links, 45 Grad\.$/);
  assert.equal(ready.text, 'Thanks for the smooth flight.');
  assert.ok(calls.some(call => /tts/.test(call.url)), 'spoken live, not the German clip');
});

test('German mission: fixed lines are spoken as they are, no extra call', async () => {
  const calls = [];
  const service = geminiService('de', calls);
  const job = service.request({ effectId: 'run-5:text', kind: 'farewell', text: 'Danke fürs Fliegen.', speaker: { gender: 'male' } });
  const ready = await service.wait(job.effectId);
  assert.equal(ready.text, 'Danke fürs Fliegen.');
  assert.equal(calls.filter(call => !/tts/.test(call.url)).length, 0);
});
