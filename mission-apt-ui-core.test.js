'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('./mission-apt-ui-core.js');

function control(phase, allowedActions, flags = {}) {
  return {
    missionId: 'apt-ui',
    executionAuthority: 'tracker',
    authorityRevision: 4,
    phase,
    allowedActions,
    flags
  };
}

test('tracker APT banner preserves the characterized App wording', () => {
  assert.deepEqual(core.bannerModel(control('planned', ['prepare_mission'])), {
    intent: 'prepare_mission', kind: 'intent', kicker: 'Mission bereit',
    text: 'Mission ist geplant. Mit "Mission starten" wird erst dann Szene, Boarding und Verladen freigegeben.',
    button: 'Mission starten', className: 'is-begin-action', disabled: false,
    begin: true, endReady: false, final: false, closeHidden: false,
    missionId: 'apt-ui', revision: 4, key: 'apt-ui:4:planned:intent:prepare_mission'
  });
  assert.equal(core.bannerModel(control('prepare', ['start_boarding'])).button, 'Boarding und Verladen beginnen');
  assert.equal(core.bannerModel(control('boarding', [], { boardingConfirmed: false })).button, 'Bitte warten...');
  assert.equal(core.bannerModel(control('boarding', ['set_manifest_item'], { boardingConfirmed: true })).button, 'Verladefenster öffnen');
  assert.equal(core.bannerModel(control('boarded', ['start_mission'], { boardingConfirmed: true })).text,
    'Boarding abgeschlossen. Wenn du die Ladung sicher verstaut hast, kann es losgehen.');
});

test('arrival banner keeps unload, deboarding and final App states distinct', () => {
  const unload = core.bannerModel({
    missionId: 'apt-ui',
    control: control('end_unloading', ['set_manifest_item', 'request_pax_interaction'], { active: true }),
    manifest: { items: [{ id: 'pax', itemType: 'passenger', status: 'loaded', delivery: 'destination' }] }
  });
  assert.equal(unload.kicker, 'Ladung entladen');
  assert.equal(unload.button, 'Ausladen');
  const busy = core.bannerModel(control('end_ready', [], { farewellStarted: true, farewellCompleted: false }));
  assert.equal(busy.text, 'Deboarding laeuft. Missionabschluss wird vorbereitet.');
  const ready = core.bannerModel({
    control: { ...control('end_ready', ['request_close']), flight: { destination: { hasAptArrival: true, dArrivalNm: 0.04 } } }
  });
  assert.equal(ready.text, 'Du stehst am Ziel. 0.04 NM zum Empfangspunkt.');
  assert.equal(ready.button, 'Mission beenden');
});

test('tracker compliance banner and cargo action reuse the exact App copy', () => {
  const complianceControl = {
    ...control('end_ready', ['set_manifest_item', 'submit_compliance_evidence'], {
      active: true, groundStill: true, farewellCompleted: true
    }),
    workflows: {
      complianceInspection: {
        selected: true,
        phase: 'evidence_open',
        remediation: { required: false, missingFields: [] }
      }
    },
    cargo: { summary: { destinationRemaining: 0 } }
  };
  const banner = core.bannerModel(complianceControl);
  assert.equal(banner.kicker, 'BEHOERDENKONTROLLE');
  assert.equal(banner.text, 'Bordbuch, Feuerloescher und Verbandzeug ausladen und anschliessend zur Pruefung vorlegen.');
  assert.equal(banner.button, 'Verladefenster');
  assert.equal(banner.kind, 'cargo');

  const cargo = core.cargoModel({
    control: complianceControl,
    manifest: { items: [] }
  });
  assert.equal(cargo.compliance.active, true);
  assert.equal(cargo.compliance.message, banner.text);
  assert.deepEqual(cargo.actions.primary, {
    intent: 'submit_compliance_evidence',
    action: 'submit_compliance_evidence',
    label: 'Der Kontrolle vorlegen',
    className: 'mission-cargo-primary',
    disabled: false
  });

  const departing = core.bannerModel({
    ...complianceControl,
    workflows: { complianceInspection: { selected: true, phase: 'departing' } },
    allowedActions: []
  });
  assert.equal(departing.kind, 'wait');
  assert.equal(departing.text, 'Die Kontrolleure kehren zum Fahrzeug zurueck. Missionsende bleibt bis zur Abfahrt gesperrt.');
  assert.equal(departing.button, 'Bitte warten...');
});

