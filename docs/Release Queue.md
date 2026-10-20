# Release-Warteschlange (Tracker, Desktop, EFB-Paket)

Fertige, getestete Aenderungen, die erst mit dem naechsten Build ausgeliefert
werden. Jeder Agent kann hier einreichen; wer den naechsten Build macht,
liefert alles Offene mit aus.

## Regeln

1. **Einreichen:** Aenderung fertig bauen und testen, nur die eigenen Dateien
   committen (nie `git add -A`), `sw.js` wie bei jedem Push erhoehen und nach
   `origin/main` pushen. Dann unten unter „Offen“ einen Eintrag anlegen
   (Vorlage am Ende). Version, Tag, EXE und `channel/*.json` bleiben
   unveraendert.
2. **Kein eigener Build fuer Wartendes:** Ein Eintrag in „Offen“ bedeutet:
   Code liegt auf `main`, aber in keinem veroeffentlichten Artefakt.
   Aenderungen an `ga-tracker-client/tracker.js` gehoeren nicht in die
   Warteschlange; sie folgen weiter `docs/github-push-workflow.md` Abschnitt 2
   (sofortiger EXE-Release).
3. **Freigabe:** Ein Build/Release passiert nur nach Freigabe durch den User
   (oder wenn er vorher ausdruecklich „gleich ausrollen“ gesagt hat).
4. **Ausliefern:** Wer den naechsten Build macht, liest vorher diese Datei,
   prueft, dass alle offenen Eintraege auf dem Build-Commit liegen, uebertraegt
   die „Doku beim Release“-Hinweise in die genannten Dokumente und verschiebt
   die Eintraege nach „Ausgeliefert“ mit Version und Datum.
5. **Zurueckziehen:** Ein Eintrag, der nicht mit soll, wird vor dem Build
   ausdruecklich zurueckgenommen (Revert-Commit) und hier gestrichen.

## Offen

### 2026-10-20 · Kameraansicht im Debug-Log
- **Artefakt:** Tracker-EXE
- **Dateien:** `ga-tracker-client/tracker-camera-telemetry.js`,
  `ga-tracker-client/tracker-mission-interruption-controller.js` (+ Tests)
- **Was:** `SIM_CAMERA_STATE from=… to=…` bei jedem Wechsel der MSFS-
  Kameraansicht (mit Namen, z. B. `12=world_map`, `11=waiting`,
  `2=cockpit`); `MISSION_INTERRUPTION_DECISION … camera=…`.
- **Warum:** Nachweis, dass Szenen/Zuladung nach einer Unterbrechung erst
  nach „Fliegen“ (Cockpit) neu aufgebaut werden, nicht im „Bereit zum
  Fliegen“-Bildschirm.
- **Tests:** `tracker-camera-telemetry.test.js`,
  `tracker-mission-interruption-controller.test.js`
- **Doku beim Release:** Zeile in `docs/Mission Runtime Authority Contract.md`
  (Unterbrechung, Abschnitt der neuen Tracker-Version).
- **Pruefen im Feld:** Welche Kameraansicht MSFS 2024 im „Bereit zum
  Fliegen“-Bildschirm meldet.

## Ausgeliefert

(noch keine Eintraege)

## Vorlage

```
### JJJJ-MM-TT · Kurztitel
- **Artefakt:** Tracker-EXE | Desktop-App | EFB-Paket
- **Dateien:** …
- **Was:** …
- **Warum:** …
- **Tests:** …
- **Doku beim Release:** …
- **Pruefen im Feld:** …
```
