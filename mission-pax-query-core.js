// Generated from original passenger-voice.js manual queries; do not edit.
'use strict';
const comfortCore=require('./mission-comfort-core.js');
const weatherCore=require('./mission-farewell-voice-core.js');
function _precipitationObservation(fd) {
    fd = fd && typeof fd === 'object' ? fd : {};
    // AMBIENT PRECIP STATE: 2 = none, 4 = rain, 8 = snow. RATE has no documented hourly timebase.
    const state = fd.precipState;
    const valid = typeof state === 'number' && Number.isSafeInteger(state) && state > 0
        && (state & ~14) === 0 && !((state & 2) && (state & 12));
    const active = valid ? Boolean(state & 12)
        : (state == null && typeof fd.precipActive === 'boolean' ? fd.precipActive : null);
    const label = valid ? (state === 2 ? 'kein Niederschlag' : state === 4 ? 'Regen'
        : state === 8 ? 'Schnee' : 'Regen und Schnee') : (active === true ? 'Niederschlag' : active === false ? 'kein Niederschlag' : null);
    return {
        precipState: valid ? state : null,
        precipActive: active,
        precipLabel: label,
        precipRateRaw: typeof fd.precipRateRaw === 'number' && Number.isFinite(fd.precipRateRaw) && fd.precipRateRaw >= 0 ? fd.precipRateRaw : null,
        precipRateUnit: 'millimeters of water; timebase unknown',
        precipRateMmH: null
    };
}
function _missionWeatherReactionLine(flightData = null) {
    const fd = flightData || window.lastLiveFlightData || {};
    const parts = [];
    const wind = Number(fd.windKts || 0);
    const gust = Number(fd.windGustKts || 0);
    const spread = (Number.isFinite(gust) && Number.isFinite(wind)) ? Math.max(0, gust - wind) : 0;
    const turb = Number(fd.turbulencePct || 0);
    const precip = _precipitationObservation(fd);
    if (wind >= 24) parts.push(`Wind ${Math.round(wind)} kt`);
    if (spread >= 16) parts.push(`Boeen plus ${Math.round(spread)} kt`);
    if (turb >= 55) parts.push(`Turbulenz ${Math.round(turb)} Prozent`);
    if (precip.precipActive === true) parts.push(precip.precipLabel);
    if (fd.inCloud === true) parts.push('in Wolken');
    return parts.join(', ');
}
function _cargoConditionLines(items) {
    return (Array.isArray(items) ? items : [])
        .filter(item => item && String(item.itemType || '').toLowerCase() !== 'passenger'
            && item.persistentEquipment !== true
            && ['loaded', 'unloaded', 'dropped', 'lost'].includes(String(item.status || '').toLowerCase()))
        .map(item => {
            const status = String(item.status || '').toLowerCase();
            const health = Number(item.healthPct ?? 100);
            const condition = status === 'dropped' || status === 'lost'
                ? 'nicht mehr an Bord'
                : (!Number.isFinite(health) || health >= 95 ? 'unversehrt'
                    : (health >= 75 ? 'leichte Gebrauchsspuren'
                        : (health > 35 ? 'sichtbar beschaedigt' : 'schwer beschaedigt')));
            return {
                name: String(item.storyName || item.label || item.id || 'Gegenstand').trim(),
                condition,
                required: item.required === true,
                damaged: condition !== 'unversehrt' && condition !== 'leichte Gebrauchsspuren'
            };
        });
}
function available(context={},fd={}) {
 const focus=comfortCore.evaluate(null,null,context).cargoFocus;
 // Weather is always answerable (calm weather may simply be praised); the
 // availability depends on mission facts only, never on a telemetry sample.
 return [...(!context.isPoi && context.hasPassenger ? ['pax_wellbeing']:[]),
 ...(!context.isPoi && (focus || String(context.cargoText||'').trim()) ? ['pax_cargo']:[]),
 ...(context.hasPassenger||focus ? ['pax_weather']:[])];
}
function render(action,context={},facts={}) {
 if(!available(context,facts.flightData||{}).includes(action)) return null;
 const _missionActionContext=()=>({fd:facts.flightData||{}});
 const _missionComfortSummary=()=>comfortCore.evaluate(facts.comfortState,null,context).summary;
 const _baseContext=()=>context.baseContext||'';
 const _toneHint=()=>context.toneHint||'';
 const _weatherContext=weatherCore.weatherContext;
 const _activeCargoText=()=>context.cargoText||'';
 const _isPOIMission=()=>context.isPoi===true;
 const _aptMissingRequiredCargoItems=()=>facts.missingRequired||[];
 const _aptManifestItems=()=>facts.manifestItems||[];
 const _activeMissionData=()=>context.missionData||{};
 let result=null;
 const _missionActionSpeak=(prompt,label,fallbackText)=>{result={kind:'pax_query',action,prompt,label,fallbackText,delayMs:0};};
 function paxAptWellbeingReport() {
    const ctx = _missionActionContext();
    const summary = _missionComfortSummary();
    const base = _baseContext();
    const wx = _missionWeatherReactionLine(ctx.fd);
    const facts = `Stimmung ${summary.mood}; Pilot-Events ${summary.pilotEvents}, davon schwer ${summary.pilotSevere}; Wetter-Events ${summary.weatherEvents}, davon schwer ${summary.weatherSevere}; max G ${summary.maxG}, max Bank ${summary.maxBankDeg} Grad, max Sinken ${summary.maxDescentFpm} ft/min, Wetter: ${wx || 'unauffaellig'}.`;
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt, wie es dir geht.
Auswertung seit Missionsstart (nur zur Einordnung): ${facts}
Beschreibe dein koerperliches Befinden in Worten, vor allem Magen, Gleichgewicht und wie entspannt du sitzt. Keine Zahlen, Prozentwerte, Punkte oder Scores nennen.
Wichtig: Turbulenzen, Boeen und Regen nicht dem Piloten anlasten; Flugweise wie harte G-Last, steile Kurven oder starker Sinkflug darfst du humorvoll bewerten. Reagiere kreativ, menschlich und passend zur Rolle. Max 2 Saetze.${_toneHint()}` : null;
    const pilotIssue = Number(summary.pilotEvents || 0) > 0 || Number(summary.pilotSevere || 0) > 0;
    const weatherIssue = Number(summary.weatherEvents || 0) > 0 || Number(summary.weatherSevere || 0) > 0 || !!wx;
    const fallback = summary.comfortScore >= 75
        ? `Mir geht es gut, der Magen ist ruhig. Wetter war ${wx ? 'spuerbar, aber das geht nicht auf deine Kappe' : 'unauffaellig'}, die Flugweise passt.`
        : (!pilotIssue && weatherIssue)
            ? 'Mein Magen hat sich gemeldet, das war wetterbedingt unruhig. Deinen Flugstil kreide ich dir nicht an.'
            : (pilotIssue && weatherIssue)
                ? 'Mein Magen ist etwas flau. Das Wetter war spuerbar, und Kurven, G-Last oder Sinkflug haben sich zusaetzlich bemerkbar gemacht.'
                : 'Mein Magen ist etwas flau. Kurven, G-Last oder Sinkflug haben sich schon bemerkbar gemacht.';
    _missionActionSpeak(prompt, 'Wohlbefinden', fallback);
}
function paxCargoConditionReport() {
    const ctx = _missionActionContext();
    const summary = _missionComfortSummary();
    const cargo = _activeCargoText() || 'Ladung';
    const wx = _missionWeatherReactionLine(ctx.fd);
    const isPOI = _isPOIMission();
    const missingRequired = !isPOI ? _aptMissingRequiredCargoItems() : [];
    if (!isPOI && missingRequired.length) {
        const missingText = missingRequired.slice(0, 3).join(', ');
        const prompt = `${_baseContext() || `MISSION: ${_activeMissionData().start || '?'} -> ${_activeMissionData().dest || '?'}\nAUSRUESTUNG: ${cargo}\nAUSGABE: Nur gesprochener Text, Deutsch.`}

Button-Frage: Der Pilot fragt nach der Ladung, aber die Pflichtladung wurde vor dem Start nicht geladen.
Fehlende Pflichtladung: ${missingText}
Wetter: ${wx || 'unauffaellig'}
Reagiere als Passagier kurz erschrocken und klar: Wir haben die Pflichtladung vergessen und sollten lieber umkehren, um sie abzuholen. Nenne den fehlenden Gegenstand beim Namen. Kein Vorwurf, aber deutlich besorgt. Max 2 Saetze.${_toneHint()}`;
        const fallback = missingText
            ? `Moment, ${missingText} ist ja gar nicht an Bord. Wir sollten lieber umkehren und die Ladung erst abholen, sonst koennen wir den Auftrag so nicht sauber machen.`
            : 'Moment, die Pflichtladung ist gar nicht an Bord. Wir sollten lieber umkehren und sie erst abholen, sonst koennen wir den Auftrag so nicht sauber machen.';
        _missionActionSpeak(prompt, 'Ladung', fallback);
        return;
    }
    const conditions = _cargoConditionLines(_aptManifestItems());
    const damaged = conditions.filter(item => item.damaged);
    const conditionText = conditions.length
        ? conditions.map(item => `${item.name}${item.required ? ' (Pflicht)' : ''}: ${item.condition}`).join('; ')
        : 'keine Einzelangaben';
    const prompt = `${_baseContext() || `MISSION: ${_activeMissionData().start || '?'} -> ${_activeMissionData().dest || '?'}\nAUSRUESTUNG: ${cargo}\nAUSGABE: Nur gesprochener Text, Deutsch.`}

Button-Frage: Der Pilot fragt nach dem Zustand der Ladung und deiner Pflichtgegenstaende.
Cargo: ${cargo}
Zustand je Gegenstand: ${conditionText}
Auswertung seit Missionsstart (nur zur Einordnung): Cargo-Risiko ${summary.cargoRiskEvents}, Pilot-Events ${summary.pilotEvents}, schwere Pilot-Events ${summary.pilotSevere}; max G ${summary.maxG}, max Bank ${summary.maxBankDeg} Grad, max Sinken ${summary.maxDescentFpm} ft/min; Wetter-Events ${summary.weatherEvents}, Wetter: ${wx || 'unauffaellig'}.
Kommentiere den Zustand in Worten, keine Zahlen, Prozentwerte oder Scores. Ist etwas beschaedigt oder nicht mehr an Bord, sag das klar und nenne den Gegenstand beim Namen; ist alles heil, bestaetige das kurz und passend zur Ladung.
Wichtig: Turbulenzen/Regen nicht dem Piloten anlasten. Max 2 Saetze.${_toneHint()}`;
    const fallback = damaged.length
        ? `${damaged.slice(0, 3).map(item => item.name).join(', ')} hat etwas abbekommen. Das schaue ich mir nach der Landung genauer an.`
        : (summary.cargoRiskEvents <= 1
            ? `Die Ladung sieht gut aus: ${cargo} sitzt noch sauber. Wetter war ${wx || 'kein Thema'}, nichts Kritisches.`
            : `Die Ladung hat etwas gearbeitet: ${cargo} ist noch dabei, aber ich wuerde nach der Landung Gurte und Verpackung pruefen. Wetter zaehlt nicht gegen dich, die haerteren Manoever schon eher.`);
    _missionActionSpeak(prompt, 'Ladung', fallback);
}
function paxWeatherReactionReport() {
    const ctx = _missionActionContext();
    const wx = _missionWeatherReactionLine(ctx.fd);
    const liveWeather = wx || _weatherContext(ctx.fd);
    const base = _baseContext();
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach deinem Eindruck vom Wetter.
Live-Wetter: ${liveWeather || 'keine aktuellen Live-Wetterdaten verfuegbar; Wetterbedingungen unbekannt'}
Datenregel: Nutze nur die uebergebenen Wetterwerte; fehlende Einzelwerte bleiben unbekannt. Erfinde dazu keine Wetterwahrnehmungen. Fehlen aktuelle Live-Wetterdaten insgesamt, benenne die Datenluecke, behaupte kein ruhiges oder gutes Wetter und empfehle keine andere Flughoehe.
Reagiere aus Passagier-/Rollenperspektive auf das aktuelle Wetter. Ist es ruhig und klar, darfst du es geniessen und loben, etwa Sonne, Sicht oder ruhige Luft, soweit die Werte das hergeben. Bei Regen, Wind, Boeen, Wolken oder Turbulenz keine Schuldzuweisung an den Piloten, nur Lagegefuehl und ggf. pragmatischer Wunsch nach ruhiger Fluglage. Keine Prozentwerte vorlesen. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = wx
        ? `Das Wetter ist spuerbar: ${wx}. Das laste ich dir nicht an, aber ruhig und sauber geflogen bleibt jetzt Gold wert.`
        : (liveWeather ? 'Ruhige Luft da draussen, so laesst es sich gut fliegen.' : 'Mir fehlen gerade aktuelle Wetterdaten fuer eine belastbare Rueckmeldung.');
    _missionActionSpeak(prompt, 'Wetter', fallback);
}
 ({pax_wellbeing:paxAptWellbeingReport,pax_cargo:paxCargoConditionReport,pax_weather:paxWeatherReactionReport})[action]();
 return result;
}
module.exports={available,render};
