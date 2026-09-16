# Verlustfreier Profil-Sync V2

Stand: 2026-09-16, Tracker v413 / Web-SW v1785.

## Anlass und Vertrag

Der bisherige persoenliche Upload musste in die selbst gesetzte Worker-Grenze
von 256 KiB JSON-Zeichen passen. Seine spaeten Reduktionsstufen entfernten sogar
`activeMissionTrackerSeed`, `missionTruth` und `targetGeoContext`. Dadurch konnte
die App eine geplante Mission anzeigen, waehrend der Tracker keine startbare
Mission fand. Weitere Felder einzeln von der Reduktion auszunehmen loest dieses
strukturelle Problem nicht.

V2 transportiert den vollstaendigen vom App-Sync gelieferten JSON-Zustand.
Gzip ist verlustfrei; bei fehlender Browser-Kompression wird JSON unveraendert
paketiert. Es gibt keine groessenabhaengige Feld-, Text- oder Listenkappung.
Bestehende lokale Speicher-/Logbuch-Retention und die fachlichen
Payload-Erzeuger sind davon getrennt: Bereits lokal oder frueher in der Cloud
entfernte Informationen kann der Transport nicht rekonstruieren.

## Bausteine

- `cloud-sync-core.js`: kanonische JSON-Serialisierung, UTF-8, Gzip, SHA-256,
  Paketierung und beidseitige Integritaetspruefung. Gemeinsam in Web, Tracker und
  Worker; keine duplizierte Missionsklassifikation.
- `cloud-sync-client.js`: Head lesen, fehlende Teile ermitteln, sequenziell
  hochladen, Revision veroeffentlichen, begrenzter Lese-Cache.
- `tools/cloudflare-worker/profile-sync.mjs`: ein SQLite Durable Object pro
  authentifizierter Pilot-ID; stark konsistente Teile und atomarer Head.
- Neu registrierte Pilot-IDs erhalten einen serverseitigen, unveraenderlichen
  Speichernamensraum. Nach Loeschung/Ablauf und erneuter Registrierung derselben
  ID ist der fruehere V2-Stand nicht fuer das neue Konto lesbar. Bestehende
  Registrierungen behalten ihren bisherigen Speicher ohne Datenmigration.
- Bestehendes `GA_SYNC_KV`: Pilot-ID/PIN, Registrierung, Aktivitaets-Heartbeat,
  Legacy- und Gruppenprofile bleiben dort.
- `sync.js`: persoenliche Uploads verwenden ausschliesslich V2. Cloud-Pulls
  bestaetigen eine Revision erst nach Anwendung. Neue Revisionen werden auch bei
  abweichenden Geraeteuhren erkannt. Waehrend Uploads eintreffende lokale
  Aenderungen bleiben vorgemerkt und werden erneut hochgeladen.
- `tracker-mission-cloud.js`: laedt nur Mission und Zeitstempel. Der bestehende
  APT-/POI-Kandidat, Autoritaetswechsel, Lifecycle und Voice bleiben unveraendert.

## Paket und Grenzen

Ein Manifest enthaelt `mission` und weitere `field:<name>`-Abschnitte.
`mission` enthaelt **zusammen** `activeMission` und `activeMissionTrackerSeed`.
Andere Felder (Logbuch, Ausruestung, Pinnwand, Einstellungen etc.) werden separat
komprimiert. Unbekannte bestehende Abschnitte werden beim Schreiben erhalten;
fehlendes Feld ist keine implizite Loeschanweisung. Explizites `null` bleibt null.
PIN und Sync-ID werden nicht in Pakete aufgenommen.

- Maximal 8 MiB dekodiertes UTF-8-JSON insgesamt.
- Maximal 64 Abschnitte und 256 referenzierte Teile.
- Teilgroesse maximal 48 KiB Binaerdaten, als Base64 maximal 64 KiB.
- POST-Body maximal 96 KiB, beim Lesen des Streams durchgesetzt.
- SHA-256 fuer jeden Teil und jeden vollstaendigen dekodierten Abschnitt.
- Auch Dekompression wird begrenzt; ein defektes oder unvollstaendiges Paket wird
  nicht freigegeben und nicht als neue/leere Mission angewendet.
- Lese-Cache maximal 12 MiB Base64-Daten, nur im Prozess; Abmeldung/Pilotwechsel
  erzeugt einen anderen Client. Kein PIN in URLs der neuen Endpunkte.
- Staging maximal 1024 Teile pro Pilot. Unreferenzierte Teile laufen nach
  24 Stunden aus; aktueller und vorheriger Head bleiben geschuetzt. Alarme enden,
  sobald keine unreferenzierten Teile mehr aufzuraeumen sind.

