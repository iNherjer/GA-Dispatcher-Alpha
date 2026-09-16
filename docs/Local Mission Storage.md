# Lokale Missionsspeicherung und Geo-Cache

Stand: 2026-09-16, Web-SW v1788. Tracker v414 und Cloud-Protokoll unveraendert.

## Ursache

Die iPhone-Diagnose meldete 9,41 MB localStorage und QuotaExceeded beim
Speichern einer neuen Mission. Viele ga_target_geo_context_v4_*-Eintraege
wurden als App-Einstellungen gezaehlt. Ihr TTL von 12 Stunden verhinderte zwar
die Nutzung alter Daten, entfernte aber die abgelaufenen Schluessel nicht.
Die alte Notfallroutine versuchte eine gekuerzte Mission vor einer Bereinigung;
anschliessend las der verlustfreie Cloud-Transport bereits reduzierte Quelldaten.

## Neuer Ablauf

`mission-storage-core.js` wird vor sync.js/app.js geladen und offline gecacht.
Nur Geo-Cache-Schluessel werden beim Start, Zugriff und Schreiben bereinigt:
12 Stunden TTL, maximal 32 Eintraege und 512 KiB je local/sessionStorage,
gerechnet als UTF-16 inklusive Key. Aelteste Eintraege zuerst; ungueltige,
abgelaufene und zukuenftige Zeitstempel werden entfernt. Ein einzelner zu
grosser Cachewert wird nicht gespeichert; der aufrufende Missionsaufbau
behaelt seinen vollstaendigen Wert. Cachebereinigung veraendert keine
eingebetteten Missionsdaten, Klassifikation, Logbuecher oder Checklisten.

Missionsspeicherung versucht immer zuerst den vollstaendigen Stand. Bei
Quotendruck werden entbehrliche Caches bereinigt und derselbe volle Stand
nochmals gespeichert. Ein frueherer Quotenfehler erzwingt keine dauerhafte
Kuerzung weiterer Missionen.

Falls das nicht reicht, bleibt ein unveraenderter JSON-Snapshot im RAM und
wird asynchron nach IndexedDB `ga-full-mission-v1` geschrieben. Die Datenbank
haelt maximal zwei vollstaendige Snapshots (current/previous), transaktional
mit zufaelligen Versions-IDs. localStorage bekommt eine kompakte Kopie mit
`localStorageFallbackId` oder bei sehr knappem Platz nur diesen Verweis.
Runtime-Marker-Aenderungen aktualisieren ebenfalls die volle Sicherung.

Restore loest den Verweis vor Anwendung der Mission auf. Ein zwischenzeitlicher
Reset oder neuer Stand macht einen alten asynchronen Lesevorgang ungueltig.
Cloud-Uploads bevorzugen den vollen RAM-Stand; nach Reload wird vor Upload aus
IndexedDB geladen. Eine markierte kompakte Kopie ohne volle Sicherung darf
auch bei manuellem Upload nicht als vollstaendige Mission gesendet werden.
Reset-/Clear-Pfade loeschen RAM-Verweise; alte IndexedDB-Snapshots werden ohne
passenden localStorage-Verweis nicht wiederhergestellt.

## Diagnose und Grenzen

Neue Kategorie Missions-Geo-Cache mit Anzahl, Groesse und Budget.
Missionsspeicherung zeigt full-local, full-memory-idb-pending,
full-indexeddb oder full-memory-only inklusive Fehler.
Wenn beide dauerhaften Browser-Speicher nicht beschreibbar sind, bleibt nur
RAM bis zum erfolgreichen Cloud-Upload. IndexedDB-Erfolg wird erst nach
Transaktionsabschluss gemeldet. Frueher bereits gekuerzte Daten werden nicht
rekonstruiert. Die Origin-Speicherquote ersetzt kein localStorage-Limit.

## Nachweise

`tools/mission-storage-selftest.mjs`: TTL/Budget, fremde Daten unberuehrt,
IndexedDB-Neustart und Zwei-Versionen-Retention, fehlende IndexedDB,
Cachebereinigung vor Kuerzung, voller Upload-Fallback, Runtime-Marker und
Schutz gegen Reload ohne Sicherung sowie asynchronen Restore nach Reset.
IndexedDB-Test mit fake-indexeddb, isoliert ohne neue Produktabhaengigkeit:

```
npm install --prefix /tmp/ga-storage-test-runtime fake-indexeddb --no-audit --no-fund
GA_STORAGE_TEST_IDB=/tmp/ga-storage-test-runtime/node_modules/fake-indexeddb node tools/mission-storage-selftest.mjs
```

Zusaetzlich Cloud-Storage-, Mission-Update-Sync- und Route-Restore-Selftests.
Kein realer Safari/iPhone-Quotentest auf dem Entwicklungsrechner.
