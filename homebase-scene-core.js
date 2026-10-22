// Gemeinsamer Homebase-Szenenaufbau fuer Web-App und Tracker.
// Aus dem Cloud-Datensatz (record.plan) und dem Status des installierten
// Homebase-Mods entsteht die Live-Szene (Objekte, Personen, Navigation,
// Tuerzustaende) samt Signatur. Beide Seiten nutzen exakt diesen Code, damit
// sie dieselbe Szene und dieselbe Signatur erzeugen. Herausgeloest aus
// homebase-integration.js (22.10.2026), Verhalten unveraendert.
(function initHomebaseSceneCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GAHomebaseSceneCore = api;
})(typeof window !== 'undefined' ? window : null, function createHomebaseSceneCoreApi() {
  'use strict';

  const FALLBACK_SCHEMA_VERSION = 1;
  const OWN_ENTER_RADIUS_NM = 20;
  const OWN_EXIT_RADIUS_NM = 22;
  const OPEN_PARKING_TITLE = 'VFR Multitool Homebase Open Parking';

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function heading(value) {
    return ((finite(value) % 360) + 360) % 360;
  }

  function offsetLatLon(lat, lon, northM, eastM) {
    const radius = 6371000;
    const latRad = lat * Math.PI / 180;
    return {
      lat: lat + (northM / radius) * 180 / Math.PI,
      lon: lon + (eastM / (radius * Math.max(.05, Math.cos(latRad)))) * 180 / Math.PI
    };
  }

  function compactSceneSignature(serialized) {
    let hash = 2166136261;
    const text = String(serialized || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `hb1-${(hash >>> 0).toString(16).padStart(8, '0')}-${text.length}`;
  }

  function normalizeControlStates(raw) {
    return (Array.isArray(raw) ? raw : []).slice(0, 200).flatMap((entry) => {
      const instanceId = String(entry?.instanceId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      const title = String(entry?.title || '').trim().slice(0, 160);
      const controlId = String(entry?.controlId || '').trim().toLowerCase();
      const stateId = String(entry?.stateId ?? entry?.state ?? '').trim().toLowerCase();
      if (!instanceId || !title
        || !/^[a-z][a-z0-9_-]{0,31}$/.test(controlId)
        || !/^[a-z][a-z0-9_-]{0,31}$/.test(stateId)) return [];
      return [{ instanceId, title, controlId, stateId }];
    });
  }

  function angularDifference(left, right) {
    const difference = Math.abs(heading(left) - heading(right));
    return Math.min(difference, 360 - difference);
  }

  function sameCompiledPlacement(current, compiled) {
    return !!compiled
      && String(current?.title || '') === String(compiled?.title || compiled?.objectTitle || '')
      && Math.abs(finite(current?.lat) - finite(compiled?.lat)) <= 0.0000001
      && Math.abs(finite(current?.lon) - finite(compiled?.lon)) <= 0.0000001
      && Math.abs(finite(current?.altFt) - finite(compiled?.altFt)) <= 0.1
      && Math.abs(finite(current?.heightOffsetFt) - finite(compiled?.heightOffsetFt)) <= 0.02
      && angularDifference(current?.heading, compiled?.heading) <= 0.1
      && Math.abs(finite(current?.scale, 1) - finite(compiled?.scale, 1)) <= 0.005;
  }

  // catalog: HOMEBASE_ASSET_CATALOG der Workbench (homebase/homebase-asset-catalog.js)
  // oder eine Funktion, die ihn liefert (Browser: Skript wird vorher geladen).
  function createHomebaseSceneCore(options = {}) {
    const readCatalog = typeof options.catalog === 'function' ? options.catalog : () => options.catalog;

    function catalogDefinition(title) {
      const source = readCatalog();
      return [...(source?.assets || []), ...(source?.stockObjects || [])].find((entry) => entry.title === title) || null;
    }

    function normalizePersonTitle(rawTitle) {
      const source = readCatalog();
      const requested = String(rawTitle || '').trim();
      const migrated = source?.legacyPersonTitleAliases?.[requested] || requested;
      const allowed = Array.isArray(source?.tarmacPeople) ? source.tarmacPeople : [];
      const selected = allowed.find((entry) => entry.title === migrated) || allowed[0] || null;
      return String(selected?.title || '').trim();
    }

    function sanitizeRuntimeConfig(config) {
      if (!config || typeof config !== 'object') return null;
      const people = (Array.isArray(config.people) ? config.people : []).slice(0, 3).flatMap((person, index) => {
        const title = normalizePersonTitle(person?.title);
        if (!title) return [];
        return [{
          ...person,
          id: String(person?.id || `person-${index + 1}`),
          title,
          label: String(person?.label || `Mitarbeiter ${index + 1}`)
        }];
      });
      return { ...config, people, controlStates: normalizeControlStates(config.controlStates) };
    }

    function headingCorrection(title) {
      return finite(catalogDefinition(title)?.headingCorrectionDeg, 0);
    }

    function isPersistentOnlyObject(title) {
      return catalogDefinition(title)?.persistentOnly === true;
    }

    function isLiveSpawnableCrewObject(title) {
      const definition = catalogDefinition(title);
      return definition?.persistentOnly !== true
        && definition?.preview !== false
        && definition?.kind !== 'internal';
    }

    function navigationFootprint(title) {
      const footprint = catalogDefinition(title)?.footprint || readCatalog()?.navigationFootprints?.[title];
      return { widthM: Math.max(.1, finite(footprint?.widthM, 1)), depthM: Math.max(.1, finite(footprint?.depthM, 1)) };
    }

    function runtimeConfigFromPlan(plan) {
      if (!plan?.spawn || !plan?.hangar) return null;
      const spawn = plan.spawn;
      const hangar = plan.hangar;
      const spawnLat = finite(spawn.lat, NaN);
      const spawnLon = finite(spawn.lon, NaN);
      if (!Number.isFinite(spawnLat) || !Number.isFinite(spawnLon)) return null;
      const hangarPosition = offsetLatLon(spawnLat, spawnLon, finite(hangar.northM), finite(hangar.eastM));
      const primaryHangarZone = {
        id: 'hangar', northM: finite(hangar.northM), eastM: finite(hangar.eastM), heading: heading(hangar.heading),
        widthM: finite(hangar.widthM, 18), depthM: finite(hangar.depthM, 22),
        title: String(hangar.objectTitle || '')
      };
      const placedHangarZones = (Array.isArray(plan.objects) ? plan.objects : []).slice(0, 100).flatMap((item, index) => {
        if (catalogDefinition(item?.title)?.kind !== 'hangar') return [];
        const footprint = navigationFootprint(item?.title);
        const scale = Math.max(.1, Math.min(10, finite(item?.scale, 1)));
        return [{
          id: String(item?.id || `object-${index + 1}`), title: String(item?.title || ''),
          northM: finite(item?.northM), eastM: finite(item?.eastM), heading: heading(item?.heading),
          widthM: footprint.widthM * scale, depthM: footprint.depthM * scale
        }];
      });
      const hangarZones = [primaryHangarZone, ...placedHangarZones];
      const hangarWalls = (zone) => {
        const widthM = Math.max(4, finite(zone.widthM, 18));
        const depthM = Math.max(4, finite(zone.depthM, 22));
        const wallM = .3;
        const openingM = Math.min(widthM - 2, 5);
        const frontSegmentM = Math.max(.5, (widthM - openingM) / 2);
        const radians = heading(zone.heading) * Math.PI / 180;
        const place = (suffix, label, forwardM, rightM, segmentWidthM, segmentDepthM) => ({
          id: `${zone.id}-wall-${suffix}`, label, kind: zone.title === OPEN_PARKING_TITLE ? 'open-parking-wall' : 'hangar-wall',
          northM: finite(zone.northM) + Math.cos(radians) * forwardM - Math.sin(radians) * rightM,
          eastM: finite(zone.eastM) + Math.sin(radians) * forwardM + Math.cos(radians) * rightM,
          heading: heading(zone.heading), widthM: segmentWidthM, depthM: segmentDepthM, scale: 1
        });
        return [
          place('back', 'Hangarwand hinten', -depthM / 2, 0, widthM, wallM),
          place('left', 'Hangarwand links', 0, -widthM / 2, wallM, depthM),
          place('right', 'Hangarwand rechts', 0, widthM / 2, wallM, depthM),
          place('front-left', 'Hangarwand am Tor links', depthM / 2, -(openingM + frontSegmentM) / 2, frontSegmentM, wallM),
          place('front-right', 'Hangarwand am Tor rechts', depthM / 2, (openingM + frontSegmentM) / 2, frontSegmentM, wallM)
        ];
      };
      return {
        protocol: 2,
        name: 'VFR Multitool Homebase',
        doorAutomationEnabled: plan.doorAutomationEnabled !== false,
        spawn: {
          lat: spawnLat,
          lon: spawnLon,
          altFt: finite(spawn.altFt),
          heading: heading(spawn.heading),
          mode: 'airport_parking'
        },
        hangar: {
          lat: hangarPosition.lat,
          lon: hangarPosition.lon,
          altFt: finite(spawn.altFt) + finite(hangar.heightFt),
          heightOffsetFt: finite(hangar.heightFt),
          heading: heading(finite(hangar.heading) + headingCorrection(hangar.objectTitle)),
          widthM: finite(hangar.widthM, 18),
          depthM: finite(hangar.depthM, 22),
          objectTitle: String(hangar.objectTitle || '')
        },
        objects: (Array.isArray(plan.objects) ? plan.objects : []).slice(0, 100).map((item, index) => {
          const position = offsetLatLon(spawnLat, spawnLon, finite(item?.northM), finite(item?.eastM));
          return {
            id: String(item?.id || `object-${index + 1}`),
            title: String(item?.title || ''),
            label: String(item?.label || item?.title || `Objekt ${index + 1}`),
            lat: position.lat,
            lon: position.lon,
            altFt: finite(spawn.altFt) + finite(item?.heightFt),
            heightOffsetFt: finite(item?.heightFt),
            heading: heading(finite(item?.heading) + headingCorrection(item?.title)),
            scale: Math.max(.1, Math.min(10, finite(item?.scale, 1)))
          };
        }).filter((item) => item.title),
        people: (Array.isArray(plan.people) ? plan.people : []).slice(0, 3).map((person, index) => {
          const randomTargets = person?.randomTargets === true;
          const waitMinS = Math.max(0, Math.min(3600, finite(person?.randomWaitMinS, 5)));
          const waitMaxS = Math.max(0, Math.min(3600, finite(person?.randomWaitMaxS, 30)));
          const destinations = randomTargets
            ? (Array.isArray(plan.objects) ? plan.objects : []).slice(0, 100).flatMap((item, targetIndex) => {
                const targetId = String(item?.id || '').trim();
                if (!targetId) return [];
                return [{
                  id: `auto-${targetId || targetIndex + 1}`.slice(0, 64),
                  targetType: 'object', targetId, northM: 0, eastM: 0, waitMinS, waitMaxS
                }];
              })
            : (Array.isArray(person?.stops) ? person.stops : []).slice(0, 20).map((stop) => ({ ...stop }));
          return {
            id: String(person?.id || `person-${index + 1}`), title: normalizePersonTitle(person?.title),
            label: String(person?.label || `Mitarbeiter ${index + 1}`),
            startNorthM: finite(person?.startNorthM), startEastM: finite(person?.startEastM),
            speedKts: Math.max(1, Math.min(5, finite(person?.speedKts, 2.6))),
            targetMode: randomTargets ? 'all-objects' : 'manual',
            destinations
          };
        }).filter((person) => person.title),
        controlStates: normalizeControlStates(plan.controlStates),
        navigation: {
          spawn: { lat: spawnLat, lon: spawnLon, altFt: finite(spawn.altFt), heading: heading(spawn.heading) },
          hangar: primaryHangarZone,
          hangars: hangarZones,
          obstacles: [
            ...hangarZones.flatMap(hangarWalls),
            ...(Array.isArray(plan.objects) ? plan.objects : []).slice(0, 100).flatMap((item, index) => {
              if (catalogDefinition(item?.title)?.kind === 'hangar') return [];
              const footprint = navigationFootprint(item?.title);
              return [{
                id: String(item?.id || `object-${index + 1}`), label: String(item?.label || item?.title || 'Objekt'), kind: 'object',
                northM: finite(item?.northM), eastM: finite(item?.eastM), heading: heading(item?.heading),
                widthM: footprint.widthM, depthM: footprint.depthM, scale: Math.max(.1, Math.min(10, finite(item?.scale, 1)))
              }];
            })
          ]
        }
      };
    }

    function runtimeObjectsFromConfig(config) {
      if (config?.compileMode === 'spawn-only') return [];
      if (!config?.hangar) return [];
      const hangar = {
        id: 'hangar',
        title: String(config.hangar.objectTitle || config.hangar.title || ''),
        label: String(config.hangar.objectTitle || config.hangar.title || '') === OPEN_PARKING_TITLE ? 'Offener Parkbereich' : 'Homebase-Hangar',
        ...config.hangar,
        scale: 1
      };
      return [hangar, ...(Array.isArray(config.objects) ? config.objects : [])]
        .filter((item) => item?.title && !isPersistentOnlyObject(item.title));
    }

    // packageStatus: Antwort von homebase_v1.package.status
    // ({ sceneInstalled, snapshotTrusted, installedSnapshot: { config } }).
    function sceneDelta(config, packageStatus) {
      if (!config) return { ready: false, reason: 'no-plan', objects: [], stats: {} };
      const currentObjects = runtimeObjectsFromConfig(config);
      if (!packageStatus?.sceneInstalled) {
        return {
          ready: true,
          objects: currentObjects,
          stats: { compiled: 0, dynamic: currentObjects.length, newObjects: currentObjects.length, changedCompiled: 0, staleCompiled: 0 }
        };
      }
      const installedConfig = packageStatus.snapshotTrusted ? packageStatus.installedSnapshot?.config : null;
      if (!installedConfig) return { ready: false, reason: 'snapshot-missing', objects: [], stats: {} };
      const compiledObjects = runtimeObjectsFromConfig(installedConfig);
      const compiledById = new Map(compiledObjects.map((item) => [String(item.id || ''), item]));
      const currentIds = new Set(currentObjects.map((item) => String(item.id || '')));
      const dynamicObjects = [];
      let changedCompiled = 0;
      let newObjects = 0;
      for (const item of currentObjects) {
        const compiled = compiledById.get(String(item.id || ''));
        if (sameCompiledPlacement(item, compiled)) continue;
        dynamicObjects.push(item);
        if (compiled) changedCompiled += 1;
        else newObjects += 1;
      }
      const staleCompiled = compiledObjects.filter((item) => !currentIds.has(String(item.id || ''))).length;
      return {
        ready: true,
        objects: dynamicObjects,
        stats: { compiled: compiledObjects.length, dynamic: dynamicObjects.length, newObjects, changedCompiled, staleCompiled }
      };
    }

    // Gleiche Form wie homebase_v1.fallback.store (vor der Tracker-Normalisierung).
    function fallbackPayload(config, delta) {
      if (!config?.spawn || !delta?.ready) return null;
      const objects = delta.objects || [];
      const people = config.people || [];
      const navigation = config.navigation || null;
      const serializedScene = JSON.stringify({ objects, people, navigation });
      return {
        schemaVersion: FALLBACK_SCHEMA_VERSION,
        sceneSignature: compactSceneSignature(serializedScene),
        base: {
          lat: finite(config.spawn.lat),
          lon: finite(config.spawn.lon),
          enterRadiusNm: OWN_ENTER_RADIUS_NM,
          exitRadiusNm: OWN_EXIT_RADIUS_NM
        },
        doorAutomationEnabled: config.doorAutomationEnabled !== false,
        objects,
        people,
        navigation,
        controlStates: normalizeControlStates(config.controlStates)
      };
    }

    // Komplette Kette Cloud-Datensatz -> Live-Szene, wie die App sie ohne
    // offenen Workbench-Entwurf aufbaut.
    function sceneFromCloudRecord(record, packageStatus) {
      const plan = record?.plan || null;
      if (!plan) return { ok: false, reason: 'no-plan', payload: null, delta: null, config: null };
      const config = sanitizeRuntimeConfig(runtimeConfigFromPlan(plan));
      if (!config) return { ok: false, reason: 'plan-invalid', payload: null, delta: null, config: null };
      const delta = sceneDelta(config, packageStatus);
      if (!delta.ready) return { ok: false, reason: delta.reason || 'delta-not-ready', payload: null, delta, config };
      return { ok: true, reason: '', payload: fallbackPayload(config, delta), delta, config };
    }

    return {
      catalogDefinition,
      normalizePersonTitle,
      sanitizeRuntimeConfig,
      headingCorrection,
      isPersistentOnlyObject,
      isLiveSpawnableCrewObject,
      navigationFootprint,
      runtimeConfigFromPlan,
      runtimeObjectsFromConfig,
      sceneDelta,
      fallbackPayload,
      sceneFromCloudRecord
    };
  }

  return {
    FALLBACK_SCHEMA_VERSION,
    OWN_ENTER_RADIUS_NM,
    OWN_EXIT_RADIUS_NM,
    finite,
    heading,
    offsetLatLon,
    compactSceneSignature,
    normalizeControlStates,
    angularDifference,
    sameCompiledPlacement,
    createHomebaseSceneCore
  };
});
