# Flugtest-Reparaturen vom 17.10.2026

Analysebasis: frisch geladenes `origin/main`, Commit `adc4ec06e`.
Releasebasis nach Fast-Forward einschließlich veröffentlichter Pinnwand: `78d9bbe51`. Vorhandene Änderung
an `AGENTS.md` und lokale Analyseartefakte wurden nicht bearbeitet.

## Befunde aus dem Flug

- Web-Debrief auf Quest verwendete den lokalen Cockpit-HTTP-Client mit
  `127.0.0.1:49880`. Der Browser protokolliert dessen fehlgeschlagenen Request;
  im EFB wurde `close_debrief` erfolgreich bestätigt.
- Zweite Web-App im Hintergrund laut Nutzer. Mehrere Cloud-409, parallele
  Uploadversuche und ein erneuter Cloud-Restore derselben abgeschlossenen Mission
  sind protokolliert. Welche Instanz jede einzelne Revision geschrieben hat,
  lässt sich aus diesen Logs nicht eindeutig zuordnen.
- Freiburg: Die protokollierte Redaktionsteam-Position
  `48.02317336175902, 7.832548049571594` entspricht dem alten repräsentativen
  Flughafenversatz mit Heading 237 Grad nahezu exakt. Das belegt die Verwendung
  dieses Fallbacks, nicht eines nachgewiesenen Vorfeldpunkts. Die bisherige
  OSM-Auswahl prüfte außerdem nur den Szenenanker.
- Zwei `arrival_person_*` wurden erzeugt. Der Ausstiegs-/Fahrzeugablauf behandelte
  nur den einen Manifestpassagier. Für die Empfangsrollen fehlte eine Abfahrt.
- Der Tracker lehnte drei Cargo-Entladungen mit
  `mission_manifest_unload_not_allowed` ab. Die Logs enthalten an diesen Stellen
  keine Item-ID: Die genaue Identität/Definition des optionalen Items ist damit
  nicht bewiesen. Die gefundene allgemeine Freigabelücke ist reproduziert.

## Reparatur und Grenzen

1. Terminales Web-Debrief über den bestehenden authentifizierten Relay-Intent;
   EFB-HTTP bleibt verfügbar. Fehlgeschlagener Abschluss bleibt wiederholbar.
   Lokales Aufräumen wird bei gleichzeitigem ACK/Snapshot nur einmal ausgeführt.
2. Abschluss-Clear wird lokal vorgemerkt, liest die aktuelle Cloud und verwendet
   deren Profilrevision und explizite Missionsrevision. Andere Profilfelder bleiben
   erhalten; lokale und entfernte Logbucheinträge werden zusammengeführt. Eine
   inzwischen ersetzte Mission wird nicht gelöscht. CAS-Fehler behalten den Marker.
   Auch nach Reload kann die verzögerte Cloud-Kopie die abgeschlossene Mission
   nicht erneut als geplanten Auftrag einsetzen.
3. Revisionskenntnis bleibt je Browserinstanz. Automatischer Profil-Sync und
   Konfliktdialoge pausieren in verborgenen Ansichten. Überlappende Uploads innerhalb
   einer Ansicht werden vorgemerkt. Gleichartige Tracker-Projektionen und reine
   entfernte Profiländerungen ohne lokale Gegenänderung brauchen keinen Dialog.
   Abgelehnte Revisionen werden nicht wiederholt abgefragt und nicht als gelesen
   quittiert. Echte konkurrierende Änderungen auf verschiedenen Geräten können
   weiterhin korrekt einen CAS-Konflikt auslösen.
4. Optionales Nicht-PAX-Cargo ohne Home- oder Target-Pickup-Bindung darf in
   `end_unloading`/`end_ready` bei bestätigtem Bodenstillstand behandelt werden.
   Es wird dadurch nicht zur Pflichtlieferung. Die gemeinsame Manifesttransition
   behält Signatur-, Compliance-, Payload- und visuelle Wirkungen.
5. OSM-Kandidaten einschließlich aller Live-Alternativen müssen die vollständige
   Szenenaufstellung aufnehmen. Polygonränder, Runway-/Taxiway-Puffer und
   Objektabstände werden geprüft. Bei neuen Plänen ohne belegte sichere Standard-APT-Fläche entfällt
   die statische Empfangsszene; der Ankunftseffekt quittiert dies ohne Sim-Auftrag.
   Die reguläre Ankunft/Entladung bleibt über den Flughafen möglich. Das Briefing
   kennzeichnet die fehlende sichere Szenenposition. Kein Anspruch auf perfekte
   Übereinstimmung zwischen OSM und der installierten MSFS-Szenerie.
