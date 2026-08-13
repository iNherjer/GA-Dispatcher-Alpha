'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CHECKLIST_LIBRARY_SCHEMA = 'ga.efb-checklist-library.v1';
const CHECKLIST_LIBRARY_VERSION = 1;
const MAX_CHECKLISTS = 40;
const MAX_SECTIONS = 20;
const MAX_ITEMS_PER_CHECKLIST = 300;
const MAX_LIBRARY_BYTES = 512 * 1024;

function cleanText(value, maxLength = 220) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanId(value, fallback, maxLength = 120) {
  const cleaned = String(value == null ? '' : value)
    .trim()
    .replace(/[^a-zA-Z0-9:_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
  return cleaned || fallback;
}

function normalizeChecklist(value, checklistIndex) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const checklistId = cleanId(source.id, `custom-${checklistIndex + 1}`);
  const rawSections = Array.isArray(source.sections)
    ? source.sections
    : (Array.isArray(source.chapters) ? source.chapters : []);
  const sections = [];
  let itemCount = 0;
  for (let sectionIndex = 0; sectionIndex < rawSections.length && sections.length < MAX_SECTIONS; sectionIndex += 1) {
    const rawSection = rawSections[sectionIndex] && typeof rawSections[sectionIndex] === 'object'
      ? rawSections[sectionIndex]
      : {};
    const sectionId = cleanId(rawSection.id, `section-${sectionIndex + 1}`);
    const items = [];
    for (const rawItem of (Array.isArray(rawSection.items) ? rawSection.items : [])) {
      if (itemCount >= MAX_ITEMS_PER_CHECKLIST) break;
      const itemSource = rawItem && typeof rawItem === 'object' ? rawItem : { text: rawItem };
      const text = cleanText(itemSource.text);
      if (!text) continue;
      items.push({
        id: cleanId(itemSource.id, `item-${itemCount + 1}`),
        text
      });
      itemCount += 1;
    }
    if (!items.length) continue;
    sections.push({
      id: sectionId,
      title: cleanText(rawSection.title, 80) || `Abschnitt ${sections.length + 1}`,
      items
    });
  }
  if (!sections.length) return null;
  return {
    id: checklistId,
    title: cleanText(source.title, 96) || 'Checkliste',
    source: 'custom',
    updatedAt: Math.max(0, Math.round(Number(source.updatedAt) || 0)),
    sections
  };
}

function emptyChecklistLibrary() {
  return {
    schema: CHECKLIST_LIBRARY_SCHEMA,
    version: CHECKLIST_LIBRARY_VERSION,
    revision: 0,
    updatedAt: 0,
    checklists: []
  };
}

function normalizeChecklistLibrary(value, options = {}) {
  let rawBytes = 0;
  try { rawBytes = Buffer.byteLength(JSON.stringify(value || {}), 'utf8'); } catch (_) {
    throw new Error('checklist_library_invalid');
  }
  if (rawBytes > MAX_LIBRARY_BYTES) throw new Error(`checklist_library_too_large:${rawBytes}`);
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const rawChecklists = Array.isArray(source.checklists) ? source.checklists : [];
  const checklists = [];
  const ids = new Set();
  for (let index = 0; index < rawChecklists.length && checklists.length < MAX_CHECKLISTS; index += 1) {
    const checklist = normalizeChecklist(rawChecklists[index], index);
    if (!checklist || ids.has(checklist.id)) continue;
    ids.add(checklist.id);
    checklists.push(checklist);
  }
  const now = typeof options.now === 'function' ? options.now() : Date.now();
  return {
    schema: CHECKLIST_LIBRARY_SCHEMA,
    version: CHECKLIST_LIBRARY_VERSION,
    revision: Math.max(0, Math.round(Number(source.revision) || 0)),
    updatedAt: Math.max(0, Math.round(Number(source.updatedAt) || now)),
    checklists
  };
}

function createTrackerEfbChecklistStore(options = {}) {
  const storageFile = String(options.storageFile || '').trim();
  const io = options.fs || fs;
  const now = typeof options.now === 'function' ? options.now : () => Date.now();
  const log = typeof options.log === 'function' ? options.log : () => {};
  let snapshot = emptyChecklistLibrary();

  function load() {
    if (!storageFile || !io.existsSync(storageFile)) return snapshot;
    try {
      const parsed = JSON.parse(io.readFileSync(storageFile, 'utf8'));
      snapshot = normalizeChecklistLibrary(parsed, { now });
      log(`EFB_CHECKLIST_LIBRARY_LOADED revision=${snapshot.revision} checklists=${snapshot.checklists.length}`);
    } catch (error) {
      snapshot = emptyChecklistLibrary();
      log(`EFB_CHECKLIST_LIBRARY_LOAD_ERROR error=${error?.message || error}`);
    }
    return snapshot;
  }

  function persist(value = snapshot) {
    if (!storageFile) return true;
    const temporaryFile = `${storageFile}.tmp`;
    try {
      io.mkdirSync(path.dirname(storageFile), { recursive: true });
      io.writeFileSync(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      io.renameSync(temporaryFile, storageFile);
      return true;
    } catch (error) {
      try { if (io.existsSync(temporaryFile)) io.unlinkSync(temporaryFile); } catch (_) {}
      log(`EFB_CHECKLIST_LIBRARY_PERSIST_ERROR error=${error?.message || error}`);
      return false;
    }
  }

  function store(value) {
    const candidate = normalizeChecklistLibrary(value, { now });
    const previousContent = JSON.stringify(snapshot.checklists);
    const nextContent = JSON.stringify(candidate.checklists);
    if (previousContent === nextContent) {
      return { ok: true, status: 'noop', snapshot };
    }
    const nextSnapshot = {
      ...candidate,
      revision: Math.max(snapshot.revision + 1, candidate.revision || 0, 1),
      updatedAt: now()
    };
    if (!persist(nextSnapshot)) return { ok: false, status: 'error', error: 'checklist_library_persist_failed', snapshot };
    snapshot = nextSnapshot;
    log(`EFB_CHECKLIST_LIBRARY_STORED revision=${snapshot.revision} checklists=${snapshot.checklists.length}`);
    return { ok: true, status: 'ok', snapshot };
  }

  load();
  return {
    getSnapshot() { return JSON.parse(JSON.stringify(snapshot)); },
    store
  };
}

module.exports = {
  CHECKLIST_LIBRARY_SCHEMA,
  CHECKLIST_LIBRARY_VERSION,
  MAX_CHECKLISTS,
  MAX_LIBRARY_BYTES,
  emptyChecklistLibrary,
  normalizeChecklistLibrary,
  createTrackerEfbChecklistStore
};
