import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), '..');

function makeStore() {
  const data = new Map();
  return {
    getItem: (key) => data.has(String(key)) ? data.get(String(key)) : null,
    setItem: (key, value) => data.set(String(key), String(value)),
    removeItem: (key) => data.delete(String(key)),
    clear: () => data.clear(),
    _dump: () => Object.fromEntries(data)
  };
}

class StubElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.innerText = '';
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.options = [];
    this.dataset = {};
    this.attributes = {};
    this.parentNode = null;
    this.offsetWidth = 240;
    this.offsetHeight = 80;
    this.style = {
      display: '',
      color: '',
      pointerEvents: '',
      transform: '',
      setProperty(name, value) { this[name] = String(value); },
      getPropertyValue(name) { return this[name] || ''; },
      removeProperty(name) { delete this[name]; }
    };
    this.classList = {
      _set: new Set(),
      add: (...names) => names.forEach(n => this.classList._set.add(n)),
      remove: (...names) => names.forEach(n => this.classList._set.delete(n)),
      contains: (name) => this.classList._set.has(name),
      toggle: (name, force) => {
        const next = force === undefined ? !this.classList._set.has(name) : !!force;
        if (next) this.classList._set.add(name);
        else this.classList._set.delete(name);
        return next;
      }
    };
  }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  prepend(child) { this.children.unshift(child); return child; }
  remove() {}
  addEventListener() {}
  removeEventListener() {}
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  querySelector() { return new StubElement('', 'span'); }
  querySelectorAll() { return []; }
  closest() { return null; }
  insertAdjacentHTML() {}
  getBoundingClientRect() { return { x: 0, y: 0, left: 0, top: 0, right: 240, bottom: 80, width: 240, height: 80 }; }
  focus() {}
  blur() {}
  select() {}
}

const elements = new Map();
function el(id) {
  if (!elements.has(id)) elements.set(id, new StubElement(id));
  return elements.get(id);
}

function setupDom(context) {
  const document = {
    head: new StubElement('head', 'head'),
    body: new StubElement('body', 'body'),
    documentElement: new StubElement('html', 'html'),
    readyState: 'loading',
    createElement: (tag) => new StubElement('', tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    getElementById: (id) => el(id),
    querySelector: (selector) => {
      if (selector.startsWith('#')) return el(selector.slice(1));
      return new StubElement('', 'div');
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  };
  context.document = document;
  context.window.document = document;
}

function stableRandom(seed = 1940) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function responseJson(obj, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => obj,
    text: async () => JSON.stringify(obj)
  };
}

function responseText(text, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => JSON.parse(text),
    text: async () => text
  };
}

function parseContextValue(prompt, label) {
  const re = new RegExp(`${label}:\\s*([^\\n]+)`, 'i');
  return (prompt.match(re)?.[1] || '').trim();
}

function promptHas(prompt, ...needles) {
  const hay = String(prompt || '').toLowerCase();
  return needles.some(n => hay.includes(String(n || '').toLowerCase()));
}

function extractTaggedBlock(text, tag) {
  const s = String(text || '');
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = s.toLowerCase().lastIndexOf(open.toLowerCase());
  if (start < 0) return '';
  const bodyStart = start + open.length;
  const end = s.toLowerCase().indexOf(close.toLowerCase(), bodyStart);
  if (end < 0) return '';
  return s.slice(bodyStart, end).trim();
}

function parseForcedTaskDomain(prompt) {
  return String(prompt || '').match(/taskDomain\s+auf\s+"([^"]+)"/i)?.[1] || '';
}

