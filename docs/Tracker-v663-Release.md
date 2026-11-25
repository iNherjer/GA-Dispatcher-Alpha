# Tracker v663 Alpha – OpenAIP-Overlay und helle Wetterkarten im EFB

Der Tracker liefert EFB-Webassets mit Revision 66301. Der zugehörige Web-Cache ist v2542.

- „OpenAIP-Lufträume“ im EFB-Layermenü zeigt anpassbare Vektor-Lufträume,
  Flugplätze, Funknavigationshilfen und Meldepunkte. Linien, Randband,
  Flächenfüllung und Beschriftungen lassen sich mit denselben Einstellungen
  wie in der Webapp anpassen. Die Darstellung läuft ohne WebGL.
- Der automatische Wechsel zu den VFR-Kacheln greift standardmäßig bei Zoom
  12 bis 14. Ab Zoom 15 erscheint das OpenAIP-Overlay wieder. Die Zoomgrenzen
  sind einstellbar. Der Schalter für die manuelle VFR-Karte bleibt separat.
- Die Wetterkarten im Seitenmenü und im Karten-Popup haben im EFB einen hellen
  Hintergrund.

## Im Simulator prüfen

OpenAIP aktivieren, den Stil ändern und über die Umschaltgrenzen hinweg zoomen.
Danach die automatische Umschaltung ausschalten und die manuelle VFR-Karte
prüfen. Die Wetterkarten im Seitenmenü und im Karten-Popup in Coherent öffnen.

## Tests

- Tracker-Gesamtlauf mit 1634 bestandenen und zwei übersprungenen Tests.
  Ein Test zur Brandsuche scheiterte im Gesamtlauf und auf der unveränderten
  Origin-Basis an derselben Stelle. Die Einzelprüfung auf v663 bestand.
- Der EFB-Browsertest bestätigte OpenAIP-Darstellung, Stiloptionen, den
  VFR-Kachelwechsel und helle Wetterkarten mit Original- und Hostassets.
  Sechs Webtests zu App-Start und Cache bestanden.