Die Grenzen werden offen als Fehler gemeldet. Der vorherige Head und der lokale
Pending-Marker bleiben bei einem Fehler erhalten. Auch ein Cloudflare-
Kontingentfehler darf niemals eine gekuerzte Ersatzversion erzeugen.

## Ablauf und Konflikte

1. Authentifizierten Head lesen (`GET /api/sync-v2/head`).
2. Abschnitte bilden und fehlende SHA-256-Teile erfragen (`POST .../missing`).
3. Nur fehlende Teile hochladen (`POST .../chunk`), maximal ein Upload gleichzeitig.
4. `POST .../commit` mit `baseRevision` und Manifest. Der Durable Object prueft
   Revision, alle Teile, dekodierte Laengen, Hashes und JSON vor der Freigabe.
5. Erst dann werden neuer Head und vorheriger Head gemeinsam gespeichert.

Ein fremder neuerer Head erzeugt 409. Reines Lesen bestaetigt ihn nicht. Ein
bewusst bestaetigter manueller App-Upload darf den zu Beginn beobachteten Stand
ersetzen, bleibt aber gegen eine weitere Aenderung waehrend des Uploads geschuetzt.
Ein bereits veroeffentlichter identischer Inhalt kann nach verlorener Antwort
ohne weitere Teile bestaetigt werden; der urspruengliche Zeitstempel bleibt dabei.

Die aktuelle Umsetzung schuetzt das gesamte Profil mit einer Revision. Sie
fuehrt konkurrierende Aenderungen nicht stillschweigend zusammen. Das vermeidet
insbesondere inkonsistente Kombinationen aus Mission, Seed und Ausruestung.
Logbuch-Eintraege werden vorerst als gemeinsamer komprimierter Abschnitt behandelt:
Einzelobjekte pro Eintrag wuerden bei der vorhandenen lokalen Retention mehr
Worker-Operationen verursachen. Live-Telemetrie wird nicht in diesen Sync verlegt.

## Migration und Kompatibilitaet

Worker zuerst ausrollen, dann Web und Tracker. Ein Profil ohne V2-Head bleibt aus
dem bisherigen KV-Format lesbar. Die erste automatische Migration prueft den
bekannten Legacy-Zeitstempel; bei abweichender Cloud-Version zuerst laden oder
bewusst manuell hochladen. Zwei erste V2-Schreiber werden durch Revision 0
serialisiert. KV-Legacy-Schreiber haben keinen atomaren Versionsvertrag; nach
V2-Freigabe sind sie fuer dieses Profil gesperrt.

Legacy-GET liefert fuer migrierte Profile den V2-Zustand, Legacy-POST dagegen 409
mit Aktualisierungshinweis. Gruppen und Checklisten behalten ihren bisherigen
Weg. Aeltere Tracker haben noch eine kleine Gesamtantwortgrenze und sollten vor
Verwendung eines grossen migrierten Profils auf v413 aktualisiert werden.

Kein automatischer Fallback auf den alten verlustbehafteten Upload bei einem
V2-Fehler. Ein Rollback darf den V2-Datenspeicher bzw. die Writer-Sperre nicht
entfernen. Fuer die Reparatur des gemeldeten POI-Falls die App mit dem erhaltenen
vollstaendigen lokalen Missionsstand aktualisieren und einmal hochladen.

## Volumen und Betrieb

Die alten 256 KiB waren Anwendungscode, keine allgemeine Cloudflare-KV-Grenze.
V2 fuegt Durable-Object-Requests/-Speicheroperationen hinzu. KV bleibt fuer die
Authentifizierung je Anfrage beteiligt. Der erste Upload braucht mehr Requests;
spaetere Uploads schicken nur neue Teile. Tracker-Polls lesen den kleinen Head
und bereits bekannte Teile aus ihrem lokalen Cache, nicht erneut das Logbuch.

Cloudflare Free hat u.a. Tageskontingente fuer Workers, KV und Durable Objects;
Paid hat enthaltene Mengen und ggf. Mehrkosten. Paketierung umgeht diese
Kontingente nicht. Aktueller Kontotarif wurde nicht als Free oder Paid behauptet.
Quellen: https://developers.cloudflare.com/kv/platform/limits/,
https://developers.cloudflare.com/kv/platform/pricing/,
https://developers.cloudflare.com/durable-objects/platform/pricing/.

Diagnose im Profilmenue: vollstaendige UTF-8-Bytes, neue Base64-Paketdaten,
neue/wiederverwendete Teile, Revision und Status. Paketdaten sind keine exakte
HTTP-Abrechnung: Header, Head, Manifest und Missing-Abfrage kommen hinzu.

