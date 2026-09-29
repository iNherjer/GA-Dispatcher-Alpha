# POI-Foto-Mission als Vorlage für weitere Profile

Diese Vorlage dokumentiert den fertigen Umbau des ersten POI-Profils `media_photo`. Sie ist eine Ablauf- und Zuständigkeitsvorlage, keine Sammlung von Motiven und kein universeller Fotovertrag für andere Aufgaben. Für Lage/Wetter gilt verbindlich der [Shared Briefing Guide](POI%20Shared%20Briefing%20Guide.md).

## Bedeutung der Vorlage: Methode, nicht Missionsinhalt

Nutzerklarstellung: Übernommen werden die Art der Missionsgestaltung und des Prompt-Schreibens – freie Ideenentwicklung innerhalb des jeweiligen Auftrags, Bindung der ausgewählten Idee, passende Fakten und History, anschließender Writer. Fotozweck, Rollen und Tätigkeitsgrenzen werden nicht auf andere Profile übertragen. Insbesondere gilt „PAX darf nur fotografieren; Auswertung erst am Boden“ ausschließlich für den Fotoauftrag, nicht allgemein für POI-Missionen.

### Gegenprobe am bestehenden Profil Infrastruktur-Inspektion

Das aktuelle `inspection_infra` verwendet `technical_inspector_v1` (`app.js`, `MISSION_ROLE_TASK_PROFILES`). Mitfliegende Fachpersonen prüfen sichtbare Zustandsmerkmale und grenzen Verdachtsbereiche ein. Der Writer soll Anlass, fachlichen Fokus und Folgeentscheidung verbinden (`MISSION_SEMANTICS_V4.domainRules` und Infrastruktur-Writerregel in `app.js`). Die Abschluss-Voice verlangt ein fachliches Kurzfazit über Beobachtung, Zustand und nötige Nacharbeit (`mission-poi-voice-core.js`, `inspectionCompletionRule`).

`mission-infra-outcome-core.js` verarbeitet Inspektionsbefunde und mögliche Folgeaufträge wie Nachprüfung oder Schadenskartierung. Fotos können Teil der Dokumentation sein, ersetzen aber nicht Sichtprüfung und fachliche Einordnung. Bei einer späteren Briefing-Migration bleiben diese Rollen, Befunde und Folgeabläufe erhalten. Keine Übertragung des Fotoverbots für Beurteilung, keine Umdeutung in einen reinen Fotoauftrag. Die Migration für initiale Einzelziele ist mit Alpha v1878 standardmäßig aktiviert; Umfang und offene Qualitätsfragen stehen in [Infrastruktur-Inspektion](Infrastructure%20Inspection%20Briefing%20Migration.md).

## Bestehender Ablauf

1. Der vorhandene POI-Picker bestimmt mögliche Ziele; deren Identität bleibt verbindlich.
2. `MissionPoiBriefingBrowser.choices` sammelt Zielbelege und erzeugt wie bei den umgestellten APT-Missionen Ideen für höchstens drei Ziele in einem Batch.
3. Jede Idee wird genau einer `targetId` zugeordnet. Der Angebots-Snapshot bewahrt Start, Ziel, Kontext und die vollständige Idee.
4. Nach der Nutzerwahl prüft `story` Start-/Zielidentität und Ideenvertrag erneut. Kein stiller Austausch und kein erneutes Erfinden der gewählten Idee.
5. Der gemeinsame Browser-Baustein ergänzt die Umgebung des ausgewählten Ziels. Der gemeinsame Core liefert Flug-/Wetterrahmen und Promptregeln.
6. Ein Writer erzählt die gewählte Idee mit History, Fakten und Flugwerten. Er wählt Orientierungspunkte; Lagebeziehungen und Höhen werden quellengebunden dargestellt. Wetterfehler verwerfen keine gültige Geschichte.
7. Das Ergebnis wird in den vorhandenen V4-Vertrag übernommen, kompakt gespeichert und synchronisiert. Die bestehende POI-Ausführung bleibt zuständig für `on_task`, Rückkehr und Abschluss.

Bestehende technische Planner-/Provider-Schritte bleiben bestehen. Kein neuer Startpfad, keine zusätzliche Runtime, kein nachgeschalteter Reparatur-Writer. Live-KI-Tests in Gruppen von höchstens drei Missionen, dann auswerten.

## Was beim nächsten Profil wiederverwendet wird

- Gemeinsame Ziel-/Umgebungsbelege, Geometrie, Abrufe, Cache, Ausfallverhalten, Wetterrahmen und Lagebericht.
- APT-Muster „Idee auswählen → genau diese Idee ausarbeiten“.
- Zuordnung über stabile IDs; Storytext und Reihenfolge sind keine Identitätsprüfung.
- Bestehender Dispatch-, V4-, Speicher-, Cloud-, Tracker- und Startablauf.
- Tests für End-to-End-Vertrag, Quelle/Rohtext/Finaltext und unveränderte Aufgabenidentität.

## Was profilspezifisch bleibt

