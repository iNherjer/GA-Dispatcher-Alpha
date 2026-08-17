(function initAircraftMissionProfileCore(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root && typeof root === 'object') root.aircraftMissionProfileCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildAircraftMissionProfileCore() {
    'use strict';

    const SUPPORTED_TAGS = Object.freeze([
        'touring',
        'business',
        'cargo',
        'utility',
        'bush',
        'training'
    ]);
    const SUPPORTED_TAG_SET = new Set(SUPPORTED_TAGS);
    const SUPPORTED_BASE_TYPES = new Set(['apt', 'poi', 'bush']);
    const ZERO_PAX_PROFILES = new Set([
        'freeflight_planning',
        'bush_supply_strip',
        'bush_pickup_cargo'
    ]);
    const SINGLE_PAX_PROFILES = new Set([
        'private_outing',
        'sightseeing_tour',
        'tour_guide_knowledge',
        'historian_guided_tour',
        'inspection_infra',
        'infra_chain_recon',
        'mapping_survey',
        'science_bio',
        'science_geo',
        'media_photo',
        'news_coverage',
        'fire_watch',
        'search_and_rescue',
        'sar_heli',
        'club_utility',
        'cargo_fragile',
        'animal_transport',
        'medical_transfer',
        'bush_charter_strip',
        'bush_scenic_hopper',
        'bush_recon_return',
        'bush_pickup_strip',
        'apt_charter',
        'apt_charter_pickup'
    ]);

    const AUTO_PROFILE_MATRIX = Object.freeze({
        apt: Object.freeze({
            touring: Object.freeze([
                Object.freeze({ category: 'private', profileId: 'private_outing', weight: 4 }),
                Object.freeze({ category: 'private', profileId: 'sightseeing_tour', weight: 2 })
            ]),
            business: Object.freeze([
                Object.freeze({ category: 'charter', profileId: 'auto', weight: 4 })
            ]),
            cargo: Object.freeze([
                Object.freeze({ category: 'cargo', profileId: 'auto', weight: 4 }),
                Object.freeze({ category: 'cargo', profileId: 'cargo_fragile', weight: 2 }),
                Object.freeze({ category: 'cargo', profileId: 'animal_transport', weight: 1 }),
                Object.freeze({ category: 'cargo', profileId: 'medical_transfer', weight: 2 })
            ]),
            utility: Object.freeze([
                Object.freeze({ category: 'club', profileId: 'club_utility', weight: 3 })
            ]),
            bush: Object.freeze([]),
            training: Object.freeze([
                Object.freeze({ category: 'trn', profileId: 'auto', weight: 3 })
            ])
        }),
        poi: Object.freeze({
            touring: Object.freeze([
                Object.freeze({ category: 'all', profileId: 'sightseeing_tour', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'tour_guide_knowledge', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'historian_guided_tour', weight: 2 })
            ]),
            business: Object.freeze([]),
            cargo: Object.freeze([]),
            utility: Object.freeze([
                Object.freeze({ category: 'all', profileId: 'inspection_infra', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'infra_chain_recon', weight: 1 }),
                Object.freeze({ category: 'all', profileId: 'mapping_survey', weight: 3 }),
                Object.freeze({ category: 'all', profileId: 'science_bio', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'science_geo', weight: 1 }),
                Object.freeze({ category: 'all', profileId: 'media_photo', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'news_coverage', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'fire_watch', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'search_and_rescue', weight: 2 })
            ]),
            bush: Object.freeze([]),
            training: Object.freeze([
                Object.freeze({ category: 'trn', profileId: 'auto', weight: 3 })
            ])
        }),
        bush: Object.freeze({
            touring: Object.freeze([]),
            business: Object.freeze([]),
            cargo: Object.freeze([
                Object.freeze({ category: 'all', profileId: 'bush_supply_strip', weight: 4 }),
                Object.freeze({ category: 'all', profileId: 'bush_pickup_cargo', weight: 2 })
            ]),
            utility: Object.freeze([
                Object.freeze({ category: 'all', profileId: 'bush_recon_return', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'bush_supply_strip', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'bush_pickup_strip', weight: 1 })
            ]),
            bush: Object.freeze([
                Object.freeze({ category: 'all', profileId: 'bush_supply_strip', weight: 3 }),
                Object.freeze({ category: 'all', profileId: 'bush_charter_strip', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'bush_scenic_hopper', weight: 2 }),
                Object.freeze({ category: 'all', profileId: 'bush_recon_return', weight: 1 }),
                Object.freeze({ category: 'all', profileId: 'bush_pickup_strip', weight: 1 }),
                Object.freeze({ category: 'all', profileId: 'bush_pickup_cargo', weight: 1 })
            ]),
            training: Object.freeze([])
        })
    });

    function normalizeAircraftMissionTags(tags) {
        const source = Array.isArray(tags)
            ? tags
            : (typeof tags === 'string' ? tags.split(/[;,|]/) : []);
        return Array.from(new Set(source
            .map(value => String(value || '').trim().toLowerCase())
            .filter(value => SUPPORTED_TAG_SET.has(value))));
    }

    function shouldFilterAutoMissionPicker(picker = null) {
        const normalized = picker && typeof picker === 'object' ? picker : {};
        const baseType = String(normalized.baseType || '').trim().toLowerCase();
        const category = String(normalized.category || 'all').trim().toLowerCase();
        const profileId = String(normalized.profile || 'auto').trim().toLowerCase();
        return SUPPORTED_BASE_TYPES.has(baseType) && category === 'all' && profileId === 'auto';
    }

    function getMissionSelectionMinimumPassengerCount({ baseType = 'apt', category = 'all', profileId = 'auto' } = {}) {
        const normalizedBaseType = String(baseType || 'apt').trim().toLowerCase();
        const normalizedCategory = String(category || 'all').trim().toLowerCase();
        const normalizedProfileId = String(profileId || 'auto').trim().toLowerCase();
        if (ZERO_PAX_PROFILES.has(normalizedProfileId)) return 0;
        if (SINGLE_PAX_PROFILES.has(normalizedProfileId)) return 1;
        if (normalizedProfileId !== 'auto') return null;
        if (normalizedBaseType === 'apt') {
            if (normalizedCategory === 'cargo') return 0;
            if (['charter', 'trn', 'private', 'club'].includes(normalizedCategory)) return 1;
        }
        if (normalizedBaseType === 'poi' && normalizedCategory === 'trn') return 1;
        return null;
    }

    function getAutoMissionCandidatePool({
        baseType = 'apt',
        aircraftTags = [],
        aircraftClass = 'other',
        allowSarHeli = false,
        passengerCapacity = null
    } = {}) {
        const normalizedBaseType = String(baseType || '').trim().toLowerCase();
        const normalizedTags = normalizeAircraftMissionTags(aircraftTags);
        const normalizedClass = String(aircraftClass || 'other').trim().toLowerCase();
        const normalizedPassengerCapacity = passengerCapacity !== null
            && passengerCapacity !== undefined
            && passengerCapacity !== ''
            && Number.isFinite(Number(passengerCapacity))
            ? Math.max(0, Math.min(6, Math.round(Number(passengerCapacity))))
            : null;
        if (!SUPPORTED_BASE_TYPES.has(normalizedBaseType)) {
            return { restricted: false, baseType: normalizedBaseType, tags: normalizedTags, candidates: [] };
        }
        const capacityOnlyRestriction = !normalizedTags.length && normalizedPassengerCapacity === 0;
        if (!normalizedTags.length && !capacityOnlyRestriction) {
            return { restricted: false, baseType: normalizedBaseType, tags: [], candidates: [] };
        }

        const merged = new Map();
        const activeTags = normalizedTags.length ? normalizedTags : SUPPORTED_TAGS;
        activeTags.forEach(tagId => {
            const specs = AUTO_PROFILE_MATRIX[normalizedBaseType]?.[tagId] || [];
            specs.forEach(spec => {
                const category = String(spec.category || 'all').toLowerCase();
                const profileId = String(spec.profileId || 'auto').toLowerCase();
                const minimumPassengerCount = getMissionSelectionMinimumPassengerCount({
                    baseType: normalizedBaseType,
                    category,
                    profileId
                });
                if (normalizedPassengerCapacity !== null
                    && Number.isFinite(minimumPassengerCount)
                    && minimumPassengerCount > normalizedPassengerCapacity) {
                    return;
                }
                const key = `${category}::${profileId}`;
                const current = merged.get(key) || {
                    key,
                    category,
                    profileId,
                    minimumPassengerCount,
                    weight: 0,
                    sourceTags: []
                };
                current.weight += Math.max(1, Math.round(Number(spec.weight) || 1));
                if (!current.sourceTags.includes(tagId)) current.sourceTags.push(tagId);
                merged.set(key, current);
            });
        });

        if (normalizedBaseType === 'poi'
            && normalizedTags.includes('utility')
            && normalizedClass === 'heli'
            && allowSarHeli
            && (normalizedPassengerCapacity === null || normalizedPassengerCapacity >= 1)) {
            merged.set('all::sar_heli', {
                key: 'all::sar_heli',
                category: 'all',
                profileId: 'sar_heli',
                minimumPassengerCount: 1,
                weight: 2,
                sourceTags: ['utility']
            });
        }

        return {
            restricted: true,
            baseType: normalizedBaseType,
            tags: normalizedTags,
            capacityOnlyRestriction,
            candidates: Array.from(merged.values()).map(candidate => ({
                ...candidate,
                sourceTags: [...candidate.sourceTags]
            }))
        };
    }

    return Object.freeze({
        SUPPORTED_TAGS,
        AUTO_PROFILE_MATRIX,
        normalizeAircraftMissionTags,
        shouldFilterAutoMissionPicker,
        getMissionSelectionMinimumPassengerCount,
        getAutoMissionCandidatePool
    });
});
