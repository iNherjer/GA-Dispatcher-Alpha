(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./mission-boarding-voice-core.js') : root.GAMissionBoardingVoiceCore,
        typeof module === 'object' && module.exports ? require('./mission-farewell-voice-core.js') : root.GAMissionFarewellVoiceCore,
        typeof module === 'object' && module.exports ? require('./mission-bush-pickup-voice-core.js') : root.GAMissionBushPickupVoiceCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.GAMissionBushExecutionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(boardingCore, farewellCore, pickupVoiceCore) {
    'use strict';
    const SCHEMA = 'ga.mission-bush-execution-recipe.v1';
    const CAPABILITY = 'mission.bush-strip.v1';
    const PROFILES = Object.freeze({bush_supply_strip:'unload_at_target', bush_charter_strip:'passenger_dropoff', bush_scenic_hopper:'land_at_target',bush_pickup_strip:'return_home',bush_pickup_cargo:'return_home',bush_recon_return:'return_home'});
    const point = p => p && typeof p.lat === 'number' && Number.isFinite(p.lat) && Math.abs(p.lat)<=90
        && typeof p.lon === 'number' && Number.isFinite(p.lon) && Math.abs(p.lon)<=180;
    function canonical(value) {
        if (Array.isArray(value)) return value.map(canonical);
        if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
        return value;
    }
    const same = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
    function validateSpec(spec) {
        if (!spec || !Object.hasOwn(PROFILES,spec.profileId)) return 'bush_profile_not_migrated';
        const pickup=['bush_pickup_strip','bush_pickup_cargo'].includes(spec.profileId), recon=spec.profileId==='bush_recon_return';
        const kind=pickup?'pickup_return':recon?'recon_return':'strip_target';
        if (spec.targetMode!==(pickup?'strip_then_return':recon?'area_then_return':'strip')
            || spec.completionMode!==PROFILES[spec.profileId] || spec.requiresReturnHome!==(pickup||recon)
            || (pickup ? spec.pickupKind!==(spec.profileId==='bush_pickup_strip'?'passenger':'cargo') : !!spec.pickupKind)
            || !same(spec.allowedEndLocations,[pickup||recon?'home':'target'])
            || (spec.recipeId && spec.recipeId!==(recon?'poi_on_task_return':kind))) return 'bush_contract_invalid';
        if (!point(spec.targetRef) || !point(spec.homeRef)) return 'bush_strip_location_invalid';
        if (recon && (!point(spec.areaRef) || !Number.isFinite(spec.areaRef.radiusNm) || spec.areaRef.radiusNm<=0)) return 'bush_recon_area_invalid';
        return null;
    }
    function validateRecipe(recipe) {
        if (!recipe || recipe.schema!==SCHEMA || recipe.version!==1 || !['strip_target','pickup_return','recon_return'].includes(recipe.kind)
            || typeof recipe.missionId!=='string' || !recipe.missionId) return 'bush_recipe_invalid';
        const error=validateSpec(recipe.spec); if(error)return error;
        const expected=recipe.spec.profileId==='bush_recon_return'?'recon_return':recipe.spec.targetMode==='strip_then_return'?'pickup_return':'strip_target';
        if(recipe.kind!==expected)return 'bush_recipe_kind_mismatch';
        if (!point(recipe.location?.missionTarget) || (recipe.location.arrivalPoint && !point(recipe.location.arrivalPoint))) return 'bush_recipe_location_invalid';
        if (recipe.location.missionTarget.lat!==recipe.spec.targetRef.lat || recipe.location.missionTarget.lon!==recipe.spec.targetRef.lon) return 'bush_recipe_target_mismatch';
        return null;
    }
    function validateBundle(bundle) {
        const missionState=bundle?.missionState || {}, md=missionState.currentMissionData || missionState;
        const contracts=[md, md.missionContract, missionState.activeMissionContract].filter(Boolean);
        const recipe=bundle?.executionBushRecipe;
        const isBush=bundle?.adapter==='bush_pickup' || contracts.some(c=>c.bush || String(c.missionType||'').toLowerCase()==='bush');
        if (!isBush && !recipe) return null;
        const error=validateRecipe(recipe);if(error)return error;
        if (recipe.missionId!==bundle.missionId || bundle.adapter!=='bush_pickup') return 'bush_recipe_identity_mismatch';
        const specs=contracts.map(c=>c.bush).filter(Boolean);
        if (!specs.length || specs.some(s=>!same(s,recipe.spec))) return 'bush_recipe_source_mismatch';
        if (contracts.some(c=>c.sarHeli || c.trainingProcedure || c.surveyPattern || c.poiChain)
            || (bundle.executionPoiRecipe && recipe.kind!=='recon_return') || bundle.executionTrainingRecipe) return 'bush_recipe_specialization_not_migrated';
        const plan=bundle.executionEffectPlan;
        if (recipe.kind==='recon_return') {
            if (!bundle.executionPoiRecipe || bundle.executionPoiRecipe.missionId!==bundle.missionId
                || !same(bundle.executionPoiRecipe.bush,recipe.spec) || !same(bundle.executionPoiRecipe.voiceContext?.bush,recipe.spec)
                || plan?.recipe!=='poi') return 'bush_recon_poi_recipe_missing';
            return null; // The POI gate validates the full task, voice and scene contract.
        }
        if(recipe.kind==='pickup_return') {
            if(!point(recipe.home) || !same(recipe.home,recipe.spec.homeRef))return 'bush_home_invalid';
            if(!recipe.voiceContext || recipe.voiceContext.missionId!==bundle.missionId || !pickupVoiceCore || pickupVoiceCore.validateContext(recipe.voiceContext,bundle.missionId))return 'bush_pickup_voice_missing';
            if(!same(recipe.voiceContext.bush,recipe.spec) || !same(plan?.bushPickup?.voiceContext,recipe.voiceContext) || !same(plan?.bushPickup?.pickupBoarding,recipe.pickupBoarding))return 'bush_pickup_context_mismatch';
            if(!plan?.effects?.['scene.arrival']?.command)return 'bush_pickup_scene_missing';
            if(recipe.spec.pickupKind==='passenger' && (!recipe.pickupBoarding?.sceneId
                || !Number.isFinite(recipe.pickupBoarding?.personPoint?.worldLat)
                || !Number.isFinite(recipe.pickupBoarding?.personPoint?.worldLon)))return 'bush_pickup_boarding_missing';
        }
        if (plan?.schema!=='ga.mission-apt-effect-plan.v1' || plan.recipe!=='apt' || plan.missionId!==bundle.missionId) return 'bush_effect_plan_invalid';
        if (plan.effects?.['voice.farewell']?.context?.supported!==true
            || (recipe.kind!=='pickup_return' && !plan.effects?.['voice.boarding']?.recipe)) return 'bush_voice_context_missing';
        const boarding=plan.effects['voice.boarding']?.recipe, approach=plan.effects['voice.approach']?.context, farewell=plan.effects['voice.farewell'].context;
        if ((recipe.kind!=='pickup_return' && !boardingCore?.normalizeRecipe(boarding)) || !farewellCore?.normalizeContext(farewell)
            || [boarding,farewell].filter(Boolean).some(v=>v.missionId!==bundle.missionId)
            || (farewell.mode!=='cargo' && !approach)
            || (approach && (approach.supported!==true || approach.missionId!==bundle.missionId
                || approach.schema!=='ga.mission-approach-context.v1' || approach.version!==1))) return 'bush_voice_context_invalid';
        for(const [type,commandType] of [['scene.prepare','mission_scene_spawn'],['scene.boarding','mission_scene_boarding'],['scene.deboarding','mission_scene_deboarding']]) {
            const entry=plan.effects[type], command=entry?.command;
            if(!command && recipe.kind==='pickup_return' && (['scene.prepare','scene.boarding'].includes(type) || recipe.spec.pickupKind==='cargo' && type==='scene.deboarding') && entry?.none===true)continue;
            if(!command) return 'bush_scene_plan_missing';
            if(entry.none===true || command.type!==commandType || !command.sceneId
                || (type==='scene.prepare' ? !Array.isArray(command.items) || command.items.length<1 || command.items.length>80
                    : !Array.isArray(command.path) || command.path.length<2 || command.path.length>24)) return 'bush_scene_plan_invalid';
        }
        return null;
    }
    return Object.freeze({SCHEMA,CAPABILITY,PROFILES,validateSpec,validateRecipe,validateBundle});
});
