# Mission Narrative Quality Guide

Diese Datei beschreibt die Kriterien, mit denen wir Missionsfamilien erzählerisch verbessern, ohne die bestehende Missionsarchitektur zu verbiegen. Sie ergänzt `Mission Building Instructions.md` und `Mission Semantics Rules V4.md`.

Ziel ist nicht nur "schöner Text", sondern ein stabiler Missionsbau:

- klare Rollen
- glaubwürdiger Anlass
- konsistenter Ablauf
- passendes Briefing
- passende Voice-Cues
- keine Instruction-Leaks
- keine nachträglichen Verbotslisten als Hauptlösung

## 0. Qualitätsstandard einer guten Mission

Eine gute Mission fühlt sich an wie ein kurzer Dispatcher-Zettel für einen echten GA-Flug. Sie ist nicht nur ein Zielpunkt mit Fülltext, sondern ein kleiner plausibler Anlass, bei dem der Flug eine erkennbare Rolle spielt.

Qualität entsteht, wenn diese Elemente zusammenpassen:

- `Wer`: Pilot, Mitflieger, Auftraggeber, Kontakt, Fracht oder Zielobjekt sind konkret.
- `Warum`: Der Anlass ist greifbar, nicht nur "es geht irgendwohin".
- `Warum per Flugzeug`: Der Flug spart Zeit, nutzt Wetterfenster, verbindet Orte, schafft Aussicht oder macht die private Unternehmung überhaupt besonders.
- `Wohin`: Zielplatz, POI, Strip oder Route bleiben der Mittelpunkt der Mission.
- `Was dort passiert`: Nach Landung, Überflug, Pickup, Übergabe oder Rückkehr gibt es einen klaren nächsten Schritt.
- `Wie es sich anfühlt`: Ton, Rolle, Wetter, Strecke und Ziel passen zur Missionsfamilie.

Eine Mission ist schwach, wenn sie zwar formal richtig ist, aber austauschbar klingt. Eine Mission ist stark, wenn man nach dem Briefing sofort weiß: "Ah, deshalb fliegen wir heute genau diesen Trip."

### 0.1 Story-Spine in einem Satz

Jede Mission sollte intern auf einen Satz reduzierbar sein:

`Heute fliegt der Pilot mit/wegen X von A nach B, weil dort Y wartet; Route, Wetter oder Zielkontext geben dem Flug Farbe, und nach dem Flug passiert Z.`

Dieser Satz muss nicht sichtbar im Briefing stehen. Er ist der Kompass für Planner, Writer, Fallbacks, Voice und Debug.

Beispiele:

- Privater Ausflug: "Du fliegst mit Clara nach Zürich, weil sie bei 36 Grad endlich an den See will; die Strecke ist kurz genug für einen entspannten Fly-out, und nach der Landung geht es direkt zur Abkühlung."
- APT-Sightseeing: "Ein Gast möchte Donaueschingen wirklich besuchen, weil Quelle, Altstadt oder Museum den Ort interessant machen; der Flug bringt euch zum Zielplatz, danach startet der Besuch am Boden."
- POI-Sightseeing: "Die Gäste wollen ein bestimmtes Schloss, Tal oder Gewässer aus der Luft sehen; der Überflug ist der Kern, danach geht es zurück mit Fotos und Eindrücken."
- Bush-Pickup: "Eine Person oder Fracht wartet nach einem konkreten Aufenthalt am Strip; der Pilot holt sie jetzt ab, weil der nächste Schritt erst mit dem Rückflug möglich ist."

### 0.2 Pflicht, Wunsch und Sicherheitsnetz

Nicht alle Informationen sind gleich hart.

Pflicht im Briefing:

- Missionsfamilie und Aufgabe müssen erkennbar bleiben.
- Hauptperson, Fracht oder Zielobjekt darf nicht verschwinden.
- Anlass und Ziel müssen natürlich verbunden sein.
- Ablauf und Abschluss dürfen sich nicht widersprechen.
- Sichtbarer Text darf keine System-, Prompt- oder Debug-Sprache enthalten.

Gewünscht, wenn verfügbar:

- Route oder Richtung.
- Entfernung oder grobe Flugzeit.
- Wetter als kurzer Realitätsanker.
- Zielplatz- oder POI-Besonderheit.
- lokale Attraktion, Kontakt, Übergabepunkt oder privater Plan.

