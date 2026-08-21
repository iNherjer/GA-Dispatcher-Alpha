(function (root, factory) {
    'use strict';
    var complianceCore = typeof module === 'object' && module.exports
        ? require('./mission-compliance-domain-core.js')
        : (root && root.GAMissionComplianceDomainCore);
    var api = factory(complianceCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionAptUiCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (complianceCore) {
    'use strict';

    var UI_SCHEMA = 'ga.mission-apt-ui.v1';
    var UI_VERSION = 1;
    var ARRIVAL_PHASES = /^(end_unloading|end_ready)$/;

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function text(value, maxLength) {
        return String(value == null ? '' : value).trim().slice(0, maxLength || 240);
    }

    function actions(value) {
        return Array.from(new Set((Array.isArray(value) ? value : []).map(function (entry) {
            return text(entry, 80).toLowerCase();
        }).filter(Boolean)));
    }

    function includes(list, value) {
        return list.indexOf(value) >= 0;
    }

    function expiryDaysRemaining(expiresAt, now) {
        var match = text(expiresAt, 20).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        var expiryDay = Math.floor(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000);
        var date = new Date(Number.isFinite(Number(now)) ? Number(now) : Date.now());
        var todayDay = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
        return expiryDay - todayDay;
    }

    function expiryDateLabel(expiresAt) {
        var match = text(expiresAt, 20).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? match[3] + ' ' + match[2] + ' ' + match[1] : '-- -- ----';
    }

    function phaseOf(source, control) {
        return text(control.phase || source.phase || source.state, 80).toLowerCase();
    }

    function destinationOf(source, control) {
        var candidate = object(source.destination);
        if (!Object.keys(candidate).length) candidate = object(object(control.flight).destination);
        var dArrivalNm = Number(candidate.dArrivalNm);
        var dMissionNm = Number(candidate.dMissionNm);
        return {
            hasAptArrival: candidate.hasAptArrival === true,
            dArrivalNm: Number.isFinite(dArrivalNm) ? dArrivalNm : null,
            dMissionNm: Number.isFinite(dMissionNm) ? dMissionNm : null
        };
    }

    function bannerKey(source, control, phase, model) {
        return [
            text(control.missionId || source.missionId, 180),
            Math.max(0, Math.round(Number(control.authorityRevision || source.revision) || 0)),
            phase,
            model.kind,
            model.intent || ''
        ].join(':');
    }

    function bannerModel(rawSource) {
        var source = object(rawSource);
        var control = Object.keys(object(source.control)).length ? object(source.control) : source;
        if (control.executionAuthority !== 'tracker') return null;
        var allowed = actions(control.allowedActions);
        var phase = phaseOf(source, control);
        var flags = object(control.flags);
        var manifest = object(source.manifest);
        var manifestItems = Array.isArray(manifest.items)
            ? manifest.items
            : (Array.isArray(object(control.cargo).items) ? object(control.cargo).items : []);
        var arrivalPassenger = ARRIVAL_PHASES.test(phase)
            && includes(allowed, 'request_pax_interaction')
            && manifestItems.some(function (item) {
                var candidate = object(item);
                return text(candidate.itemType, 30).toLowerCase() === 'passenger'
                    && text(candidate.status, 30).toLowerCase() === 'loaded'
                    && text(candidate.delivery || 'destination', 30).toLowerCase() === 'destination';
            });
        var cargoAction = ['set_manifest_item', 'sign_manifest', 'clear_manifest_signature', 'confirm_load', 'confirm_pickup', 'confirm_unload']
            .some(function (intent) { return includes(allowed, intent); });
        var compliance = complianceCore && typeof complianceCore.projectCargoUiState === 'function'
            ? complianceCore.projectCargoUiState(object(object(control.workflows).complianceInspection))
            : { active: false };
        var model = null;

        if (compliance.active === true
            && !['selected', 'not_selected', 'none', 'released'].includes(compliance.phase)) {
            var complianceCargoOpen = ['approach_started', 'inspectors_waiting', 'evidence_open'].includes(compliance.phase);
            model = {
                intent: '', kind: complianceCargoOpen ? 'cargo' : 'wait', cargoMode: 'unload',
                kicker: 'BEHOERDENKONTROLLE', text: compliance.message,
                button: complianceCargoOpen ? 'Verladefenster' : 'Bitte warten...',
                className: '', disabled: !complianceCargoOpen
            };
            model.endReady = true;
            model.closeHidden = true;
        } else if (includes(allowed, 'activate_cloud_mission')) {
            model = {
                intent: 'activate_cloud_mission', kind: 'intent', kicker: 'Cloud-Mission bereit',
                text: 'Mission aus der Cloud übernehmen und vorbereiten.', button: 'Mission beginnen',
                className: 'is-begin-action', disabled: false
            };
        } else if (phase === 'planned' && includes(allowed, 'prepare_mission')) {
            model = {
                intent: 'prepare_mission', kind: 'intent', kicker: 'Mission bereit',
                text: 'Mission ist geplant. Mit "Mission starten" wird erst dann Szene, Boarding und Verladen freigegeben.',
                button: 'Mission starten', className: 'is-begin-action', disabled: false
            };
        } else if (phase === 'prepare' && includes(allowed, 'start_boarding')) {
            model = {
                intent: 'start_boarding', kind: 'intent', kicker: 'Mission bereit',
                text: 'Missionstart freigegeben. Mit dem nächsten Klick beginnt Boarding und Verladen.',
                button: 'Boarding und Verladen beginnen', className: '', disabled: false
            };
        } else if (phase === 'prepare') {
            model = {
                intent: '', kind: 'wait', kicker: 'Mission bereit',
                text: 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.',
                button: 'Bitte warten...', className: '', disabled: true
            };
        } else if (phase === 'boarding' && flags.boardingConfirmed !== true) {
            model = {
                intent: '', kind: 'wait', kicker: 'Mission bereit',
                text: 'Missionstart angefordert. Szene, Boarding und Verladen werden vorbereitet.',
                button: 'Bitte warten...', className: '', disabled: true
            };
        } else if (phase === 'boarding' && (cargoAction || arrivalPassenger)) {
            model = {
                intent: '', kind: 'cargo', cargoMode: 'load', kicker: 'Mission bereit',
                text: 'Boarding und Ansage sind abgeschlossen. Die Verladung im Ladefenster noch bestätigen.',
                button: 'Verladefenster öffnen', className: '', disabled: false
            };
        } else if (phase === 'boarded' && includes(allowed, 'start_mission')) {
            model = {
                intent: 'start_mission', kind: 'intent', kicker: 'Mission bereit',
                text: 'Boarding abgeschlossen. Wenn du die Ladung sicher verstaut hast, kann es losgehen.',
                button: 'Mission starten', className: '', disabled: false
            };
        } else if (ARRIVAL_PHASES.test(phase)
            && ((flags.farewellStarted === true && flags.farewellCompleted !== true)
                || (flags.farewellCompleted === true && flags.deboardingCompleted !== true))) {
            model = {
                intent: '', kind: 'wait', kicker: 'Mission abschliessen',
                text: 'Deboarding laeuft. Missionabschluss wird vorbereitet.',
                button: 'Bitte warten...', className: '', disabled: true
            };
        } else if (includes(allowed, 'request_close')) {
            var destination = destinationOf(source, control);
            var distance = destination.hasAptArrival ? destination.dArrivalNm : destination.dMissionNm;
            model = {
                intent: 'request_close', kind: 'intent', kicker: 'Mission abschliessen',
                text: Number.isFinite(distance)
                    ? 'Du stehst am Ziel. ' + distance.toFixed(2) + ' NM zum Empfangspunkt.'
                    : 'Du stehst am Ziel. Die Mission kann jetzt beendet werden.',
                button: 'Mission beenden', className: 'is-final-action', disabled: false
            };
            model.endReady = true;
            model.final = true;
            model.closeHidden = true;
        } else if (ARRIVAL_PHASES.test(phase) && (cargoAction || arrivalPassenger)) {
            model = {
                intent: '', kind: 'cargo', cargoMode: 'unload', kicker: 'Ladung entladen',
                text: 'Du stehst am Boden. Vor dem Missionsabschluss jetzt Ladung entladen bzw. Passagiere aussteigen lassen.',
                button: 'Ausladen', className: 'is-end-ready', disabled: false
            };
            model.endReady = true;
            model.closeHidden = true;
        } else if (phase === 'on_task' && cargoAction) {
            model = {
                intent: '', kind: 'cargo', cargoMode: 'pickup', kicker: 'Aktion am Ziel',
                text: 'Der Tracker hat die nächste Verladeaktion freigegeben.',
                button: 'Verladefenster öffnen', className: 'is-begin-action', disabled: false
            };
        } else if (phase === 'closing' || phase === 'closed') {
            model = {
                intent: '', kind: 'debrief', kicker: 'Mission auswerten',
                text: 'Mission erfolgreich abgeschlossen.', button: 'Abschluss & Debrief',
                className: '', disabled: false
            };
            model.closeHidden = true;
        }
        if (!model) return null;
        if (model.begin === undefined) model.begin = model.className === 'is-begin-action';
        if (model.endReady === undefined) model.endReady = model.className === 'is-end-ready';
        if (model.final === undefined) model.final = model.className === 'is-final-action';
        if (model.closeHidden === undefined) model.closeHidden = model.kind === 'wait' && ARRIVAL_PHASES.test(phase);
        model.missionId = text(control.missionId || source.missionId, 180);
        model.revision = Math.max(0, Math.round(Number(control.authorityRevision || source.revision) || 0));
        model.key = bannerKey(source, control, phase, model);
        return model;
    }

    var BLOCKER_LABELS = Object.freeze({
        departure_manifest_incomplete: 'Pflichtladung für den Abflug noch offen',
        departure_signature_missing: 'Abflugmanifest noch nicht unterschrieben',
        boarding_not_confirmed: 'Boarding noch nicht bestätigt',
        load_not_confirmed: 'Verladung noch nicht bestätigt',
        pickup_manifest_incomplete: 'Pickup am Ziel noch offen',
        destination_unload_incomplete: 'Pflichtladung noch zu entladen',
        arrival_signature_missing: 'Ankunftsmanifest noch nicht unterschrieben',
        arrival_unload_not_confirmed: 'Entladung noch nicht bestätigt',
        compliance_inspection_active: 'Bordkontrolle noch aktiv',
        compliance_remediation_required: 'Beanstandung noch zu beheben',
        task_aborted: 'Auftrag wurde abgebrochen',
        cargo_failure: 'Ladungsschaden erkannt'
    });

    function blockerLabel(value) {
        var key = text(value, 100).toLowerCase();
        return BLOCKER_LABELS[key] || key.replace(/_/g, ' ');
    }

    function manifestItems(source, control) {
        var manifest = object(source.manifest);
        return Array.isArray(manifest.items)
            ? manifest.items
            : (Array.isArray(object(control.cargo).items) ? object(control.cargo).items : []);
    }

    function cargoMode(phase) {
        if (/^(planned|prepare|boarding|boarded)$/.test(phase)) return 'load';
        if (phase === 'on_task') return 'pickup';
        if (ARRIVAL_PHASES.test(phase)) return 'unload';
        return 'status';
    }

    function signatureScopeForMode(mode) {
        if (mode === 'unload') return 'arrival';
        if (mode === 'pickup') return 'pickup';
        return 'departure';
    }

    function itemIsPassenger(rawItem) {
        return text(object(rawItem).itemType, 30).toLowerCase() === 'passenger';
    }

    function itemIsEquipment(rawItem) {
        var item = object(rawItem);
        return item.persistentEquipment === true || text(item.itemType, 30).toLowerCase() === 'equipment';
    }

    function itemStatusLabel(rawItem) {
        var item = object(rawItem);
        var status = text(item.status || 'pending', 30).toLowerCase();
        var passenger = itemIsPassenger(item);
        var handedOff = item.handoffComplete === true || status === 'handed_off';
        if (handedOff) return passenger ? 'verabschiedet' : 'mitgenommen';
        if (status === 'lost') return 'verloren';
        if (status === 'dropped') return 'abgeworfen';
        if (status === 'unloaded') return passenger ? 'ausgestiegen' : 'ausgeladen';
        if (status === 'loaded') return passenger ? 'an bord' : 'geladen';
        return 'offen';
    }

    function itemTypeLabel(rawItem) {
        var item = object(rawItem);
        if (itemIsPassenger(item)) {
            var passengerCount = Math.max(1, Math.round(Number(item.passengerCount) || 1));
            return 'PAX' + (passengerCount > 1 ? ' x' + passengerCount : '');
        }
        if (itemIsEquipment(item)) return 'Bordbestand';
        return item.required === true ? 'Pflicht' : 'Optional';
    }

    function blockedMessage(intent, phase) {
        if (intent === 'set_manifest_item'
            && !/^(prepare|boarding|active|enroute|return_leg|on_task|end_unloading|end_ready)$/.test(phase)) {
            return 'Der Tracker hat die Bodenaktion noch nicht freigegeben. Bitte Flug-, Ziel- und Landeerkennung abwarten.';
        }
        if (intent === 'request_pax_interaction') {
            return 'Der Tracker hat das Deboarding noch nicht freigegeben. Bitte Ziel und Stillstand abwarten.';
        }
        return 'Diese Aktion ist im aktuellen Tracker-Missionsstand noch nicht freigegeben.';
    }

    function rowAction(rawItem, rawControl, mode) {
        var item = object(rawItem);
        var control = object(rawControl);
        var allowed = actions(control.allowedActions);
        var flags = object(control.flags);
        var phase = phaseOf({}, control);
        var status = text(item.status || 'pending', 30).toLowerCase();
        var passenger = itemIsPassenger(item);
        var equipment = itemIsEquipment(item);
        var handedOff = item.handoffComplete === true || status === 'handed_off';
        var groundHandlingAllowed = flags.groundStill === true;
        var pickup = text(item.pickup || (item.pickupLocation === 'target' ? 'target' : 'departure'), 30).toLowerCase();
        var delivery = text(item.delivery || (item.deliverAtDestination === false ? 'onboard' : 'destination'), 30).toLowerCase();
        var reloadAllowed = item.reloadAllowed !== false;
        var canLoadAtStage = pickup !== 'target' || phase === 'on_task';
        var intent = passenger ? 'request_pax_interaction' : 'set_manifest_item';
        var action = '';
        var label = '';
        var disabled = true;

        if (handedOff) return { intent: '', action: '', label: passenger ? 'Verabschiedet' : 'Vom PAX mitgenommen', disabled: true };
        if (status === 'dropped') return { intent: '', action: '', label: 'Abgeworfen', disabled: true };
        if (status === 'lost') return { intent: '', action: '', label: 'Verloren', disabled: true };

        if (mode === 'unload') {
            if (status === 'loaded') {
                action = 'unload';
                label = groundHandlingAllowed ? (passenger ? 'Aussteigen' : 'Ausladen') : (passenger ? 'Nur am Boden' : 'Abwerfen');
                disabled = passenger ? (!groundHandlingAllowed || !includes(allowed, intent)) : !includes(allowed, intent);
            } else if (status === 'unloaded') {
                intent = 'set_manifest_item';
                action = 'load';
                label = !groundHandlingAllowed ? 'Nur am Boden' : (reloadAllowed ? (passenger ? 'Einsteigen' : 'Wieder laden') : 'Zu weit weg');
                disabled = passenger || !groundHandlingAllowed || !reloadAllowed || !includes(allowed, intent) || !canLoadAtStage;
            } else {
                return { intent: '', action: '', label: 'Nicht an Bord', disabled: true };
            }
        } else if (mode === 'pickup') {
            if (status === 'loaded') return { intent: '', action: '', label: passenger ? 'An Bord' : 'Geladen', disabled: true };
            if (status !== 'pending' && status !== 'unloaded') return { intent: '', action: '', label: 'Nicht verfügbar', disabled: true };
            intent = passenger ? 'request_pax_interaction' : 'set_manifest_item';
            action = 'load';
            label = !groundHandlingAllowed ? 'Nur am Boden' : (!canLoadAtStage ? 'Am Ziel' : (passenger ? 'Einsteigen' : 'Laden'));
            disabled = passenger || !groundHandlingAllowed || !canLoadAtStage || !includes(allowed, intent);
        } else if (mode === 'load') {
            if (passenger) {
                if (status === 'loaded') return { intent: '', action: '', label: 'An Bord', disabled: true };
                return { intent: '', action: '', label: 'Via Boarding', disabled: true };
            }
            intent = 'set_manifest_item';
            action = status === 'loaded' ? 'unload' : 'load';
            if (status === 'loaded') label = !groundHandlingAllowed ? 'Nur am Boden' : 'Ausladen';
            else label = !groundHandlingAllowed ? 'Nur am Boden' : (status === 'unloaded' ? (reloadAllowed ? 'Wieder laden' : 'Zu weit weg') : 'Laden');
            disabled = !groundHandlingAllowed || !reloadAllowed || !canLoadAtStage || !includes(allowed, intent);
            if (equipment && status === 'loaded' && groundHandlingAllowed) label = 'Ausladen';
        } else {
            return null;
        }

        if (!includes(allowed, intent) && intent) label = blockedMessage(intent, phase);
        return { intent: intent, action: action, label: label, disabled: disabled };
    }

    function itemAction(rawItem, rawControl) {
        var control = object(rawControl);
        if (object(control.flags).groundStill === undefined) {
            control = Object.assign({}, control, { flags: Object.assign({}, object(control.flags), { groundStill: true }) });
        }
        var phase = phaseOf({}, control);
        var action = rowAction(rawItem, control, cargoMode(phase));
        return action && action.intent && action.disabled !== true
            ? { intent: action.intent, action: action.action, label: action.label }
            : null;
    }

    function directActions(rawControl) {
        var allowed = actions(object(rawControl).allowedActions);
        return [
            { intent: 'sign_manifest', label: 'Unterschrift eintragen', className: 'mission-cargo-primary' },
            { intent: 'clear_manifest_signature', label: 'Zurueck zur Liste', className: 'mission-cargo-secondary' },
            { intent: 'confirm_load', label: 'Verladung abschließen', className: 'mission-cargo-primary' },
            { intent: 'confirm_pickup', label: 'Pickup bestätigen und Rückflug freigeben', className: 'mission-cargo-primary' },
            {
                intent: 'confirm_unload', followupIntent: 'request_close',
                label: 'Entladung abgeschlossen - Mission beenden', className: 'mission-cargo-primary'
            }
        ].filter(function (entry) { return includes(allowed, entry.intent); });
    }

    function interactionHint(phase, cloudPending) {
        if (phase === 'planned' && cloudPending === true) return 'Mission zuerst ueber das Kartenbanner aus der Cloud beginnen. Danach gibt der Tracker die Verladung frei.';
        if (phase === 'planned') return 'Mission zuerst im Missionsmenü vorbereiten. Danach gibt der Tracker die Verladung frei.';
        if (phase === 'boarded') return 'Die Verladung ist abgeschlossen. Starte die Mission im Missionsmenü.';
        if (/^(active|enroute|return_leg)$/.test(phase)) return 'Ladung ist während des Flugabschnitts gesperrt. Entladen wird erst nach erkannter Landung am Missionsziel und Stillstand freigegeben.';
        if (phase === 'on_task') return 'Der Tracker hat die Bodenaktion am Ziel noch nicht freigegeben. Position und Stillstand werden weiter geprüft.';
        if (phase === 'closing') return 'Der Tracker schließt die Mission gerade ab. Ladungsaktionen sind gesperrt.';
        return 'Im aktuellen Tracker-Missionsstand ist keine Ladungsaktion freigegeben.';
    }

    function cargoModel(rawSource) {
        var source = object(rawSource);
        var control = Object.keys(object(source.control)).length ? object(source.control) : source;
        if (control.executionAuthority !== 'tracker') return null;
        var manifest = object(source.manifest);
        var phase = phaseOf(source, control);
        var mode = cargoMode(phase);
        var flags = object(control.flags);
        var allowed = actions(control.allowedActions);
        var compliance = complianceCore && typeof complianceCore.projectCargoUiState === 'function'
            ? complianceCore.projectCargoUiState(object(object(control.workflows).complianceInspection))
            : { active: false, phase: 'none', message: '', actionLabel: '' };
        var summary = object(object(control.cargo).summary || manifest.summary);
        var items = manifestItems(source, control);
        var visibleItems = mode === 'pickup'
            ? items.filter(function (item) { return text(object(item).pickup || object(item).pickupLocation, 30).toLowerCase() === 'target'; })
            : items;
        var pickupPlaceLabel = text(source.missionProfileId, 100).toLowerCase() === 'apt_charter_pickup'
            ? 'Zielplatz'
            : 'Zielstrip';
        var pickupHasPassenger = visibleItems.some(itemIsPassenger);
        var pickupHasCargo = visibleItems.some(function (item) { return !itemIsPassenger(item); });
        var pickupItemTypeLabel = pickupHasPassenger && pickupHasCargo
            ? 'wartenden Pickup-Gast und seine Begleitfracht'
            : (text(source.pickupKind, 40).toLowerCase() === 'cargo' ? 'Rueckholfracht' : 'wartenden Pickup-Gast');
        var signatureScope = signatureScopeForMode(mode);
        var signature = object(manifest.dispatchSignature);
        var signed = text(signature.scope || manifest.signatureScope || object(control.cargo).signatureScope, 20).toLowerCase() === signatureScope;
        if (!signed) signature = {};
        var signatureAnimating = source.signatureAnimating === true && signed;
        var signatureReady = signed && !signatureAnimating;
        var groundHandlingAllowed = flags.groundStill === true;
        var requiredMissing = mode === 'unload'
            ? Math.max(0, Number(summary.destinationRemaining) || 0)
            : (mode === 'pickup'
                ? Math.max(0, Number(summary.pickupMissing) || 0)
                : Math.max(0, Number(summary.departureMissing) || 0));
        var passengerDeboardPending = mode === 'unload' && visibleItems.some(function (item) {
            return itemIsPassenger(item) && text(object(item).status, 30).toLowerCase() === 'loaded';
        });
        var projectedItems = visibleItems.map(function (rawItem, index) {
            var item = object(rawItem);
            var status = text(item.status || 'pending', 30).toLowerCase();
            var handedOff = item.handoffComplete === true || status === 'handed_off';
            var action = rowAction(item, control, mode);
            var classes = [];
            if (status === 'loaded') classes.push('is-loaded');
            if (status === 'unloaded') classes.push('is-unloaded');
            if (handedOff) classes.push('is-handed-off');
            if (status === 'lost') classes.push('is-lost');
            if (action && action.disabled !== true && action.intent) classes.push('is-interactive');
            if (action && action.disabled === true && itemIsPassenger(item)) classes.push('is-disabled');
            var equipmentDetail = null;
            var stationAction = null;
            var isBoardBook = /bordbuch/i.test(text(item.id, 120) + ' ' + text(item.label, 180) + ' ' + text(item.storyName, 180));
            if (isBoardBook && item.persistentEquipment === true) {
                var currentFlightId = text(object(manifest.flightEvents).flightId, 220);
                var log = object(item.log);
                if (text(log.flightId, 220) !== currentFlightId) log = {};
                var hasStart = Number(log.startAt || 0) > 0;
                var hasLanding = Number(log.landingAt || 0) > 0;
                var boardBookField = !hasStart ? 'start' : (!hasLanding ? 'landing' : '');
                var boardBookLabel = hasStart && hasLanding
                    ? 'Flug eingetragen'
                    : (boardBookField === 'landing' ? 'Landezeit eintragen' : 'Startzeit eintragen');
                equipmentDetail = {
                    kind: 'boardbook',
                    text: 'Start: ' + text(log.startTime || '--', 80) + ' · Landung: ' + text(log.landingTime || '--', 80),
                    tone: ''
                };
                stationAction = {
                    intent: 'set_boardbook_time', action: boardBookField || 'landing', label: boardBookLabel,
                    disabled: !boardBookField || !includes(allowed, 'set_boardbook_time')
                };
            } else if (status === 'unloaded' && item.persistentEquipment === true && text(item.equipmentType, 40) === 'expiry') {
                var daysRemaining = expiryDaysRemaining(item.expiresAt, source.now);
                var expiryTone = !Number.isFinite(daysRemaining) || daysRemaining < 0
                    ? 'is-expired'
                    : (daysRemaining < 5 ? 'is-due' : 'is-valid');
                var expiryText = Number.isFinite(daysRemaining)
                    ? (daysRemaining < 0
                        ? 'seit ' + Math.abs(daysRemaining) + ' ' + (Math.abs(daysRemaining) === 1 ? 'Tag' : 'Tagen') + ' abgelaufen'
                        : 'noch ' + daysRemaining + ' ' + (daysRemaining === 1 ? 'Tag' : 'Tage') + ' gueltig')
                    : 'Ablaufdatum fehlt';
                equipmentDetail = {
                    kind: 'expiry',
                    text: 'Ablaufdatum: ' + expiryDateLabel(item.expiresAt) + ' · ' + expiryText,
                    tone: expiryTone
                };
                if (!Number.isFinite(daysRemaining) || daysRemaining < 5) {
                    stationAction = {
                        intent: 'replace_equipment', action: 'replace', label: 'Erneuern',
                        disabled: !includes(allowed, 'replace_equipment')
                    };
                }
            }
            return {
                id: text(item.id, 120),
                index: index + 1,
                label: text(item.storyName || item.label || item.name || item.id, 180),
                typeLabel: itemTypeLabel(item),
                weightLbs: Math.max(0, Math.round(Number(item.weightLbs) || 0)),
                station: text(item.station || item.stationLabel || item.seatLabel || item.position || '-', 100) || '-',
                status: status,
                statusLabel: itemStatusLabel(item),
                rowClasses: classes.join(' '),
                action: action,
                equipmentDetail: equipmentDetail,
                stationAction: stationAction
            };
        });
        var signatureActionEnabled = (signed || requiredMissing === 0) && includes(allowed, 'sign_manifest');
        var signatureStateText = signatureAnimating
            ? 'wird eingetragen'
            : (signatureReady
                ? 'Klick: Signatur löschen'
                : (signatureActionEnabled
                    ? 'Klick: unterschreiben'
                    : (mode === 'unload'
                        ? 'Pflichtladung zuerst vollständig entladen'
                        : (mode === 'pickup' ? 'Pickup zuerst vollständig laden' : 'Pflichtladung zuerst vollständig laden'))));
        var payload = object(control.payload);
        var payloadPresentation = object(payload.presentation);
        var payloadClassName = ['is-pending', 'is-ok', 'is-warn'].indexOf(text(payloadPresentation.className, 30)) >= 0
            ? text(payloadPresentation.className, 30)
            : 'is-warn';
        var payloadFinalizeRunning = flags.payloadSyncRequested === true || text(payload.status, 30).toLowerCase() === 'pending';
        var primary = { intent: '', action: 'close', label: 'Fenster schließen', className: 'mission-cargo-primary', disabled: false };
        if (mode === 'load' && flags.loadConfirmed === true) {
            primary = { intent: '', action: 'close', label: 'Fenster schließen', className: 'mission-cargo-primary', disabled: false };
        } else if ((mode === 'load' || mode === 'unload' || mode === 'pickup') && !signatureReady) {
            primary = {
                intent: 'sign_manifest', action: 'sign',
                label: signatureAnimating ? 'Unterschrift wird eingetragen ...' : 'Unterschrift eintragen',
                className: 'mission-cargo-primary',
                disabled: !groundHandlingAllowed || signatureAnimating || requiredMissing > 0 || !includes(allowed, 'sign_manifest')
            };
        } else if (mode === 'unload') {
            primary = {
                intent: 'confirm_unload', followupIntent: 'request_close', action: 'confirm',
                label: passengerDeboardPending && requiredMissing === 0
                    ? 'Abschied und Deboarding starten'
                    : 'Entladung abgeschlossen - Mission beenden',
                className: 'mission-cargo-primary',
                disabled: !groundHandlingAllowed || requiredMissing > 0 || !includes(allowed, 'confirm_unload')
            };
        } else if (mode === 'pickup') {
            primary = {
                intent: 'confirm_pickup', action: 'confirm', label: 'Pickup bestätigen und Rückflug freigeben',
                className: 'mission-cargo-primary',
                disabled: !groundHandlingAllowed || requiredMissing > 0 || !includes(allowed, 'confirm_pickup')
            };
        } else if (mode === 'load') {
            primary = {
                intent: 'confirm_load', action: 'confirm',
                label: payloadFinalizeRunning ? 'Sim-Zuladung wird geprüft ...' : 'Verladung abschließen',
                className: 'mission-cargo-primary',
                disabled: !groundHandlingAllowed || payloadFinalizeRunning || requiredMissing > 0 || !includes(allowed, 'confirm_load')
            };
        } else {
            primary.disabled = true;
        }
        if (compliance.active === true && compliance.phase === 'evidence_open') {
            primary = {
                intent: 'submit_compliance_evidence', action: 'submit_compliance_evidence',
                label: compliance.actionLabel || 'Der Kontrolle vorlegen',
                className: 'mission-cargo-primary',
                disabled: !includes(allowed, 'submit_compliance_evidence')
            };
        }
        var secondary = signatureReady && !(mode === 'load' && flags.loadConfirmed === true)
            ? {
                intent: 'clear_manifest_signature', action: 'clear_signature', label: 'Zurueck zur Liste',
                className: 'mission-cargo-secondary', disabled: !includes(allowed, 'clear_manifest_signature')
            }
            : null;
        var trackerModeIntent = mode === 'load' || mode === 'pickup' || mode === 'unload' ? 'set_manifest_item' : '';
        var trackerModeLocked = trackerModeIntent && !includes(allowed, trackerModeIntent);
        var modeHint = trackerModeLocked
            ? blockedMessage(trackerModeIntent, phase)
            : (mode === 'unload'
                ? (!groundHandlingAllowed ? 'Im Flug kann Ladung nur abgeworfen werden. Als geliefert gilt sie erst nach Ausladen am Boden.' : '')
                : (mode === 'pickup'
                    ? (!groundHandlingAllowed
                        ? 'Pickup ist nur im Stillstand am ' + pickupPlaceLabel + ' moeglich.'
                        : 'Zum Treffpunkt rollen, Pickup vollständig laden, unterschreiben und danach den Rueckflug bestaetigen.')
                    : (!groundHandlingAllowed
                        ? 'Verladung ist nur am Boden moeglich. Im Flug bleibt diese Liste nur zur Dokumentation sichtbar.'
                        : 'Bordbestand direkt in der Frachtgutliste anklicken. Nach dem Ausladen erscheint das Gueltigkeitsdatum unter dem Namen.')));
        var onboardWeightLbs = items.reduce(function (sum, item) {
            return sum + (text(object(item).status, 30).toLowerCase() === 'loaded' ? Number(object(item).weightLbs || 0) : 0);
        }, 0);
        var unloadedWeightLbs = items.reduce(function (sum, item) {
            return sum + (text(object(item).status, 30).toLowerCase() === 'unloaded' ? Number(object(item).weightLbs || 0) : 0);
        }, 0);
        var copy = mode === 'unload'
            ? 'Entlade die am Ziel benoetigten Gegenstaende. Bordbestand bleibt beim Flugzeug gespeichert, solange du ihn nicht auslaedst. Wiederladen geht im Umkreis von 200 m.'
            : (mode === 'pickup'
                ? 'Hier laedst du ' + pickupItemTypeLabel + ' am ' + pickupPlaceLabel + ' ein. Erst nach Unterschrift und Bestaetigung wird der Rueckflug freigegeben.'
                : (flags.loadConfirmed === true
                    ? (flags.boardingConfirmed === true
                        ? 'Verladung ist bestaetigt. Die Mission ist jetzt startbereit.'
                        : 'Verladung ist bestaetigt. Mission starten wird freigegeben, sobald Boarding und Ansage fertig sind.')
                    : (flags.boardingConfirmed === true
                        ? 'Die Boarding-Animation ist abgeschlossen. Nach dem Abschliessen der Verladung ist die Mission startbereit.'
                        : 'Verladen ist bereits moeglich. Die eigentliche Missionsaktivierung wird erst nach Boarding und Verladung freigeschaltet.')));
        var direct = [secondary, primary].filter(function (entry) { return entry && entry.intent; });
        var interactiveCount = projectedItems.filter(function (item) {
            return item.action && item.action.intent && item.action.disabled !== true;
        }).length + direct.filter(function (entry) { return entry.disabled !== true; }).length;
        return {
            presentation: 'app-cargo-dialog-v1',
            mode: mode,
            phase: phase,
            items: projectedItems,
            directActions: direct,
            header: {
                kicker: mode === 'pickup' ? 'Pickup' : 'Bodenservice',
                title: mode === 'pickup' ? 'Pickup am ' + pickupPlaceLabel : 'Verladung'
            },
            copy: copy,
            modeHint: modeHint,
            signature: {
                visible: mode === 'load' || mode === 'unload' || mode === 'pickup',
                scope: signed ? signatureScope : null,
                signed: signed,
                animating: signatureAnimating,
                clickable: !signatureAnimating && signatureActionEnabled,
                name: signed ? text(signature.by || 'Tracker', 180) : '',
                at: signed ? Math.max(0, Number(signature.at) || 0) : 0,
                stateText: signatureStateText,
                action: signed ? 'clear_manifest_signature' : 'sign_manifest'
            },
            payload: {
                className: payloadClassName,
                message: text(payloadPresentation.message, 1200),
                summary: object(payloadPresentation.summary)
            },
            compliance: {
                active: compliance.active === true,
                phase: compliance.phase || 'none',
                message: compliance.message || '',
                actionLabel: compliance.actionLabel || '',
                remediation: compliance.remediation || null
            },
            summary: {
                left: mode === 'unload'
                    ? requiredMissing + ' Pflicht-Items noch zu entladen' + (passengerDeboardPending ? ' · PAX via Deboarding' : '')
                    : (mode === 'pickup' ? requiredMissing + ' Pickup-Items offen' : requiredMissing + ' Pflicht-Items offen'),
                right: Math.round(onboardWeightLbs) + ' lbs an Bord' + (unloadedWeightLbs > 0 ? ' · ' + Math.round(unloadedWeightLbs) + ' lbs entladen' : ''),
                requiredMissing: requiredMissing,
                passengerDeboardPending: passengerDeboardPending
            },
            actions: { secondary: secondary, primary: primary },
            meta: {
                aircraft: text(signature.aircraft || manifest.aircraftLabel || manifest.aircraftSlot || 'N/A', 180) || 'N/A',
                pilot: text(signature.by || manifest.pilotId || 'Tracker', 180) || 'Tracker',
                dateAt: Math.max(0, Number(signature.at || manifest.createdAt || control.updatedAt || source.updatedAt) || 0)
            },
            blockingReasons: (Array.isArray(control.blockingReasons) ? control.blockingReasons : []).map(blockerLabel),
            lockHint: interactiveCount === 0 ? interactionHint(phase, source.cloudPending === true) : '',
            interactiveCount: interactiveCount
        };
    }

    function project(rawSource) {
        return {
            schema: UI_SCHEMA,
            version: UI_VERSION,
            banner: bannerModel(rawSource),
            cargo: cargoModel(rawSource)
        };
    }

    return Object.freeze({
        UI_SCHEMA: UI_SCHEMA,
        UI_VERSION: UI_VERSION,
        bannerModel: bannerModel,
        blockerLabel: blockerLabel,
        cargoModel: cargoModel,
        directActions: directActions,
        itemAction: itemAction,
        itemStatusLabel: itemStatusLabel,
        itemTypeLabel: itemTypeLabel,
        blockedMessage: blockedMessage,
        project: project
    });
}));
