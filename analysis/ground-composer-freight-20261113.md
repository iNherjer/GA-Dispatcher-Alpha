# Boden-Composer Strang-Probe: freight

Produktive Prompts/Validatoren, gemini-3-flash-preview, thinking low

## cargo-0

- Quelle: `{"passenger":null,"shipment":{"label":"Wartungssatz Winterdienst (Dichtungen, Filter, Schmierstoffe)","packaging":"4 robuste Kunststoffkisten, stapelbar und mit Zurrgurten gesichert.","weightLbs":185}}`
- Bordliste: keine Personen; c1 Wartungssatz Winterdienst (Dichtungen, Filter, Schmierstoffe) 185 lbs (Technischer Großhandel Weber (Lager Süd))
- Figuren: –
- KI-Looks: false, Hauptposten passt zur Ladeliste: true

## cargo-1

- Quelle: `{"passenger":null,"shipment":{"label":"Laborbedarf und Analyse-Kits für Praktikum","packaging":"6 Kartons auf einer stabilen Bodenplatte, mit Stretchfolie fixiert.","weightLbs":140}}`
- Bordliste: keine Personen; c1 Laborbedarf und Analyse-Kits für Praktikum 140 lbs (Lehrmittelzentrum Schwarzwald-Baar)
- Packstücke c1: Laborbedarf und Analyse-Kits für Praktikum: carton 47 lbs, carton 47 lbs, carton 46 lbs
- Figuren: –
- KI-Looks: false, Hauptposten passt zur Ladeliste: true

## fragile-0

- Quelle: `{"passenger":{"role":"Wissenschaftlicher Mitarbeiter","gender":"male"},"shipment":{"label":"Sedimentkerne in gekühlten Acrylglaszylindern","packaging":"Gepolsterte Thermokisten mit internen Fixierungsschienen.","weightLbs":145}}`
- Bordliste: Wissenschaftlicher Mitarbeiter/male; c1 Sedimentkerne in gekühlten Acrylglaszylindern 145 lbs (Wissenschaftlicher Mitarbeiter)
- Look: **workwear** (composer), male, adult – Wissenschaftlicher Mitarbeiter in funktionaler Arbeitskleidung passend zum Labor- und Außeneinsatz.
- Packstücke c1: Sedimentkerne in gekühlten Acrylglaszylindern: hardcase 73 lbs, hardcase 72 lbs
- Figuren: Tarmac_Male_Winter_Asian
- KI-Looks: true, Hauptposten passt zur Ladeliste: true

## fragile-1

- Quelle: `{"passenger":{"role":"Uhrmachergesellin","gender":"female"},"shipment":{"label":"Präzisionsgetriebe aus Messing und Stahl","packaging":"Passgenaue Holzkiste mit Schaumstoffauskleidung und Seidenpapierwicklung.","weightLbs":85}}`
- Bordliste: Uhrmachergesellin/female; c1 Präzisionsgetriebe aus Messing und Stahl 85 lbs (Uhrmachergesellin)
- Look: **workwear** (composer), female, young_adult – Handwerkliche Arbeitskleidung passend zur Rolle als Uhrmachergesellin bei einem Restaurierungsprojekt.
- Packstücke c1: Präzisionsgetriebe aus Messing und Stahl: wood_crate 85 lbs
- Figuren: Tarmac_Female_Winter_Asian
- KI-Looks: true, Hauptposten passt zur Ladeliste: true

## animal-0

- Quelle: `{"passenger":{"role":"Tierpfleger","gender":"male"},"shipment":{"label":"4 Meerschweinchen in belüfteter Kunststoff-Transportbox","packaging":"Eine stabile, gut belüftete Kleintiertransportbox aus Kunststoff, ausgelegt mit saugfähigem Einstreu und etwas Heu zur Beschäftigung.","weightLbs":15}}`
- Bordliste: Tierpfleger/male; kein Gepäck
- Look: **outdoor** (composer), male, adult – Tierpfleger in wetterfester Funktionskleidung für den Tiertransport im Freien.
- Figuren: Tarmac_Male_Winter_Asian
- KI-Looks: true, Hauptposten passt zur Ladeliste: false

## animal-1

- Quelle: `{"passenger":{"role":"Tiermedizinische Fachangestellte","gender":"female"},"shipment":{"label":"Veterinärmedizinische Proben (Blutserum) in gesicherten Gefäßen","packaging":"Bruchsichere Primärgefäße in einem flüssigkeitsdichten Sekundärbehälter mit Absorptionsmaterial, verpackt in einer isolierten Thermobox (Passivkühlung).","weightLbs":8}}`
- Bordliste: Tiermedizinische Fachangestellte/female; kein Gepäck
- Look: **medical** (composer), female, young_adult – Tiermedizinische Fachangestellte im klinischen Look für den Probentransport.
- Figuren: Tarmac_Female_Winter_Indian
- KI-Looks: true, Hauptposten passt zur Ladeliste: false
