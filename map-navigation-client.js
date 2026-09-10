(function(root, factory) {
    const api = factory(typeof module === 'object' && module.exports ? require('./map-route-edit-core') : root.GAMapRouteEditCore);
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.GAMapNavigationClient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function(core) {
    function create(options) {
        let state = null, queue = [], sending = false, deferred = null;
        function display() {
            if (!state) return;
            let points = state.points;
            try { queue.forEach(entry => { points = core.apply(points, entry.edit, state.resetPoints); }); }
            catch (_) { points = state.points; }
            options.render({ ...state, points }, queue.length > 0);
        }
        function receive(next) {
            if (!next || !Array.isArray(next.points)) return;
            if (sending) {
                if (state && next.id === state.id && next.revision < state.revision) return;
                if (deferred && next.id === deferred.id && next.revision < deferred.revision) return;
                // Once a new route has arrived, a late poll of the previous
                // route must not replace it while its last edit is still in flight.
                if (deferred && state && deferred.id !== state.id && next.id === state.id) return;
                deferred = next;
                return;
            }
            if (state && next.id === state.id && next.revision < state.revision) return;
            if (state && next.id !== state.id) queue = [];
            state = next;
            display();
        }
        async function drain() {
            if (sending || !queue.length) return;
            sending = true;
            const entry = queue[0];
            try {
                const result = await options.request('navigation_edit', { routeId: state.id, edit: entry.edit }, state.revision);
                if (result.navigation) state = result.navigation;
                if (!result.ok) throw new Error(result.error || 'navigation_failed');
                queue.shift();
                if (deferred && (deferred.id !== state.id || deferred.revision > state.revision)) {
                    state = deferred;
                    if (queue.length) throw new Error('navigation_revision_conflict');
                }
            } catch (error) {
                queue = [];
                if (deferred && (deferred.id !== state.id || deferred.revision >= state.revision)) state = deferred;
                display();
                options.error(error);
                options.refresh?.();
            } finally {
                deferred = null;
                sending = false;
                display();
                drain();
            }
        }
        function edit(value) {
            if (!state || !state.editable) return false;
            try {
                let points = state.points;
                queue.forEach(entry => { points = core.apply(points, entry.edit, state.resetPoints); });
                core.apply(points, value, state.resetPoints);
            } catch (error) { options.error(error); return false; }
            queue.push({ edit: value });
            display();
            drain();
            return true;
        }
        return { receive, edit, snapshot: () => state, pending: () => sending || queue.length > 0 };
    }
    return { create };
}));
