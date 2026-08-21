(function (root, factory) {
    'use strict';
    var boardingVoiceCore = typeof module === 'object' && module.exports
        ? require('./mission-boarding-voice-core.js')
        : (root && root.GAMissionBoardingVoiceCore);
    var api = factory(boardingVoiceCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionFarewellVoiceCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (boardingVoiceCore) {
    'use strict';

    var RECIPE_SCHEMA = 'ga.mission-farewell-voice-recipe.v1';
    var CONTEXT_SCHEMA = 'ga.mission-farewell-voice-context.v1';

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function text(value, maxLength) {
        var limit = Math.max(1, Number(maxLength) || 4000);
        return String(value == null ? '' : value).trim().slice(0, limit);
    }

    function block(value, maxLength) {
        var limit = Math.max(1, Number(maxLength) || 4000);
        return String(value == null ? '' : value).slice(0, limit);
    }

    function normalizeSpeaker(value) {
        if (boardingVoiceCore && typeof boardingVoiceCore.normalizeSpeaker === 'function') {
            return boardingVoiceCore.normalizeSpeaker(value);
        }
        var source = object(value);
        return {
            name: text(source.name, 120),
            role: text(source.role, 160),
            gender: /^(male|m|mann|maennlich|männlich)$/i.test(text(source.gender, 30)) ? 'male' : 'female',
            roleProfile: text(source.roleProfile, 120),
            taskDomain: text(source.taskDomain, 120).toLowerCase()
        };
    }

    function normalizeCueId(value) {
        if (boardingVoiceCore && typeof boardingVoiceCore.normalizeCueId === 'function') {
            return boardingVoiceCore.normalizeCueId(value);
        }
        var normalized = text(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return normalized || 'none';
    }

    function normalizeModelList(value, fallback, maxEntries) {
        var list = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : []);
        return list.map(function (entry) {
            return text(Array.isArray(entry) ? entry[0] : entry, 100);
        }).filter(function (entry, index, values) {
            return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry) && values.indexOf(entry) === index;
        }).slice(0, Math.max(1, Number(maxEntries) || 6));
    }

    function stringList(value, maxEntries, maxLength) {
        return (Array.isArray(value) ? value : []).map(function (entry) {
            return text(entry, maxLength || 180);
        }).filter(Boolean).slice(0, Math.max(1, Number(maxEntries) || 8));
    }

    function normalizeCargoOutcome(value) {
        var source = object(value);
        var status = text(source.status, 40).toLowerCase();
        return {
            status: status || (source.failed === true ? 'failed' : 'none'),
            failed: source.failed === true,
            missingRequired: stringList(source.missingRequired, 12, 180),
            droppedRequired: stringList(source.droppedRequired, 12, 180),
            notDeliveredRequired: stringList(source.notDeliveredRequired, 12, 240),
            damagedRequired: stringList(source.damagedRequired, 12, 180)
        };
    }

    function normalizeWeather(value) {
        var source = object(value);
        function number(name) {
            return source[name] == null || source[name] === '' || !Number.isFinite(Number(source[name]))
                ? null
                : Number(source[name]);
        }
        return {
            windKts: number('windKts'),
            windDeg: number('windDeg'),
            windGustKts: number('windGustKts'),
            tempC: number('tempC'),
            visKm: number('visKm'),
            precipRateMmH: number('precipRateMmH'),
            precipActive: source.precipActive === true,
            inCloud: source.inCloud === true,
            turbulencePct: number('turbulencePct')
        };
    }

    function normalizeRecord(value) {
        var source = object(value);
        function number(name) {
            return source[name] == null || source[name] === '' || !Number.isFinite(Number(source[name]))
                ? null
                : Number(source[name]);
        }
        return {
            simulated: source.simulated === true,
            durationSec: number('durationSec'),
            distanceNm: number('distanceNm'),
            maxAltFt: number('maxAltFt'),
            maxBankDeg: number('maxBankDeg'),
            maxGForce: number('maxGForce'),
            maxDescentFpm: number('maxDescentFpm'),
            touchdownVsFpm: number('touchdownVsFpm'),
            missionFailed: source.missionFailed === true,
            poiAborted: source.poiAborted === true,
            poiNeedsRideHome: source.poiNeedsRideHome === true,
            missionCargoOutcome: normalizeCargoOutcome(source.missionCargoOutcome)
        };
    }

    function createContext(raw) {
        var source = object(raw);
        var passenger = object(source.passenger);
        var cargo = object(source.cargo);
        var flight = object(source.flight);
        var briefingWeather = normalizeWeather(source.briefingWeather);
        var mode = text(source.mode, 40).toLowerCase() === 'cargo' ? 'cargo' : 'passenger';
        return {
            schema: CONTEXT_SCHEMA,
            version: 1,
            scope: text(source.scope || 'apt_standard', 80).toLowerCase(),
            supported: source.supported !== false,
            unsupportedReason: source.supported === false ? (text(source.unsupportedReason, 160) || 'farewell_context_not_supported') : null,
            mode: mode,
            missionId: text(source.missionId, 180),
            missionAudioKey: text(source.missionAudioKey, 220),
            key: text(source.key, 220),
            enabled: source.enabled !== false,
            audioEnabled: source.audioEnabled !== false,
            playCue: source.playCue === true && mode === 'passenger',
            cueId: source.playCue === true && mode === 'passenger' ? normalizeCueId(source.cueId || 'deboarding_pax') : 'none',
            taskDomain: text(source.taskDomain || object(source.speaker).taskDomain, 120).toLowerCase(),
            speaker: normalizeSpeaker(source.speaker),
            textModels: {
                gemini: normalizeModelList(object(source.textModels).gemini, boardingVoiceCore && boardingVoiceCore.GEMINI_TEXT_MODELS, 8),
                openai: normalizeModelList(object(source.textModels).openai, boardingVoiceCore && boardingVoiceCore.OPENAI_TEXT_MODELS, 8)
            },
            ttsModels: normalizeModelList(source.ttsModels, boardingVoiceCore && boardingVoiceCore.GEMINI_TTS_MODELS, 4),
            ttsHedgeEnabled: source.ttsHedgeEnabled !== false,
            ttsHedgeDelayMs: Math.max(1000, Math.min(10000, Math.round(Number(source.ttsHedgeDelayMs) || 3000))),
            baseContext: block(source.baseContext, 24000),
            passenger: {
                role: text(passenger.role, 180) || 'Passagier',
                gTolerance: text(passenger.gTolerance, 40).toLowerCase(),
                bankTolerance: text(passenger.bankTolerance, 40).toLowerCase()
            },
            motionProtectionEnabled: source.motionProtectionEnabled === true,
            aptFarewellHint: block(source.aptFarewellHint, 1600),
            professionalLandingHint: block(source.professionalLandingHint, 800),
            followUpDeboardingHint: block(source.followUpDeboardingHint, 1600),
            farewellDriftGuard: block(source.farewellDriftGuard, 2400),
            toneHint: block(source.toneHint, 4000),
            storyFocusSubject: text(source.storyFocusSubject, 500) || 'den Auftrag',
            missionFailed: source.missionFailed === true,
            briefingWeather: briefingWeather,
            weatherMismatchAlreadyUsed: source.weatherMismatchAlreadyUsed === true,
            flight: {
                depLabel: text(flight.depLabel, 180) || 'START',
                arrLabel: text(flight.arrLabel, 180) || 'LANDUNG'
            },
            cargo: {
                receiver: text(cargo.receiver, 240) || 'Frachtkontakt am Ziel',
                start: text(cargo.start, 240) || 'Startplatz',
                dest: text(cargo.dest, 240) || 'Zielflugplatz',
                dist: text(cargo.dist, 80) || '?',
                paxText: text(cargo.paxText, 180) || '0 PAX',
                cargoText: text(cargo.cargoText, 1200) || 'wichtige Fracht',
                story: text(cargo.story, 4000) || 'Versorgungsladung fuer einen abgelegenen Zielplatz.',
                contractSummary: text(cargo.contractSummary, 2400),
                arrivalLocation: text(cargo.arrivalLocation, 240) || 'am geplanten Empfangspunkt',
                arrivalCue: text(cargo.arrivalCue, 500),
                cargoName: text(cargo.cargoName, 1200) || text(cargo.cargoText, 1200) || 'wichtige Fracht',
                taskDomain: text(cargo.taskDomain, 120).toLowerCase() || 'general',
                narrativeHint: block(cargo.narrativeHint, 2400)
            }
        };
    }

    function normalizeContext(raw) {
        var source = object(raw);
        if (source.schema !== CONTEXT_SCHEMA || Number(source.version) !== 1) return null;
        var context = createContext(source);
        if (!context.missionId || !context.key || !context.missionAudioKey) return null;
        if (context.mode === 'passenger' && !context.baseContext) return null;
        return context;
    }

    function weatherContext(value) {
        var fd = normalizeWeather(value);
        var parts = [];
        if (fd.windKts != null) {
            var windDescription = fd.windKts > 20 ? ' (kräftig)' : (fd.windKts > 10 ? ' (mäßig)' : ' (schwach)');
            parts.push('Wind ' + fd.windKts + ' kts aus ' + (fd.windDeg == null ? '?' : fd.windDeg) + '°' + windDescription);
        }
        if (fd.windGustKts != null && fd.windKts != null) {
            if (Math.max(0, fd.windGustKts - fd.windKts) >= 4) parts.push('Böen bis ' + fd.windGustKts + ' kts');
        } else if (fd.windGustKts != null) {
            parts.push('Böen bis ' + fd.windGustKts + ' kts');
        }
        if (fd.tempC != null) parts.push(fd.tempC + '°C');
        if (fd.visKm != null) {
            var visibilityDescription = fd.visKm < 3 ? ' (sehr schlecht)'
                : (fd.visKm < 8 ? ' (eingeschränkt)' : (fd.visKm > 20 ? ' (ausgezeichnet)' : ''));
            parts.push('Sicht ' + fd.visKm + ' km' + visibilityDescription);
        }
        if (fd.precipRateMmH != null) {
            var precipitationState = fd.precipRateMmH >= 4 ? 'stark'
                : (fd.precipRateMmH >= 1.5 ? 'mäßig' : (fd.precipRateMmH > 0.05 ? 'leicht' : ''));
            if (precipitationState) parts.push('Niederschlag ' + precipitationState);
        } else if (fd.precipActive === true) {
            parts.push('Niederschlag');
        }
        if (fd.inCloud === true) parts.push('in Wolken');
        if (fd.turbulencePct != null) {
            if (fd.turbulencePct >= 60) parts.push('Turbulenz stark');
            else if (fd.turbulencePct >= 35) parts.push('Turbulenz spürbar');
        }
        return parts.length ? 'Wetter: ' + parts.join(', ') + '.' : '';
    }

    function weatherMismatchHint(context, liveWeather) {
        if (context.weatherMismatchAlreadyUsed) return '';
        var brief = context.briefingWeather;
        var live = normalizeWeather(liveWeather);
        if ((brief.windKts == null && brief.windDeg == null && brief.visKm == null)
            || (live.windKts == null && live.visKm == null)) return '';
        var score = 0;
        if (brief.windKts != null && live.windKts != null && Math.abs(brief.windKts - live.windKts) >= 8) score += 1;
        if (brief.windDeg != null && live.windDeg != null) {
            var directionDifference = Math.abs(((live.windDeg - brief.windDeg + 540) % 360) - 180);
            if (directionDifference >= 60) score += 1;
        }
        if (brief.visKm != null && live.visKm != null && Math.abs(brief.visKm - live.visKm) >= 4) score += 1;
        return score >= 2
            ? ' Kleiner Side-Note mit Augenzwinkern: Das Wetter fühlt sich gerade deutlich anders an als gemeldet — vielleicht hat im MSFS jemand am Wetterregler gespielt.'
            : '';
    }

    function failureText(context, record, cargoOutcome) {
        var damaged = cargoOutcome.damagedRequired;
        var missing = cargoOutcome.missingRequired;
        var dropped = cargoOutcome.droppedRequired;
        var notDelivered = cargoOutcome.notDeliveredRequired;
        var reason = damaged.length
            ? 'weil wichtige Ausruestung beschaedigt wurde (' + damaged.slice(0, 2).join(', ') + ')'
            : (missing.length
                ? 'weil wichtige Ausruestung fehlte (' + missing.slice(0, 2).join(', ') + ')'
                : (dropped.length
                    ? 'weil wichtige Ausruestung verloren ging (' + dropped.slice(0, 2).join(', ') + ')'
                    : (notDelivered.length ? 'weil ' + notDelivered[0] : 'weil wir den Auftrag am Ziel nicht sauber abschliessen konnten')));
        return 'Danke fuers Mitnehmen. Aus Sicht als ' + context.passenger.role + ' war '
            + context.storyFocusSubject + ' heute noch nicht sauber abgeschlossen, ' + reason
            + '. Wollen wir das mit einem klareren zweiten Anlauf noch einmal sauber aufsetzen?';
    }

    function passengerPreparedContext(context, dynamic) {
        var record = normalizeRecord(dynamic.record);
        var cargoOutcome = dynamic.cargoOutcome && typeof dynamic.cargoOutcome === 'object'
            ? normalizeCargoOutcome(dynamic.cargoOutcome)
            : record.missionCargoOutcome;
        var failed = context.missionFailed || dynamic.missionFailed === true || record.missionFailed
            || record.poiAborted || cargoOutcome.failed;
        if (failed) {
            return { key: context.key, text: failureText(context, record, cargoOutcome), speaker: context.speaker };
        }
        var durationSec = record.durationSec;
        var minutes = durationSec == null ? null : Math.max(1, Math.round(durationSec / 60));
        var isSimRecord = record.simulated || durationSec == null;
        var touchdown = !context.motionProtectionEnabled && !isSimRecord && record.touchdownVsFpm != null
            ? Math.abs(record.touchdownVsFpm) + ' ft/min'
            : null;
        var bank = Number(record.maxBankDeg || 0).toFixed(1);
        var maxG = Number(record.maxGForce || 1).toFixed(2);
        var liveWeather = normalizeWeather(dynamic.liveWeather);
        var wx = weatherContext(liveWeather);
        var highlights = '';
        if (!context.motionProtectionEnabled && context.passenger.gTolerance === 'niedrig' && Number(record.maxGForce || 1) > 1.6) {
            highlights += ' Etwas viel G für mich, aber okay.';
        }
        if (!context.motionProtectionEnabled && context.passenger.bankTolerance === 'niedrig' && Number(record.maxBankDeg || 0) > 34) {
            highlights += ' Die Kurven waren schon sportlich.';
        }
        if (!context.motionProtectionEnabled && !isSimRecord && record.maxDescentFpm != null && record.maxDescentFpm <= -1500) {
            highlights += ' Der Sinkflug mit ' + Math.abs(Math.round(record.maxDescentFpm)) + ' ft/min ging etwas auf Ohren und Magen.';
        }
        if (touchdown && Math.abs(record.touchdownVsFpm) < 200) highlights += ' Die Landung war richtig sanft — Kompliment!';
        if (touchdown && Math.abs(record.touchdownVsFpm) > 500) highlights += ' Die Landung mit ' + Math.abs(record.touchdownVsFpm) + ' ft/min war etwas holprig.';
        if (isSimRecord) highlights += ' Hinweis: Sim-Modus aktiv, Landebewertung nur eingeschränkt belastbar.';
        if (wx) highlights += ' ' + wx;
        highlights += weatherMismatchHint(context, liveWeather);

        var farewellTask = context.taskDomain === 'science_bio'
            ? 'Verabschiede dich kurz beim Piloten und gib ein biologisches Abschlussfazit: welcher Habitat-, Arten-, Vegetations-, Ufer- oder Stoerfaktor fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".'
            : (context.taskDomain === 'science_geo'
                ? 'Verabschiede dich kurz beim Piloten und gib ein geologisches Abschlussfazit: welche Relief-, Erosions-, Sediment-, Ufer- oder Hangbeobachtung fuer die Auswertung haengen bleibt und was mit Fotos/Notizen als naechstes passiert. Danke fuer den Flug ist okay, aber kein Sightseeing-Fazit und keine Formulierung wie "schoener Blick", "Blickmoment" oder "den Ort mitnehmen".'
                : 'Verabschiede dich persönlich beim Piloten und gib dein Fazit zum Flug — aus deiner Sicht als ' + context.passenger.role + '. Danke dem Piloten explizit für den Flug (bevorzuge alltagsnah: "danke fürs Mitnehmen" statt "danke für das Mitnehmen"). Auch wenn etwas nicht perfekt war, schließ positiv ab.');
        var facts = context.motionProtectionEnabled
            ? 'Bewegungs-, Komfort- und Landebewertung deaktiviert (Debug-Slew-Schutz).'
            : (minutes != null && record.distanceNm != null && record.maxAltFt != null
                ? minutes + ' min, ' + record.distanceNm.toFixed(1) + ' NM, max ' + Math.round(record.maxAltFt)
                    + ' ft, max Bank ' + bank + '°, max G ' + maxG + 'g.'
                : 'Flugdaten teilweise unvollständig (z. B. Slew/Teleport). Max Bank ' + bank + '°, max G ' + maxG + 'g.');
        var prompt = context.baseContext
            + '\n\nMoment: ' + (context.aptFarewellHint || 'Wir sind gelandet, Flug beendet.')
            + '\nABLAUF: Die Flugzeugtür ist geöffnet; du sitzt noch an Bord und verabschiedest dich unmittelbar vor dem Aussteigen. Behaupte nicht, bereits ausgestiegen, am Fahrzeug oder abgeholt zu sein.'
            + '\nFakten: ' + facts + (highlights ? '\n' + highlights : '')
            + '\n' + farewellTask + context.followUpDeboardingHint + context.professionalLandingHint
            + context.farewellDriftGuard + ' Max 3 Sätze.' + context.toneHint;
        return { key: context.key, prompt: prompt, speaker: context.speaker };
    }

    function cargoPreparedContext(context, dynamic) {
        var record = normalizeRecord(dynamic.record);
        var cargoOutcome = dynamic.cargoOutcome && typeof dynamic.cargoOutcome === 'object'
            ? normalizeCargoOutcome(dynamic.cargoOutcome)
            : record.missionCargoOutcome;
        var failures = cargoOutcome.missingRequired.concat(cargoOutcome.droppedRequired, cargoOutcome.notDeliveredRequired, cargoOutcome.damagedRequired);
        var failureShort = failures.slice(0, 3).join(', ');
        var minutes = record.durationSec == null ? null : Math.max(1, Math.round(record.durationSec / 60));
        var facts = minutes != null && record.distanceNm != null
            ? minutes + ' min, ' + record.distanceNm.toFixed(1) + ' NM, Lieferung ' + context.cargo.cargoName + '.'
            : 'Lieferung ' + context.cargo.cargoName + '.';
        var resultTask = cargoOutcome.failed
            ? 'Sprich als Empfaenger der Lieferung am Ziel direkt zum Piloten. Sag klar, dass die Uebergabe heute noch nicht sauber abgeschlossen ist'
                + (failureShort ? ', weil ' + failureShort + ' fehlt oder nicht brauchbar ist' : '')
                + '. Bleib praktisch und knapp, kein Drama, keine Passagierperspektive. Eine kurze Bitte um neuen Anlauf ist okay.'
            : 'Sprich als Empfaenger der Lieferung am Ziel direkt zum Piloten. Bestaetige kurz, dass die Fracht angekommen ist, sag wofuer sie hier gebraucht wird oder was damit als Naechstes passiert, und bedanke dich fuer den Flug. Keine Passagierperspektive, kein Mitflug, keine Cockpit-Sicht.';
        var prompt = 'ROLLE: ' + context.cargo.receiver + ' · Persönlichkeit: bodenstaendig, direkt, dankbar'
            + '\nFLUG: ' + context.cargo.start + ' → ' + context.cargo.dest + ' · ' + context.cargo.dist + ' NM'
            + '\nAN BORD: ' + context.cargo.paxText
            + '\nAUSRUESTUNG: ' + context.cargo.cargoText
            + '\nAUFTRAG (kurz): ' + context.cargo.story
            + '\nSTIL: kurze Bodenfunk-/Uebergabe-Sprache aus Sicht des Empfaengers; nicht wie ein Passagier an Bord.'
            + (context.cargo.contractSummary ? '\nMISSION-CONTRACT: ' + context.cargo.contractSummary : '')
            + '\nTASK-DOMAIN: ' + context.cargo.taskDomain
            + '\nAUSGABE: Nur gesprochener Text (kein Markdown, keine Regieanweisungen, keine Anführungszeichen).'
            + '\n\nMoment: Die Maschine steht ' + context.cargo.arrivalLocation + '; dort laeuft jetzt die Uebergabe. '
            + (context.cargo.arrivalCue ? 'Am Treffpunkt wartet ' + context.cargo.arrivalCue + '.' : '')
            + '\nFakten: ' + facts
            + '\n' + resultTask + (cargoOutcome.failed ? '' : context.followUpDeboardingHint)
            + '\nErwaehne die Fracht beim Namen: ' + context.cargo.cargoName
            + '. Gib moeglichst ein kleines konkretes Ergebnis oder einen naechsten Schritt der Uebergabe mit.'
            + context.cargo.narrativeHint
            + ' In dieser Abschlussansage zaehlt nur das Ergebnis der Uebergabe am Ziel und was jetzt als Naechstes mit der Fracht passiert; wiederhole den Abhol- oder Rueckfluggrund nicht noch einmal ausfuehrlich. Max 4 Sätze.'
            + context.toneHint;
        return { key: context.key, prompt: prompt, speaker: context.speaker };
    }

    function buildPreparedContext(rawContext, rawDynamic) {
        var context = normalizeContext(rawContext);
        if (!context || context.supported !== true) return null;
        var dynamic = object(rawDynamic);
        return context.mode === 'cargo'
            ? cargoPreparedContext(context, dynamic)
            : passengerPreparedContext(context, dynamic);
    }

    function createRecipeFromContext(rawContext, rawDynamic) {
        var context = normalizeContext(rawContext);
        if (!context) return null;
        if (context.supported !== true) {
            return createRecipe({
                missionId: context.missionId,
                enabled: false,
                skipReason: context.unsupportedReason,
                cargoOnly: context.mode === 'cargo',
                audioEnabled: context.audioEnabled,
                playCue: false,
                taskDomain: context.taskDomain,
                speaker: context.speaker,
                textModels: context.textModels,
                ttsModels: context.ttsModels,
                ttsHedgeEnabled: context.ttsHedgeEnabled,
                ttsHedgeDelayMs: context.ttsHedgeDelayMs
            });
        }
        var prepared = buildPreparedContext(context, rawDynamic);
        if (!prepared) return null;
        return createRecipe({
            missionId: context.missionId,
            enabled: context.enabled,
            cargoOnly: context.mode === 'cargo',
            audioEnabled: context.audioEnabled,
            playCue: context.playCue,
            cueId: context.cueId,
            missionAudioKey: context.missionAudioKey,
            prompt: prepared.prompt || '',
            text: prepared.text || '',
            fallbackText: '',
            taskDomain: context.taskDomain,
            speaker: prepared.speaker || context.speaker,
            textModels: context.textModels,
            ttsModels: context.ttsModels,
            ttsHedgeEnabled: context.ttsHedgeEnabled,
            ttsHedgeDelayMs: context.ttsHedgeDelayMs
        });
    }

    function farewellCueVariantSeed(cueId, missionAudioKey) {
        var id = normalizeCueId(cueId);
        if (id === 'none') return '';
        var rawKey = text(missionAudioKey, 220);
        var separator = rawKey.indexOf(':');
        var missionKey = separator >= 0 ? rawKey.slice(separator + 1) : rawKey;
        missionKey = missionKey || 'active';
        return 'cue-variant-' + id + ':' + missionKey
            + '|mission-deboarding|' + missionKey + '|farewell-cue|' + id;
    }

    function createRecipe(raw) {
        var source = object(raw);
        var prompt = text(source.prompt, 24000);
        var directText = text(source.text, 4000);
        var fallbackText = text(source.fallbackText, 4000);
        var cueId = source.playCue === false ? 'none' : normalizeCueId(object(source.cue).id || source.cueId || 'none');
        var defaults = boardingVoiceCore || {};
        return {
            schema: RECIPE_SCHEMA,
            version: 1,
            kind: 'farewell',
            missionId: text(source.missionId, 180),
            enabled: source.enabled !== false && Boolean(prompt || directText || fallbackText),
            skipReason: source.enabled === false ? (text(source.skipReason, 120) || 'disabled') : null,
            cargoOnly: source.cargoOnly === true,
            audioEnabled: source.audioEnabled !== false,
            playCue: source.playCue !== false && cueId !== 'none',
            cue: {
                id: source.playCue !== false ? cueId : 'none',
                variantSeed: source.playCue !== false
                    ? (text(object(source.cue).variantSeed, 500) || farewellCueVariantSeed(cueId, source.missionAudioKey))
                    : '',
                gain: 0.38
            },
            prompt: prompt,
            text: directText,
            fallbackText: fallbackText,
            taskDomain: text(source.taskDomain || object(source.speaker).taskDomain, 120).toLowerCase(),
            speaker: normalizeSpeaker(source.speaker),
            textModels: {
                gemini: normalizeModelList(object(source.textModels).gemini, defaults.GEMINI_TEXT_MODELS, 8),
                openai: normalizeModelList(object(source.textModels).openai, defaults.OPENAI_TEXT_MODELS, 8)
            },
            ttsModels: normalizeModelList(source.ttsModels, defaults.GEMINI_TTS_MODELS, 4),
            ttsHedgeEnabled: source.ttsHedgeEnabled !== false,
            ttsHedgeDelayMs: Math.max(1000, Math.min(10000, Math.round(Number(source.ttsHedgeDelayMs) || 3000)))
        };
    }

    function normalizeRecipe(raw) {
        var source = object(raw);
        if (source.schema !== RECIPE_SCHEMA || Number(source.version) !== 1 || text(source.kind, 40).toLowerCase() !== 'farewell') return null;
        var normalized = createRecipe(source);
        normalized.enabled = source.enabled === true && Boolean(normalized.prompt || normalized.text || normalized.fallbackText);
        normalized.skipReason = normalized.enabled ? null : (text(source.skipReason, 120) || 'disabled');
        return normalized;
    }

    return Object.freeze({
        CONTEXT_SCHEMA: CONTEXT_SCHEMA,
        RECIPE_SCHEMA: RECIPE_SCHEMA,
        buildPreparedContext: buildPreparedContext,
        createContext: createContext,
        createRecipe: createRecipe,
        createRecipeFromContext: createRecipeFromContext,
        farewellCueVariantSeed: farewellCueVariantSeed,
        normalizeContext: normalizeContext,
        normalizeRecipe: normalizeRecipe,
        normalizeSpeaker: normalizeSpeaker,
        weatherContext: weatherContext
    });
}));
