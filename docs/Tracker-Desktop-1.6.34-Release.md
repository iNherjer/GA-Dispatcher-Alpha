# Desktop 1.6.34 – Vereinsflotte: Crew verlassen

Basis: Desktop 1.6.33. Tracker-Runtime unverändert.

## Änderungen

- Beim Verlassen der Crew (Profil ohne Crew oder 403 der Flotte) endet der Abgleich. Maschinen anderer Halter
  werden ein letztes Mal in `backup.txt` geschrieben: wieder eingeblendet und mit „· ex <Crew>“ im Namen.
  Hinweis im Modul mit der Liste der Maschinen.
- Behebt: Maschinen, die beim Austritt gerade ausgeblendet waren (von jemand anderem belegt), blieben unsichtbar.
- „Keine Crew“ wird wie der Crew-Name höchstens alle 6 h aus dem Profil gelesen; ein Knopfdruck prüft sofort.
- Der Abgleich merkt sich den Halter jeder Maschine (einmaliges vollständiges Laden nach dem Update).

## Prüfung

- 143 Desktop-Tests, neu: Austritt mit ausgeblendeter fremder Maschine, eigene bleibt unverändert, danach kein
  Crew-Verkehr.
