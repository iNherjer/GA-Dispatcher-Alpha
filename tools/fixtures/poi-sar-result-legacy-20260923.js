// Frozen standalone SAR result helpers; not regenerated.
function _getSarSearchOutcome() {
    if (_sarSearchOutcome) return _sarSearchOutcome;
    // Slight bias to "not found" for realism in random missions.
    _sarSearchOutcome = (Math.random() < 0.38) ? 'found' : 'not_found';
    return _sarSearchOutcome;
}

function _sarResultHint() {
    if (_activeTaskDomain() !== 'search_and_rescue') return '';
    const frame = _activeMissionStoryFrame();
    const subject = String(frame?.focusSubject || '').trim();
    const outcome = _getSarSearchOutcome();
    if (outcome === 'found') {
        return subject
            ? ` SAR-Fazit: Melde klar, dass du zu "${subject}" jetzt einen verwertbaren Treffer hast und die Position sofort an die Leitstelle weitergibst.`
            : ' SAR-Fazit: Melde klar, dass du die vermisste Person entdeckt hast und die Koordinaten sofort an die Leitstelle weitergibst.';
    }
    return subject
        ? ` SAR-Fazit: Melde klar, dass wir zu "${subject}" in diesem Sektor noch keinen Treffer haben und die Leitstelle fuer weitere Suchabschnitte informiert wird.`
        : ' SAR-Fazit: Melde klar, dass wir in diesem Sektor keine Person finden konnten und die Leitstelle fuer weitere Suchabschnitte informiert wird.';
}
