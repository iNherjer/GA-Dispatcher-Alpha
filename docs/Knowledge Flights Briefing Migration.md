# Historiker und Lern-Guide: Wissensbriefing V1

## Rollen und Auswahl

`historian_guided_tour` erklärt die historische Bedeutung eines Ortes anhand belegter Fakten. Die Auswahl berücksichtigt explizite historische OSM-Markierungen innerhalb der vorhandenen POI-Daten. Städte bleiben mögliche Ziele mit belegtem historischen Blickwinkel.

`tour_guide_knowledge` (`poi_learning_guide`) ist ein Freund des Piloten, der einen interessanten Ort zeigen möchte. Historische und heutige Orte sind möglich. Benannte Bahnziele werden profilbezogen mit berücksichtigt; ihre pädagogische Quellenprüfung verwendet den Infrastruktur-Bucket. Die eigentliche POI-Kategorie wird dadurch nicht geändert.

Keine Beispielorte, Szenariolisten oder festen Themenquoten im Prompt. Eine profilgetrennte Historie der letzten zwölf Ideen unterstützt wechselnde Blickwinkel.

## Daten und Erzählung

Die erste Quellenanbindung verwendet die bestehende Wikipedia-Datenbeschaffung. Titelzuordnung, Quellenlink und Artikelkoordinate mit maximal einem Kilometer Abstand müssen zum ausgewählten Ziel passen. Bis zu acht Kernfakten und zwölf weitere Fakten stehen zur Verfügung. Dies ist keine Recherche über mehrere unabhängige Quellen; Betreiber- oder Museumsquellen sind noch nicht angebunden.

Idee und Writer referenzieren gültige Fakten-IDs. Reale Merkmale dürfen nur aus den Fakten stammen; Person und persönlicher Anlass sind fiktiv. Kartierte Nutzung belegt keine aktuellen Vorgänge. Fehlende Quellen werden nicht durch erfundene Ortsmerkmale ersetzt. Bei Picker-Kandidaten bleiben die übrigen belegten Optionen verfügbar.

Der Writer erzählt kompakt aus Erzählerperspektive mit zwei oder drei anschaulichen Details. Weitere Informationen bleiben für die Gespräche. Die ausgewählte Idee wird anschließend elaboriert, nicht neu ausgewürfelt. Die alte Profil-Normalisierung darf die neue Prosa nicht überschreiben. Wetter und Flugreferenzen nutzen die gemeinsamen Briefing-Verträge.

## Persistenz und Tracker

`knowledgeBriefing` enthält Idee, Fakten, Writer-Memory und Quellenkontext. Es bleibt in lokaler Kompaktspeicherung, Cloud-Kompaktierung und Mission-Contract erhalten. Der Voice-Basiskontext übergibt Blickwinkel und Fakten an die bestehenden Tracker-Prompts.

Keine neue Runtime-State-Machine: Faktenqueue, bereits gesprochene Inhalte, manuelle Wissensaktionen und Missionsabschluss verwenden weiterhin die bestehende Tracker-Authority. Lern-Guide-Beobachtungsparameter bleiben unverändert. Es wird keine zusätzliche Szene erzwungen.

## Prüfung

`tools/mission-knowledge-briefing.test.mjs` prüft Quellenidentität, Rollen, Faktenreferenzen, Historie, tatsächliche Profilanwendung, Kompaktspeicherung, ausgewählten Writer und teilweise fehlende Picker-Quellen.

`tools/mission-poi-narrative-voice.test.mjs` prüft beide neuen Blickwinkel im tatsächlichen Voice-Basiskontext und Tracker-Prompt. Die bestehenden Historiker-Seed-Tests sowie der reale Worker-Test „Learning Guide gate and manual fact reservation“ prüfen die vorhandene Übergabe und Interaktion.

Am 1. Oktober 2026 wurden je zwei Live-Gemini-Proben erstellt und nachgearbeitet; die letzte Runde enthält vier akzeptierte Ideen und Writer. Vollständige Texte und Grenzen stehen in `analysis/knowledge-live-20261001.md`. Kein MSFS-Flugtest oder Live-TTS-Test dieser neuen Briefings. Alpha-App v1892 enthält diese Migration; Tracker v459 verarbeitet den bereits serialisierten Voice-Kontext ohne neuen Build. Die verschiedenen bestehenden Ansagephasen dürfen neue Fakten und kurze zusammenhängende Geschichten erzählen.
