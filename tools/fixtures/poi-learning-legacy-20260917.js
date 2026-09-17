function _poiKnowledgeRichFactCount(stage = 'generic') {
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    const total = Math.max(
        candidates.length,
        Number.isFinite(Number(context?.selectedFacts)) ? Math.round(Number(context.selectedFacts)) : 0
    );
    const s = String(stage || 'generic').toLowerCase();
    if (s === 'entry') {
        if (total >= 8) return 3;
        if (total >= 5) return 2;
        return 1;
    }
    if (s === 'result') {
        if (total >= 7) return 2;
        return 1;
    }
    return 1;
}

function _poiKnowledgeFactSequenceHint(stage = 'generic') {
    if (_activeTaskDomain() !== 'poi_learning_guide') return '';
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    if (!context || !candidates.length) return '';
    const stageKey = String(stage || 'generic').toLowerCase();
    const maxFacts = Math.max(1, Math.min(3, _poiKnowledgeRichFactCount(stageKey)));
    if (maxFacts <= 1) return _poiKnowledgeFactHint(stageKey);
    const ordered = candidates
        .map(fact => ({ ...fact, score: _poiKnowledgeStageScore(fact, stageKey) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const stagePool = ordered.filter(fact => Number(fact.index || 0) >= _poiKnowledgeStageMinIndex(stageKey));
    const pool = stagePool.length ? stagePool : ordered;
    const selected = [];
    const seenTopics = new Set();
    for (const fact of pool) {
        if (_poiMemoryHasSimilarFact(fact.text)) continue;
        const topic = String(fact.topic || 'general').toLowerCase();
        if (seenTopics.has(topic) && selected.length < Math.min(2, maxFacts)) continue;
        selected.push(fact);
        seenTopics.add(topic);
        if (selected.length >= maxFacts) break;
    }
    for (const fact of pool) {
        if (selected.length >= maxFacts) break;
        if (selected.some(x => x.text === fact.text)) continue;
        if (_poiMemoryHasSimilarFact(fact.text)) continue;
        selected.push(fact);
    }
    if (!selected.length) return _poiKnowledgeFactHint(stageKey);
    if (selected.length === 1) return _poiKnowledgeFactHint(stageKey);
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const label = stageKey === 'result' ? 'Fazit' : 'Zielgebiet';
    const facts = selected.map((fact, index) => {
        const cleanText = String(fact.text || '').replace(/[.!?]+$/, '').trim();
        const clip = cleanText.length > 180 ? `${cleanText.slice(0, 177)}...` : cleanText;
        return `${index + 1}. ${clip}`;
    }).join(' ');
    return ` WISSENS-FAKTENQUEUE (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Es gibt hier genug Stoff; nutze ${selected.length} kurze, unterschiedliche Fakten als kleinen Erzaehlbogen und erfinde keine Zusatzdaten: ${facts}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke.`;
}

function _poiKnowledgeManualFactCandidates() {
    return _poiKnowledgeFactCandidates({ includeExtraFacts: true });
}

function _poiKnowledgeTellMoreAvailable() {
    if (_activeTaskDomain() !== 'poi_learning_guide') return false;
    if (typeof window.missionRuntimeIsActive === 'function' && !window.missionRuntimeIsActive()) return false;
    if (!window.activePassenger || !_missionHasPax()) return false;
    return _poiKnowledgeManualFactCandidates().length > 0;
}

function _poiKnowledgeFreshFactCount() {
    const candidates = _poiKnowledgeManualFactCandidates();
    return candidates.filter(fact => (
        !_poiKnowledgeManualFactIndices.has(_poiKnowledgeFactKey(fact))
        && !_poiMemoryHasSimilarFact(fact.text)
    )).length;
}

function _poiKnowledgeManualFactClip(text = '') {
    const clean = _poiKnowledgeCleanFactText(text).replace(/[.!?]+$/, '').trim();
    if (clean.length <= 340) return clean;
    const clipped = clean.slice(0, 337).replace(/\s+\S*$/, '').trim();
    return clipped || clean.slice(0, 337).trim();
}

function _poiKnowledgeNextManualFact() {
    const context = _activePoiKnowledgeContext();
    if (!context) return null;
    _poiKnowledgeSyncContext(context);
    const candidates = _poiKnowledgeManualFactCandidates();
    const fresh = candidates.find(fact => (
        !_poiKnowledgeManualFactIndices.has(_poiKnowledgeFactKey(fact))
        && !_poiMemoryHasSimilarFact(fact.text)
    ));
    if (!fresh) return null;
    _poiKnowledgeManualFactIndices.add(_poiKnowledgeFactKey(fresh));
    return fresh;
}

function _poiKnowledgeTargetName(context = null) {
    const md = (typeof currentMissionData !== 'undefined' ? currentMissionData : null) || {};
    return String(context?.title || md.poiName || md.targetName || 'dem Ziel')
        .replace(/\s+/g, ' ')
        .trim();
}
function paxKnowledgeTellMore() {
    const context = _activePoiKnowledgeContext();
    if (!_poiKnowledgeTellMoreAvailable()) {
        _paxSpeakTextDirect('Dazu habe ich gerade keine gesicherte Faktenbasis geladen.', 'Erzähl mal');
        return;
    }
    const fact = _poiKnowledgeNextManualFact();
    const target = _poiKnowledgeTargetName(context);
    if (!fact) {
        _paxSpeakTextDirect(`Mehr weiß ich dazu leider auch nicht. Die gesicherten Punkte zu ${target} haben wir damit durch.`, 'Erzähl mal');
        _refreshPoiKnowledgeGuideMenu();
        return;
    }
    const clip = _poiKnowledgeManualFactClip(fact.text);
    const intro = _poiKnowledgeManualFactIndices.size <= 1 ? 'Klar. Noch ein Punkt:' : 'Noch ein Punkt:';
    _paxSpeakTextDirect(`${intro} ${clip}.`, 'Erzähl mal');
    _refreshPoiKnowledgeGuideMenu();
}