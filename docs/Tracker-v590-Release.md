# Tracker v590 Alpha / Web v2200 – Verlade-Abkürzung im Mission-Worker

Folge zum Feldtest mit v587 (schwacher Rechner): Vom Verlade-Klick bis zum Sim-Befehl vergingen
2,5–3,5 s. Ein Verlade-Effekt lief dreimal zwischen Tracker-Hauptprozess und Mission-Worker hin
und her; jede Runde kostete unter Last 0,5–1,5 s.

## Änderungen

- **Freigabe im Worker** (`tracker-mission-worker.js`): Der Worker legt den Journal-Eintrag des
  Effekts (`beginExecutionEffectDispatch`) selbst an und ruft den Hauptprozess nur noch einmal auf.
  Bereits erledigte oder laufende Effekte beantwortet er direkt, ohne Prozess-Runde.
- **Hauptprozess** (`tracker.js`, `dispatchExecutionCommand`): Mit dem internen Argument
  `workerLease` entfällt die Rückfrage an den Worker. Die Prüfung, ob der Lauf noch aktuell ist,
  bleibt. Der Weg ist nur über den Worker-Callback erreichbar, nicht über Relay-Befehle; der
  In-Prozess-Weg ohne Worker bleibt unverändert.
- **Nicht zugestellte Aufrufe** (`mission-authority-core.js`, `abandonExecutionEffectDispatch`):
  Scheitert der Aufruf nachweislich vor der Ausführung (Verbindungswechsel, Sim nicht verbunden,
  Hauptprozess weg/ausgelastet), nimmt der Worker die Freigabe zurück
  (`MISSION_EFFECT_DISPATCH_ABANDONED`); die reguläre Wiederholung nach 2 s sendet erneut. Bei einem
  Timeout bleibt die Freigabe bestehen, weil unklar ist, ob der Effekt lief.

Erwartung: pro Verlade-Effekt eine Prozess-Runde weniger, auf dem schwachen Rechner etwa 1 s.

Tracker v590, Host-Assetrevision 58801 (unverändert), Web-Cache v2200 (keine Web-Änderung).
EFB-/Toolbar-Community-Paket und Desktop-Installer unverändert. Nur Alpha-Runtime umstellen.

## Prüfung

- Neu: `tracker-mission-worker-lease.test.js` (4) mit echtem Worker-Prozess: Freigabe vor dem
  Sim-Aufruf und `workerLease` mitgegeben; Rücknahme und erneutes Senden nach nicht zugestelltem
  Aufruf; Rücknahme nur für eigene, offene Freigaben; Rückfrage nur auf dem Worker-Weg übersprungen.
- Gesamtsuite `ga-tracker-client/*.test.js`: 1481 Tests, 1444 bestanden, 35 Fehlschläge – dieselben
  wie bei v589, keine neuen.
- Gepackter Missionsprozess (node18-macos-arm64): `MISSION_PACKAGED_PROCESS_SMOKE_OK`, Exit 0.
- Windows-x64 mit pkg 6.18.1 / Node18, ARM-Cross-Build `--no-bytecode --public --public-packages '*'`.
  PE32+ x86-64; v590 und Worker-Freigabe eingebettet geprüft.

EXE: 174355670 Bytes; SHA-256 `603ca8409156a706402e36e482b934335c7a32eca9a29b3b276df6466a76d685`.

## Im Feld prüfen

- Verladen mit Web-App und EFB: Abstand `MISSION_CARGO_VISUAL` → `MISSION_EFFECT_DISPATCH` im
  Debug-Log (vorher ~1 s) und gefühlte Zeit bis zum Spawn/Despawn.
- `MISSION_EFFECT_DISPATCH_ABANDONED` sollte nur bei Sim-Neuverbindungen auftauchen.
