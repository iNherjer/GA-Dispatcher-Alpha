# Boden-Composer Strang-Probe: medical

Produktive Prompts/Validatoren, gemini-3-flash-preview, thinking low

## med-0 patient_transfer

- Quelle: `{"kind":"patient_transfer","passenger":{"role":"Medizinische Fachangestellte","gender":"female"},"patient":{"name":"Gerhard Weber","gender":"male","mobility":"seated_assisted"},"shipment":"Patientenakte und persönliche Tasche","recipient":"Fiktives Reha-Zentrum Backnang, Aufnahmeleitung","groundCast":{"start":[{"role":"Sanitäter des Zubringerdienstes","gender":"male"}],"arrival":[{"role":"Fahrerin des bereitstehenden Krankenwagens","gender":"female"}]}}`
- Bordliste: Medizinische Fachangestellte/female, Patient, sitzend mit Begleitung/male; kein Gepäck
- Look: **medical** (composer), female, adult – Medizinische Fachangestellte in Dienstkleidung zur Patientenbegleitung.
- Look: **casual** (composer), male, senior – Reha-Patient in bequemer Kleidung nach Hüftoperation.
- Szene start: Fahrzeug **medical (composer, 3 Plätze)** aus [car, van, medical]; Personen male/medical/adult(composer) → Tarmac_Male_Winter_Asian – Krankenwagen zur Übergabe des Patienten am Abflugplatz.
- Szene arrival: Fahrzeug **van (composer, 3 Plätze)** aus [car, van]; Personen female/medical/young_adult(composer) → Tarmac_Female_Winter_African – Abholung durch Reha-Fahrdienst am Flugplatz Backnang-Heiningen.
- Figuren: Tarmac_Female_Winter_Asian, Tarmac_Male_Winter_African
- KI-Looks: true, Hauptposten passt zur Ladeliste: false

## med-1 material_delivery

- Quelle: `{"kind":"material_delivery","passenger":{"role":"Medizinischer Kurier","gender":"male"},"patient":null,"shipment":"Laborproben-Box Typ A","recipient":"Fiktives Zentrallabor Freiburg, Warenannahme Medizin","groundCast":{"start":[{"role":"Mitarbeiter der Logistikabteilung","gender":"male"}],"arrival":[{"role":"Kurierfahrerin des Empfängers","gender":"female"}]}}`
- Bordliste: Medizinischer Kurier/male; kein Gepäck
- Look: **medical** (composer), male, adult – Medizinischer Kurier in entsprechender Dienstkleidung für den Probenbegleitdienst.
- Szene start: Fahrzeug **van (composer, 2 Plätze)** aus [truck, car, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_Indian – Anlieferung der Probenbox durch den Klinik-Logistik-Transporter am Flugplatz.
- Szene arrival: Fahrzeug **car (composer, 2 Plätze)** aus [truck, car, van]; Personen female/casual/young_adult(composer) → Tarmac_Female_Winter_Hispanic – Empfang der Sendung durch die Kurierkraft für den Weitertransport zum Zentrallabor.
- Figuren: Tarmac_Male_Winter_Asian
- KI-Looks: true, Hauptposten passt zur Ladeliste: false

## med-2 staff_transfer

- Quelle: `{"kind":"staff_transfer","passenger":{"role":"Medizintechnikerin","gender":"female"},"patient":null,"shipment":"Spezialwerkzeug und Ersatzteile","recipient":"Fiktives Versorgungszentrum Ostalb, Technikabteilung","groundCast":{"start":[{"role":"Fahrer der Service-Zentrale","gender":"male"}],"arrival":[{"role":"Mitarbeiter der fiktiven Haustechnik","gender":"male"}]}}`
- Bordliste: Medizintechnikerin/female; kein Gepäck
- Look: **workwear** (composer), female, adult – Technikerin im Arbeitseinsatz zur Reparatur von Medizintechnik, zweckmäßige Kleidung.
- Szene start: Fahrzeug **car (composer, 2 Plätze)** aus [truck, car, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_African – Transfer durch Service-Zentrale zum Abflugplatz im PKW.
- Szene arrival: Fahrzeug **van (composer, 2 Plätze)** aus [truck, car, van]; Personen male/workwear/adult(composer) → Tarmac_Male_Winter_Caucasian – Abholung durch Klinik-Haustechnik mit Transporter für den direkten Weitertransport zur Reparatur.
- Figuren: Tarmac_Female_Winter_Indian
- KI-Looks: true, Hauptposten passt zur Ladeliste: false
