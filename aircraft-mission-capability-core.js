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

        let normalizedText;
        if (deferredPickup) {
            const pickupRoleMatch = String(paxText || '').match(/PAX\s+(?:Pickup|Abholung|Aufnahme)(.*)$/i);
            const pickupSuffix = String(pickupRoleMatch?.[1] || '').trim();
            normalizedText = normalizedPickup > 0
                ? `0 PAX am Start · ${normalizedPickup} PAX Pickup${pickupSuffix ? ` ${pickupSuffix}` : ''}`
                : '0 PAX';
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
            party: normalizedInitial > 0
                ? { count: normalizedInitial, kind: 'single', label: String(roleLabel || 'Passagier').trim() || 'Passagier' }
                : null
        };
    }

    return Object.freeze({
        buildAircraftCapabilitySnapshot,
        extractPassengerCounts,
        formatPassengerText,
        resolveMissionPassengerPlan
    });
});
