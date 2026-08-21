(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionBoardingVoiceCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var RECIPE_SCHEMA = 'ga.mission-boarding-voice-recipe.v1';
    var TRAINING_DOMAINS = /^(training|club_training_basic|club_training_advanced)$/;
    var GEMINI_TEXT_MODELS = Object.freeze([
        'gemini-3-flash-preview',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite'
    ]);
    var OPENAI_TEXT_MODELS = Object.freeze(['gpt-5.4', 'gpt-5.4-mini']);
    var GEMINI_TTS_MODELS = Object.freeze([
        'gemini-3.1-flash-tts-preview',
        'gemini-2.5-flash-preview-tts'
    ]);
    var GEMINI_VOICES = Object.freeze({
        male: Object.freeze(['Charon', 'Puck']),
        female: Object.freeze(['Kore', 'Leda', 'Aoede'])
    });
    var OPENAI_VOICES = Object.freeze({
        male: Object.freeze(['onyx', 'echo', 'ash']),
        female: Object.freeze(['nova', 'shimmer', 'coral'])
    });

    function object(value) {
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function text(value, maxLength) {
        var limit = Math.max(1, Number(maxLength) || 4000);
        return String(value == null ? '' : value).trim().slice(0, limit);
    }

    function normalizeGender(value) {
        return /^(male|m|mann|maennlich|männlich)$/i.test(String(value || '').trim()) ? 'male' : 'female';
    }

    function normalizeSpeaker(raw) {
        var source = object(raw);
        return {
            name: text(source.name, 120),
            role: text(source.role, 160),
            gender: normalizeGender(source.gender),
            roleProfile: text(source.roleProfile, 120),
            taskDomain: text(source.taskDomain, 120).toLowerCase()
        };
    }

    function normalizeCueId(value) {
        var raw = text(value, 80).toLowerCase();
        if (!raw || /^(?:none|off|silent|0)$/.test(raw)) return 'none';
        var normalized = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        return normalized || 'none';
    }

    function stableHash(value) {
        var source = String(value || '');
        var hash = 2166136261;
        for (var index = 0; index < source.length; index += 1) {
            hash ^= source.charCodeAt(index);
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        return hash >>> 0;
    }

    function boardingCueVariantSeed(cueId, missionAudioKey) {
        var id = normalizeCueId(cueId);
        if (id === 'none') return '';
        var rawKey = text(missionAudioKey, 220);
        var separator = rawKey.indexOf(':');
        var missionKey = separator >= 0 ? rawKey.slice(separator + 1) : rawKey;
        missionKey = missionKey || 'active';
        return 'cue-variant-' + id + ':' + missionKey
            + '|boarding:' + missionKey + '|boarding-cue|' + id;
    }

    function audioCueCandidateNames(cueId, variantMax) {
        var id = normalizeCueId(cueId);
        if (id === 'none') return [];
        var max = Math.max(0, Math.min(8, Math.round(Number(variantMax) || 8)));
        var stems = [id.replace(/_/g, '-'), id].filter(function (stem, index, values) {
            return stem && values.indexOf(stem) === index;
        });
        var names = [];
        stems.forEach(function (stem) {
            names.push(stem + '.mp3');
            for (var index = 1; index <= max; index += 1) names.push(stem + index + '.mp3');
        });
        return names;
    }

    function selectAudioCueAsset(cue, availableNames) {
        var source = object(cue);
        var id = normalizeCueId(source.id);
        var available = new Set((Array.isArray(availableNames) ? availableNames : []).map(function (name) {
            return text(name, 160);
        }).filter(Boolean));
        var candidates = audioCueCandidateNames(id, 8).filter(function (name) { return available.has(name); });
        if (!candidates.length) return null;
        var variantSeed = text(source.variantSeed, 500);
        return candidates[stableHash(variantSeed) % candidates.length] || candidates[0] || null;
    }

    function rotateVoices(pool, speaker) {
        var source = Array.isArray(pool) ? pool.slice() : [];
        if (!source.length) return [];
        var seed = [speaker.name, speaker.role, speaker.roleProfile, speaker.taskDomain].join('|');
        var start = stableHash(seed) % source.length;
        return source.map(function (_, index) { return source[(start + index) % source.length]; });
    }

    function voiceCandidates(provider, rawSpeaker, explicitVoiceName) {
        var normalizedProvider = String(provider || '').trim().toLowerCase() === 'openai' ? 'openai' : 'gemini';
        var speaker = normalizeSpeaker(rawSpeaker);
        var pool = normalizedProvider === 'openai' ? OPENAI_VOICES[speaker.gender] : GEMINI_VOICES[speaker.gender];
        var candidates = rotateVoices(pool, speaker);
        var explicit = text(explicitVoiceName, 80);
        if (explicit) candidates.unshift(explicit);
        return candidates.filter(function (voice, index, list) {
            return voice && list.indexOf(voice) === index;
        });
    }

    function normalizeSpokenText(value) {
        if (!value) return '';
        return String(value)
            .replace(/[–—]+/g, ', ')
            .replace(/\s*;\s*/g, ', ')
            .replace(/\.{3,}/g, '. ')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([,.!?])/g, '$1')
            .trim();
    }

    function finalizeBoardingText(raw) {
        var source = object(raw);
        var generated = normalizeSpokenText(source.generatedText);
        var fallback = text(source.fallbackText, 4000);
        var taskDomain = text(source.taskDomain, 120).toLowerCase();
        if (!TRAINING_DOMAINS.test(taskDomain)) return generated || fallback;
        if (!generated) return fallback;
        var looksMetaAck = /^(verstanden|okay|alles klar|klar)[\s,.!]/i.test(generated)
            && /(ich\s+(?:bleibe|werde|halte|liefere|formuliere|achte)|keine\s+markdown|nur\s+die\s+naechsten|nur\s+die\s+nächsten|sinnvollen\s+hinweise)/i.test(generated);
        var hasTrainingCue = /(uebung|übung|training|trainingshoehe|trainingshöhe|bereitschaft|bereit-button|vollkreis|stall)/i.test(generated);
        var hasBriefingListLeak = /(pflichtprogramm|pflichtteil|pflichtuebung|pflichtübung|pflicht\s+heute|optional\s*(?:danach|:)|voller\s+plan)/i.test(generated);
        return !looksMetaAck && hasTrainingCue && !hasBriefingListLeak ? generated : (fallback || generated);
    }

    function stripManifestWeightForSpeech(value) {
        return String(value || '')
            .replace(/\s*\((?:ca\.\s*)?\d+(?:[.,]\d+)?\s*(?:lb|lbs|pound|pounds|pfund|kg|kilogramm|kilograms?)\)\s*/ig, ' ')
            .replace(/\b(?:ca\.\s*)?\d+(?:[.,]\d+)?\s*(?:lb|lbs|pound|pounds|pfund|kg|kilogramm|kilograms?)\b/ig, '')
            .replace(/\s+/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .replace(/\s*(?:und|,)\s*$/i, '')
            .trim();
    }

    function joinSpeechItems(items) {
        var clean = (Array.isArray(items) ? items : []).map(function (item) {
            return String(item || '').replace(/\s+/g, ' ').trim();
        }).filter(Boolean);
        if (!clean.length) return '';
        if (clean.length === 1) return clean[0];
        if (clean.length === 2) return clean[0] + ' und ' + clean[1];
        return clean.slice(0, -1).join(', ') + ' und ' + clean[clean.length - 1];
    }

    function buildBoardingText(raw) {
        var source = object(raw);
        var requiredItems = (Array.isArray(source.requiredItems) ? source.requiredItems : [])
            .map(function (item) { return text(item, 240); })
            .filter(Boolean)
            .slice(0, 4);
        if (source.cargoOnly === true) {
            var cargoName = requiredItems.length ? requiredItems.join(', ') : text(source.cargoText, 600);
            return 'Moin. Wir laden heute ' + cargoName + ' fuer ' + text(source.destination, 180)
                + '. Bitte sauber sichern und am Ziel erst nach vollem Stillstand zur Uebergabe freigeben.';
        }
        var speaker = normalizeSpeaker(source.speaker);
        var taskDomain = text(source.taskDomain || speaker.taskDomain, 120).toLowerCase();
        var trainingSchedule = text(source.trainingSchedule, 1600);
        if (trainingSchedule && TRAINING_DOMAINS.test(taskDomain)) {
            var trainingRole = speaker.role ? ', ' + speaker.role : '';
            return 'Hallo, ich bin ' + (speaker.name || 'dein Instruktor') + trainingRole + '. '
                + trainingSchedule + ' Wenn die beiden Uebungen sauber abgeschlossen sind, gebe ich dich fuer die Rueckkehr frei.';
        }
        var paxText = text(source.paxText, 400);
        var paxMatch = paxText.match(/^\s*(\d+)\s*PAX\b/i);
        var paxCount = paxMatch ? Math.max(0, parseInt(paxMatch[1], 10) || 0) : (source.hasPaxMission === true ? 1 : 0);
        var cargoText = text(source.cargoText, 600);
        var cargoClean = cargoText && !/^[-–—]$/.test(cargoText)
            ? (stripManifestWeightForSpeech(cargoText) || cargoText)
            : 'kein zusaetzliches Gepaeck';
        var role = speaker.role ? ' als ' + speaker.role : '';
        var targetPickup = source.targetPickupMission === true;
        var hasOutboundPassenger = paxCount > 0;
        var paxPart = paxCount > 1
            ? 'wir sind ' + paxCount + ' Personen'
            : (hasOutboundPassenger
                ? (speaker.name ? 'ich bin ' + speaker.name : 'ich bin heute mit an Bord') + role
                : (targetPickup ? 'heute geht es zunaechst leer raus' : 'heute geht es ohne Passagier los'));
        var requiredShort = requiredItems.map(stripManifestWeightForSpeech).filter(Boolean);
        var equipment = joinSpeechItems(requiredShort) || cargoClean;
        if (/^kein(?:e|en)?\s+/i.test(equipment)) equipment = '';
        var equipmentText = equipment ? ' ' + equipment + ' ist dabei und liegt bereit.' : '';
        var target = text(source.targetName, 180);
        var targetText = target ? ' nach ' + target : '';
        var variants = [
            'Hi, ' + paxPart + '.' + equipmentText + ' Von mir aus sind wir bereit für den Flug' + targetText + '.',
            'Hallo, ' + paxPart + '.' + equipmentText + ' Gib mir kurz Bescheid, worauf ich beim Start achten soll.',
            'Moin, ' + paxPart + '.' + equipmentText + ' Ich bin soweit, wir können den Auftrag' + targetText + ' angehen.'
        ];
        return variants[stableHash(text(source.missionSeed, 240) + '|boarding') % variants.length];
    }

    function suppressesOutboundPickupBoarding(contract) {
        var bush = object(object(contract).bush);
        var pickupKind = text(bush.pickupKind, 40).toLowerCase();
        return text(bush.targetMode, 60).toLowerCase() === 'strip_then_return'
            && (pickupKind === 'passenger' || pickupKind === 'cargo');
    }

    function derivePreparationPolicy(raw) {
        var source = object(raw);
        if (suppressesOutboundPickupBoarding(source.contract)) {
            return { prepare: false, reason: 'outbound_pickup_boarding_suppressed' };
        }
        if (source.hasPassenger !== true && source.hasPaxMission !== true && source.hasCargoContext !== true) {
            return { prepare: false, reason: 'boarding_voice_context_missing' };
        }
        return { prepare: true, reason: null };
    }

    function normalizeModelList(value, fallback, maxEntries) {
        var list = Array.isArray(value) ? value : fallback;
        return list.map(function (entry) {
            return text(Array.isArray(entry) ? entry[0] : entry, 100);
        }).filter(function (entry, index, values) {
            return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(entry) && values.indexOf(entry) === index;
        }).slice(0, Math.max(1, Number(maxEntries) || 6));
    }

    function createRecipe(raw) {
        var source = object(raw);
        var policy = derivePreparationPolicy(source);
        var taskDomain = text(source.taskDomain || object(source.speaker).taskDomain, 120).toLowerCase();
        var fallbackText = text(source.fallbackText, 4000);
        var prompt = text(source.prompt, 24000);
        var cueId = source.playCue === false ? 'none' : normalizeCueId(object(source.cue).id || source.cueId || 'boarding_pax');
        var cueVariantSeed = text(object(source.cue).variantSeed, 500)
            || boardingCueVariantSeed(cueId, source.missionAudioKey);
        return {
            schema: RECIPE_SCHEMA,
            version: 1,
            kind: 'boarding',
            missionId: text(source.missionId, 180),
            enabled: policy.prepare && Boolean(prompt || fallbackText),
            skipReason: policy.prepare ? null : policy.reason,
            audioEnabled: source.audioEnabled !== false,
            playCue: source.playCue !== false && cueId !== 'none',
            cue: {
                id: source.playCue !== false ? cueId : 'none',
                variantSeed: source.playCue !== false ? cueVariantSeed : '',
                gain: 0.38
            },
            prompt: prompt,
            fallbackText: fallbackText,
            taskDomain: taskDomain,
            speaker: normalizeSpeaker(source.speaker),
            textModels: {
                gemini: normalizeModelList(object(source.textModels).gemini, GEMINI_TEXT_MODELS, 8),
                openai: normalizeModelList(object(source.textModels).openai, OPENAI_TEXT_MODELS, 8)
            },
            ttsModels: normalizeModelList(source.ttsModels, GEMINI_TTS_MODELS, 4),
            ttsHedgeEnabled: source.ttsHedgeEnabled !== false,
            ttsHedgeDelayMs: Math.max(1000, Math.min(10000, Math.round(Number(source.ttsHedgeDelayMs) || 3000)))
        };
    }

    function normalizeRecipe(raw) {
        var source = object(raw);
        if (source.schema !== RECIPE_SCHEMA || Number(source.version) !== 1 || text(source.kind, 40).toLowerCase() !== 'boarding') return null;
        var normalized = createRecipe({
            missionId: source.missionId,
            hasPassenger: true,
            audioEnabled: source.audioEnabled,
            playCue: source.playCue,
            cue: source.cue,
            prompt: source.prompt,
            fallbackText: source.fallbackText,
            taskDomain: source.taskDomain,
            speaker: source.speaker,
            textModels: source.textModels,
            ttsModels: source.ttsModels,
            ttsHedgeEnabled: source.ttsHedgeEnabled,
            ttsHedgeDelayMs: source.ttsHedgeDelayMs
        });
        normalized.enabled = source.enabled === true && Boolean(normalized.prompt || normalized.fallbackText);
        normalized.skipReason = normalized.enabled ? null : (text(source.skipReason, 120) || 'disabled');
        return normalized;
    }

    return Object.freeze({
        GEMINI_TEXT_MODELS: GEMINI_TEXT_MODELS,
        GEMINI_TTS_MODELS: GEMINI_TTS_MODELS,
        OPENAI_TEXT_MODELS: OPENAI_TEXT_MODELS,
        RECIPE_SCHEMA: RECIPE_SCHEMA,
        buildBoardingText: buildBoardingText,
        audioCueCandidateNames: audioCueCandidateNames,
        boardingCueVariantSeed: boardingCueVariantSeed,
        createRecipe: createRecipe,
        derivePreparationPolicy: derivePreparationPolicy,
        finalizeBoardingText: finalizeBoardingText,
        normalizeGender: normalizeGender,
        normalizeCueId: normalizeCueId,
        normalizeRecipe: normalizeRecipe,
        normalizeSpeaker: normalizeSpeaker,
        normalizeSpokenText: normalizeSpokenText,
        stableHash: stableHash,
        selectAudioCueAsset: selectAudioCueAsset,
        suppressesOutboundPickupBoarding: suppressesOutboundPickupBoarding,
        voiceCandidates: voiceCandidates
    });
}));