Diese Wunschinformationen dürfen ein Briefing besser machen, aber nicht zerbrechen. Wenn Entfernung, Wetter oder Wiki-Zielwissen fehlen, schreibt der Writer trotzdem einen runden Text und lässt die fehlende Zutat weg.

Das Sicherheitsnetz darf harte Fehler korrigieren:

- falsche Missionsfamilie
- operative Umdeutung
- Rohdaten-/Prompt-Leak
- falsche Person oder Fracht
- fragmentierter oder englischer Text

Das Sicherheitsnetz soll aber nicht den normalen Stil erzwingen. Der gute Text soll aus der positiven Aufgabe entstehen, nicht aus einer langen Verbotsliste.

### 0.3 Schreibweise

Das sichtbare Briefing ist ein kurzer freier Text. Es soll wie ein handgeschriebener Dispatch-Zettel klingen, nicht wie ein ausgefülltes Datenformular.

Regeln:

- 3 bis 5 gute Sätze reichen fast immer.
- Ein durchgehender Erzählfluss ist wichtiger als Vollständigkeit um jeden Preis.
- Fakten werden eingebaut, nicht aufgezählt.
- Route, Wetter und Entfernung werden als Nebensatz oder kurzer eigener Satz eingefügt.
- Der Text darf freundlich, lebendig und gelegentlich charmant sein.
- Der Text bleibt zur Mission passend: privat warm, Sightseeing interessiert, Einsatz sachlich, Cargo zweckmäßig.

Nicht erwünscht:

- Perspektivwechsel zwischen Dispatcher, Pilot, Passagier und System.
- Satzblöcke, die wie zusammengeklebte Fragmente wirken.
- Wiederkehrende Standardsätze, die in fast jeder Mission gleich aussehen.
- "Nach dem Flug beginnt die Aktivität", ohne zu sagen, welche Aktivität.
- Meta-Sprache wie "die TaskDomain", "der Kontext", "die Mission gilt als".

### 0.4 Fakten und Erfindung

Der Writer darf Farbe hinzufügen, aber er muss zwischen weichen Motiven und harten Fakten unterscheiden.

Erlaubte weiche Farbe:

- ein gutes Café am Platz
- der beste Burger der Gegend
- ein Badeplan am See
- ein Museumsbesuch
- ein Stadtbummel
- Picknick, Fotos, kleine Wanderung oder Familienbesuch

Diese Dinge sind private oder erzählerische Motive. Sie dürfen erfunden werden, wenn sie plausibel sind und nicht als überprüfbarer Fakt über einen realen Ort verkauft werden.

Harte Fakten brauchen Datenbasis:

- historische Behauptungen
- konkrete Öffnungszeiten
- echte Sehenswürdigkeiten mit Namen
- medizinische, rechtliche oder sicherheitsrelevante Aussagen
- konkrete Runway-, AIP-, METAR- oder Terrain-Details

Wenn harte Fakten fehlen, bleibt der Text allgemeiner. Wenn weiche Farbe fehlt, darf der Writer kreativ werden.

### 0.5 Story-Träger, Material und Weight-and-Balance

Nicht jedes mitgeführte Ding ist automatisch Teil der Geschichte. Viele Items sind für Weight-and-Balance, Manifest oder UI wichtig, aber im Briefing nur Ballast, wenn sie keinen erzählerischen Zweck erfüllen.

Vor dem Schreiben braucht jede Mission eine klare Hierarchie:

1. `Story-Träger`: die Person, Gruppe, Fracht, Aufgabe, Zielszene oder Beobachtung, wegen der dieser Flug stattfindet.
2. `Story-Material`: Dinge, die diesen Anlass wirklich greifbarer machen.
3. `Logistik/W&B`: Gepäck, Taschen, Jacken, Standardausrüstung oder Gewichte, die technisch stimmen müssen, aber im sichtbaren Text oft verschwinden dürfen.

Der Story-Träger bleibt der Mittelpunkt. Material darf ihn konkretisieren, aber nicht ungefragt ersetzen.

Beispiele:

