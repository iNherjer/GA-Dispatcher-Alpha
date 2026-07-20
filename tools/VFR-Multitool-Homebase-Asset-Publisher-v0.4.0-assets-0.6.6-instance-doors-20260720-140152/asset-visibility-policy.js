(function publishHomebaseAssetVisibilityPolicy(root, factory) {
  const policy = factory();
  if (typeof module === 'object' && module.exports) module.exports = policy;
  if (root) root.HOMEBASE_ASSET_VISIBILITY_POLICY = policy;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createHomebaseAssetVisibilityPolicy() {
  'use strict';

  const SAFE_GLOBAL_LVAR = /^L:VFR_HOMEBASE_[A-Z0-9_]+$/;
  const SAFE_SIMOBJECT_VAR = /^(?:L:1:|Z:)VFR_HOMEBASE_[A-Z0-9_]+$/;

  function normalizeControlReference(raw = {}) {
    const scope = String(raw.scope || 'global').trim().toLowerCase();
    const simvar = String(raw.simvar || '').trim();
    if (!['global', 'simobject'].includes(scope)) {
      throw new Error(`Control-Scope muss global oder simobject sein: ${scope || '(leer)'}.`);
    }
    if (scope === 'global' && !SAFE_GLOBAL_LVAR.test(simvar)) {
      throw new Error(`Globale Controls benötigen eine LVar mit Präfix L:VFR_HOMEBASE_: ${simvar || '(leer)'}.`);
    }
    if (scope === 'simobject' && !SAFE_SIMOBJECT_VAR.test(simvar)) {
      throw new Error(`SimObject-Controls benötigen eine objektlokale Variable mit Präfix L:1:VFR_HOMEBASE_ oder Z:VFR_HOMEBASE_: ${simvar || '(leer)'}.`);
    }
    return { ...raw, simvar, scope };
  }

  function normalizeAssetEntry(raw = {}) {
    const controls = Array.isArray(raw.controls) ? raw.controls.map(normalizeControlReference) : raw.controls;
    const animation = raw.animation?.control
      ? { ...raw.animation, control: normalizeControlReference(raw.animation.control) }
      : raw.animation;
    return {
      ...raw,
      ...(Array.isArray(raw.controls) ? { controls } : {}),
      ...(raw.animation ? { animation } : {}),
      workbenchVisible: raw.homebasePlaceable !== false && raw.workbenchVisible !== false
    };
  }

  function normalizeAssetCatalog(raw = {}) {
    return {
      ...raw,
      assets: Array.isArray(raw.assets) ? raw.assets.map(normalizeAssetEntry) : [],
      stockObjects: Array.isArray(raw.stockObjects) ? raw.stockObjects.map(normalizeAssetEntry) : []
    };
  }

  function normalizeRemoteAssetIndex(raw = {}) {
    return normalizeAssetCatalog(raw);
  }

  function normalizeFootprint(raw = {}) {
    const widthM = Number(raw.widthM);
    const depthM = Number(raw.depthM);
    if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM < 1 || widthM > 200 || depthM < 1 || depthM > 200) return null;
    return { ...raw, widthM, depthM };
  }

  function assetIdentity(entry = {}) {
    return String(entry.key || entry.title || '').trim().toLowerCase();
  }

  function mergeAssetEntries(baseEntries, runtimeEntries) {
    const merged = new Map();
    for (const entry of Array.isArray(baseEntries) ? baseEntries : []) {
      const normalized = normalizeAssetEntry(entry);
      const identity = assetIdentity(normalized);
      if (identity) merged.set(identity, normalized);
    }
    for (const entry of Array.isArray(runtimeEntries) ? runtimeEntries : []) {
      const normalized = normalizeAssetEntry(entry);
      const identity = assetIdentity(normalized);
      if (!identity) continue;
      merged.set(identity, normalizeAssetEntry({ ...(merged.get(identity) || {}), ...normalized }));
    }
    return [...merged.values()];
  }

  function mergeRuntimeAssetCatalog(baseCatalog, runtimeCatalog) {
    const base = normalizeAssetCatalog(baseCatalog);
    const runtime = normalizeAssetCatalog(runtimeCatalog);
    return {
      ...base,
      ...runtime,
      assets: mergeAssetEntries(base.assets, runtime.assets),
      stockObjects: mergeAssetEntries(base.stockObjects, runtime.stockObjects)
    };
  }

  function resolveStoredCatalogEntry(entries, rawTitle, aliases = {}) {
    const title = aliases[String(rawTitle || '')] || String(rawTitle || '');
    const entry = (Array.isArray(entries) ? entries : []).map(normalizeAssetEntry)
      .find((candidate) => candidate.title === title);
    return { entry, title: entry?.title || title };
  }

  function isWorkbenchVisible(entry) {
    return normalizeAssetEntry(entry).workbenchVisible;
  }

  return Object.freeze({
    normalizeControlReference,
    normalizeAssetEntry,
    normalizeAssetCatalog,
    normalizeRemoteAssetIndex,
    normalizeFootprint,
    mergeAssetEntries,
    mergeRuntimeAssetCatalog,
    resolveStoredCatalogEntry,
    isWorkbenchVisible
  });
}));
