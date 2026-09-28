# Rezept: strukturierte Missionsideen, Briefing und optionale Voice

Stand: 22.09.2026. Wiederverwendbarer Entwicklungsablauf aus Privat V6 und Vereins-Ideen V1.10. Dieses Rezept ist keine Behauptung, dass alle Missionsfamilien bereits migriert sind. Letzter in diesem Arbeitsstrang verifizierter Release: Alpha App v1766 / Tracker v405 (15.09.2026); vor einem neuen Release tatsächlichen Remote-Stand prüfen.

Fachliche Autorität: [Semantik](Mission%20Semantics%20Rules%20V4.md), [Ablauf](Mission%20Flow%20Reference.md), [Runtime-Vertrag](Mission%20Runtime%20Authority%20Contract.md). Neue Tracker-Missionsfamilien zusätzlich nach [Migrationsleitfaden](Tracker%20Mission%20Migration%20Guide.md). Produktprinzipien im [Narrative Design Guide](Mission%20Narrative%20Design%20Guide.md).

## 1. Bestehende Familie verstehen

Vor Änderungen Zieltyp, TaskDomain, Rollenprofil, Passagierzahl, Ladung, Szenen, Abschlussbedingungen und vorhandene Untertypen erfassen. Picker, Direktdispatch, Profilanwendung, Nachbearbeitung, Speicherung und Restore verfolgen. Gute fachliche Spezialisierung erhalten. Ein erzählerischer Umbau ist kein Anlass für neue Runtime-Mechanik.

Ausgangsbefund dokumentieren: Welche Daten entscheiden den Anlass? Wo kommen Namen, Ausrüstung und Begrüßung her? Wo wird KI-Text ersetzt? Gemeinsame Klassifikation, Parser oder andere Familien nur nach ausdrücklicher Freigabe ändern. Bestehende Beispiele eignen sich als Vergleichsmaterial für die Prüfung, nicht als neue Produktionsvorgaben.

## 2. Positiver Rahmen statt Beispielkatalog

Der Prompt beschreibt die Aufgabe und ihren Spielraum: Welche Beziehung verbindet die Beteiligten mit dem Flug, was wollen sie erreichen, welche Fakten stehen fest? Er fordert eine eigenständige zusammenhängende Idee. Keine vorgegebenen Szenarien, Berufslisten, Satzanfänge oder Musterhandlungen als kreative Anker.

Nutzerbeispiele in übertragbare Anforderungen übersetzen. Persönliche Fiktion ist möglich; reale Termine, Ortsmerkmale, Koordinaten, Wetterwerte und Betriebszustände brauchen Datenbelege. Orte sind optionale Möglichkeiten, keine Pflichtziele. Nicht jeden Anlass mit Dringlichkeit, gesellschaftlicher Bedeutung oder besonderer Ausrüstung rechtfertigen.

Der konkrete Familienrahmen bleibt eigenständig: Der verpflichtende Vereinskollege gilt für club_utility, nicht automatisch für Charter oder Cargo. Pilot und Passagier müssen bei einem kommerziellen Transport kein gemeinsames privates Ausflugsinteresse haben.

## 3. Eine strukturierte Idee als gemeinsame Grundlage

Technischer Flugrahmen → belegter Kontext und History → Ideen-JSON → Strukturprüfung → Writer → Missionsvertrag → Runtime.

Schema und Version explizit benennen. Die Idee hält Anlass, Absichten, tatsächliche Mitflieger, nächsten Schritt am Boden sowie gegebenenfalls Gepäck, Pflichtlieferung, belegtes Event und optionale narrativeEvents zusammen. Namen und Dinge folgen der Idee. Manifestpflichten werden ausdrücklich modelliert, nicht aus Prosa oder Gepäckstichwörtern erraten.

Ideen-Core für reine Daten/Validierung, Browser-Orchestrierung für API, Kontext und Speicherung. Bestehende Core-Bausteine wiederverwenden. Keine neue Missions-State-Machine im Voice-Layer.

