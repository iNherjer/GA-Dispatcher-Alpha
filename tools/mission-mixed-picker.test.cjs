const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../aircraft-mission-profile-core.js');
const source = fs.readFileSync(require.resolve('../app.js'), 'utf8');
function setup(overrides = {}) {
    const calls = [];
    const build = async context => {
        calls.push(context);
        return [0, 1, 2].map(i => ({profileId: context.dispatchProfileId,
            selectedCategory: context.selectedAptCategory, id: `${context.dispatchProfileId}-${i}`,
            target: { n: `Target ${i}` }, privateProposal: { retained: true }}));
    };
    const c = { window: { aircraftMissionProfileCore: core }, console,
        pickPoiCategoryForTaskProfile: (id, category) => id === 'inspection_infra' ? 'infrastructure' : category,
        buildMissionProposalAptChoices: build, buildMissionProposalPoiChoices: build,
        missionProposalModeEnabled: () => true, ...overrides };
    vm.createContext(c);
    for (const name of ['missionProposalAptProfileConfig', 'missionProposalPoiProfileConfig',
        'missionProposalMixedPool', 'buildMixedMissionProposalChoices', 'buildMissionProposalChoices',
        'missionProposalIsEligible', 'missionProposalFamilyIntro']) {
        const at = source.indexOf('function ' + name + '(');
        const begin = source.slice(at - 6, at) === 'async ' ? at - 6 : at;
        vm.runInContext(source.slice(begin, source.indexOf('\n}', at) + 2), c);
    }
    return { c, calls };
}
const base = { effectiveType: 'apt', mixedProfiles: true, passengerCapacity: 3, aiModeEnabled: true };
test('APT all offers three profiles and three categories, retaining proposal snapshots', async () => {
    const {c} = setup();
    for (let i = 0; i < 20; i++) {
        const choices = await c.buildMissionProposalChoices(base);
        assert.equal(choices.length, 3);
        assert.equal(new Set(choices.map(x => x.profileId)).size, 3);
        assert.equal(new Set(choices.map(x => x.selectedCategory)).size, 3);
        assert.ok(choices.every(x => x.privateProposal.retained));
    }
});
test('POI all offers different profiles and resolves each target category', async () => {
    const {c, calls} = setup();
    const result = await c.buildMissionProposalChoices({...base, effectiveType: 'poi'});
    assert.equal(new Set(result.map(x => x.profileId)).size, 3);
    assert.ok(calls.every(x => x.requestedPoiCategory === 'all'));
    for (const call of calls.filter(x => x.dispatchProfileId === 'inspection_infra'))
        assert.equal(call.selectedPoiCategory, 'infrastructure');
});
test('restricted aircraft pool remains restricted; one profile fills with variants', async () => {
    const {c} = setup();
    const choices = await c.buildMissionProposalChoices({...base, aircraftAutoResolution: {
        restricted: true, candidates: [{profileId: 'medical_transfer', category: 'cargo'}]
    }});
    assert.equal(choices.length, 3);
    assert.ok(choices.every(x => x.profileId === 'medical_transfer'));
    assert.equal(c.missionProposalMixedPool({...base, passengerCapacity: 0}).length, 0);
});
test('empty profile searches are replaced; cancellation propagates', async () => {
    let count = 0;
    const {c} = setup({buildMissionProposalAptChoices: async ctx => {
        if (++count === 1) return [];
        return [{profileId: ctx.dispatchProfileId}];
    }});
    assert.equal((await c.buildMissionProposalChoices(base)).length, 3);
    await assert.rejects(c.buildMissionProposalChoices({...base, ensureAlive: () => { throw Error('cancelled'); }}), /cancelled/);
});
test('explicit PICK keeps its generator and eligibility guards still apply', async () => {
    const {c, calls} = setup();
    await c.buildMissionProposalChoices({...base, mixedProfiles: false, dispatchProfileId: 'private_outing'});
    assert.equal(calls.length, 1);
    assert.equal(calls[0].dispatchProfileId, 'private_outing');
    assert.equal(c.missionProposalIsEligible({...base, dispatchProfileId: 'auto'}), true);
    for (const field of ['followupSeed', 'targetDest', 'isBushDispatch', 'isPlanningOnlyMode', 'missionProposalChoice'])
        assert.equal(c.missionProposalIsEligible({...base, [field]: true}), false);
});