function parsePromptTheme(prompt) {
  return String(prompt || '').match(/Thema-Pflicht:[^"]*"([^"]+)"/i)?.[1] || '';
}

function buildMissionAiPayload(prompt) {
  const start = parseContextValue(prompt, 'Start') || 'Bremen-Hemelingen';
  const targetLine = parseContextValue(prompt, 'Ziel') || 'Zielgebiet';
  const target = targetLine.replace(/\s+\((POI\/Wendepunkt|Zielflughafen)\)\s*$/i, '').trim();
  const isPoi = /POI\/Wendepunkt/i.test(targetLine) || /RUNDFLUG-REGEL/i.test(prompt);
  const forcedTaskDomain = parseForcedTaskDomain(prompt);
  const theme = parsePromptTheme(prompt);
  const taskAndTheme = `${forcedTaskDomain} ${theme}`;
  const wantsMapping = promptHas(taskAndTheme, 'mapping_survey', 'kartier', 'survey', 'baustell', 'materiallager');
  const wantsFire = promptHas(taskAndTheme, 'fire_watch', 'feuer', 'brand', 'rauchentwicklung', 'waldbrand');
  const wantsSar = promptHas(taskAndTheme, 'search_and_rescue', 'sar/rescue', 'such', 'rettung', 'vermisst');
  const wantsAnimal = promptHas(taskAndTheme, 'animal_transport', 'tiertransport', 'tierschutz', 'ziege', 'reh', 'gans', 'möwe', 'moewe');
  const wantsNews = promptHas(taskAndTheme, 'news_coverage', 'reporter', 'news', 'presse', 'lageeinschaetzung', 'lageeinschätzung');
  if (isPoi) {
    if (wantsMapping) {
      return {
        title: `Baustellen-Check: ${target}`,
        story: `Am Zielgebiet ${target} liegt ein kleiner Material- und Erdarbeitsbereich, der fuer eine einfache Luftkartierung dokumentiert werden soll. Wir pruefen Zufahrt, Lagerflaeche und sichtbare Palettencluster, ohne eine Bodencrew als erledigte Inspektion wirken zu lassen. Nach zwei ruhigen Bahnen ueber dem Ziel geht es zurueck nach ${start}.`,
        pax: '1 PAX (Vermessungsingenieurin)',
        cargo: 'Kamera-Gimbal, Tablet und Referenzkarten (46 lbs)',
        sceneIntent: {
          summary: `Am Ziel ${target} soll eine kleine Baustellen-/Materiallager-Szene mit gebuendelten Paletten, einem Erdarbeitsgeraet und wenigen Markierungen sichtbar sein.`,
          environment: 'Baustelle / Materiallager',
          visibleIdeas: ['ein Erdarbeitsgeraet am Rand der Flaeche', 'sechs bis acht Paletten als gebuendeltes Materiallager', 'ein kleiner Baustellen-LKW', 'ein paar Kegel an der Zufahrt'],
          avoid: ['keine grosse Einsatzstelle', 'keine fertige Bodenvermessung', 'keine zufaellige Einzelpalette weit abseits'],
          densityHint: 'normal',
          notes: 'Objekte sollen geordnet in einem Cluster stehen, besonders die Paletten.'
        },
        passenger: {
          name: 'Nora Wieland',
          role: 'Vermessungsingenieurin',
          gender: 'female',
          personality: 'praezise, ruhig, fachlich',
          dialectHint: 'neutral',
          roleProfile: 'photogrammetry_precision_v1',
          taskDomain: 'mapping_survey',
          gTolerance: 'mittel',
          bankTolerance: 'mittel',
          cargoSensitivity: 'mittel',
          stomachSensitivity: 'mittel',
          comfortPriority: 'hoch',
          urgencyPriority: 'niedrig',
          targetAltFt: 1900,
          targetRadiusNm: 2,
          targetDwellMin: 4,
          greetingText: `Hi, wir kartieren am Zielgebiet ${target} die kleine Baustellenflaeche mit Zufahrt und Materiallager aus der Luft.`,
          trainingPlan: null
        }
      };
    }
    if (wantsFire) {
      return {
        title: `Rauchlage: ${target}`,
        story: `Im Waldgebiet um ${target} wurde eine schwache Rauchfahne gemeldet. Wir fliegen eine ruhige Sichtpruefung, bestaetigen Lage und Ausdehnung und bleiben hoch genug fuer ein sauberes Gesamtbild. Danach geht es zurueck nach ${start}.`,
        pax: '1 PAX (Brandbeobachter)',
        cargo: 'Waldbrandkarte, Funknotizen und Fernglas (18 lbs)',
        sceneIntent: {
          summary: `Am Ziel ${target} soll eine kleine Rauchentwicklung als Sichtanker erkennbar sein, optional ohne sichtbare Flammen.`,
          environment: 'Wald / Rauchlage',
          visibleIdeas: ['eine einzelne Rauchfahne am Waldrand', 'keine grossen Loeschfahrzeuge direkt am Ziel', 'natuerlicher Waldkontext'],
          avoid: ['keine Grossbrand-Szene', 'keine Feuerwehrkolonne mitten im Wald', 'keine Unfallstelle'],
          densityHint: 'sparse',
          notes: 'Rauch ist das Primaerziel, Support bleibt minimal.'
        },
        passenger: {
          name: 'Tobias Frey',
          role: 'Brandbeobachter',
          gender: 'male',
          personality: 'konzentriert, knapp, lageorientiert',
          dialectHint: 'neutral',
          roleProfile: 'fire_observer_ops_v1',
          taskDomain: 'fire_watch',
          gTolerance: 'hoch',
          bankTolerance: 'mittel',
          cargoSensitivity: 'niedrig',
          stomachSensitivity: 'niedrig',
          comfortPriority: 'mittel',
          urgencyPriority: 'hoch',
          targetAltFt: 2300,
          targetRadiusNm: 3,
          targetDwellMin: 3,
          greetingText: `Hi, wir pruefen am Zielgebiet ${target} die gemeldete Rauchentwicklung und melden nur das, was wir sicher sehen.`,
          trainingPlan: null
        }
      };
    }
    if (wantsSar) {
      return {
        title: `Suchhinweis: ${target}`,
        story: `Nahe ${target} fehlt einer Wandergruppe noch eine klare Sichtbestaetigung fuer einen moeglichen Rastplatz. Wir suchen nach einem kleinen Hinweis am Boden, nicht nach einer grossen Einsatzstelle. Wenn wir Zelt, Ausruestung oder Signalrauch sehen, geben wir die Position weiter und kehren nach ${start} zurueck.`,
        pax: '1 PAX (SAR-Koordinatorin)',
        cargo: 'Kartenbrett, Funkliste und Fernglas (24 lbs)',
        sceneIntent: {
          summary: `Am Ziel ${target} soll ein kleiner SAR-Hinweis sichtbar sein, z.B. Ausruestung oder Signalrauch, ohne dass Bodenteams die Lage schon geloest haben.`,
          environment: 'Waldlichtung / Suchgebiet',
          visibleIdeas: ['eine einzelne vermisste Person oder ein klarer Hinweis', 'kleines Zelt oder Ausruestung', 'dezenter Signalrauch'],
          avoid: ['keine grosse Rettungskolonne', 'keine Unfallfahrzeuge', 'keine ueberladene Szene'],
          densityHint: 'sparse',
          notes: 'Primaerziel ist der Suchhinweis, Support bleibt sparsam.'
        },
        passenger: {
          name: 'Lea Hoffmann',
          role: 'SAR-Koordinatorin',
          gender: 'female',
          personality: 'ruhig, fokussiert, klar',
          dialectHint: 'neutral',
          roleProfile: 'rescue_coordination_v1',
          taskDomain: 'search_and_rescue',
          gTolerance: 'hoch',
          bankTolerance: 'mittel',
          cargoSensitivity: 'niedrig',
          stomachSensitivity: 'niedrig',
          comfortPriority: 'mittel',
          urgencyPriority: 'hoch',
          targetAltFt: 2100,
          targetRadiusNm: 3,
          targetDwellMin: 4,
          greetingText: `Hi, wir suchen am Zielgebiet ${target} nach einem kleinen Bodenhinweis wie Zelt, Ausruestung oder Signalrauch.`,
          trainingPlan: null
        }
      };
    }
    if (wantsNews) {
      return {
        title: `Lagebild: ${target}`,
        story: `Eine Lokalredaktion braucht ein sachliches Luftlagebild rund um ${target}. Wir sammeln Orientierung, sichtbare Aktivitaet und kurze Fakten aus der Luft, ohne aus der Beobachtung eine Einsatzlage zu machen. Danach geht es zurueck nach ${start}.`,
        pax: '1 PAX (Reporter)',
        cargo: 'Kamera- und Audio-Set (32 lbs)',
        sceneIntent: {
          summary: 'POI-Reportage ohne eigene Zielszene; die sichtbare Logik liegt in Orientierung und Beobachtung.',
          environment: '',
          visibleIdeas: [],
          avoid: ['keine Einsatzdramaturgie', 'keine Unfallstelle erfinden', 'keine technischen Schadensbehauptungen'],
          densityHint: 'none',
          notes: 'Reporter beobachtet, inszeniert aber keine separate Szene.'
        },
        passenger: {
          name: 'Timo Berger',
          role: 'TV-Reporter',
          gender: 'male',
          personality: 'praezise, praesent, professionell',
          dialectHint: 'neutral',
          roleProfile: 'news_reporter_professional_v1',
          taskDomain: 'news_coverage',
          gTolerance: 'mittel',
          bankTolerance: 'mittel',
          cargoSensitivity: 'mittel',
          stomachSensitivity: 'mittel',
          comfortPriority: 'mittel',
          urgencyPriority: 'niedrig',
          targetAltFt: 1800,
          targetRadiusNm: 3,
          targetDwellMin: 3,
          greetingText: `Hi, ich sammle heute ein sachliches Lagebild zu ${target}; bitte ruhig fliegen, damit die Beobachtung verwertbar bleibt.`,
          trainingPlan: null
        }
      };
    }
    return {
      title: `Ufer-Check: ${target}`,
      story: `Die Wasserbehörde braucht heute ein ruhiges Lagebild am Zielgebiet ${target}. Wir prüfen Uferkante, Treibgut und kleine Boote, ohne die Szene mit Einsatzmitteln zu überladen. Nach zwei sauberen Beobachtungskreisen geht es zurück nach ${start}.`,
      pax: '1 PAX (Wasserbau-Beobachterin)',
      cargo: 'Tablet, Fernglas und Fotokamera (28 lbs)',
      sceneIntent: {
        summary: `Am Ziel ${target} sollen ein natürlicher Uferabschnitt, etwas Treibgut und höchstens kleine zivile Boote sichtbar sein.`,
        environment: 'Seeufer / Wasserlinie',
        visibleIdeas: ['natürliche Uferkante', 'Treibholz nahe der Wasserlinie', 'ein kleines ziviles Boot', 'wenige Wasservögel'],
        avoid: ['keine großen Schiffe', 'keine Einsatzfahrzeuge', 'keine Absperrkegel'],
        densityHint: 'sparse',
        notes: 'Die Szene stützt die Beobachtungsaufgabe, ohne den Auftrag vorwegzunehmen.'
      },
      passenger: {
        name: 'Mara Seidel',
        role: 'Wasserbau-Beobachterin',
        gender: 'female',
        personality: 'ruhig, aufmerksam, sachlich',
        dialectHint: 'neutral',
        roleProfile: 'science_field_v1',
        taskDomain: 'science_geo',
        gTolerance: 'mittel',
        bankTolerance: 'mittel',
        cargoSensitivity: 'mittel',
        stomachSensitivity: 'mittel',
        comfortPriority: 'mittel',
        urgencyPriority: 'niedrig',
        targetAltFt: 1800,
        targetRadiusNm: 3,
        targetDwellMin: 3,
        greetingText: `Hi, wir prüfen am Zielgebiet ${target} heute Uferkante, Treibgut und kleine Wasseraktivität aus der Luft.`,
        trainingPlan: null
      }
    };
  }
  if (wantsAnimal) {
    return {
      title: `Tierschutz-Shuttle nach ${target}`,
      story: `Eine Auffangstation braucht heute einen ruhigen Transfer nach ${target}. An Bord ist eine gesicherte Transportbox mit einem heimischen Wildvogel; der Flug soll gleichmaessig bleiben, damit die Uebergabe am Ziel entspannt klappt.`,
      pax: '1 PAX (Tierschutz-Kurierin)',
      cargo: 'Gesicherte Wildvogel-Transportbox (26 lbs)',
      sceneIntent: {
        summary: 'A-B-Flug ohne POI-Zielszene; die sichtbare Logik liegt in Pax/Fracht.',
        environment: 'leer',
        visibleIdeas: [],
        avoid: ['keine exotischen Tiere', 'keine Zielszene am Flugplatz erzwingen'],
        densityHint: 'none',
        notes: 'Tiertransport wird als Fracht-/PAX-Kontext behandelt.'
      },
      passenger: {
        name: 'Mira Baumann',
        role: 'Tierschutz-Kurierin',
        gender: 'female',
        personality: 'warm, praktisch, ruhig',
        dialectHint: 'neutral',
        roleProfile: 'general_passenger_v1',
        taskDomain: 'animal_transport',
        gTolerance: 'mittel',
        bankTolerance: 'niedrig',
        cargoSensitivity: 'hoch',
        stomachSensitivity: 'mittel',
        comfortPriority: 'hoch',
        urgencyPriority: 'niedrig',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        greetingText: `Hi, wir bringen die gesicherte Wildvogel-Transportbox nach ${target}; wichtig ist ein ruhiger, gleichmaessiger Flug.`,
        trainingPlan: null
      }
    };
  }
  return {
    title: `Vereins-Shuttle nach ${target}`,
    story: `Ein Techniker aus dem Verein muss nach ${target}, um vor Ort eine Ersatzpumpe und Unterlagen zu übergeben. Der Flug ist nicht dramatisch, aber pünktliches Ankommen hilft dem Zielverein beim Nachmittagsbetrieb. Am Ziel wartet die Crew am Vorfeld mit einem kleinen Servicefahrzeug.`,
    pax: '1 PAX (Vereins-Techniker)',
    cargo: 'Ersatzpumpe und Werkzeugtasche (64 lbs)',
    sceneIntent: {
      summary: 'A-B-Flug ohne Zielszene',
      environment: 'leer',
      visibleIdeas: [],
      avoid: [],
      densityHint: 'none',
      notes: 'Bei A-B-Missionen wird keine POI-Zielszene gespawnt.'
    },
    passenger: {
      name: 'Jonas Krüger',
      role: 'Vereins-Techniker',
      gender: 'male',
      personality: 'praktisch, freundlich, konzentriert',
      dialectHint: 'neutral',
      roleProfile: 'club_utility_v1',
      taskDomain: 'club_utility',
      gTolerance: 'mittel',
      bankTolerance: 'mittel',
      cargoSensitivity: 'hoch',
      stomachSensitivity: 'niedrig',
      comfortPriority: 'mittel',
      urgencyPriority: 'hoch',
      targetAltFt: 0,
      targetRadiusNm: 0,
      targetDwellMin: 0,
      greetingText: `Hi, wir bringen die Ersatzpumpe und Unterlagen nach ${target}; am Vorfeld wartet die Vereinscrew auf die Übergabe.`,
      trainingPlan: null
    }
  };
}

function buildSceneAiPayload(prompt) {
  const contextBlock = extractTaggedBlock(prompt, 'KONTEXT') || prompt;
  const story = parseContextValue(contextBlock, 'Story');
  const taskDomain = (contextBlock.match(/taskDomain:\s*([^\n]+)/i)?.[1] || '').trim();
  const sceneContext = `${taskDomain}\n${story}\n${contextBlock}`;
  if (/search_and_rescue/i.test(taskDomain) || /SAR|Such|vermisst|Signalrauch|Rettung|Wandergruppe/i.test(sceneContext)) {
    return {
      targetScene: {
        kind: 'sar_land',
        preset: '',
        features: ['missing_person', 'tent', 'small_equipment', 'signal_smoke'],
        requirements: [
          { feature: 'missing_person', count: 1, placement: 'nahe einer kleinen Lichtung', notes: 'Suchziel' },
          { feature: 'small_equipment', count: 1, placement: 'neben dem Suchhinweis', notes: 'Bodenhinweis' },
          { feature: 'signal_smoke', count: 1, placement: 'ein Stueck seitlich der Person', notes: 'sichtbarer Hinweis aus der Luft' }
        ],
        roles: [],
        density: 'sparse',
        layout: 'cluster',
        notes: 'SAR-Hinweis als kleiner Cluster, keine Bodentrupps.'
      }
    };
  }
  if (/Baustell|Materiallager|Paletten|Erdarbeit|Kartierung|Vermessung|mapping_survey/i.test(sceneContext)) {
    return {
      targetScene: {
        kind: 'construction_site',
        preset: '',
        features: ['earthmoving', 'construction_truck', 'pallet_stack', 'cones'],
        requirements: [
          { feature: 'earthmoving', count: 1, placement: 'am Rand der bearbeiteten Flaeche', notes: 'sichtbarer Erdarbeitskontext' },
          { feature: 'construction_truck', count: 1, placement: 'nahe der Zufahrt', notes: 'kleiner Baustellen-LKW als Kontext' },
          { feature: 'pallet_stack', count: 8, placement: 'am Materiallager', arrangement: 'cluster', notes: 'gebuendeltes Palettenlager, nicht verstreut' },
          { feature: 'cones', count: 4, placement: 'an der Zufahrt', arrangement: 'line', notes: 'sparsame Markierung' }
        ],
        roles: [],
        density: 'normal',
        layout: 'cluster',
        notes: 'Baustellenobjekte als kleine geordnete Gruppe; Paletten eng zusammen.'
      }
    };
  }
  if (/Rauch|Brand|Feuer|Waldbrand|Brandbeobachter|fire_watch/i.test(sceneContext)) {
    return {
      targetScene: {
        kind: 'fire_watch',
        preset: '',
        features: ['smoke', 'small_equipment'],
        requirements: [
          { feature: 'smoke', count: 1, placement: 'am Waldrand oder in einer Lichtung', notes: 'Primaerziel der Sichtpruefung' },
          { feature: 'small_equipment', count: 1, placement: 'abseits am Boden', notes: 'dezenter Kontext, keine geloeste Einsatzlage' }
        ],
        roles: [],
        density: 'sparse',
        layout: 'mixed',
        notes: 'Rauchanker ohne Grossbrand-Inszenierung.'
      }
    };
  }
  if (/Ufer|Wasser|Treibgut|Boot/i.test(sceneContext)) {
    return {
      targetScene: {
        kind: 'water_context',
        preset: '',
        features: ['logs', 'watercraft', 'waterfowl'],
        requirements: [
          { feature: 'logs', count: 2, placement: 'nahe der Wasserlinie', notes: 'Treibgut für Ufer-Check' },
          { feature: 'watercraft', count: 1, placement: 'am Ufer oder flach auf dem Wasser', notes: 'kleines ziviles Boot als Kontext' },
          { feature: 'waterfowl', count: 2, placement: 'locker am Ufer', notes: 'ruhiger Naturkontext' }
        ],
        roles: [],
        density: 'sparse',
        layout: 'waterline',
        notes: 'Sparsame Uferszene ohne Einsatzfahrzeuge.'
      }
    };
  }
  return {
    targetScene: {
      kind: 'none',
      preset: '',
      features: [],
      requirements: [],
      roles: [],
      density: 'none',
      layout: '',
      notes: 'A-B-Flug; keine Zielszene erforderlich.'
    }
  };
}

function buildPlannerV2Payload(prompt) {
  const draftRaw = extractTaggedBlock(prompt, 'DRAFT');
  const resolvedRaw = extractTaggedBlock(prompt, 'RESOLVED_NEEDS').trim();
  let draft = {};
  try { draft = JSON.parse(draftRaw || '{}'); } catch (_) {}
  const hasResolvedNeeds = resolvedRaw && resolvedRaw !== 'null';
  if (!hasResolvedNeeds && draft.mode === 'poi') {
    return {
      status: 'needs_data',
      needs: [
        { type: 'geo_context', target: draft.target?.name || 'POI', reason: 'Placement anchors for target scene' },
        { type: 'mission_truth', target: draft.target?.name || 'POI', reason: 'Canonical target and visible cues' }
      ],
      plan: {
        taskDomain: draft.profile?.taskDomain || 'general',
        roleProfile: draft.profile?.roleProfile || 'general_passenger_v1',
        missionType: draft.mode || 'poi',
        targetCategory: draft.category || '',
        primaryObjective: '',
        targetLabel: draft.target?.name || '',
        sceneKind: '',
        sceneDensity: '',
        requiredAnchors: [],
        objectFamilies: [],
        placementPolicy: '',
        narrativeRules: [],
        lockedFields: {},
        confidence: 0.35
      }
    };
  }
  const isAptTraining = draft.mode === 'apt' && draft.category === 'trn';
  const taskDomain = isAptTraining ? 'training' : (draft.profile?.taskDomain || (draft.profile?.id === 'mapping_survey' ? 'mapping_survey' : 'general'));
  const isMapping = taskDomain === 'mapping_survey';
  const isSar = taskDomain === 'search_and_rescue';
  return {
    status: 'ready',
    needs: [],
    plan: {
      taskDomain,
      roleProfile: isAptTraining ? 'instructor_calm_precise_v1' : (draft.profile?.roleProfile || 'general_passenger_v1'),
      missionType: draft.mode || 'apt',
      targetCategory: draft.category || '',
      primaryObjective: isMapping
        ? `Survey the target area ${draft.target?.name || ''} with stable repeatable passes.`
        : (isSar ? `Search for a small ground clue near ${draft.target?.name || ''}.` : `Complete the mission to ${draft.target?.name || draft.route?.targetIcao || ''}.`),
      targetLabel: draft.target?.name || draft.route?.targetIcao || '',
      sceneKind: isMapping ? 'construction_site' : (isSar ? 'sar_land' : 'none'),
      sceneDensity: isMapping ? 'normal' : (isSar ? 'sparse' : 'none'),
      requiredAnchors: isMapping ? ['road_or_work_area', 'material_cluster'] : (isSar ? ['clearing_or_edge'] : []),
      objectFamilies: isMapping ? ['earthmoving', 'construction_truck', 'pallet_stack', 'cones'] : (isSar ? ['missing_person', 'small_equipment', 'signal_smoke'] : []),
      placementPolicy: isAptTraining ? 'No target object spawn; training debrief after landing.' : (isMapping ? 'Cluster material objects together; do not scatter pallets.' : 'Keep the target sparse and readable.'),
      narrativeRules: ['Keep story, passenger, sceneIntent and targetScene in the same task domain.'],
      lockedFields: {
        taskDomain,
        targetName: draft.target?.name || '',
        noLandingAtPoi: draft.mode === 'poi'
      },
      confidence: hasResolvedNeeds ? 0.82 : 0.7
    }
  };
}

function buildSpokenText(prompt) {
  if (/Boarding und Verladen abgeschlossen/i.test(prompt)) return 'Boarding ist erledigt, die Ausrüstung ist verstaut und ich bin bereit. Lass uns sauber und ohne Hektik rausrollen.';
  if (/Wir starten gleich/i.test(prompt)) return 'Hi, danke fürs Mitnehmen. Wir halten den Flug ruhig und konzentrieren uns am Ziel genau auf den Auftrag.';
  if (/Zielobjekt .* wird im Anflug sichtbar|taucht gerade vor uns auf/i.test(prompt)) return 'Ich habe das Ziel voraus in Sicht, leicht rechts von der Nase. Noch etwa zwei Minuten, dann können wir den ersten ruhigen Beobachtungskreis fliegen.';
  if (/Höhe passt jetzt|Ich bin fertig am Ziel|fertig am Ziel/i.test(prompt)) return 'Das passt, ich habe die Beobachtung abgeschlossen. Von meiner Seite können wir zurück zum Platz gehen.';
  if (/nähern uns|Landung gleich|Rückanflug|vor der Landung/i.test(prompt)) return 'Der Zielplatz liegt sauber voraus, die Übergabe am Vorfeld passt zur Planung. Bitte den Anflug stabil halten, dann sind wir gleich durch.';
  if (/Nach der Landung|Landing-Roll/i.test(prompt)) return 'Gut gelandet, danke. Ich sehe schon den richtigen Bereich am Vorfeld, wir können gleich zur Übergabe rollen.';
  if (/Verabschiedung|Flug ist beendet|gelandet/i.test(prompt)) return 'Danke für den Flug. Auftrag und Ablauf haben zusammengepasst, ich nehme die Notizen jetzt mit zur Übergabe.';
  return 'Verstanden, ich bleibe bei der Aufgabe und gebe dir nur die nächsten sinnvollen Hinweise.';
}

function setupFetch(context, prompts) {
  context.fetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('airports.json')) {
      return responseJson(JSON.parse(fs.readFileSync(path.join(root, 'airports.json'), 'utf8')));
    }
    if (href.includes('api.open-elevation.com')) return responseJson({ results: [{ elevation: 420 }] });
    if (href.includes('aviationweather.gov')) return responseJson([]);
    if (href.includes('open-meteo.com')) {
      return responseJson({
        current: { wind_speed_10m: 8, wind_direction_10m: 260, temperature_2m: 17 },
        hourly: { time: [], visibility: [], weather_code: [] }
      });
    }
    if (href.includes('overpass-api.de')) {
      const rawBody = String(options?.body || '');
      const decoded = decodeURIComponent(rawBody.replace(/^data=/, ''));
      const around = decoded.match(/around:\d+,(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      const lat = around ? Number(around[1]) : 53.09;
      const lon = around ? Number(around[2]) : 8.79;
      return responseJson({
        elements: [
          { type: 'way', id: 1, tags: { natural: 'water', name: 'Uferbereich' }, center: { lat: lat + 0.001, lon: lon + 0.001 }, geometry: [{ lat: lat + 0.0007, lon: lon + 0.0005 }, { lat: lat + 0.0012, lon: lon + 0.0012 }] },
          { type: 'way', id: 2, tags: { highway: 'service' }, center: { lat: lat + 0.002, lon: lon + 0.001 } },
          { type: 'way', id: 3, tags: { landuse: 'meadow' }, center: { lat: lat + 0.002, lon: lon + 0.002 } }
        ]
      });
    }
    if (href.includes('ga-proxy.einherjer.workers.dev') || href.includes('wikipedia.org') || href.includes('wikidata.org') || href.includes('nominatim.openstreetmap.org')) {
      return responseJson({ items: [], elements: [], query: { pages: {} } });
    }
    if (href.includes('generativelanguage.googleapis.com')) {
      const body = options?.body ? JSON.parse(options.body) : {};
      const prompt = body?.contents?.[0]?.parts?.[0]?.text || '';
      const isTts = Array.isArray(body?.generationConfig?.responseModalities) && body.generationConfig.responseModalities.includes('AUDIO');
      if (isTts) return responseJson({ candidates: [{ content: { parts: [{ inlineData: { data: '', mimeType: 'audio/wav' } }] } }] });
      prompts.push({ url: href, prompt });
      const text = body?.generationConfig?.response_mime_type === 'text/plain'
        ? buildSpokenText(prompt)
        : JSON.stringify(/Mission Planner V2/i.test(prompt) ? buildPlannerV2Payload(prompt) : (/Scene Composer/i.test(prompt) ? buildSceneAiPayload(prompt) : buildMissionAiPayload(prompt)));
      return responseJson({ candidates: [{ content: { parts: [{ text }] } }] });
    }
    return responseJson({}, false, 404);
  };
  context.window.fetch = context.fetch;
}

function setupContext(seed) {
  const prompts = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval: () => {},
    Math: Object.create(Math),
    Date,
    JSON,
    Number,
    String,
    Boolean,
    Array,
    Object,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    URL,
    URLSearchParams,
    AbortController,
    navigator: { userAgent: 'mission-dryrun' },
    location: { href: 'http://localhost/dryrun', search: '' },
    alert: (msg) => console.warn('[alert]', msg),
    confirm: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    localStorage: makeStore(),
    sessionStorage: makeStore(),
    window: {}
  };
  context.window = context;
  context.globalThis = context;
  context.self = context;
  context.Math.random = stableRandom(seed);
  setupDom(context);
  setupFetch(context, prompts);
  context.L = {
    map: () => ({ setView(){ return this; }, remove(){}, on(){}, addLayer(){}, removeLayer(){}, eachLayer(){}, fitBounds(){}, invalidateSize(){} }),
    tileLayer: () => ({ addTo(){ return this; } }),
    marker: () => ({ addTo(){ return this; }, bindPopup(){ return this; }, setLatLng(){ return this; } }),
    polyline: () => ({ addTo(){ return this; }, getBounds(){ return {}; }, setLatLngs(){ return this; } }),
    latLngBounds: () => ({ extend(){ return this; }, isValid(){ return true; } }),
    divIcon: () => ({}),
    icon: () => ({})
  };
  context.AudioContext = class {};
  context.webkitAudioContext = context.AudioContext;
  context.Audio = class { play(){ return Promise.resolve(); } };
  context.Blob = class {};
  context.URL.createObjectURL = () => 'blob:dryrun';
  context.URL.revokeObjectURL = () => {};
  return { context: vm.createContext(context), prompts };
}

function loadScript(context, rel) {
  const code = fs.readFileSync(path.join(root, rel), 'utf8');
  vm.runInContext(code, context, { filename: rel });
}

function initUiForRun(context, targetType, { pipelineV2 = false } = {}) {
  const values = {
    startLoc: 'EDTW',
    destLoc: '',
    destLocRadio: '',
    targetType,
    distRange: 'medium',
    regionFilter: 'any',
    dirPref: 'any',
    maxSeats: '4',
    tasSlider: '160',
    gphSlider: '14',
    altSlider: '3500',
    apiKeyInput: 'DRYRUN_KEY'
  };
  for (const [id, value] of Object.entries(values)) el(id).value = value;
  el('aiToggle').checked = true;
  el('briefingBox').style.display = 'none';
  if (pipelineV2) context.localStorage.setItem('ga_debug_mission_pipeline_v2', 'true');
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function promptRecords(prompts) {
  return prompts.map((p, index) => ({
    index: index + 1,
    kind: /Mission Planner V2/i.test(p.prompt) ? 'mission-planner-v2' : (/Scene Composer/i.test(p.prompt) ? 'scene-composer' : (/OUTPUT>/.test(p.prompt) ? 'mission-dispatcher' : 'pax-text')),
    modelUrl: p.url.replace(/\?key=.*/, '?key=DRYRUN_KEY'),
    prompt: p.prompt,
    excerpt: p.prompt.replace(/\s+/g, ' ').slice(0, 700)
  }));
}

async function runOne({ seed, targetType, pipelineV2 = false }) {
  const { context, prompts } = setupContext(seed);
  loadScript(context, 'datenbank.js');
  loadScript(context, 'missions.js');
  loadScript(context, 'data/mission-scene-assets.js');
  loadScript(context, 'app.js');
  loadScript(context, 'passenger-voice.js');

  const airports = JSON.parse(fs.readFileSync(path.join(root, 'airports.json'), 'utf8'));
  vm.runInContext(`globalAirports = ${JSON.stringify(airports)};`, context);
  vm.runInContext(`
    updateMap = function(lat1, lon1, lat2, lon2) {
      routeWaypoints = [{ lat: lat1, lng: lon1, name: currentStartICAO || 'DEP' }, { lat: lat2, lng: lon2, name: currentDestICAO || 'DEST' }];
      window._missionRouteWaypoints = routeWaypoints;
    };
    renderMainRoute = function() {};
    fetchRunwayDetails = async function() {};
    fetchAreaDescription = async function() {};
    fetchAirportFreq = async function() {};
    loadMetarWidget = async function() {};
    refreshGPSAfterDispatch = function() {};
    triggerCloudSave = function() {};
    recalculatePerformance = function() {};
    setDrumCounter = function() {};
    resetBtn = function(btn) { if (btn) btn.disabled = false; };
    vpUpdatePosition = function() {};
  `, context);
  initUiForRun(context, targetType, { pipelineV2 });

  await vm.runInContext('generateMission()', context);
  await wait(900);
  await vm.runInContext('acceptMissionDraft()', context);
  const dispatchState = vm.runInContext(`(() => ({
    hasMission: !!currentMissionData,
    briefingVisible: document.getElementById('briefingBox').style.display || '',
    title: document.getElementById('mTitle').innerText || document.getElementById('mTitle').innerHTML || '',
    story: document.getElementById('mStory').innerText || '',
    debugSnapshot: window.vpMissionDebugSnapshot || null
  }))()`, context);
  if (!dispatchState.hasMission) {
    return {
      blocked: true,
      blockPhase: 'dispatch',
      blockReason: 'currentMissionData missing after generateMission/acceptMissionDraft',
      dispatchState,
      mission: null,
      passenger: null,
      briefing: null,
      paxLog: [],
      debugSnapshot: dispatchState.debugSnapshot || null,
      prompts: promptRecords(prompts)
    };
  }
  await vm.runInContext(`
    localStorage.setItem('awm_pax_voice', '0');
    paxVoiceSetEnabled(false);
    paxVoiceClearLog();
    paxVoicePlayBoarding();
  `, context);
  await wait(50);
  await vm.runInContext(`
    (async () => {
      const md = currentMissionData;
      const start = globalAirports[md.start];
      await triggerPaxGreeting(start.lat, start.lon);
      if (md.isPOI) {
        await triggerPaxAtTarget({
          mslFt: Number(window.activePassenger?.targetAltFt || (md.poiTerrainFt || 420) + 700),
          aglFt: 700,
          gsKts: 95,
          windKts: 8,
          windDeg: 260,
          tempC: 17,
          visKm: 30,
          bankDeg: 12,
          gForce: 1.05
        });
        await new Promise(r => setTimeout(r, 2200));
        await triggerPaxFarewell({
          simulated: true,
          durationSec: Math.max(60, Math.round((md.dist / 160) * 3600)),
          landing: 'EDTW',
          distanceNm: Number(Number(md.dist || 0).toFixed(1)),
          maxAltFt: Math.max(2500, Number(window.activePassenger?.targetAltFt || 0) + 900),
          maxBankDeg: 18,
          maxGForce: 1.12,
          maxDescentFpm: -650,
          touchdownVsFpm: null
        });
      } else {
        await triggerPaxAtTarget({ mslFt: 1100, aglFt: 700, gsKts: 95, windKts: 8, windDeg: 260, tempC: 17, visKm: 30, bankDeg: 8, gForce: 1.03 });
        await new Promise(r => setTimeout(r, 2200));
        await triggerPaxLandingRoll({
          simulated: true,
          landing: md.dest,
          durationSec: Math.max(60, Math.round((md.dist / 160) * 3600)),
          distanceNm: Number(Number(md.dist || 0).toFixed(1)),
          maxAltFt: 4500,
          maxBankDeg: 14,
          maxGForce: 1.08,
          maxDescentFpm: -600,
          touchdownVsFpm: null
        });
        await new Promise(r => setTimeout(r, 1100));
        await triggerPaxFarewell({
          simulated: true,
          landing: md.dest,
          durationSec: Math.max(60, Math.round((md.dist / 160) * 3600)),
          distanceNm: Number(Number(md.dist || 0).toFixed(1)),
          maxAltFt: 4500,
          maxBankDeg: 14,
          maxGForce: 1.08,
          maxDescentFpm: -600,
          touchdownVsFpm: null
        });
      }
      await new Promise(r => setTimeout(r, 100));
    })()
  `, context);
  await wait(200);

  const result = vm.runInContext(`(() => {
    const md = currentMissionData;
    const p = window.activePassenger || {};
    return {
      mission: md,
      passenger: p,
      briefing: {
        title: document.getElementById('mTitle').innerText || document.getElementById('mTitle').innerHTML,
        story: document.getElementById('mStory').innerText,
        dep: document.getElementById('mDepICAO').innerText,
        depName: document.getElementById('mDepName').innerText,
        dest: document.getElementById('mDestICAO').innerText,
        destName: document.getElementById('mDestName').innerText,
        pax: document.getElementById('mPay').innerText,
        cargo: document.getElementById('mWeight').innerText,
        dist: document.getElementById('mDistNote').innerText,
        ete: document.getElementById('mETENote').innerText,
        heading: document.getElementById('mHeadingNote').innerText
      },
      paxLog: paxVoiceGetLogEntries(),
      debugSnapshot: window.vpMissionDebugSnapshot || null
    };
  })()`, context);
  result.prompts = promptRecords(prompts);
  return result;
}

const VARIANT_TARGET_TYPES = [
  'poi:all+mapping_survey',
  'poi:fire+fire_watch',
  'poi:all+search_and_rescue',
  'poi:water',
  'poi:all+science_bio',
  'apt:all+animal_transport',
  'apt:cargo+cargo_fragile',
  'apt:trn',
  'apt:private+sightseeing_tour'
];

function parseCliArgs(argv) {
  const args = {
    runs: 3,
    seed: 20260522,
    variants: false,
    targetTypes: null,
    pipelineV2: false,
    out: 'mission-pipeline-dryrun-edtw.json'
  };
  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (arg === '--variants') args.variants = true;
    else if (arg === '--pipeline-v2') args.pipelineV2 = true;
    else if (arg.startsWith('--runs=')) args.runs = Math.max(1, Math.min(20, Number.parseInt(arg.slice(7), 10) || args.runs));
    else if (arg.startsWith('--seed=')) args.seed = Number.parseInt(arg.slice(7), 10) || args.seed;
    else if (arg.startsWith('--types=')) {
      args.targetTypes = arg.slice(8).split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--out=')) {
      args.out = arg.slice(6).replace(/[\\/]/g, '').trim() || args.out;
    }
  }
  return args;
}

function buildRunConfigs(args) {
  if (Array.isArray(args.targetTypes) && args.targetTypes.length) {
    return Array.from({ length: args.runs }, (_, i) => ({
      seed: args.seed + i,
      targetType: args.targetTypes[i % args.targetTypes.length],
      pipelineV2: !!args.pipelineV2
    }));
  }
  if (args.variants) {
    const rand = stableRandom(args.seed);
    const pool = [...VARIANT_TARGET_TYPES];
    const picks = [];
    while (picks.length < args.runs) {
      if (pool.length === 0) pool.push(...VARIANT_TARGET_TYPES);
      const index = Math.floor(rand() * pool.length);
      picks.push(pool.splice(index, 1)[0]);
    }
    return picks.map((targetType, i) => ({
      seed: args.seed + (i * 101) + 17,
      targetType,
      pipelineV2: !!args.pipelineV2
    }));
  }
  const roll = stableRandom(args.seed)();
  const firstType = roll < 0.5 ? 'poi:water' : 'apt:club';
  return [
    { seed: args.seed, targetType: firstType, pipelineV2: !!args.pipelineV2 },
    { seed: args.seed + 1, targetType: firstType.startsWith('poi') ? 'apt:club' : 'poi:water', pipelineV2: !!args.pipelineV2 },
    { seed: args.seed + 2, targetType: 'poi:water', pipelineV2: !!args.pipelineV2 }
  ].slice(0, args.runs);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const roll = stableRandom(args.seed)();
  const runs = buildRunConfigs(args);
  const results = [];
  for (const cfg of runs) results.push(await runOne(cfg));
  const outDir = path.join(root, 'analysis');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, args.out);

  const summary = results.map((r, i) => {
    const md = r.mission || {};
    const paxLines = (r.paxLog || [])
      .filter(e => e.type === 'msg' || e.type === 'recv')
      .map(e => String(e.msg || e.text || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return {
      run: i + 1,
      seed: runs[i]?.seed,
      targetType: runs[i]?.targetType,
      blocked: !!r.blocked,
      blockPhase: r.blockPhase || null,
      blockReason: r.blockReason || null,
      mode: md.isPOI ? 'POI' : 'APT',
      start: md.start,
      dest: md.isPOI ? md.poiName : md.dest,
      targetName: md.targetName,
      mission: md.mission,
      source: md.source,
      missionPipelineV2Enabled: !!md.missionPipelineV2Enabled || !!md.missionPlanV2,
      missionPlanV2: md.missionPlanV2 || null,
      sceneStatus: md.sceneCompositionStatus,
      targetScene: md.targetScene,
      passenger: r.passenger,
      briefing: r.briefing,
      paxTexts: paxLines,
      promptKinds: r.prompts.map(p => p.kind)
    };
  });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), roll, summary, runs: results }, null, 2));
  console.log(JSON.stringify({ report: path.relative(root, outPath), roll, summary }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
