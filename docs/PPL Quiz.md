# PPL-Theorie-Quiz auf der Pinnwand

Stand 29.10.2026

## Was es macht

- Schalter **🎓 Quiz** in der Pinnwand-Kopfzeile. Er zeigt einen großen Zettel auf dem **privaten** Brett an oder blendet ihn aus.
- Pro Kalendertag (Ortszeit) gibt es einen Zettel mit 5, 10 oder 15 Fragen, Standard 5. Sie werden einzeln angezeigt und lassen sich über die Nummernpunkte direkt anspringen.
- Nach jeder Antwort erscheinen sofort die Erklärung und ein Link zur Quelle.
- Sind alle Fragen beantwortet, kommt eine Auswertung mit dem Knopf **„N neue ziehen“**. Fragen, die heute schon beantwortet wurden, kommen dabei nicht noch einmal.
- **↻** neben dem Zahnrad bricht den laufenden Zettel ab und zieht neue Fragen. Vorher kommt immer eine Rückfrage; schon gegebene Antworten bleiben in der Statistik.
- **Tägliche Aufgaben** (Standard: an): Jeden Tag gibt es automatisch einen neuen Zettel, und der Quiz-Zettel hängt dann wieder an der privaten Pinnwand, auch wenn er am Vortag geschlossen wurde. Das gilt nur für alle, die das Quiz schon einmal eingeschaltet haben.
- Der Tageswechsel ist um Mitternacht Ortszeit. Die neuen Fragen werden gezogen, sobald das private Brett mit dem Quiz angezeigt wird.
- Solange das private Brett heute noch nicht geöffnet wurde, zeigen der Knopf **📋 Pinnwand** das rote „!“ und der Knopf **🎓 Quiz** einen roten Punkt. Das gilt nur bei eingeschalteten täglichen Aufgaben und nur für alle, die das Quiz schon benutzt haben. Den Crew-Reiter markiert das Quiz nicht.
- Läuft die App über Mitternacht, prüft das Quiz den Tag bei Rückkehr in die App (Fokus, Sichtbarkeit) und einmal pro Minute. Bei offener Pinnwand kommt dann sofort der neue Zettel, sonst erscheint das Abzeichen.
- Ohne tägliche Aufgaben bleibt der Zettel zu, bis man ihn über **🎓 Quiz** öffnet. Der laufende Zettel läuft dann über Tage weiter; neue Fragen gibt es mit ↻ oder nach der Auswertung.
- Das **Zahnrad** öffnet die Einstellungen:
  - Anzahl der Fragen
  - „Tägliche Aufgaben“
  - Fächer
  - „Falsche am nächsten Tag erneut“
  - „Rechenaufgaben einmischen“
  - Statistik je Fach, zurücksetzbar
- Ist der aktuelle Zettel noch unberührt, gelten geänderte Einstellungen sofort. Sonst gelten sie ab dem nächsten Zettel.

## Auswahl der Tagesfragen (`pickBatch` in `ppl-quiz.js`)

1. Falsch beantwortete Fragen von früheren Tagen, wenn die Option an ist. Die ältesten kommen zuerst, und es kommen alle (bis zur Zettelgröße).
2. Fällige Wiederholungen, höchstens die Hälfte der restlichen Plätze. Abstände nach 1, 2, 3, 4, 5+ richtigen Antworten in Folge: 5, 10, 20, 40, 60 Tage. Seit 30.10.2026 beginnt die Folge bei 5 statt 1 Tag (vorher 1, 3, 7, 14, 30 wie im Theorie-Trainer), damit eine gerade richtig beantwortete Frage nicht schon am nächsten Tag neue Fragen verdrängt. Falsche Antworten kommen unabhängig davon am nächsten Tag.
3. Ungesehene Fragen, zufällig gemischt.
4. Was sonst noch frei ist.

Rechenvarianten belegen höchstens 20 % eines Zettels. Sonst würden die zwölf Aufgabenfamilien mit je 20 Varianten die Zettel füllen. Die Antwortreihenfolge wird pro Frage und Tag gemischt und braucht keinen Speicher.

„Gefestigt“ in der Statistik heißt: dreimal in Folge richtig.

## Daten

- Katalog: `data/ppl-quiz-catalog.json`, geladen als `?v=<CATALOG_VERSION>` (Konstante in `ppl-quiz.js`, vom Umwandlungsskript gesetzt). Der Service Worker legt Katalog und Bilder in einen eigenen Cache `ga-ppl-quiz-v1`, der Releases übersteht: Heruntergeladen wird nur einmal pro Katalogversion, ältere Versionen werden dabei entfernt.
- Für Nutzer mit eingeschaltetem Quiz oder fälligem Tageszettel lädt die App den Katalog etwa 3 s nach dem Start im Hintergrund vor. Wer das Quiz nie benutzt hat, lädt ihn nicht.
- Lernstand: `localStorage['ga_ppl_quiz_v1']`. Nur Fragen-IDs und Zahlen, kein Fragentext:

