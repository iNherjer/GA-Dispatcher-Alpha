# Tracker Desktop Update Channel

Dieser Ordner ist der kleine, veraenderliche Stable-Zeiger fuer die installierte
Tracker-Desktop-App. Die eigentlichen Installer und Blockmaps liegen als
unveraenderliche GitHub-Release-Artefakte.

Bei einem Release wird die von `electron-builder` erzeugte `latest.yml` so
veroeffentlicht, dass alle darin genannten Dateien auf den exakten
`tracker-desktop-v<version>`-Release zeigen. Erst wenn Installer, Blockmap,
Pruefsummen und Starttest erfolgreich geprueft wurden, darf `latest.yml` hier
aktualisiert werden.

Solange noch kein Desktop-Release veroeffentlicht wurde, bleibt dieser Ordner
bewusst ohne `latest.yml`. Testbuilds aus OneDrive aktualisieren deshalb nur die
separat geladene Tracker-Runtime; der Bootstrapper selbst wird noch nicht
automatisch aktualisiert.
