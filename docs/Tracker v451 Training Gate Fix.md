# Tracker v451 Alpha – Trainingsfreigabe und Abschluss

Trainingsfluege zeigen schon vor der ersten Einweisung ihre tatsaechlichen
Freigabebedingungen mit gemessener Abflugentfernung und AGL. Die Anzeige folgt
auch nach der Einweisung der im Rezept festgelegten Hoehe; ein spaeteres
Unterschreiten erscheint nicht mehr faelschlich als erfuellte Voraussetzung.

- Standard-Kurvenrezept: mindestens 5 NM Abflugabstand und 1200 ft AGL, danach
  die vorhandene dreisekuendige Stabilisierung und manueller Uebungsstart.
- Enthaelt der Pflichtteil Stall-Recovery, kann das normalisierte Rezept bereits
  fuer die Einweisung 2500 ft AGL verlangen. Diese bestehende Regel wird jetzt
  korrekt angezeigt; ihre Grenze wird nicht gesenkt.
- Eine Ausweichlandung bleibt bei POI-Training ein erlaubter Abschluss nach
  Flugnachweis. Offene Pflichtuebungen werden getrennt von echter fehlender,
  beschaedigter oder nicht entladener Ausruestung bewertet und angesprochen.
- `MISSION_TRAINING_GATE_DIAGNOSTIC` protokolliert Gatewechsel und bei anhaltender
  Blockierung hoechstens alle 30 Sekunden Messwerte, Mindestwerte und
  Start-/Pausenzustand. Keine zusaetzlichen Cloud-Schreibvorgaenge.

Die Logs des gemeldeten v450-Flugs enthalten keine Trainings-Messwerte und
keinen Rezeptinhalt. Deshalb ist der exakte Freigabeblocker dieses Flugs nicht
bewiesen. Der neue Kandidat behebt die reproduzierten Anzeige-/Abschlussfehler
und macht einen verbleibenden Blocker nachvollziehbar.

Automatisierte Nachweise: Training-/APT-/Worker- und Guidance-Tests inklusive
1200/2500-ft-Grenzen, fehlender Daten, Pause, Restart, optionaler Uebungen sowie
vollstaendigem Ausweichlandungs-/Entlade-/Abschlusslauf. Standard-POI/APT und
Execution-/Farewell-Regressionen, Generator- und Differentialchecks bestanden.
Ein erneuter Windows-/MSFS-Flug ist erforderlich; keine simulierte Feldfreigabe.

Buildnachweis: Windows x64 mit pkg 6.18.1 / Node 18, ohne Bytecode
(`--no-bytecode --public --public-packages '*'`). 172 Node-Tests bestanden.
Der entsprechend gepackte ARM64-Missionsprozess bestand den lokalen
IPC-/Authority-Smoke-Test (`MISSION_PACKAGED_PROCESS_SMOKE_OK`, Worker-Exit 0).
