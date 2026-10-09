# Gemeinsamer Schalter für Tracker-Missionsautorität

## Stable-Freigabe vom 09.10.2026

Auf ausdrücklichen Nutzerwunsch wird der geprüfte Origin-Stand vom 09.10.2026
(65394ba0ec0dab6be614244ed0eb4af1549d9a7e, Tracker v506) mit den gezielten
Release-Änderungen als Stable veröffentlicht. Tracker v507 führt die bereits
freigegebenen Rezepte in Stable und Alpha standardmäßig aus. Rezeptvalidierung,
Paritätsbereitschaft, Capability-Handshake und atomarer Authority-Commit bleiben
Voraussetzungen. Die frühere Alpha-/Opt-in-Beschränkung ist aufgehoben.

Desktop 1.6.13 ersetzt den bisherigen Opt-in durch
**Tracker-Missionslogik deaktivieren (nur Debug)**. Ein gesetzter Haken deaktiviert
die Logik erst nach einer Warnung; ein dauerhaft sichtbarer Hinweis fordert die
Rückkehr zum normalen Betrieb. Änderungen starten eine laufende Runtime neu;
nicht während einer laufenden Mission umschalten. Es gibt keinen automatischen
Authority-Wechsel eines begonnenen Runs.

Die alte Einstellung `aptMissionExecutionEnabled=false` wird beim Upgrade nicht
als bewusste Debug-Entscheidung übernommen. Erst die neue gespeicherte Einstellung
`missionExecutionDebugDisabled=true` schaltet aus. Die neue Prozessvariable
`VFR_MULTITOOL_MISSION_EXECUTION_DEBUG_DISABLED=1` ist der explizite Debug-Opt-out.
Ein altes `VFR_MULTITOOL_APT_EXECUTION=0` aus älteren Desktop-Versionen blockiert
den neuen Stable-Standard nicht mehr. Der IPC-Name bleibt kompatibel.

Die Routen-Capability `navigation.route.v1` steht ebenfalls in Stable bereit.
Nicht freigegebene Rezepte bleiben im bisherigen App-Pfad. Debug aus erzeugt
keine schreibenden Tracker-Missions-Capabilities.


Stand 15.09.2026, Tracker v409 / Desktop 1.6.11.

In der Tracker-Desktop-App unter **Einstellungen → Runtime & Datenkanal** zuerst
**Alpha**, dann **Experimentelle Tracker-Missionssteuerung** aktivieren.
Der vorhandene Schalter steuert jetzt APT und Standard-POI gemeinsam.
Eine zusätzliche Umgebungsvariable für POI ist nicht mehr erforderlich.

Ältere Desktop-Versionen zeigen noch „Experimentelle APT-Tracker-Steuerung“.
Mit Tracker v409 hat dieser bestehende Schalter bereits dieselbe gemeinsame
Wirkung. Der gespeicherte Wert bleibt erhalten. Eine Änderung startet eine
laufende Engine wie bisher kontrolliert neu; Missionen deshalb vor dem Start
übergeben, kein Wechsel der Autorität mitten im Flug.

## Vertrag für weitere Missionsfamilien

Der Schalter erlaubt Tracker-Ausführung; er allein gibt kein beliebiges Rezept
frei. Aktuell bleiben Standard-APT und die sechs migrierten POI-Domains erlaubt.
SAR, Training, Survey, Ketten und Bush benötigen weiterhin eigene vollständige
Rezept-, Runtime-, Effekt- und Capability-Freigaben. Stable und ein ausgeschalteter
Schalter bleiben bei der bisherigen App-Ausführung.

Interner Einstellungs-/IPC-Schlüssel `aptMissionExecutionEnabled` und
Prozessvariable `VFR_MULTITOOL_APT_EXECUTION` bleiben kompatibel zu installierten
Desktop-Versionen. `VFR_MULTITOOL_POI_EXECUTION` wird ab v409 nicht mehr ausgewertet;
auch ein alter Wert `0` blockiert den universellen Schalter nicht.

## Prüfung und Auslieferung

82 Runtime-/Gate-/Authority-/POI-Tests und 48 Desktop-Tests bestanden.
Die Gate-Matrix prüft Alpha/Stable, Schalter an/aus und alte POI-Variablenwerte.
Gespeicherte Einstellungen, Neustart und erzwungenes Ausschalten im Stable-Kanal
verwenden den unveränderten Desktop-Pfad. Windows-/MSFS-Feldprüfung bleibt separat.

Der Desktop-Build verwendet das von Electron-Builder 26.15.3 unterstützte
NSIS-Toolset 1.2.1 (NSIS 3.12), da dessen alter x64-macOS-Helfer hier nicht startet.
Der Installer wird separat bereitgestellt; der globale Desktop-Autoupdater
wird ohne Windows-Installations-/Start-/Update-Test nicht umgestellt.
Für die Funktion genügt das Alpha-Runtime-Update auf v409 in der bestehenden App.

Runtime-Release `v409`, Quellcommit `138b3f6ec`. Öffentlicher EXE-Download
ist geprüft: 57.731.697 Bytes, SHA-256
`5c2e47b17273e161f97c736ec5552bf3f0762b87a9b86dd23c26b1222813674e`.
Alpha-Zeiger v409, Kanalpush mit App-Cache v1774. Desktop 1.6.11 wird als
separater Installer angeboten; Paketquellen und Updater-Abhängigkeiten geprüft.
