import { randomUUID, randomBytes } from 'node:crypto';

export const retiredSchema = 'ga.account-retired.v1';
const lookup = id => String(id).normalize('NFKC').toLowerCase();
const reserved = id => /^(?:GROUP_|AUDIO_SETTINGS_|CHK)/i.test(id);
export class RenameError extends Error {
  constructor(message,status=400) { super(message); this.status=status; }
}

// All auth writes run only through the local, host/origin-protected admin proxy.
// Linked payloads stay in their existing storage; the worker resolves the anchor.
export function createAccountRenamer({ list, get, put, remove, backup, version, capability, now=Date.now }) {
  const plans = new Map();
  function publicPlan(plan) {
    return { ok:true, dryRun:true, id:plan.id, newId:plan.newId, token:plan.token, expiresAt:new Date(plan.expiresAt).toISOString(), pinUnchanged:true, preserved:['Cloud-Profil','Homebase','Audio','Crew-Mitgliedschaften','Community-Checklisten'] };
  }
  async function checkCapability() {
    if (!await capability()) throw new RenameError('Der Cloud-Worker unterstützt die sichere Umbenennung noch nicht. Es wurde nichts geändert.',503);
  }
  async function checkSnapshot(plan) {
    const keys = await list('');
    if (keys.some(key => lookup(key.name) === lookup(plan.newId))) throw new RenameError('Die neue Pilot-ID ist bereits belegt oder reserviert.',409);
    for (const entry of plan.originals) {
      const key = keys.find(key => key.name === entry.id);
      if (!key || (key.expiration || null) !== (entry.expiration || null) || await get(entry.id) !== entry.raw) throw new RenameError('Kontodaten haben sich geändert. Liste aktualisieren und eine neue Vorschau prüfen.',409);
    }
  }
  async function preview(payload, progress) {
    const id = typeof payload.id === 'string' ? payload.id : '';
    const newId = typeof payload.newId === 'string' ? payload.newId.trim().normalize('NFKC').toUpperCase() : '';
    if (!id || id.length>160 || reserved(id) || id.includes(':')) throw new RenameError('Ungültiges Ausgangskonto.');
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(newId) || reserved(newId)) throw new RenameError('Neue Pilot-ID: 3–40 Buchstaben, Zahlen, Bindestriche oder Unterstriche; keine reservierten Präfixe.');
    if (lookup(id) === lookup(newId)) throw new RenameError('Diese Pilot-ID ist bereits hinterlegt; Groß-/Kleinschreibung unterscheidet keine Konten.');
    progress({message:'Cloud-Unterstützung und Verfügbarkeit der neuen Pilot-ID prüfen …'});
    await checkCapability();
    const keys = await list('');
    if (keys.some(key => lookup(key.name)===lookup(newId))) throw new RenameError('Die neue Pilot-ID ist bereits belegt oder reserviert.',409);
    const source = keys.find(key => key.name===id);
    if (!source) throw new RenameError('Das Konto wurde nicht gefunden. Liste aktualisieren.',404);
    const raw = await get(id);
    let record;
    try { record=JSON.parse(raw); } catch { throw new RenameError('Kontodaten nicht lesbar.',409); }
    if (!record || record.pin === undefined || record.accountStatus || record.schema===retiredSchema) throw new RenameError('Das Konto ist nicht zur Umbenennung bereit.',409);
    if (version(raw)!==payload.expectedVersion) throw new RenameError('Das Konto hat sich seit dem Laden geändert. Liste aktualisieren.',409);
    const uid=record.accountUid || randomUUID();
    const previous=Array.isArray(record.accountPreviousIds) ? [...new Set(record.accountPreviousIds)] : [];
    const originals=[{id,raw,expiration:source.expiration || null}];
    for (const oldId of previous) {
      if (typeof oldId!=='string' || oldId===id || oldId===newId || reserved(oldId) || oldId.includes(':')) throw new RenameError('Ungültige frühere Pilot-ID im Konto.',409);
      const key=keys.find(key => key.name===oldId);
      if (!key) throw new RenameError('Eine frühere Pilot-ID fehlt. Konto vor der Umbenennung prüfen.',409);
      const oldRaw=await get(oldId);
      let old;
      try { old=JSON.parse(oldRaw); } catch { throw new RenameError('Frühere Pilot-ID nicht lesbar.',409); }
      if (old.schema!==retiredSchema || old.accountUid!==uid) throw new RenameError('Eine frühere Pilot-ID gehört nicht mehr zu diesem Konto.',409);
      originals.push({id:oldId,raw:oldRaw,expiration:key.expiration || null});
    }
    const storageId=record.accountStorageId || id;
    const updated={...record,syncId:newId,accountStorageId:storageId,accountUid:uid,accountPreviousIds:[...previous,id]};
    const token=randomBytes(24).toString('hex');
    const plan={id,newId,uid,updated,originals,expiration:source.expiration || null,token,expiresAt:now()+5*60*1000};
    for (const [token,old] of plans) if (old.expiresAt<now()) plans.delete(token);
    if (plans.size>=20) plans.delete(plans.keys().next().value);
    plans.set(token,plan);
    return publicPlan(plan);
  }
  async function apply(payload,progress) {
    const plan=plans.get(payload.token);
    if (!plan || plan.expiresAt<now()) throw new RenameError('Die Vorschau ist abgelaufen. Bitte erneut prüfen.',409);
    if (payload.confirmOffline!==true) throw new RenameError('App und Tracker des Kontos müssen für die Umbenennung geschlossen sein.');
    await checkCapability();
    await checkSnapshot(plan);
    progress({message:`Konto ${plan.id} vor der Umbenennung sichern …`});
    const backupId=await backup({kind:'account-rename',id:plan.id,newId:plan.newId,uid:plan.uid,originals:plan.originals,targetWasAbsent:true});
    // The backup can be slow. Recheck after it, immediately before writing.
    await checkSnapshot(plan);
    plans.delete(plan.token);
    const touched=new Map();
    async function write(id, raw, expiration) {
      if (!touched.has(id)) touched.set(id,new Set());
      touched.get(id).add(raw);
      await put(id,raw,expiration);
    }
    try {
      progress({message:`Neue Pilot-ID ${plan.newId} reservieren …`});
      await write(plan.newId,JSON.stringify({...plan.updated,accountStatus:'renaming'}),plan.expiration);
      await write(plan.id,JSON.stringify({...JSON.parse(plan.originals[0].raw),accountStatus:'renaming'}),plan.expiration);
      for (const original of plan.originals) {
        progress({message:`Bisherige Pilot-ID ${original.id} sperren …`});
        await write(original.id,JSON.stringify({schema:retiredSchema,renamedTo:plan.newId,accountUid:plan.uid,renamedAt:new Date(now()).toISOString()}),null);
      }
      progress({message:`Anmeldung unter ${plan.newId} freigeben …`});
      await write(plan.newId,JSON.stringify(plan.updated),plan.expiration);
      return {ok:true,dryRun:false,changed:true,id:plan.id,newId:plan.newId,backupId,pinUnchanged:true,requiresLogin:true};
    } catch {
      progress({message:'Umbenennung unterbrochen. Originaldaten wiederherstellen …'});
      let recoveryFailed=false;
      // Restore every possibly touched key, including uncertain network writes.
      for (const original of [...plan.originals].reverse()) {
        if (!touched.has(original.id)) continue;
        try {
          const current=await get(original.id);
          if (current!==original.raw && !touched.get(original.id).has(current)) throw new Error('foreign_change');
          await put(original.id,original.raw,original.expiration);
        } catch { recoveryFailed=true; }
      }
      if (touched.has(plan.newId)) {
        try {
          const current=await get(plan.newId);
          if (current && !touched.get(plan.newId).has(current)) throw new Error('foreign_change');
          if (current) await remove(plan.newId);
        } catch { recoveryFailed=true; }
      }
      throw new RenameError(`Umbenennung nicht bestätigt. ${recoveryFailed ? 'Die Wiederherstellung ist unvollständig; das Konto benötigt eine Wiederherstellung aus der lokalen Sicherung.' : 'Die Originaldaten wurden zur Wiederherstellung geschrieben. Vor einem neuen Versuch die Liste aktualisieren.'} Sicherung: ${backupId}.`,502);
    }
  }
  return async (payload={},progress=()=>{}) => payload.dryRun===false ? apply(payload,progress) : preview(payload,progress);
}
