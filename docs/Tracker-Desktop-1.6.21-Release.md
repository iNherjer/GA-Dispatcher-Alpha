# Desktop 1.6.21 – Autostart: Admin-Aufgaben, SimConnect-Stufe, Protokoll

Basis: Desktop 1.6.20 (`origin/main`). Tracker-Runtime unverändert.

## Fehler in 1.6.20

Programme mit Adminrechten (z. B. SayIntentions) wurden beim Sim-Ende nicht
geschlossen: Die Desktop-App läuft ohne Adminrechte und darf solche Prozesse nicht
beenden. Beim Start fragte Windows jedes Mal per UAC nach.

## Änderungen

- Admin-Programme laufen über je zwei feste Windows-Aufgaben unter `\VFR Multitool\`
  (Start/Stop, höchste Rechte). Anlegen einmalig mit UAC; Pfad, Argumente und
  „Minimiert“ sind fest eingetragen, zur Laufzeit wird nichts übergeben. Änderungen
  erneuern die Aufgaben, Aufgaben gelöschter Einträge werden dabei entfernt.
  Abgelehnte UAC: direkter Start mit RunAs wie bisher.
- Rückfall beim Schließen: `taskkill` mit „Zugriff verweigert“ wird einmal mit
  Adminrechten wiederholt.
- Option „Minimiert starten“ im ⋯-Menü.
- Zweite Stufe „Auf SimConnect warten“: Programme unter einer verschiebbaren
  Trennlinie in derselben Liste starten erst, wenn der Tracker SimConnect verbunden
  mit Daten (live/Ruhemodus) 10 s stabil meldet; Abbruch nach 30 min, bei Sim- oder
  App-Ende. Der Sim bleibt immer oberhalb.
- Sim-Eintrag optisch hervorgehoben.
- Protokoll `autostart-log.txt` im Tracker-Datenordner (Start, PIDs, Sim-Erkennung,
  SimConnect, Aufgaben, Schließen, Fehler).

## Prüfung

- 100 Desktop-Tests bestanden (Aufgaben, abgelehnte UAC, Zugriff verweigert,
  Minimiert, SimConnect-Stufe inkl. Abbruch, Protokoll).
- Oberfläche im Browser mit dem echten UI geprüft.
- Offen: Windows-Feldtest mit SayIntentions (UAC-Einmalabfrage, Schließen über
  Aufgabe) und echter SimConnect-Stufe.