## 4. Direktdispatch und Dreier-Picker

Direktdispatch entwickelt eine Idee, anschließend schreibt der Writer. Der Picker entwickelt drei eigenständige Ideen für technisch zulässige Zielrahmen in einem gemeinsamen Aufruf. Das ausgewählte Angebot bewahrt seine Idee und Ortsbelege; beim Annehmen nur noch den Writer aufrufen. Keine erneute zufällige Auswahl von Person oder Anlass.

Route, Identität und gegebenenfalls Eventgültigkeit beim Annehmen prüfen. Wetter und Flugdistanz frisch aus dem Dispatch beziehen. Optionale öffentliche Veranstaltungssuche ist eine eigene Kontextfunktion: nur belegte Termine nutzen, Fehler dürfen normale Ideen zulassen. Nicht jede Familie benötigt Eventsuche.

## 5. Writer und Flugabsatz

Titel, Story und Begrüßung aus derselben validierten Idee erzeugen. Außenstehende Erzählung mit du/ihr; direkte Ich-Rede nur bei einem zugeordneten Sprecher. Nur tatsächlich mitfliegende Personen sprechen an Bord. Zielkontakte sind noch nicht im Flugzeug. Flugzeugtypen in einer Geschichte sind nicht automatisch das eingesetzte Flugzeug.

Der Writer formuliert frei und erhält den Anlass. Neue strukturierte Verträge müssen gezielt vor alten Persona-, Cargo- und Textbaustein-Nachbearbeitungen geschützt werden; keine globalen Bypässe. Struktur und Faktenreferenzen prüfen, keine kreative Idee mit nachträglichen Regex-Verboten reparieren.

Flug-/Wetterabsatz separat im selben Writer-Aufruf: aktuelle Distanz, Start- und Zielbeobachtung mit Stationsbezug. Vorhandene Privat-V6-Helfer flightContext, flightBindings und resolveFlightBriefing sind die aktuelle Referenz. Zahlen/Einheiten durch gebundene Referenzen einsetzen. Das garantiert Werte, nicht jede qualitative Schlussfolgerung der KI. Keine Streckenprognose aus zwei Stationsmeldungen; fehlende Daten kenntlich machen. Ungültiger Zusatzabsatz darf entsprechend dem bisherigen Pfad ausbleiben, muss aber diagnostizierbar sein. Bestehende Missionen nicht still neu schreiben.

## 6. History: eigene Entwürfe als Vergleichsfälle

Ideenhistory beschreibt erzeugte Anlässe, Personen, Beziehungen und Gesprächsabsichten. Writerhistory beschreibt tatsächlichen Einstieg, Rhythmus, Schluss und wiederkehrende Formulierungen. Ziel: funktionale Wiederholungen erkennen, nicht frühere Texte als positive Vorlagen kopieren. Keine feste Themen- oder Eventquote.

Privat V6 liefert eine eigene Writer-Memory im JSON; Club speichert bisher Ideen-Memory, Gesprächsabsichten und Story-Einstieg. Diese Unterschiede nicht als bereits vereinheitlicht dokumentieren. Für die nächste Familie bewusst entscheiden, welche Memory-Felder nötig sind und im selben Writer-Aufruf erzeugt werden.

Nur angenommene/generierte Entwürfe nach erfolgreicher Übernahme erinnern; gleiche Missions-ID ersetzt ihren Eintrag. Speichergrenzen und Umgang mit alten Versionen definieren. Generiert bedeutet nicht geflogen: History darf keine gemeinsame erlebte Biografie vortäuschen.

Varianzhistory, aktive Idee und Gesprächsgedächtnis sind verschiedene Daten. Die Varianzhistory ist derzeit lokal pro Origin/Gerät; die aktive Idee wird synchronisiert. Geräteübergreifende Varianzhistory wäre eine gesonderte Erweiterung, kein bestehendes Versprechen.

## 7. Optionale Zusatzansagen und Sidequests

