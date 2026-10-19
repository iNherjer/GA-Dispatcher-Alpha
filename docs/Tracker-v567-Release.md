# Tracker v567 Alpha – Favoriten-Flugplätze

Bis zu 10 Favoriten-Flugplätze für die Start- und Zielfelder der Webapp. In der
Autovervollständigung markiert ein Stern einen Platz, ohne ihn zu übernehmen.
Favoriten stehen oben in der Liste und erscheinen beim Fokus des Felds sofort,
ohne Vorauswahl: Enter behält den eingetragenen Platz. Beim Tippen werden
passende Favoriten auch dann eingemischt, wenn die Katalogsuche sie nicht liefert.

Karte (Webapp und EFB): kleiner Inline-SVG-Stern oben rechts neben dem Platz,
nicht interaktiv. Bei Maus in der Nähe, Tippen/Klick an dieser Stelle oder
offenem Popup weicht er zur Seite aus und wird blass. Schalter „⭐ Favoriten“ im
Anzeige-Menü; im EFB über die vorhandenen Tracker-Display-Einstellungen
gespeichert. SVG statt Textglyph, weil der Coherent-Font-Fallback ★ umfärbt.

Speicherung: lokal `ga_favorite_airports_v1`, Cloud über das persönliche
Profilfeld `favoriteAirports` (Sync v2, keine Worker-Änderung). Das EFB hat
keine Platzfelder und liest nur: neuer Tracker-Endpunkt
`GET /api/v1/favorite-airports` (Loopback, gedrosselt auf 30 s, Feld-Read
`field:favoriteAirports`, Legacy-Fallback, offline letzte bekannte Liste).
Ohne v567 bleibt das EFB ohne Sterne; die Webapp ist davon unabhängig.

Neue Dateien `map-favorite-airports.js` (gemeinsam, ES5) und
`ga-tracker-client/tracker-favorite-airports.js`; EFB-Asset ist in die
pkg-Asset-Liste aufgenommen, ein Test sichert Auslieferung und Paketierung.
Tracker-/EFB-Tests und Electron-Anzeigemenü-Selbsttest bestanden. Webapp lokal
im Browser geprüft (Stern, Limit, Fokusliste, Enter, Auswahl, Karte, Ausweichen,
Schalter); EFB-Kartentisch lokal mit Testdaten geprüft. Themes NavCom/OPS 1940/
Win95 sowie reale MSFS-/Coherent-/VR-Abnahme offen.

Windows-x64-EXE mit pkg/Node18 ohne Bytecode, PE-Architektur und enthaltene
Favoriten-/Versionsquellen geprüft. Assetrevision 56701, Web-Cache v2157.
