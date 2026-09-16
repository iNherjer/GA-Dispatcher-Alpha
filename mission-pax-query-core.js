// Generated from original passenger-voice.js manual queries; do not edit.
'use strict';
const comfortCore=require('./mission-comfort-core.js');
const weatherCore=require('./mission-farewell-voice-core.js');
function _missionWeatherReactionLine(flightData = null) {
    const fd = flightData || window.lastLiveFlightData || {};
    const parts = [];
    const wind = Number(fd.windKts || 0);
    const gust = Number(fd.windGustKts || 0);
    const spread = (Number.isFinite(gust) && Number.isFinite(wind)) ? Math.max(0, gust - wind) : 0;
    const turb = Number(fd.turbulencePct || 0);
    const precip = Number(fd.precipRateMmH || 0);
    if (wind >= 24) parts.push(`Wind ${Math.round(wind)} kt`);
    if (spread >= 16) parts.push(`Boeen plus ${Math.round(spread)} kt`);
    if (turb >= 55) parts.push(`Turbulenz ${Math.round(turb)} Prozent`);
    if (precip >= 1.5 || fd.precipActive === true) parts.push(precip >= 1.5 ? `Regen/Niederschlag ${precip.toFixed(1)} mm/h` : 'Niederschlag');
    if (fd.inCloud === true) parts.push('in Wolken');
    return parts.join(', ');
}
function available(context={},fd={}) {
 const focus=comfortCore.evaluate(null,null,context).cargoFocus;
 return [...(!context.isPoi && context.hasPassenger && !focus ? ['pax_wellbeing']:[]),
 ...(!context.isPoi && focus ? ['pax_cargo']:[]),
 ...(_missionWeatherReactionLine(fd) && (context.hasPassenger||focus) ? ['pax_weather']:[])];
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
 const _activeMissionData=()=>context.missionData||{};
 let result=null;
 const _missionActionSpeak=(prompt,label,fallbackText)=>{result={kind:'pax_query',action,prompt,label,fallbackText,delayMs:0};};
 function paxAptWellbeingReport() {
    const ctx = _missionActionContext();
    const summary = _missionComfortSummary();
    const base = _baseContext();
    const wx = _missionWeatherReactionLine(ctx.fd);
    const facts = `Score ${summary.comfortScore}/100 (${summary.mood}); Pilot-Events ${summary.pilotEvents}, davon schwer ${summary.pilotSevere}; Wetter-Events ${summary.weatherEvents}, davon schwer ${summary.weatherSevere}; max G ${summary.maxG}, max Bank ${summary.maxBankDeg} Grad, max Sinken ${summary.maxDescentFpm} ft/min, Wetter: ${wx || 'unauffaellig'}.`;
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach dem Wohlbefinden/Zufriedenheit.
Auswertung seit Missionsstart: ${facts}
Wichtig: Turbulenzen, Boeen und Regen nicht dem Piloten anlasten; Flugweise wie harte G-Last, steile Kurven oder starker Sinkflug darfst du humorvoll bewerten. Reagiere kreativ, menschlich und passend zur Rolle. Max 2 Saetze.${_toneHint()}` : null;
    const pilotIssue = Number(summary.pilotEvents || 0) > 0 || Number(summary.pilotSevere || 0) > 0;
    const weatherIssue = Number(summary.weatherEvents || 0) > 0 || Number(summary.weatherSevere || 0) > 0 || !!wx;
    const fallback = summary.comfortScore >= 75
        ? `Mir geht es gut, Score etwa ${summary.comfortScore} von 100. Wetter war ${wx ? 'spuerbar, aber das geht nicht auf deine Kappe' : 'unauffaellig'}, die Flugweise passt.`
        : (!pilotIssue && weatherIssue)
            ? `Ich bin bei etwa ${summary.comfortScore} von 100. Das war wetterbedingt unruhig, aber deinen Flugstil kreide ich dir nicht an.`
            : (pilotIssue && weatherIssue)
                ? `Ich bin bei etwa ${summary.comfortScore} von 100. Das Wetter war spuerbar, und Kurven, G-Last oder Sinkflug haben sich zusaetzlich bemerkbar gemacht.`
                : `Ich bin bei etwa ${summary.comfortScore} von 100. Kurven, G-Last oder Sinkflug haben sich schon bemerkbar gemacht.`;
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
    const prompt = `${_baseContext() || `MISSION: ${_activeMissionData().start || '?'} -> ${_activeMissionData().dest || '?'}\nAUSRUESTUNG: ${cargo}\nAUSGABE: Nur gesprochener Text, Deutsch.`}

Button-Frage: Der Pilot fragt nach dem Zustand der Ladung.
Cargo: ${cargo}
Auswertung seit Missionsstart: Cargo-Risiko ${summary.cargoRiskEvents}, Pilot-Events ${summary.pilotEvents}, schwere Pilot-Events ${summary.pilotSevere}; max G ${summary.maxG}, max Bank ${summary.maxBankDeg} Grad, max Sinken ${summary.maxDescentFpm} ft/min; Wetter-Events ${summary.weatherEvents}, Wetter: ${wx || 'unauffaellig'}.
Wichtig: Turbulenzen/Regen nicht dem Piloten anlasten. Bewerte Frachtzustand kreativ passend zur Ladung, von "sitzt sauber" bis "Kaffeebecher/Proben/Kisten haben gelitten". Max 2 Saetze.${_toneHint()}`;
    const fallback = summary.cargoRiskEvents <= 1
        ? `Die Ladung sieht gut aus: ${cargo} sitzt noch sauber. Wetter war ${wx || 'kein Thema'}, nichts Kritisches.`
        : `Die Ladung hat etwas gearbeitet: ${cargo} ist noch dabei, aber ich wuerde nach der Landung Gurte und Verpackung pruefen. Wetter zaehlt nicht gegen dich, die haerteren Manoever schon eher.`;
    _missionActionSpeak(prompt, 'Ladung', fallback);
}
function paxWeatherReactionReport() {
    const ctx = _missionActionContext();
    const wx = _missionWeatherReactionLine(ctx.fd);
    const base = _baseContext();
    const prompt = base ? `${base}

Button-Frage: Der Pilot fragt nach einer Reaktion auf markantes Wetter.
Live-Wetter: ${wx || _weatherContext(ctx.fd) || 'keine markanten Live-Wetterdaten'}
Reagiere auf Regen, Wind, Boeen, Wolken oder Turbulenz aus Passagier-/Rollenperspektive. Wichtig: Bei Turbulenz oder Regen keine Schuldzuweisung an den Piloten, nur Lagegefuehl und ggf. pragmatischer Wunsch nach ruhiger Fluglage. Max 2 Saetze.${_toneHint()}` : null;
    const fallback = wx
        ? `Das Wetter ist spuerbar: ${wx}. Das laste ich dir nicht an, aber ruhig und sauber geflogen bleibt jetzt Gold wert.`
        : 'Wetterseitig ist gerade nichts Markantes dabei. Von mir aus koennen wir den Flug normal fortsetzen.';
    _missionActionSpeak(prompt, 'Wetter', fallback);
}
 ({pax_wellbeing:paxAptWellbeingReport,pax_cargo:paxCargoConditionReport,pax_weather:paxWeatherReactionReport})[action]();
 return result;
}
module.exports={available,render};