- Charter: Ein Fluggast mit Termin ist die Story. Handgepäck ist meistens nur W&B; ein Architekturmodell, Messkoffer, Kleidersack oder Vertragsordner kann dagegen Teil des Anlasses sein.
- Club: Der Vereinsbesuch, Stammtisch oder Techniktermin ist die Story. Eine Werkzeugtasche kann wichtig sein, muss aber nicht aus jedem Clubflug eine Lieferung machen.
- Privat: Der gemeinsame Tag ist die Story. Picknicktasche, Kamera oder Wanderschuhe sind Farbe, aber der Anlass bleibt Ausflug, Besuch, See, Essen, Wellness oder Tapetenwechsel.
- Cargo: Die Sendung ist tatsächlich Story-Träger. Dann muss klar werden, warum genau diese Fracht heute fliegt und was nach der Übergabe passiert.
- Medical/Tiertransport: Patient, Begleitung, Tier oder Versorgungslage tragen die Story. Material ist nur so wichtig, wie es Betreuung, Ruhe oder Übergabe erklärt.
- Inspection/News/Mapping: Zielobjekt, Befund oder redaktioneller Anlass tragen die Story. Kamera, Sensor oder Mappe sind Werkzeuge, nicht automatisch Hauptfigur.

Praktische Regel: Wenn ein Item aus dem Satz gestrichen werden kann und die Mission immer noch verständlich bleibt, gehört es wahrscheinlich nicht ins Briefing. Wenn die Mission ohne dieses Item ihren Sinn verliert, darf es sichtbar werden.

APT-Cargo ist der Gegenpol zu Charter: Hier ist die Sendung selbst die Hauptfigur. Bei normaler APT-Cargo-Kategorie ist das ein unbegleiteter Frachtflug mit `0 PAX`; Techniker, Prüfer, Werftkontakt, Empfänger oder Shuttle gehören an den Zielplatz und übernehmen dort. Diese Fracht darf wichtig und ordentlich verpackt sein, aber sie ist nicht automatisch hochsensibel oder dramatisch. Die Anlasswelt ist breit: AOG-Flugzeugteil, Industrie-Schnellkurier, Post- oder Paketbündel, Eventkiste, Drucksachen, Messgerät, Werkstattkit, Archivbox oder auch vier Kästen Bier fürs Dorffest sind alle gültige Cargo-Geschichten, solange Sendung, Empfänger und nächster Schritt klar sind. Das Briefing erzählt deshalb, was die Fracht ist, warum sie heute fliegt, wie sorgfältig sie behandelt werden muss, welche Route oder welches Wetter den Flug rahmt und was direkt nach der Landung mit ihr passiert. Der Einstieg soll den Zweck der Sendung erzählen, nicht nur den Inhalt aufhübschen: jemand wartet auf Post, ein Bauteil blockiert den nächsten Werkstatt- oder Produktionsschritt, eine Eventkiste fehlt am Eingang oder der Festaufbau braucht bei Sommerwetter endlich Getränke. Route und Wetter dürfen auch als eigener erzählter Satz stehen, solange sie die Frachtgeschichte stützen und nicht zur Checkliste werden; wiederkehrende Formeln wie ein immer gleicher Bodenrouten-Vergleich sollen vermieden werden.

`cargo_fragile` ist die bewusst schärfere Variante. Dort darf die Fracht wirklich empfindlich, wertvoll, temperaturkritisch oder high-care sein. Wenn dieses Profil ausdrücklich eine Begleitperson oder Frachtbegleitung vorsieht, darf daraus ein betreuter Transport werden; wenn das Manifest aber `0 PAX` sagt, bleibt auch `cargo_fragile` ohne Person an Bord.

### 0.6 Missionsfamilien im Ton

Jede Familie braucht ihren eigenen Klang.

`private_outing`:

- Pilot und Mitflieger fliegen gemeinsam privat irgendwohin.
- Der Flug ist Teil eines gemeinsamen Tages, nicht Taxi- oder Sightseeing-Ersatz.
- Der Zielplan darf konkret und lebensnah sein: Burger, Kaffee, Badesee, Meer, Berge, Museum, Einkauf, Besuch, Picknick.
- Begeisterung ist erwünscht. Der Text darf Lust auf den kleinen Fly-out machen.
- Benchmark: Ein guter privater Fly-out hat einen Anlass, der den ganzen Absatz trägt. Der Text erklärt nicht, dass es ein privater Ausflug ist, sondern erzählt, was die beiden heute wirklich vorhaben.
- Wenn der Grund dünn ist, darf der Writer eine plausible weiche Geschichte ergänzen: Frühstücksritual am Platz, Familienbesuch, Wellness-Auszeit, Eis-Stopp, Stadtbummel, besondere Burger-Empfehlung, kleine Fotorunde oder Tapetenwechsel nach stressigen Wochen.
- Route, Wetter und Entfernung sind Farbgeber. Sie gehören hinein, wenn sie die Stimmung stützen, dürfen aber die Hauptgeschichte nicht verdrängen.

