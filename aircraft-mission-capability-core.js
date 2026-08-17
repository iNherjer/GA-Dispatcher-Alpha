(function initAircraftMissionCapabilityCore(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.aircraftMissionCapabilityCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAircraftMissionCapabilityCore() {
    'use strict';

    function clampInteger(value, min, max, fallback = min) {
        const parsed = Math.round(Number(value));
        const normalized = Number.isFinite(parsed) ? parsed : fallback;
        return Math.max(min, Math.min(max, normalized));
    }

    function normalizeTags(tags) {
        const source = Array.isArray(tags)
            ? tags
            : (typeof tags === 'string' ? tags.split(/[;,|]/) : []);
        return Array.from(new Set(source
            .map(value => String(value || '').trim().toLowerCase())
            .filter(Boolean)));
    }

    const PARTY_KINDS = new Set(['single', 'couple', 'family', 'group', 'club', 'business_team']);

    function normalizeRandomValue(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return Math.random();
        if (numeric <= 0) return 0;
        if (numeric >= 1) return 0.999999999;
        return numeric;
    }

    function pickWeighted(entries = [], randomValue = null) {
        const pool = Array.isArray(entries)
            ? entries.filter(entry => entry && Number(entry.weight) > 0)
            : [];
        if (!pool.length) return null;
        const total = pool.reduce((sum, entry) => sum + Number(entry.weight), 0);
        let cursor = normalizeRandomValue(randomValue) * total;
        for (const entry of pool) {
            cursor -= Number(entry.weight);
            if (cursor < 0) return entry;
        }
        return pool[pool.length - 1];
    }

    function missionPartyFamily({ profileId = '', taskDomain = '', category = '', baseType = 'apt' } = {}) {
        const profile = String(profileId || '').trim().toLowerCase();
        const domain = String(taskDomain || '').trim().toLowerCase();
        const normalizedCategory = String(category || '').trim().toLowerCase();
        const mode = String(baseType || 'apt').trim().toLowerCase();
        if (profile === 'private_outing' || domain === 'private_outing') return 'private_outing';
        if (profile === 'sightseeing_tour' || domain === 'sightseeing_tour') return 'sightseeing_tour';
        if (mode === 'apt' && (
            normalizedCategory === 'charter'
            || domain === 'charter'
            || profile === 'apt_charter'
        )) return 'charter';
        return '';
    }

    function partyLabel(family = '', kind = 'single') {
        const labels = {
            private_outing: {
                single: 'Ausflugsgast',
                couple: 'Paar auf Privatausflug',
                family: 'Familie auf Privatausflug',
                group: 'Freundesgruppe',
                club: 'Vereinsgruppe'
            },
            sightseeing_tour: {
                single: 'Sightseeing-Gast',
                couple: 'Sightseeing-Paar',
                family: 'Sightseeing-Familie',
                group: 'Sightseeing-Gruppe',
                club: 'Vereinsgruppe'
            },
            charter: {
                single: 'Chartergast',
                couple: 'Charterpaar',
                family: 'Charterfamilie',
                group: 'Chartergruppe',
                club: 'Vereinsgruppe',
                business_team: 'Business-Team'
            }
        };
        return labels[family]?.[kind] || (kind === 'single' ? 'Passagier' : 'Reisegruppe');
    }

    function resolveMissionPartyPlan({
        profileId = '',
        taskDomain = '',
        category = '',
        baseType = 'apt',
        passengerCapacity = 0,
        groupCapability = false,
        allowGroup = true,
        randomValues = []
    } = {}) {
        const capacity = clampInteger(passengerCapacity, 0, 6, 0);
        const family = missionPartyFamily({ profileId, taskDomain, category, baseType });
        const eligible = !!family;
        if (!eligible || capacity <= 0) {
            return {
                eligible,
                family,
                passengerCapacity: capacity,
                passengerCount: 0,
                maxPartySize: 1,
                groupEnabled: false,
                party: null
            };
        }

        const groupEnabled = allowGroup === true && groupCapability === true && capacity >= 2;
        let passengerCount = 1;
        if (groupEnabled) {
            const countWeights = [
                { count: 1, weight: 4 },
                { count: 2, weight: 4 },
                { count: 3, weight: 3 },
                { count: 4, weight: 2 },
                { count: 5, weight: 1 }
            ].filter(entry => entry.count <= Math.min(5, capacity));
            passengerCount = pickWeighted(countWeights, randomValues[0])?.count || 1;
        }

        let kind = 'single';
        if (passengerCount === 2) {
            kind = 'couple';
        } else if (passengerCount >= 3) {
            const kindWeights = family === 'charter'
                ? [
                    { kind: 'business_team', weight: 5 },
                    { kind: 'family', weight: 3 },
                    { kind: 'group', weight: 2 },
                    { kind: 'club', weight: 1 }
                ]
                : [
                    { kind: 'family', weight: 5 },
                    { kind: 'group', weight: 4 },
                    { kind: 'club', weight: 2 }
                ];
            kind = pickWeighted(kindWeights, randomValues[1])?.kind || 'group';
        }

        return {
            eligible: true,
            family,
            passengerCapacity: capacity,
            passengerCount,
            maxPartySize: groupEnabled ? Math.min(5, capacity) : 1,
            groupEnabled,
            party: {
                count: passengerCount,
                kind,
                label: partyLabel(family, kind)
            }
        };
    }

    function normalizeMissionParty(party = null, passengerCount = 0, roleLabel = '') {
        const count = clampInteger(passengerCount, 0, 6, 0);
        if (count <= 0) return null;
        const source = party && typeof party === 'object' ? party : {};
        const requestedKind = String(source.kind || '').trim().toLowerCase();
        const sourceCount = clampInteger(source.count, 0, 6, 0);
        const sourceMatchesCount = sourceCount === count && PARTY_KINDS.has(requestedKind);
        const kind = sourceMatchesCount
            ? requestedKind
            : (count === 1 ? 'single' : (count === 2 ? 'couple' : 'group'));
        const label = String((sourceMatchesCount ? source.label : '') || roleLabel || (kind === 'single' ? 'Passagier' : 'Reisegruppe'))
            .replace(/\s+/g, ' ')
            .trim();
        return { count, kind, label: label || (kind === 'single' ? 'Passagier' : 'Reisegruppe') };
    }

    function buildAircraftCapabilitySnapshot({
        slotId = '',
        preset = null,
        totalSeats = null,
        crewSeats = 1
    } = {}) {
        const source = preset && typeof preset === 'object' ? preset : {};
        const seats = clampInteger(totalSeats ?? source.pax ?? source.totalSeats, 1, 6, 4);
        const crew = clampInteger(crewSeats, 1, seats, 1);
        const payload = Math.max(0, Math.round(Number(source.maxPayloadKg) || 0));
        return {
            slotId: String(slotId || source.slotId || '').trim(),
            name: String(source.name || slotId || 'Flugzeug').trim(),
            totalSeats: seats,
            crewSeats: crew,
            passengerCapacity: Math.max(0, seats - crew),
            maxPayloadKg: payload,
            aircraftClass: String(source.aircraftClass || source.class || 'other').trim().toLowerCase(),
            aircraftTags: normalizeTags(source.aircraftTags ?? source.tags)
        };
    }

    function extractPassengerCounts(paxText = '') {
        const counts = [];
        const text = String(paxText || '');
        for (const match of text.matchAll(/(\d+)\s*PAX\b/gi)) {
            counts.push(clampInteger(match[1], 0, 6, 0));
        }
        return counts;
    }

    function singularizePassengerDescriptor(text = '') {
        return String(text || '')
            .replace(/Sightseeing-Gäste/gi, 'Sightseeing-Gast')
            .replace(/Tour-Gäste/gi, 'Tour-Gast')
            .replace(/Ausflugsgäste/gi, 'Ausflugsgast')
            .replace(/Chartergäste/gi, 'Chartergast')
            .replace(/\bGäste\b/gi, 'Gast')
            .replace(/\bGaeste\b/gi, 'Gast')
            .replace(/\bPersonen\b/gi, 'Person');
    }

    function formatPassengerText(paxText = '', passengerCount = 0, { roleLabel = '', preserveDash = false } = {}) {
        const count = clampInteger(passengerCount, 0, 6, 0);
        const source = String(paxText || '').replace(/\s+/g, ' ').trim();
        if (count <= 0) {
            if (preserveDash && /^\s*-\s*$/.test(source)) return '-';
            return '0 PAX';
        }
        if (/\d+\s*PAX\b/i.test(source)) {
            const replaced = source.replace(/\d+\s*PAX\b/i, `${count} PAX`);
            return count === 1 ? singularizePassengerDescriptor(replaced) : replaced;
        }
        const role = String(roleLabel || '').replace(/\s+/g, ' ').trim();
        return role ? `${count} PAX (${role})` : `${count} PAX`;
    }

    function resolveMissionPassengerPlan({
        paxText = '',
        passengerCount = null,
        pickupPassengerCount = null,
        passengerCapacity = 0,
        maxPartySize = 1,
        party = null,
        roleLabel = '',
        preserveDash = false
    } = {}) {
        const capacity = clampInteger(passengerCapacity, 0, 6, 0);
        const phasePartyLimit = clampInteger(maxPartySize, 1, 6, 1);
        const counts = extractPassengerCounts(paxText);
        const explicitCount = passengerCount !== null
            && passengerCount !== undefined
            && passengerCount !== ''
            && Number.isFinite(Number(passengerCount))
            ? clampInteger(passengerCount, 0, 6, 0)
            : null;
        const deferredPickup = counts.length >= 2
            && counts[0] === 0
            && /\b(?:pickup|abhol|aufnahme|aufnehmen)\b/i.test(String(paxText || ''));
        const initialRequested = explicitCount !== null ? explicitCount : (counts[0] ?? 0);
        const pickupRequested = pickupPassengerCount !== null
            && pickupPassengerCount !== undefined
            && pickupPassengerCount !== ''
            && Number.isFinite(Number(pickupPassengerCount))
            ? clampInteger(pickupPassengerCount, 0, 6, 0)
            : (deferredPickup ? Math.max(0, ...counts.slice(1)) : 0);
        const minimumRequired = Math.max(initialRequested > 0 ? 1 : 0, pickupRequested > 0 ? 1 : 0);
        const blocked = minimumRequired > capacity;
        const normalizedInitial = blocked || initialRequested <= 0
            ? 0
            : Math.min(initialRequested, capacity, phasePartyLimit);
        const normalizedPickup = blocked || pickupRequested <= 0
            ? 0
            : Math.min(pickupRequested, capacity, phasePartyLimit);

        const normalizedParty = normalizeMissionParty(party, normalizedInitial, roleLabel);
        let normalizedText;
        if (deferredPickup) {
            const pickupRoleMatch = String(paxText || '').match(/PAX\s+(?:Pickup|Abholung|Aufnahme)(.*)$/i);
            const pickupSuffix = String(pickupRoleMatch?.[1] || '').trim();
            normalizedText = normalizedPickup > 0
                ? `0 PAX am Start · ${normalizedPickup} PAX Pickup${pickupSuffix ? ` ${pickupSuffix}` : ''}`
                : '0 PAX';
        } else if (normalizedParty && normalizedParty.count > 1) {
            normalizedText = `${normalizedParty.count} PAX (${normalizedParty.label})`;
        } else {
            normalizedText = formatPassengerText(paxText, normalizedInitial, { roleLabel, preserveDash });
        }

        return {
            passengerCapacity: capacity,
            requestedPassengerCount: initialRequested,
            requestedPickupPassengerCount: pickupRequested,
            passengerCount: normalizedInitial,
            pickupPassengerCount: normalizedPickup,
            plannedPassengerCount: Math.max(normalizedInitial, normalizedPickup),
            requiresPassenger: minimumRequired > 0,
            blocked,
            deferredPickup,
            paxText: normalizedText,
            party: normalizedParty
        };
    }

    return Object.freeze({
        buildAircraftCapabilitySnapshot,
        extractPassengerCounts,
        formatPassengerText,
        resolveMissionPartyPlan,
        resolveMissionPassengerPlan
    });
});