| Foto-Referenz | Bei einem weiteren Profil |
| --- | --- |
| `media_photo`, `media_observer_v1` | Den vorgesehenen bestehenden TaskDomain-/Rollenvertrag verwenden |
| `poi-photo-idea.v1`, `poi-photo-proposal.v1` | Eigenen oder bestehenden Profilvertrag verwenden; keine Foto-Schemata missbrauchen |
| Ein PAX, Kamera, Rückkehr | Nur übernehmen, wenn diese Anforderungen zum Profil gehören |
| PAX macht Fotos/Videos, Auswertung später am Boden | Praktische Leistung des neuen Profils explizit festlegen |
| `ga_poi_photo_history_v1` | Zum Profil passende History; keinen gemeinsamen Motivpool erfinden |
| `ga_poi_briefing_v1=off` | Bestehende Aktivierung/Rückfallschalter respektieren |
| `MissionPoiBriefingCore.owns` und Speicherkennung `poi-briefing.v1` | Neue Narrative kontrolliert an bestehende Persistenz/Finalisierung anschließen |

Der Shared-Baustein setzt keinen Passagier, kein Cargo, keine Rückkehrpflicht und keine TaskDomain. Neue Profile dürfen nicht ihre ganze Missionslogik durch den Foto-Adapter schicken. Weitere Profile gezielt migrieren; ein gemeinsam nutzbarer Lagebericht aktiviert sie nicht automatisch.

## Prompt-Prinzipien aus dem Umbau

Der Prompt führt positiv durch den Auftrag und lässt Anlass, Person und Geschichte frei. Keine feste Motivliste, keine privaten/beruflichen Quoten, keine lokalen Sonderregeln. Professionelle und persönliche Anlässe sind möglich. Verschiedene Namen allein erzeugen keine Vielfalt: Die History soll Absicht, Beziehung und Erzählverlauf unterscheidbar machen.

Foto-spezifisch: Interesse an Details ist ein Aufnahmewunsch. Keine versteckte Zustandsprüfung oder Vermessung an Bord. Ein privater Ausflug darf nicht unterwegs zum Inspektionsauftrag werden. Diese Leistung nicht ungeprüft anderen TaskDomains aufzwingen.

Geo-Kontext ergänzt das Ziel. Eine interessante benachbarte Brücke ersetzt nicht das gewählte Bauwerk. Reale Eigenschaften kommen ausschließlich aus Belegen; persönliche Fiktion ist keine Ortsquelle. Lage- und Wetter-Promptteile aus dem Shared-Core verwenden, nicht neu kopieren.

## Vorgehen für den nächsten Umbau

1. Bestehenden Zieltyp, TaskDomain, Rolle und Contract prüfen; zugehörige APT-Referenz und diese Dokumente lesen.
2. Profilabhängige Idee/Writer-Felder benennen, gemeinsamen Lage-/Wetterteil direkt anbinden.
3. Bestehenden Snapshot-/Auswahlvertrag erhalten; unpassende Ziel-/Startidentität sichtbar ablehnen.
4. Speicher-/Cloud-/Restore-Tests und unveränderte Missionsausführung prüfen. Erzählqualität allein genügt nicht.
5. Kleine Gemini-Serie mit realistischen Wetter- und Geo-Belegen auswerten. Rohantworten, Rückfälle und inhaltliche Brüche getrennt dokumentieren; keine formale Annahmequote als Qualitätsnachweis ausgeben.
6. Nach Freigabe über den normalen Alpha-Workflow veröffentlichen; SW-Version erhöhen, Script-URLs aktualisieren, ausgelieferte Dateien prüfen.

Keine Änderung an zentralen Klassifizierungen oder fremden Profilverträgen unter dem Deckmantel einer Briefing-Migration. Falls erforderlich, Impact benennen und gemäß AGENTS.md freigeben lassen.

## Konkrete Referenzdateien

- Foto-Fachlogik: `mission-poi-briefing-core.js`
- Foto-Orchestrierung: `mission-poi-briefing-browser.js`
- Wiederverwendbare Logik: `mission-poi-briefing-shared-core.js`, `mission-poi-briefing-shared-browser.js`
- Regressionen: `tools/mission-poi-briefing.test.mjs`, `tools/mission-poi-briefing-shared.test.cjs`, `tools/mission-poi-environment.test.cjs`
- Live-Writerprobe: `tools/poi-briefing-context-live.mjs` (ein kostenpflichtiger Writer, Wetterfixture; keine vollständige App-/Simulatorprobe)
- Datenprobe: `tools/poi-environment-probe.mjs` (reale Quellenabrufe, synthetischer Writer, kein Gemini)

Die alten Exporte der Foto-Core für Geo-Helfer bleiben vorerst kompatible Weiterleitungen. Neue Verbraucher importieren direkt den Shared-Core, niemals den Foto-Core als allgemeine Bibliothek.

Flug-Voice: [Erzählkontinuität nach APT-Muster](POI%20Flight%20Narrative%20Continuity.md). Veröffentlicht mit Web-Alpha v1879 und Tracker-Alpha v454; gemeinsame App-/Tracker-Verifikation.
