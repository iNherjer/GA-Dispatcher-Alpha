function _poiKnowledgeCleanFactText(value = '') {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .replace(/\[\d+\]/g, '')
        .trim();
}

function _poiKnowledgeContextIdentity(context = null) {
    if (!context || typeof context !== 'object') return '';
    const title = String(context.title || context.name || '').replace(/\s+/g, ' ').trim();
    const source = String(context.pageid || context.wikidataId || context.url || context.sourceUrl || context.source || '').trim();
    const facts = Array.isArray(context.facts)
        ? context.facts.slice(0, 3).map(fact => _poiKnowledgeCleanFactText(fact?.text || fact || '').slice(0, 80)).join('|')
        : '';
    return `${title}|${source}|${facts}`;
}

function _poiKnowledgeSyncContext(context = null) {
    const activeContext = context || _activePoiKnowledgeContext();
    const key = _poiKnowledgeContextIdentity(activeContext);
    if (!key || key === _poiKnowledgeContextKey) return;
    _poiKnowledgeContextKey = key;
    _poiKnowledgeManualFactIndices = new Set();
    _poiKnowledgeSpokenMemory = '';
}

function _poiKnowledgeFactCandidates(options = {}) {
    const context = _activePoiKnowledgeContext();
    if (!context) return [];
    _poiKnowledgeSyncContext(context);
    const includeExtraFacts = options?.includeExtraFacts === true;
    const facts = Array.isArray(context.facts) ? context.facts : [];
    const extraFacts = includeExtraFacts && Array.isArray(context.extraFacts) ? context.extraFacts : [];
    const seen = new Set();
    return [...facts, ...extraFacts]
        .map((fact, index) => ({
            index,
            key: `${index < facts.length ? 'core' : 'extra'}:${index < facts.length ? index : index - facts.length}`,
            topic: String(fact?.topic || 'general').toLowerCase(),
            text: _poiKnowledgeCleanFactText(fact?.text || fact || '')
        }))
        .filter(fact => fact.text.length >= 36)
        .filter(fact => !/(wikipedia|quelle|http|einzelnachweise|weblinks|normdaten)/i.test(fact.text))
        .filter(fact => {
            const key = fact.text.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

function _poiKnowledgeFactKey(fact = {}) {
    return String(fact?.key || fact?.index || fact?.text || '').trim();
}

function _poiKnowledgeStageScore(fact = {}, stage = 'generic') {
    const s = String(stage || 'generic').toLowerCase();
    const topic = String(fact.topic || 'general').toLowerCase();
    const preferred = {
        greeting: ['location', 'history', 'use'],
        boarding: ['location', 'history', 'use'],
        in_sight: ['location', 'structure', 'metrics', 'nature'],
        entry: ['history', 'use', 'structure', 'metrics'],
        result: ['use', 'history', 'nature', 'metrics'],
        generic: ['history', 'location', 'use', 'structure', 'metrics', 'nature']
    }[s] || ['history', 'location', 'use', 'structure', 'metrics', 'nature'];
    const topicScore = preferred.includes(topic) ? (preferred.length - preferred.indexOf(topic)) * 10 : 0;
    const stageOffset = _poiKnowledgeStageMinIndex(s);
    const index = Number.isFinite(Number(fact.index)) ? Number(fact.index) : 0;
    const progressionScore = index >= stageOffset ? 12 : -30;
    return topicScore + progressionScore - index;
}

function _poiKnowledgeStageMinIndex(stage = 'generic') {
    return {
        greeting: 0,
        boarding: 0,
        in_sight: 1,
        entry: 1,
        result: 4,
        generic: 0
    }[String(stage || 'generic').toLowerCase()] || 0;
}

function _poiKnowledgeFactHint(stage = 'generic') {
    const task = _activeTaskDomain();
    const isLearningGuide = task === 'poi_learning_guide';
    const isSightseeing = task === 'sightseeing_tour';
    if (!isLearningGuide && !isSightseeing) return '';
    const context = _activePoiKnowledgeContext();
    const candidates = _poiKnowledgeFactCandidates();
    if (!context || !candidates.length) return '';
    const stageKey = String(stage || 'generic').toLowerCase();
    const ordered = candidates
        .map(fact => ({ ...fact, score: _poiKnowledgeStageScore(fact, stageKey) }))
        .sort((a, b) => (b.score - a.score) || (a.index - b.index));
    const stagePool = ordered.filter(fact => Number(fact.index || 0) >= _poiKnowledgeStageMinIndex(stageKey));
    const pool = stagePool.length ? stagePool : ordered;
    const fresh = pool.find(fact => !_poiMemoryHasSimilarFact(fact.text)) || pool[0];
    if (!fresh) return '';
    const cleanText = String(fresh.text || '').replace(/[.!?]+$/, '').trim();
    const clip = cleanText.length > 220 ? `${cleanText.slice(0, 217)}...` : cleanText;
    const target = String(context.title || 'Zielgebiet').replace(/\s+/g, ' ').trim();
    const label = {
        greeting: 'Vorschau',
        boarding: 'Vorschau',
        in_sight: 'Anflug',
        entry: 'Zielgebiet',
        result: 'Fazit',
        generic: 'Kontext'
    }[stageKey] || 'Kontext';
    if (isSightseeing) {
        return ` POI-KONTEXT (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Wenn es natuerlich passt, erwaehne hoechstens einen kurzen Kontextpunkt als persoenliche Beobachtung, nicht als Fuehrung: ${clip}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke und erfinde keine Zusatzdaten.`;
    }
    return ` WISSENS-FAKTENQUEUE (${label}, Quelle: akzeptierte Wiki-Basis zu ${target}): Nutze genau diesen Fakt, falls er natuerlich passt, und erfinde keine Zusatzdaten: ${clip}. Wiederhole keine bereits genannte Zahl, Nutzung oder Landmarke.`;
}