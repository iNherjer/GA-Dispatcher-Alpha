# Bilder der Willkommensseite

Frische Browseraufnahmen vom 22.10.2026 aus dem lokalen Projektstand
`76947189a` (enthält `origin/main` und drei zusätzliche lokale Commits).
Keine Bilder aus alten Analyseordnern und keine nachgebauten Produktansichten.

- `dispatch.png`: Hauptoberfläche im NavCom-Design, auf das Bedienpanel zugeschnitten.
- `kartentisch.png`: Vollbild-Kartentisch mit einer vorhandenen Direct-To-Beispielroute im Schwarzwald und Höhenprofil; keine Live-Simulatorverbindung.
- `tracker.png`: Original-Desktop-Oberfläche im Browser gerendert, ohne Electron-/Windows-Anbindung und ohne Simulator. Kein Nachweis einer aktiven Verbindung. Die Willkommensseite kennzeichnet diesen Zustand.
- `homebase.png`: Integrierter Homebase-Designer mit vorhandener lokaler Planung; kein Simulator verbunden.
- `pinnwand.png`: Private Pinnwand mit vorhandenen Einführungstipps, auf das Brett zugeschnitten. Kein Screenshot eines verbundenen Crew Boards.

Die Bilder werden von `../../willkommen.html` verwendet. Die HTML-Datei enthält
Stile und Bildvergrößerung direkt; es gibt keine Build- oder Bibliotheksabhängigkeiten.
Zum Veröffentlichen die HTML-Datei und diesen Bildordner gemeinsam übernehmen.
Die relativen App-, Hilfe- und Rechtslinks erwarten die vorhandene Projektstruktur.
Die Seite ist über die Navigation der Anleitung erreichbar und verlinkt oben auf das Onboarding. App-Links führen auf Origin / Alpha.

`../../exports/VFR-Multitool-Info.html` ist zusätzlich eine generierte Einzeldatei
mit denselben Inhalten und vollständig eingebetteten Screenshots. Sie lässt sich
ohne Bildordner weitergeben und offline öffnen. App- und Rechtslinks verweisen
auf die öffentliche Origin-/Alpha-App. Der Anleitungslink öffnet die daneben exportierte
`VFR-Multitool-Anleitung.html`, damit keine veraltete öffentliche Hilfe erscheint.
Sprungmarken und Bildvergrößerung funktionieren weiterhin innerhalb der Datei.
Nach Änderungen an `willkommen.html` oder den Bildern muss dieser Export neu
erzeugt werden: `python3 tools/export-info-pages.py` exportiert Willkommen,
Onboarding und Anleitung zusammen. Für die Querverweise zwischen diesen Seiten
den vollständigen Satz der drei HTML-Dateien weitergeben.
