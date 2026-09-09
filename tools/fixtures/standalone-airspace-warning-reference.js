// Frozen standalone v397 detector for differential migration tests.
function checkAirspaceWarnings(predPoints) {
    if (!_awmAirspaceWarn) {
        const banner = document.getElementById('awmFreqBanner');
        if (banner) {
            banner.querySelectorAll('[data-askey]').forEach(entry => entry.remove());
            banner.style.display = Array.from(banner.children).some(child => child.hidden !== true) ? 'block' : 'none';
        }
        return;
    }
    if (!_awLoaded) { _awLoadClips(); return; }
    if (!_tawsAudioCtx) return;
    if (typeof activeAirspaces === 'undefined' || !activeAirspaces.length) return;
    if (typeof getAirspaceVerticalBandFt === 'undefined' || typeof isPointInsideAirspace === 'undefined') return;

    const now = Date.now();
    const PERSIST = 5000;
    const STICKY  = 3000;
    const lastTerrainFt = Number(window.lastLiveTerrainFt) || 0;
    const getTerrainForPoint = (pt) => Number(pt?.terrainFt ?? lastTerrainFt) || 0;

    // ── Pass 1: Schnittstellen für alle Lufträume berechnen ───────────────────
    const crossings = [];
    for (const as of activeAirspaces) {
        if (!as.geometry) continue;
        if (as.type === 33) continue;

        const typeKey = _awTypeKey(as) || 'aw-ctr';
        const bandBase = getAirspaceVerticalBandFt(as, 0);
        if (!bandBase) continue;
        const lowerFt = bandBase.baseLowerFt;
        const upperFt = bandBase.baseUpperFt;
        const lowerIsAgl = bandBase.isLowerAgl;
        const upperIsAgl = bandBase.isUpperAgl;

        let earliest5 = null, earliest2 = null, insideNow = false;

        // insideNow: Flugzeug befindet sich JETZT in diesem Luftraum (GPS-Position, nicht Prediction)
        // Nur so wird sichergestellt, dass der zweite Luftraum erst angesagt wird wenn der erste
        // tatsächlich durchflogen wird — nicht schon 1 Minute vorher.
        const _gps = window.lastLiveGpsPos;
        if (_gps && _gps.alt !== undefined && _gps.lat !== undefined) {
            const bandNow = getAirspaceVerticalBandFt(as, getTerrainForPoint(_gps));
            if (!bandNow) continue;
            const _gAlt = _gps.alt; // bereits in Feet (sync.js)
            if (_gAlt >= bandNow.lowerFt - 200 && _gAlt <= bandNow.upperFt + 200) {
                if (isPointInsideAirspace(as, _gps.lat, _gps.lon)) insideNow = true;
            }
        }

        for (const pt of predPoints) {
            const bandPt = getAirspaceVerticalBandFt(as, getTerrainForPoint(pt));
            if (!bandPt) continue;
            if (pt.alt < bandPt.lowerFt - 500 || pt.alt > bandPt.upperFt + 300) continue;
            if (!isPointInsideAirspace(as, pt.lat, pt.lon)) continue;
            if (pt.min <= 5 && (earliest5 === null || pt.min < earliest5)) earliest5 = pt.min;
            if (pt.min <= 2 && (earliest2 === null || pt.min < earliest2)) earliest2 = pt.min;
        }

        if (earliest5 === null && earliest2 === null && !insideNow) continue;

        const asKey = `${as.type}_${as.name || 'x'}_${Math.round(lowerFt)}`;
        crossings.push({ as, typeKey, lowerFt, upperFt, lowerIsAgl, upperIsAgl, earliest5, earliest2, insideNow, asKey });
    }

    // ── Pass 2: Nächsten noch nicht eingetretenen Luftraum bestimmen ──────────
    // Lufträume in denen man schon drin ist dürfen weiterhin passieren.
    // Von den noch nicht eingetretenen: nur den nächsten warnen (blockiert weiter entfernte).
    const unentered = crossings
        .filter(c => !c.insideNow)
        .sort((a, b) => Math.min(a.earliest5 ?? 99, a.earliest2 ?? 99)
                      - Math.min(b.earliest5 ?? 99, b.earliest2 ?? 99));
    const nearestKey = unentered.length > 0 ? unentered[0].asKey : null;

    // Gleiche-Klasse Ketten-Update:
    // • Alle aktuell sichtbaren typeKeys als aktiv markieren
    // • Falls das Flugzeug gerade in einer ANDEREN Klasse ist → Kette der restlichen Klassen brechen
    const insideTypeKeys = new Set(crossings.filter(c => c.insideNow && c.typeKey).map(c => c.typeKey));
    for (const c of crossings) {
        if (!c.typeKey) continue;
        if (!_awTypeChain.has(c.typeKey)) _awTypeChain.set(c.typeKey, { lastActiveMs: 0, warnedAt: 0 });
        _awTypeChain.get(c.typeKey).lastActiveMs = now;
    }
    // Wenn drin in einer Klasse, breche Ketten aller anderen (bereits-gewarnte) Klassen
    if (insideTypeKeys.size > 0) {
        for (const [tk, ch] of _awTypeChain) {
            if (!insideTypeKeys.has(tk) && ch.warnedAt > 0) {
                ch.warnedAt = 0; // Kette unterbrochen durch andere Klasse
            }
        }
    }

    // ── Pass 3: Warnungen ausspielen ──────────────────────────────────────────
    for (const c of crossings) {
        const { as, typeKey, earliest5, earliest2, insideNow, asKey } = c;
        const in5 = earliest5 !== null;
        const in2 = earliest2 !== null;

        // Gleiche-Klasse Ketten-Unterdrückung:
        // Wenn wir bereits für diesen typeKey gewarnt haben UND die Kette noch aktiv ist
        // (kein langer Gap ohne Luftraum dieser Klasse), die Warnung unterdrücken.
        let chainSuppressed = false;
        if (!insideNow && typeKey) {
            const ch = _awTypeChain.get(typeKey);
            if (ch && ch.warnedAt > 0 && (now - ch.lastActiveMs) < _AW_CHAIN_GAP) {
                chainSuppressed = true;
            }
        }

        // Nur warnen wenn: bereits drin ODER nächster uneingetretener Luftraum UND nicht Ketten-unterdrückt
        const allowed = (insideNow || asKey === nearestKey) && !chainSuppressed;

        if (!_awState.has(asKey))
            _awState.set(asKey, { t5: false, t2: false, firstSeen5: 0, firstSeen2: 0, lastSeen5: 0, lastSeen2: 0 });
        const st = _awState.get(asKey);

        if (!allowed) {
            // Timer zurücksetzen damit Warnung feuert sobald Luftraum als nächstes drankommt
            if (st.lastSeen5 && (now - st.lastSeen5) > STICKY) { st.t5 = false; st.firstSeen5 = 0; st.lastSeen5 = 0; }
            if (st.lastSeen2 && (now - st.lastSeen2) > STICKY) { st.t2 = false; st.firstSeen2 = 0; st.lastSeen2 = 0; }
            continue;
        }

        // 2-min Warnung
        if (in2) {
            st.lastSeen2 = now;
            if (!st.firstSeen2) st.firstSeen2 = now;
            if (!st.t2 && (now - st.firstSeen2) >= PERSIST) {
                st.t2 = true;
                const col = (typeof getAirspaceStyle === 'function') ? getAirspaceStyle(as).color : '#ffffff';
                _awPulseOnMap(as, col);
                _awPulseOnProfileBand(as);
                window.vpBgNeedsUpdate = true;
                console.log(`[AWM] ✈ ${as.name} (${typeKey}) in ${Math.round(earliest2)} min`);
                _awPlaySequence(['aw-achtung', ..._awTypeClips(as), 'aw-in', _awMinKey(Math.round(earliest2)) || 'aw-2min', ..._awGetFreqClips(as)]);
                _awShowFreqBanner(as, col);
                // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
                if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
        } else if (st.lastSeen2 && (now - st.lastSeen2) > STICKY) {
            st.t2 = false; st.firstSeen2 = 0; st.lastSeen2 = 0;
        }

        // 5-min Warnung (nur wenn kein 2-min Schnitt aktiv)
        if (in5 && !in2) {
            st.lastSeen5 = now;
            if (!st.firstSeen5) st.firstSeen5 = now;
            if (!st.t5 && (now - st.firstSeen5) >= PERSIST) {
                st.t5 = true;
                const col = (typeof getAirspaceStyle === 'function') ? getAirspaceStyle(as).color : '#ffffff';
                _awPulseOnMap(as, col);
                _awPulseOnProfileBand(as);
                window.vpBgNeedsUpdate = true;
                console.log(`[AWM] ✈ ${as.name} (${typeKey}) in ${Math.round(earliest5)} min`);
                _awPlaySequence(['aw-achtung', ..._awTypeClips(as), 'aw-in', _awMinKey(Math.round(earliest5)) || 'aw-5min', ..._awGetFreqClips(as)]);
                _awShowFreqBanner(as, col);
                // Kette starten: gleiche Klasse dahinter nicht nochmals ansagen
                if (typeKey && _awTypeChain.has(typeKey)) _awTypeChain.get(typeKey).warnedAt = now;
            }
        } else if (!in2 && st.lastSeen5 && (now - st.lastSeen5) > STICKY) {
            st.t5 = false; st.firstSeen5 = 0; st.lastSeen5 = 0;
        }
    }
}