test('cargo actions use the existing App labels and tracker permissions', () => {
  const boarding = control('boarding', ['set_manifest_item', 'sign_manifest'], { boardingConfirmed: true });
  assert.deepEqual(core.itemAction({ id: 'box', itemType: 'cargo', status: 'pending', pickup: 'departure' }, boarding), {
    intent: 'set_manifest_item', action: 'load', label: 'Laden'
  });
  assert.equal(core.directActions(boarding)[0].label, 'Unterschrift eintragen');
  const arrival = control('end_unloading', ['set_manifest_item', 'request_pax_interaction']);
  assert.equal(core.itemAction({ itemType: 'passenger', status: 'loaded', delivery: 'destination' }, arrival).label, 'Aussteigen');
  assert.equal(core.itemAction({ itemType: 'cargo', status: 'loaded', delivery: 'destination' }, arrival).label, 'Ausladen');
  assert.equal(core.itemAction({ itemType: 'cargo', status: 'unloaded', delivery: 'destination' }, arrival).label, 'Wieder laden');
  const closeAction = core.directActions(control('end_ready', ['confirm_unload']))[0];
  assert.equal(closeAction.label, 'Entladung abgeschlossen - Mission beenden');
  assert.equal(closeAction.followupIntent, 'request_close');
});

test('canonical load sheet preserves App rows, signature and confirmation sequence', () => {
  const unsigned = core.cargoModel({
    control: {
      ...control('boarding', ['set_manifest_item', 'sign_manifest'], { boardingConfirmed: true, groundStill: true, loadConfirmed: false }),
      cargo: { summary: { departureMissing: 0 } },
      payload: { status: 'idle', presentation: {} }
    },
    manifest: {
      aircraftSlot: 'PA-24', createdAt: 123,
      items: [
        { id: 'pax', storyName: 'Dr. Test', itemType: 'passenger', passengerCount: 1, required: true, status: 'loaded', weightLbs: 180 },
        { id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 24, station: 'Sitz 4' }
      ]
    }
  });
  assert.equal(unsigned.presentation, 'app-cargo-dialog-v1');
  assert.equal(unsigned.header.kicker, 'Bodenservice');
  assert.equal(unsigned.copy, 'Die Boarding-Animation ist abgeschlossen. Nach dem Abschliessen der Verladung ist die Mission startbereit.');
  assert.equal(unsigned.items[0].statusLabel, 'an bord');
  assert.equal(unsigned.items[0].action.label, 'An Bord');
  assert.equal(unsigned.items[0].action.disabled, true);
  assert.equal(unsigned.items[1].action.label, 'Ausladen');
  assert.equal(unsigned.signature.stateText, 'Klick: unterschreiben');
  assert.equal(unsigned.actions.primary.label, 'Unterschrift eintragen');
  assert.equal(unsigned.actions.primary.disabled, false);
  assert.equal(unsigned.summary.left, '0 Pflicht-Items offen');
  assert.equal(unsigned.summary.right, '204 lbs an Bord');

  const signed = core.cargoModel({
    control: {
      ...control('boarding', ['set_manifest_item', 'clear_manifest_signature', 'confirm_load'], {
        boardingConfirmed: true, groundStill: true, loadConfirmed: false
      }),
      cargo: { signatureScope: 'departure', summary: { departureMissing: 0 } }
    },
    manifest: {
      dispatchSignature: { scope: 'departure', by: 'DEINA', at: 456, aircraft: 'PA-24' },
      items: [{ id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 24 }]
    }
  });
  assert.equal(signed.signature.signed, true);
  assert.equal(signed.signature.name, 'DEINA');
  assert.equal(signed.signature.stateText, 'Klick: Signatur löschen');
  assert.equal(signed.actions.secondary.label, 'Zurueck zur Liste');
  assert.equal(signed.actions.primary.label, 'Verladung abschließen');
  assert.equal(signed.actions.primary.intent, 'confirm_load');
});

