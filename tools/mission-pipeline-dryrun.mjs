import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)), '..');

function loadLocalEnv() {
  for (const name of ['key.env.local', '.env.local', '.env']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const bareValues = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        bareValues.push(trimmed);
        continue;
      }
      if (process.env[match[1]]) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
    if (!process.env.GEMINI_API_KEY && bareValues.length === 1) {
      process.env.GEMINI_API_KEY = bareValues[0];
    }
  }
}

loadLocalEnv();

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
  const escaped = String(label || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)\\s*${escaped}:\\s*([^\\n]+)`, 'i');
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

function parseDispatchForm(prompt) {
  const raw = extractTaggedBlock(prompt, 'DISPATCH_FORM');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function dryrunTargetCategory(dispatchForm) {
  return String(
    dispatchForm?.required?.targetCategory ||
    dispatchForm?.target?.category ||
    dispatchForm?.targetCategory ||
    ''
  ).toLowerCase();
}

function dryrunInspectionText(target, category) {
  const cat = String(category || '').toLowerCase();
  if (cat === 'dam') {
    return {
      title: `Sichtprüfung: ${target}`,
      story: `Am Wasserbauwerk ${target} steht eine technische Sichtprüfung an. Wir halten Staumauer, Dammkrone, Ablaufbauwerk und sichtbare Pegel-/Schieberanlagen im Fokus; Zufahrten oder Strompunkte dienen nur zur Orientierung. Nach zwei ruhigen Beobachtungskreisen geht es zurueck.`,
      scene: {
        summary: `Am Ziel ${target} bleibt die Staumauer bzw. das Rueckhaltebecken das Primaerziel; kleine Wartungsobjekte duerfen nur als Support am Rand stehen.`,
        environment: 'Talsperre / Wasserbauwerk',
        visibleIdeas: ['Staumauer oder Dammkrone als Hauptobjekt', 'dezente Wartungsmarkierung', 'ein technisches Fahrzeug nur an der Zufahrt'],
        avoid: ['keine Verlagerung auf Dorfstrasse oder Strommast', 'keine Baustellengrossszene', 'keine Geologiestory'],
        notes: 'Support darf das Wasserbauwerk nicht als Primaerziel ersetzen.'
      }
    };
  }
  if (cat === 'bridge') {
    return {
      title: `Brückenprüfung: ${target}`,
      story: `An ${target} dokumentieren wir den Zustand von Pfeilern, Widerlagern und Brueckendeck aus der Luft. Der Fokus bleibt auf dem Bauwerk; Strasse, Fluss oder Bahntrasse sind nur Lagekontext. Danach geht es zurueck.`,
      scene: {
        summary: `Am Ziel ${target} ist die Bruecke das Primaerziel; Supportobjekte bleiben sparsam am Rand.`,
        environment: 'Brueckenbauwerk',
        visibleIdeas: ['Brueckendeck und Pfeiler', 'kleine Absperrung an der Zufahrt', 'ein Wartungsfahrzeug abseits des Bauwerks'],
        avoid: ['keine reine Strassenkontrolle', 'keine Wasser-/Ufermission', 'keine Grossbaustelle'],
        notes: 'Bauwerk vor Verkehrsfläche.'
      }
    };
  }
  if (cat === 'telecom') {
    return {
      title: `Mastprüfung: ${target}`,
      story: `Am Ziel ${target} pruefen wir Mast, Antennenebenen und sichtbare Versorgungstechnik. Zufahrt und Technikschrank sind nur Orientierung, das Hauptziel bleibt der Mast. Danach geht es zurueck.`,
      scene: {
        summary: `Am Ziel ${target} ist der Mast bzw. Turm das Primaerziel.`,
        environment: 'Telekommunikationsanlage',
        visibleIdeas: ['Mast oder Turm', 'kleiner Technikcontainer', 'Wartungsfahrzeug an der Zufahrt'],
        avoid: ['keine Dorfstrassenmission', 'keine allgemeine Stromtrassenpruefung'],
        notes: 'Mast bleibt semantisch dominant.'
      }
    };
  }
  if (cat === 'road') {
    return {
      title: `Trassenprüfung: ${target}`,
      story: `Entlang ${target} pruefen wir Belag, Randbereiche und sichtbare Engstellen aus der Luft. Der Auftrag bleibt eine Strassen-/Trasseninspektion und wird nicht auf einzelne Gebaeude umgedeutet. Danach geht es zurueck.`,
      scene: {
        summary: `Am Ziel ${target} ist die Strasse bzw. Trasse das Primaerziel.`,
        environment: 'Strasse / Trasse',
        visibleIdeas: ['Strassenabschnitt', 'sparsame Markierung am Rand', 'Wartungsfahrzeug an sicherer Stelle'],
        avoid: ['keine Gebaeudeinspektion', 'keine Unfalllage ohne Anlass'],
        notes: 'Korridorziel, keine punktfoermige Ersatzszene.'
      }
    };
  }
  return {
    title: `Infrastrukturprüfung: ${target}`,
    story: `Am Ziel ${target} erfassen wir den sichtbaren Zustand der Infrastruktur aus der Luft. Das ausgewaehlte Ziel bleibt der Bezugspunkt; Zufahrt, Strompunkte oder Betriebsflaechen dienen nur als Orientierung und Support. Danach geht es zurueck.`,
    scene: {
      summary: `Am Ziel ${target} bleibt die ausgewaehlte Infrastrukturanlage das Primaerziel.`,
      environment: 'Infrastruktur',
      visibleIdeas: ['Hauptanlage als Ziel', 'dezente Wartungsmarkierung', 'ein Supportfahrzeug abseits'],
      avoid: ['keine semantische Verlagerung auf Nebenstrasse', 'keine unpassende Natur- oder Uferstory'],
      notes: 'Zieltreue vor Supportankern.'
    }
  };
}

function buildMissionAiPayload(prompt) {
  const start = parseContextValue(prompt, 'Start') || 'Bremen-Hemelingen';
  const targetLine = parseContextValue(prompt, 'Ziel') || 'Zielgebiet';
  const target = targetLine.replace(/\s+\((POI\/Wendepunkt|Zielflughafen)\)\s*$/i, '').trim();
  const isPoi = /POI\/Wendepunkt/i.test(targetLine) || /RUNDFLUG-REGEL/i.test(prompt);
  const forcedTaskDomain = parseForcedTaskDomain(prompt);
  const dispatchForm = parseDispatchForm(prompt);
  const formTaskDomain = String(dispatchForm?.required?.taskDomain || '').toLowerCase();
  const targetCategory = dryrunTargetCategory(dispatchForm);
  const theme = parsePromptTheme(prompt);
  const taskAndTheme = `${forcedTaskDomain} ${formTaskDomain} ${theme}`;
  const wantsMapping = promptHas(taskAndTheme, 'mapping_survey', 'kartier', 'survey', 'baustell', 'materiallager');
  const wantsInspection = promptHas(taskAndTheme, 'inspection_infra', 'inspektion', 'sichtprüfung', 'sichtpruefung', 'wartung');
  const wantsScienceGeo = promptHas(taskAndTheme, 'science_geo', 'geologie', 'relief', 'erosion', 'hang');
  const wantsScienceBio = promptHas(taskAndTheme, 'science_bio', 'biologie', 'umwelt', 'vegetation', 'habitat');
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
    if (wantsInspection) {
      const detail = dryrunInspectionText(target, targetCategory);
      return {
        dispatchFormAck: {
          taskDomain: 'inspection_infra',
          roleProfile: 'technical_inspector_v1',
          missionType: 'poi'
        },
        title: detail.title,
        story: detail.story,
        pax: '1 PAX (Infrastruktur-Techniker)',
        cargo: 'Waermebildkamera, Tablet und Checklisten (26 lbs)',
        sceneIntent: {
          summary: detail.scene.summary,
          environment: detail.scene.environment,
          visibleIdeas: detail.scene.visibleIdeas,
          avoid: detail.scene.avoid,
          densityHint: 'sparse',
          notes: detail.scene.notes
        },
        passenger: {
          name: 'Martin Seidel',
          role: 'Infrastruktur-Techniker',
          gender: 'male',
          personality: 'sachlich, gruendlich, ruhig',
          dialectHint: 'neutral',
          roleProfile: 'technical_inspector_v1',
          taskDomain: 'inspection_infra',
          gTolerance: 'mittel',
          bankTolerance: 'niedrig',
          cargoSensitivity: 'mittel',
          stomachSensitivity: 'mittel',
          comfortPriority: 'hoch',
          urgencyPriority: 'niedrig',
          targetAltFt: 2200,
          targetRadiusNm: 2,
          targetDwellMin: 4,
          greetingText: `Hi, wir bleiben bei ${target} als Hauptziel und dokumentieren nur die sichtbaren technischen Punkte.`,
          trainingPlan: null
        }
      };
    }
    if (wantsScienceGeo) {
      return {
        dispatchFormAck: {
          taskDomain: 'science_geo',
          roleProfile: 'science_field_v1',
          missionType: 'poi'
        },
        title: `Reliefbeobachtung: ${target}`,
        story: `Am Zielgebiet ${target} steht eine geologische Sichtbeobachtung an. Wir betrachten Relief, Hangformen, Erosionsspuren und auffaellige Geländekanten; Wasser, Wege oder Wiesen sind nur Orientierung, sofern sie nicht selbst das ausgewaehlte Ziel sind. Nach zwei ruhigen Beobachtungskreisen geht es zurueck nach ${start}.`,
        pax: '1 PAX (Geomorphologe)',
        cargo: 'Geologie-Mapset, Tablet und Kamera (18 lbs)',
        sceneIntent: {
          summary: `Am Ziel ${target} bleibt Relief bzw. Gelaendeform das Primaerziel.`,
          environment: 'Relief / Gelaende',
          visibleIdeas: ['Hang- oder Kantenverlauf', 'offenes Gelaende als Referenz', 'keine technische Einsatzszene'],
          avoid: ['keine Ufermission ohne Wasserziel', 'keine Infrastrukturinspektion', 'keine Arten-/Vegetationsanalyse'],
          densityHint: 'none',
          notes: 'Geologische Beobachtung ohne separate Supportszene.'
        },
        passenger: {
          name: 'Dr. Nils Vogt',
          role: 'Geomorphologe',
          gender: 'male',
          personality: 'analytisch, klar, professionell',
          dialectHint: 'neutral',
          roleProfile: 'science_field_v1',
          taskDomain: 'science_geo',
          gTolerance: 'mittel',
          bankTolerance: 'mittel',
          cargoSensitivity: 'mittel',
          stomachSensitivity: 'mittel',
          comfortPriority: 'mittel',
          urgencyPriority: 'niedrig',
          targetAltFt: 2100,
          targetRadiusNm: 3,
          targetDwellMin: 4,
          greetingText: `Hi, wir beobachten am Zielgebiet ${target} heute Relief, Erosion und Hangstruktur aus der Luft.`,
          trainingPlan: null
        }
      };
    }
    if (wantsScienceBio) {
      const waterLike = ['water', 'dam'].includes(targetCategory);
      return {
        dispatchFormAck: {
          taskDomain: 'science_bio',
          roleProfile: 'science_field_v1',
          missionType: 'poi'
        },
        title: `Umweltbeobachtung: ${target}`,
        story: waterLike
          ? `Bei ${target} wird ein biologischer Beobachtungsflug durchgefuehrt. Fokus sind Vegetation, Gewaesserrand und sichtbare Stressindikatoren im Zielgebiet; Wege oder Gebaeude bleiben nur Orientierung. Danach geht es zurueck nach ${start}.`
          : `Am Zielgebiet ${target} wird eine biologische Beobachtung aus der Luft durchgefuehrt. Fokus sind Vegetationsmuster, Habitatkanten und sichtbare Stressindikatoren; Wege oder Gebaeude bleiben nur Orientierung. Danach geht es zurueck nach ${start}.`,
        pax: '1 PAX (Biologin)',
        cargo: 'Umweltsensorik und Kamera (18 lbs)',
        sceneIntent: {
          summary: `Am Ziel ${target} bleibt die Umwelt-/Habitatbeobachtung im ausgewaehlten Zielgebiet.`,
          environment: waterLike ? 'Gewässerrand / Habitat' : 'Habitat / Vegetation',
          visibleIdeas: waterLike ? ['Gewaesserrand', 'Vegetationskante', 'ruhiger Naturkontext'] : ['Vegetationsmuster', 'Habitatkante', 'offenes Referenzgelaende'],
          avoid: ['keine technische Inspektionsstory', 'keine Einsatzlage', 'keine zufaellige Strassenmission'],
          densityHint: 'none',
          notes: 'Biologische Beobachtung ohne separate Supportszene.'
        },
        passenger: {
          name: 'Dr. Elena Kurz',
          role: 'Biologin',
          gender: 'female',
          personality: 'aufmerksam, sachlich, ruhig',
          dialectHint: 'neutral',
          roleProfile: 'science_field_v1',
          taskDomain: 'science_bio',
          gTolerance: 'mittel',
          bankTolerance: 'mittel',
          cargoSensitivity: 'mittel',
          stomachSensitivity: 'mittel',
          comfortPriority: 'hoch',
          urgencyPriority: 'niedrig',
          targetAltFt: 1900,
          targetRadiusNm: 3,
          targetDwellMin: 4,
          greetingText: `Hi, wir beobachten am Zielgebiet ${target} heute Umwelt- und Habitatmerkmale aus der Luft.`,
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
  if (formTaskDomain === 'cargo_fragile') {
    return {
      dispatchFormAck: {
        taskDomain: 'cargo_fragile',
        roleProfile: 'cargo_fragile_highcare_v1',
        missionType: 'apt'
      },
      title: `Empfindliche Fracht nach ${target}`,
      story: `Eine empfindliche Sendung muss sicher nach ${target}. Die Ladung bleibt im Stoßschutz-Case, daher zaehlen ruhige Fluglage, weiche Korrekturen und eine saubere Uebergabe am Vorfeld.`,
      pax: '1 PAX (Frachtbegleitung)',
      cargo: 'Präzisionsoptik im Stoßschutz-Case (28 lbs)',
      sceneIntent: {
        summary: 'A-B-Flug ohne Zielszene; die sichtbare Logik liegt in Fracht und Uebergabe am Ziel.',
        environment: 'leer',
        visibleIdeas: [],
        avoid: ['kein Vereinsauftrag', 'kein Sightseeing', 'keine Werkstattstory'],
        densityHint: 'none',
        notes: 'Fragile Fracht bleibt A-B-Kontext.'
      },
      passenger: {
        name: 'Ralf König',
        role: 'Frachtbegleiter',
        gender: 'male',
        personality: 'ruhig, organisiert, praezise',
        dialectHint: 'neutral',
        roleProfile: 'cargo_fragile_highcare_v1',
        taskDomain: 'cargo_fragile',
        gTolerance: 'mittel',
        bankTolerance: 'niedrig',
        cargoSensitivity: 'hoch',
        stomachSensitivity: 'mittel',
        comfortPriority: 'hoch',
        urgencyPriority: 'niedrig',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        greetingText: `Hi, die Fracht nach ${target} ist empfindlich; bitte ruhig fliegen und harte Manoever vermeiden.`,
        trainingPlan: null
      }
    };
  }
  if (formTaskDomain === 'sightseeing_tour') {
    return {
      dispatchFormAck: {
        taskDomain: 'sightseeing_tour',
        roleProfile: 'tour_guide_relaxed_v1',
        missionType: 'apt'
      },
      title: `Ausflug nach ${target}`,
      story: `Ein entspannter Ausflug fuehrt heute nach ${target}. Im Mittelpunkt stehen ein ruhiger Flug, angenehme Aussicht unterwegs und ein unkomplizierter Treffpunkt am Vorfeld nach der Landung.`,
      pax: '2 PAX (Sightseeing-Gäste)',
      cargo: 'Kleine Kamerataschen (12 lbs)',
      sceneIntent: {
        summary: 'A-B-Ausflug ohne Zielszene; am Zielflugplatz nur normale Abholung.',
        environment: 'leer',
        visibleIdeas: [],
        avoid: ['kein Vereinsauftrag', 'keine Ersatzteile', 'keine Frachtuebergabe'],
        densityHint: 'none',
        notes: 'Sightseeing bleibt passagiernah und locker.'
      },
      passenger: {
        name: 'Sophie Lang',
        role: 'Tour-Guide',
        gender: 'female',
        personality: 'freundlich, gelassen, kommunikativ',
        dialectHint: 'neutral',
        roleProfile: 'tour_guide_relaxed_v1',
        taskDomain: 'sightseeing_tour',
        gTolerance: 'niedrig',
        bankTolerance: 'niedrig',
        cargoSensitivity: 'niedrig',
        stomachSensitivity: 'hoch',
        comfortPriority: 'hoch',
        urgencyPriority: 'niedrig',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        greetingText: `Hi, heute geht es entspannt nach ${target}; ich freue mich auf einen ruhigen Ausflug und gute Aussicht.`,
        trainingPlan: null
      }
    };
  }
  if (formTaskDomain === 'news_coverage') {
    return {
      title: `Reporterflug nach ${target}`,
      story: `Eine Redaktion braucht einen ruhigen Transfer nach ${target}, damit vor Ort ein kurzer Beitrag vorbereitet werden kann. Kamera- und Audiotasche bleiben griffbereit, der Flug selbst bleibt ein sachlicher A-B-Transfer ohne Luftarbeitsauftrag.`,
      pax: '1 PAX (Reporter)',
      cargo: 'Kamera- und Audio-Set (32 lbs)',
      sceneIntent: {
        summary: 'A-B-Medientransfer ohne Zielszene.',
        environment: 'leer',
        visibleIdeas: [],
        avoid: ['kein Vereinsauftrag', 'kein Sightseeing'],
        densityHint: 'none',
        notes: 'Medienauftrag findet am Boden nach Ankunft statt.'
      },
      passenger: {
        name: 'Mara Feld',
        role: 'Reporterin',
        gender: 'female',
        personality: 'neugierig, sachlich, schnell',
        dialectHint: 'neutral',
        roleProfile: 'news_reporter_professional_v1',
        taskDomain: 'news_coverage',
        gTolerance: 'mittel',
        bankTolerance: 'mittel',
        cargoSensitivity: 'mittel',
        stomachSensitivity: 'mittel',
        comfortPriority: 'mittel',
        urgencyPriority: 'niedrig',
        targetAltFt: 0,
        targetRadiusNm: 0,
        targetDwellMin: 0,
        greetingText: `Hi, ich muss nach ${target} fuer einen sachlichen Beitrag am Boden; ein ruhiger Transfer reicht voellig.`,
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

function extractGeminiFunctionResponses(body = {}) {
  const contents = Array.isArray(body?.contents) ? body.contents : [];
  return contents
    .flatMap(content => Array.isArray(content?.parts) ? content.parts : [])
    .map(part => part?.functionResponse)
    .filter(Boolean);
}

function normalizePlannerV3ToolResult(value = {}) {
  if (value?.schema === 'missionPlannerV3.contextBundle.v1') return value;
  if (value?.result?.schema === 'missionPlannerV3.contextBundle.v1') return value.result;
  if (value?.response?.result?.schema === 'missionPlannerV3.contextBundle.v1') return value.response.result;
  return value?.result || value || {};
}

function buildPlannerV3Payload(prompt, toolResult = {}) {
  const draftRaw = extractTaggedBlock(prompt, 'DRAFT');
  let draft = {};
  try { draft = JSON.parse(draftRaw || '{}'); } catch (_) {}
  const bundle = normalizePlannerV3ToolResult(toolResult);
  const profile = bundle?.profile?.selected || draft.profile || {};
  const isAptTraining = draft.mode === 'apt' && draft.category === 'trn';
  const taskDomain = String(isAptTraining ? 'training' : (profile.taskDomain || draft.profile?.taskDomain || 'general')).toLowerCase();
  const roleProfile = String(isAptTraining ? 'instructor_calm_precise_v1' : (profile.roleProfile || draft.profile?.roleProfile || 'general_passenger_v1')).toLowerCase();
  const missionType = String(draft.mode || bundle?.route?.mode || 'apt').toLowerCase();
  const category = String(draft.category || bundle?.category || '').toLowerCase();
  const targetLabel = String(bundle?.target?.name || draft.target?.name || draft.route?.targetIcao || 'Zielgebiet').trim();
  const isMapping = taskDomain === 'mapping_survey';
  const isSar = taskDomain === 'search_and_rescue';
  const isFire = taskDomain === 'fire_watch' || category === 'fire';
  const isWater = ['water', 'dam'].includes(category) || (taskDomain === 'science_bio' && /water|ufer|gewaesser|see/i.test(`${targetLabel} ${bundle?.targetGeoContext?.summary || ''}`));
  const isInspection = taskDomain === 'inspection_infra';
  const sceneKind = isMapping ? 'construction_site' : (isSar ? 'sar_land' : (isFire ? 'fire_watch' : (isWater ? 'water_context' : 'none')));
  const sceneDensity = isMapping ? 'normal' : ((isSar || isFire || isWater || isInspection) ? 'sparse' : 'none');
  const objectFamilies = isMapping
    ? ['work_area', 'material_cluster', 'survey_reference']
    : (isSar
      ? ['ground_clue', 'small_equipment', 'signal_marker']
      : (isFire
        ? ['smoke_observation', 'forest_edge', 'orientation_marker']
        : (isWater ? ['shoreline', 'floating_debris', 'small_boat'] : [])));
  const requiredAnchors = missionType === 'poi'
    ? (isMapping
      ? ['work_area', 'access_track']
      : (isSar
        ? ['clearing_or_last_known_area']
        : (isFire
          ? ['forest_edge_or_smoke_point']
          : (isWater ? ['shoreline_or_bank'] : ['verified_target_point']))))
    : [];
  const weatherHooks = [
    bundle?.weather?.dep?.summary,
    bundle?.weather?.dest?.summary
  ]
    .map(v => String(v || '').replace(/\s+/g, ' ').trim())
    .filter(v => v && !/keine (aktuellen )?wetterdaten|nicht verfuegbar|nicht verfügbar|unbekannt/i.test(v))
    .slice(0, 3);
  const localFacts = [
    targetLabel ? `Zielbezug ist ${targetLabel}.` : '',
    bundle?.targetGeoContext?.summary ? `Umfeld: ${bundle.targetGeoContext.summary}` : '',
    Array.isArray(bundle?.targetGeoContext?.hints) ? bundle.targetGeoContext.hints[0] : '',
    bundle?.airportDetails?.start?.icao ? `Startflugplatz ist ${bundle.airportDetails.start.icao}.` : ''
  ].filter(Boolean).slice(0, 4);
  const operationalDetails = [
    missionType === 'poi' ? 'Start und Landung bleiben am Startflugplatz; am POI wird nicht gelandet.' : 'Normaler A-B-Streckenflug zum Zielflugplatz.',
    sceneKind !== 'none' ? 'Zielbeobachtung mit ruhigen, wiederholbaren Passes und klarer Aufgabenbegrenzung.' : 'Kein Zielobjekt-Spawn; Auftrag bleibt in Passagier/Fracht/Route verankert.'
  ];
  const primaryObjective = isMapping
    ? `Kartiere ${targetLabel} mit stabilen Fotopasses und klarer Abgrenzung der sichtbaren Arbeitsflaeche.`
    : (isSar
      ? `Suche bei ${targetLabel} nach einem kleinen, plausiblen Bodenhinweis.`
      : (isFire
        ? `Pruefe bei ${targetLabel} eine gemeldete schwache Rauchentwicklung ohne Grossbrand-Inszenierung.`
        : (isWater
          ? `Erstelle bei ${targetLabel} ein ruhiges Luftlagebild von Uferkante, Wasserlinie und sichtbaren Veraenderungen.`
          : `Fuehre den Auftrag nach ${targetLabel} mit klarer lokaler Begruendung durch.`)));
  return {
    status: 'ready',
    needs: [],
    plan: {
      taskDomain,
      roleProfile,
      missionType,
      targetCategory: category,
      primaryObjective,
      targetLabel,
      sceneKind,
      sceneDensity,
      requiredAnchors,
      objectFamilies,
      placementPolicy: missionType === 'poi'
        ? 'Sichtbare Kontextobjekte sparsam gruppieren; sie duerfen das Primaerziel nicht ersetzen oder den Auftrag schon geloest wirken lassen.'
        : 'Keine separate Zielszene fuer A-B-Fluege erzwingen.',
      narrativeRules: [
        'Story, Passenger, Cargo, sceneIntent und Zielkontext muessen dieselbe Lage beschreiben.',
        'Nur lokale Fakten aus Tool-Ergebnissen verwenden; bei schwachem Kontext allgemein bleiben.',
        'Wetter als Realitaetsanker verwenden, aber keine Gefahrenlage erfinden.'
      ],
      localFacts,
      weatherHooks,
      operationalDetails,
      realismBrief: localFacts.length
        ? `Der Auftrag ist glaubwuerdig, weil Zielart, Umgebung und Route als konkrete Einsatzanker vorliegen.`
        : `Der Auftrag bleibt bewusst allgemein, weil der Dryrun keine belastbaren Ortsfakten geliefert hat.`,
      narrativeHooks: [
        primaryObjective,
        weatherHooks[0] ? `Wetteranker: ${weatherHooks[0]}` : 'Wetter wird nur erwaehnt, wenn verwertbare Daten vorliegen.',
        missionType === 'poi' ? 'Nach kurzer Zielbeobachtung geht es zum Startflugplatz zurueck.' : 'Uebergabe oder Termin findet erst am Zielflugplatz statt.'
      ],
      mustMention: [targetLabel, missionType === 'poi' ? 'keine Landung am POI' : 'A-B-Flug'].filter(Boolean),
      mustAvoid: [
        'keine generische wichtige Mission ohne konkreten Anlass',
        'keine Actionfilm-Dramatik',
        missionType === 'poi' ? 'keinen anderen Primaerort erfinden' : 'keinen POI-Arbeitsauftrag erfinden'
      ],
      lockedFields: {
        taskDomain,
        roleProfile,
        targetName: targetLabel,
        noLandingAtPoi: missionType === 'poi'
      },
      confidence: localFacts.length ? 0.86 : 0.74
    }
  };
}

function normalizeScenePlannerV3ToolResult(value = {}) {
  if (value?.schema === 'scenePlannerV3.contextBundle.v1') return value;
  if (value?.result?.schema === 'scenePlannerV3.contextBundle.v1') return value.result;
  if (value?.response?.result?.schema === 'scenePlannerV3.contextBundle.v1') return value.response.result;
  return value?.result || value || {};
}

function buildScenePlannerV3Payload(prompt, toolResult = {}) {
  const bundle = normalizeScenePlannerV3ToolResult(toolResult);
  const mode = String(bundle?.mode || (/APT-Abhol|Uebergabeszene/i.test(prompt) ? 'apt' : 'poi')).toLowerCase();
  const plan = bundle?.missionPlanV2?.plan || bundle?.missionPlanV3?.plan || {};
  const mission = bundle?.mission || {};
  const taskDomain = String(mission.taskDomain || plan.taskDomain || '').toLowerCase();
  const targetName = String(bundle?.route?.targetName || plan.targetLabel || mission.targetName || 'Zielgebiet').trim();
  if (mode !== 'poi') {
    const base = bundle?.aptArrivalPlan || {};
    const combined = `${base.role || ''} ${base.roleLabel || ''} ${taskDomain} ${mission.title || ''}`.toLowerCase();
    const isMedical = /medical|medizin|patient|arzt/.test(combined);
    const isAnimal = /animal|tier|veterin/.test(combined);
    const isCargo = /cargo|fracht|fragile|box|liefer/.test(combined) || (!isMedical && !isAnimal);
    const preferredPlacement = base?.placementCandidates?.parking?.length
      ? { source: 'osm_parking_position', index: 0, reason: 'naechster sicherer Parking-Kandidat aus OSM-Kontext' }
      : (base?.placementCandidates?.apron?.length ? { source: 'osm_apron', index: 0, reason: 'sicherer Apron-Kandidat aus OSM-Kontext' } : undefined);
    const items = [
      {
        kind: 'arrival_vehicle',
        label: isMedical ? 'Medical-Van' : (isAnimal ? 'Tiertransport-Fahrzeug' : 'Fracht-Van'),
        role: isMedical ? 'vehicle.emergency.medical' : 'vehicle.van',
        forwardM: -9,
        rightM: 6,
        hdgOffsetDeg: 205
      },
      {
        kind: 'arrival_contact',
        label: isMedical ? 'medizinischer Kontakt' : (isAnimal ? 'Tierpflege-Kontakt' : 'Frachtkontakt'),
        role: 'person.ground_crew',
        forwardM: 2,
        rightM: 3,
        hdgOffsetDeg: 195
      }
    ];
    if (isCargo) {
      items.push({ kind: 'handoff_cargo', label: 'markierte Frachtbox', role: 'cargo.small_box', forwardM: 0, rightM: 5, hdgOffsetDeg: 185 });
    } else if (isMedical) {
      items.push({ kind: 'handoff_medical_kit', label: 'kleines Medical-Kit', role: 'cargo.medical_kit', forwardM: 1, rightM: 5, hdgOffsetDeg: 185 });
    } else if (isAnimal) {
      items.push({ kind: 'handoff_animal_box', label: 'gesicherte Transportbox', role: 'cargo.animal_transport_box', forwardM: 1, rightM: 5, hdgOffsetDeg: 185 });
    }
    return {
      status: 'ready',
      mode: 'apt',
      targetScene: { kind: 'none', roles: [], density: 'none', notes: 'APT-Szene wird ueber aptArrivalPlan lokalisiert.' },
      aptArrivalPlan: {
        roleLabel: base.roleLabel || (isMedical ? 'Medizinische Uebergabe' : (isAnimal ? 'Tiertransport-Uebergabe' : 'Frachtuebergabe')),
        expectedBy: base.expectedBy || (isMedical ? 'medizinischer Ansprechpartner am Vorfeld' : (isAnimal ? 'Bodenpersonal mit Transportbox' : 'Frachtkontakt am Vorfeld')),
        visibleCue: base.visibleCue || (isMedical ? 'Medical-Van neben dem sicheren Parking-Bereich' : (isAnimal ? 'Van und kleine Transportbox am Parking' : 'Fracht-Van und markierte Box am Parking')),
        narrativeHint: `${targetName}: Uebergabe bleibt am sicheren Vorfeld-/Parking-Anker und nicht auf Taxiway oder Runway.`,
        preferredPlacement,
        items
      },
      localizationNotes: ['APT targetScene bleibt none; sichtbare Objekte werden relativ zum Arrival-Anker gesetzt.'],
      validationNotes: ['Rollen/Objekte passen zum Uebergabeauftrag und bleiben sparsam.']
    };
  }

  const sceneKind = String(plan.sceneKind || '').toLowerCase();
  const isMapping = taskDomain === 'mapping_survey' || sceneKind === 'construction_site';
  const isSar = taskDomain === 'search_and_rescue' || sceneKind === 'sar_land' || sceneKind === 'sar_water';
  const isFire = taskDomain === 'fire_watch' || sceneKind === 'fire_watch';
  const isWater = sceneKind === 'water_context' || sceneKind === 'water_pollution' || /wasser|water|ufer|see|fluss/i.test(`${targetName} ${bundle?.targetGeoContext?.summary || ''}`);
  let targetScene;
  if (isMapping) {
    targetScene = {
      kind: 'construction_site',
      features: ['earthmoving', 'pallet_stack'],
      requirements: [
        { feature: 'earthmoving', count: 1, placement: 'Arbeitskante', arrangement: 'cluster', forwardM: 12, rightM: -10, notes: 'sichtbarer Bezug zur Kartierungsflaeche' },
        { feature: 'pallet_stack', count: 4, placement: 'Materiallager', arrangement: 'cluster', forwardM: -8, rightM: 14, notes: 'gebuendelter Referenzpunkt statt zufaelliger Deko' }
      ],
      density: 'normal',
      layout: 'cluster',
      notes: `Kartierungsziel ${targetName} mit klaren Arbeitsflaechen-Markern.`
    };
  } else if (isSar) {
    targetScene = {
      kind: sceneKind === 'sar_water' ? 'sar_water' : 'sar_land',
      features: ['small_equipment', 'signal_smoke'],
      requirements: [
        { feature: 'small_equipment', count: 1, placement: 'letzter Hinweis', arrangement: 'cluster', forwardM: 5, rightM: -7, notes: 'kleiner Suchhinweis als Primaerziel' },
        { feature: 'signal_smoke', count: 1, placement: 'sichtbarer Notmarker', arrangement: 'cluster', forwardM: 10, rightM: -11, notes: 'sparsame Orientierungshilfe' }
      ],
      density: 'sparse',
      layout: 'cluster',
      notes: `Suchhinweis bei ${targetName}, ohne den Auftrag bereits geloest wirken zu lassen.`
    };
  } else if (isFire) {
    targetScene = {
      kind: 'fire_watch',
      features: ['smoke_light'],
      requirements: [
        { feature: 'smoke_light', count: 1, placement: 'Waldkante', arrangement: 'cluster', forwardM: 14, rightM: -6, notes: 'leichte Rauchmarke, kein Grossbrand' }
      ],
      density: 'sparse',
      layout: 'cluster',
      notes: `Ruhige Rauchpruefung bei ${targetName}.`
    };
  } else if (isWater) {
    targetScene = {
      kind: 'water_context',
      features: ['watercraft'],
      requirements: [
        { feature: 'watercraft', count: 1, placement: 'Uferlinie', arrangement: 'waterline', forwardM: 6, rightM: -12, notes: 'kleines ziviles Boot als lokaler Wasser-Kontext' }
      ],
      density: 'sparse',
      layout: 'waterline',
      notes: `Wasser-/Uferbezug bei ${targetName} bleibt sparsam und beobachtbar.`
    };
  } else {
    targetScene = {
      kind: sceneKind && sceneKind !== 'none' ? sceneKind : 'survey_context',
      features: ['small_equipment'],
      requirements: [
        { feature: 'small_equipment', count: 1, placement: 'Zielanker', arrangement: 'cluster', forwardM: 4, rightM: 4, notes: 'kleiner sichtbarer Referenzpunkt' }
      ],
      density: 'sparse',
      layout: 'cluster',
      notes: `Sparsame Referenzszene fuer ${targetName}.`
    };
  }
  return {
    status: 'ready',
    mode: 'poi',
    targetScene,
    aptArrivalPlan: null,
    localizationNotes: ['requirements enthalten relative Offsets zum Zielanker.'],
    validationNotes: ['Missionstyp, Szene und sichtbare Features bleiben gekoppelt.']
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

function setupFetch(context, prompts, { liveGemini = false } = {}) {
  context.fetch = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('airports.json')) {
      return responseJson(JSON.parse(fs.readFileSync(path.join(root, 'airports.json'), 'utf8')));
    }
    if (href.includes('api.open-elevation.com')) return responseJson({ results: [{ elevation: 420 }] });
    if (
      href.includes('aviationweather.gov')
      && !href.includes('ga-proxy.einherjer.workers.dev/api/metar')
      && !href.includes('api.codetabs.com')
    ) return responseJson([]);
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
    if (href.includes('ga-proxy.einherjer.workers.dev/api/metar')) {
      const decodedHref = decodeURIComponent(href);
      const idMatch = decodedHref.match(/ids=([A-Z0-9]{4})/i);
      const station = (idMatch?.[1] || 'EDTW').toUpperCase();
      return responseJson({
        data: [{
          icaoId: station,
          rawOb: `${station} 231220Z 26008KT 9999 FEW030 17/08 Q1015`,
          wdir: 260,
          wspd: 8,
          temp: 17,
          wxString: '',
          fltCat: 'VFR',
          lat: 48.28,
          lon: 8.43
        }]
      });
    }
    if (href.includes('ga-proxy.einherjer.workers.dev') || href.includes('wikipedia.org') || href.includes('wikidata.org') || href.includes('nominatim.openstreetmap.org')) {
      return responseJson({ items: [], elements: [], query: { pages: {} } });
    }
    if (href.includes('generativelanguage.googleapis.com')) {
      const body = options?.body ? JSON.parse(options.body) : {};
      const prompt = body?.contents?.[0]?.parts?.[0]?.text || '';
      const isTts = Array.isArray(body?.generationConfig?.responseModalities) && body.generationConfig.responseModalities.includes('AUDIO');
      const functionResponses = extractGeminiFunctionResponses(body);
      const isScenePlannerV3 = /Scene Planner V3/i.test(prompt);
      const isPlannerV3 = /Mission Planner V3/i.test(prompt) || (Array.isArray(body?.tools) && !isScenePlannerV3);
      prompts.push({
        url: href,
        prompt,
        isScenePlannerV3,
        isPlannerV3,
        hasFunctionResponse: functionResponses.length > 0,
        live: !!liveGemini,
        functionResponses: functionResponses.map(r => ({ name: r?.name || '', keys: Object.keys(r?.response?.result || {}).slice(0, 10) }))
      });
      if (liveGemini) {
        const record = prompts[prompts.length - 1];
        try {
          const res = await globalThis.fetch(href, {
            method: options?.method || 'POST',
            headers: options?.headers || { 'Content-Type': 'application/json' },
            body: options?.body,
            signal: options?.signal
          });
          const text = await res.text();
          record.liveOk = !!res.ok;
          record.liveStatus = res.status;
          record.liveBodyExcerpt = text.replace(/\s+/g, ' ').slice(0, 1200);
          return responseText(text, res.ok, res.status);
        } catch (err) {
          record.liveOk = false;
          record.liveStatus = 0;
          record.liveError = err?.message || String(err || 'unknown live Gemini error');
          throw err;
        }
      }
      if (isTts) return responseJson({ candidates: [{ content: { parts: [{ inlineData: { data: '', mimeType: 'audio/wav' } }] } }] });
      if (isScenePlannerV3 && !functionResponses.length) {
        return responseJson({
          candidates: [{
            content: {
              role: 'model',
              parts: [{
                functionCall: {
                  name: 'get_scene_context_bundle',
                  args: { reason: 'Dryrun needs verified scene context before localizing POI/APT objects.' }
                }
              }]
            }
          }]
        });
      }
      if (isPlannerV3 && !functionResponses.length) {
        return responseJson({
          candidates: [{
            content: {
              role: 'model',
              parts: [{
                functionCall: {
                  name: 'get_mission_context_bundle',
                  args: { reason: 'Dryrun needs verified mission context before planning.' }
                }
              }]
            }
          }]
        });
      }
      if (isScenePlannerV3) {
        const text = JSON.stringify(buildScenePlannerV3Payload(prompt, functionResponses[0]?.response?.result || {}));
        return responseJson({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] });
      }
      if (isPlannerV3) {
        const text = JSON.stringify(buildPlannerV3Payload(prompt, functionResponses[0]?.response?.result || {}));
        return responseJson({ candidates: [{ content: { role: 'model', parts: [{ text }] } }] });
      }
      const text = body?.generationConfig?.response_mime_type === 'text/plain'
        ? buildSpokenText(prompt)
        : JSON.stringify(/Mission Planner V2/i.test(prompt) ? buildPlannerV2Payload(prompt) : (/Scene Composer/i.test(prompt) ? buildSceneAiPayload(prompt) : buildMissionAiPayload(prompt)));
      return responseJson({ candidates: [{ content: { parts: [{ text }] } }] });
    }
    return responseJson({}, false, 404);
  };
  context.window.fetch = context.fetch;
}

function setupContext(seed, { liveGemini = false } = {}) {
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
  setupFetch(context, prompts, { liveGemini });
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

function initUiForRun(context, targetType, { pipelineV2 = false, pipelineV3 = false, apiKey = 'DRYRUN_KEY' } = {}) {
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
    apiKeyInput: apiKey || 'DRYRUN_KEY'
  };
  for (const [id, value] of Object.entries(values)) el(id).value = value;
  el('aiToggle').checked = true;
  el('briefingBox').style.display = 'none';
  if (pipelineV2) context.localStorage.setItem('ga_debug_mission_pipeline_v2', 'true');
  if (pipelineV3) {
    context.localStorage.removeItem('ga_debug_mission_pipeline_legacy');
    context.localStorage.removeItem('ga_debug_mission_pipeline_v2');
    context.localStorage.setItem('ga_debug_mission_pipeline_v3_tools', 'true');
  }
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

function promptRecords(prompts) {
  return prompts.map((p, index) => ({
    index: index + 1,
    kind: p.isScenePlannerV3
      ? (p.hasFunctionResponse ? 'scene-planner-v3-final' : 'scene-planner-v3-tool-call')
      : (p.isPlannerV3
      ? (p.hasFunctionResponse ? 'mission-planner-v3-final' : 'mission-planner-v3-tool-call')
      : (/Mission Planner V2/i.test(p.prompt) ? 'mission-planner-v2' : (/Scene Composer|Scene Planner V3/i.test(p.prompt) ? 'scene-composer' : (/OUTPUT>/.test(p.prompt) ? 'mission-dispatcher' : 'pax-text')))),
    modelUrl: p.url.replace(/\?key=.*/, '?key=DRYRUN_KEY'),
    hasFunctionResponse: !!p.hasFunctionResponse,
    functionResponses: p.functionResponses || [],
    liveOk: p.liveOk,
    liveStatus: p.liveStatus,
    liveError: p.liveError,
    liveBodyExcerpt: p.liveBodyExcerpt,
    prompt: p.prompt,
    excerpt: p.prompt.replace(/\s+/g, ' ').slice(0, 700)
  }));
}

async function runOne({ seed, targetType, pipelineV2 = false, pipelineV3 = false, liveGemini = false, apiKey = 'DRYRUN_KEY' }) {
  const { context, prompts } = setupContext(seed, { liveGemini });
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
  initUiForRun(context, targetType, { pipelineV2, pipelineV3, apiKey });

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
    pipelineV3: false,
    liveGemini: false,
    out: 'mission-pipeline-dryrun-edtw.json'
  };
  for (const raw of argv) {
    const arg = String(raw || '').trim();
    if (arg === '--variants') args.variants = true;
    else if (arg === '--pipeline-v2') args.pipelineV2 = true;
    else if (arg === '--pipeline-v3') {
      args.pipelineV3 = true;
      args.pipelineV2 = false;
    }
    else if (arg === '--live-gemini') args.liveGemini = true;
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
      pipelineV2: !!args.pipelineV2,
      pipelineV3: !!args.pipelineV3,
      liveGemini: !!args.liveGemini
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
      pipelineV2: !!args.pipelineV2,
      pipelineV3: !!args.pipelineV3,
      liveGemini: !!args.liveGemini
    }));
  }
  const roll = stableRandom(args.seed)();
  const firstType = roll < 0.5 ? 'poi:water' : 'apt:club';
  return [
    { seed: args.seed, targetType: firstType, pipelineV2: !!args.pipelineV2, pipelineV3: !!args.pipelineV3, liveGemini: !!args.liveGemini },
    { seed: args.seed + 1, targetType: firstType.startsWith('poi') ? 'apt:club' : 'poi:water', pipelineV2: !!args.pipelineV2, pipelineV3: !!args.pipelineV3, liveGemini: !!args.liveGemini },
    { seed: args.seed + 2, targetType: 'poi:water', pipelineV2: !!args.pipelineV2, pipelineV3: !!args.pipelineV3, liveGemini: !!args.liveGemini }
  ].slice(0, args.runs);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (args.liveGemini && !apiKey) {
    throw new Error('GEMINI_API_KEY fehlt. Lege ihn lokal in .env.local oder als Umgebungsvariable ab.');
  }
  const roll = stableRandom(args.seed)();
  const runs = buildRunConfigs(args).map(cfg => ({ ...cfg, apiKey: args.liveGemini ? apiKey : 'DRYRUN_KEY' }));
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
      missionPipelineMode: md.missionPipelineMode || null,
      missionPipelineV2Enabled: (md.missionPipelineMode || '') === 'v2',
      missionPipelineV3Enabled: !!md.missionPlanV3,
      missionPlanV2: md.missionPlanV2 || null,
      missionPlanV3: md.missionPlanV3 || null,
      sceneStatus: md.sceneCompositionStatus,
      targetScene: md.targetScene,
      aptArrivalPlan: md.aptArrivalPlan || null,
      missionTruth: md.missionTruth || null,
      targetSceneComposerDebug: md.targetSceneComposerDebug || null,
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