`club_utility`:

- Der Flug gehört zum Vereinsleben, nicht zu einer anonymen Teillieferung.
- Ein konkreter Clubmoment trägt die Story: Fly-in-Besuch oder -Vorbereitung, Grillwurst am Clubheim, Jugendbriefing, Vereinsabend, Stammtisch, Hangar-Aktion, Techniktermin, Platzdienst, Flugtag, Gästekoordination oder Clubheim-Organisation.
- Es gibt zwei gleichwertige Club-Muster:
  - `Mitnahme/Hilfe`: Material, Schlüssel, Listen, Adapter, Banner oder Unterlagen sind der Wahrheitsanker, aber nicht automatisch der Mittelpunkt jedes Satzes.
  - `Besuch/Einladung`: Pilot und Mitflieger fliegen als Vereinsleute zum Zielplatz, weil dort Fly-in, Stammtisch, Clubabend, Fachsimpelei, Grillwurst oder eine Runde bekannter Gesichter wartet. Persönliche Sachen sind dann nur Bordzeug, keine Lieferung.
- Die Auswahlbasis soll beide Muster sichtbar mischen. `Besuch/Einladung` ist kein seltener Notfall-Fallback, sondern ein normaler Club-Anlass neben der praktischen Mitnahme.
- Wenn der Material- oder Besuchsgrund dünn ist, darf der Writer eine lebendige Vereinssituation erfinden: jemand wartet vor dem Clubheim, die Jugendgruppe braucht die Karten, der Flugtag braucht letzte Markierungen, der Stammtisch diskutiert ein neues VFR-Planungstool, oder das Fly-in lohnt sich allein wegen Leuten, Flugzeugen und Grill.
- Der Ton bleibt kollegial und praktisch. Es soll nach Vereinsleben klingen: manchmal helfen wir unserem Verein, manchmal sind wir eingeladen und fliegen einfach hin, weil dort etwas Nettes passiert.

`sightseeing_tour` an APT:

- Es ist ein A-B-Flug zu einem Zielort oder einer Zielregion.
- Der Reisegrund liegt in einem Besuch nach der Landung.
- Der Pax oder die Gruppe interessiert sich für Ort, Landmarke, Geschichte, Aussicht oder lokales Ziel.
- Ton: etwas professioneller als privater Ausflug, aber nicht trocken.

`sightseeing_tour` an POI:

- Der Überflug selbst ist der Kern.
- Zielobjekt, Blickwinkel, Foto- oder Beobachtungsmotiv müssen spürbar sein.
- Route und Rückkehr dürfen erwähnt werden, ohne daraus einen Arbeitsauftrag zu machen.

Arbeits-, Cargo-, Medical-, SAR- und Inspektionsmissionen:

- Der Anlass trägt den Text.
- Emotion und Dringlichkeit passen zur Lage, werden aber nicht künstlich aufgeblasen.
- Der Abschluss ist operativ klar: Übergabe, Beobachtung, Dokumentation, Rückholung, Versorgung oder Debrief.

### 0.7 Gute Mission, guter Briefing-Text

Ein guter sichtbarer Text erfüllt diese Probe:

1. Er klingt wie ein zusammenhängender Absatz.
2. Er beantwortet `wer`, `warum`, `wohin` und `was dann`.
3. Er nutzt 1 bis 2 konkrete Details statt 5 lose Stichpunkte.
4. Er bleibt bei der Missionsfamilie.
5. Er enthält keine internen Datenreste.
6. Er kann Route, Entfernung oder Wetter aufnehmen, ohne in ein Formular zu kippen.

Schwach:

"Heute geht es nach Pfullendorf. Dort soll ein privater Ausflug stattfinden. Das Wetter ist gut. Nach der Landung beginnt die Aktivität."

Stärker:

"Heute geht's mit Clara rüber nach Pfullendorf; ihr habt euch den kleinen Fly-out als Ausrede für Kaffee, ein Stück Kuchen und einen freien Nachmittag am Platz zurechtgelegt. Die gut 45 Meilen passen perfekt für einen entspannten Hinflug, und bei sommerlichem Wetter schmeckt der erste kalte Drink am Ziel gleich doppelt so gut. Stellt sauber ab, nehmt die Tasche mit und lasst den Rest des Tages privat werden."

