# Tracker v414 Alpha

Cloud-Sync V2 mit weniger Schreibzugriffen: Zeitstempel direkt im Manifest,
kleine Teile gebuendelt hochladen und Paketzahl nur einmal je Buendel speichern.
Aufraeumen ohne Bestandsaenderung schreibt keinen neuen Zaehler.

Im reproduzierbaren synthetischen Vergleich: Missionsupdate 4 statt 6
Storage-Schluessel; Erstupload 13 statt 24. HTTP-Anfragen 4 statt 5 bzw. 4 statt
14. Diese Werte sind keine exakte Cloudflare-SQLite-Abrechnung.

Vollstaendige Daten, atomare Revisionen, Integritaetspruefungen und sichere
Wiederholungsversuche bleiben erhalten. Alte Tracker werden beim Lesen weiter
unterstuetzt; maximale Einsparung mit aktualisierter Web-App und Tracker v414.
Worker zuerst aktualisieren. Keine neue Freigabe von POI-Missionsfamilien.

Validiert: 21 Sync-Protokolltests, 270 Tracker-Missionstests einschliesslich
5 Cloud-Kandidatentests, kompletter Worker-Testlauf, lokaler Speicherschutz
sowie echter lokaler SQLite/workerd-Roundtrip, verzögerter Altclient-Download
und Konflikt zwischen Clients. Windows/MSFS-Flugtest steht aus.

Desktop 1.6.11, EFB-Package 0.4.14 und Stable-Kanal bleiben unveraendert.

Rollout: Origin c9da94d15 / Tag v414, Worker-Version
7d3b5879-bb6d-473a-b0b2-360515b23991, Web-SW v1787.
Oeffentlicher EXE-Download verifiziert: 57765259 Bytes, SHA-256
`f47b17a4b0eec9b7fd269c5213bc97e81d49d0160b77e7daff6448dce3423fa9`.
