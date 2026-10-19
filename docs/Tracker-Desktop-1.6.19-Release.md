# Desktop 1.6.19 – Autostart: Sim-Ende, Reihenfolge, Ziehen

Basis: Desktop 1.6.18 (`origin/main`). Tracker-Runtime unverändert.

## Fehler in 1.6.18

„Beim Beenden schließen“ griff nur beim Beenden der Tracker-App. Das Ende des Sims
wurde nicht erkannt, gestartete Programme blieben offen. Sortieren per Ziehen ging
nur über das kleine Nummernfeld.

## Änderungen

- Nach dem Autostart prüft die App alle 15 s per `tasklist`, ob der Sim läuft. War er
  sichtbar und fehlt danach zweimal in Folge, werden nur die selbst gestarteten
  Programme geschlossen. Der Sim wird nie geschlossen. Erscheint er nicht innerhalb
  von 15 min, endet die Beobachtung ohne Aktion; fehlgeschlagene Abfragen zählen nicht.
- Option heißt „Mit dem Sim schließen“ und greift bei Sim-Ende und App-Ende.
- Neue Programme werden oben eingefügt; der Sim steht dadurch standardmäßig am Ende.
- Der ganze Listeneintrag ist ziehbar, Schalter/Felder/Pfeile bleiben bedienbar.
  Während des Ziehens wird die Liste nicht neu aufgebaut.

## Prüfung

- Desktop-Tests bestanden, inklusive Sim-Ende, kurzem Aussetzer, nie gestartetem Sim
  und Einfügereihenfolge.
- Offen: Windows-Feldtest mit echtem MSFS-Ende und Ziehen im Explorer-Fenster.
