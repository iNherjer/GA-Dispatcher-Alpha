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


## Ergaenzung v421: Relay-Geraetewechsel umgesetzt

Die oben beschriebene verbleibende Relay-Grenze von v420 ist fuer aktuelle App
und Tracker v421 durch `mission-transfer-core.js` aufgehoben. Das Limit von
512 KiB pro Nachricht bleibt bestehen. Kleine Nachrichten laufen unveraendert.

- Capability `mission.transfer.v1`; App-Anfragen tragen `missionTransferPeer`.
  Diese Kennung gilt nur fuer die aktuelle Seite, getrennt von der persistenten
  Authority-Client-ID: Auch zwei Tabs desselben Browsers quittieren sich nicht
  gegenseitig. Alte Gegenstellen erhalten bei Uebergroesse einen expliziten Fehler.
- Vollstaendiges UTF-8-JSON mit SHA-256, 48-KiB-Binaerteilen und base64-Verpackung
  (ca. 64 KiB je Frame). Maximal 16 MiB inkl. Envelope, fachliches Resume-Limit
  unveraendert 12 MiB. Keine Kuerzung von Missionsfeldern.
- Vier unquittierte Teile je Transfer; maximal vier Datenframes pro 100-ms-Tick.
  Socket-Rueckstau ueber 256 KiB pausiert den Versand. Kleine Einzelquittungen,
  selektive Wiederholung nach 1,5 s, maximal 90 s pro Transfer.
- Verlorene Abschlussquittungen werden abgefragt, ohne die Missionsaktion erneut
  auszuliefern. Zwei parallele Transfers und zusammen 16 MiB deklarierte Nutzdaten
  je Richtung. Empfang erst nach Groessen-, Hash-, UTF-8- und JSON-Pruefung.
- Pilot-ID/PIN werden vor dem Empfang geprueft; rekonstruierte Nachrichten
  durchlaufen wieder die bestehende Authority-/Envelope-Verarbeitung. Besitzer-
  und Revisionspruefungen bleiben erhalten. Transportframes erzeugen keine
  Missionseffekte oder Journal-Checkpoints.
- RAM-Transferzustand ueberlebt Socket-Reconnect/Relaywechsel. App-Neuladen oder
  Prozessneustart erfordert eine neue Anfrage. Keine persistierten Teilpakete.
- Snapshot-/Acquire-/Release-Anfragen warten maximal 210 s auf die fachliche
  Antwort, als Reserve fuer beide Transferrichtungen. Normale Bedien-Intents
  behalten ihre bisherigen Fristen. Fehler geben den Snapshot-Hash frei, damit
  spaetere Synchronisierung den fehlgeschlagenen Stand erneut senden kann.

Verbrauch: grosse Relay-Pakete haben durch base64 etwa 33 % mehr Daten plus
Header/Quittungen. Fehlende Teile werden einzeln wiederholt. Cloud-V2-Deduplizierung,
Profilgrenze und Write-Takt bleiben unveraendert. Mehr Relay-Nachrichten, aber
keine zusaetzlichen persistenten Writes durch diese Transportframes. Vorhandene
Dual-Relay-Verteilung bleibt bestehen; Telemetrietakt unveraendert.

Nachweise: Browser-VM gegen Node, bidirektionaler Unicode-Roundtrip und 12-MiB-
Paket, fremdes Zielgeraet, vertauschte/doppelte/verlorene Teile, verlorene finale
Quittung, Verbindungsunterbrechung, Timeout, beschaedigte Daten, Speichergrenzen,
tatsaechliche App-/Tracker-Sendestellen. Echte bidirektionale Uebertragung von
Paketen ueber 512 KiB in isolierten Cloudflare- und Render-Testraeumen erfolgreich.
In-Sim-Geraetewechsel bleibt als Praxistest erforderlich.
