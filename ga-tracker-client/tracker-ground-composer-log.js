'use strict';
// Diagnose: hat der Boden-Composer (Web) in dieser Mission gearbeitet, was hat er gewählt,
// gab es Fehler? Liest nur die gespeicherte Mission und ihre Ladeliste; ändert nichts.
// Zeilen: GROUND_COMPOSER (Plan) und GROUND_COMPOSER_MANIFEST (was die Szene tatsächlich nutzt).

const IDEA_KEYS = ['charterIdea', 'sightseeingIdea', 'aptNewsIdea', 'privateOuting', 'clubIdea', 'medicalTransferIdea',
  'cargoIdea', 'fragileCargoIdea', 'animalTransportIdea', 'groundComposer'];

function clean(value, max = 80) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function findPlan(md) {
  const contract = md && typeof md.missionContract === 'object' && md.missionContract ? md.missionContract : {};
  const candidates = [];
  for (const key of IDEA_KEYS) candidates.push([key, md?.[key]], [`missionContract.${key}`, contract[key]]);
  candidates.push(['privateReturn.outing', md?.privateReturn?.outing], ['missionContract.privateReturn.outing', contract.privateReturn?.outing]);
  for (const [key, idea] of candidates) {
    if (idea && typeof idea === 'object' && idea.groundVisual && typeof idea.groundVisual === 'object') return { key, plan: idea.groundVisual };
  }
  return null;
}

function manifestOf(state, explicit = null) {
  const md = state?.currentMissionData || state || {};
  const manifest = explicit || state?.cargoManifest || md.cargoManifest || md.missionContract?.cargoManifest || null;
  return manifest && Array.isArray(manifest.items) ? manifest : null;
}

function summarize(state = null, cargoManifest = null) {
  const md = state?.currentMissionData || state || null;
  if (!md || typeof md !== 'object') return ['GROUND_COMPOSER status=none reason=no-mission'];
  const lines = [];
  const found = findPlan(md);
  if (!found) {
    const skipped = md.groundComposerStatus;
    lines.push(`GROUND_COMPOSER status=none reason=${clean(skipped?.reason || 'no-plan', 40)}`);
  } else {
    const { key, plan } = found;
    const info = plan.composer && typeof plan.composer === 'object' ? plan.composer : {};
    const status = clean(info.status || 'unknown', 20);
    const pax = (Array.isArray(plan.passengers) ? plan.passengers : [])
      .map(p => `${clean(p.id, 10)}:${clean(p.gender, 8) || '?'}/${clean(p.look, 20) || '?'}/${clean(p.ageBand, 20) || '-'}(${clean(p.lookSource, 12) || '-'})`).join(',') || '-';
    const cargo = Object.entries(plan.cargo && typeof plan.cargo === 'object' ? plan.cargo : {})
      .map(([id, entry]) => `${clean(id, 10)}:${(Array.isArray(entry?.pieces) ? entry.pieces : []).map(piece => `${clean(piece.form, 20)}@${Math.round(Number(piece.weightLbs) || 0)}`).join('+') || '-'}`)
      .join(',') || '-';
    // Etappe E: Fahrzeug (Quelle composer|capacity) und Bringer/Empfänger je Bodenszene.
    const scenes = Object.entries(plan.scenes && typeof plan.scenes === 'object' ? plan.scenes : {})
      .map(([scene, entry]) => `${clean(scene, 10)}:${clean(entry?.vehicle, 10) || '?'}(${clean(entry?.vehicleSource, 10) || '-'})/`
        + ((Array.isArray(entry?.persons) ? entry.persons : []).map(p => `${clean(p.gender, 8) || '?'}/${clean(p.look, 20) || '?'}`).join('+') || '-'))
      .join(';') || '-';
    lines.push(`GROUND_COMPOSER status=${status} source=${clean(info.source, 40) || '-'} idea=${clean(key, 50)} aiLooks=${Number(plan.aiLooks) || 0}`
      + ` kept=${info.kept ? 1 : 0} seed=${plan.figureSeed ? 1 : 0} pax=${pax} cargo=${cargo} scenes=${scenes}`
      + (info.error ? ` error="${clean(info.error, 160).replace(/"/g, "'")}"` : ''));
  }
  const manifest = manifestOf(state, cargoManifest);
  if (manifest) {
    const items = manifest.items.filter(item => item && (item.visualPieces || item.visualPersons || item.cargoVisualSource)).map(item => {
      const persons = Array.isArray(item.visualPersons) ? item.visualPersons.map(p => clean(p.title, 40)).join('+') : '';
      const pieces = Array.isArray(item.visualPieces) ? item.visualPieces.map(p => clean(p.title, 50)).join('+') : '';
      return `${clean(item.id, 30)}=${persons || pieces || clean(item.objectTitle, 50) || '-'}(${clean(item.cargoVisualSource || (persons ? 'figures' : ''), 20) || '-'})`;
    });
    lines.push(`GROUND_COMPOSER_MANIFEST items=${items.length ? items.join(' | ') : 'keine Composer-Figuren/-Packstücke'}`);
  }
  return lines;
}

module.exports = { summarize, findPlan };
