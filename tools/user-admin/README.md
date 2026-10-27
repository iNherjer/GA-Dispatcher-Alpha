# GA Nutzer Admin

Lokales Admin-Tool für Sync-Nutzerlisten und Bugreport-KV-Cleanup.

## Start und Smartphone

Im Repo-Root:

```bash
./start-user-admin.command
# Optional anderer Port:
./start-user-admin.command 8902
```

Voraussetzungen: Node.js, über Wrangler angemeldetes Cloudflare-Konto und eine
Internetverbindung. Der Node-Proxy liest mit `npx wrangler` aus dem bestehenden
Cloudflare-KV. Die Pilot-Zugangsdaten verlassen den Server nur zur vorhandenen
HTTPS-Sync-API; sie werden niemals an den Browser ausgegeben.

Der Server lauscht auf `127.0.0.1` und zusätzlich auf den beim Start erkannten
Tailscale-IPv4-Adressen (100.64.0.0/10). Die Smartphone-URL erscheint im Terminal
und oben im Tool, beispielsweise `http://100.77.253.89:8900/`.

1. Tailscale auf Mac und Smartphone verbinden, bevor das Tool startet.
2. Auf dem Smartphone die ausgegebene Tailscale-URL öffnen.
3. Mac und Tool müssen laufen; nach einer Änderung der Tailscale-Adresse das
   Tool neu starten. Tailscale-Zugriffsregeln müssen die Verbindung erlauben.

Es gibt keinen Listener auf der WLAN-Adresse oder allen Interfaces. Der Zugang
wird durch das Tailnet und dessen Zugriffsregeln begrenzt; es gibt keine weitere
Tool-Anmeldung. Die Tailnet-Mitglieder mit Zugriff auf diesen Port können auch
Bugreports bereinigen. Fremde Browser-Origins und unbekannte Hosts werden
abgelehnt; der Server liefert ausschließlich die HTML-Oberfläche aus.

## Bedeutung der Zeitangaben

- **Registrierung:** serverseitig bekannte Kontoanlage. Alte Konten ohne
  Registrierungsdatum zeigen `unbekannt`; kein Rückschluss aus der ersten oder
  letzten Profiländerung.
- **App zuletzt genutzt:** vorhandenes `lastAppSeen` aus dem Auth-KV. Es wird
  durch authentifizierte App-Nutzung höchstens einmal pro UTC-Tag erfasst. Das
  Tool zeigt deshalb nur das Datum. Es ist weder die exakte letzte Anmeldung
  noch ein Live-Onlinestatus. Fehlende Werte bleiben `nicht erfasst`.
- **Cloud gespeichert:** bei Sync V2 `committedAt` aus dem aktuellen Head mit
  Revisionsnummer; bei noch nicht migrierten Profilen der ausdrücklich als
  Legacy markierte Zeitstempel. Ein Commit kann auch vom Tracker stammen und
  bestätigt keine aktive Browsersitzung.

Seit September 2026 liegen aktuelle Profiländerungen im V2 Durable Object.
`lastModified` im alten KV-Profil kann seitdem stehen bleiben. Die frühere
Anzeige las nur diesen alten Wert. Der Proxy fragt jetzt pro Nutzer
`GET /api/sync-v2/head?inlineMetadata=1` ab. Diese Leseoperation aktualisiert
keinen Login-/Aktivitätsstempel, schreibt keine Metadatenpakete und lädt kein
vollständiges Profil. Für diesen Zeitabgleich sind keine Änderungen am produktiven Worker nötig.

Ist der V2-Head nicht abrufbar, zeigt das Tool `nicht abrufbar`, statt den alten
KV-Wert als aktuellen Stand auszugeben. Die Nutzerliste meldet die Anzahl
fehlgeschlagener Metadatenabfragen und nicht lesbarer KV-Einträge.

## Rückmeldung und Bedienung

Während des Ladens werden Arbeitsschritt, geprüftes Profil, Zähler und Laufzeit
angezeigt. Unter „Ablauf anzeigen“ stehen die letzten Schritte. Die alte Liste
bleibt bis zum erfolgreichen Abschluss erhalten. Parallele Abfragen über
Smartphone und Mac werden mit einem verständlichen Hinweis abgelehnt.

Die Suche filtert Name und Pilot-ID; CSV exportiert die sichtbaren Nutzer als
Datei (auch über HTTP ohne Clipboard-API). Kleine Displays zeigen Nutzerkarten.
Die Bereinigung liefert eine lesbare Vorschau bzw. Löschbestätigung und optional
technische Details. Vorschauen löschen nichts. Der Löschknopf erfordert eine
Bestätigung. Nach einer unterbrochenen Löschung zuerst erneut die Vorschau
prüfen, weil bereits gelöschte Einträge nicht zurückgerollt werden.

