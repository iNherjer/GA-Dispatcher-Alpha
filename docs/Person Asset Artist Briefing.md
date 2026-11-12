# Briefing für den 3D-Artist – Personen-Figuren

VFR Multitool · Stand 12.11.2026

Die Figuren laufen im Flugsimulator (MSFS 2024) an Flugplätzen herum: als
Fluggäste, Bodenpersonal, Zuschauer oder Mitarbeiter in der eigenen Homebase.
Die App sucht sich je nach Auftrag passende Figuren aus. Damit das klappt,
braucht jede Figur zusätzlich zum Modell einen kurzen **Steckbrief**, der
beschreibt, wie sie aussieht.

Technische Details zu Rig, Animation und Export stehen im bisherigen Briefing
für animierte Figuren. Hier geht es um zwei Dinge: was wir vom Modell brauchen,
damit es gut läuft, und wie der Steckbrief aussieht.

## 1. Das Modell in Kürze

- **Zwei Animationen sind Pflicht:** Stehen (Idle) und Gehen. Im Stand stehen
  beide Füße parallel auf dem Boden, beim Anhalten setzt die Figur sauber ab.
- **Natürlicher Gang:** etwa 1,5 bis 3 Knoten (rund 0,8 bis 1,5 m/s). Schneller
  muss sie nicht gehen.
- **Echte Größe**, Ursprung am Boden zwischen den Füßen, Blick nach vorn.
- **Requisiten fest am Modell** (Rucksack, Kamera, Headset …) gehören zur Figur.
  Koffer, Kisten und andere Gepäckstücke stellt die App separat neben die Figur –
  bitte nicht ins Modell bauen.
- **Schlank bleiben:** Es stehen oft drei bis sechs Figuren gleichzeitig herum,
  auch auf schwächeren PCs. Wenn möglich, vereinfachte Fassungen für größere
  Entfernung (LODs) mitliefern.
- **Pro Look ideal: eine Frau und ein Mann.** Farbvarianten derselben Figur
  (andere Jacke, andere Hose) sind willkommen und zählen als eigene Figur.

## 2. Der Steckbrief

Für jede Figur bitte diese sechs Angaben. Bei den ersten fünf bitte **nur Werte
aus den Listen** verwenden – sie sind mit der App abgestimmt. Wenn etwas nicht
passt, sprich uns an, statt einen eigenen Wert zu erfinden.

### Look – genau einer

| Wert | Bedeutung |
|---|---|
| `casual` | Freizeitkleidung, entspannt |
| `outdoor` | Funktionskleidung für draußen |
| `workwear` | Arbeitskleidung, Warnweste oder Overall |
| `business` | gepflegt bis elegant: Anzug, Kostüm oder Kleid |
| `aviation` | fliegerisch: Polo oder Hemd mit Headset |
| `uniform` | Einsatzkleidung von Rettung oder Feuerwehr |

### Alter – genau eins

`child` (Kind) · `young_adult` (bis etwa 30) · `adult` (etwa 30 bis 60) · `senior` (ab etwa 60)

### Jahreszeit – genau eine

`summer` (kurze Ärmel, leicht) · `winter` (dicke Jacke, Mütze oder Schal) · `all` (passt immer)

### Feste Requisiten – keine, eine oder mehrere

`backpack_large` großer Trekkingrucksack · `backpack_small` Tagesrucksack ·
`camera` Kamera · `binoculars` Fernglas · `headset` Headset ·
`clipboard` Klemmbrett · `tablet` Tablet · `helmet` Helm ·
`hi_vis_vest` Warnweste · `radio` Funkgerät · `medical_bag` Notfalltasche ·
`briefcase` Aktentasche · `hat` Hut oder Kappe

### Einsatz – mindestens einer

`passenger` fliegt als Fluggast mit · `pickup` wartet am Zielplatz auf Abholung ·
`ground_crew` Bodenpersonal am Flugplatz · `bystander` Zuschauer oder Passant ·
`homebase` Mitarbeiter in der Homebase

### Beschreibung – ein Satz, höchstens 200 Zeichen

Beschreibe nur, **was man sieht**: Person, Kleidung, Farben, Requisiten.
Die App entscheidet selbst, wofür sie die Figur einsetzt – zum Beispiel wird aus
„feiner Kleidung“ zusammen mit einem Kamerakoffer ein Hochzeitsfotograf. Deshalb
gehört kein Einsatzzweck in den Satz.

| Gut | Nicht so |
|---|---|
| Junge Frau in Wanderhose und Funktionsjacke mit großem Trekkingrucksack | Wanderin, ideal für Bush-Missionen |
| Mann um die 50 in dunklem Anzug mit offenem Hemdkragen | Geschäftsmann für Charterflüge |
| Ältere Frau in heller Sommerbluse und Strohhut, Kamera um den Hals | Touristin, perfekt für Rundflüge |
| Mann in orangefarbener Warnweste über blauem Arbeitshemd, Helm und Klemmbrett | Inspektor, der Brücken prüft |

## 3. Vorlage zum Ausfüllen

| | |
|---|---|
| Arbeitsname der Figur | |
| Frau / Mann | |
| Look | |
| Alter | |
| Jahreszeit | |
| Feste Requisiten | |
| Einsatz | |
| Beschreibung (ein Satz) | |
| Gemessene Größe (m) | |
| Ausprobiertes Gehtempo (von – bis) | |
| Animationen und ihre Namen | |
| Bekannte Schwächen | |

Beispiel – die Wanderin:

| | |
|---|---|
| Arbeitsname | Wanderin |
| Frau / Mann | Frau |
| Look | `outdoor` |
| Alter | `young_adult` |
| Jahreszeit | `all` |
| Feste Requisiten | `backpack_large` |
| Einsatz | `passenger`, `pickup`, `bystander`, `homebase` |
| Beschreibung | Junge Frau in Wanderhose und Funktionsjacke mit großem Trekkingrucksack |
| Größe | 1,78 m |
| Gehtempo | 1,5 – 2,8 kn sauber, höchstens 3 kn |
| Animationen | standing_relax, locomotion |
| Schwächen | minimales Gleiten beim Antritt |

## 4. Welche Figuren wir uns wünschen

Die abgestimmte Liste mit Prioritäten steht in der Personenliste vom 10.11.2026
(PDF). Für jeden Look je eine Frau und einen Mann – mit Prio 1 zuerst:
Wanderer, Techniker/Inspektor, Fluglehrer/Pilot, Geschäftsfrau/-mann.

Den ausgefüllten Steckbrief bitte zusammen mit dem Modell an den SDK-Kollegen
geben. Er prüft ihn am fertigen Modell und trägt ihn in den Katalog ein.