Null bis drei selbst entwickelte Gesprächsabsichten, kein Standard von genau einem Ereignis und keine künstliche Mindestquote. Pro Ereignis genau ein Trigger: Routenfortschritt atPercent (0–100 exklusiv) oder belegte geo-Koordinate mit anchorId und Radius. Geo kann umflogen werden; Prozent bezeichnet den frühesten Zeitpunkt, nicht garantierte Wiedergabe.

Hauptauftrag und Abschluss bleiben unverändert. Sidequests sind ausschließlich Immersion/Voice, keine neuen Pflichtaktionen, Erledigt-Nachweise oder Manifestpflichten. Auch fachliche Narration darf keine echte Funkantwort oder Messung als bestätigt erfinden. Intent speichern, Text passend zur aktuellen Situation erzeugen. Keine expliziten inhaltlichen Musterbeispiele im Prompt.

mission-route-voice-core.js enthält gemeinsame Trigger-/Promptregeln. Aktive, airborne Mission; Pause, Slew, Missionsende und belegte Voice-Queue berücksichtigen. Claims vor Ansagestart persistieren; Replay nach Restore vermeiden. Beansprucht ist nicht gleich erfolgreich gehört. Gesprächshistory erst nach tatsächlich abgeschlossener Wiedergabe ergänzen, nicht beim Generieren oder Vorladen. Lockere TTS-Regie und passende natürliche Textsprache getrennt prüfen.

## 8. App und Tracker explizit verbinden

Gleicher Trigger-Core, unterschiedliche autoritative Ablaufsteuerung. App/Debug-Sim beobachten lokal. Bei Tracker-Autorität bleibt die lokale Auslösung aus; der Tracker erhält Ereignisse im Voice-Kontext, nutzt seine bestätigte Route und eigene Telemetrie und schreibt persistente voice.flight-Effekte vom Typ route_story.

Für eine neue Familie reicht der gemeinsame Core allein NICHT. Heute lesen App-Trigger und Kontextübergabe die Ereignisse aus clubIdea.narrativeEvents; Gesprächshistory/TTS-Regie enthalten ebenfalls Vereins-Gates. Eine neue Familie benötigt eine gezielte Integration ihres Vertrags an diesen Stellen. Bestehende Tracker-Effekt- und Playback-Pfade wiederverwenden; neue Missionstypen nach Migrationsleitfaden nachweisen. Keine parallele doppelte Ansage aus App und Tracker.

## 9. Persistenz ist Teil der Implementierung

Alle Transportwege prüfen: volle lokale Speicherung, Quota-Sparmodus, separate/rekursive Contracts, Cloud-Stufen 1–3, Picker-Annahme, JSON-Roundtrip, Sitzung-Neustart, Gerätewechsel sowie Tracker-Resume-Bundle. Benötigte Erzählfelder müssen in jeder Allowlist bleiben. Kontext/Debugdaten dürfen verkleinert werden; ausführbare Ereignispläne nicht still entfernen.

Konkreter Fehler aus Club: compactMissionObjectForQuotaStorage und _syncCompactMissionObjectCore kannten clubIdea nicht. Briefing blieb sichtbar, Ereignisse verschwanden. Fix ab App v1766. Diesen Regressionstest für jeden neuen Vertrag erweitern.

Plan und Run getrennt behandeln: Cloud-Kopie einer Mission ist nicht automatisch Übernahme eines laufenden Runs. Fortsetzen braucht den zugehörigen autoritativen Status samt Claims und gehörten Texten. Erfolgreiche Synchronisierung voraussetzen, keine Garantie für nie übertragene Änderungen. Alte verlorene Trigger nicht aus Briefingtext erfinden.

## 10. Diagnose, Tests und Freigabe

Für neue Familien Diagnose vorsehen: Schema-/Promptversion, History-Anzahl, geplante Ereignisse mit Intent/Trigger, aktuelle Autorität, beanspruchte IDs und Skip-Grund. Geplant, beansprucht und gehört unterscheiden. Vollständige Ereignisdiagnose ist ein Ausbauziel; ältere Debugberichte zeigen dies noch nicht zuverlässig.

