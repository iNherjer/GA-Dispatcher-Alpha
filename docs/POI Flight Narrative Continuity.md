# POI-Erzählkontinuität im Flug

Release: Web-Alpha v1879 und Tracker-Alpha v454.

## APT-Vorbild

Wie bei `MissionSightseeingIdeasCore.voiceContext` und dem Charter-Auftragsblock in `_baseContext` wird die gewählte strukturierte Idee an die Voice übergeben. Referenzen: [Charter](Mission%20Charter%20Ideas%20V1.md), [Routen-Voice](Mission%20Route%20Voice%20Events.md). Übernommen wird die Kontinuität von Anlass, Person und bisher Gesagtem; es werden keine neuen Routenereignisse oder APT-Erfolgsschritte für POI eingeführt.

`MissionPoiBriefingCore.voiceContext` liefert Person, Situation, Aufnahmeabsicht und Fotovertrag. `MissionInfraBriefingCore.voiceContext` liefert Auftraggeber, Person, Situation, fiktionale Ausgangsannahmen, Prüfbereich, Luftsicht und Folgeentscheidung. `_baseContext` verwendet diese zusätzlich zu bestehenden Daten. Der bisher auf 260 Zeichen gekürzte Storyanfang ist damit nicht mehr alleinige Auftragsquelle. Writer-Memory beschreibt die Schreibweise früherer Entwürfe und wird ausdrücklich nicht als im Flug erlebte Geschichte verwendet.

## Phasen und Befund

- Vor dem Ziel: Motivation, offener Auftrag und Erwartungen; keine vorweggenommenen Ergebnisse.
- Am Ziel: Aufnahmeabsicht bzw. fachliche Beobachtung im Rahmen desselben Auftrags.
- Nach bestätigtem Zielabschluss: Material bzw. vorliegender Inspektionsbefund und nächster Schritt; Rückflug und Abschied greifen bereits Gesagtes auf.

Der vorhandene POI-Voice-Kern verwaltet das Gesprächsgedächtnis und die erzeugten Ergebnisansagen. Der Tracker speichert Texte vor der Audioausgabe und übernimmt dieselben Prompts sowie Memory-/Recovery-Regeln. Ein vorhandener Inspektionsbefund bleibt maßgeblich, auch wenn die ursprüngliche Meldung dramatischer war. Die Story erfindet keinen abweichenden Befund.

Fotoaufträge erhalten keine Inspektionsmetadaten durch Schlüsselwort-Fallbacks mehr. Neue Fotoideen behalten einen persönlichen oder beruflichen Ton gemäß gewähltem Anlass statt grundsätzlich redaktioneller Sprache. Für neue Inspektionsideen folgt die erzählte Dringlichkeit dem Auftrag; bestehende operative Prioritäts-/Flugparameter werden nicht geändert. Konkreter Prüfbereich ersetzt die generischen Riss-/Bauteilbeispiele.

## Tracker-Vertrag und Veröffentlichung

`paxVoiceBuildPoiAuthorityContext` überträgt den fertigen `baseContext`, die Person und `inspectionMeta` über das vorhandene Schema v1. Keine neuen Auslöser, Voice-Effekttypen, Phasen oder Abschlussbedingungen. Die generierte `mission-poi-voice-core.js` wird ausschließlich über `tools/generate-poi-voice-core.mjs` aus `passenger-voice.js` aktualisiert.

Die angepassten phasenspezifischen Prompts gehören auch in eine neue Tracker-EXE. Ein reiner Web-Push würde nur den übertragenen Basiskontext aktualisieren, nicht alle eingebauten Promptregeln im bisherigen Tracker v453. Deshalb Web und Tracker bei Veröffentlichung gemeinsam prüfen und nach dem [Push-Workflow](github-push-workflow.md) ausliefern. Für diesen Release bestehen 235 Tests und 5.376 Legacy-Promptvergleiche. Ein echter Simulator-/Hörtest steht noch aus.

## Prüfung

`tools/mission-poi-narrative-voice.test.mjs` prüft den echten App-Basiskontext, beide vollständigen Ideen, drei Tracker-Promptphasen mit serialisiertem Gesprächsgedächtnis, Foto am Staudamm ohne Inspektionshinweis, Auftragsdringlichkeit und Vorrang des vorhandenen Befunds. Bestehende Tracker-Runtime-Tests decken Voice-Commit, Reihenfolge, Persistenz, Wiederanlauf und Abbruch ab. Die eingefrorenen Legacy-Vergleiche gelten weiterhin für Missionen ohne die neuen Briefing-Schemata.
