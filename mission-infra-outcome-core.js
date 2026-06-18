(function() {
    'use strict';

    const SCHEMA = 'ga.infraInspectionOutcome.v1';
    const OUTCOME_TYPES = new Set(['clear', 'monitor', 'minor_damage', 'major_damage', 'blocked_access']);

    function nowMs() { return Date.now(); }

    function cleanText(value = '', max = 600) {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
    }

    function stableHash(text = '') {
        let h = 2166136261;
        const s = String(text || '');
        for (let i = 0; i < s.length; i += 1) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h.toString(36);
    }

    function seededUnit(text = '') {
        const raw = parseInt(stableHash(text || String(nowMs())), 36);
        return Number.isFinite(raw) ? (raw % 10000) / 10000 : Math.random();
    }

    function normalizeOutcomeType(value = '') {
        const s = String(value || '').trim().toLowerCase();
        const mapped = {
            all_clear: 'clear',
            clear: 'clear',
            ok: 'clear',
            monitor_only: 'monitor',
            pending: 'monitor',
            minor: 'minor_damage',
            minor_service: 'minor_damage',
            damage: 'major_damage',
            damaged: 'major_damage',
            technician_needed: 'major_damage',
            blocked: 'blocked_access',
            blocked_access: 'blocked_access'
        }[s] || s;
        return OUTCOME_TYPES.has(mapped) ? mapped : '';
    }

    function missionText(md = null) {
        return cleanText([
            md?.mission,
            md?.title,
            md?.story,
            md?.missionStory,
            md?.sceneIntent?.summary,
            md?.sceneIntent?.notes,
            md?.missionPlanV2?.plan?.primaryObjective,
            md?.missionPlanV2?.plan?.missionTrigger,
            md?.missionPlanV2?.plan?.storyFrame?.trigger,
            md?.missionPlanV2?.plan?.storyFrame?.incidentContext,
            md?.missionContractV4?.plan?.storyFrame?.incidentContext,
            md?.passenger?.role
        ].filter(Boolean).join(' '), 3000).toLowerCase();
    }

    function taskDomainOf(md = null) {
        return String(
            md?.passenger?.taskDomain
            || md?.missionContract?.taskDomain
            || md?.missionPlanV2?.plan?.taskDomain
            || md?._appliedProfile
            || ''
        ).trim().toLowerCase();
    }

    function profileOf(md = null) {
        return String(
            md?._appliedProfile
            || md?._requestedProfile
            || md?.missionContract?.appliedProfileId
            || ''
        ).trim().toLowerCase();
    }

    function isInspectionMission(md = null) {
        if (!md || typeof md !== 'object') return false;
        return taskDomainOf(md) === 'inspection_infra' || profileOf(md) === 'inspection_infra';
    }

    function targetCategoryOf(md = null) {
        const raw = String(
            md?.poiCategory
            || md?.requestedCategory
            || md?.missionContract?.missionPlanV2?.plan?.targetCategory
            || md?.missionPlanV2?.plan?.targetCategory
            || md?.cat
            || 'generic'
        ).trim().toLowerCase();
        if (/wind/.test(raw)) return 'wind';
        if (/solar|pv|photovolta/.test(raw)) return 'solar';
        if (/power|telecom|mast|line|substation|utility/.test(raw)) return 'power';
        if (/bridge|brueck|bruck/.test(raw)) return 'bridge';
        if (/dam|talsperre|stausee|water|hydro/.test(raw)) return 'dam';
        if (/road|strass|street|highway/.test(raw)) return 'road';
        if (/rail|bahn/.test(raw)) return 'rail';
        if (/industry|industrial|factory|plant/.test(raw)) return 'industry';
        return raw || 'generic';
    }

    function inferTargetFamily(md = null) {
        const category = targetCategoryOf(md);
        const text = missionText(md);
        if (/\b(windpark|windkraft|windrad|windturbine|wind farm|windenergie)\b/.test(text)) return 'wind';
        if (/\b(solarpark|solaranlage|photovoltaik|pv|modulreihe|wechselrichter)\b/.test(text)) return 'solar';
        if (/\b(umspannwerk|substation|freileitung|hochspannung|stromtrasse|strommast|leitung|trafopunkt|transformator|trafo|energienetz)\b/.test(text)) return 'power';
        if (/\b(brueck|bruck|bridge|ueberfuehr|überführ|viadukt)\b/.test(text)) return 'bridge';
        if (/\b(staudamm|talsperre|stausee|wehr|damm|hydro|wasserkraft)\b/.test(text)) return 'dam';
        if (/\b(strasse|straße|fahrbahn|zufahrt|bundesstrasse|landstrasse|road|highway)\b/.test(text)) return 'road';
        if (/\b(gleis|bahn|rail|schiene|trasse)\b/.test(text)) return 'rail';
        if (/\b(werk|industrie|anlage|factory|plant|lager|depot)\b/.test(text)) return 'industry';
        return category;
    }

    function damageTypeFor(md = null, type = '') {
        const text = missionText(md);
        const family = inferTargetFamily(md);
        if (type === 'blocked_access') return 'access_blocked';
        if (/\b(rauch|smoke|qualm|brand|heiss|heiß|thermal|hitze|kurzschluss|trafo|transformator|wechselrichter)\b/.test(text)) return 'electrical_fault';
        if (/\b(sturm|baum|ast|treibgut|ladung|kisten|blockiert|blockade|hindernis)\b/.test(text)) return 'debris_blockage';
        if (/\b(riss|korrosion|lager|fuge|beton|unterspuel|unterspül|auswasch|erosion)\b/.test(text)) return 'structural_wear';
        if (family === 'power' || family === 'solar' || family === 'wind') return 'equipment_fault';
        if (family === 'road' || family === 'rail') return 'route_obstruction';
        if (family === 'dam') return 'water_structure_wear';
        if (family === 'bridge') return 'structural_wear';
        return 'visible_anomaly';
    }

    function chooseOutcome(md = null) {
        const forced = normalizeOutcomeType(
            md?.infraInspectionOutcome?.outcome
            || md?.infraInspectionOutcome?.type
            || md?.hiddenMissionOutcome?.infraInspectionOutcome?.outcome
            || (typeof window !== 'undefined' ? window.gaDebugInfraInspectionOutcomeOverride : '')
        );
        if (forced) return forced;
        const text = missionText(md);
        const key = [
            md?.missionId,
            md?.missionKey,
            md?.mission,
            md?.targetName,
            md?.initialTargetLat,
            md?.initialTargetLon,
            targetCategoryOf(md),
            text
        ].filter(Boolean).join('|');
        let roll = seededUnit(key || String(nowMs()));
        let weights = [
            ['clear', 0.26],
            ['monitor', 0.22],
            ['minor_damage', 0.32],
            ['major_damage', 0.14],
            ['blocked_access', 0.06]
        ];
        if (/\b(schaden|damage|defekt|stoer|stör|rauch|smoke|block|hindernis|baum|sturm|unterspuel|unterspül|korrosion|riss|ausfall)\b/.test(text)) {
            weights = [
                ['clear', 0.12],
                ['monitor', 0.18],
                ['minor_damage', 0.38],
                ['major_damage', 0.22],
                ['blocked_access', 0.10]
            ];
        } else if (/\b(routine|turnus|regelmaess|regelmäß|sichtpruef|sichtprüf|kontroll)\b/.test(text)) {
            weights = [
                ['clear', 0.36],
                ['monitor', 0.24],
                ['minor_damage', 0.28],
                ['major_damage', 0.08],
                ['blocked_access', 0.04]
            ];
        }
        for (const [type, weight] of weights) {
            roll -= weight;
            if (roll <= 0) return type;
        }
        return 'minor_damage';
    }

    function sceneDirectiveFor(md = null, type = '', damageType = '') {
        const family = inferTargetFamily(md);
        const sparse = type === 'clear' ? 'sparse' : (type === 'major_damage' || type === 'blocked_access' ? 'normal' : 'sparse');
        const hasSmoke = damageType === 'electrical_fault' && (type === 'major_damage' || type === 'minor_damage');
        const pick = (sceneKind, base = [], damaged = [], major = []) => {
            let features = [...base];
            if (type === 'monitor') features = [...features, 'cones'];
            if (type === 'minor_damage' || type === 'major_damage' || type === 'blocked_access') features = [...features, ...damaged];
            if (type === 'major_damage' || type === 'blocked_access') features = [...features, ...major];
            if (hasSmoke) features.push('smoke_light');
            return {
                sceneKind,
                sceneDensity: sparse,
                objectFamilies: Array.from(new Set(features.filter(Boolean))).slice(0, 8),
                placementPolicy: scenePlacementPolicy(family, type, damageType)
            };
        };
        if (family === 'wind') return pick('wind_turbine_site', ['wind_turbine'], ['utility_truck', 'cones'], ['generator']);
        if (family === 'solar') return pick('industry_site', [], ['utility_truck', 'cones'], ['generator']);
        if (family === 'power' || family === 'telecom') return pick('powerline_inspection', ['powerline'], ['utility_truck', 'cones'], ['generator']);
        if (family === 'bridge') return pick('infra_bridge', [], ['utility_truck', 'cones'], ['debris']);
        if (family === 'dam' || family === 'water') return pick('infra_dam', [], ['generator', 'cones'], ['watercraft', 'debris']);
        if (family === 'road') return pick('road_incident', [], ['cones', damageType === 'debris_blockage' ? 'logs' : 'debris'], ['road_vehicles']);
        if (family === 'rail' || family === 'infrastructure') return pick('survey_context', [], ['utility_truck', 'cones', 'small_equipment'], ['debris']);
        if (family === 'industry') return pick('industry_site', [], ['utility_truck', 'cones'], ['generator', 'cargo_material']);
        return pick('survey_context', [], ['utility_truck', 'cones'], ['debris']);
    }

    function scenePlacementPolicy(family = 'generic', type = 'clear', damageType = '') {
        const severity = type === 'clear'
            ? 'Unauffaellige Referenzszene'
            : (type === 'monitor'
                ? 'Markierte Beobachtungsstelle'
                : (type === 'major_damage' || type === 'blocked_access'
                    ? 'Deutlich sichtbarer Befundbereich'
                    : 'Kleiner sichtbarer Befund'));
        const target = {
            bridge: 'am Bauwerk oder an der Zufahrt',
            dam: 'am Damm, Auslauf oder Ufer',
            road: 'entlang der Fahrbahn oder Zufahrt',
            rail: 'entlang der Trasse',
            power: 'an Trasse, Mast oder Technikpunkt',
            solar: 'am Rand der Modul-/Technikflaeche',
            wind: 'am Windenergie-Ziel oder Wartungsweg',
            industry: 'am Werks-/Technikbereich'
        }[family] || 'nahe am Infrastrukturziel';
        const damage = (type !== 'clear' && damageType) ? ` Befundtyp: ${damageLabelFor(damageType)}.` : '';
        return `${severity} ${target}; sparsam platzieren und nicht als Rettungs-/SAR-Lage erzaehlen.${damage}`;
    }

    function damageLabelFor(type = '') {
        return {
            access_blocked: 'blockierte Zufahrt oder Arbeitsflaeche',
            debris_blockage: 'Hindernis oder Treibgut im Zugangsbereich',
            electrical_fault: 'technische oder elektrische Auffaelligkeit',
            equipment_fault: 'Auffaelligkeit an der technischen Anlage',
            route_obstruction: 'Hindernis oder Schadstelle an der Trasse',
            structural_wear: 'struktureller Verschleiss',
            water_structure_wear: 'Verschleiss am Wasserbauwerk',
            visible_anomaly: 'sichtbare Auffaelligkeit'
        }[String(type || '').toLowerCase()] || 'sichtbare Auffaelligkeit';
    }

    function labelFor(type = '') {
        return {
            clear: 'Inspektion unauffaellig',
            monitor: 'Beobachtung empfohlen',
            minor_damage: 'Kleiner Schadenshinweis',
            major_damage: 'Deutlicher Schadensbefund',
            blocked_access: 'Zugang oder Trasse blockiert'
        }[type] || 'Inspektionsbefund';
    }

    function resultTextFor(md = null, type = '', damageType = '') {
        const target = cleanText(md?.targetName || md?.poiName || md?.initialTargetName || 'dem Zielobjekt', 140);
        if (type === 'clear') {
            return `Die Sichtpruefung bei ${target} ist unauffaellig: keine akuten Risse, Blockaden oder technischen Warnzeichen aus der Luft erkennbar.`;
        }
        if (type === 'monitor') {
            return `Bei ${target} bleibt ein kleiner unklarer Punkt fuer die Beobachtung: heute keine akute Sperrung, aber eine spaetere Nachpruefung ist sinnvoll.`;
        }
        if (type === 'blocked_access') {
            return `Bei ${target} wirkt eine Zufahrt, Trasse oder Arbeitsflaeche blockiert; der Befund sollte gezielt kartiert und an die Bodenteams weitergegeben werden.`;
        }
        if (type === 'major_damage') {
            return `Bei ${target} ist ein deutlicher Befund sichtbar; vor einer Freigabe braucht es gezielte Dokumentation und technische Nacharbeit. Schwerpunkt ist ${damageLabelFor(damageType)}.`;
        }
        return `Bei ${target} ist ein begrenzter Befund sichtbar; die Stelle sollte dokumentiert und spaeter kontrolliert werden. Schwerpunkt ist ${damageLabelFor(damageType)}.`;
    }

    function resultPromptFor(md = null, type = '', damageType = '') {
        const target = cleanText(md?.targetName || md?.poiName || md?.initialTargetName || 'dem Zielobjekt', 140);
        if (type === 'clear') {
            return `Inspektionsfazit: Bei "${target}" konntest du keinen relevanten Schaden erkennen. Nenne kurz, welche kritischen Punkte sauber aussehen und dass vorerst keine akute Reparatur noetig wirkt.`;
        }
        if (type === 'monitor') {
            return `Inspektionsfazit: Bei "${target}" ist nur eine unklare oder kleine Auffaelligkeit offen. Sage, was unauffaellig wirkt, was beobachtet werden sollte und dass eine spaetere Nachpruefung reicht.`;
        }
        if (type === 'blocked_access') {
            return `Inspektionsfazit: Bei "${target}" wirkt eine Zufahrt, Trasse oder Arbeitsflaeche blockiert. Beschreibe den sichtbaren Befund kurz und dass daraus eine gezielte Dokumentations- oder Raeumungspruefung folgt.`;
        }
        if (type === 'major_damage') {
            return `Inspektionsfazit: Bei "${target}" hast du einen klaren Schaden gesehen. Sage konkret, was betroffen wirkt, wie ernst es aussieht und dass der Befund weiter dokumentiert oder technisch geprueft werden muss.`;
        }
        return `Inspektionsfazit: Bei "${target}" hast du eine begrenzte Schadstelle gesehen. Nenne kurz, was betroffen wirkt, dass keine Panik noetig ist, aber eine gezielte Dokumentation oder Nachpruefung folgen sollte.`;
    }

    function followUpFor(type = '') {
        if (type === 'clear') return { followUpKind: 'none', followUpLabel: '' };
        if (type === 'monitor') {
            return {
                followUpKind: 'infra_recheck',
                followUpLabel: 'Infra-Nachprüfung',
                followUpProfileId: 'inspection_infra',
                followUpCategory: null,
                delayDays: 3
            };
        }
        return {
            followUpKind: 'infra_damage_mapping',
            followUpLabel: type === 'blocked_access' ? 'Blockade-Kartierung' : 'Schadenskartierung',
            followUpProfileId: 'mapping_survey',
            followUpCategory: null,
            delayDays: type === 'major_damage' || type === 'blocked_access' ? 1 : 2
        };
    }

    function buildChain(idSeed = '', step = '', previousStep = '', depth = 1, terminal = false) {
        return {
            schema: 'ga.followup.chain.v1',
            id: `infra_chain_${stableHash(idSeed || [step, nowMs()].join('|'))}`,
            rootSourceKind: 'inspection_infra',
            parentRequestId: null,
            step,
            previousStep,
            depth: Math.max(1, Math.round(Number(depth || 1))),
            terminal: !!terminal
        };
    }

    function normalizeRef(ref = null) {
        if (!ref || typeof ref !== 'object') return null;
        const lat = Number(ref.lat);
        const lon = Number(ref.lon ?? ref.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const kind = ['airport', 'poi', 'area', 'route_point'].includes(String(ref.kind || '').toLowerCase())
            ? String(ref.kind || '').toLowerCase()
            : 'airport';
        const id = String(ref.icao || ref.id || (kind === 'poi' ? 'POI' : '')).trim().toUpperCase();
        return {
            kind,
            icao: id,
            id,
            name: cleanText(ref.name || ref.n || id || 'Ziel', 140),
            lat,
            lon,
            elevation: Number.isFinite(Number(ref.elevation)) ? Math.round(Number(ref.elevation)) : null,
            category: cleanText(ref.category || ref.poiCategory || '', 40)
        };
    }

    function targetRefFromMission(md = null) {
        return normalizeRef({
            kind: 'poi',
            id: 'POI',
            icao: 'POI',
            name: md?.targetName || md?.poiName || md?.initialTargetName || 'Infrastrukturziel',
            lat: md?.targetLat ?? md?.initialTargetLat,
            lon: md?.targetLon ?? md?.initialTargetLon,
            elevation: md?.targetElevation || md?.poiTerrainFt || null,
            category: targetCategoryOf(md),
            poiCategory: targetCategoryOf(md)
        });
    }

    function homeRefFromMission(md = null) {
        return normalizeRef({
            kind: 'airport',
            icao: md?.start || md?.dep || md?.departure || md?.initialStart || '',
            name: md?.startName || md?.initialStartName || md?.departureName || md?.start || '',
            lat: md?.initialStartLat ?? md?.startLat,
            lon: md?.initialStartLon ?? md?.startLon,
            elevation: md?.startElevation || null
        });
    }

    function normalizeInspectionOutcome(raw = null, md = null, options = {}) {
        if (!isInspectionMission(md) && !raw && !options.force) return null;
        const type = normalizeOutcomeType(options.outcome || raw?.outcome || raw?.type) || chooseOutcome(md);
        const damageType = cleanText(raw?.damageType || options.damageType || damageTypeFor(md, type), 80);
        const scene = sceneDirectiveFor(md, type, damageType);
        const follow = followUpFor(type);
        const category = targetCategoryOf(md);
        if (!follow.followUpCategory) follow.followUpCategory = category && category !== 'generic' ? category : 'infrastructure';
        return {
            ...(raw && typeof raw === 'object' ? raw : {}),
            schema: SCHEMA,
            outcome: type,
            type,
            label: labelFor(type),
            severity: type === 'clear' ? 'none' : (type === 'monitor' ? 'low' : (type === 'minor_damage' ? 'medium' : 'high')),
            damageType,
            targetCategory: category,
            targetFamily: inferTargetFamily(md),
            resultText: cleanText(raw?.resultText || resultTextFor(md, type, damageType), 620),
            resultPrompt: cleanText(raw?.resultPrompt || resultPromptFor(md, type, damageType), 620),
            sceneProfile: scene,
            followUpKind: follow.followUpKind,
            followUpLabel: follow.followUpLabel,
            followUpProfileId: follow.followUpProfileId || '',
            followUpCategory: follow.followUpCategory || category || 'infrastructure',
            followUpDelayDays: follow.delayDays || 0,
            hiddenFromWriter: true,
            revealAfter: 'inspection_complete',
            createdAt: Number(raw?.createdAt || options.createdAt || nowMs())
        };
    }

    function ensureInspectionOutcome(md = null, options = {}) {
        if (!md || typeof md !== 'object' || !isInspectionMission(md)) return null;
        const existing = (md.infraInspectionOutcome && typeof md.infraInspectionOutcome === 'object')
            ? md.infraInspectionOutcome
            : (md.hiddenMissionOutcome?.infraInspectionOutcome && typeof md.hiddenMissionOutcome.infraInspectionOutcome === 'object'
                ? md.hiddenMissionOutcome.infraInspectionOutcome
                : null);
        const normalized = normalizeInspectionOutcome(existing, md, {
            outcome: options.outcome,
            force: true,
            createdAt: existing?.createdAt || options.createdAt
        });
        if (normalized) {
            md.infraInspectionOutcome = normalized;
            md.hiddenMissionOutcome = {
                ...(md.hiddenMissionOutcome && typeof md.hiddenMissionOutcome === 'object' ? md.hiddenMissionOutcome : {}),
                infraInspectionOutcome: normalized
            };
        }
        return normalized;
    }

    function getMissionPlanObject(missionPlanV2 = null) {
        if (!missionPlanV2 || typeof missionPlanV2 !== 'object') return null;
        if (missionPlanV2.plan && typeof missionPlanV2.plan === 'object') return missionPlanV2.plan;
        return missionPlanV2;
    }

    function applyOutcomeToMission(md = null, outcome = null) {
        if (!md || typeof md !== 'object') return null;
        const out = outcome || ensureInspectionOutcome(md);
        if (!out || !out.sceneProfile) return out || null;
        const scene = out.sceneProfile;
        const plan = getMissionPlanObject(md.missionPlanV2);
        if (plan) {
            plan.sceneKind = scene.sceneKind;
            plan.sceneDensity = scene.sceneDensity || plan.sceneDensity || 'sparse';
            plan.objectFamilies = Array.from(new Set([
                ...(Array.isArray(scene.objectFamilies) ? scene.objectFamilies : [])
            ])).slice(0, 8);
            plan.placementPolicy = scene.placementPolicy || plan.placementPolicy || '';
            plan.narrativeRules = Array.from(new Set([
                ...(Array.isArray(plan.narrativeRules) ? plan.narrativeRules : []),
                'Der konkrete Inspektionsausgang ist erst nach Abschluss bekannt und darf im Briefing nicht vorweggenommen werden.'
            ])).slice(0, 10);
        }
        md.infraInspectionSceneDirective = scene;
        return out;
    }

    function nextMorningAt(hour = 8, days = 1) {
        const d = new Date(nowMs());
        d.setDate(d.getDate() + Math.max(0, Math.round(Number(days || 0))));
        d.setHours(hour, 0, 0, 0);
        if (d.getTime() <= nowMs()) d.setDate(d.getDate() + 1);
        return d.getTime();
    }

    function buildTemporalContext(outcome = null, md = null) {
        const days = Math.max(1, Math.round(Number(outcome?.followUpDelayDays || 2)));
        const eligibleAt = nextMorningAt(8, days);
        const target = cleanText(md?.targetName || md?.poiName || 'dem Ziel', 120);
        const stayText = outcome?.outcome === 'monitor'
            ? 'ein paar Tage Beobachtungszeit'
            : (days <= 1 ? 'Auswertung bis morgen früh' : `Auswertung in ${days} Tagen`);
        return {
            sourceKind: 'inspection_infra',
            stayDays: days,
            stayText,
            createdAt: nowMs(),
            followUpEligibleAt: eligibleAt,
            eligibleAt,
            deboardingHint: outcome?.followUpKind && outcome.followUpKind !== 'none'
                ? `Der Befund bei ${target} wird ausgewertet; daraus kann ${outcome.followUpLabel || 'eine Folgemission'} entstehen.`
                : ''
        };
    }

    function buildNarrativeMemory(md = null, outcome = null) {
        const target = cleanText(md?.targetName || md?.poiName || md?.initialTargetName || 'das Infrastrukturziel', 140);
        const result = cleanText(outcome?.resultText || '', 600);
        const followLabel = outcome?.followUpLabel || 'Folgeflug';
        return {
            schema: 'ga.infra.followup.memory.v1',
            outboundPurpose: cleanText(md?.story || md?.missionStory || '', 900),
            stayOrWorkSummary: result,
            whyNowReturn: outcome?.followUpKind === 'infra_recheck'
                ? `Die Leitstelle will den Befund bei ${target} nach etwas Beobachtungszeit erneut aus der Luft bewerten.`
                : `Der Befund bei ${target} soll sauber dokumentiert werden, bevor Bodenarbeiten oder Freigaben entschieden werden.`,
            returnReason: `${followLabel} zu ${target}`,
            sourceOutcomeLabel: outcome?.label || '',
            sourceOutcomeText: result,
            followUpPurpose: outcome?.followUpKind === 'infra_recheck'
                ? 'Nachpruefung eines beobachtungswuerdigen Infrastruktur-Befunds.'
                : 'Gezielte Dokumentation eines bei der Infrastruktur-Inspektion erkannten Befunds.',
            nextStepSuggestions: [
                'Schadenskartierung mit Mapping/Survey',
                'Foto-Dokumentation laufender Reparaturen',
                'Abschlussbegutachtung nach gemeldeter Reparatur'
            ]
        };
    }

    function buildFollowupConfigForMission(md = null) {
        if (!isInspectionMission(md)) return null;
        const outcome = ensureInspectionOutcome(md);
        if (!outcome || !outcome.followUpKind || outcome.followUpKind === 'none') return null;
        const homeRef = homeRefFromMission(md);
        const targetRef = targetRefFromMission(md);
        if (!homeRef || !targetRef) return null;
        const temporalContext = buildTemporalContext(outcome, md);
        const narrativeMemory = buildNarrativeMemory(md, outcome);
        return {
            followUpKind: outcome.followUpKind,
            followUpLabel: outcome.followUpLabel || 'Infra-Folgeflug',
            sourceLabel: 'Infrastruktur-Inspektion',
            followUpProfileId: outcome.followUpProfileId || 'mapping_survey',
            followUpCategory: outcome.followUpCategory || targetRef.category || 'infrastructure',
            homeRef,
            targetRef,
            temporalContext,
            narrativeMemory,
            infraInspectionOutcome: outcome,
            poiFollowUp: true,
            chain: buildChain(
                [md?.missionId, md?.missionKey, targetRef.name, outcome.followUpKind].filter(Boolean).join('|'),
                outcome.followUpKind === 'infra_recheck' ? 'recheck' : 'damage_mapping',
                'inspection',
                1,
                outcome.followUpKind === 'infra_recheck'
            )
        };
    }

    function buildChainTemporalContext(kind = '', days = 2, targetName = 'dem Ziel') {
        const cleanTarget = cleanText(targetName || 'dem Ziel', 120);
        const stayText = kind === 'infra_repair_photo'
            ? 'Reparaturvorbereitung und erste Arbeiten'
            : (kind === 'infra_final_review' ? 'Abschlussarbeiten vor der Freigabe' : `${days} Tage Auswertung`);
        const eligibleAt = nextMorningAt(8, days);
        return {
            sourceKind: 'inspection_infra',
            stayDays: days,
            stayText,
            createdAt: nowMs(),
            followUpEligibleAt: eligibleAt,
            eligibleAt,
            deboardingHint: kind === 'infra_repair_photo'
                ? `Nach der Kartierung bei ${cleanTarget} kann eine Foto-Dokumentation der laufenden Reparatur entstehen.`
                : `Nach den Arbeiten bei ${cleanTarget} kann eine Abschlussbegutachtung aus der Luft folgen.`
        };
    }

    function buildAllowedChainConfig(md = null, cargoOutcome = null) {
        if (!md || typeof md !== 'object') return null;
        if (cargoOutcome && cargoOutcome.failed === true) return null;
        if (md.missionFailed === true || String(md.missionResult || '').toLowerCase() === 'failed') return null;
        const cont = md.followUpContinuation && typeof md.followUpContinuation === 'object' ? md.followUpContinuation : null;
        if (!cont) return null;
        const chain = cont.chain && typeof cont.chain === 'object' ? cont.chain : null;
        const root = String(cont.sourceKind || chain?.rootSourceKind || '').toLowerCase();
        const currentKind = String(cont.followUpKind || '').toLowerCase();
        const depth = Math.max(1, Math.round(Number(chain?.depth || 1)));
        if (root !== 'inspection_infra' || depth >= 3) return null;
        const homeRef = normalizeRef(cont.returnHomeRef || cont.acceptance?.returnHomeRef || cont.startRef || null);
        const targetRef = normalizeRef(cont.targetRef || cont.acceptance?.targetRef || null);
        if (!homeRef || !targetRef) return null;
        const targetName = targetRef.name || md.targetName || 'Infrastrukturziel';
        const outcome = cont.narrativeMemory?.infraInspectionOutcome
            || md.followUpContext?.infraInspectionOutcome
            || md.infraInspectionOutcome
            || null;
        if (currentKind === 'infra_damage_mapping') {
            const temporalContext = buildChainTemporalContext('infra_repair_photo', 2, targetName);
            return {
                followUpKind: 'infra_repair_photo',
                sourceKind: 'inspection_infra',
                followUpLabel: 'Reparatur-Fotodoku',
                sourceLabel: 'Infra-Schadenskartierung',
                followUpProfileId: 'media_photo',
                followUpCategory: targetRef.category || md.poiCategory || md.requestedCategory || md.cat || md.category || 'infrastructure',
                homeRef,
                targetRef,
                temporalContext,
                infraInspectionOutcome: outcome,
                poiFollowUp: true,
                chain: {
                    ...(chain || buildChain([md.missionId, targetName].join('|'), 'repair_photo', 'damage_mapping', 2, false)),
                    parentRequestId: cont.requestId || md.followUpRequestId || null,
                    step: 'repair_photo',
                    previousStep: 'damage_mapping',
                    depth: depth + 1,
                    terminal: false
                },
                narrativeMemory: {
                    ...(cont.narrativeMemory || {}),
                    infraInspectionOutcome: outcome,
                    sourceOutcomeText: cleanText(cont.narrativeMemory?.sourceOutcomeText || outcome?.resultText || md.story || '', 800),
                    stayOrWorkSummary: `Die Kartierung bei ${targetName} ist ausgewertet; jetzt sollen laufende Sicherungs- oder Reparaturarbeiten fotografisch dokumentiert werden.`,
                    whyNowReturn: `Nach der Kartierung ist klar, welche Stelle bei ${targetName} fuer die Reparaturdokumentation ins Bild muss.`,
                    followUpPurpose: 'Foto-Dokumentation laufender Reparatur- oder Sicherungsarbeiten.',
                    nextStepSuggestions: ['Abschlussbegutachtung nach Reparatur']
                }
            };
        }
        if (currentKind === 'infra_repair_photo') {
            const temporalContext = buildChainTemporalContext('infra_final_review', 2, targetName);
            return {
                followUpKind: 'infra_final_review',
                sourceKind: 'inspection_infra',
                followUpLabel: 'Abschlussbegutachtung',
                sourceLabel: 'Infra-Reparatur-Fotodoku',
                followUpProfileId: 'inspection_infra',
                followUpCategory: targetRef.category || md.poiCategory || md.requestedCategory || md.cat || md.category || 'infrastructure',
                homeRef,
                targetRef,
                temporalContext,
                infraInspectionOutcome: outcome,
                poiFollowUp: true,
                chain: {
                    ...(chain || buildChain([md.missionId, targetName].join('|'), 'final_review', 'repair_photo', 3, true)),
                    parentRequestId: cont.requestId || md.followUpRequestId || null,
                    step: 'final_review',
                    previousStep: 'repair_photo',
                    depth: depth + 1,
                    terminal: true
                },
                narrativeMemory: {
                    ...(cont.narrativeMemory || {}),
                    infraInspectionOutcome: outcome,
                    sourceOutcomeText: cleanText(cont.narrativeMemory?.sourceOutcomeText || outcome?.resultText || md.story || '', 800),
                    stayOrWorkSummary: `Die Reparaturdokumentation bei ${targetName} ist abgeschlossen; jetzt braucht es eine ruhige Abschlussbegutachtung aus der Luft.`,
                    whyNowReturn: `Vor der Freigabe soll ${targetName} noch einmal aus derselben fachlichen Perspektive betrachtet werden.`,
                    followUpPurpose: 'Abschlussbegutachtung nach dokumentierter Reparatur.',
                    nextStepSuggestions: []
                }
            };
        }
        return null;
    }

    function buildProspectForMission(md = null) {
        const cfg = buildFollowupConfigForMission(md);
        if (!cfg) return null;
        return {
            schema: 'ga.followup.prospect.v1',
            sourceKind: 'inspection_infra',
            followUpKind: cfg.followUpKind,
            followUpLabel: cfg.followUpLabel,
            sourceLabel: cfg.sourceLabel,
            followUpProfileId: cfg.followUpProfileId,
            followUpCategory: cfg.followUpCategory,
            temporalContext: cfg.temporalContext,
            stayDays: cfg.temporalContext?.stayDays || null,
            stayText: cfg.temporalContext?.stayText || '',
            eligibleAt: cfg.temporalContext?.followUpEligibleAt || null,
            deboardingHint: cfg.temporalContext?.deboardingHint || '',
            infraInspectionOutcome: cfg.infraInspectionOutcome,
            createdAt: cfg.temporalContext?.createdAt || nowMs()
        };
    }

    function pickerValueForFollowup(reqOrProfile = null) {
        const req = reqOrProfile && typeof reqOrProfile === 'object' ? reqOrProfile : null;
        const profile = String(req?.followUpProfileId || req?.acceptance?.dispatchProfileId || reqOrProfile || '').trim().toLowerCase();
        if (!profile) return '';
        if (req?.poiFollowUp || req?.route?.targetRef?.kind === 'poi' || /^infra_/.test(String(req?.followUpKind || ''))) {
            const cat = cleanText(req?.followUpCategory || req?.route?.targetRef?.category || 'infrastructure', 40).toLowerCase() || 'infrastructure';
            return `poi:${cat}+${profile}`;
        }
        return '';
    }

    function buildPipelineContext(req = null, context = {}) {
        if (!req || typeof req !== 'object') return null;
        const outcome = req.infraInspectionOutcome || req.narrativeMemory?.infraInspectionOutcome || null;
        const targetRef = req.route?.targetRef || null;
        const homeRef = req.route?.homeRef || null;
        const targetName = cleanText(targetRef?.name || 'Infrastrukturziel', 140);
        const departureName = cleanText(context.start?.n || context.start?.name || context.start?.icao || homeRef?.name || homeRef?.icao || 'Startplatz', 120);
        const followUpKind = String(req.followUpKind || '').toLowerCase();
        const profileId = String(req.followUpProfileId || req.acceptance?.dispatchProfileId || (followUpKind === 'infra_recheck' ? 'inspection_infra' : 'mapping_survey')).toLowerCase();
        const sourceText = cleanText(outcome?.resultText || req.narrativeMemory?.sourceOutcomeText || 'Die vorherige Infrastruktur-Inspektion hat einen Befund ergeben.', 700);
        const isPhoto = profileId === 'media_photo' || followUpKind === 'infra_repair_photo';
        const focus = isPhoto
            ? `Foto-Dokumentation der Reparatur bei ${targetName}`
            : (profileId === 'inspection_infra'
            ? `Nachpruefung des Befunds bei ${targetName}`
            : `Schadenskartierung bei ${targetName}`);
        return {
            schema: 'ga.followup.pipelineContext.v1',
            requestId: req.id || null,
            sourceKind: req.sourceKind || 'inspection_infra',
            followUpKind,
            effectiveProfileId: profileId,
            acceptanceMode: String(req.acceptance?.mode || req.pilotStartPolicy || 'pickup_from_home').toLowerCase(),
            sourceLabel: req.sourceLabel || 'Infrastruktur-Inspektion',
            followUpLabel: req.followUpLabel || outcome?.followUpLabel || 'Infra-Folgeflug',
            pilotStartPolicy: String(req.acceptance?.mode || req.pilotStartPolicy || 'pickup_from_home').toLowerCase(),
            route: {
                departureName,
                homeName: cleanText(homeRef?.name || homeRef?.icao || 'Basis', 120),
                targetName,
                startRef: req.acceptance?.startRef || homeRef || null,
                returnHomeRef: req.acceptance?.returnHomeRef || homeRef || null,
                targetRef
            },
            sourceMission: {
                title: cleanText(req.source?.title || '', 180),
                story: cleanText(req.source?.story || '', 900)
            },
            temporalContext: req.temporalContext || null,
            infraInspectionOutcome: outcome || null,
            storyFrame: {
                trigger: `Die vorherige Infrastruktur-Inspektion bei ${targetName} hat diesen Folgeauftrag ausgelöst.`,
                focusSubject: focus,
                keyQuestion: isPhoto
                    ? `Welche sichtbaren Reparatur- oder Sicherungsarbeiten bei ${targetName} fuer Bericht und Akte dokumentiert werden muessen.`
                    : (profileId === 'inspection_infra'
                    ? `Ob der Befund bei ${targetName} stabil, verbessert oder kritischer geworden ist.`
                    : `Wie der Befund bei ${targetName} lagegenau dokumentiert werden kann.`),
                stakes: sourceText,
                completionSignal: isPhoto
                    ? `Nach dem Zielgebiet liegt eine verwertbare Bildserie der laufenden Arbeiten bei ${targetName} vor.`
                    : (profileId === 'inspection_infra'
                    ? `Nach dem Zielgebiet liegt eine aktualisierte technische Einschätzung zu ${targetName} vor.`
                    : `Nach dem Zielgebiet liegt eine verwertbare Bild-/Positionsserie zum Befund bei ${targetName} vor.`),
                subjectDetail: sourceText,
                incidentContext: sourceText,
                whyNow: req.narrativeMemory?.whyNowReturn || sourceText,
                soughtOutcome: isPhoto
                    ? `Von ${departureName} zum POI ${targetName}, ruhige Foto-/Filmaufnahme der sichtbaren Arbeiten, danach zurueck.`
                    : (profileId === 'inspection_infra'
                    ? `Von ${departureName} zum POI ${targetName}, ruhige Nachpruefung, danach zurueck.`
                    : `Von ${departureName} zum POI ${targetName}, saubere Survey-/Mapping-Aufnahme des Befunds, danach zurueck.`)
            },
            missionVarietyBrief: {
                purpose: isPhoto
                    ? 'POI-Folgeflug nach Infrastruktur-Kartierung: Foto-Dokumentation sichtbarer Reparatur- oder Sicherungsarbeiten.'
                    : (profileId === 'inspection_infra'
                    ? 'POI-Folgeflug nach Infrastruktur-Inspektion: Nachpruefung eines bekannten Befunds, keine neue Zufallsstory.'
                    : 'POI-Folgeflug nach Infrastruktur-Inspektion: gezielte Mapping-/Survey-Dokumentation eines bekannten Befunds.'),
                recipe: isPhoto
                    ? `Fixes POI-Ziel ${targetName}; Reparatur-/Sicherungsbereich als Bildserie dokumentieren, keine Sightseeing-Tour.`
                    : (profileId === 'inspection_infra'
                    ? `Fixes POI-Ziel ${targetName}; Befund aus der Vorinspektion erneut pruefen und fachlich einordnen.`
                    : `Fixes POI-Ziel ${targetName}; Survey-Pattern/ruhige Zielaufnahme fuer Dokumentation, keine Diagnose-Spekulation ueber das Bekannte hinaus.`),
                coreQuestions: [
                    `Welcher Befund aus der vorherigen Inspektion bei ${targetName} ist der Anlass?`,
                    isPhoto ? 'Welche sichtbaren Arbeiten muessen ins Bild?' : (profileId === 'inspection_infra' ? 'Was muss in der Nachpruefung beobachtet werden?' : 'Welche Daten/Ansichten braucht die Dokumentation?'),
                    'Wie bleibt der Auftrag eine ruhige Luftaufnahme mit anschliessender Rueckkehr zur Basis?'
                ],
                writerExpectations: [
                    'Nutze den bekannten Befund als Anlass, aber erfinde kein neues Schadensbild.',
                    'Kein Spoilerproblem: Dieser Text ist eine Folgemission, der Befund ist jetzt bekannt.',
                    'Keine Bush-, Pickup- oder APT-Charter-Logik.',
                    'Normale deutsche Umlaute verwenden.'
                ]
            }
        };
    }

    function buildDispatchMission(req = null, context = {}) {
        if (!req || typeof req !== 'object') return null;
        const targetRef = req.route?.targetRef || {};
        if (targetRef.kind !== 'poi' && !req.poiFollowUp && !/^infra_/.test(String(req.followUpKind || ''))) return null;
        const pipeline = buildPipelineContext(req, context);
        if (!pipeline) return null;
        const targetName = pipeline.route?.targetName || targetRef.name || 'Infrastrukturziel';
        const profileId = String(req.followUpProfileId || pipeline.effectiveProfileId || 'mapping_survey').toLowerCase();
        const followKind = String(req.followUpKind || '').toLowerCase();
        const isPhoto = profileId === 'media_photo' || followKind === 'infra_repair_photo';
        const isRecheck = profileId === 'inspection_infra' || followKind === 'infra_recheck' || followKind === 'infra_final_review';
        const title = isPhoto
            ? `Reparatur-Fotodoku: ${targetName}`
            : (isRecheck ? (followKind === 'infra_final_review' ? `Abschlussbegutachtung: ${targetName}` : `Nachprüfung: ${targetName}`) : `Schadenskartierung: ${targetName}`);
        const story = isPhoto
            ? `Nach der Kartierung bei ${targetName} sollen die laufenden Reparatur- oder Sicherungsarbeiten fotografisch dokumentiert werden. Es geht nicht um eine neue Schadenssuche, sondern um verwertbare Bildserien fuer Bericht, Bauakte und Abstimmung mit dem Betreiber. Nach der Aufnahme geht es zurueck zur Basis, wo das Material fuer die technische Dokumentation aufbereitet wird.`
            : (isRecheck
            ? `Die vorherige Infrastruktur-Inspektion hat bei ${targetName} einen beobachtungswuerdigen Befund ergeben. Heute geht es um eine ruhige Nachpruefung aus der Luft: gleicher Zielpunkt, gleicher fachlicher Rahmen, aber mit frischem Blick auf den Zustand. Nach der Zielrunde wird der Befund aktualisiert und an das Technikteam gemeldet.`
            : `Aus der letzten Infrastruktur-Inspektion bei ${targetName} ist ein konkreter Dokumentationsauftrag entstanden. Heute brauchen wir eine saubere Mapping-/Survey-Aufnahme des Befunds, damit Planung, Reparatur oder Sperrentscheidung nicht nur auf einer groben Sichtmeldung beruhen. Nach der Datenerfassung geht es zurueck zur Basis und der Datensatz wird an das technische Team uebergeben.`);
        const passenger = isPhoto ? {
            name: 'Lena Vogt',
            role: 'Dokumentations-Fotografin',
            gender: 'female',
            roleProfile: 'media_observer_v1',
            taskDomain: 'media_photo',
            gTolerance: 'niedrig',
            bankTolerance: 'niedrig',
            cargoSensitivity: 'hoch',
            stomachSensitivity: 'mittel',
            comfortPriority: 'hoch',
            urgencyPriority: 'niedrig',
            greetingText: 'Ich brauche heute keine spektakulaeren Bilder, sondern saubere Belegfotos der Arbeiten. Ruhige Winkel und klare Wiedererkennbarkeit sind wichtiger.'
        } : (isRecheck ? {
            name: 'Martin Seidel',
            role: 'Infrastruktur-Techniker',
            gender: 'male',
            roleProfile: 'technical_inspector_v1',
            taskDomain: 'inspection_infra',
            gTolerance: 'niedrig',
            bankTolerance: 'niedrig',
            cargoSensitivity: 'hoch',
            stomachSensitivity: 'mittel',
            comfortPriority: 'hoch',
            urgencyPriority: 'niedrig',
            greetingText: 'Ich schaue mir heute gezielt den bekannten Befund an. Ruhige Lage, klare Sicht und keine Showkurven, dann bekommen wir eine belastbare Einschätzung.'
        } : {
            name: 'David Kern',
            role: 'Vermessungstechniker',
            gender: 'male',
            roleProfile: 'photogrammetry_precision_v1',
            taskDomain: 'mapping_survey',
            gTolerance: 'niedrig',
            bankTolerance: 'niedrig',
            cargoSensitivity: 'hoch',
            stomachSensitivity: 'mittel',
            comfortPriority: 'hoch',
            urgencyPriority: 'niedrig',
            greetingText: 'Ich brauche heute saubere, wiederholbare Bahnen ueber dem Befund. Wenn Linie und Hoehe stabil bleiben, wird der Datensatz brauchbar.'
        });
        const cargoText = isPhoto
            ? 'Kamera-Gimbal und Ersatzakkus (30 lbs)'
            : (isRecheck ? 'Kamera-Gimbal und Prüfnotizen (28 lbs)' : 'Photogrammetrie-Kamera und Referenzmarker (36 lbs)');
        const targetScene = isPhoto ? {
            kind: 'construction_site',
            density: 'sparse',
            features: ['construction_material', 'utility_truck', 'cones'],
            requirements: [
                { feature: 'construction_material', count: 2, arrangement: 'cluster', notes: 'sichtbarer Reparatur-/Sicherungsbereich' },
                { feature: 'utility_truck', count: 1, arrangement: 'roadside', notes: 'Arbeitsfahrzeug am Rand' },
                { feature: 'cones', count: 2, arrangement: 'perimeter', notes: 'Markierung des Arbeitsbereichs' }
            ],
            notes: 'Follow-up Foto-Dokumentation: sparsame Baustellen-/Reparaturszene am bekannten Befund, keine Einsatzlage.'
        } : null;
        return {
            mission: {
                i: isPhoto ? '📷' : (isRecheck ? '🔎' : '📐'),
                t: title,
                s: story,
                cat: req.followUpCategory || targetRef.category || 'infrastructure',
                passenger,
                missionType: 'poi',
                targetScene,
                pax: `1 PAX (${passenger.role})`,
                paxText: `1 PAX (${passenger.role})`,
                cargo: cargoText,
                cargoText,
                followUpRequestId: req.id || null,
                followUpContinuation: {
                    requestId: req.id || null,
                    sourceMissionId: req.sourceMissionId || null,
                    sourceMissionKey: req.sourceMissionKey || null,
                    sourceKind: req.sourceKind || 'inspection_infra',
                    followUpKind: req.followUpKind || null,
                    chain: req.chain || null,
                    chainStep: req.chain?.step || null,
                    acceptance: req.acceptance || null,
                    targetRef,
                    returnHomeRef: req.route?.homeRef || null,
                    narrativeMemory: req.narrativeMemory || null,
                    temporalContext: req.temporalContext || null
                },
                followUpContext: pipeline,
                missionTemporalContext: req.temporalContext || null,
                _source: 'Follow-up POI Dispatcher',
                _requestedProfile: profileId,
                _appliedProfile: profileId
            },
            paxText: `1 PAX (${passenger.role})`,
            cargoText,
            dataSource: 'Follow-up POI Dispatcher'
        };
    }

    function debugSetInspectionOutcome(outcome = '') {
        const md = (typeof window !== 'undefined' ? window.currentMissionData : null) || null;
        if (!md || typeof md !== 'object' || !isInspectionMission(md)) {
            alert('Keine aktive Infrastruktur-Inspektion vorhanden.');
            return false;
        }
        const type = normalizeOutcomeType(outcome);
        if (!type) {
            alert('Unbekanntes Infra-Ergebnis.');
            return false;
        }
        const next = ensureInspectionOutcome(md, { outcome: type, createdAt: nowMs() });
        applyOutcomeToMission(md, next);
        if (typeof window.saveMissionState === 'function') {
            try { window.saveMissionState(); } catch (_) {}
        }
        if (typeof window.vpRefreshWeatherDebugReport === 'function') {
            try { window.vpRefreshWeatherDebugReport(); } catch (_) {}
        }
        alert(`Debug: Infra-Ergebnis gesetzt: ${next?.label || type}`);
        return true;
    }

    window.missionInfraInspectionOutcomeSchema = SCHEMA;
    window.missionInfraIsInspectionMission = isInspectionMission;
    window.missionInfraNormalizeInspectionOutcome = normalizeInspectionOutcome;
    window.missionInfraEnsureInspectionOutcome = ensureInspectionOutcome;
    window.missionInfraApplyOutcomeToMission = applyOutcomeToMission;
    window.missionInfraBuildFollowupConfigForMission = buildFollowupConfigForMission;
    window.missionInfraBuildAllowedChainConfig = buildAllowedChainConfig;
    window.missionInfraBuildProspectForMission = buildProspectForMission;
    window.missionInfraPickerValueForFollowup = pickerValueForFollowup;
    window.missionInfraBuildPipelineContext = buildPipelineContext;
    window.missionInfraBuildDispatchMission = buildDispatchMission;
    window.missionInfraDebugSetInspectionOutcome = debugSetInspectionOutcome;
})();