Pflichtprüfungen:

- Idee, Picker und Direktdispatch konsistent; Auswahl ohne Neuentwurf.
- Personenanzahl, Bordsprecher und Zielkontakte; Gepäck versus Pflichtladung.
- Akzeptierter Text bleibt durch Profil-/Finalizer-Pfade erhalten.
- Wetterbindungen, Stationsbezug, fehlende/ungültige Werte.
- 0/1/2/3 Ereignisse, Prozent und Geo; freie Anzahl nicht durch Schema erzwungen.
- Pause/Slew/Ende/Queue, Routenänderung, umflogener Geo-Punkt, stabile IDs.
- Lokal/Cloud/Restore einschließlich Quota und stärkster Komprimierung.
- Tracker-Telemetrie ohne DOM, Wiederherstellung ohne erneute Claims; tatsächliche Wiedergabe für History.
- Drei Live-KI-Beispiele mit fortgeschriebener History redaktionell bewerten: Texte UND Eventanzahl/Trigger/Intents zeigen. Drei Beispiele beweisen keine langfristige Vielfalt.

Referenztests: tools/mission-club-ideas.test.cjs, tools/mission-club-persistence.test.cjs, tools/mission-route-voice.test.cjs, tools/mission-weather.test.cjs und Tracker-Runtime-/Boarding-Voice-Tests. Automatisierte Tests ersetzen keinen Simulator-Hörtest oder echten Gerätewechsel.

Vor Release nur gewünschte Änderungen isolieren, SW-Version erhöhen, Tests auf tatsächlichem Release-Stand ausführen. Tracker-Codeänderungen nach github-push-workflow.md mit EXE/Alpha-Asset veröffentlichen. Live-Auslieferung prüfen, offene Tests und Mindestversion klar benennen. Keine ungeprüfte Stable-Promotion.

## 11. Nächster Kandidat: APT Business / Charter

Codebefund am 22.09.2026, noch keine Migration:

- UI-Kategorie business führt zu APT-Charter; Bush-Charter separat halten.
- Fallback-Angebote Business Charter und Executive Transfer betonen Termin, Pünktlichkeit und ruhigen Flug. Das sind Angebotsvorlagen, kein Nachweis zweier eigenständiger Runtime-Untertypen.
- CHARTER_PERSONA_LIBRARY und _pickNextCharterPersona liefern feste Personen; buildCharterPassenger ergänzt fehlende Rollen-/Personendaten.
- buildPersonalAptCharterStory komponiert Anlass, Detail, Routensatz, Wetter und Ankunft. personalizeAptCharterMission kann generische Geschichten ersetzen und Begrüßungen bearbeiten.
- Es gibt bereits Schutz für priorisierte V4-Plannertexte sowie Privat-/Club-Verträge. Diese vorhandene Differenzierung bewahren.

Vorgeschlagener erster Umfang: strukturierte freie Reiseidee für APT-Charter, bestehende Beförderungs-/Ankunftsmechanik behalten. Anlass und persönliche Bedeutung beim Reisenden entwickeln; Pilot bleibt Beförderer. Bestehende spezifische berufliche Geschichten als Qualitätsvergleich bewahren. Kein pauschaler Zwang zu Zeitdruck, VIP-Bedeutung, Komfortlob oder persönlicher Freundschaft.

Vor Umsetzung konkret entscheiden: Personen-/Gruppenrahmen und Sprecher, Gepäck versus Fracht, Ankunftskontakt, Memory-Schema und Vertragsfeld. Dann separaten Ideen-/Writer-Pfad und gezielten Schutz vor Legacy-Nachbearbeitung bauen. Optionale Events über explizite App-/Tracker-Anbindung dieses Vertrags integrieren; nicht einfach clubIdea umbenennen. Keine gemeinsame Klassifikation oder Bush-Charter nebenbei verändern. Abschließend drei Live-Beispiele und vollständige Persistenz-/Autoritätstests nach diesem Rezept.
