# PPL-Theorie-Quiz auf der Pinnwand

Stand 28.10.2026

## Was es macht

- Schalter **🎓 Quiz** in der Pinnwand-Kopfzeile. Er zeigt einen großen Zettel auf dem **privaten** Brett an oder blendet ihn aus.
- Pro Kalendertag (Ortszeit) gibt es einen Zettel mit 5, 10 oder 15 Fragen. Sie werden einzeln angezeigt und lassen sich über die Nummernpunkte direkt anspringen.
- Nach jeder Antwort erscheinen sofort die Erklärung und ein Link zur Quelle.
- Sind alle Fragen beantwortet, kommt eine Auswertung mit dem Knopf **„N neue ziehen“**. Fragen, die heute schon beantwortet wurden, kommen dabei nicht noch einmal.
- Das **Zahnrad** öffnet die Einstellungen:
  - Anzahl der Fragen
  - Fächer
  - „Falsche am nächsten Tag erneut“
  - „Rechenaufgaben einmischen“
  - Statistik je Fach, zurücksetzbar
- Ist der aktuelle Zettel noch unberührt, gelten geänderte Einstellungen sofort. Sonst gelten sie ab dem nächsten Zettel.

## Auswahl der Tagesfragen (`pickBatch` in `ppl-quiz.js`)

1. Falsch beantwortete Fragen von früheren Tagen, wenn die Option an ist. Die ältesten kommen zuerst, und es kommen alle (bis zur Zettelgröße).
2. Fällige Wiederholungen, höchstens die Hälfte der restlichen Plätze. Abstände nach 1, 2, 3, 4, 5+ richtigen Antworten in Folge: 1, 3, 7, 14, 30 Tage. Das ist dasselbe Intervallmodell wie im Theorie-Trainer.
3. Ungesehene Fragen, zufällig gemischt.
4. Was sonst noch frei ist.

Rechenvarianten belegen höchstens 20 % eines Zettels. Sonst würden die zwölf Aufgabenfamilien mit je 20 Varianten die Zettel füllen. Die Antwortreihenfolge wird pro Frage und Tag gemischt und braucht keinen Speicher.

„Gefestigt“ in der Statistik heißt: dreimal in Folge richtig.

## Daten

- Katalog: `data/ppl-quiz-catalog.json`. Er wird erst geladen, wenn das Quiz eingeschaltet ist. Der Service Worker holt ihn zuerst aus dem Netz und fällt offline auf den Cache zurück (`NETWORK_FIRST_PATHS` in `sw.js`).
- Lernstand: `localStorage['ga_ppl_quiz_v1']`. Nur Fragen-IDs und Zahlen, kein Fragentext:

```json
{
  "v": 1, "on": true,
  "cfg": { "n": 10, "cats": null, "retry": true, "calc": true },
  "p": { "010-001": [3, 2, 1, 20389, 0] },
  "b": { "d": 20389, "ids": ["010-001"], "ans": { "010-001": "0" }, "cur": 0 },
  "pos": { "x": 50, "y": 4 }
}
```

- Felder:
  - `p[id]`: Versuche, davon richtig, richtige Antworten in Folge, letzter Tag, letzte Antwort falsch (0/1). Ein Eintrag ist etwa 25 Byte, bei 1000 Fragen also rund 25 KB.
  - `cats: null`: alle Fächer.
  - Tage: lokale Tagesnummer seit 1970.
- **Noch kein Cloud-Sync.** Für einen späteren Abgleich ist das Format schon passend: pro ID den Eintrag mit dem höheren Versuchszähler bzw. dem neueren Tag nehmen. Hochladen nur nach einem abgeschlossenen Zettel, nicht nach jeder Antwort.

## Neuen Katalog übernehmen

Das Austauschformat 1.x aus dem Theorie-Trainer (`PPL_A_Fragenkatalog_Edition_N.json`) wird umgewandelt:

```bash
node tools/ppl-quiz-build-catalog.mjs "/Pfad/PPL_A_Fragenkatalog_Edition_6.json"
```

- Das Skript bricht ab bei doppelten IDs, nicht genau einer richtigen Antwort, gleichen Antworttexten oder unbekannten Fächern bzw. Quellen.
- Fragen-IDs müssen über Editionen hinweg gleich bleiben, sonst verliert der Lernstand seine Zuordnung.
- Entfernte IDs werden im Lernstand einfach ignoriert.
- Danach wie bei jedem Push die `sw.js`-Cache-Version erhöhen.
