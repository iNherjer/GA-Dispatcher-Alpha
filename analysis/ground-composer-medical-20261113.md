# Boden-Composer Strang-Probe: medical

Produktive Prompts/Validatoren, gemini-3-flash-preview, thinking low

## med-0 patient_transfer

- Quelle: `{"kind":"patient_transfer","passenger":{"role":"Medizinische Fachangestellte","gender":"female"},"patient":{"name":"Gerhard Weber","gender":"male","mobility":"seated_assisted"},"shipment":"Patientenakte und persönliches Kleingepäck"}`
- Bordliste: Medizinische Fachangestellte/female, Patient, sitzend mit Begleitung/male; kein Gepäck
- Look: **medical** (composer), female, adult – Medizinische Fachangestellte in Dienstkleidung zur Begleitung der Patientenverlegung.
- Look: **casual** (composer), male, senior – Stabiler Patient in entspannter Freizeitkleidung für den Transfer zur Reha-Klinik.
- Figuren: Tarmac_Female_Winter_Arab, Tarmac_Male_Winter_Caucasian
- KI-Looks: true, Hauptposten passt zur Ladeliste: false

## med-1 staff_transfer

- Quelle: `{"kind":"staff_transfer","passenger":{"role":"Labor-Ingenieurin","gender":"female"},"patient":null,"shipment":"Schulungsunterlagen und Kalibrierungswerkzeug"}`
- Bordliste: Labor-Ingenieurin/female; kein Gepäck
- Look: **business** (composer), female, adult – Gepflegtes Auftreten als externe Spezialistin für die technische Einweisung im MVZ.
- Figuren: Tarmac_Female_Winter_Hispanic
- KI-Looks: true, Hauptposten passt zur Ladeliste: false

## med-2 material_delivery

- Quelle: `{"kind":"material_delivery","passenger":{"role":"Logistik-Koordinator","gender":"male"},"patient":null,"shipment":"Ersatzteilkomponente (Dichtungssatz und Steuerung)"}`
- Bordliste: Logistik-Koordinator/male; kein Gepäck
- Look: **workwear** (composer), male, adult – Logistik-Koordinator im technischen Logistik-Einsatz; trägt praktische Arbeitskleidung.
- Figuren: Tarmac_Male_Winter_Hispanic
- KI-Looks: true, Hauptposten passt zur Ladeliste: false