test('canonical unload sheet keeps cargo, PAX and mission-end actions distinct', () => {
  const unload = core.cargoModel({
    control: {
      ...control('end_unloading', ['set_manifest_item', 'request_pax_interaction', 'sign_manifest'], {
        active: true, airborneSeen: true, groundStill: true, unloadConfirmed: false
      }),
      cargo: { summary: { destinationRemaining: 1 } }
    },
    manifest: {
      items: [
        { id: 'pax', storyName: 'Dr. Test', itemType: 'passenger', required: true, status: 'loaded', delivery: 'destination', weightLbs: 180 },
        { id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', delivery: 'destination', weightLbs: 24 }
      ]
    }
  });
  assert.equal(unload.items[0].action.label, 'Aussteigen');
  assert.equal(unload.items[0].action.intent, 'request_pax_interaction');
  assert.equal(unload.items[1].action.label, 'Ausladen');
  assert.equal(unload.signature.stateText, 'Pflichtladung zuerst vollständig entladen');
  assert.equal(unload.actions.primary.label, 'Unterschrift eintragen');
  assert.equal(unload.actions.primary.disabled, true);
  assert.equal(unload.summary.left, '1 Pflicht-Items noch zu entladen · PAX via Deboarding');

  const ready = core.cargoModel({
    control: {
      ...control('end_unloading', ['set_manifest_item', 'clear_manifest_signature', 'confirm_unload'], {
        active: true, airborneSeen: true, groundStill: true, unloadConfirmed: false
      }),
      cargo: { signatureScope: 'arrival', summary: { destinationRemaining: 0 } }
    },
    manifest: {
      dispatchSignature: { scope: 'arrival', by: 'DEINA', at: 789 },
      items: [
        { id: 'pax', storyName: 'Dr. Test', itemType: 'passenger', required: true, status: 'loaded', delivery: 'destination', weightLbs: 180 },
        { id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'unloaded', delivery: 'destination', weightLbs: 24, reloadAllowed: true }
      ]
    }
  });
  assert.equal(ready.actions.primary.label, 'Abschied und Deboarding starten');
  assert.equal(ready.actions.primary.intent, 'confirm_unload');
  assert.equal(ready.actions.primary.followupIntent, 'request_close');
  assert.equal(ready.actions.secondary.intent, 'clear_manifest_signature');
  assert.equal(ready.summary.left, '0 Pflicht-Items noch zu entladen · PAX via Deboarding');
});

test('canonical cargo sheet exposes App lock text instead of clickable stale actions', () => {
  const boarded = core.cargoModel({
    control: {
      ...control('boarded', ['start_mission'], { boardingConfirmed: true, groundStill: true, loadConfirmed: true }),
      cargo: { signatureScope: 'departure', summary: { departureMissing: 0 } }
    },
    manifest: {
      dispatchSignature: { scope: 'departure', by: 'DEINA', at: 123 },
      items: [{ id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 24 }]
    }
  });
  assert.equal(boarded.items[0].action.disabled, true);
  assert.equal(boarded.items[0].action.label, 'Der Tracker hat die Bodenaktion noch nicht freigegeben. Bitte Flug-, Ziel- und Landeerkennung abwarten.');
  assert.equal(boarded.modeHint, 'Der Tracker hat die Bodenaktion noch nicht freigegeben. Bitte Flug-, Ziel- und Landeerkennung abwarten.');
  assert.equal(boarded.actions.primary.action, 'close');
  assert.equal(boarded.actions.primary.label, 'Fenster schließen');
});

test('a fresh tracker signature projects the shared writing animation on every client', () => {
  const now = 1787300000000;
  const model = core.cargoModel({
    now,
    control: {
      ...control('boarding', ['clear_manifest_signature', 'confirm_load'], {
        boardingConfirmed: true, groundStill: true, loadConfirmed: false
      }),
      cargo: { signatureScope: 'departure', summary: { departureMissing: 0 } }
    },
    manifest: {
      dispatchSignature: { scope: 'departure', by: 'DEINA', at: now - 250 },
      items: [{ id: 'box', storyName: 'Kühlbox', itemType: 'cargo', required: true, status: 'loaded', weightLbs: 24 }]
    }
  });
  assert.equal(model.signature.animating, true);
  assert.equal(model.signature.clickable, false);
  assert.equal(model.signature.stateText, 'wird eingetragen');
  assert.equal(model.actions.primary.label, 'Unterschrift wird eingetragen ...');
});

test('pickup wording follows the App profile and pickup-kind variants', () => {
  const passengerAndCargo = core.cargoModel({
    missionProfileId: 'apt_charter_pickup',
    pickupKind: 'passenger',
    control: {
      ...control('on_task', ['set_manifest_item', 'sign_manifest'], { active: true, groundStill: true }),
      cargo: { summary: { pickupMissing: 2 } }
    },
    manifest: { items: [
      { id: 'pickup-pax', itemType: 'passenger', status: 'pending', pickup: 'target', required: true },
      { id: 'pickup-bag', itemType: 'cargo', status: 'pending', pickup: 'target', required: true }
    ] }
  });
  assert.equal(passengerAndCargo.header.title, 'Pickup am Zielplatz');
  assert.equal(passengerAndCargo.copy,
    'Hier laedst du wartenden Pickup-Gast und seine Begleitfracht am Zielplatz ein. Erst nach Unterschrift und Bestaetigung wird der Rueckflug freigegeben.');

  const cargoOnly = core.cargoModel({
    pickupKind: 'cargo',
    control: {
      ...control('on_task', ['set_manifest_item'], { active: true, groundStill: true }),
      cargo: { summary: { pickupMissing: 1 } }
    },
    manifest: { items: [{ id: 'pickup-box', itemType: 'cargo', status: 'pending', pickup: 'target', required: true }] }
  });
  assert.equal(cargoOnly.copy,
    'Hier laedst du Rueckholfracht am Zielstrip ein. Erst nach Unterschrift und Bestaetigung wird der Rueckflug freigegeben.');
});

test('board book and expiring equipment expose only tracker-backed App actions', () => {
  const model = core.cargoModel({
    now: Date.UTC(2026, 0, 7, 12),
    control: {
      ...control('boarding', ['set_manifest_item', 'set_boardbook_time', 'replace_equipment'], {
        boardingConfirmed: true, groundStill: true
      }),
      cargo: { summary: { departureMissing: 0 } }
    },
    manifest: {
      flightEvents: { flightId: 'apt|flight' },
      items: [
        { id: 'bordbuch', label: 'Bordbuch / Dispatch-Mappe', persistentEquipment: true, status: 'loaded', log: {}, weightLbs: 3 },
        { id: 'first-aid', label: 'Verbandzeug', persistentEquipment: true, equipmentType: 'expiry', status: 'unloaded', expiresAt: '2026-01-10', weightLbs: 2 }
      ]
    }
  });
  assert.deepEqual(model.items[0].stationAction, {
    intent: 'set_boardbook_time', action: 'start', label: 'Startzeit eintragen', disabled: false
  });
  assert.equal(model.items[0].equipmentDetail.text, 'Start: -- · Landung: --');
  assert.equal(model.items[1].equipmentDetail.text, 'Ablaufdatum: 10 01 2026 · noch 3 Tage gueltig');
  assert.deepEqual(model.items[1].stationAction, {
    intent: 'replace_equipment', action: 'replace', label: 'Erneuern', disabled: false
  });
});

test('canonical cargo model carries the full App weight-and-balance presentation', () => {
  const model = core.cargoModel({
    control: {
      ...control('boarding', [], { boardingConfirmed: true, groundStill: true }),
      cargo: { summary: { departureMissing: 0 } },
      payload: {
        status: 'ok',
        presentation: {
          className: 'is-ok', message: 'Sim-Zuladung stabil uebernommen.',
          summary: {
            adapter: 'msfs_payload_stations', isPa24: false, totalWeightLbs: 2400,
            emptyWeightLbs: 1500, fuelWeightLbs: 300, paxWeightLbs: 180,
            cargoWeightLbs: 42, missionWeightLbs: 222, payloadStationCount: 5,
            copilotIndex: 2, rearSeatIndices: [3, 4], cargoIndices: [5],
            stations: [{ index: 2, weightLbs: 180, baselineWeightLbs: 0, missionExtraLbs: 180 }]
          }
        }
      }
    },
    manifest: { items: [] }
  });
  assert.equal(model.payload.message, 'Sim-Zuladung stabil uebernommen.');
  assert.equal(model.payload.summary.totalWeightLbs, 2400);
  assert.deepEqual(model.payload.summary.stations, [
    { index: 2, weightLbs: 180, baselineWeightLbs: 0, missionExtraLbs: 180 }
  ]);
});
