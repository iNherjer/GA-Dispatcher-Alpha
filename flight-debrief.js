/* Shared App / EFB debrief presentation. */
(function () {
// UI language (i18n-core.js, web only): _fdT = exact German sentence -> i18n/en-phrases.js,
// _fdK = key with placeholders. Without GAI18n (EFB) the German text stays exactly as before.
function _fdT(text) { var i18n = (typeof window !== 'undefined') ? window.GAI18n : null; return i18n ? i18n.phrase(text) : text; }
function _fdK(key, german, vars) { var i18n = (typeof window !== 'undefined') ? window.GAI18n : null; if (i18n) return i18n.t(key, vars, german); return vars ? String(german).replace(/\{([a-zA-Z0-9_]+)\}/g, function (m, n) { return Object.prototype.hasOwnProperty.call(vars, n) ? String(vars[n]) : m; }) : german; }
// Date shown in the UI language. The stored dateLabel stays German; in English it is shown
// from the timestamp. Without GAI18n (EFB) unchanged.
function _fdDateText(ms, storedGerman) { var i18n = (typeof window !== 'undefined') ? window.GAI18n : null; if (!i18n || typeof i18n.locale !== 'function' || i18n.locale() === 'de-DE' || !ms) return storedGerman; try { return new Date(ms).toLocaleString(i18n.locale()); } catch (_) { return storedGerman; } }
'use strict';
let debriefOverlayEl = null;
let currentDebriefRecord = null;
let currentDebriefAwaitingCleanup = false;
function ensureDebriefOverlay() {
    if (debriefOverlayEl) return debriefOverlayEl;
    const ov = document.createElement('div');
    ov.id = 'flightDebriefOverlay';
    ov.className = 'flight-debrief-overlay';
    ov.innerHTML = `
        <div class="flight-debrief-paper" role="dialog" aria-modal="true" aria-labelledby="flightDebriefTitle">
            <div class="flight-debrief-head">
                <div>
                    <div class="flight-debrief-kicker">VFR MULTITOOL · MISSIONSABSCHLUSS</div>
                    <div id="flightDebriefTitle" class="flight-debrief-title">Flight Debrief</div>
                </div>
                <button id="flightDebriefCloseBtn" class="flight-debrief-icon-close" type="button" aria-label="Debrief schließen">×</button>
            </div>
            <div id="flightDebriefBody" class="flight-debrief-body"></div>
            <div class="flight-debrief-actions">
                <button id="flightDebriefPdfBtn" class="flight-debrief-btn secondary" type="button">PDF herunterladen</button>
                <button id="flightDebriefFinishBtn" class="flight-debrief-btn primary" type="button">Schließen</button>
            </div>
        </div>
    `;
    ov.addEventListener('click', (e) => {
        if (e.target === ov && !currentDebriefAwaitingCleanup) ov.style.display = 'none';
    });
    document.body.appendChild(ov);
    const closeBtn = ov.querySelector('#flightDebriefCloseBtn');
    const finishBtn = ov.querySelector('#flightDebriefFinishBtn');
    const pdfBtn = ov.querySelector('#flightDebriefPdfBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
        if (!currentDebriefAwaitingCleanup) ov.style.display = 'none';
    });
    if (finishBtn) finishBtn.addEventListener('click', async () => {
        const displayedRecord = currentDebriefRecord;
        if (currentDebriefAwaitingCleanup) {
            const record = currentDebriefRecord;
            finishBtn.disabled = true;
            finishBtn.textContent = _fdT('Mission wird aufgeräumt…');
            let cleaned = false;
            try { cleaned = typeof window.completeMissionCloseCleanup === 'function'
                ? await window.completeMissionCloseCleanup(record, 'debrief-finish')
                : false; } catch (error) { console.error('[Debrief] Cleanup failed:', error); }
            if (currentDebriefRecord !== displayedRecord) return;
            if (!cleaned) {
                finishBtn.disabled = false;
                finishBtn.textContent = _fdT('Schließen fehlgeschlagen – erneut versuchen');
                finishBtn.title = _fdT('Tracker-Verbindung und aktuellen Missionsstand prüfen.');
                return;
            }
            currentDebriefAwaitingCleanup = false;
        }
        ov.style.display = 'none';
    });
    if (pdfBtn) pdfBtn.addEventListener('click', async () => {
        if (!currentDebriefRecord) return;
        pdfBtn.disabled = true;
        const oldText = pdfBtn.textContent;
        pdfBtn.textContent = _fdT('PDF wird erstellt…');
        try { await window.generateDebriefPDF(currentDebriefRecord); }
        catch (err) {
            console.error('[Debrief] PDF export failed:', err);
            alert(_fdT('Das Debrief-PDF konnte nicht erstellt werden.'));
        } finally {
            pdfBtn.disabled = false;
            pdfBtn.textContent = oldText;
        }
    });
    debriefOverlayEl = ov;
    return ov;
}

function _debriefFinite(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

function _debriefAltitudeAssessment(record) {
    const sd = _debriefFinite(record?.cruiseAltitudeStdDevFt);
    const range = _debriefFinite(record?.cruiseAltitudeRangeFt);
    if (sd == null) {
        const enrouteSamples = Math.max(0, Math.round(Number(record?.enrouteSampleCount || 0)));
        const cruiseSamples = Math.max(0, Math.round(Number(record?.cruiseSampleCount || 0)));
        const cruiseDurationSec = Math.max(0, Math.round(Number(record?.cruiseDurationSec || 0)));
        let text = _fdT('Für eine belastbare Bewertung gab es zu wenige stabile Streckenflug-Proben.');
        if (enrouteSamples <= 0 && record?.telemetryStatus) {
            text = _fdT('Es wurde kein Abschnitt sicher als Streckenflug erkannt; deshalb wird die Höhenkonstanz nicht bewertet.');
        } else if (enrouteSamples > 0) {
            text = _fdK('debrief.altitude.samples', 'Es wurden {enrouteSamples} Streckenflug-Proben erkannt, davon aber nur {cruiseSamples} über {cruiseDurationSec} Sekunden als stabiler Höhenflug.', { enrouteSamples, cruiseSamples, cruiseDurationSec });
        }
        return { value: _fdT('Nicht verfügbar'), text };
    }
    const rating = sd <= 75 ? _fdT('sehr konstant') : sd <= 150 ? _fdT('konstant') : sd <= 300 ? _fdT('wechselhaft') : _fdT('deutlich wechselhaft');
    return {
        value: `± ${Math.round(sd)} ft`,
        text: _fdK('debrief.altitude.text', 'Die Flughöhe war im waagerechten Streckenflug {rating} (Standardabweichung {sd} ft{range}).', { rating, sd: Math.round(sd), range: range == null ? '' : _fdK('debrief.altitude.range', ', Spannweite {range} ft', { range: Math.round(range) }) })
    };
}

function _debriefComfortText(record) {
    const comfort = record?.comfort;
    if (!comfort || _debriefFinite(comfort.score) == null) return _fdT('Für diesen Auftrag wurde kein Passagier-Komfortindex geführt.');
    const causes = [];
    if (Number(comfort.pilotSevere || 0) > 0) causes.push(_fdT('deutliche pilotenseitige Belastungsspitzen'));
    else if (Number(comfort.pilotEvents || 0) > 0) causes.push(_fdT('einzelne Manöverbelastungen'));
    if (Number(comfort.weatherSevere || 0) > 0) causes.push(_fdT('anspruchsvolles Wetter'));
    else if (Number(comfort.weatherEvents || 0) > 0) causes.push(_fdT('spürbare Wettereinflüsse'));
    return _fdK('debrief.comfort.text', 'Die Passagiere waren {mood}: {score} von 100 Komfortpunkten{causes}.', { mood: _fdT(comfort.mood || 'bewertet'), score: Math.round(Number(comfort.score)), causes: causes.length ? _fdK('debrief.comfort.causes', '; prägend waren {list}', { list: causes.join(_fdT(' und ')) }) : '' });
}

function _debriefCargoText(record) {
    const cargo = record?.cargo;
    if (!cargo) return _fdT('Für diesen Auftrag war keine separate Frachtbewertung erforderlich.');
    const issues = [
        ...(cargo.missingRequired || []),
        ...(cargo.droppedRequired || []),
        ...(cargo.notDeliveredRequired || []),
        ...(cargo.damagedRequired || [])
    ];
    const condition = _debriefFinite(cargo.conditionPct);
    if (cargo.failed) return _fdK('debrief.cargo.failed', 'Die Ladung wurde nicht vollständig sicher zugestellt{issues}', { issues: issues.length ? `: ${issues.slice(0, 3).join(', ')}` : '.' });
    if (condition == null) return _fdT('Die vorgeschriebene Ladung wurde vollständig und ohne registrierten Verlust transportiert.');
    const rating = condition >= 95 ? _fdT('sehr sicher') : condition >= 80 ? _fdT('sicher') : condition >= 60 ? _fdT('mit spürbarer Beanspruchung') : _fdT('kritisch beansprucht');
    return _fdK('debrief.cargo.text', 'Die Ladung wurde {rating} transportiert. Ermittelter Zustand: {pct} %.', { rating, pct: Math.round(condition) });
}

function _debriefFlightText(record, altitude) {
    const g = _debriefFinite(record?.maxGForce);
    const bank = _debriefFinite(record?.maxBankDeg);
    const agl = _debriefFinite(record?.minEnrouteAglFt);
    const parts = [];
    if (g != null) parts.push(_fdK('debrief.flight.g', 'Die höchste gemessene Last betrug {g} g', { g: g.toFixed(2) }));
    if (bank != null) parts.push(_fdK('debrief.flight.bank', 'der größte Bankwinkel {bank}°', { bank: bank.toFixed(1) }));
    if (agl != null) parts.push(_fdK('debrief.flight.agl', 'die geringste direkte AGL-Höhe auf Strecke {agl} ft', { agl: Math.round(agl) }));
    let metrics = parts.length ? `${parts.join(', ')}.` : _fdT('Für Belastung und Streckenhöhe lagen keine belastbaren Live-Daten vor.');
    if (!parts.length && record?.telemetryStatus) {
        const samples = Math.max(0, Math.round(Number(record.telemetrySampleCount || 0)));
        metrics = samples > 0
            ? _fdK('debrief.flight.samples', 'Der Recorder erhielt {samples} Live-Proben, aber keine auswertbaren G-, Bank- oder Streckenhöhenwerte.', { samples })
            : _fdT('Der Recorder erhielt während dieses Fluges keine auswertbaren Live-Proben.');
    }
    return `${metrics} ${altitude.text}`;
}

function _appendDebriefMetric(grid, label, value) {
    const card = document.createElement('div');
    card.className = 'flight-debrief-metric';
    const labelEl = document.createElement('div');
    labelEl.className = 'flight-debrief-metric-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('div');
    valueEl.className = 'flight-debrief-metric-value';
    valueEl.textContent = value;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    grid.appendChild(card);
}

function _appendDebriefSection(body, title, text) {
    const section = document.createElement('section');
    section.className = 'flight-debrief-section';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const para = document.createElement('p');
    para.textContent = text;
    section.appendChild(heading);
    section.appendChild(para);
    body.appendChild(section);
}

window.showFlightDebrief = function(record, options = {}) {
    if (!record) return;
    const ov = ensureDebriefOverlay();
    const body = ov.querySelector('#flightDebriefBody');
    if (!body) return;
    currentDebriefRecord = record;
    currentDebriefAwaitingCleanup = options.awaitingCleanup === true;
    while (body.firstChild) body.removeChild(body.firstChild);
    const dep = String(record.depLabel || record.start || 'START');
    const arr = String(record.arrLabel || record.dest || _fdT('LANDUNG'));
    const dateText = String(_fdDateText(Number(record.createdAt || record.endedAt || record.endTs) || 0, record.dateLabel || record.date || new Date(record.createdAt || Date.now()).toLocaleString('de-DE')));
    const mission = String(record.missionTitle || record.mission || 'Mission');
    const route = document.createElement('div');
    route.className = 'flight-debrief-route';
    route.textContent = `${dep} ➔ ${arr}`;
    const meta = document.createElement('div');
    meta.className = 'flight-debrief-meta';
    meta.textContent = `${dateText} · ${record.failed ? _fdT('NICHT ERFÜLLT') : _fdT('ERFÜLLT')}`;
    const assignment = document.createElement('div');
    assignment.className = 'flight-debrief-assignment';
    assignment.textContent = mission;
    body.appendChild(route);
    body.appendChild(meta);
    body.appendChild(assignment);

    const grid = document.createElement('div');
    grid.className = 'flight-debrief-metrics';
    const duration = _debriefFinite(record.durationSec);
    const distance = _debriefFinite(record.distanceNm ?? record.dist);
    const g = _debriefFinite(record.maxGForce);
    const bank = _debriefFinite(record.maxBankDeg);
    const agl = _debriefFinite(record.minEnrouteAglFt);
    const altitude = _debriefAltitudeAssessment(record);
    _appendDebriefMetric(grid, _fdT('Flugzeit'), duration == null ? '–' : `${Math.max(1, Math.round(duration / 60))} min`);
    _appendDebriefMetric(grid, _fdT('Distanz'), distance == null ? '–' : `${distance.toFixed(1)} NM`);
    _appendDebriefMetric(grid, _fdT('Höchstes G'), g == null ? '–' : `${g.toFixed(2)} g`);
    _appendDebriefMetric(grid, _fdT('Max. Bank'), bank == null ? '–' : `${bank.toFixed(1)}°`);
    _appendDebriefMetric(grid, _fdT('Höhenkonstanz'), altitude.value);
    _appendDebriefMetric(grid, _fdT('Min. AGL Strecke'), agl == null ? '–' : `${Math.round(agl)} ft`);
    body.appendChild(grid);
    _appendDebriefSection(body, _fdT('Flugdurchführung'), _debriefFlightText(record, altitude));
    _appendDebriefSection(body, _fdT('Passagierkomfort'), _debriefComfortText(record));
    _appendDebriefSection(body, _fdT('Ladungssicherheit'), _debriefCargoText(record));

    const closeBtn = ov.querySelector('#flightDebriefCloseBtn');
    const finishBtn = ov.querySelector('#flightDebriefFinishBtn');
    const pdfBtn = ov.querySelector('#flightDebriefPdfBtn');
    if (pdfBtn) pdfBtn.style.display = typeof window.generateDebriefPDF === 'function' ? '' : 'none';
    if (closeBtn) closeBtn.style.display = currentDebriefAwaitingCleanup ? 'none' : '';
    if (finishBtn) {
        finishBtn.disabled = false;
        finishBtn.textContent = currentDebriefAwaitingCleanup ? _fdT('Debrief schließen & Mission aufräumen') : _fdT('Schließen');
    }
    // Static overlay texts are built once; refresh them for the current UI language.
    const kicker = ov.querySelector('.flight-debrief-kicker');
    if (kicker) kicker.textContent = _fdT('VFR MULTITOOL · MISSIONSABSCHLUSS');
    if (closeBtn) closeBtn.setAttribute('aria-label', _fdT('Debrief schließen'));
    if (pdfBtn && !pdfBtn.disabled) pdfBtn.textContent = _fdT('PDF herunterladen');
    ov.style.display = 'flex';
};

window.GAFlightDebrief = Object.freeze({
    finite: _debriefFinite, altitudeAssessment: _debriefAltitudeAssessment,
    flightText: _debriefFlightText, comfortText: _debriefComfortText, cargoText: _debriefCargoText
});
window.hideFlightDebrief = function(missionId, runId) {
    if (!currentDebriefRecord || currentDebriefRecord.missionId !== missionId
        || (runId && currentDebriefRecord.runId !== runId)) return false;
    currentDebriefAwaitingCleanup = false;
    if (debriefOverlayEl) debriefOverlayEl.style.display = 'none';
    return true;
};
})();
