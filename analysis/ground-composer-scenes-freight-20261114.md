# Boden-Composer Strang-Probe: freight

Produktive Prompts/Validatoren, gemini-3-flash-preview, thinking low

## cargo-0

- Quelle: `{"invalid":"fehlt"}`
- Fehler: Idee ungültig

## cargo-1

- Quelle: `{"invalid":"fehlt"}`
- Fehler: Idee ungültig

## fragile-0

- Quelle: `{"passenger":{"role":"Geselle","gender":"male"},"shipment":{"label":"Bleiverglaste Kirchenfenster-Segmente","packaging":"Holzverschläge mit weicher Schaumstoffpolsterung und Zwischenlagen.","weightLbs":185}}`
- Bordliste: Geselle/male; c1 Bleiverglaste Kirchenfenster-Segmente 185 lbs (Geselle)
- Look: **workwear** (composer), male, young_adult – Handwerker (Geselle) in robuster Arbeitskleidung passend zum Restaurierungsauftrag.
- Packstücke c1: Bleiverglaste Kirchenfenster-Segmente: wood_crate 95 lbs, wood_crate 90 lbs
- Szene start: Fahrzeug **van (composer, 2 Plätze)** aus [truck, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_Caucasian – Werkstatt-Transporter der Glaserei Kroll zur Anlieferung der empfindlichen Fracht.
- Szene arrival: Fahrzeug **van (composer, 2 Plätze)** aus [truck, van]; Personen male/business/adult(composer) → Tarmac_Male_Winter_African – Der kirchliche Bauleiter im Transporter zur sicheren Überführung der Fenster zur Kapelle.
- Figuren: Tarmac_Male_Winter_Asian
- KI-Looks: true, Hauptposten passt zur Ladeliste: true

## fragile-1

- Quelle: `{"passenger":{"role":"Botanikerin","gender":"female"},"shipment":{"label":"Lebende Orchideenzüchtungen (Orchidaceae)","packaging":"Spezialisierte Thermoboxen mit fixierten Halterungen für die Töpfe.","weightLbs":110}}`
- Bordliste: Botanikerin/female; c1 Lebende Orchideenzüchtungen (Orchidaceae) 110 lbs (Botanikerin)
- Look: **outdoor** (composer), female, adult – Botanikerin in funktionaler Kleidung für den Transport empfindlicher Pflanzenproben.
- Packstücke c1: Lebende Orchideenzüchtungen (Orchidaceae): cooler 55 lbs, cooler 55 lbs
- Szene start: Fahrzeug **van (composer, 2 Plätze)** aus [truck, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_African – Anlieferung der Proben in einem Transporter durch einen Mitarbeiter des Botanischen Gartens.
- Szene arrival: Fahrzeug **van (composer, 2 Plätze)** aus [truck, van]; Personen female/workwear/young_adult(composer) → Tarmac_Female_Winter_Hispanic – Abholung durch Institutsmitglied der Uni Freiburg zur direkten Überführung ins Gewächshaus.
- Figuren: tw-pod-hiker-f-01
- KI-Looks: true, Hauptposten passt zur Ladeliste: true

## animal-0

- Quelle: `{"passenger":{"role":"Tierpfleger","gender":"male"},"shipment":{"label":"4 Hauskaninchen in einer belüfteten Transportbox","packaging":"Eine handelsübliche, stabile Kunststoff-Transportbox für Kleintiere, ausgelegt mit saugfähigem Einstreu und etwas Heu.","weightLbs":25}}`
- Bordliste: Tierpfleger/male; kein Gepäck
- Look: **workwear** (composer), male, adult – Tierpfleger in Arbeitskleidung für den Transport der Kaninchen.
- Szene start: Fahrzeug **van (composer, 2 Plätze)** aus [truck, car, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_African – Zuchtwart der Langohrfreunde bringt die Tiere im Transporter zum Flugplatz.
- Szene arrival: Fahrzeug **van (composer, 2 Plätze)** aus [truck, car, van]; Personen female/outdoor/young_adult(composer) → tw-pod-hiker-f-01 – Leitung der Kleintiergruppe übernimmt die Tiere für das soziale Gartenprojekt.
- Figuren: Tarmac_Male_Winter_Caucasian
- KI-Looks: true, Hauptposten passt zur Ladeliste: false

## animal-1

- Quelle: `{"passenger":{"role":"Geflügelwirtin","gender":"female"},"shipment":{"label":"12 Laufenten-Küken in einem spezialisierten Transportkarton","packaging":"Ein stabiler Wellpappkarton mit verstärktem Boden und eingestanzten Luftlöchern im oberen Drittel, innen mit weichem Vlies ausgekleidet.","weightLbs":12}}`
- Bordliste: Geflügelwirtin/female; kein Gepäck
- Look: **workwear** (composer), female, adult – Erfahrene Geflügelwirtin in praktischer Arbeitskleidung für den Tiertransport.
- Szene start: Fahrzeug **van (composer, 2 Plätze)** aus [truck, car, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_African – Mitarbeiter des Geflügelhofs liefert die Küken fachgerecht im Transporter an.
- Szene arrival: Fahrzeug **car (composer, 2 Plätze)** aus [truck, car, van]; Personen female/outdoor/adult(composer) → tw-pod-hiker-f-01 – Inhaberin der Hobbyfarm wartet mit beheiztem PKW auf die Ankunft der Laufenten.
- Figuren: Tarmac_Female_Winter_Arab
- KI-Looks: true, Hauptposten passt zur Ladeliste: false
