// Frozen from passenger-voice.js at baseline HEAD 226366f58cb6cfbdbe4cdb9055634e3921e72a05.
// Original Mapping/Survey helpers called by the frozen POI action fixture.
function _surveyPatternActiveSpec() {
    if (typeof window.missionSurveyPattern?.getActiveSpec !== 'function') return null;
    try {
        return window.missionSurveyPattern.getActiveSpec((typeof currentMissionData !== 'undefined' ? currentMissionData : null), window.activePassenger || null);
    } catch (_) { return null; }
}

function _surveyPatternSnapshot() {
    const tracker = window.gaTrackerExecutionControl;
    if (tracker?.executionAuthority === 'tracker' && tracker.surveySpec) return tracker.poiTask?.surveyPattern || null;
    if (typeof window.missionSurveyPattern?.snapshot !== 'function') return null;
    try { return window.missionSurveyPattern.snapshot(); } catch (_) { return null; }
}

function _surveyPatternProgressSummary(ctx = null) {
    const spec = _surveyPatternActiveSpec();
    if (!spec) return '';
    const snap = _surveyPatternSnapshot();
    const parts = [];
    if (ctx?.hasPosition) parts.push(`Distanz zum Ziel ${ctx.distNm.toFixed(1)} NM, Richtung ${String(ctx.roundedBearingDeg).padStart(3, '0')} Grad`);
    if (spec.type === 'orbit') {
        const done = Math.max(0, Number(snap?.orbit?.completedTurns || 0));
        const total = Math.max(1, Number(spec.orbit?.requiredTurns || 3));
        const activeCoverage = Math.round(Number(snap?.orbit?.activeCoverage || 0) * 100);
        parts.push(`Survey-Orbit ${done}/${total} Kreise abgeschlossen${snap?.orbit?.active ? `, aktueller Kreis ${activeCoverage}%` : ''}`);
    } else {
        const done = Array.isArray(snap?.scan?.completedLineIds) ? snap.scan.completedLineIds.length : 0;
        const total = Array.isArray(spec.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec.scan?.lineCount || 1));
        const activeLine = String(snap?.scan?.active?.lineId || '');
        const coverage = Math.round(Number(snap?.scan?.activeCoverage || 0) * 100);
        parts.push(`Survey-Scan ${done}/${total} Linien gruen${activeLine ? `, ${activeLine} aktiv bei ${coverage}%` : ''}`);
    }
    if (snap?.satisfied) parts.push('Status: Survey abgeschlossen, Rueckflug freigegeben');
    else if (snap?.startedAt) parts.push('Status: Datenaufnahme laeuft');
    else parts.push('Status: Pattern sichtbar, Einstieg an einem Linienende oder auf dem Orbit');
    const targetAlt = Number(spec.targetAltFt || window.activePassenger?.targetAltFt || 0);
    if (targetAlt > 0 && ctx?.mslFt != null) {
        const diff = Number(ctx.mslFt) - targetAlt;
        if (Math.abs(diff) <= Number(spec.altitudeToleranceFt || 300)) parts.push(`Hoehe im Band: ${ctx.mslFt} ft bei Ziel ${Math.round(targetAlt)} ft`);
        else parts.push(`Hoehenabweichung: ${Math.abs(Math.round(diff))} ft ${diff > 0 ? 'zu hoch' : 'zu niedrig'} gegen Ziel ${Math.round(targetAlt)} ft`);
    }
    return parts.join(' | ');
}

function _surveyPatternStatusText(ctx = null) {
    const summary = _surveyPatternProgressSummary(ctx);
    if (!summary) return 'Ich habe gerade kein aktives Survey-Pattern geladen. Bitte pruefe, ob die Mapping-Mission noch aktiv ist.';
    return summary.replace(/\s*\|\s*/g, '. ') + '.';
}

function _surveyPatternOrientationText(ctx = null) {
    const spec = _surveyPatternActiveSpec();
    const vector = _missionVectorText(ctx);
    if (!spec) return `${vector} Ich habe gerade kein aktives Survey-Pattern geladen.`;
    if (spec.type === 'orbit') {
        const radius = Number(spec.orbit?.radiusNm || 0.55).toFixed(2);
        return `${vector} Das Pattern ist der markierte Orbit um das Ziel. Richte dich auf etwa ${radius} NM Radius ein, halte die geplante Hoehe und fliege die vollen Kreise ruhig durch.`;
    }
    const snap = _surveyPatternSnapshot();
    const done = Array.isArray(snap?.scan?.completedLineIds) ? snap.scan.completedLineIds.length : 0;
    const total = Array.isArray(spec.scan?.lines) ? spec.scan.lines.length : Math.max(1, Number(spec.scan?.lineCount || 1));
    return `${vector} Das rote Scanmuster liegt schon auf der Karte. Such dir ein offenes Linienende, flieg die Nord-Sued-Bahn gerade ab und nimm danach die naechste offene Linie; erledigt sind ${done} von ${total}.`;
}
