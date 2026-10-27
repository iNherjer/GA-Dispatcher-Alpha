/* Mission logbook record (schemaVersion 2). Shared by the Tracker, which writes
 * the flight logbook, and the web app (sim mode / older trackers).
 * Extracted from sync.js _buildMissionCompletionRecord without behaviour change.
 * Concept: docs/Flugbuch Kruemelweg Konzept.md */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAMissionLogbookRecordCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function finite(value, digits = null) {
        if (value == null || value === '') return null;
        const n = Number(value);
        if (!Number.isFinite(n)) return null;
        return digits == null ? n : Number(n.toFixed(digits));
    }
    function text(value, max = 180) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    }
    function list(value, maxItems = 6) {
        return Array.isArray(value) ? value.map(item => text(item, 80)).filter(Boolean).slice(0, maxItems) : [];
    }
    function dateText(ms) {
        return new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    /**
     * input:
     *   mission     current mission data (title, start, dest, ac, taskDomain, dist, missionContract)
     *   missionId, runId
     *   flight      merged mission flight record (mission-flight-recorder-core)
     *   outcome     cargo/POI outcome { status, failed, conditionPct, ... }
     *   comfort     comfort summary (mission-comfort-core) when passengers were on board
     *   hasCargo    non-passenger manifest items exist
     *   fallbackStart, fallbackDest   labels when the flight record has none
     *   privateOutingEvidence, simulated, status ('completed' | 'aborted'), now
     */
    function buildRecord(input = {}) {
        const md = input.mission && typeof input.mission === 'object' ? input.mission : {};
        const flight = input.flight && typeof input.flight === 'object' ? input.flight : {};
        const missionId = text(input.missionId, 160) || 'mission';
        const now = Number(input.now) || Date.now();
        const endedAt = Number(flight.createdAt || flight.endTs || now) || now;
        const startedAt = Number(flight.startTs || input.startedAt || 0);
        const durationSec = finite(flight.durationSec)
            ?? (startedAt > 0 ? Math.max(1, Math.round((endedAt - startedAt) / 1000)) : null);
        const recordedDistanceNm = finite(flight.distanceNm, 1);
        const distanceNm = recordedDistanceNm
            ?? finite(parseFloat(String(md.dist ?? md.distanceNm ?? '').replace(',', '.')), 1);
        const cargoOutcome = input.outcome || flight.missionCargoOutcome || null;
        const comfort = input.comfort || null;
        const comfortHasSamples = Number(comfort?.samples || 0) > 0;
        const maxGForce = finite(flight.maxGForce, 2) ?? (comfortHasSamples ? finite(comfort?.maxG, 2) : null);
        const maxBankDeg = finite(flight.maxBankDeg, 1) ?? (comfortHasSamples ? finite(comfort?.maxBankDeg, 1) : null);
        const telemetrySampleCount = Math.max(0, Math.round(Number(flight.telemetrySampleCount || 0)));
        const bankSampleCount = Math.max(0, Math.round(Number(flight.bankSampleCount || 0)));
        const gForceSampleCount = Math.max(0, Math.round(Number(flight.gForceSampleCount || 0)));
        const enrouteSampleCount = Math.max(0, Math.round(Number(flight.enrouteSampleCount || 0)));
        const aglSampleCount = Math.max(0, Math.round(Number(flight.aglSampleCount || 0)));
        const telemetryStatus = text(flight.telemetryStatus || ((maxGForce != null || maxBankDeg != null) ? 'partial' : 'unavailable'), 24);
        const completionId = `${missionId}-${Math.round(endedAt)}`;
        const start = text(flight.depLabel || md.start || input.fallbackStart || 'START', 64);
        const actualLanding = text(flight.arrLabel || md.dest || input.fallbackDest || 'LANDUNG', 64);
        const assignment = text(md.mission || md.title || md.missionTitle || md.task || 'Mission', 220);
        const cruiseCount = Math.max(0, Math.round(Number(flight.cruiseSampleCount || 0)));
        const cruiseDurationSec = Math.max(0, Math.round(Number(flight.cruiseDurationSec || 0)));
        const hasCruiseEvidence = cruiseCount >= 10 && cruiseDurationSec >= 20;
        const aborted = input.status === 'aborted';
        const failed = aborted || !!(cargoOutcome?.failed || flight.missionFailed);
        const record = {
            schemaVersion: 2,
            ...(input.privateOutingEvidence ? { privateOutingEvidence: input.privateOutingEvidence } : {}),
            id: completionId,
            completionId,
            missionId,
            ...(input.runId ? { runId: text(input.runId, 220) } : {}),
            createdAt: endedAt,
            endedAt,
            date: dateText(endedAt),
            dateLabel: new Date(endedAt).toLocaleString('de-DE'),
            start,
            dest: actualLanding,
            depLabel: start,
            arrLabel: actualLanding,
            plannedDest: text(md.dest || '', 64),
            mission: assignment,
            missionTitle: assignment,
            taskDomain: text(md.taskDomain || md.missionContract?.taskDomain || '', 80),
            aircraft: text(md.ac || md.aircraft || '', 80),
            ac: text(md.ac || md.aircraft || '', 80),
            durationSec: durationSec == null ? null : Math.round(durationSec),
            distanceNm,
            dist: distanceNm,
            distanceSource: text(recordedDistanceNm != null ? (flight.distanceSource || 'gps') : 'planned', 24),
            result: aborted ? 'aborted' : (failed ? 'failed' : 'completed'),
            failed,
            simulated: flight.simulated === true || input.simulated === true,
            maxGForce,
            maxBankDeg,
            touchdownVsFpm: finite(flight.touchdownVsFpm),
            maxClimbFpm: finite(flight.maxClimbFpm),
            maxDescentFpm: finite(flight.maxDescentFpm),
            minEnrouteAglFt: finite(flight.minEnrouteAglFt),
            cruiseAltitudeMeanFt: hasCruiseEvidence ? finite(flight.cruiseAltitudeMeanFt) : null,
            cruiseAltitudeStdDevFt: hasCruiseEvidence ? finite(flight.cruiseAltitudeStdDevFt) : null,
            cruiseAltitudeRangeFt: hasCruiseEvidence ? finite(flight.cruiseAltitudeRangeFt) : null,
            telemetryStatus,
            telemetrySampleCount,
            bankSampleCount: bankSampleCount || (comfortHasSamples ? Math.max(0, Math.round(Number(comfort.samples || 0))) : 0),
            gForceSampleCount: gForceSampleCount || (comfortHasSamples ? Math.max(0, Math.round(Number(comfort.samples || 0))) : 0),
            enrouteSampleCount,
            aglSampleCount,
            cruiseSampleCount: cruiseCount,
            cruiseDurationSec,
            segmentCount: Math.max(1, Math.round(Number(flight.segmentCount) || 1)),
            comfort: comfort ? {
                score: finite(comfort.comfortScore),
                mood: text(comfort.mood, 80),
                pilotEvents: Math.max(0, Math.round(Number(comfort.pilotEvents || 0))),
                pilotSevere: Math.max(0, Math.round(Number(comfort.pilotSevere || 0))),
                weatherEvents: Math.max(0, Math.round(Number(comfort.weatherEvents || 0))),
                weatherSevere: Math.max(0, Math.round(Number(comfort.weatherSevere || 0))),
                samples: Math.max(0, Math.round(Number(comfort.samples || 0))),
                maxG: finite(comfort.maxG, 2),
                maxBankDeg: finite(comfort.maxBankDeg, 1),
                maxDescentFpm: finite(comfort.maxDescentFpm)
            } : null,
            cargo: input.hasCargo && cargoOutcome ? {
                status: text(cargoOutcome.status || (cargoOutcome.failed ? 'failed' : 'completed'), 32),
                failed: !!cargoOutcome.failed,
                conditionPct: finite(cargoOutcome.conditionPct),
                stressDamagePct: finite(cargoOutcome.stressDamagePct),
                requiredTotal: Math.max(0, Math.round(Number(cargoOutcome.requiredTotal || 0))),
                requiredLoaded: Math.max(0, Math.round(Number(cargoOutcome.requiredLoaded || 0))),
                missingRequired: list(cargoOutcome.missingRequired),
                droppedRequired: list(cargoOutcome.droppedRequired),
                notDeliveredRequired: list(cargoOutcome.notDeliveredRequired),
                damagedRequired: list(cargoOutcome.damagedRequired)
            } : null
        };
        if (flight.sarSearchSummary && typeof flight.sarSearchSummary === 'object') {
            record.sarSearchSummary = JSON.parse(JSON.stringify(flight.sarSearchSummary));
        }
        return record;
    }

    return { buildRecord };
});