## Endpunkte

Lokaler Proxy:

- `GET /api/admin/info` – verfügbare Tailscale-URLs
- `GET /api/admin/users?limit=1000` – kompakte Nutzerliste
- `POST /api/problem-reports/purge` – Bereinigung, standardmäßig `dryRun`

Mit `?stream=1` liefern Nutzerliste und Bereinigung NDJSON mit `progress`-,
`result`- und ggf. `error`-Nachrichten. Ohne Parameter bleibt das JSON-Format
erhalten. PINs, Pinnwand, Logbuch und Missionsinhalte werden nicht ausgegeben.

Unter „Verbindung / erweiterte Einstellungen“ sind weiterhin direkte
Worker-URLs mit `BUG_TRACKER_ADMIN_TOKEN` möglich. Dieser alternative Weg liefert
nur die vom dort deployten Worker bereitgestellten Metadaten; der lokale
V2-Zeitabgleich und Fortschrittsstream gelten für den Node-Proxy. Tokens werden
nur für die Browser-Sitzung gespeichert. Bestehende dauerhaft gespeicherte Tokens
werden beim Öffnen in die Sitzung übernommen und aus localStorage entfernt.

## Tests

```bash
node --test tools/user-admin/*.test.mjs
```

Die Tests prüfen V2-/Legacy-Zeitangaben, Ausfälle ohne falschen Legacy-Fallback,
Fortschrittsstream, Dry-Run, Host-/Origin-Schutz, PIN-Änderung mit Sicherung und
Konfliktprüfung, Statistik-Grenzen, Sortierung sowie unterdrückte sensible
Fehlermeldungen. Es werden keine echten Cloud-Daten benötigt oder verändert.

## Sortierung und Nutzungszähler

Die Liste kann nach Name, letzter erfasster App-Nutzung und Registrierung in
beiden Richtungen sortiert werden. Fehlende Datumsangaben stehen immer am Ende.
Die Suche und der CSV-Export verwenden die gewählte Sortierung.

Die Karten zeigen die Zahl aller gelesenen Nutzerkonten und die Konten mit einem
`lastAppSeen` innerhalb der letzten 24 Stunden bzw. sieben Tage. Die Zählung ist
unabhängig von Suchfilter und Listenlimit; auch außerhalb des Limits werden die
Konten für die Statistik gelesen. Bei Lesefehlern erscheinen Mindestwerte (`≥`)
und ein Hinweis. Konten ohne gültigen Nutzungszeitpunkt werden gesondert genannt.
Eine neue Cloud-Speicherung zählt nicht als App-Nutzung.

Da die App-Aktivität höchstens einmal pro UTC-Tag gespeichert wird, sind dies
Zähler anhand der erfassten Zeitpunkte. Sie können insbesondere am Rand eines
Zeitfensters aktive Nutzer unterschätzen. Es wird kein neuer Tracking-Heartbeat
und kein zusätzlicher Aktivitäts-Write eingeführt.

## PIN ändern

Im lokalen Proxy hat jeder Nutzer einen Knopf „PIN ändern“. Neue PIN zweimal
angeben und bestätigen, dass App und Tracker dieses Kontos geschlossen sind.
Die bestehende PIN wird niemals angezeigt. Die neue PIN darf 4–160 Zeichen haben.
Nach einer Änderung muss der Nutzer sie in App und Tracker eintragen.

`POST /api/admin/users/update` erwartet `{ id, pin, expectedVersion }`. Der
Versionswert wird beim Laden der Nutzerliste als HMAC mit einem nur für den
laufenden Server bekannten Schlüssel erzeugt. Ältere Listen werden bei
zwischenzeitlichen Änderungen abgelehnt. Er ist kein Hash, mit dem eine kurze
PIN offline erraten werden kann. Ein Serverneustart erfordert eine neue Liste.

Vor jedem Schreibzugriff wird der vollständige Originaldatensatz samt
Ablaufdatum unter `~/Library/Application Support/GA User Admin/backups/` mit
privaten Datei-/Ordnerrechten gesichert. Diese Dateien enthalten die alte PIN
und dürfen nicht geteilt werden. Der Browser erhält nur die Sicherungs-ID.
Wrangler erhält den neuen Datensatz über eine temporäre Datei mit Modus 0600;
PINs werden nicht in Prozessargumente oder Statusmeldungen geschrieben.

