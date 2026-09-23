import fs from 'node:fs';
import { extractOriginalFunction } from './extract-original-function.mjs';

const source = fs.readFileSync(new URL('../passenger-voice.js', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const fn = name => extractOriginalFunction(source, name);
const appFn = name => extractOriginalFunction(appSource, name);
const start = source.indexOf('    const trainingPlan = _activeAptTrainingPlan();', source.indexOf('window.checkPaxPoiProximity ='));
const poiStart = source.indexOf('        if (isPoiMission) {', start);
const aptStart = source.indexOf('        } else {\n            // APT-Training:', poiStart);
const evalStart = source.indexOf('    if (trainingPlan && (_aptTrainingBriefDone || _poiTrainingZoneStartDone)) {', aptStart);
const evalEnd = source.indexOf('    const trainingTaskDomainActive', evalStart);
if (start < 0 || poiStart < 0 || aptStart < 0 || evalStart < 0 || evalEnd < 0) throw new Error('Original training flight boundary missing');
const flightTriggers = source.slice(poiStart, evalStart);
const evalTick = source.slice(evalStart, evalEnd);
const originals = [
  '_trainingEvalBegin', '_toBoolStall', '_trainingEvalTick', '_trainingEvalSummary',
  '_trainingProcedureDebriefLine', '_poiTrainingPreZonePrompt', '_aptTrainingPrompt', '_trainingLandingPrepPrompt',
  '_weatherContext', '_haversineNm', '_trainingPoiCenterFromRoute'
].map(fn).concat(appFn('_isPatternFocusItem')).join('\n\n');
const output = `// Generated from original passenger-voice.js by tools/generate-training-flight-core.mjs. Do not edit.
'use strict';
function createState(saved = {}) {
    const e = saved.eval || {};
    return {
        aptBriefDone: !!saved.aptBriefDone,
        aptLandingBriefDone: !!saved.aptLandingBriefDone,
        preBriefDone: !!saved.preBriefDone,
        zoneStartDone: !!saved.zoneStartDone,
        landingBriefDone: !!saved.landingBriefDone,
        landingPhaseAnnounced: !!saved.landingPhaseAnnounced,
        lastDistToDestNm: saved.lastDistToDestNm == null ? null : Number(saved.lastDistToDestNm),
        eval: {
            active: !!e.active, startedAt: Number(e.startedAt || 0), samples: Number(e.samples || 0),
            minAltFt: e.minAltFt == null ? null : Number(e.minAltFt),
            maxAltFt: e.maxAltFt == null ? null : Number(e.maxAltFt),
            maxAbsBankDeg: Number(e.maxAbsBankDeg || 0), maxGForce: Number(e.maxGForce ?? 1),
            maxClimbFpm: Number(e.maxClimbFpm || 0), maxDescentFpm: Number(e.maxDescentFpm || 0),
            aoaSamples: Number(e.aoaSamples || 0), maxAoaDeg: Number(e.maxAoaDeg || 0),
            stallEvents: Number(e.stallEvents || 0), _stallPrev: !!e._stallPrev
        }
    };
}

function execute(context = {}, saved = {}, sample = {}, progress = null, now = 0, operation = 'observe') {
    const state = createState(saved);
    const cues = [];
    let _aptTrainingBriefDone = state.aptBriefDone;
    let _aptTrainingLandingBriefDone = state.aptLandingBriefDone;
    let _poiTrainingPreBriefDone = state.preBriefDone;
    let _poiTrainingZoneStartDone = state.zoneStartDone;
    let _poiTrainingLandingBriefDone = state.landingBriefDone;
    let _paxLandingPhaseAnnounced = state.landingPhaseAnnounced;
    let _poiTrainingLastDistToDestNm = state.lastDistToDestNm;
    let _trainingEval = { ...state.eval,
        minAltFt: state.eval.minAltFt == null ? Number.POSITIVE_INFINITY : state.eval.minAltFt,
        maxAltFt: state.eval.maxAltFt == null ? Number.NEGATIVE_INFINITY : state.eval.maxAltFt };
    const Date = { now: () => Number(now) };
    const window = { activePassenger: context.passenger || null,
        missionTrainingProcedure: { snapshot: () => progress } };
    const currentMissionData = context.missionData || {};
    const _activeAptTrainingPlan = () => context.trainingPlan || null;
    const _baseContext = () => context.baseContext || null;
    const _toneHint = () => context.toneHint || '';
    const _trainingProcedureSnapshot = () => progress;
    const _getDestCoords = () => context.target ? {
        lat: context.target.lat, lon: context.target.lon ?? context.target.lng
    } : null;
    const _paxLog = () => {};
    const _paxMissionTimeout = (callback, delay) => {
        const before = cues.length;
        callback();
        for (let i = before; i < cues.length; i++) cues[i].notBefore = Number(now) + delay;
    };
    const _speakAndShow = (prompt, label) => cues.push({ prompt, label });
${originals}
    if (operation === 'debrief') return _trainingProcedureDebriefLine();
    if (operation === 'summary') return _trainingEvalSummary();
    function tick() {
      const flightData = sample || {};
      const lat = Number(flightData.lat);
      const lon = Number(flightData.lon);
      const trainingPlan = _activeAptTrainingPlan();
      const wps = context.routeWaypoints || null;
      if (trainingPlan && wps && wps.length >= 2) {
        const first = wps[0];
        const last = wps[wps.length - 1];
        const distNm = _haversineNm(lat, lon, last.lat, last.lng ?? last.lon);
        const isPoiMission = String(context.missionMode || '').trim().toUpperCase() !== 'APT';
${flightTriggers}
${evalTick}
    }
    tick();
    state.aptBriefDone = _aptTrainingBriefDone;
    state.aptLandingBriefDone = _aptTrainingLandingBriefDone;
    state.preBriefDone = _poiTrainingPreBriefDone;
    state.zoneStartDone = _poiTrainingZoneStartDone;
    state.landingBriefDone = _poiTrainingLandingBriefDone;
    state.landingPhaseAnnounced = _paxLandingPhaseAnnounced;
    state.lastDistToDestNm = _poiTrainingLastDistToDestNm;
    state.eval = { ..._trainingEval,
        minAltFt: Number.isFinite(_trainingEval.minAltFt) ? _trainingEval.minAltFt : null,
        maxAltFt: Number.isFinite(_trainingEval.maxAltFt) ? _trainingEval.maxAltFt : null };
    return { state, cues };
}
function observe(context, state, sample, progress, now) { return execute(context, state, sample, progress, now); }
function summary(state) { return execute({}, state, {}, null, 0, 'summary'); }
function debrief(progress) { return execute({}, {}, {}, progress, 0, 'debrief'); }
module.exports = { createState, observe, summary, debrief };
`;
const target = new URL('../mission-training-flight-core.js', import.meta.url);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Training flight core drift');
} else fs.writeFileSync(target, output);