## 1. Grundsatz

Eine gute Mission beantwortet vor dem ersten Flug vier Fragen:

1. Wer oder was ist der konkrete Auftragsträger?
2. Warum muss genau dieser Flug jetzt stattfinden?
3. Warum ist das Flugzeug die plausible Lösung?
4. Was passiert nach Landung, Übergabe, Pickup oder Rückkehr?

Wenn eine Mission diese Fragen nicht beantwortet, driftet sie schnell in generische Taxi-, Sightseeing-, Fracht- oder Einsatzsprache.

## 2. Mission Spine

Jede Missionsfamilie braucht eine klare Story-Spine. Diese Spine muss in Planner, Writer, Briefing, Voice und Debug-Snapshot dieselbe Richtung behalten.

Pflichtfelder im Denken:

- `subject`: konkrete Person, Fracht, Befund, Aufgabe oder Zielobjekt.
- `role`: funktionale Rolle, nicht nur "Gast" oder "Passagier".
- `trigger`: warum der Auftrag jetzt entsteht.
- `whyAir`: warum ein Flug sinnvoller ist als Bodenroute, spätere Erledigung oder Zufall.
- `arrivalState`: was am Ziel passiert.
- `completionState`: woran der Auftrag erfolgreich abgeschlossen ist.
- `nextStep`: was nach der Mission organisatorisch oder erzählerisch folgt.

Zusätzlich sollte jede Mission intern entscheiden:

- `storyCarrier`: Wer oder was trägt den Absatz wirklich?
- `materialRole`: Ist Gepäck/Fracht/Ausrüstung `primary`, `supporting` oder nur `wb_only`?
- `mentionPolicy`: Muss das Material sichtbar sein, darf es beiläufig auftauchen oder soll es aus dem Briefing verschwinden?

Diese Entscheidung verhindert, dass ein Generator jedes vorhandene Feld in den Text presst. Sie ist besonders wichtig bei Missionsfamilien mit Personen: Ein Chartergast, privater Mitflieger, Vereinskollege oder Reporter ist oft selbst die Geschichte. Das Gepäck erklärt dann nur Gewicht, Komfort oder Szene, aber nicht automatisch den Auftrag.

Daumenregel:

- `primary`: Ohne diese Fracht oder dieses Objekt ergibt die Mission keinen Sinn. Beispiel: eilige Ersatzteile, Architekturmodell, medizinische Transportbox, SAR-Befund.
- `supporting`: Das Material macht die Story anschaulicher, ist aber nicht alleiniger Grund. Beispiel: Kamera beim Fotoausflug, Kleidersack bei der Gala, Messkoffer beim Techniktermin.
- `wb_only`: Das Material bleibt für Beladung und Manifest wichtig, muss aber nicht sichtbar erzählt werden. Beispiel: Handgepäck, Jacke, normale Tasche, Tagesrucksack.

Beispiel APT Charter:

- schwach: "Ein Geschäftsgast muss zum Ziel."
- gut: "Vera Albrecht, Bausachverständige, fliegt zur Bauabnahme; der Bauleiter wartet mit Prüfliste und Schlüsselmappe am Zielplatz, weil das Freigabefenster nur heute offen ist."
- Charter bleibt faktennah, braucht aber eine tragende Gastabsicht im ersten Teil des Briefings. Der Text soll zeigen, welche Tätigkeit, welcher Termin oder welches Anschlussprogramm am Ziel wartet.
- Der Fluggast ist zuerst die Story. Oft transportieren wir einen Menschen mit Anlass, Zeitfenster und Zielkontakt; sein Handgepäck ist dann nur Weight-and-Balance-Hintergrund.
- Der Katalog darf gemischt sein: Technik-/Serviceeinsatz, Infrastruktur- oder Planungsrunde, Vorstandsrunde, Vertrieb, Banktermin, Bauabnahme, Vortrag, Gala, VIP-Shuttle, Hoteltransfer oder kurzer Leisure-Charter.
- Gepäck und Equipment werden nur als Teil der Szene erzählt, wenn sie wirklich etwas beitragen. Ein Technikteam braucht Messkoffer für die Wartungsvorbereitung; ein Projektingenieur bringt ein empfindliches Modell in die Planungsrunde; ein Gala-Gast hat vielleicht Kleidersack und Hotelshuttle. Normale Taschen, Rucksäcke oder Rollkoffer dürfen verschwinden, wenn sie den Anlass nicht besser machen.
- Keine wiederholte Kontrastformel wie "nicht X, sondern Y"; Humor soll aus konkreten Details kommen und bei beruflichen Charterflügen zurückhaltend bleiben.

