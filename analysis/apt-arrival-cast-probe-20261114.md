# Szenenplaner V3 mit fester Empfangsbesetzung (Live-Probe)

Scene Planner V3 Produktiv-Prompt + Sanitizer, gemini-3-flash-preview thinking low, EDTF-Fixture

## Reporter-Abholung, offene Besetzung (Pkw, Standardperson)

- Vorgabe: `{"fixed":true,"vehicleRole":"vehicle.car","persons":[],"maxPersons":3}`
- Grundrolle: arrival_vehicle:vehicle.van, arrival_person_editor:person.ground_crew, arrival_person_camera:person.ground_crew, arrival_equipment_camera:cargo.camera_equipment
- Planer: arrival_vehicle:vehicle.car:Redaktions-Van @-7/5, arrival_person_1:person.ground_crew:Redakteur @1/3, arrival_person_2:person.ground_crew:Kameramann @3/4
- Platz: osm_hangar_front#0 – Die Hangar-Vorderseite bietet ausreichend Platz und passt zum Szenario einer Medienabholung am Regionalflugplatz.
- Nach Prüfung: arrival_vehicle:vehicle.car:Redaktions-Van @-7/5, arrival_person_editor:person.ground_crew:Redakteur @1/3, arrival_person_camera:person.ground_crew:Kameramann @3/4

## Frachtübergabe, feste Besetzung (Pick-up, Lagerleiter)

- Vorgabe: `{"fixed":true,"vehicleRole":"vehicle.truck","persons":[{"kind":"arrival_person_1","role":"person.ground_crew","label":"Lagerleiter der Werft","gender":"male"}],"maxPersons":1}`
- Grundrolle: arrival_vehicle:vehicle.van, arrival_person_1:person.ground_crew, arrival_equipment_1:cargo.small_box
- Planer: arrival_vehicle:vehicle.truck:Lager-Pick-up @-7/5, arrival_person_1:person.ground_crew:Lagerleiter der Werft @2/3, arrival_equipment_1:cargo.small_box:Ersatzteil-Kiste @0/5
- Platz: osm_hangar_front#0 – Der gewählte Hangar (way/93255447) bietet eine plausible Werft-Kulisse mit ausreichend Platz auf der befestigten Vorfläche.
- Nach Prüfung: arrival_vehicle:vehicle.truck:Lager-Pick-up @-7/5, arrival_person_1:person.ground_crew:Lagerleiter der Werft @2/3, arrival_equipment_1:cargo.small_box:Ersatzteil-Kiste @0/5

## Charter-Abholung, feste Besetzung (Van, Planerin + Fahrer)

- Vorgabe: `{"fixed":true,"vehicleRole":"vehicle.van","persons":[{"kind":"arrival_person_1","role":"person.ground_crew","label":"Hochzeitsplanerin","gender":"female"},{"kind":"arrival_person_2","role":"person.ground_crew","label":"Fahrer","gender":"male"}],"maxPersons":2}`
- Grundrolle: arrival_vehicle:vehicle.car, arrival_person_1:person.ground_crew
- Planer: arrival_vehicle:vehicle.van:Abhol-Van @-8/5, arrival_person_1:person.ground_crew:Hochzeitsplanerin @2/3, arrival_person_2:person.ground_crew:Fahrer @1.5/4.5
- Platz: osm_hangar_front#0 – Die Position vor dem Hangar (way/93255447) bietet ausreichend Platz und passt zum privaten Charter-Kontext der Mission.
- Nach Prüfung: verworfen: apt_arrival_scene_invalid: arrival_vehicle: Abstand zu building (hangar) zu klein
