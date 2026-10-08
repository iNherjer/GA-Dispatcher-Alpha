/* Local preview lifecycle. Accepted mission storage and execution stay separate. */
(function(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GAMissionDraftCore = api;
})(globalThis, function() {
    'use strict';
    const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
    function create({ storage, key, vault, now = Date.now }) {
        let record = null, state = null, persistence = Promise.resolve(), sequence = 0, operation = null;
        try { record = JSON.parse(storage.getItem(key) || 'null'); } catch (_) {}
        if (record?.version !== 1) record = null;
        state = clone(record?.state || null);
        if (record && !state && !record.backupToken) { record = null; try { storage.removeItem(key); } catch (_) {} }
        if (record) record.phase = 'review'; // Never replay an interrupted accept after reload.
        function persist() {
            if (!record) return;
            const saved = { ...record, state: clone(state), at: now() };
            try { storage.setItem(key, JSON.stringify(saved)); persistence = Promise.resolve(); }
            catch (_) {
                if (!saved.state) {
                    if (record.backupToken) persistence = Promise.resolve();
                    return;
                }
                let backup;
                try { backup = vault.save(saved.state); } catch (error) {
                    persistence = Promise.reject(error); persistence.catch(() => {}); throw error;
                }
                record.backupToken = backup.token;
                try { storage.setItem(key, JSON.stringify({ ...saved, state: null, backupToken: backup.token })); } catch (error) {
                    backup.ready.catch(() => {});
                    persistence = Promise.reject(new Error('Entwurf konnte nicht dauerhaft gespeichert werden.')); persistence.catch(() => {}); return;
                }
                persistence = backup.ready;
                persistence.catch(() => {}); // read()/commit reports failure, never uploads a reduced draft.
            }
        }
        async function read() {
            await persistence;
            if (!state && record?.backupToken) state = await vault.load(record.backupToken);
            return clone(state);
        }
        function begin({ previousMissionId = null } = {}) {
            if (operation) throw new Error('Die Missionsübernahme läuft bereits.');
            sequence++;
            record = { version: 1, phase: 'generating', previousMissionId, at: now() };
            state = null;
            persist();
            return sequence;
        }
        function save(snapshot) {
            if (!record) return false;
            if (record.previousMissionId && snapshot?.currentMissionData?.missionId === record.previousMissionId) return false;
            state = clone(snapshot);
            if (record.phase === 'generating') record.phase = 'review';
            persist(); return true;
        }
        function discard() {
            if (operation) return false;
            sequence++; record = null; state = null;
            storage.removeItem(key); return true;
        }
        function phase(value) {
            if (!record) return false;
            record.phase = value; return true;
        }
        function commit({ readRemote, cleanup, publish, install, isCurrent = () => true, requiresDraft = true }) {
            if (operation) return operation;
            const ticket = sequence;
            const check = () => { if (!record || ticket !== sequence || !isCurrent()) throw new Error('Missionsentwurf oder Pilot wurde zwischenzeitlich geändert.'); };
            operation = (async () => {
                try {
                    const draftPromise = read();
                    if (record) record.phase = 'committing';
                    const draft = await draftPromise; check();
                    if (requiresDraft && !draft) throw new Error('Kein vollständiger Entwurf vorhanden.');
                    const remote = await readRemote(); check();
                    await cleanup(remote); check();
                    const result = await publish(clone(draft), remote); check();
                    await install(clone(draft), result); check();
                    storage.removeItem(key); record = null; state = null; sequence++;
                    return { ok: true, result };
                } catch (error) {
                    if (record) record.phase = 'review';
                    return { ok: false, error: String(error?.message || error) };
                } finally { operation = null; }
            })();
            return operation;
        }
        return { begin, save, read, discard, phase, commit, active: () => !!record,
            status: () => record?.phase || 'idle', ticket: () => sequence };
    }
    return { create };
});