```json
{
  "v": 1, "on": true,
  "cfg": { "n": 5, "cats": null, "retry": true, "calc": true, "daily": true },
  "p": { "010-001": [3, 2, 1, 20389, 0] },
  "b": { "d": 20389, "ids": ["010-001"], "ans": { "010-001": "0" }, "cur": 0 },
  "pos": { "x": 50, "y": 4 },
  "seen": 20389
}
```

- Felder:
  - `p[id]`: Versuche, davon richtig, richtige Antworten in Folge, letzter Tag, letzte Antwort falsch (0/1). Ein Eintrag ist etwa 25 Byte, bei 1000 Fragen also rund 25 KB.
  - `cats: null`: alle Fächer.
  - `seen`: Tag, an dem das private Brett mit dem Quiz zuletzt angezeigt wurde. Steuert das Abzeichen.
  - Tage: lokale Tagesnummer seit 1970.
- **Noch kein Cloud-Sync.** Für einen späteren Abgleich ist das Format schon passend: pro ID den Eintrag mit dem höheren Versuchszähler bzw. dem neueren Tag nehmen. Hochladen nur nach einem abgeschlossenen Zettel, nicht nach jeder Antwort.

## BZF-Fragen

- Seit Edition 15 enthält der Katalog zusätzlich die 261 amtlichen Kenntnisfragen BZF I/II der Bundesnetzagentur (gültig ab 01.05.2024) als eigenes Fach „BZF I/II (amtlich)“. Es lässt sich im Zahnrad wie die PPL-Fächer an- und abwählen.
- Wortlaut, Originalnummern und Schlüssel sind unverändert; die Übertragung wurde gegen das Original-PDF geprüft. Im amtlichen Katalog ist die richtige Antwort immer A. Das Quiz mischt die Antworten wie bei allen Fragen.
- Lizenz CC BY-ND 4.0: Der Zuschreibungsvermerk mit Link zu Original und Lizenz steht unter jeder beantworteten BZF-Frage und unten in den Einstellungen (`notices` im Katalog). Er darf nicht entfernt werden.
- Die Erklärungstexte des Moduls verweisen nur auf „Antwort A“ und werden deshalb nicht übernommen; bei falscher Antwort zeigt das Quiz die richtige Antwort.
- Die zwei Kartensymbole (Fragen 117 und 118) liegen in `data/ppl-quiz-media/`.

## Bildfragen

- Edition 16 bringt 54 Bildfragen (je sechs pro PPL-Fach, IDs `0x0-085` bis `0x0-091`) als Ergänzungspaket ohne eigenes Fach. Sie landen in ihren normalen Fächern.
- Zwölf Bilder wurden am 29.10.2026 neu gezeichnet, weil die gelieferten Fassungen fehlerhaft oder schwach waren (Prüfnotizen in `analysis/ppl-quiz-katalog-pruefung-2026-10-28.md`). Bei 020-086 zeigt das Bild seitdem einen klassischen Horizont mit fester Skala und Himmelszeiger; die Erklärtexte wurden angepasst.
- Bilder ab 800 px Breite gelten als Diagramm: Sie füllen die Notizbreite und öffnen sich beim Antippen bildschirmfüllend (Tippen oder Escape schließt). Kleine Symbole wie bei BZF bleiben klein im Text.
- Bildpfade tragen `?v=<Prüfsumme>`. Ändert sich ein Bild, lädt der Service Worker es einmal neu; sonst kommt es aus dem Quiz-Cache.

## Neuen Katalog übernehmen

Das Austauschformat 1.x aus dem Theorie-Trainer (`PPL_A_Fragenkatalog_Edition_N.json`) wird umgewandelt:

```bash
node tools/ppl-quiz-build-catalog.mjs "/Pfad/PPL_A_Fragenkatalog_Edition_15.json" "/Pfad/PPL_A_BZF_Fragenkatalog_Edition_13.json" "/Pfad/PPL_A_Neue_Bildfragen_Edition_16_neu.json"
```

- Weitere Dateien nach dem PPL-Katalog sind Zusatzmodule (`type: question_batch`). Mit eigenem `category` (BZF) werden sie ein eigenes Fach, ohne `category` (Bildfragen) ergänzen sie die vorhandenen Fächer, und die höchste Editionsnummer gilt für den Katalog. Ziel abweichend mit `--out=pfad.json`.
- Das Skript bricht ab bei doppelten IDs, nicht genau einer richtigen Antwort, gleichen Antworttexten oder unbekannten Fächern bzw. Quellen.
- Fragen-IDs müssen über Editionen hinweg gleich bleiben, sonst verliert der Lernstand seine Zuordnung.
- Entfernte IDs werden im Lernstand einfach ignoriert.
- Das Skript trägt die neue `CATALOG_VERSION` in `ppl-quiz.js` ein. Danach wie bei jedem Push die `sw.js`-Cache-Version und die Versionskennung von `ppl-quiz.js` in `index.html` erhöhen.
