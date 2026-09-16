# Verlustfreier Missionsstand – Transport-Audit v420

Stand 16.09.2026. Anlass: reale Sightseeing-Mission 414765 UTF-8-Bytes,
Cloud bereit, Acquire durch alte lokale 384-KiB-Grenze abgelehnt.

| Weg | Ergebnis / Verhalten |
| --- | --- |
| Cloud Sync V2 | Unveraendert 8 MiB vollstaendiges Profil; 48-KiB-Pakete, Hash-Pruefung, atomare Revision. Keine zusaetzlichen Writes durch diesen Fix. |
| Cloud -> Tracker | Vollstaendiges Resume-Paket nach Aufbau inkl. Replay vor Angebotsfreigabe pruefen. Gemeinsame lokale Obergrenze 12 MiB: 8 MiB Profil plus 4 MiB Reserve fuer abgeleitete Runtime/Replay. Acquire verwendet dieselbe Grenze. Keine Felder geloescht. |
| Legacy Cloud GET | Alte 384-KiB-Antwortgrenze auf die 8-MiB-Profilgrenze abgestimmt. V2-Paketantworten bleiben separat klein begrenzt. |
| Lokaler Restart / Runtime | Vollstaendiges Paket bleibt persistent. Bestehende Journal-Checkpoints bleiben aktiv; weder Cloud-Write-Takt noch Telemetrietakt erhoeht. Grosse Pakete koennen lokale Serialisierung verteuern; Grenze ist kein Performance-Ziel. |
| Direkte App-Uebergabe | Alte Level-3-Kuerzung entfernt (u.a. MissionTruth und Geo-Kontext). Vollstaendigen Stand verwenden. |
| Relay / Geraetewechsel | Weiterhin 512 KiB pro Nachricht inklusive Envelope. App-Kommandos und Tracker-ACKs werden vor Versand geprueft. Bei Ueberschreitung expliziter korrelierter Fehler statt Relay-Abbruch oder stiller Kuerzung. Ein zu grosses Snapshot-ACK liefert keine reduzierte Ersatzmission. |
| EFB / Kartentisch | Lokale HTTP-Antworten haben nicht das Relay-Limit. Kleine Intent-Requests bleiben auf 16 KiB begrenzt; sie transportieren keine ganze Mission. Anzeigeprojektionen sind nicht die Datenquelle fuer Resume oder Export. Fehler direkt am Startbanner und im Log. |
| Flug-Code Export | Zuerst lokalen Fallback-Verweis ueber den vorhandenen Memory/IndexedDB-Vault aufloesen. Niemals reduzierte Notkopie oder geraetelokalen Locator exportieren. Codeformat bleibt kompatibel. |
| Flug-Code / PLN-Backup Import | Gemeinsamen sicheren Missionsspeicher verwenden. Voller localStorage darf Import nicht vor dem IndexedDB-Fallback abbrechen. Fremde Fallback-Locators werden abgelehnt. |
| MSFS PLN | Exportiert Route/Hoehen, kein kompletter Dispatcher-Missionsbackup. Kein Cloud-Profillimit; Tests fuer A-B, POI-Rundflug und A-B-A bestehen. |
| PDF Briefing | Fachliche Darstellung der Mission, kein verlustfreier Backup-Vertrag. |

## Bewusst verbleibende Grenze

Cloud-Pakete sind kein WebSocket-Chunk-Protokoll. Vollstaendiger Remote-Resume oder
Web-Handoff oberhalb 512 KiB braucht noch versionierte Teilpakete mit Hash,
Reihenfolge, Timeout und Capability-Handshake. Das ist hier nicht implementiert.
Geplante grosse Missionen koennen ueber Cloud im Tracker aktiviert werden;
das ist kein Ersatz fuer die Uebertragung des aktuellen laufenden Zustands.
Die neue lokale Grenze darf deshalb nicht auf Relay-Nachrichtengroessen uebertragen
werden. Vor weiterer Freigabe echte Mehrgeraete- und Unterbrechungstests vorsehen.

UI-Listen begrenzen weiterhin ihre Darstellung (z.B. technische Szenen/Manifest-
Zeilen). Der Authority-Stand wird dadurch nicht gekuerzt. Extrem grosse Missionen
mit mehr als den angezeigten Zeilen benoetigen ggf. Pagination, keine Datenreduktion.

## Nachweise

Reales Cloud-Paket lokal: Acquire und Handoff-Prepare erfolgreich.
Grosser Sightseeing-Lauf mit Neustart und Abschluss, lokaler Persistenz-Roundtrip,
UTF-8-Grenztests, Preflight-Rejection, Relay-Fehler ohne Oversize-Versand,
Banner-Fehlermeldung, Export aus IndexedDB und Import bei Quota-Druck.
318 Missions-/Voice-Tests, 105 EFB-Tests, 3 Transport- und 2 Exporttests sowie
MSFS-PLN-Selftest erfolgreich. In-Sim-Praxistest steht aus.
