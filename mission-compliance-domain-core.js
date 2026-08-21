(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionComplianceDomainCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var CORE_VERSION = 1;
    var PROBABILITY = 0;
    var REQUESTED_ITEM_IDS = Object.freeze([
        'bordbuch',
        'fire-extinguisher',
        'first-aid'
    ]);
    var PHASE_ORDER = Object.freeze({
        none: 0,
        not_selected: 1,
        selected: 2,
        approach_started: 3,
        inspectors_waiting: 4,
        request_playing: 5,
        evidence_open: 6,
        result_playing: 7,
        departing: 8,
        released: 9
    });
    var INSPECTOR_SPEAKER = Object.freeze({
        name: 'Luftaufsicht',
        role: 'Behoerdenkontrolleur',
        gender: 'male',
        roleProfile: 'authority_inspector_calm_precise_v1',
        taskDomain: 'flight_compliance'
    });
    var REQUEST_TEXT = 'Guten Tag, Luftaufsicht. Es handelt sich um eine Behoerdenkontrolle. Bitte laden Sie jetzt das Bordbuch, den Feuerloescher und das Verbandzeug aus. Anschliessend pruefen wir die Gueltigkeit und den Eintrag des aktuellen Fluges.';
    var SANCTION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function clone(value, fallback) {
        try { return JSON.parse(JSON.stringify(value)); } catch (_) { return fallback; }
    }

    function timestamp(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function normalizeState(raw, context) {
        var source = object(raw);
        var defaults = object(context);
        var phase = Object.prototype.hasOwnProperty.call(PHASE_ORDER, source.phase)
            ? source.phase
            : (source.selected === true ? 'selected' : (source.selected === false ? 'not_selected' : 'none'));
        var remediation = object(source.remediation);
        var result = source.result && typeof source.result === 'object'
            ? clone(source.result, null)
            : null;
        return {
            version: CORE_VERSION,
            debugStandalone: source.debugStandalone === true,
            missionKey: String(source.missionKey || defaults.missionKey || ''),
            flightId: String(source.flightId || defaults.flightId || ''),
            selected: source.selected === true ? true : (source.selected === false ? false : null),
            forced: source.forced === true,
            roll: Number.isFinite(Number(source.roll)) ? Number(source.roll) : null,
            decisionAt: timestamp(source.decisionAt, 0),
            phase: phase,
            phaseAt: timestamp(source.phaseAt, 0),
            revision: Math.max(0, Math.round(Number(source.revision || 0))),
            commandId: String(source.commandId || ''),
            sceneId: String(source.sceneId || ''),
            sceneFallback: source.sceneFallback === true,
            inspectorsWaiting: phase !== 'released' && (
                source.inspectorsWaiting === true
                || PHASE_ORDER[phase] >= PHASE_ORDER.inspectors_waiting
            ),
            farewellComplete: source.farewellComplete === true,
            requestText: String(source.requestText || ''),
            requestSpokenAt: timestamp(source.requestSpokenAt, 0),
            snapshot: source.snapshot && typeof source.snapshot === 'object'
                ? clone(source.snapshot, null)
                : null,
            remediation: {
                required: remediation.required === true,
                missingFields: (Array.isArray(remediation.missingFields) ? remediation.missingFields : [])
                    .filter(function (field) { return field === 'start' || field === 'landing'; })
            },
            result: result,
            resultText: String(source.resultText || ''),
            resultSpokenAt: timestamp(source.resultSpokenAt, 0),
            pendingClose: source.pendingClose && typeof source.pendingClose === 'object'
                ? clone(source.pendingClose, null)
                : null,
            releasedAt: timestamp(source.releasedAt, 0),
            updatedAt: timestamp(source.updatedAt, 0)
        };
    }

    function phaseAtLeast(state, phase) {
        return Number(PHASE_ORDER[object(state).phase] || 0) >= Number(PHASE_ORDER[phase] || 0);
    }

    function itemLabel(item, fallback) {
        var source = object(item);
        var id = String(source.id || fallback || '');
        if (id === 'bordbuch') return 'Bordbuch';
        if (id === 'fire-extinguisher') return 'Feuerloescher';
        if (id === 'first-aid') return 'Verbandzeug';
        return String(source.storyName || source.label || fallback || 'Gegenstand').trim();
    }

    function dateDayNumber(value) {
        var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        return Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
    }

    function expiryStatus(expiresAt, now) {
        var expiryDay = dateDayNumber(expiresAt);
        var date = new Date(Number(now) || Date.now());
        var todayDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
        if (!Number.isFinite(expiryDay)) {
            return { valid: false, missing: true, daysRemaining: null, overdueDays: null };
        }
        var daysRemaining = expiryDay - todayDay;
        return {
            valid: daysRemaining >= 0,
            missing: false,
            daysRemaining: daysRemaining,
            overdueDays: daysRemaining < 0 ? Math.abs(daysRemaining) : 0
        };
    }

    function classifyOverdue(overdueDays) {
        var days = Math.max(0, Math.round(Number(overdueDays || 0)));
        if (days <= 0) return 'valid';
        if (days <= 3) return 'warning';
        return 'entry';
    }

    function shouldInspect(roll, forced) {
        if (forced === true) return true;
        var value = Number(roll);
        return Number.isFinite(value) && value >= 0 && value < PROBABILITY;
    }

    function decide(rawState, input) {
        var options = object(input);
        var state = normalizeState(rawState, options);
        if (state.phase === 'released') return state;
        var now = timestamp(options.now, Date.now());
        var roll = Number.isFinite(Number(options.roll)) ? Number(options.roll) : 0;
        state.forced = state.forced || options.force === true;
        state.roll = roll;
        state.selected = shouldInspect(roll, state.forced);
        state.decisionAt = now;
        state.flightId = String(options.flightId || state.flightId || '');
        state.phase = state.selected ? 'selected' : 'not_selected';
        state.phaseAt = now;
        return state;
    }

    function createSnapshot(state, manifest, input) {
        var current = object(state);
        if (current.snapshot) return clone(current.snapshot, null);
        var source = object(manifest);
        var options = object(input);
        var items = Array.isArray(source.items) ? source.items : [];
        return {
            at: timestamp(options.now, Date.now()),
            flightId: String(current.flightId || options.flightId || ''),
            aircraftSlot: String(source.aircraftSlot || ''),
            items: REQUESTED_ITEM_IDS.map(function (id) {
                var item = items.find(function (entry) { return String(object(entry).id || '') === id; }) || null;
                return {
                    id: id,
                    label: itemLabel(item, id),
                    status: String(object(item).status || 'missing'),
                    expiresAt: String(object(item).expiresAt || ''),
                    serialId: String(object(item).serialId || '')
                };
            })
        };
    }

    function remediationState(state, manifest, input) {
        var source = object(manifest);
        var options = object(input);
        var item = (Array.isArray(source.items) ? source.items : []).find(function (entry) {
            return String(object(entry).id || '') === 'bordbuch';
        }) || null;
        var log = object(object(item).log);
        var flightId = String(object(state).flightId || options.flightId || '');
        var correctFlight = String(log.flightId || '') === flightId;
        var missingFields = [];
        if (!correctFlight || !Number(log.startAt || 0)) missingFields.push('start');
        if (!correctFlight || !Number(log.landingAt || 0)) missingFields.push('landing');
        var canRemediate = !!item && item.status === 'unloaded';
        return {
            required: canRemediate && missingFields.length > 0,
            missingFields: canRemediate ? missingFields : []
        };
    }

    function evaluateEvidence(state, manifest, input) {
        var current = object(state);
        var source = object(manifest);
        var options = object(input);
        var items = Array.isArray(source.items) ? source.items : [];
        var inspectedItems = Array.isArray(object(current.snapshot).items) ? current.snapshot.items : [];
        var offences = [];
        var blockingUnload = [];
        var equipment = [];
        for (var index = 0; index < REQUESTED_ITEM_IDS.length; index += 1) {
            var id = REQUESTED_ITEM_IDS[index];
            var item = items.find(function (entry) { return String(object(entry).id || '') === id; }) || null;
            var inspectedItem = inspectedItems.find(function (entry) { return String(object(entry).id || '') === id; }) || null;
            var label = itemLabel(item, id);
            var carriedOnFlight = inspectedItem
                ? String(inspectedItem.status || '') === 'loaded'
                : String(object(item).status || '') === 'loaded';
            if (!carriedOnFlight) {
                offences.push({
                    code: 'missing_' + id,
                    itemId: id,
                    label: label,
                    severity: 'entry',
                    description: label + ' wurde auf dem kontrollierten Flug nicht mitgefuehrt.'
                });
                continue;
            }
            if (object(item).status === 'loaded') {
                blockingUnload.push(label);
                continue;
            }
            if (!item || item.status !== 'unloaded') {
                offences.push({
                    code: 'not_presented_' + id,
                    itemId: id,
                    label: label,
                    severity: 'entry',
                    description: label + ' wurde bei der Kontrolle nicht vorgelegt.'
                });
                continue;
            }
            if (id === 'bordbuch') {
                var log = object(item.log);
                var correctFlight = String(log.flightId || '') === String(current.flightId || '');
                var missingFields = [];
                if (!correctFlight || !Number(log.startAt || 0)) missingFields.push('start');
                if (!correctFlight || !Number(log.landingAt || 0)) missingFields.push('landing');
                if (missingFields.length) {
                    return {
                        ready: false,
                        blockingUnload: blockingUnload,
                        missingLogFields: missingFields,
                        offences: offences,
                        equipment: equipment
                    };
                }
                equipment.push({ id: id, label: label, status: 'logged', log: clone(log, {}) });
                continue;
            }
            var inspectedExpiry = String(object(inspectedItem).expiresAt || item.expiresAt || '');
            var expiry = expiryStatus(inspectedExpiry, timestamp(options.now, Date.now()));
            var classification = expiry.missing ? 'entry' : classifyOverdue(expiry.overdueDays);
            equipment.push({
                id: id,
                label: label,
                status: classification,
                expiresAt: inspectedExpiry,
                daysRemaining: expiry.daysRemaining,
                overdueDays: expiry.overdueDays
            });
            if (classification === 'warning') {
                offences.push({
                    code: 'overdue_' + id,
                    itemId: id,
                    label: label,
                    severity: 'warning',
                    overdueDays: expiry.overdueDays,
                    description: label + ' war seit ' + expiry.overdueDays + ' ' + (expiry.overdueDays === 1 ? 'Tag' : 'Tagen') + ' abgelaufen.'
                });
            } else if (classification === 'entry') {
                offences.push({
                    code: expiry.missing ? 'missing_expiry_' + id : 'overdue_' + id,
                    itemId: id,
                    label: label,
                    severity: 'entry',
                    overdueDays: expiry.overdueDays,
                    description: expiry.missing
                        ? 'Fuer ' + label + ' war kein gueltiges Ablaufdatum nachweisbar.'
                        : label + ' war seit ' + expiry.overdueDays + ' Tagen abgelaufen.'
                });
            }
        }
        return {
            ready: blockingUnload.length === 0,
            blockingUnload: blockingUnload,
            missingLogFields: [],
            offences: offences,
            equipment: equipment
        };
    }

    function completeEvidenceResult(result, now) {
        var completed = clone(object(result), {});
        completed.completedAt = timestamp(now, Date.now());
        completed.warningCount = (Array.isArray(completed.offences) ? completed.offences : []).filter(function (offence) {
            return offence && offence.severity === 'warning';
        }).length;
        completed.entryCount = (Array.isArray(completed.offences) ? completed.offences : []).filter(function (offence) {
            return offence && offence.severity === 'entry';
        }).length;
        return completed;
    }

    function resultVoiceText(result) {
        var source = object(result);
        var offences = Array.isArray(source.offences) ? source.offences : [];
        var entries = offences.filter(function (offence) { return offence && offence.severity === 'entry'; });
        var warnings = offences.filter(function (offence) { return offence && offence.severity === 'warning'; });
        var equipment = Array.isArray(source.equipment) ? source.equipment : [];
        var validity = equipment
            .filter(function (item) { return item.id !== 'bordbuch' && item.status === 'valid'; })
            .map(function (item) { return item.label + ' gueltig bis ' + item.expiresAt; })
            .join(' und ');
        if (!entries.length && !warnings.length) {
            return 'Danke. Der aktuelle Flug ist im Bordbuch vollstaendig eingetragen' + (validity ? ', ' + validity : '') + '. Die Kontrolle ist ohne Beanstandung abgeschlossen. Gute Weiterreise.';
        }
        var details = warnings.concat(entries).map(function (offence) { return offence.description; }).join(' ');
        if (entries.length) {
            return details + ' Dafuer wird ein Behoerdeneintrag am Crewboard angelegt, der sieben Tage bestehen bleibt. Die Kontrolle ist damit abgeschlossen.';
        }
        return details + ' Bei bis zu drei Tagen Ueberziehung bleibt es diesmal bei einer Verwarnung. Die Kontrolle ist abgeschlossen.';
    }

    function createSanctionRecord(state, result, now) {
        var current = object(state);
        var offences = Array.isArray(object(result).offences) ? result.offences : [];
        var entries = offences.filter(function (offence) { return offence && offence.severity === 'entry'; });
        if (!entries.length) return null;
        var createdAt = timestamp(now, Date.now());
        var safeFlightId = String(current.flightId || '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80);
        return {
            id: 'authority-' + safeFlightId + '-' + createdAt,
            type: 'authority_sanction',
            createdAt: createdAt,
            immutableUntil: createdAt + SANCTION_DURATION_MS,
            expiresAt: createdAt + SANCTION_DURATION_MS,
            flightId: current.flightId,
            aircraftSlot: String(object(current.snapshot).aircraftSlot || ''),
            offences: entries.map(function (entry) { return clone(entry, {}); }),
            text: 'BEHOERDENEINTRAG\n\n' + entries.map(function (entry) { return '• ' + entry.description; }).join('\n') + '\n\nNicht loeschbar fuer 7 Tage.'
        };
    }

    function projectCargoUiState(rawState) {
        var state = normalizeState(rawState);
        if (!state.selected || state.phase === 'released') {
            return {
                active: false,
                phase: state.phase || 'none',
                replacementLocked: false,
                message: '',
                actionLabel: ''
            };
        }
        var message = 'Behoerdenkontrolle ist fuer diesen Flug vorgesehen.';
        var actionLabel = 'Kontrolle wird vorbereitet ...';
        if (state.phase === 'approach_started' || state.phase === 'inspectors_waiting') {
            message = state.inspectorsWaiting
                ? 'Die Kontrolleure warten am Flugzeug auf das Ende des Farewells.'
                : 'Das Behoerdenfahrzeug ist unterwegs. Ausladen ist bereits moeglich; Austauschen ist gesperrt.';
        } else if (state.phase === 'request_playing') {
            message = 'Die Kontrollansage laeuft. Bitte auf die Aufforderung warten.';
        } else if (state.phase === 'evidence_open') {
            message = state.remediation.required
                ? 'Der aktuelle Bordbucheintrag muss vor Abschluss der Kontrolle nachgetragen werden.'
                : 'Bordbuch, Feuerloescher und Verbandzeug ausladen und anschliessend zur Pruefung vorlegen.';
            actionLabel = 'Der Kontrolle vorlegen';
        } else if (state.phase === 'result_playing') {
            message = 'Das Kontrollergebnis wird bekanntgegeben.';
        } else if (state.phase === 'departing') {
            message = 'Die Kontrolleure kehren zum Fahrzeug zurueck. Missionsende bleibt bis zur Abfahrt gesperrt.';
        }
        return {
            active: true,
            phase: state.phase,
            replacementLocked: true,
            message: message,
            actionLabel: actionLabel,
            remediation: clone(state.remediation, null)
        };
    }

    function canMutateCargo(rawState, itemId, action) {
        var state = normalizeState(rawState);
        if (!state.selected || state.phase === 'released') return true;
        if (!REQUESTED_ITEM_IDS.includes(String(itemId || ''))) return true;
        if (state.phase === 'result_playing' || state.phase === 'departing') return false;
        if (String(action || '') === 'replace') return false;
        return true;
    }

    function boardBookWriteAllowed(rawState, field) {
        var state = normalizeState(rawState);
        if (!state.selected || state.phase === 'released') return true;
        if (!phaseAtLeast(state, 'request_playing')) return true;
        if (state.phase !== 'evidence_open') return false;
        var normalized = field === 'landing' ? 'landing' : 'start';
        return state.remediation.required === true && state.remediation.missingFields.includes(normalized);
    }

    return Object.freeze({
        CORE_VERSION: CORE_VERSION,
        PROBABILITY: PROBABILITY,
        REQUESTED_ITEM_IDS: REQUESTED_ITEM_IDS,
        PHASE_ORDER: PHASE_ORDER,
        INSPECTOR_SPEAKER: INSPECTOR_SPEAKER,
        REQUEST_TEXT: REQUEST_TEXT,
        SANCTION_DURATION_MS: SANCTION_DURATION_MS,
        normalizeState: normalizeState,
        phaseAtLeast: phaseAtLeast,
        itemLabel: itemLabel,
        dateDayNumber: dateDayNumber,
        expiryStatus: expiryStatus,
        classifyOverdue: classifyOverdue,
        shouldInspect: shouldInspect,
        decide: decide,
        createSnapshot: createSnapshot,
        remediationState: remediationState,
        evaluateEvidence: evaluateEvidence,
        completeEvidenceResult: completeEvidenceResult,
        resultVoiceText: resultVoiceText,
        createSanctionRecord: createSanctionRecord,
        projectCargoUiState: projectCargoUiState,
        canMutateCargo: canMutateCargo,
        boardBookWriteAllowed: boardBookWriteAllowed
    });
}));
