# Desktop 1.6.12 – Tracker-Update wieder ermöglichen

Die Runtime-Grenze des Desktop-Updaters war auf 160 MiB begrenzt. Tracker v445
hat 173264398 Bytes (165,2 MiB) und wurde deshalb bereits beim Lesen des
Alpha-Kanals abgewiesen. Mit vorhandener Runtime wurde jeder Kanalfehler als
„nicht erreichbar“ verschluckt und der Badge auf „Später“ gesetzt.

- Runtime-Downloadlimit auf weiterhin begrenzte 256 MiB erhöht.
- Kanal- und Netzwerkfehler zeigen die konkrete Ursache und den Status „Fehler“.
- Die letzte verifizierte Runtime bleibt bei Fehlern startbar.
- HTTPS, unveränderlicher GitHub-Releasepfad, Dateigröße und SHA-256 werden
  weiterhin geprüft.

Reparatur: Desktop vollständig beenden, Setup 1.6.12 über die vorhandene
Installation installieren, dann Alpha wählen und Tracker-Update erneut prüfen.
Die Engine v445 allein kann den im Desktop enthaltenen Updater nicht reparieren.

50 Desktop-Tests bestanden, einschließlich des realen Alpha-Manifests,
Übergrößenablehnung und Erhalt einer installierten v435 bei Fehlern.
Windows-Installations-/Starttest noch ausstehend. Deshalb zunächst manueller
Test-Installer; der allgemeine Desktop-Autoupdate-Kanal bleibt unverändert
(siehe docs/github-push-workflow.md Abschnitt 3a).