6. Nur explizit zugewiesene Medien-Empfangspersonen laufen zum Abholfahrzeug und
   werden nach der Gehzeit als zugestiegen entfernt. Abfahrt wartet auf erfolgreiche
   Routenübermittlung. Empfangspersonen sind keine zusätzlichen Manifestpassagiere.
   Gewöhnliche Empfangskontakte und Bush-Pickup-PAX behalten ihre Rollen.

## Verifikation

Release-Prüfung: 353 gezielte Node-Tests, davon zunächst ein veralteter
POI-Testharness ohne neue Draft-Session-/Prepare-Funktion. Der Harness wurde
an den tatsächlichen Einstieg angepasst; seine 18 Tests bestehen erneut.
Alle übrigen 352 Tests bestanden im gemeinsamen Lauf. Zusätzlich bestehen
Ground-Flow-, Mission-Update-, Storage- und Interface-Selbsttests, Syntaxprüfungen
und Cargo-Extraktionsprüfung. Browser: echter DOMParser/OSM-Fallback, vier
Vorfelder, 32 Flächen, 278 Ausschlüsse; 148 ms für lokalen Testablauf.
Windows-Artefakt v557: 173973057 Bytes, SHA-256
`2f111aa7a163f3c0c749dce02d67b6069b7f71210943c61717d17010a57e2250`.

- Neue reproduzierbare Fälle: `tools/flight-report-20261017.test.mjs`;
  tatsächlicher Cargo-Adapter einschließlich Replay/Neustart, Erfolgspflicht- und
  Home-/Pickup-Negativfällen; explizit ausgelassene Ankunftsszene im Sim-Adapter.
- Cloud-Clear mit CAS, unveränderten entfernten Profilfeldern, Logbuch-Merge,
  Ersatzmission, fehlgeschlagenem Commit und überlappenden Saves.
- Bestehende Tracker-/Debrief-/EFB-/Cloud-Server-Regressionen; Ground-Flow-,
  Storage-, Interface- und Mission-Update-Selbsttests.
- EFB-Debrief im echten lokalen Electron-Browser: ACK-Warten, Fehler/Wiederholung,
  entfernte Quittierung, veralteter Poll und sichtbarer Button in drei Fenstergrößen
  (`900x640`, `440x894`, `894x440`). Screenshots visuell geprüft.
- Windows-EXE v557 mit pkg/Node 18.20.8 und expliziter Paketkonfiguration gebaut.
  Apple-ARM64-Build benötigt `--no-bytecode --public --public-packages '*'`, da
  der x64-Fabricator auf diesem Host nicht ausführbar ist. Voriger v556-Build
  vor dem erfolgreichen Neubau separat unter `/tmp` gesichert.

Der öffentliche OSM-Map-Abruf für EDTF war erfolgreich; der reale Kartenausschnitt
ist als attribuierte Fixture hinterlegt. Der Browsernachweis prüft XML-Parsing,
Overpass-Ausfall, OSM-Fallback und gespeicherte Platzierung. Kontrollierte
Composer-Antworten prüfen Auswahl und Korrekturrunden. Nach ausdrücklicher Nutzerfreigabe bestand auch ein echter Gemini-3-Flash-Test:
zwei HTTP-200-Aufrufe, selbst gewähltes Vorfeld bei 48.022729, 7.834948,
finalLayoutValidated=true und keine Geometriefehler. Die echte Antwort deckte
eine doppelte interne Empfangsperson-Kennung auf; eindeutige Zuordnung wurde
korrigiert und mit derselben gespeicherten Antwort sowie eigenem Test geprüft.
Sichtprüfung von Gehwegen, Fahrzeugfahrt und tatsächlichen Pistenabständen in
MSFS/Quest ist weiterhin erforderlich. Rollout nach Nutzerfreigabe auf Origin/Alpha; Stable bleibt unverändert.

Arbeitsbasis zum Rollout: Origin-Pinnwand-Commit `78d9bbe51` wurde per
Fast-Forward übernommen. board.js/index.html waren vorab bytegleich mit Origin.
Die gemischten Änderungen wurden vorher als Patch gesichert; fremde AGENTS.md-
und Analyseentwürfe bleiben lokal. Web-Cache v2132; Tracker v557 wird als
unveränderlicher Release veröffentlicht und erst nach Downloadprüfung im
Alpha-Kanal aktiviert. Kein neuer EFB-SDK-Build nötig: die Änderung betrifft
den vom Tracker ausgelieferten Web-Host. Simulator-/Quest-Feldtest bleibt offen.
