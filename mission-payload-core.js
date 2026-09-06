(function (root, factory) {
    'use strict';
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.GAMissionPayloadCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    var CORE_VERSION = 1;
    var CORE_SCHEMA = 'ga.mission-payload-core.v1';
    var PA24_ADAPTER = 'pa24_accusim';
    var PA24_BAGGAGE_MAX_LBS = 200;
    var PA24_SEAT_MAX_LBS = 300;
    var PAYLOAD_SYNC_DEBOUNCE_MS = 500;
    var PAYLOAD_SYNC_MAX_WAIT_MS = 2000;

    function isPassengerItem(item, options) {
        if (options && typeof options.isPassengerItem === 'function') return options.isPassengerItem(item);
        return !!item && typeof item === 'object' && String(item.itemType || '').toLowerCase() === 'passenger';
    }

    function fallbackPaxCount(options) {
        var value = Number(options && options.fallbackPaxCount);
        return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
    }

    function fallbackPaxWeightLbs(options) {
        var value = Number(options && options.fallbackPaxWeightLbs);
        return Number.isFinite(value) && value > 0 ? value : 180;
    }

    function normalizeSnapshot(snapshot, options) {
        var raw = snapshot && typeof snapshot === 'object' ? snapshot : null;
        if (!raw) return null;
        var rawCount = raw.payloadStationCount != null
            ? raw.payloadStationCount
            : (raw.sampledStationCount != null
                ? raw.sampledStationCount
                : (Array.isArray(raw.stations) ? raw.stations.length : 0));
        var stationCount = Math.max(1, Math.min(20, Math.round(Number(rawCount || 0))));
        if (!Number.isFinite(stationCount) || stationCount < 1) return null;
        var byIndex = new Map();
        var inputStations = Array.isArray(raw.stations) ? raw.stations : [];
        inputStations.forEach(function (row) {
            var idx = Math.round(Number(row && row.index));
            var weight = Number(row && row.weightLbs);
            if (!Number.isFinite(idx) || idx < 1 || idx > stationCount) return;
            byIndex.set(idx, Number.isFinite(weight) ? Math.max(0, weight) : 0);
        });
        var stations = [];
        for (var index = 1; index <= stationCount; index += 1) {
            stations.push({ index: index, weightLbs: Math.round(Number(byIndex.get(index) || 0) * 10) / 10 });
        }
        var pa24Raw = raw.pa24 && typeof raw.pa24 === 'object' ? raw.pa24 : null;
        var pa24Seats = pa24Raw && pa24Raw.seats && typeof pa24Raw.seats === 'object' ? pa24Raw.seats : {};
        var pa24Weights = pa24Raw && pa24Raw.characterWeights && typeof pa24Raw.characterWeights === 'object'
            ? pa24Raw.characterWeights
            : {};
        var pa24 = pa24Raw ? {
            seats: {
                1: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[1] != null ? pa24Seats[1] : 0) || 0))),
                2: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[2] != null ? pa24Seats[2] : 0) || 0))),
                3: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[3] != null ? pa24Seats[3] : 0) || 0))),
                4: Math.max(0, Math.min(4, Math.round(Number(pa24Seats[4] != null ? pa24Seats[4] : 0) || 0)))
            },
            characterWeights: {
                1: Math.max(0, Number(pa24Weights[1] != null ? pa24Weights[1] : 0) || 0),
                2: Math.max(0, Number(pa24Weights[2] != null ? pa24Weights[2] : 0) || 0),
                3: Math.max(0, Number(pa24Weights[3] != null ? pa24Weights[3] : 0) || 0),
                4: Math.max(0, Number(pa24Weights[4] != null ? pa24Weights[4] : 0) || 0)
            },
            baggageWeightLbs: Math.max(0, Number(pa24Raw.baggageWeightLbs || 0)),
            baggageAWeightLbs: Math.max(0, Number(pa24Raw.baggageAWeightLbs || 0)),
            baggageBWeightLbs: Math.max(0, Number(pa24Raw.baggageBWeightLbs || 0)),
            baggageCWeightLbs: Math.max(0, Number(pa24Raw.baggageCWeightLbs || 0)),
            payloadWeightLbs: Number.isFinite(Number(pa24Raw.payloadWeightLbs)) ? Number(pa24Raw.payloadWeightLbs) : null,
            totalWeightLbs: Number.isFinite(Number(pa24Raw.totalWeightLbs)) ? Number(pa24Raw.totalWeightLbs) : null,
            grossWeightLbs: Number.isFinite(Number(pa24Raw.grossWeightLbs)) ? Number(pa24Raw.grossWeightLbs) : null,
            emptyWeightLbs: Number.isFinite(Number(pa24Raw.emptyWeightLbs)) ? Number(pa24Raw.emptyWeightLbs) : null
        } : null;
        var optionFuel = options && options.fuelWeightLbs;
        var rawFuel = raw.fuelWeightLbs != null ? raw.fuelWeightLbs : optionFuel;
        return {
            payloadAdapter: String(raw.payloadAdapter || 'msfs_payload_stations'),
            aircraft: raw.aircraft && typeof raw.aircraft === 'object' ? Object.assign({}, raw.aircraft) : null,
            pa24: pa24,
            totalWeightLbs: Number.isFinite(Number(raw.totalWeightLbs)) ? Number(raw.totalWeightLbs) : null,
            emptyWeightLbs: Number.isFinite(Number(raw.emptyWeightLbs)) ? Number(raw.emptyWeightLbs) : null,
            fuelWeightLbs: Number.isFinite(Number(rawFuel)) ? Number(rawFuel) : null,
            payloadWeightLbs: Number.isFinite(Number(raw.payloadWeightLbs)) ? Number(raw.payloadWeightLbs) : null,
            payloadStationCount: stationCount,
            sampledStationCount: Math.max(stationCount, Math.min(20, Math.round(Number(raw.sampledStationCount || stationCount)))),
            stations: stations
        };
    }

    function buildLayout(snapshot) {
        var count = Math.max(1, Math.min(20, Math.round(Number(snapshot && snapshot.payloadStationCount != null ? snapshot.payloadStationCount : 1) || 1)));
        var allIndices = Array.from({ length: count }, function (_, idx) { return idx + 1; });
        var pilotIndex = 1;
        var copilotIndex = count >= 2 ? 2 : 1;
        var rearSeatIndices = count >= 4 ? [3, 4] : (count === 3 ? [3] : []);
        var cargoIndices = count >= 5 ? allIndices.slice(4) : [];
        return { count: count, allIndices: allIndices, pilotIndex: pilotIndex, copilotIndex: copilotIndex, rearSeatIndices: rearSeatIndices, cargoIndices: cargoIndices };
    }

    function itemIsBulky(item) {
        var weight = Number(item && item.weightLbs || 0);
        var text = String((item && item.label || '') + ' ' + (item && item.storyName || '') + ' ' + (item && item.objectTitle || '')).toLowerCase();
        if (weight >= 35) return true;
        return /(palette|pallet|kiste|sperrig|gross|box|netz|gurt|container|transport)/i.test(text);
    }

    function allocateWeightToStations(map, stationIndices, totalWeightLbs, splitAcross) {
        var weight = Math.max(0, Number(totalWeightLbs) || 0);
        var slots = Array.from(new Set((Array.isArray(stationIndices) ? stationIndices : [])
            .map(function (value) { return Math.round(Number(value)); })
            .filter(function (value) { return Number.isFinite(value) && value >= 1; })));
        if (!weight || !slots.length) return [];
        var split = Math.max(1, Math.min(slots.length, Math.round(Number(splitAcross) || 1)));
        var chosen = slots.slice(0, split);
        var unit = weight / chosen.length;
        chosen.forEach(function (idx) {
            map.set(idx, Number(map.get(idx) || 0) + unit);
        });
        return chosen;
    }

    function buildMissionExtraPlan(manifest, layout, options) {
        options = options && typeof options === 'object' ? options : {};
        var missionByStation = new Map();
        var assignments = [];
        var persistentOnly = options.persistentOnly === true;
        var manifestItems = Array.isArray(manifest && manifest.items) ? manifest.items : [];
        var passengerItems = persistentOnly
            ? []
            : manifestItems.filter(function (item) { return isPassengerItem(item, options) && item.status === 'loaded'; });
        var paxTotalLbs = passengerItems.reduce(function (sum, item) { return sum + Math.max(0, Number(item.weightLbs || 0)); }, 0);
        var paxCount = passengerItems.reduce(function (sum, item) { return sum + Math.max(0, Math.round(Number(item.passengerCount) || 1)); }, 0);
        if (paxTotalLbs <= 0) {
            var fallbackCount = fallbackPaxCount(options);
            if (fallbackCount > 0) {
                paxCount = fallbackCount;
                paxTotalLbs = fallbackCount * fallbackPaxWeightLbs(options);
            }
        }
        if (paxTotalLbs > 0) {
            var paxStations = [layout.copilotIndex].concat(layout.rearSeatIndices);
            var paxSplit = Math.max(1, Math.min(1 + layout.rearSeatIndices.length, paxCount || 1));
            allocateWeightToStations(missionByStation, paxStations, paxTotalLbs, paxSplit);
            assignments.push({
                type: 'pax',
                label: paxCount > 1 ? paxCount + ' Passagiere' : 'Passagier',
                weightLbs: Math.round(paxTotalLbs),
                stations: paxStations.slice(0, paxSplit)
            });
        }

        var loadedItems = manifestItems
            .filter(function (item) { return item.status === 'loaded' && !isPassengerItem(item, options); })
            .filter(function (item) { return options.excludePersistent !== true || item.persistentEquipment !== true; })
            .filter(function (item) { return !persistentOnly || item.persistentEquipment === true; })
            .filter(function (item) { return options.includeInheritedPersistent === true || item.persistentEquipmentInherited !== true; });
        var allNonPilotIndices = layout.allIndices.filter(function (idx) { return idx !== layout.pilotIndex; });
        var cargoPrimary = layout.cargoIndices.length ? layout.cargoIndices : (layout.rearSeatIndices.length ? layout.rearSeatIndices : allNonPilotIndices);
        var nonCopilotCargo = cargoPrimary.filter(function (idx) { return idx !== layout.copilotIndex; });
        var cargoFallback = nonCopilotCargo.length ? nonCopilotCargo : cargoPrimary;
        loadedItems.forEach(function (item) {
            var itemWeight = Math.max(0, Number(item && item.weightLbs || 0));
            if (!itemWeight) return;
            var bulky = itemIsBulky(item);
            var prefersRear = bulky && layout.rearSeatIndices.length > 0;
            var candidateSlots = prefersRear
                ? layout.rearSeatIndices
                : (cargoFallback.length ? cargoFallback : allNonPilotIndices);
            var splitAcross = prefersRear && candidateSlots.length >= 2 ? 2 : 1;
            var usedStations = allocateWeightToStations(missionByStation, candidateSlots, itemWeight, splitAcross);
            assignments.push({
                type: 'cargo',
                itemId: item.id,
                label: item.storyName || item.label || item.id || 'Cargo',
                weightLbs: Math.round(itemWeight),
                bulky: bulky,
                stations: usedStations
            });
        });
        return {
            missionByStation: missionByStation,
            assignments: assignments,
            loadedItems: loadedItems,
            paxCount: paxCount,
            paxTotalLbs: paxTotalLbs
        };
    }

    function pa24StateFromSnapshot(snapshot, options) {
        var normalized = normalizeSnapshot(snapshot, options);
        if (!normalized || normalized.payloadAdapter !== PA24_ADAPTER || !normalized.pa24) return null;
        return {
            seats: {
                2: Number(normalized.pa24.seats && normalized.pa24.seats[2] || 0),
                3: Number(normalized.pa24.seats && normalized.pa24.seats[3] || 0),
                4: Number(normalized.pa24.seats && normalized.pa24.seats[4] || 0)
            },
            characterWeights: {
                2: Number(normalized.pa24.characterWeights && normalized.pa24.characterWeights[2] || 0),
                3: Number(normalized.pa24.characterWeights && normalized.pa24.characterWeights[3] || 0),
                4: Number(normalized.pa24.characterWeights && normalized.pa24.characterWeights[4] || 0)
            },
            baggageWeightLbs: Math.round(Math.max(0, Number(normalized.pa24.baggageWeightLbs || 0)) * 10) / 10
        };
    }

    function buildPa24PlanFromManifest(manifest, baseline, options) {
        options = options && typeof options === 'object' ? options : {};
        var snapshot = normalizeSnapshot(baseline, options);
        var baselineState = pa24StateFromSnapshot(snapshot, options);
        if (!snapshot || !baselineState) return null;

        var persistentOnly = options.persistentOnly === true;
        var state = JSON.parse(JSON.stringify(baselineState));
        var assignments = [];
        var occupiedSeats = new Set();
        var occupiedCharacters = new Set();
        var changedSeats = new Set();
        [2, 3, 4].forEach(function (seat) {
            var character = Math.round(Number(state.seats[seat] || 0));
            // Accu-Sim keeps the selected character in an empty seat.  The
            // selector alone is therefore not an occupied seat; only a
            // selected character with an actual payload weight reserves it.
            // Treating every non-zero selector as a passenger made a fresh
            // Comanche manifest report pa24_no_free_seat despite no person
            // being on board.
            var characterWeight = Number(state.characterWeights[character] || 0);
            if (character > 0 && Number.isFinite(characterWeight) && characterWeight > 0.05) {
                occupiedSeats.add(seat);
                occupiedCharacters.add(character);
            }
        });

        function assignSeat(seat, weightLbs, assignment) {
            var weight = Math.round(Math.max(0, Number(weightLbs || 0)) * 10) / 10;
            if (!Number.isFinite(seat) || occupiedSeats.has(seat)) return { ok: false, error: 'pa24_no_free_seat' };
            if (!weight || weight > PA24_SEAT_MAX_LBS) return { ok: false, error: 'pa24_seat_weight_exceeded' };
            var preferredCharacter = seat;
            var character = !occupiedCharacters.has(preferredCharacter)
                ? preferredCharacter
                : [2, 3, 4].find(function (candidate) { return !occupiedCharacters.has(candidate); });
            if (!Number.isFinite(character)) return { ok: false, error: 'pa24_no_free_character' };
            state.seats[seat] = character;
            state.characterWeights[character] = weight;
            occupiedSeats.add(seat);
            occupiedCharacters.add(character);
            changedSeats.add(seat);
            assignments.push(Object.assign({}, assignment || {}, {
                weightLbs: weight,
                stations: [seat],
                seat: seat,
                character: character
            }));
            return { ok: true, seat: seat, character: character, weightLbs: weight };
        }

        var manifestItems = Array.isArray(manifest && manifest.items) ? manifest.items : [];
        var passengerItems = persistentOnly
            ? []
            : manifestItems.filter(function (item) { return isPassengerItem(item, options) && item.status === 'loaded'; });
        var paxCount = passengerItems.reduce(function (sum, item) {
            return sum + Math.max(1, Math.round(Number(item.passengerCount) || 1));
        }, 0);
        var paxTotalLbs = passengerItems.reduce(function (sum, item) { return sum + Math.max(0, Number(item.weightLbs || 0)); }, 0);
        if (!persistentOnly && paxTotalLbs <= 0) {
            var fallbackCount = fallbackPaxCount(options);
            if (fallbackCount > 0) {
                paxCount = fallbackCount;
                paxTotalLbs = fallbackCount * fallbackPaxWeightLbs(options);
            }
        }
        if (paxCount > 0) {
            var unitWeight = paxTotalLbs / paxCount;
            for (var paxIndex = 0; paxIndex < paxCount; paxIndex += 1) {
                var seat = [2, 3, 4].find(function (candidate) { return !occupiedSeats.has(candidate); });
                var paxResult = assignSeat(seat, unitWeight, {
                    type: 'pax',
                    label: paxCount > 1 ? 'Passagier ' + (paxIndex + 1) : 'Passagier'
                });
                if (!paxResult.ok) return { payloadAdapter: PA24_ADAPTER, error: paxResult.error, assignments: assignments };
            }
        }

        var loadedItems = manifestItems
            .filter(function (item) { return item.status === 'loaded' && !isPassengerItem(item, options); })
            .filter(function (item) { return options.excludePersistent !== true || item.persistentEquipment !== true; })
            .filter(function (item) { return !persistentOnly || item.persistentEquipment === true; })
            .filter(function (item) { return options.includeInheritedPersistent === true || item.persistentEquipmentInherited !== true; });
        var baggageTargetLbs = Number(state.baggageWeightLbs || 0);
        for (var itemIndex = 0; itemIndex < loadedItems.length; itemIndex += 1) {
            var item = loadedItems[itemIndex];
            var itemWeight = Math.round(Math.max(0, Number(item && item.weightLbs || 0)) * 10) / 10;
            if (!itemWeight) continue;
            var bulky = itemIsBulky(item);
            if (!bulky && baggageTargetLbs + itemWeight <= PA24_BAGGAGE_MAX_LBS) {
                baggageTargetLbs += itemWeight;
                assignments.push({
                    type: 'cargo',
                    itemId: item.id,
                    label: item.storyName || item.label || item.id || 'Cargo',
                    weightLbs: itemWeight,
                    bulky: false,
                    stations: [5],
                    baggage: true
                });
                continue;
            }
            var cargoSeat = [4, 3, 2].find(function (candidate) { return !occupiedSeats.has(candidate); });
            var cargoResult = assignSeat(cargoSeat, itemWeight, {
                type: 'cargo',
                itemId: item.id,
                label: item.storyName || item.label || item.id || 'Cargo',
                bulky: bulky,
                baggage: false
            });
            if (!cargoResult.ok) return { payloadAdapter: PA24_ADAPTER, error: cargoResult.error, assignments: assignments };
        }
        state.baggageWeightLbs = Math.round(baggageTargetLbs * 10) / 10;

        var missionCargoWeightLbs = loadedItems.reduce(function (sum, item) { return sum + Math.max(0, Number(item.weightLbs || 0)); }, 0);
        var missionWeightLbs = Math.round((paxTotalLbs + missionCargoWeightLbs) * 10) / 10;
        var targetTotalWeightLbs = Number.isFinite(Number(snapshot.totalWeightLbs))
            ? Number(snapshot.totalWeightLbs) + missionWeightLbs
            : null;
        var grossWeightLbs = Number(snapshot.pa24 && snapshot.pa24.grossWeightLbs);
        if (Number.isFinite(targetTotalWeightLbs) && Number.isFinite(grossWeightLbs) && grossWeightLbs > 0 && targetTotalWeightLbs > grossWeightLbs + 0.5) {
            return {
                payloadAdapter: PA24_ADAPTER,
                error: 'pa24_gross_weight_exceeded',
                targetTotalWeightLbs: targetTotalWeightLbs,
                grossWeightLbs: grossWeightLbs,
                assignments: assignments
            };
        }

        var baselineByStation = new Map(snapshot.stations.map(function (row) { return [Number(row.index), Number(row.weightLbs || 0)]; }));
        var stationTargets = [2, 3, 4, 5].map(function (index) {
            var targetWeight = Number(baselineByStation.get(index) || 0);
            if (index >= 2 && index <= 4 && changedSeats.has(index) && Number(state.seats[index] || 0) > 0) {
                targetWeight = Number(state.characterWeights[state.seats[index]] || 0);
            }
            if (index === 5) targetWeight = state.baggageWeightLbs;
            var baselineWeight = Number(baselineByStation.get(index) || 0);
            return {
                index: index,
                baselineWeightLbs: Math.round(baselineWeight * 10) / 10,
                missionExtraLbs: Math.round((targetWeight - baselineWeight) * 10) / 10,
                weightLbs: Math.round(targetWeight * 10) / 10
            };
        });
        return {
            payloadAdapter: PA24_ADAPTER,
            snapshot: snapshot,
            layout: buildLayout(snapshot),
            stations: stationTargets,
            pa24State: state,
            pa24BaselineState: baselineState,
            assignments: assignments,
            boardedPaxCount: paxCount,
            paxWeightLbs: Math.round(paxTotalLbs * 10) / 10,
            cargoWeightLbs: Math.round(missionCargoWeightLbs * 10) / 10,
            missionWeightLbs: missionWeightLbs,
            payloadWeightLbs: Number.isFinite(Number(snapshot.payloadWeightLbs))
                ? Math.round((Number(snapshot.payloadWeightLbs) + missionWeightLbs) * 10) / 10
                : null,
            targetTotalWeightLbs: targetTotalWeightLbs,
            grossWeightLbs: Number.isFinite(grossWeightLbs) ? grossWeightLbs : null
        };
    }

    function buildPlanFromManifest(manifest, baseline, options) {
        options = options && typeof options === 'object' ? options : {};
        var snapshot = normalizeSnapshot(baseline, options);
        if (!snapshot) return null;
        if (snapshot.payloadAdapter === PA24_ADAPTER) return buildPa24PlanFromManifest(manifest, snapshot, options);
        var layout = buildLayout(snapshot);
        var missionPlan = buildMissionExtraPlan(manifest, layout, options);
        var missionByStation = missionPlan.missionByStation;
        var assignments = missionPlan.assignments;
        var loadedItems = missionPlan.loadedItems;
        var stations = snapshot.stations.map(function (row) {
            var missionExtra = Number(missionByStation.get(row.index) || 0);
            var baselineWeight = Number(row.weightLbs || 0);
            var targetWeight = Math.max(0, baselineWeight + missionExtra);
            return {
                index: row.index,
                baselineWeightLbs: Math.round(baselineWeight * 10) / 10,
                missionExtraLbs: Math.round(missionExtra * 10) / 10,
                weightLbs: Math.round(targetWeight * 10) / 10
            };
        });
        var payloadWeightLbs = stations.reduce(function (sum, row) { return sum + Number(row.weightLbs || 0); }, 0);
        return {
            snapshot: snapshot,
            layout: layout,
            stations: stations,
            assignments: assignments,
            boardedPaxCount: missionPlan.paxCount,
            paxWeightLbs: Math.round(missionPlan.paxTotalLbs),
            cargoWeightLbs: Math.round(loadedItems.reduce(function (sum, item) { return sum + Number(item.weightLbs || 0); }, 0)),
            missionWeightLbs: Math.round(stations.reduce(function (sum, row) { return sum + Number(row.missionExtraLbs || 0); }, 0)),
            payloadWeightLbs: Math.round(payloadWeightLbs * 10) / 10
        };
    }

    function estimateResetStationsFromSnapshot(manifest, snapshot, options) {
        options = options && typeof options === 'object' ? options : {};
        var normalized = normalizeSnapshot(snapshot, options);
        if (!normalized) return [];
        var layout = buildLayout(normalized);
        var missionPlan = buildMissionExtraPlan(manifest, layout, Object.assign({}, options, {
            excludePersistent: true,
            includeInheritedPersistent: true
        }));
        return normalized.stations.map(function (row) {
            var missionExtra = Number(missionPlan.missionByStation.get(row.index) || 0);
            var currentWeight = Math.max(0, Number(row.weightLbs || 0));
            return {
                index: row.index,
                weightLbs: Math.round(Math.max(0, currentWeight - missionExtra) * 10) / 10
            };
        });
    }

    function estimatePersistentStationsFromBaseline(manifest, baseline, options) {
        options = options && typeof options === 'object' ? options : {};
        var normalized = normalizeSnapshot(baseline, options);
        if (!normalized) return [];
        var layout = buildLayout(normalized);
        var persistentPlan = buildMissionExtraPlan(manifest, layout, Object.assign({}, options, {
            persistentOnly: true
        }));
        return normalized.stations.map(function (row) {
            return {
                index: row.index,
                weightLbs: Math.round(Math.max(
                    0,
                    Number(row.weightLbs || 0) + Number(persistentPlan.missionByStation.get(row.index) || 0)
                ) * 10) / 10
            };
        });
    }

    function payloadSyncDelayMs(now, burstStartedAt, lastRequestedAt, forceImmediate, options) {
        var config = options && typeof options === 'object' ? options : {};
        var debounceMs = Number.isFinite(Number(config.debounceMs))
            ? Math.max(0, Number(config.debounceMs))
            : PAYLOAD_SYNC_DEBOUNCE_MS;
        var maxWaitMs = Number.isFinite(Number(config.maxWaitMs))
            ? Math.max(0, Number(config.maxWaitMs))
            : PAYLOAD_SYNC_MAX_WAIT_MS;
        if (forceImmediate === true) return 0;
        var current = Math.max(0, Number(now) || 0);
        var burstStart = Math.max(0, Number(burstStartedAt) || current);
        var lastRequest = Math.max(burstStart, Number(lastRequestedAt) || current);
        var quietDueAt = lastRequest + debounceMs;
        var maxDueAt = burstStart + maxWaitMs;
        return Math.max(0, Math.min(quietDueAt, maxDueAt) - current);
    }

    function detachInheritedEquipmentFromBaseline(item, baselineSnapshot, options) {
        options = options && typeof options === 'object' ? options : {};
        if (!item || item.persistentEquipment !== true || item.persistentEquipmentInherited !== true) {
            return { changed: false, detached: false, baseline: normalizeSnapshot(baselineSnapshot, options), removedLbs: 0 };
        }
        var baseline = normalizeSnapshot(baselineSnapshot, options);
        if (!baseline) return { changed: false, detached: true, baseline: null, removedLbs: 0 };
        var itemWeight = Math.max(0, Number(item.weightLbs || 0));
        if (baseline.payloadAdapter === PA24_ADAPTER && baseline.pa24) {
            var pa24RemovedLbs = Math.min(itemWeight, Math.max(0, Number(baseline.pa24.baggageWeightLbs || 0)));
            if (!pa24RemovedLbs) return { changed: false, detached: true, baseline: baseline, removedLbs: 0 };
            var pa24Baseline = Object.assign({}, baseline, {
                totalWeightLbs: Number.isFinite(Number(baseline.totalWeightLbs))
                    ? Math.max(0, Number(baseline.totalWeightLbs) - pa24RemovedLbs)
                    : null,
                payloadWeightLbs: Number.isFinite(Number(baseline.payloadWeightLbs))
                    ? Math.max(0, Number(baseline.payloadWeightLbs) - pa24RemovedLbs)
                    : null,
                pa24: Object.assign({}, baseline.pa24, {
                    baggageWeightLbs: Math.round(Math.max(
                        0,
                        Number(baseline.pa24.baggageWeightLbs || 0) - pa24RemovedLbs
                    ) * 10) / 10
                }),
                stations: baseline.stations.map(function (row) {
                    return {
                        index: row.index,
                        weightLbs: row.index === 5
                            ? Math.round(Math.max(0, Number(row.weightLbs || 0) - pa24RemovedLbs) * 10) / 10
                            : Number(row.weightLbs || 0)
                    };
                })
            });
            return {
                changed: true,
                detached: true,
                baseline: normalizeSnapshot(pa24Baseline, options),
                removedLbs: Math.round(pa24RemovedLbs * 10) / 10
            };
        }
        var layout = buildLayout(baseline);
        var plan = buildMissionExtraPlan({
            items: [Object.assign({}, item, { status: 'loaded', persistentEquipmentInherited: false })]
        }, layout, Object.assign({}, options, {
            persistentOnly: true,
            includeInheritedPersistent: true
        }));
        var removedLbs = baseline.stations.reduce(function (sum, row) {
            return sum + Math.max(0, Number(plan.missionByStation.get(row.index) || 0));
        }, 0);
        var nextBaseline = Object.assign({}, baseline, {
            totalWeightLbs: Number.isFinite(Number(baseline.totalWeightLbs))
                ? Math.max(0, Number(baseline.totalWeightLbs) - removedLbs)
                : null,
            payloadWeightLbs: Number.isFinite(Number(baseline.payloadWeightLbs))
                ? Math.max(0, Number(baseline.payloadWeightLbs) - removedLbs)
                : null,
            stations: baseline.stations.map(function (row) {
                return {
                    index: row.index,
                    weightLbs: Math.round(Math.max(
                        0,
                        Number(row.weightLbs || 0) - Number(plan.missionByStation.get(row.index) || 0)
                    ) * 10) / 10
                };
            })
        });
        return {
            changed: removedLbs > 0,
            detached: true,
            baseline: normalizeSnapshot(nextBaseline, options),
            removedLbs: Math.round(removedLbs * 10) / 10
        };
    }

    // This is the App reset decision expressed as a pure plan. It deliberately
    // keeps the original fallback order so App and tracker restore the same
    // payload when a mission is reset, aborted, or replaced.
    function buildRestorePlan(manifestBeforeReset, baselineSnapshot, currentSnapshot, options) {
        options = options && typeof options === 'object' ? options : {};
        var manifest = manifestBeforeReset && typeof manifestBeforeReset === 'object'
            ? manifestBeforeReset
            : { items: [] };
        var items = Array.isArray(manifest.items) ? manifest.items : [];
        var baseline = normalizeSnapshot(baselineSnapshot, options);
        var current = normalizeSnapshot(currentSnapshot, options);
        var hasLoadedPersistentEquipment = items.some(function (item) {
            return item && item.persistentEquipment === true && item.status === 'loaded';
        });
        var stations = [];
        var maxStations = 0;
        var payloadAdapter = '';
        var pa24State = null;
        var source = 'none';

        if (baseline && baseline.payloadAdapter === PA24_ADAPTER && baseline.pa24) {
            var pa24Plan = buildPa24PlanFromManifest(
                hasLoadedPersistentEquipment ? manifest : { items: [] },
                baseline,
                Object.assign({}, options, { persistentOnly: true })
            );
            if (pa24Plan && (pa24Plan.error || !pa24Plan.pa24State)) {
                return {
                    ok: false,
                    status: 'error',
                    error: pa24Plan.error || 'pa24_reset_plan_failed',
                    payloadAdapter: PA24_ADAPTER,
                    stations: [],
                    maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 20,
                    pa24State: null,
                    source: 'pa24-baseline'
                };
            }
            if (!pa24Plan) {
                return {
                    ok: false,
                    status: 'error',
                    error: 'pa24_reset_plan_failed',
                    payloadAdapter: PA24_ADAPTER,
                    stations: [],
                    maxStations: baseline.sampledStationCount || baseline.payloadStationCount || 20,
                    pa24State: null,
                    source: 'pa24-baseline'
                };
            }
            stations = pa24Plan.stations || [];
            maxStations = baseline.sampledStationCount || baseline.payloadStationCount || 20;
            payloadAdapter = PA24_ADAPTER;
            pa24State = pa24Plan.pa24State;
            source = 'pa24-baseline';
        } else if (current && hasLoadedPersistentEquipment) {
            stations = estimateResetStationsFromSnapshot(manifest, current, options);
            maxStations = current.sampledStationCount || current.payloadStationCount || stations.length;
            source = 'current-minus-mission';
        } else if (baseline && Array.isArray(baseline.stations) && baseline.stations.length
            && (!current || baseline.payloadStationCount === current.payloadStationCount)) {
            stations = hasLoadedPersistentEquipment
                ? estimatePersistentStationsFromBaseline(manifest, baseline, options)
                : baseline.stations.map(function (row) {
                    return { index: row.index, weightLbs: Math.max(0, Number(row.weightLbs || 0)) };
                });
            maxStations = baseline.sampledStationCount || baseline.payloadStationCount || stations.length;
            source = hasLoadedPersistentEquipment ? 'baseline-plus-persistent' : 'baseline';
        } else if (current) {
            stations = estimateResetStationsFromSnapshot(manifest, current, options);
            maxStations = current.sampledStationCount || current.payloadStationCount || stations.length;
            source = 'current-minus-mission';
        }

        return {
            ok: true,
            status: stations.length || pa24State ? 'planned' : 'noop',
            error: null,
            payloadAdapter: payloadAdapter,
            stations: stations,
            maxStations: maxStations,
            pa24State: pa24State,
            source: source
        };
    }

    function comparePayloadStations(snapshot, targetStations, toleranceLbs, options) {
        var normalized = normalizeSnapshot(snapshot, options);
        var targets = (Array.isArray(targetStations) ? targetStations : [])
            .map(function (row) {
                return {
                    index: Math.round(Number(row && row.index)),
                    weightLbs: Math.round(Math.max(0, Number(row && row.weightLbs || 0)) * 10) / 10
                };
            })
            .filter(function (row) { return Number.isFinite(row.index) && row.index >= 1 && Number.isFinite(row.weightLbs); });
        if (!normalized || !targets.length) {
            return { ok: false, reason: normalized ? 'no_targets' : 'no_snapshot', mismatches: [], checked: 0, maxDeltaLbs: null };
        }
        var byIndex = new Map((normalized.stations || []).map(function (row) { return [Math.round(Number(row.index)), Number(row.weightLbs)]; }));
        var tolerance = Math.max(0.25, Number(toleranceLbs) || 1);
        var mismatches = [];
        targets.forEach(function (target) {
            var actual = byIndex.get(target.index);
            var delta = Number.isFinite(actual) ? actual - target.weightLbs : null;
            if (!Number.isFinite(actual) || Math.abs(delta) > tolerance) {
                mismatches.push({
                    index: target.index,
                    targetWeightLbs: target.weightLbs,
                    actualWeightLbs: Number.isFinite(actual) ? Math.round(actual * 10) / 10 : null,
                    deltaLbs: Number.isFinite(delta) ? Math.round(delta * 10) / 10 : null
                });
            }
        });
        var maxDelta = mismatches.reduce(function (max, row) { return Math.max(max, Math.abs(Number(row.deltaLbs || 0))); }, 0);
        return {
            ok: mismatches.length === 0,
            reason: mismatches.length ? 'station_mismatch' : 'matched',
            mismatches: mismatches,
            checked: targets.length,
            maxDeltaLbs: mismatches.length ? Math.round(maxDelta * 10) / 10 : 0
        };
    }

    function comparePa24State(snapshot, targetState, toleranceLbs, options) {
        var normalized = normalizeSnapshot(snapshot, options);
        var target = targetState && typeof targetState === 'object' ? targetState : null;
        if (!(normalized && normalized.pa24) || !target) {
            return {
                ok: false,
                reason: normalized && normalized.pa24 ? 'no_pa24_target' : 'no_pa24_snapshot',
                mismatches: [],
                checked: 0
            };
        }
        var targetSeats = target.seats && typeof target.seats === 'object' ? target.seats : {};
        var targetWeights = target.characterWeights && typeof target.characterWeights === 'object' ? target.characterWeights : {};
        var tolerance = Math.max(0.25, Number(toleranceLbs) || 1);
        var mismatches = [];
        var checked = 0;
        [2, 3, 4].forEach(function (seat) {
            var expectedCharacter = Math.max(0, Math.min(4, Math.round(Number(targetSeats[seat] != null ? targetSeats[seat] : 0) || 0)));
            var actualCharacter = Math.max(0, Math.min(4, Math.round(Number(normalized.pa24.seats && normalized.pa24.seats[seat] || 0) || 0)));
            checked += 1;
            if (actualCharacter !== expectedCharacter) {
                mismatches.push({ field: 'Seat' + seat + 'Character', seat: seat, expected: expectedCharacter, actual: actualCharacter });
            }
            if (expectedCharacter <= 0) return;
            var expectedWeight = Number(targetWeights[expectedCharacter]);
            var actualWeight = Number(normalized.pa24.characterWeights && normalized.pa24.characterWeights[expectedCharacter]);
            checked += 1;
            if (!Number.isFinite(expectedWeight) || !Number.isFinite(actualWeight) || Math.abs(actualWeight - expectedWeight) > tolerance) {
                mismatches.push({
                    field: 'Character' + expectedCharacter + 'Weight',
                    character: expectedCharacter,
                    expected: Number.isFinite(expectedWeight) ? Math.round(expectedWeight * 10) / 10 : null,
                    actual: Number.isFinite(actualWeight) ? Math.round(actualWeight * 10) / 10 : null
                });
            }
        });
        var expectedBaggage = Number(target.baggageWeightLbs);
        var actualBaggage = Number(normalized.pa24.baggageWeightLbs);
        if (Number.isFinite(expectedBaggage)) {
            checked += 1;
            if (!Number.isFinite(actualBaggage) || Math.abs(actualBaggage - expectedBaggage) > tolerance) {
                mismatches.push({
                    field: 'BaggageWeight',
                    expected: Math.round(expectedBaggage * 10) / 10,
                    actual: Number.isFinite(actualBaggage) ? Math.round(actualBaggage * 10) / 10 : null
                });
            }
        }
        return { ok: mismatches.length === 0, reason: mismatches.length ? 'pa24_state_mismatch' : 'matched', mismatches: mismatches, checked: checked };
    }

    function payloadRequestedWeights(manifest, options) {
        options = options && typeof options === 'object' ? options : {};
        var manifestItems = Array.isArray(manifest && manifest.items) ? manifest.items : [];
        var passengers = manifestItems.filter(function (item) { return item.status === 'loaded' && isPassengerItem(item, options); });
        var cargo = manifestItems
            .filter(function (item) { return item.status === 'loaded' && !isPassengerItem(item, options); })
            .filter(function (item) { return item.persistentEquipmentInherited !== true; });
        var paxCount = passengers.reduce(function (sum, item) {
            return sum + Math.max(1, Math.round(Number(item.passengerCount) || 1));
        }, 0);
        var paxWeightLbs = passengers.reduce(function (sum, item) { return sum + Math.max(0, Number(item.weightLbs || 0)); }, 0);
        if (paxCount > 0 && paxWeightLbs <= 0) paxWeightLbs = paxCount * fallbackPaxWeightLbs(options);
        var cargoWeightLbs = cargo.reduce(function (sum, item) { return sum + Math.max(0, Number(item.weightLbs || 0)); }, 0);
        return {
            paxWeightLbs: Math.round(paxWeightLbs * 10) / 10,
            cargoWeightLbs: Math.round(cargoWeightLbs * 10) / 10,
            missionWeightLbs: Math.round((paxWeightLbs + cargoWeightLbs) * 10) / 10
        };
    }

    function outcomeText(value, maxLength) {
        var limit = Number.isFinite(Number(maxLength)) ? Math.max(0, Math.round(Number(maxLength))) : 180;
        return String(value == null ? '' : value)
            .replace(/[\u0000-\u001f\u007f]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, limit);
    }

    function outcomeNumber(value, fallback) {
        if (value === null || value === undefined || value === '') return fallback;
        var number = Number(value);
        return Number.isFinite(number) ? Math.round(number * 10) / 10 : fallback;
    }

    function normalizeOutcomePlan(raw) {
        var source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        return {
            missionWeightLbs: outcomeNumber(source.missionWeightLbs, null),
            paxWeightLbs: outcomeNumber(source.paxWeightLbs, null),
            cargoWeightLbs: outcomeNumber(source.cargoWeightLbs, null),
            payloadWeightLbs: outcomeNumber(source.payloadWeightLbs, null),
            grossWeightLbs: outcomeNumber(source.grossWeightLbs, null),
            stations: (Array.isArray(source.stations) ? source.stations : [])
                .slice(0, 20)
                .map(function (row) {
                    var station = row && typeof row === 'object' ? row : {};
                    return {
                        index: Math.max(1, Math.min(20, Math.round(Number(station.index) || 1))),
                        baselineWeightLbs: outcomeNumber(station.baselineWeightLbs, null),
                        missionExtraLbs: outcomeNumber(station.missionExtraLbs, null),
                        weightLbs: outcomeNumber(station.weightLbs, null)
                    };
                })
                .filter(function (row) { return Number.isFinite(row.weightLbs); })
        };
    }

    function normalizeOutcomeVerification(raw) {
        var source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        var check = source.check && typeof source.check === 'object' ? source.check : {};
        var pa24Check = source.pa24Check && typeof source.pa24Check === 'object' ? source.pa24Check : {};
        var status = outcomeText(source.status, 40).toLowerCase();
        if (status !== 'ok' && status !== 'unstable' && status !== 'running') status = null;
        return status ? {
            status: status,
            reason: outcomeText(source.reason || check.reason || pa24Check.reason, 120) || null,
            checked: Math.max(0, Math.round(Number(check.checked) || 0)),
            mismatchCount: Array.isArray(check.mismatches) ? Math.min(40, check.mismatches.length) : 0,
            maxDeltaLbs: outcomeNumber(check.maxDeltaLbs, null),
            pa24Checked: Math.max(0, Math.round(Number(pa24Check.checked) || 0)),
            pa24MismatchCount: Array.isArray(pa24Check.mismatches) ? Math.min(20, pa24Check.mismatches.length) : 0,
            pa24ReassertAttempts: Math.max(0, Math.min(2, Math.round(Number(source.pa24ReassertAttempts) || 0))),
            maxStations: Math.max(0, Math.min(20, Math.round(Number(source.maxStations) || 0)))
        } : null;
    }

    function normalizeOutcome(raw, options) {
        var source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        var config = options && typeof options === 'object' ? options : {};
        var status = outcomeText(source.status || source.payloadStatus, 40).toLowerCase();
        if (status !== 'pending' && status !== 'ok' && status !== 'warning' && status !== 'error') status = 'idle';
        var planSource = source.plan || source.payloadPlan;
        var verificationSource = source.verification || source.payloadVerification;
        return {
            schema: 'ga.mission-payload-outcome.v1',
            status: status,
            override: source.override === true || source.payloadOverride === true,
            adapter: outcomeText(source.adapter || source.payloadAdapter, 80) || null,
            error: outcomeText(source.error || source.payloadError, 180) || null,
            plan: planSource && typeof planSource === 'object' ? normalizeOutcomePlan(planSource) : null,
            verification: verificationSource && typeof verificationSource === 'object'
                ? normalizeOutcomeVerification(verificationSource)
                : null,
            weightAndBalance: normalizeSnapshot(source.weightAndBalance || source.snapshot || source.payloadSnapshot),
            updatedAt: Math.max(0, Math.round(Number(
                Object.prototype.hasOwnProperty.call(config, 'updatedAt') ? config.updatedAt : source.updatedAt
            ) || 0)) || null
        };
    }

    function projectOutcome(raw, options) {
        var outcome = normalizeOutcome(raw, options);
        var tone = 'muted';
        var className = '';
        var message = '';
        if (outcome.status === 'pending') {
            tone = 'info';
            className = 'is-pending';
            message = 'Aktueller Ladezustand wird an den Simulator uebertragen ...';
        } else if (outcome.verification && outcome.verification.status === 'unstable') {
            var missionWeight = outcome.plan && Number(outcome.plan.missionWeightLbs);
            var stationTargets = outcome.plan && Array.isArray(outcome.plan.stations)
                ? outcome.plan.stations
                    .filter(function (row) { return Number.isFinite(Number(row && row.weightLbs)); })
                    .map(function (row) { return 'S' + Math.round(Number(row.index) || 0) + ' ' + Math.round(Number(row.weightLbs)) + ' lbs'; })
                    .join(' · ')
                : '';
            var weightHint = Number.isFinite(missionWeight) ? ' Missionszuladung: ' + Math.round(missionWeight) + ' lbs.' : '';
            var stationHint = stationTargets ? ' Zielwerte: ' + stationTargets + '.' : '';
            tone = 'warn';
            className = 'is-warn';
            message = 'Die automatische Sim-Zuladung ist bei diesem Flugzeug nicht moeglich.' + weightHint + stationHint
                + ' Wenn du die Zuladung im Simulator abbilden moechtest, setze diese Werte bitte manuell im Weight-&-Balance- oder Tablet-Menue. Die Mission kann trotzdem gestartet werden.';
        } else if (outcome.status === 'ok' || (outcome.verification && outcome.verification.status === 'ok')) {
            tone = 'good';
            className = 'is-ok';
            message = 'Sim-Zuladung stabil uebernommen.';
        } else if (outcome.status === 'warning' || outcome.status === 'error') {
            var errorMessages = {
                payload_unstable_aircraft_override: 'Sim-Zuladung wurde vom Flugzeug wieder ueberschrieben.',
                pa24_no_free_seat: 'In der Comanche ist kein freier Sitz fuer die geplante Zuladung vorhanden.',
                pa24_no_free_character: 'In der Comanche ist keine freie Character-Zuordnung fuer die geplante Zuladung vorhanden.',
                pa24_seat_weight_exceeded: 'Eine einzelne Fracht ueberschreitet das Sitzlimit von ' + PA24_SEAT_MAX_LBS + ' lbs.',
                pa24_gross_weight_exceeded: 'Die geplante Zuladung wuerde das zulaessige Gesamtgewicht der Comanche ueberschreiten.'
            };
            tone = 'warn';
            className = 'is-warn';
            message = errorMessages[outcome.error] || ('Sim-Zuladung noch nicht synchron (' + (outcome.error || 'payload_sync_failed') + ').');
        }
        var snapshot = outcome.weightAndBalance;
        var plan = outcome.plan;
        var layout = snapshot ? buildLayout(snapshot) : null;
        var summaryNumber = function (value) {
            return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
                ? Number(value)
                : null;
        };
        var payloadSummary = snapshot ? {
            adapter: snapshot.payloadAdapter,
            isPa24: snapshot.payloadAdapter === PA24_ADAPTER,
            maximumWeightLbs: summaryNumber(plan && plan.grossWeightLbs) !== null
                ? summaryNumber(plan.grossWeightLbs)
                : summaryNumber(snapshot.pa24 && snapshot.pa24.grossWeightLbs),
            totalWeightLbs: summaryNumber(snapshot.totalWeightLbs),
            emptyWeightLbs: summaryNumber(snapshot.emptyWeightLbs),
            fuelWeightLbs: summaryNumber(snapshot.fuelWeightLbs),
            paxWeightLbs: summaryNumber(plan && plan.paxWeightLbs),
            cargoWeightLbs: summaryNumber(plan && plan.cargoWeightLbs),
            missionWeightLbs: summaryNumber(plan && plan.missionWeightLbs),
            payloadStationCount: Math.max(0, Math.round(Number(snapshot.payloadStationCount) || 0)),
            copilotIndex: layout ? layout.copilotIndex : null,
            rearSeatIndices: layout ? layout.rearSeatIndices : [],
            cargoIndices: layout ? layout.cargoIndices : [],
            stations: (Array.isArray(plan && plan.stations) ? plan.stations : snapshot.stations || []).map(function (row) {
                return {
                    index: Math.max(0, Math.round(Number(row && row.index) || 0)),
                    weightLbs: summaryNumber(row && row.weightLbs),
                    baselineWeightLbs: summaryNumber(row && row.baselineWeightLbs),
                    missionExtraLbs: summaryNumber(row && row.missionExtraLbs)
                };
            })
        } : null;
        return Object.assign({}, outcome, {
            presentation: { tone: tone, className: className, message: message, summary: payloadSummary }
        });
    }

    return Object.freeze({
        CORE_SCHEMA: CORE_SCHEMA,
        CORE_VERSION: CORE_VERSION,
        PA24_ADAPTER: PA24_ADAPTER,
        PA24_BAGGAGE_MAX_LBS: PA24_BAGGAGE_MAX_LBS,
        PA24_SEAT_MAX_LBS: PA24_SEAT_MAX_LBS,
        PAYLOAD_SYNC_DEBOUNCE_MS: PAYLOAD_SYNC_DEBOUNCE_MS,
        PAYLOAD_SYNC_MAX_WAIT_MS: PAYLOAD_SYNC_MAX_WAIT_MS,
        allocateWeightToStations: allocateWeightToStations,
        buildLayout: buildLayout,
        buildMissionExtraPlan: buildMissionExtraPlan,
        buildPa24PlanFromManifest: buildPa24PlanFromManifest,
        buildPlanFromManifest: buildPlanFromManifest,
        buildRestorePlan: buildRestorePlan,
        comparePa24State: comparePa24State,
        comparePayloadStations: comparePayloadStations,
        detachInheritedEquipmentFromBaseline: detachInheritedEquipmentFromBaseline,
        estimatePersistentStationsFromBaseline: estimatePersistentStationsFromBaseline,
        estimateResetStationsFromSnapshot: estimateResetStationsFromSnapshot,
        itemIsBulky: itemIsBulky,
        normalizeOutcome: normalizeOutcome,
        normalizeOutcomePlan: normalizeOutcomePlan,
        normalizeOutcomeVerification: normalizeOutcomeVerification,
        normalizeSnapshot: normalizeSnapshot,
        pa24StateFromSnapshot: pa24StateFromSnapshot,
        payloadSyncDelayMs: payloadSyncDelayMs,
        payloadRequestedWeights: payloadRequestedWeights,
        projectOutcome: projectOutcome
    });
}));