## Pruefung / Leitlinie fuer weitere Missionsfamilien

- Rundreise ueber 256 KiB mit Unicode, MissionTruth, Zielkontext und Seed.
- Komprimierbare und zufaellige mehrteilige Daten; Browser/Node-Interoperabilitaet.
- Abbruch vor Commit, verlorene Commit-Antwort, defekte/fehlende Teile.
- Zwei Geraete, alte Revision, bloss gelesen vs. wirklich angewendet.
- Unbekannte Abschnitte, Loeschung durch explizites null, Quoten und Orphan-GC.
- Echter lokaler Workers-/Durable-Object-Runtime mit synthetischem Profil,
  Legacy-GET, gesperrtem Legacy-POST und falschem PIN.
- Weiterhin originale APT-/POI-Authority-, Cargo-, Lifecycle- und Voice-Tests.

Neue Missionsfamilien liefern ihre vollstaendigen fachlichen Daten an denselben
Transport. Keine neue Groessen-Whitelist, keine zweite Missions-State-Machine,
keine Seed-Reduktion. Fachliche Startbereitschaft bleibt beim bestehenden Adapter.
Ein erfolgreicher Transporttest ersetzt keinen Windows-/MSFS-Feldtest.

## Zusaetzlicher Befund: Sightseeing-Gate

Die Gegenprobe im v413-Umbau zeigt: `sightseeing_tour` ist in den aktuellen
`DOMAINS` von `mission-poi-voice-core.js` und `tracker-mission-poi-runtime.js`
nicht freigegeben. `paxVoiceBuildPoiAuthorityContext` liefert deshalb keinen
Tracker-Kontext. Der gemeldete Rundflug kann somit auch ohne Transportverlust
keinen Startseed erzeugen. Die fruehere Einschaetzung, diese Domain sei bereits
freigegeben, war falsch. V2 beseitigt die Transportreduktion; es erweitert nicht
implizit das fachliche Gate. Sightseeing benoetigt einen gesonderten Vergleich
mit Original-Ablauf, Wissenskontext und Voice vor Freigabe.

### Schutz bei lokal unvollstaendiger Wiederherstellung (SW v1785)

Muss der lokale Speicher nach Cloud-Download Pinnwand/Logbuch wegen Quote bzw.
lokaler Historiengrenze kuerzen, wird die automatische Schreibbasis persistent
ungueltig markiert. Dieser lokale Teilstand darf nicht automatisch das
vollstaendige V2-Profil ersetzen. Ein bewusst bestaetigter manueller Upload
bleibt moeglich. Die vorhandene Legacy-Normalisierung bleibt im lokalen
Logbuch-Merge; der Upload selbst normalisiert/kuerzt keine Eintraege.

## Gemessene Kontingentbelastung (2026-09-16)

Reproduzierbar ohne Cloudkonto: `node tools/cloud-sync-quota-audit.mjs`.
Das Werkzeug verwendet echten Client, Worker und ProfileSync mit zaehlendem
Test-Speicher. Synthetisches Profil: 346087 Rohbytes, 11 verschiedene Teile.

| Vorgang | HTTP / Worker-Anfragen | KV-Reads | DO-Anfragen | KV-Profil-Writes |
| --- | ---: | ---: | ---: | ---: |
| Erstupload (11 neue Teile) | 14 | 14 | 14 | 0 |
| Erstes selektives Tracker-Lesen | 3 | 3 | 3 | 0 |
| Unveraenderter Tracker-Poll | 1 | 1 | 1 | 0 |
| Missionsupdate (2 neue, 9 wiederverwendete Teile) | 5 | 5 | 5 | 0 |
| Tracker liest diesen neuen Stand | 3 | 3 | 3 | 0 |

Upload allgemein: N neue Teile + 3 Anfragen (Head, Missing, Commit).
Vor V2 brauchte ein Profilupload eine Worker-Anfrage, einen Auth-KV-Read und
einen KV-Profil-Write. V2 verschiebt Profilschreiben in den Durable Object;
Registrierung/Heartbeat bleiben davon getrennt.

Der wartende Tracker pollt alle 2500 ms: 1440 Anfragen/Stunde oder 34560/Tag
bei durchgehendem Warten. Bei aktivem Missionslauf pausiert dieser Poll.
Unveraendertes V2-Polling erhoeht die Worker-Anfragen nicht, fuegt aber je
Anfrage einen DO-Aufruf hinzu. Solange ein Profil noch keinen V2-Head besitzt,
kann der Legacy-Fallback zwei HTTP-Anfragen pro Poll verursachen.