Die Änderung ersetzt nur das PIN-Feld des bestehenden Auth-KV-Datensatzes.
Pilot-ID, V2-Namensraum, Mission, Registrierung, Aktivitätszeit und KV-Ablaufdatum
bleiben erhalten. Unmittelbar vor dem Schreiben wird der Datensatz erneut
verglichen. Cloudflare KV bietet keinen atomaren Compare-and-Swap; deshalb
müssen die Clients für die Wartung geschlossen sein. Eine fehlgeschlagene
Schreibantwort ist kein sicherer Nachweis, dass nichts gespeichert wurde.
Dann erst aktualisieren und den Zustand prüfen. Bereits authentifizierte
Verbindungen werden durch diesen PIN-Wechsel nicht aktiv getrennt.

## Login-/Pilot-ID ändern

Pro Konto gibt es zusätzlich **Pilot-ID ändern**. Neue ID eingeben und
**Vorschau prüfen** wählen. Das prüft die Cloud-Unterstützung, den aktuellen
Kontostand und die Verfügbarkeit der neuen ID; es schreibt keine Kontodaten.
Die Vorschau ist fünf Minuten gültig und wird beim Ändern der Eingabe verworfen.

Neue IDs haben 3–40 ASCII-Buchstaben, Zahlen, Bindestriche oder Unterstriche und
werden großgeschrieben. Groß-/Kleinschreibung bildet keine unterschiedlichen
Konten. Bestehende sowie frühere, gesperrte IDs dürfen nicht überschrieben werden.
Nach Schließen und Synchronisieren der App und des Trackers dieses Kontos die
Bestätigung setzen und **Jetzt umbenennen** wählen. Anschließend auf allen
Geräten die neue Pilot-ID eintragen; die PIN bleibt gleich und kann bei Bedarf
über den gesonderten PIN-Dialog geändert werden.

Die interne Speicherkennung bleibt bestehen. Der Cloud-Worker muss
`GET /api/admin/capabilities` mit `accountRename: 1` bereitstellen; ohne diese
Fähigkeit verweigert das lokale Tool die Umbenennung. Es ersetzt keine
V2-Pakete und verändert weder Missionsinhalte noch deren Revision, Historie,
Registrierungsdatum oder die letzte erfasste Nutzung. Homebase, Audio,
Crew-Mitgliedschaften, Adminrollen und Community-Checklisten bleiben zugeordnet.

Der Ablauf reserviert zuerst die neue ID und sperrt für die kurze Umstellung
die Anmeldung, legt für die alten IDs permanente Sperrvermerke ohne PIN an und
gibt zuletzt die neue ID frei. Frühere IDs sind danach keine Login-Aliasse.
Sie werden auch nach Ablauf eines Kontos nicht für andere Benutzer freigegeben.
Bei weiteren Umbenennungen werden alle früheren Verweise auf die neue ID
aktualisiert. Das aktive Konto behält sein KV-Ablaufdatum; alte Sperrvermerke
haben kein Ablaufdatum. Ein Generationstoken verhindert, dass eine spätere
Neuregistrierung der zuletzt verwendeten ID fremde verknüpfte Inhalte erhält.

Vor dem ersten Schreiben wird eine private Sicherung aller betroffenen
Auth-Datensätze einschließlich früherer Sperrvermerke angelegt. Bei einem
Schreibfehler versucht das Tool, die Originaldaten wiederherzustellen. Dabei
überschreibt es keine erkannten fremden Änderungen. Falls die Wiederherstellung
nicht bestätigt werden kann, nennt die Fehlermeldung die Sicherungs-ID. Dann
keinen zweiten Umbenennungsversuch starten, sondern zuerst den Kontostand anhand
der lokalen Sicherung wiederherstellen. KV bietet keine atomare Transaktion
über mehrere Schlüssel; die Umbenennung ist eine Wartungsaktion bei geschlossenen
Clients. Bereits bestehende Relay-Verbindungen werden nicht aktiv getrennt.

`POST /api/admin/users/rename`:

- Vorschau: `{ id, newId, expectedVersion, dryRun: true }`
- Ausführung: `{ token, dryRun: false, confirmOffline: true }`

Tokens und vollständige Umbenennungspläne bleiben im Speicher des lokalen
Servers; ein Neustart verwirft offene Vorschauen. Die HTTP-Antwort liefert
keine PINs, Profilinhalte oder internen Sicherungsdateien.
