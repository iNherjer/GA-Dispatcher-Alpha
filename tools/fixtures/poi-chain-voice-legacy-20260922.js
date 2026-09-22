// Frozen standalone HEAD 8edc1b654; do not regenerate.
function _hashStable(text) {
    const s = String(text || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return Math.abs(h >>> 0);
}

function _paxSeededInt(seed, min, max) {
    const lo = Math.round(Number(min) || 0);
    const hi = Math.round(Number(max) || lo);
    const a = Math.min(lo, hi);
    const b = Math.max(lo, hi);
    if (a === b) return a;
    return a + (_hashStable(seed) % (b - a + 1));
}

function _poiChainActiveSpec() {
    if (typeof window.missionPoiChainRuntime?.getActiveSpec !== 'function') return null;
    try {
        return window.missionPoiChainRuntime.getActiveSpec(
            (typeof currentMissionData !== 'undefined' ? currentMissionData : null),
            window.activePassenger || null
        );
    } catch (_) {
        return null;
    }
}

function _poiChainSnapshot() {
    if (typeof window.missionPoiChainRuntime?.snapshot !== 'function') return null;
    try {
        return window.missionPoiChainRuntime.snapshot();
    } catch (_) {
        return null;
    }
}

function _poiChainProgressSummary(ctx = null) {
    const spec = _poiChainActiveSpec();
    if (!spec) return '';
    const snap = _poiChainSnapshot();
    const points = Array.isArray(spec.points) ? spec.points : [];
    const total = points.filter(point => point?.required !== false).length || points.length || 1;
    const done = Array.isArray(snap?.completedPointIds) ? snap.completedPointIds.length : 0;
    const currentIndex = Math.max(0, Number(snap?.currentIndex || 0) || 0);
    const nextPoint = points[currentIndex] || null;
    const corridor = spec.corridor || null;
    const corridorSnap = snap?.corridor || null;
    const corridorTotal = Math.max(0, Number(corridorSnap?.totalSegments || corridor?.segments?.length || 0));
    const corridorDone = Math.max(0, Number(corridorSnap?.completedCount || 0));
    const activeCoverage = Math.round(Number(corridorSnap?.activeCoverage || 0) * 100);
    const parts = [];
    parts.push(`Kettenauftrag ${done}/${total} Punkte erledigt`);
    if (corridorTotal > 0) {
        parts.push(`Korridor ${corridorDone}/${corridorTotal} Segmente sauber${corridorSnap?.activeSegmentId ? `, aktueller Abschnitt ${activeCoverage}%` : ''}`);
    }
    if (snap?.satisfied) {
        parts.push('Status: Kette abgeschlossen, Rueckflug freigegeben');
    } else if (nextPoint) {
        parts.push(`Nächster Punkt: ${nextPoint.name}`);
        if (ctx?.hasPosition) {
            const dist = _haversineNm(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
            const brg = _bearingDeg(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
            parts.push(`Entfernung ${dist.toFixed(1)} NM, Steuerkurs ${String(Math.round(brg)).padStart(3, '0')} Grad`);
        }
    } else {
        parts.push('Status: naechster Kettenpunkt wird vorbereitet');
    }
    return parts.join(' | ');
}

function _poiChainStatusText(ctx = null) {
    const summary = _poiChainProgressSummary(ctx);
    if (!summary) return 'Ich habe gerade keine aktive POI-Kette geladen.';
    return summary.replace(/\s*\|\s*/g, '. ') + '.';
}

function _poiChainOrientationText(ctx = null) {
    const spec = _poiChainActiveSpec();
    if (!spec) return `${_missionVectorText(ctx)} Ich habe gerade keine aktive POI-Kette geladen.`;
    const snap = _poiChainSnapshot();
    const points = Array.isArray(spec.points) ? spec.points : [];
    const currentIndex = Math.max(0, Number(snap?.currentIndex || 0) || 0);
    const nextPoint = points[currentIndex] || null;
    const corridor = spec.corridor || null;
    const corridorSnap = snap?.corridor || null;
    const segments = Array.isArray(corridor?.segments) ? corridor.segments : [];
    const corridorDone = !!corridorSnap?.satisfied || !segments.length;
    if (!nextPoint && corridorDone) return 'Alle Kettenpunkte und Korridorsegmente sind erledigt. Der sinnvolle nächste Schritt ist der Rueckflug zur Basis.';
    if (!corridorDone) {
        const idx = Math.max(0, Math.min(segments.length - 1, Number(corridorSnap?.currentSegmentIndex || 0) || 0));
        const completed = Math.max(0, Number(corridorSnap?.completedCount || 0));
        const total = segments.length;
        const activeCoverage = Math.round(Number(corridorSnap?.activeCoverage || 0) * 100);
        return `${_missionVectorText(ctx)} Der Korridor ist in Segmente geteilt: ${completed} von ${total} sind sauber. Nimm jetzt Abschnitt ${idx + 1}, bleib im gelben Band und flieg ihn bis zum Ende${activeCoverage ? `; aktueller Abschnitt etwa ${activeCoverage}%` : ''}.`;
    }
    if (!nextPoint) return 'Der Korridor ist sauber abgeflogen, jetzt sind nur noch die offenen Fotopunkte relevant.';
    if (ctx?.hasPosition) {
        const dist = _haversineNm(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
        const brg = _bearingDeg(ctx.lat, ctx.lon, nextPoint.lat, nextPoint.lon);
        const clock = _relativeClockPos(brg, ctx.hdg || 0);
        return `Nächster Kettenpunkt ist ${nextPoint.name}. Steuerkurs ${String(Math.round(brg)).padStart(3, '0')} Grad, Entfernung ${dist.toFixed(1)} NM, etwa ${clock}. Der Triggerkreis ist auf der Karte markiert.`;
    }
    return `Nächster Kettenpunkt ist ${nextPoint.name}. Der aktuelle rote Triggerkreis ist auf der Karte markiert.`;
}

function _poiChainAudioKey(kind = 'event', text = '') {
    const suffix = text ? `-${_hashStable(text).toString(36).slice(0, 6)}` : '';
    return _paxMissionAudioKey(`poi-chain-${kind}${suffix}`);
}

function _poiChainPickText(pool = [], seed = '') {
    const options = (Array.isArray(pool) ? pool : []).map(v => String(v || '').trim()).filter(Boolean);
    if (!options.length) return '';
    return options[_hashStable(seed) % options.length] || options[0] || '';
}

function _poiChainPointLabel(point = null, fallback = 'dieser Punkt') {
    const name = String(point?.name || '').trim();
    if (!name) return fallback;
    return name.length > 46 ? `${name.slice(0, 43).trim()}...` : name;
}

function _poiChainPointFindingText(event = null, spec = null) {
    const point = event?.point || null;
    const tags = point?.tags || {};
    const hiddenOutcome = event?.hiddenOutcome && typeof event.hiddenOutcome === 'object' ? event.hiddenOutcome : null;
    const explicit = [
        hiddenOutcome?.paxFindingText,
        hiddenOutcome?.findingHint,
        tags.paxFindingText,
        tags.findingText,
        tags.findingHint,
        event?.findingText,
        event?.findingHint
    ].map(v => String(v || '').trim()).find(Boolean);
    if (explicit) return explicit;
    const marker = String(hiddenOutcome?.findingKind || tags.finding || tags.outcome || tags.followUp || tags.followUpType || event?.finding || '').trim().toLowerCase();
    if (!marker || /^(none|ok|clear|normal|unauffaellig|unauffällig|false|0)$/.test(marker)) return '';
    const pointName = _poiChainPointLabel(point, 'dieser Querung');
    return _poiChainPickText([
        `Bei ${pointName} nehme ich einen möglichen Anschlussbedarf mit. Die Fotos sollten später genauer ausgewertet werden, bevor daraus eine Einzelprüfung wird.`,
        `Hier notiere ich eine Auffälligkeit für die Nachsichtung. Wir dokumentieren den Punkt sauber und entscheiden erst nach der Bildauswertung über eine Folgemission.`,
        `Diesen Punkt markiere ich für die Auswertung. Aus der Luft reicht das für den Erstbefund, Details klären wir später gezielt am Einzelobjekt.`
    ], `${spec?.key || spec?.label || ''}|${point?.id || pointName}|finding|${marker}`);
}

function _poiChainVoiceText(kind = 'point_complete', spec = null, event = null) {
    const point = event?.point || null;
    const nextPoint = event?.nextPoint || null;
    const seed = `${spec?.key || spec?.label || ''}|${kind}|${point?.id || ''}|${nextPoint?.id || ''}`;
    switch (kind) {
        case 'chain_complete':
            return _poiChainPickText([
                'Kette abgeschlossen: Korridor sauber abgeflogen, Prüfpunkte dokumentiert. Wir gehen zur Auswertung zurück zum Heimatplatz.',
                'Auftrag erfüllt. Die Linie ist komplett abgeflogen und die Fotopunkte sind dokumentiert, jetzt bringen wir die Bilder zurück zur Basis.',
                'Das reicht für den Erstbefund: Korridor und Kontrollpunkte sind im Kasten. Rückflug zur Übergabe.',
                'Alles aufgenommen. Korridor und Kette sind vollständig dokumentiert, Rückflug zum Startplatz.'
            ], seed);
        case 'point_complete':
            return _poiChainPointFindingText(event, spec) || _poiChainPickText([
                'Gut, der Punkt ist im Kasten. Ich habe die Bilder; weiter zum nächsten markierten Punkt.',
                'Passt, diese Querung ist dokumentiert. Ich rufe gleich den nächsten Prüfpunkt auf.',
                'Fotos sind drauf. Für den Erstbefund reicht das hier; weiter zur nächsten Markierung.',
                'Sauber, der Abschnitt ist abgehakt. Nächster Punkt kommt jetzt auf die Karte.',
                'Der Kontrollpunkt ist erledigt. Ich notiere ihn als dokumentiert und nehme den nächsten Abschnitt auf.'
            ], seed);
        case 'chain_area_entered':
            return _poiChainPickText([
                'Wir sind am ersten Kettenpunkt. Bitte ruhig halten, ich starte die Bildserie.',
                'Erster Prüfpunkt erreicht. Ich beginne mit den Übersichtsaufnahmen und rufe danach den nächsten Punkt auf.',
                'Das ist der Einstieg in die Kette. Ein stabiler Vorbeiflug reicht für den ersten Befund.'
            ], seed);
        case 'chain_corridor_entered':
            return _poiChainPickText([
                'Wir sind am Einstieg in den Korridor. Halte die Maschine im gelben Band, dann zählt der erste Abschnitt.',
                'Korridor erreicht. Ab jetzt zählt nicht nur der Fotopunkt, sondern auch der saubere Verlauf im Band.',
                'Das ist der Beginn der Korridorarbeit. Ruhig im Streifen bleiben, ich bestätige die Abschnitte nacheinander.'
            ], seed);
        case 'corridor_segment_complete':
            return '';
        case 'corridor_segment_reset_offtrack':
            return _poiChainPickText([
                'Wir sind zu weit aus dem Korridor gelaufen. Setz diesen Abschnitt noch einmal sauber an.',
                'Der aktuelle Abschnitt zählt so nicht, wir waren zu lange neben dem Band. Bitte zurück in den Korridor und den Teil wiederholen.',
                'Korrektur: Der Korridor wurde verlassen. Diesen Abschnitt bitte noch einmal ruhig im Band abfliegen.'
            ], `${seed}|reset|${event?.segmentId || event?.segment?.id || ''}`);
        case 'corridor_segment_reset_speed':
            return _poiChainPickText([
                'Für den Korridor waren wir zu langsam oder instabil. Diesen Abschnitt bitte noch einmal sauber ansetzen.',
                'Der Abschnitt zählt nicht, die Geschwindigkeit war nicht stabil genug. Zurück ins Band und neu aufnehmen.'
            ], `${seed}|speed|${event?.segmentId || event?.segment?.id || ''}`);
        case 'chain_corridor_complete':
            return _poiChainPickText([
                'Korridor sauber abgeflogen. Jetzt fehlen nur noch offene Fotopunkte, falls noch welche markiert sind.',
                'Die Korridorlinie ist vollständig. Halte jetzt die restlichen Aufnahmepunkte im Blick.',
                'Korridorarbeit abgeschlossen. Die Linie ist sauber, wir konzentrieren uns auf die verbleibenden Punkte.'
            ], seed);
        default:
            return '';
    }
}

function _poiChainPhotoSoundOptions(kind = '', spec = null, event = null, text = '') {
    if (kind !== 'point_complete') return null;
    const cueId = _paxMissionAudioCueId('poi_chain', kind, 'photo');
    if (cueId === 'none') return null;
    const point = event?.point || {};
    const seed = `${spec?.key || spec?.label || ''}|${point?.id || point?.name || ''}|${text}`;
    if (cueId !== 'photo') {
        return {
            beforeAudio: (epoch) => _paxPlayAudioCue(cueId, `${seed}|pre`, {
                minCount: 1,
                maxCount: 1,
                firstDelayMs: 120,
                minDelayMs: 0,
                maxDelayMs: 0
            }, epoch)
        };
    }
    return {
        beforeAudio: (epoch) => _paxPlayPhotoBurst(`${seed}|pre`, {
            minCount: 1,
            maxCount: 5,
            firstDelayMs: _paxSeededInt(`${seed}|pre-first`, 200, 1000),
            minDelayMs: 200,
            maxDelayMs: 1000
        }, epoch),
        afterAudio: (epoch) => {
            const postCount = _paxSeededInt(`${seed}|post-count`, 0, 2);
            if (postCount <= 0) return false;
            return _paxPlayPhotoBurst(`${seed}|post`, {
                minCount: postCount,
                maxCount: postCount,
                firstDelayMs: _paxSeededInt(`${seed}|post-first`, 200, 1000),
                minDelayMs: 200,
                maxDelayMs: 1000
            }, epoch);
        }
    };
}

function _poiChainEventSoundOptions(kind = '', spec = null, event = null, text = '') {
    const fallbackByKind = {
        chain_corridor_entered: 'scan_start',
        chain_corridor_complete: 'handoff',
        chain_complete: 'handoff'
    };
    const fallbackCue = fallbackByKind[kind] || 'none';
    const cueId = _paxMissionAudioCueId('poi_chain', kind, fallbackCue);
    if (cueId === 'none') return null;
    const seed = `${spec?.key || spec?.label || ''}|${kind}|${event?.segmentId || event?.segment?.id || ''}|${text}`;
    return {
        beforeAudio: (epoch) => _paxPlayAudioCue(cueId, `${seed}|cue`, {
            minCount: 1,
            maxCount: 1,
            firstDelayMs: 0,
            minDelayMs: 0,
            maxDelayMs: 0
        }, epoch)
    };
}

function _poiChainEventKind(event = null) {
    const type = String(event?.type || '').toLowerCase();
    if (type === 'chain_complete') return 'chain_complete';
    if (type === 'point_complete') return 'point_complete';
    if (type === 'chain_area_entered') return 'chain_area_entered';
    if (type === 'chain_corridor_entered') return 'chain_corridor_entered';
    if (type === 'corridor_segment_complete') return 'corridor_segment_complete';
    if (type === 'corridor_segment_reset_offtrack') return 'corridor_segment_reset_offtrack';
    if (type === 'corridor_segment_reset_speed') return 'corridor_segment_reset_speed';
    if (type === 'chain_corridor_complete') return 'chain_corridor_complete';
    return '';
}

function _handlePoiChainEvents(events = [], spec = null) {
    if (!Array.isArray(events) || !events.length) return;
    const meaningful = events
        .map(event => ({ event, kind: _poiChainEventKind(event) }))
        .filter(item => item.kind);
    if (!meaningful.length) return;
    const pickedEvents = [];
    const resetEvent = meaningful.find(item => /^corridor_segment_reset/.test(item.kind));
    const pointEvent = meaningful.find(item => item.kind === 'point_complete');
    const areaEvent = meaningful.find(item => item.kind === 'chain_area_entered' || item.kind === 'chain_corridor_entered');
    const silentSegmentEvent = meaningful.find(item => item.kind === 'corridor_segment_complete');
    const corridorEvent = meaningful.find(item => item.kind === 'chain_corridor_complete');
    const chainEvent = meaningful.find(item => item.kind === 'chain_complete');
    if (silentSegmentEvent && !corridorEvent && !chainEvent && typeof window.missionPersistRuntimeSnapshot === 'function') {
        window.missionPersistRuntimeSnapshot('poi-chain-corridor_segment_complete');
    }
    if (resetEvent) pickedEvents.push(resetEvent);
    else if (pointEvent) pickedEvents.push(pointEvent);
    else if (areaEvent) pickedEvents.push(areaEvent);
    else if (meaningful[0]?.kind !== 'corridor_segment_complete') pickedEvents.push(meaningful[0]);
    if (corridorEvent && !pickedEvents.includes(corridorEvent) && !chainEvent) pickedEvents.push(corridorEvent);
    if (chainEvent && !pickedEvents.includes(chainEvent)) pickedEvents.push(chainEvent);
    const speaker = _speakerSnapshotForMissionVoice('poi-chain');
    for (const picked of pickedEvents) {
        const kind = picked.kind;
        const event = picked.event || null;
        _paxLog(`POI-Chain Event: ${kind}`, 'event');
        if (typeof window.missionPersistRuntimeSnapshot === 'function') {
            window.missionPersistRuntimeSnapshot(`poi-chain-${kind}`, { immediate: kind === 'chain_complete' });
        }
        const text = _poiChainVoiceText(kind, spec, event);
        if (!text) continue;
        const label = kind === 'chain_complete'
            ? 'Kette erfüllt'
            : (kind.includes('reset') ? 'Korridor-Korrektur' : 'Ketten-Fortschritt');
        const eventOptions = _poiChainPhotoSoundOptions(kind, spec, event, text)
            || _poiChainEventSoundOptions(kind, spec, event, text)
            || {};
        _speakPreparedText(_poiChainAudioKey(kind, text), text, speaker, label, eventOptions);
    }
}

async function _paxPlayAudioCue(cueId = 'none', seed = '', options = {}, epoch = _paxMissionEpoch) {
    const def = _paxAudioCueDef(cueId);
    if (!def || def.disabled || !_paxAudioEffectsEnabled || !_paxEpochCurrent(epoch)) return false;
    const clips = await _paxResolveAudioCueClips(def.id);
    if (!_paxAudioEffectsEnabled || !_paxEpochCurrent(epoch)) return false;
    const cueSeed = `${seed || _paxMissionAudioKey(`cue-${def.id}`)}|${def.id}`;
    const variantScope = String(options.variantScope || def.variantScope || 'mission').toLowerCase();
    const variantSeed = variantScope === 'event'
        ? String(options.variantSeed || cueSeed)
        : String(options.variantSeed || '');
    const clip = _paxPickAudioCueClip(def.id, clips, variantSeed);
    if (!clip?.rec?.audioBuffer) return false;
    const minCount = Math.max(1, Number(options.minCount || 1));
    const maxCount = Math.max(minCount, Number(options.maxCount || minCount));
    const count = _paxSeededInt(`${cueSeed}|count`, minCount, maxCount);
    const minDelay = Math.max(0, Number(options.minDelayMs ?? 0));
    const maxDelay = Math.max(minDelay, Number(options.maxDelayMs ?? minDelay));
    const gain = Number.isFinite(Number(options.gain)) ? Number(options.gain) : Number(def.gain || 0.78);
    let played = false;
    for (let idx = 0; idx < count; idx++) {
        const delay = idx === 0
            ? Math.max(0, Number(options.firstDelayMs ?? minDelay))
            : _paxSeededInt(`${cueSeed}|delay|${idx}`, minDelay, maxDelay);
        if (delay > 0) {
            const ok = await _paxDelayMs(delay, epoch);
            if (!ok) return played;
        }
        if (!_paxAudioEffectsEnabled || !_paxEpochCurrent(epoch)) return played;
        const didPlay = await _paxDecodeAudioEffectAndPlay(
            clip.rec.audioBuffer.slice(0),
            clip.rec.mimeType || 'audio/mpeg',
            epoch,
            def.sourceLabel || `Audio-Cue ${def.id}`,
            { gain }
        );
        played = played || didPlay;
    }
    if (played) _paxLog(`Audio-Cue gespielt: ${def.id} (${clip.url}, ${count}x)`, 'audio');
    return played;
}