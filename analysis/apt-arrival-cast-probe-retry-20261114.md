# Szenenplaner V3 mit fester Empfangsbesetzung (Live-Probe)

Scene Planner V3 Produktiv-Prompt + Sanitizer, gemini-3-flash-preview thinking low, EDTF-Fixture

## Charter-Abholung, feste Besetzung (Van, Planerin + Fahrer)

- Vorgabe: `{"fixed":true,"vehicleRole":"vehicle.van","persons":[{"kind":"arrival_person_1","role":"person.ground_crew","label":"Hochzeitsplanerin","gender":"female"},{"kind":"arrival_person_2","role":"person.ground_crew","label":"Fahrer","gender":"male"}],"maxPersons":2}`
- Grundrolle: arrival_vehicle:vehicle.car, arrival_person_1:person.ground_crew
- Planer: arrival_vehicle:vehicle.van:Hochzeits-Van @-5/4, arrival_person_1:person.ground_crew:Hochzeitsplanerin @2/1, arrival_person_2:person.ground_crew:Fahrer @1.5/2
- Platz: osm_apron#0 – Korrektur der Positionierung: Wahl eines Apron-Kandidaten (way/93255371) mit konservativeren Offsets, um innerhalb der polygonalen Begrenzung der befestigten Fläche zu bleiben.
- Nach Prüfung: arrival_vehicle:vehicle.van:Hochzeits-Van @-5/4, arrival_person_1:person.ground_crew:Hochzeitsplanerin @2/1, arrival_person_2:person.ground_crew:Fahrer @2/2
- Runden: 1: apt_arrival_scene_invalid: arrival_vehicle: Abstand zu building (hangar) zu klein · 2: apt_arrival_scene_invalid: arrival_vehicle: ausserhalb der gewaehlten Stellflaeche · 3: ok