## 3. Rollenrotation

Missionsfamilien mit Personen sollten eine kleine Persona-Bibliothek haben. Ziel ist Varianz ohne Zufallsmatsch.

Empfohlenes Persona-Schema:

- `name`
- `role`
- `gender`
- `personality`
- `dialectHint`
- `storySeed`
- `greetingText`

Regeln:

- 8 bis 12 Rollen reichen meist für eine Familie.
- Rollen müssen zur TaskDomain passen.
- Namen und Rollen dürfen nicht generisch sein.
- `storySeed` trägt den Anlass, nicht nur Stimmung.
- `greetingText` ist eine kurze persönliche Einstiegslinie, kein zweites Briefing.
- Rotation soll deterministisch genug sein, um Wiederholungen zu reduzieren.

Gute Rollen sind operativ verwertbar:

- Bausachverständige
- Avioniktechniker
- Eventkoordinatorin
- Vermessungsingenieurin
- Lodge-Manager
- Ranger-Kontakt
- Frachtkontakt

Schwache Rollen:

- Gast
- Passagier
- Geschäftsmann
- Kunde
- Person

## 4. Briefing-Qualität

Das Briefing ist ein Dispatcher-Auftrag an den Piloten. Es darf nicht wie eine Systemanweisung, ein Prompt oder ein Formular klingen.

Ein gutes Briefing hat meist 4 bis 5 natürliche Sätze:

1. Auftrag und Hauptperson/Hauptfracht.
2. Konkreter Anlass.
3. Operativer Ablauf.
4. Wetter, Terrain oder Zielplatz als kurzer Realitätsanker.
5. Abschlusskriterium oder nächster Schritt.

Pflicht:

- Dispatcher-/Auftragsperspektive.
- Keine Ich-Perspektive des Passagiers.
- Ein zusammenhängender Absatz statt lose aneinandergereihter Fakten.
- Route, Entfernung und Wetter nur natürlich einbauen, wenn die Daten verfügbar sind.
- Eine konkrete Handlung oder ein konkreter Grund am Ziel, nicht nur "Aufenthalt" oder "Aktivität".
- Kein Rohtext aus `storyFrame`, `candidateShortlist`, `mustAvoid`, `taskIdeas`.
- Keine Systemwörter wie `Pipeline`, `Profil`, `Handoff`, `Instruction`, `Rule`.
- Kein Widerspruch zwischen `pax`, `cargo`, `missionType`, `taskDomain`, `bushSpec` und Briefing.
- Keine erfundenen harten Geofakten außerhalb des Bundles.

Vermeiden:

- "Der Auftrag ist..."
- "Es geht konkret darum, Die Crew..."
- "Nutze exakt..."
- "Keine Pickup-Logik..."
- "Handoff am Ziel"
- "Passagier samt Gewicht verstauen"

Stattdessen:

- "Am Ziel wartet der Bauleiter mit der Prüfliste."
- "Die Rückfracht steht am Striprand bereit."
- "Nach der Landung übernimmt der lokale Kontakt das Material."
- "Der Rückflug bringt Notizen, Gepäck und Bericht wieder zur Basis."

Für private und Sightseeing-Missionen:

- "Clara und du wollt bei dem Wetter an den See; nach dem kurzen Flug habt ihr euch die Abkühlung verdient."
- "Der Gast möchte Schloss und Altstadt wirklich sehen, nicht nur den Zielplatz abhaken."
- "Die Strecke ist kurz genug für einen entspannten Fly-out, aber lang genug, damit sich der Ausflug besonders anfühlt."

Route/Entfernung/Wetter sind Qualitätsanker, keine Listenpflicht. Wenn sie fehlen, wird das Briefing nicht schlechter gemacht, sondern ohne diese Zutat sauber weitererzählt.

## 5. Von vorne richtig bauen

Qualität soll an der Quelle entstehen:

- Persona-Bibliothek
- StorySeed
- Planner-Kontext
- Mission Contract
- Writer-Regeln
- Narrative Memory
- Voice-Cues