Beispielrechnung, keine gemessene Kontonutzung: Eine Stunde Warten plus 20
Uploads (ein Erstupload, 19 Updates wie oben) und 20 nachfolgende neue Lese-
staende ergibt 1589 statt 1460 Worker-Anfragen, also rund 8,8 Prozent mehr.
Gleichzeitig entstehen 1589 DO-Anfragen als separates Kontingent. Die Quote
haengt stark von Uploadhaeufigkeit, Teilanzahl und Wartezeit ab.

Grenzen dieser Messung: keine HTTP/TLS-Header, OPTIONS-Preflights, Retries,
anderen Endpunkte oder Cloudflare-internen SQL-/Indexoperationen. Gezaehlte
Storage-Key-Zugriffe sind keine exakte Abrechnung von SQLite-Zeilen.
Die hohe Komprimierbarkeit der synthetischen Daten ist keine Prognose fuer
reale Nutzerprofile. Aktueller Tarif und gesamter Kontoverbrauch sind unbekannt.

Offizielle Kontingente separat betrachten: Worker-Anfragen, KV-Reads/Writes,
DO-Anfragen, DO-Laufzeit und SQLite-Speicheroperationen. Insbesondere bedeutet
weniger uebertragene Bytes nicht automatisch weniger abrechenbare Anfragen.
Quellen: https://developers.cloudflare.com/kv/platform/pricing/ und
https://developers.cloudflare.com/durable-objects/platform/pricing/ .

## Schreiboptimierung v414

Die obige Messung beschreibt v413. Ab v414 werden Faehigkeiten im Head
angekuendigt (`inlineMetadata`, `batchChunks`); neue Clients fallen bei aelteren
Workern automatisch auf Einzeluploads und separate Metadaten zurueck.

- Der kleine lastModified-Wert liegt mit seinem normalen Hash-Deskriptor und
  verifiziertem Inline-JSON direkt im Manifest. Keine Felder gehen verloren.
  Inline ist ausschliesslich fuer diese Metadaten erlaubt, maximal 128 Rohbytes.
- Ein neuer Client liest `head?inlineMetadata=1` ohne Schreibzugriffe. Ein alter
  Client liest weiter `head`; nur dann materialisiert der Worker bei Bedarf
  einmalig das normale Metadatenpaket. Dadurch bleiben alte Tracker und auch
  verzoegerte Downloads alter Heads kompatibel. Gemischter Betrieb spart daher
  weniger als ausschliesslich neue Clients.
- `POST chunks` validiert das gesamte Paketbuendel vor dem Speichern. Maximal
  90 KiB je Client-Body und 127 Teile, damit einschliesslich Zaehler die
  Plattformgrenze von 128 geschriebenen Schluesseln eingehalten wird.
  Server-Bodygrenze weiterhin 96 KiB. Zaehler nur einmal pro Buendel; identische
  bereits gespeicherte Teile werden bei Retries nicht erneut geschrieben.
- Missing-Abfragen mit bis zu 256 IDs werden intern in hoechstens 128 Schluessel
  je Speicherleseaufruf zerlegt. GC schreibt den Zaehler nur bei Aenderung.
- Revision, atomarer Commit, vollstaendige Hash-/Groessenpruefung, aktuelle und
  vorige Version sowie lokale Pending-Marker bleiben erhalten.

Gleicher synthetischer Benchmark mit neuen Clients:

| Vorgang | HTTP vorher → jetzt | geschriebene Storage-Schluessel vorher → jetzt |
| --- | ---: | ---: |
| Erstupload | 14 → 4 | 24 → 13 |
| Missionsupdate | 5 → 4 | 6 → 4 |
| Erstes / geaendertes Tracker-Lesen | 3 → 2 | 0 → 0 |
| Unveraenderter Poll | 1 → 1 | 0 → 0 |
| Unveraenderter Speicher-Versuch | 2 → 1 | 0 → 0 |

Das entspricht im Beispiel 46 Prozent weniger gespeicherten Schluesseln beim
Erstupload und 33 Prozent beim Missionsupdate. Alarm- und interne SQLite-
Abrechnung sind davon getrennt. Groessere/unterschiedliche Nutzdaten fuehren
zu anderen Paket- und Buendelzahlen; dies ist keine allgemeine Kostenprognose.

Rollout: Worker zuerst, danach Web/Tracker. Alte Clients bleiben kompatibel.
Ein Worker-Rollback muss die Inline-Leselogik beibehalten, sobald solche Heads
existieren; blosses Zuruecksetzen auf den alten Worker wuerde Inline-Pakete
nicht mehr rekonstruieren. Client-Rollback funktioniert ueber Materialisierung.
