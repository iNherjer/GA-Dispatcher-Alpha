# Tracker v408 Alpha: POI-Missionen im Tracker

Standard-POI-Missionen nutzen jetzt die originale Task-, Lifecycle- und Voice-Logik über die gemeinsame Tracker-Authority. Pause/Resume, persistierte Sprachtexte, Cargo/PAX, Abschluss-Recovery und manuelle Status-/Orientierungsanfragen sind angeschlossen. Die lokale Komfort-Zuführung ist auch für APT korrigiert.

Der Release basiert auf Origin v407 und erhält dessen Banner-Rücknahme. App-Cache v1771, EFB-Assetrevision 40801. Kein neues Community-Paket erforderlich.

POI bleibt ein ausdrücklicher Alpha-Test: vorhandene APT-Tracker-Ausführung aktivieren und den Tracker/Desktop-Prozess mit `VFR_MULTITOOL_POI_EXECUTION=1` starten. Die normale Alpha-Kanalwahl allein aktiviert POI noch nicht. Spezialrezepte wie SAR, Training, Survey und Bush bleiben ausgeschlossen.

19.474 Vergleiche gegen eingefrorene Originalfunktionen bestanden. 294 gemeinsame Runtime-/EFB-Tests und 53 ergänzende EFB-/Club-/Routen-Regressionsprüfungen bestanden; Windows-PE und eingebettete Versions-/Funktionskennungen geprüft. Build auf macOS ohne Bytecode; noch kein Windows-/MSFS-Feldnachweis. Stable bleibt unverändert.

Veröffentlicht: Quellcommit `376bb852e`, Tag `v408`. Öffentlicher EXE-Download erneut geprüft und bytegleich mit dem Build: 57.731.671 Bytes, SHA-256 `ccac302514717d0981235c373ad27e512328b579494a7a6d143d8aff9af14d30`. Alpha-Zeiger v408, Kanalpush mit App-Cache v1772.