Nachträgliche Filter sind nur Sicherheitsnetz, nicht Hauptmechanik. Wenn ein Briefing schlecht klingt, zuerst prüfen:

1. Ist die Story-Spine klar?
2. Ist die Rolle konkret?
3. Sind Planner- und Writer-Regeln widerspruchsfrei?
4. Wird ein Rohfragment in Story oder Voice kopiert?
5. Wird eine alte generische Persona wiederverwendet?

## 6. Voice-Qualität

Voice folgt der Missionsphase. Sie darf keine eigene State-Machine werden.

Phasenlogik:

- `greeting`: kurzer Einstieg am Start, wenn die Person wirklich am Start an Bord ist.
- `boarding`: nur wenn die Person tatsächlich einsteigt.
- `pickupBoarding`: nur am Ziel/Pickup-Ort.
- `departure`: nach Pickup oder Start des relevanten Legs.
- `atTarget`: kurzer Bezug zum Ziel.
- `farewell/debrief`: Abschluss, Ergebnis oder Folgeauftrag.

Regeln:

- Passagiere sehen sich nicht selbst als Ladung.
- Gewichte und Manifestdetails sind selten Teil natürlicher Sprache.
- Cargo darf als Gegenstand verstaut werden, Personen nicht.
- Pickup-Passagiere sprechen erst beim Pickup, nicht am leeren Startleg.
- Follow-up-Passagiere erzählen beim Rückflug etwas aus der Zeit zwischen den Missionen.

Schlecht:

- "Bitte verstaue mich und meinen Aktenkoffer sicher."
- "Ich steige jetzt ein, 1 PAX und Tasche müssen verladen werden."

Gut:

- "Ich habe den Messstab und den Aktenkoffer dabei; beides sollte sicher liegen, dann können wir los."
- "Ich bin am Zielplatz fertig. Der Termin ist durch, meine Sachen sind gepackt und ich bin bereit für den Rückflug."

## 7. Follow-up-Missionen

Follow-ups brauchen Narrative Memory. Die zweite Mission darf nicht wie ein neuer Zufallsauftrag wirken.

Zu speichern:

- ursprüngliche Mission
- Person oder Fracht
- Rolle
- Zielort
- Aufenthaltsdauer oder Auswertungszeit
- was vor Ort passiert ist
- warum jetzt die Rückholung oder Fortsetzung entsteht
- was nach der Rückkehr passiert

Wichtige Varianten:

- Pilot startet wieder an der ursprünglichen Basis.
- Pilot startet an einem Drittplatz.
- Pilot ist noch am Zielort.

Diese Varianten beeinflussen Ablauf und Briefing:

- Basis/Drittplatz: leerer Outbound-Leg, Pickup am Ziel, Rückflug.
- Noch am Ziel: kein Pickup-Return, sondern normaler Rückflug/Charter/Supply-Leg ab aktuellem Ort.

Follow-up-Briefing muss erklären:

- Bezug zum ersten Auftrag.
- Was seitdem passiert ist.
- Warum die Anfrage jetzt kommt.
- Was der Pilot auf diesem Flug konkret tun soll.

## 8. Hidden Truth und Reveal Timing

Manche Missionen haben interne Ergebnisse, die nicht ins Briefing sickern dürfen.

Beispiele:

- Fire Watch: Fehlalarm oder echter Befund.
- Bush Recon: alles ok, monitor only, minor service, technician needed.
- Inspektionen: Ergebnis erst nach Beobachtung oder Abschluss.

Regel:

- Interne Truth darf die Mission strukturieren.
- Briefing darf nur das bekannte Ausgangsbild zeigen.
- Voice/Debrief darf Ergebnis erst nach passender Phase verraten.
- Follow-up wird erst aus dem Ergebnis abgeleitet, nicht vorweg erzählt.

## 9. Cargo und Payload

Payload muss mit Story, Manifest und Runtime übereinstimmen.

Regeln:

- `paxText` beschreibt Personen.
- `cargoText` beschreibt Gegenstände.
- `mission-cargo-core.js` bleibt Wahrheit für Manifest und Erfolg.
- Briefing darf Cargo konkretisieren, aber nicht doppelt oder widersprüchlich aufzählen.
- Pickup-Cargo-Missionen starten leer oder mit optionaler kleiner Zusatzmitnahme nur, wenn das Profil das vorsieht.

