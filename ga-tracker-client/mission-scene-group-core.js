(function initMissionSceneGroupCore(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GAMissionSceneGroup = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createMissionSceneGroupCore() {
    'use strict';

    const CAPABILITY = 'mission.scene.group.v1';
    const MIN_GROUP_SIZE = 2;
    const MAX_GROUP_SIZE = 5;
    const DEFAULT_SPACING_M = 1;
    const DEFAULT_STAGGER_MS = 1100;
    const DEBUG_SCENE_ID_PATTERN = /^mission-scene-group-debug-(board|deboard)-([2-5])-(\d{10,})$/;
    const DEBUG_COMMAND_TYPES = new Set([
        'mission_scene_spawn',
        'mission_scene_boarding',
        'mission_scene_deboarding',
        'mission_scene_clear'
    ]);
    const GROUP_VEHICLE_TITLES = Object.freeze({
        van: Object.freeze([
            'Microsoft_Van_EUR',
            'Microsoft_Van_ASIA_02',
            'Microsoft_Van_NA_Modern',
            'Van Europe',
            'Van NorthAm'
        ]),
        bus: Object.freeze([
            'Microsoft_MiniBus_ASIA_01',
            'Bus',
            'Microsoft_Bus_Modern',
            'Microsoft_Bus_Modern_Red',
            'Microsoft_Bus_EUR_Vintage',
            'MiniBus India'
        ])
    });

    function clampNumber(value, fallback, min, max) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.max(min, Math.min(max, number));
    }

    function normalizeGroupSequenceCommand(command = {}) {
        if (command?.groupSequence !== true) {
            return Object.freeze({
                enabled: false,
                valid: true,
                expectedPassengerCount: null,
                groupSpacingM: DEFAULT_SPACING_M,
                boardingStaggerMs: DEFAULT_STAGGER_MS,
                groupVehicleKind: null,
                error: ''
            });
        }
        const rawCount = command?.expectedPassengerCount ?? command?.boarderCount ?? command?.passengerCount;
        const expectedPassengerCount = Number(rawCount);
        if (!Number.isInteger(expectedPassengerCount)
            || expectedPassengerCount < MIN_GROUP_SIZE
            || expectedPassengerCount > MAX_GROUP_SIZE) {
            return Object.freeze({
                enabled: true,
                valid: false,
                expectedPassengerCount: null,
                groupSpacingM: DEFAULT_SPACING_M,
                boardingStaggerMs: DEFAULT_STAGGER_MS,
                groupVehicleKind: null,
                error: 'invalid_group_count'
            });
        }
        const groupSpacingM = Math.round(clampNumber(command?.groupSpacingM, DEFAULT_SPACING_M, 0.8, 1.5) * 100) / 100;
        const boardingStaggerMs = Math.round(clampNumber(command?.boardingStaggerMs, DEFAULT_STAGGER_MS, 500, 2500));
        const groupVehicleKind = expectedPassengerCount <= 3 ? 'van' : 'bus';
        return Object.freeze({
            enabled: true,
            valid: true,
            expectedPassengerCount,
            groupSpacingM,
            boardingStaggerMs,
            groupVehicleKind,
            error: ''
        });
    }

    function groupLateralOffsetM(index, count, spacingM = DEFAULT_SPACING_M) {
        const memberIndex = Number(index);
        const memberCount = Number(count);
        if (!Number.isInteger(memberIndex)
            || !Number.isInteger(memberCount)
            || memberIndex < 0
            || memberIndex >= memberCount
            || memberCount < 1) return 0;
        const spacing = clampNumber(spacingM, DEFAULT_SPACING_M, 0.8, 1.5);
        return Math.round(((memberIndex - ((memberCount - 1) / 2)) * spacing) * 100) / 100;
    }

    function groupStartDelayMs(index, staggerMs = DEFAULT_STAGGER_MS) {
        const memberIndex = Math.max(0, Math.round(Number(index) || 0));
        const stagger = Math.round(clampNumber(staggerMs, DEFAULT_STAGGER_MS, 500, 2500));
        return memberIndex * stagger;
    }

    function buildGroupMemberPlans(count, options = {}) {
        const memberCount = Number(count);
        if (!Number.isInteger(memberCount) || memberCount < MIN_GROUP_SIZE || memberCount > MAX_GROUP_SIZE) return Object.freeze([]);
        const spacingM = clampNumber(options?.groupSpacingM, DEFAULT_SPACING_M, 0.8, 1.5);
        const staggerMs = clampNumber(options?.boardingStaggerMs, DEFAULT_STAGGER_MS, 500, 2500);
        return Object.freeze(Array.from({ length: memberCount }, (_, index) => Object.freeze({
            index,
            number: index + 1,
            kind: `person_boarder_${index + 1}`,
            lateralOffsetM: groupLateralOffsetM(index, memberCount, spacingM),
            startDelayMs: groupStartDelayMs(index, staggerMs)
        })));
    }

    function canonicalAllowedVehicleTitle(value, vehicleKind) {
        const requested = String(value || '').trim().toLowerCase();
        if (!requested) return '';
        return (GROUP_VEHICLE_TITLES[vehicleKind] || []).find(title => title.toLowerCase() === requested) || '';
    }

    function resolveGroupVehicleSelection(groupPlan, command = {}) {
        const vehicleKind = groupPlan?.valid === true ? groupPlan.groupVehicleKind : null;
        const allowed = vehicleKind ? GROUP_VEHICLE_TITLES[vehicleKind] : null;
        if (!allowed) return Object.freeze({ vehicleKind: null, title: '', candidates: Object.freeze([]) });
        const requested = [
            command?.vehicleTitle,
            command?.vehicleObjectTitle,
            ...(Array.isArray(command?.vehicleTitleCandidates) ? command.vehicleTitleCandidates : [])
        ].map(value => canonicalAllowedVehicleTitle(value, vehicleKind)).filter(Boolean);
        const candidates = Array.from(new Set([...requested, ...allowed]));
        return Object.freeze({
            vehicleKind,
            title: candidates[0],
            candidates: Object.freeze(candidates)
        });
    }

    function evaluateGroupSequenceCompletion(input = {}) {
        const expectedPassengerCount = Number(input?.expectedPassengerCount);
        const spawnedCount = Number(input?.spawnedCount);
        const routeSentCount = Number(input?.routeSentCount);
        const countValid = Number.isInteger(expectedPassengerCount)
            && expectedPassengerCount >= MIN_GROUP_SIZE
            && expectedPassengerCount <= MAX_GROUP_SIZE;
        const spawnComplete = countValid && spawnedCount === expectedPassengerCount;
        const routeComplete = countValid && routeSentCount === expectedPassengerCount;
        const complete = spawnComplete && routeComplete;
        return Object.freeze({
            complete,
            spawnComplete,
            routeComplete,
            error: !countValid
                ? 'invalid_group_count'
                : (!spawnComplete ? 'passenger_count_mismatch' : (!routeComplete ? 'waypoint_route_failed' : ''))
        });
    }

    function isGroupSceneDebugCommand(command = {}) {
        if (command?.groupSceneDebug !== true) return false;
        const type = String(command?.type || command?.command || '').trim().toLowerCase();
        if (!DEBUG_COMMAND_TYPES.has(type)) return false;
        const sceneMatch = String(command?.sceneId || '').trim().match(DEBUG_SCENE_ID_PATTERN);
        if (!sceneMatch) return false;
        if (type === 'mission_scene_clear') return true;
        if ((type === 'mission_scene_spawn' || type === 'mission_scene_boarding') && sceneMatch[1] !== 'board') return false;
        if (type === 'mission_scene_deboarding' && sceneMatch[1] !== 'deboard') return false;
        const groupPlan = normalizeGroupSequenceCommand(command);
        return groupPlan.enabled === true
            && groupPlan.valid === true
            && groupPlan.expectedPassengerCount === Number(sceneMatch[2]);
    }

    return Object.freeze({
        CAPABILITY,
        DEFAULT_SPACING_M,
        DEFAULT_STAGGER_MS,
        GROUP_VEHICLE_TITLES,
        MAX_GROUP_SIZE,
        MIN_GROUP_SIZE,
        buildGroupMemberPlans,
        evaluateGroupSequenceCompletion,
        groupLateralOffsetM,
        groupStartDelayMs,
        isGroupSceneDebugCommand,
        normalizeGroupSequenceCommand,
        resolveGroupVehicleSelection
    });
});
