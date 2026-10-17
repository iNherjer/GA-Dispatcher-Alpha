# Tracker v559 Alpha – EFB-Controls und NAVCOM

## Änderungen

- Das Kartenmenü bleibt im EFB/Toolbar dauerhaft im selben DOM-Bereich.
  Öffnen/Schließen verändert keine Leaflet-Elternebenen. Größenbegrenzung
  berücksichtigt UI-Skalierung; Zentrieren bleibt vor dem Kompass und neben
  dem Drawer-Handle erreichbar. Filter-/Animationsabhängigkeiten entfernt.
- Der obere Menü-Handle liegt außerhalb des scrollbar begrenzten Headers.
  Er bleibt bei eingeklappter Toolbar und nach Wiederöffnen des EFB erreichbar.
- NAVCOM AUS / Gerät 1 aktiv / Auswahl synchronisiert über den eigenen
  `navcomMode`-Abschnitt im Cloud-Pilotenprofil zwischen Web-Geräten, EFB und
  Toolbar. Sichtbare Ansichten gleichen alle 15 Sekunden und beim Öffnen ab.
  Fehlgeschlagene Änderungen bleiben je Pilot zur Wiederholung gespeichert.
  Die Übernahme einer Präferenz sendet keine Radio-/Simulatorbefehle.
- Das CAS-Feldpatch lässt Mission/Seed, Kontrollmarker, Profilzeitstempel und
  fremde Abschnitte unverändert. Alte Vollprofil-Clients behalten den neuen
  Abschnitt bei; Legacy-Migration nutzt den bestehenden verlustfreien Vertrag.

## Prüfung

- 110 betroffene API-/Radio-/Asset-/Cloud-Regressionstests erfolgreich.
- Vorhandene Browserprüfung: 60 Popout-/Toolbar-Layoutfälle bestanden.
- Neue Browserprüfung: 27 Öffnen-/Schließen-/Zentrieren-Zyklen, 9 Host-/Skalierungs-
  kombinationen sowie Neustart mit eingeklappter Toolbar und Wiederöffnen
  über echten Pointerklick bestanden. Offenes Menü visuell geprüft.
- Zwei getrennte Web-Browserprofile gegen den lokalen produktiven Cloud-Worker:
  Modusübernahme, Offline-Outbox, Browserneustart und entfernte Aktualisierung
  erfolgreich; Mission, Seed, Profilfelder und Zeitstempel unverändert.
- Gepackter Node-18-ARM64-Smoke mit derselben Paketkonfiguration erfolgreich:
  `NAVCOM_PACKAGED_SMOKE_OK packaged=true`, einschließlich neuem Cloud-Modul
  und ausgeliefertem Coherent-Clientasset.
- Windows-x64-EXE mit pkg/Node18 und `--no-bytecode --public --public-packages '*'`
  gebaut, PE-Architektur geprüft. Kein Community-Paket-/Worker-Update nötig.

Der berichtete native Coherent-Paintverlust lässt sich im Browser nicht
beweisen oder ausschließen. Die verdächtigen DOM-/Ebenenwechsel sind entfernt;
der reale MSFS-/VR-Feldtest bleibt nach Installation erforderlich.

## Artefakt

Tracker v559, EFB-Assetrevision 55901, Web-Service-Worker v2137.
Windows-Artefakt: 174000073 Bytes, SHA-256
`8e3df2d1d234f62328f86d0f60def50bdaa9495c2cdbb1cf9c213730264d1526`.
Release v559 veröffentlicht; öffentlicher Download mit exakter Größe und SHA-256
verifiziert. Alpha-Kanal auf dieses Artefakt aktiviert; Stable unverändert.