Schlecht:

- "0 PAX | -" bei einer Story, die Rückholfracht beschreibt.
- Doppelte Frachtliste: "leere Kisten, Materialliste und defektes Case, Materialliste und leere Kisten..."

Gut:

- "Rückholfracht: leere Versorgungskisten, signierte Materialliste und defektes Funkakku-Case (42 lbs)."

## 10. Wetter, Ort und Szene

Wetter und Zielort sind Realitätsanker, kein Ersatz für den Auftrag.

Gute Nutzung:

- "Bei leichtem Wind bleibt der kurze Anflug planbar."
- "Am Ziel wartet der Kontakt im GA-Bereich."
- "Der Striprand ist der Übergabepunkt für Material und Rückmeldung."

Schlechte Nutzung:

- Wetter als Drama, wenn keines vorliegt.
- Sightseeing-Sprache in Arbeits- oder Chartermissionen.
- Szenenobjekte, die den Auftrag bereits erledigt wirken lassen.

Szene muss die Story unterstützen:

- APT Charter: Empfangskontakt/Shuttle im GA- oder Vorfeldbereich.
- Bush Supply: Kontakt, Utility-Fahrzeug, Frachtpunkt am Striprand.
- Pickup: Person oder Fracht wartet am Ziel, nicht am Start.
- Recon ohne Landung: keine Ziel-Ankunftsszene.

## 11. Mission Family Checklist

Wenn eine Missionsfamilie überarbeitet wird:

1. Zieltyp und TaskDomain prüfen.
2. Story-Spine formulieren.
3. Rollenbibliothek oder Cargo-Bibliothek definieren.
4. Gute und schlechte Story-Beispiele festhalten.
5. Planner-/Writer-Kontext anpassen.
6. Briefing-Fallbacks anpassen.
7. Voice-Cues pro Phase prüfen.
8. Manifest/Runtime-Phasen prüfen.
9. Follow-up-Fähigkeit bewusst erlauben oder ausschließen.
10. Dryruns gegen Drift und Wiederholung ausführen.

## 12. Testkriterien

Mindestens prüfen:

- Syntax: `node --check` für geänderte JS-Dateien.
- Persona-Dryrun: mehrere Rollen durchlaufen lassen.
- Forbidden-Hits: keine sichtbaren Systemwörter im Briefing.
- Story-Probe: `wer`, `warum`, `wohin`, `was dann` sind im sichtbaren Text beantwortet.
- Stil-Probe: Der Text liest sich als ein kurzer freier Absatz, nicht als Feldliste.
- Zutaten-Probe: Route, Entfernung und Wetter werden eingebaut, wenn vorhanden, aber fehlende Daten erzeugen keinen schlechten Fallback.
- Routing-Dryrun: richtige MissionType/category/profileId.
- Payload-Dryrun: `paxText`, `cargoText`, Manifest und Story passen zusammen.
- Follow-up-Dryrun: Request, PipelineContext und DispatchMission passen.
- Negativtest: nicht follow-up-fähige Stories erzeugen keinen Follow-up.
- Runtime-Test: Startleg, Pickup/Unload, Rückflug und Abschluss blockieren nicht.

Forbidden-Hits im sichtbaren Text:

- `Pipeline`
- `Profil`
- `Instruction`
- `Rule`
- `Handoff`
- `Candidate`
- `mustAvoid`
- `keine ... Logik`
- Airline-/Feeder-Sprache, wenn nicht ausdrücklich gewollt

## 13. Definition of Done

Eine Missionsfamilie gilt erzählerisch als sauber, wenn:

- Briefing bei mehreren Durchläufen konkret und unterschiedlich klingt.
- Rollen und Aufgaben nachvollziehbar wechseln.
- Jeder Text einen greifbaren Anlass statt nur eine generische Flugbewegung hat.
- Private und Sightseeing-Missionen Lust auf den Ausflug machen, ohne in Arbeits- oder Einsatzsprache zu kippen.
- Keine Person sich als Ladung beschreibt.
- Voice zur Missionsphase passt.
- Follow-up-Missionen dieselbe Geschichte fortsetzen.
- Nicht passende Follow-ups geblockt werden.
- Debug-Snapshot, Mission Contract, Passenger, Cargo und Scene denselben Auftrag beschreiben.
- Es keine sichtbaren Prompt- oder Systemfragmente gibt.
