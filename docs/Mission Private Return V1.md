# Private Return V1

Stand: 15.09.2026. App-Release: `ga-dispatcher-v1761`; Tracker Alpha bleibt v404.

Die unten als lokal beschriebenen Nachbesserungen sind mit v1761 veröffentlicht.
Das umfasst Debug-/Sim-Abschluss, Writer V1.2, History V6.3.1 und die einmalige
Erzählung nach 60 Sekunden Flugphase ab 500 ft AGL.

## Zweck und Grenze

`private_return` ist ein eigenes internes APT-Profil mit eigener Task-Domain und
Follow-up-Art. Es entsteht aus einem abgeschlossenen privaten Ausflug, nicht aus
der zufälligen Missionsauswahl. Der Spieler und dieselbe Begleitung reisen vom
besuchten Flugplatz zum ursprünglichen Startplatz zurück. Beide haben die
Unternehmung gemeinsam erlebt. Das Briefing erzählt davon und bereitet trotzdem
den noch bevorstehenden Rückflug vor.

Der Aufenthalt braucht keine reale Wartezeit im Simulator. Mit Auswahl der
Heimreise wird er als fiktionales gemeinsames Erlebnis erzählt. Der Hinflug muss
dagegen wirklich abgeschlossen sein. Wochenereignisse und Übernachtungspläne
bleiben als Kontext erhalten; der Writer darf daraus nicht automatisch eine
bestimmte Tageszeit oder tatsächlich verstrichene Dauer machen. Die Sim-Uhr wird
nicht umgestellt. Das Wetter ist der aktuelle Abruf für den Rückflug.

## Zuständigkeiten

- `mission-private-return-core.js`: Abschlussnachweis, begrenzter Folgeauftrag,
  feste Rückroute, Fortsetzungsvertrag, eigener Writer-Prompt, Validierung und
  phasenbezogener Voice-Kontext. Keine Missions-State-Machine.
- `mission-followup.js`: gezielte private Adapter vor den bisherigen Fällen;
  Angebot, Annahme, Duplikatschutz, bestehender Local-/Cloud-Sync.
- `app.js`: internes Profil, aktuelle Flug-/Wetterdaten, ein Return-Writer-Aufruf,
  normaler APT-Contract und Speicherung. Die Task-Domain ist explizit zugelassen;
  die private Rückreise durchläuft keine Prosa-Klassifikation als Charter/Ausflug.
- `sync.js`: übernimmt beim Aufbau des Abschlussrecords gemessene Flugevidenz
  und die bestehende `_missionEndReadiness`-Entscheidung. Nach Persistierung eines
  passenden Abschlusses wird das private Angebot angelegt. Der Pfad wird auch
  beim bestätigten Tracker-Abschluss und Completion-Restore verwendet.
- `passenger-voice.js`: dieselben APT-Trigger, neue private Erzählhinweise und
  maximal vier bereits gesprochene Texte als lokaler Anschlusskontext.
- `mission-boarding-voice-core.js`: erhält für dieses Profil die ursprüngliche
  Voice-Identität auch über die normalisierten Speaker-/TTS-Snapshots.
- `mission-arrival-core.js`: kein künstlicher Abholkontakt am Heimatplatz.
  Die normale APT-Zielprüfung arbeitet über den vorhandenen Airport-Fallback.

## Abschluss und Angebot

Der Quellvertrag muss `private-outing.v1` / `private_outing` sein. Folgemissionen,
POI-/Bush-Rezepte, fehlende Personen-/Gepäckdaten, unvollständige Flugplatzreferenzen
oder gleiche Start-/Zielplätze ergeben kein Angebot. Das Abschlussrecord muss
zur Quellmission gehören und erfolgreich sein. Sein `privateOutingEvidence`
belegt einen gemessenen Flug (mindestens 15 Sekunden, zwei Telemetriesamples,
gemessene positive Strecke statt Planstrecke), den richtigen Endpunkt und
Stillstand am Boden. Die verwendeten Flugrecords werden schon vom vorhandenen
Recorder nur mit Airborne-Evidenz erzeugt. Eine neue Landedistanz-Heuristik gibt
es nicht.

Der frühe allgemeine Close-Hook ohne Abschlussrecord genügt absichtlich nicht.
Der explizite Debug-Knopf hat einen separaten, markierten Testpfad (siehe unten).
Alte Abschlüsse ohne diesen Nachweis werden nicht
rückwirkend zu privaten Heimreisen ergänzt.

Ein deterministischer Request-Key pro Quellmission verhindert Mehrfachangebote.
Das Angebot ist sofort fällig, bis 14 Tage nach dem Quellabschluss verfügbar und
bleibt optional. Ältere Abschlüsse erzeugen auch nach Ablauf ihrer Tombstones
kein neues Angebot. Abgelehnte
und angenommene private Anfragen behalten ihren Tombstone 14 Tage innerhalb der
bestehenden Speicherobergrenzen. Im Altpfad begrenzt `addDays` negative Offsets
auf null; für private Tombstones wird deshalb die korrekte Zeitdifferenz direkt
berechnet. Andere Follow-up-Arten wurden damit nicht verändert.

Die Annahme verwendet ausschließlich den besuchten Platz als Start. Ein bekannter
abweichender letzter Landeort stoppt sie. Start/Ziel werden vor Dispatch und
Writer erneut gegen den Vertrag geprüft. Es gibt keinen stillen Leerflug,
keine Umsetzung zum Heimatplatz und keinen neuen Zielvorschlag. Das Stellen der
Planungsfelder ist keine Teleportation des Simulatorflugzeugs; die üblichen
Start-/Boarding-Gates gelten weiterhin.

## Gemeinsamer Erzählvertrag

`private-return.v1` enthält `phase: return`, Quellmission und Abschluss-ID,
Abschlusszeit, Heimat-/Besuchsplatz, die kompakte ursprüngliche Idee und die
ursprüngliche Voice-Identität. Die Kopie der Idee enthält Anlass, persönliche und
gemeinsame Absichten, Begleitung, Gepäck, Bodenplan und gegebenenfalls Eventbezug.
Sie enthält keine komplette alte Story, Wetterwerte oder Entwurfshistory. Der
Quellsnapshot ist auf 10.000 JSON-Zeichen begrenzt; der spätere Rückblick ergänzt
höchstens 1.520 Inhaltszeichen zuzüglich JSON-Struktur.

Bei Auswahl erzeugt ein Writer-Aufruf gemeinsam:

- Titel und persönliches Vorflugbriefing;
- `experienceRecap.summary`, ein bis drei `moments` und `companionReaction`;
- einen Begrüßungssatz in der Stimme der Begleitung;
- einen flüssigen Flug-/Wetterabsatz mit den bestehenden V6-Wertbindungen.

Der Code validiert Struktur, Sprecher, Längen, Textformat und Flugwertreferenzen.
Briefing und Voice benutzen denselben gespeicherten Rückblick. Eine semantische
Garantie für jede freie Ausschmückung ist das nicht. Der Prompt hält den
ursprünglichen Anlass fest, ohne Aktivitätenkatalog oder literarische Schablone.
Bei ungültiger KI-Antwort bleibt das Angebot verfügbar und es gibt eine sichtbare
Fehlermeldung. Die Anwendung erzeugt keinen Ersatz-Ausflug. Bei ausgeschalteter
KI gibt es einen einfachen Rückflugtext aus dem Vertrag, ohne erfundene
Erlebnisdetails; das ist ausdrücklich kein gleichwertiger Erzählqualitätsmodus.

## Vergleich der Trigger

| Station | Bush Passenger Return | Private Return |
| --- | --- | --- |
| Freigabe | Pickup am Strip, laden/signieren/bestätigen, `return_leg` | Normales APT-Boarding am besuchten Flugplatz, Startladung/signieren/bestätigen |
| Boarding | Eigene Pickup-Ansage über den Aufenthalt des Gastes | Normale Boarding-Ansage, persönlicher Rückblick beider Reisenden; generierter Gruß auch als Fallback |
| Abflug | Separater, nach Pickup scharfgeschalteter Airborne-Trigger (`missionMaybeTriggerPickupDepartureVoice`) | Bestehender APT-Greeting-/Boarding-Ablauf; kein Bush-Pickup-Departure-Trigger und kein zusätzliches Abflugereignis |
| Anflug | Pickup-Platz wird bis Rückflugfreigabe als Ankunft unterdrückt; Heimat ist Rückflugziel | Heimat von Anfang an einziges Flugziel; regulärer APT-Anflugtrigger und vorhandener Landekandidaten-Fallback |
| Nach Landung | Rückflug-/Pickup-Kontext plus tatsächliches Flugfeedback | Bestehender Landing-Roll-Trigger, tatsächliches Flugfeedback und ein Gedanke zum Erlebnis |
| Abschied | Aufenthalt abrunden, Pickup-Reise beenden | Gemeinsame Reise abrunden; Unload/Signatur/Farewell/Deboarding behalten ihre Reihenfolge |
| Abbruch/End-Lock | Bestehende Voice-Abbruchregeln | Dieselben APT-Regeln; kein neuer Timer und keine eigene Queue |

Die Übernahme betrifft die Erzählkontinuität des Rückflugs. Der zusätzliche
Bush-Departure-Trigger bleibt an sein Pickup-Rezept gebunden. Für normale APT-
Missionen wird kein zweiter, konkurrierender Startdialog eingeführt. Die vier
zuletzt gesprochenen Texte ergänzen beim laufenden Flug den Rückblick, damit
Folgeansagen daran anschließen. Nach Reload bleibt der persistierte Erlebnis-
rückblick erhalten; der lokale Wortlautpuffer ist kein geräteübergreifendes
Voice-Transkript. Bestehende Playback-/Epoch-/End-Lock-Regeln bleiben maßgeblich.

Die Stimmauswahl hing bisher an Name, Rolle, Rollenprofil und Task-Domain.
`voiceIdentity` hält den ursprünglichen Hash-Input fest: Der Wechsel zu
`private_return` verändert weder Gemini- noch OpenAI-Stimmpoolrotation. Eine
providerseitig nicht verfügbare Stimme kann weiterhin den bestehenden Fallback
verwenden.

## Speicherung und Kosten

Pending-Anfragen verwenden `ga_followup_requests_v1` und den vorhandenen Cloud-
Sync (20 Pending, insgesamt bis 36, unter Uploaddruck weniger). Die aktive
Heimreise speichert den Rückblick im eigenen Vertrag und Passenger-Kontext.
Lokale und Cloud-Kompaktierung behalten `privateReturn`; die vollständigen alten
Briefings werden dafür nicht archiviert. Der Hinflugvertrag `privateOuting`
bleibt ebenfalls bei starker Kompaktierung erhalten. Private Entwurfshistory
und Abschlussbeleg bleiben getrennt; die Heimreise wird nicht als weitere
Ausflugsidee in dieselbe Varianzliste geschrieben.

Das Angebot selbst benötigt keinen KI-Aufruf. Die ausgewählte Heimreise benötigt
einen Return-Writer-Aufruf, keine freie Ideenfindung und keine erneute Ortsrecherche.
Der technische Planner, aktuelle Wetterabrufe, Szenenplanung und bestehende
Voice-/TTS-Aufrufe beziehungsweise Provider-Fallbacks sind davon getrennt zu zählen.

## Validierung

- 50 lokale Tests für private Erzeugung, Picker, Return, Ortskontext und Wetter.
  Return-Nachweise umfassen Abschluss-/Zielprüfung, Entwurf/Fehler/Abbruch,
  deduplizierte und abgelehnte Anfragen, Cloud-Transport, falschen Start,
  feste Begleitung/Gepäck, gemeinsame Recap-/Voice-Grundlage, originale
  Stimmzuordnung einschließlich Speaker-Snapshots, Task-Domain und Arrival.
- Vollständiger Dispatcher-Dryrun: private Hinflugidee generieren, kontrollierten
  Abschluss als Fixture einspeisen, über `missionFollowupAcceptRequest` die
  Heimreise erzeugen, danach normale APT-Annahme und bestehende Ablaufprüfungen.
  Feste Route und Person, kein Bush-Rezept, keine neue Ausflugsidee, ein
  Return-Writer-Aufruf. Kein simulierter Echtflug als Nachweis ausgegeben.
- Bestehende App-/Shared-Core-Differentialtests für Boarding, Anflug und Farewell
  laufen weiter. Der Anflugvergleich umfasst 16 Boden-/Phasen-/Endkombinationen.
- Zusätzlich 34 Tests der Tracker-Boarding-/Voice-Service-Schicht erfolgreich,
  einschließlich Cache, Playback-Leases und verspäteten Antworten.
- Keine bezahlten KI-Aufrufe für diese Umsetzung. Fixture-Texte prüfen Übergaben,
  nicht literarische Qualität. Echte Generierung und Simulator-/Gerätewechsel-
  Durchläufe stehen noch aus.

```sh
node --test tools/mission-private-return.test.cjs
node tools/mission-pipeline-dryrun.mjs --pipeline-v4 --runs=1 --profile=private_outing --base=apt --category=private --private-return --out=private-return-v1-dispatch-dryrun.json
```

## Veröffentlichung

Der Release umfasst den App-Cache `ga-dispatcher-v1760` und Tracker Alpha v404.
Die gemeinsam genutzte `mission-boarding-voice-core.js` ist im neuen Tracker
enthalten. Für gleiche Stimmzuordnung über Web und Tracker ist v404 erforderlich;
der Stable-Kanal und die globale Mindestversion bleiben unverändert.
Simulator- und geräteübergreifende Flugtests stehen noch aus.

## Korrektur nach App-Sim-Test am 14.09.2026 (lokal, noch nicht veröffentlicht)

Der erste Debug-Sim-Durchlauf zeigte eine Lücke des ursprünglichen Nachweises:
Der Auto-/Manual-Sim-Record hatte keine `telemetrySampleCount`; außerdem stoppte
Auto-Sim unmittelbar beim Start des asynchronen Farewells und löschte dabei
Position, Bodenstatus und den Sim-Modus. Die spätere Completion-Prüfung erhielt
somit weder passende Telemetriezähler noch den zuvor erreichten Zielzustand.
Der erste Dispatcher-Test hatte einen fertigen Abschlussbeleg eingespeist und
konnte diese Übergangslücke nicht erkennen.

Auto- und Manual-Sim liefern nun `distanceSource: sim-track`, Trackpunktzahl und
`hasAirborneEvidence`. Auto-Sim berechnet die Strecke aus den aufgezeichneten
Punkten statt aus der Planroute. Private Rückflüge verlangen bei simulierten
Records zusätzlich die erkannte Flugphase. Ein Bodenlauf oder die Planstrecke
allein genügt nicht. Solche Abschlüsse bleiben als `simulated` gekennzeichnet.

Beim Farewell wird die kanonische End-Readiness mit Missions-ID am Flugrecord
festgehalten und bei Runtime-Kompaktierung erhalten. Der spätere Abschluss darf
diesen Nachweis nur für dieselbe Mission verwenden. Der Sim-Kontext bleibt bis
zum bestätigten Abschluss/Reset beziehungsweise expliziten Stop aktiv; Auto-Sim
hält am Ziel, Manual-Sim bewegt sich während Close nicht weiter. Dadurch gibt
es während der Verabschiedung keinen unbeabsichtigten Wechsel zur Tracker-
Authority. Das Angebot entsteht weiterhin erst beim persistierten Abschluss,
nicht bereits beim Abspielen des Farewells.

`tools/mission-sim-close.test.cjs` prüft mit Produktionsfunktionen den Weg vom
Auto-Sim-Record über den Farewell-Start bis zum späteren Completion-Record und
privaten Folgeangebot, auch bei inzwischen fehlender Position. Weitere Fälle
prüfen Missions-ID-Wechsel, Bodenläufe, Planstrecken, Cleanup, doppelte Farewells,
Manual-Sim und die begrenzte Wiedergabediagnose. Keine KI-Aufrufe nötig.

Die Voice-Diagnose führt bis zu zwölf Wiedergabestarts der aktuellen Voice-Epoche
mit Ereignis, Person, Provider, Modell und Stimme auf. Preloads allein zählen
nicht dazu. Ein Playback-Start ist kein Nachweis erfolgreicher Audioausgabe am
Lautsprecher. Der vorliegende Nutzerbericht bestätigt Charon beim Farewell,
enthält aber die Boarding-Stimme nicht; ein damaliger Wechsel bleibt ungeklärt.
Auch direkte Ansagen verwenden jetzt den gemeinsamen Speaker-Snapshot inklusive
privater Return-Identität. Keine neue Stimme und kein zusätzlicher TTS-Aufruf.

## Explizite Debug-Heimreise (lokal, noch nicht veröffentlicht)

Im Debug-Menü unterstützt „Mission beenden“ jetzt auch `private_outing` und heißt
für dieses Profil „Heimreise testen“. `debugCompleteCurrentMission` ruft den
separaten `MissionPrivateReturnCore.debugRequest` auf. Der normale `request`-Pfad
verlangt weiterhin bestätigte Flugevidenz; ein Debug-Flag schaltet diese Prüfung
nicht aus.

Testangebote haben einen eigenen deterministischen Key, `debugGenerated: true`,
`privateReturn.debugCompletion: true` und eine sichtbare Debug-Beschriftung.
Sie sind sofort fällig, werden regulär gespeichert/synchronisiert und können
nicht durch mehrfaches Klicken vervielfacht werden. Ein späterer echter Abschluss
hat einen anderen Request-Key. Der Debug-Einstieg schreibt weder Logbuch noch
letzten Landeort und markiert die aktuelle Mission nicht als geflogen.

Nur bei dieser markierten Testfortsetzung darf die Planung am ursprünglichen
Ausflugsziel beginnen, obwohl der zuletzt bestätigte Landeort anders lautet.
Start-/Zielvertrag und normale Boarding-/Runtime-Gates gelten weiterhin; es
findet keine Teleportation des Simulatorflugzeugs statt. Der Return-Contract
behält die Debug-Herkunft durch Writer, Voice und Sync. Eine Return-Mission ist
selbst kein Auslöser weiterer privater Heimreisen.

## Dispatch-Validierung am 14.09.2026 (lokal)

Der gemeldete Dispatch-Abbruch trat nach erfolgreichen HTTP-Antworten auf.
Der damalige Report enthält weder die abgelehnte Antwort noch das betroffene
Feld; die genaue Ursache dieses Einzelfalls ist deshalb nicht nachweisbar.
Der Return-Validator akzeptiert jetzt wie V6 auch den exakten Namen der
Begleitung als Sprecheralias. Andere Sprecher bleiben ungültig. Der Prompt
beschreibt die bestehende Flugwertsyntax vollständig, insbesondere das Verbot
wörtlicher Ziffern außerhalb der Wertreferenzen. Die Wetterprüfung bleibt streng.
`validateProse` liefert feldbezogene Fehler; Dispatch und Debug-Bericht zeigen
sie auch dann, wenn die aktive Mission noch der Hinflug ist. Gespeichert wird
im Arbeitsspeicher nur der letzte Prüfstatus, Zeitpunkt und Quellmissions-ID,
kein API-Key oder vollständiger Prompt. Das Angebot bleibt bei Ablehnung offen.
Keine automatische kostenpflichtige Reparaturgenerierung und kein Textbaustein.

## Return-Writer-Prompt V1.1: Perspektive nach Feld (lokal)

Der erste erfolgreiche Gerätetest erzählte als Pilot in Wir-Form und sprach
Jochen direkt an. Der bisherige Prompt definierte den Spieler, aber nicht die
Erzählerrolle der einzelnen Ausgabefelder. V1.1 legt deshalb die Feldrollen fest:
`story` und `flightBriefing` haben einen außenstehenden Erzähler mit Du-/Ihr-
Ansprache des Spielers; über die Begleitung wird erzählt. `experienceRecap`
beschreibt Pilot und Begleitung in dritter Person. Nur `greeting.text` ist direkte
Rede der Begleitung. So wird die Voice-Perspektive nicht zur Briefing-Perspektive.
Keine Pronomenersetzung, neue Textschablone oder semantische Regex-Prüfung.

Der Wetterabsatz beschreibt fehlende Messwerte als offene Prüfung vor dem Start,
nicht als Begründung einer Flugentscheidung. Fehlende Böenangaben belegen keine
Böenfreiheit; fiktionale Story und Wetterbeurteilung sind getrennt. Das sind
Promptvorgaben, keine garantierte semantische Validierung der KI-Antwort.
Promptrevision und API-Promptkennung folgen `MissionPrivateReturnCore.REVISION`.
Bestehende gespeicherte Briefings werden nicht nachträglich umgeschrieben.

## Return V1.2: Konkreter Gesprächsstoff (15.09.2026, lokal)

Der Voice-Test verwendete noch das gespeicherte Briefing vom Vorabend. Die
Ansagen wiederholten Ruhe/Gelassenheit; die protokollierten Wiedergaben nutzten
durchgehend Charon. Der bereits vorhandene Puffer der letzten vier ausgegebenen
Texte allein sicherte keine inhaltliche Abwechslung. Die Phasenhinweise betonten
zudem den Ausklang stärker als konkreten Gesprächsstoff.

V1.2 fordert im bestehenden `experienceRecap.moments` zwei bis drei unterschiedliche
kleine Begebenheiten mit persönlicher Reaktion. Die bisherigen Speichergrenzen
bleiben erhalten; ältere Verträge mit nur einem Moment bleiben gültig. Das
Briefing greift einen Teil auf, ohne alle Erinnerungen vorwegzunehmen. Die Voice
darf passende persönliche Details weitererzählen und ergänzt dabei den bereits
bekannten Aufenthalt. Sie erhält weiter den Rückblick und die letzten vier
lokal ausgegebenen Texte; diese sind Kontext, kein Nachweis hörbarer Wiedergabe.
Ein neuer Beitrag soll neuen Inhalt hinzufügen, statt dieselbe Stimmung neu
zu formulieren. Flugfeedback und die Kürze der jeweiligen Phase haben Vorrang.

Auch ältere knappe Rückblicke dürfen persönlich ausgeschmückt werden. Bestehende
Begebenheiten bleiben verbindlich; neue reale Ortsfakten oder Flugereignisse
werden daraus nicht abgeleitet. Keine zusätzliche Ansage, kein zusätzlicher
KI-Aufruf, keine Aktivitätsschablone oder feste Rotation. Der Wortlautpuffer bleibt
lokal und wird durch Reload nicht als vollständiges Gespräch wiederhergestellt.
Die Wirkung auf frei generierte Texte muss im nächsten Voice-Durchlauf geprüft
werden; lokale Tests prüfen Übergaben und Grenzen, nicht Erzählqualität.

## Zusätzliche Erzählung nach dem Start (15.09.2026, lokal)

Auf Nutzerwunsch hat Private Return jetzt einen eigenen Abflug-Erzähltrigger.
Der zuvor dokumentierte Verzicht auf eine zusätzliche Abflugansage ist damit
überholt. Der Bush-Pickup-Trigger bleibt unverändert. Im aktiven APT-Lauf prüft
`missionMaybeTriggerPrivateReturnDepartureVoice` mindestens 60 Sekunden erkannte
Flugphase und mindestens 500 ft AGL. Bodenstatus, Pause/Sim-Menü und Runtime-Reset
setzen die noch nicht abgeschlossene Wartephase zurück. Fehlende AGL genügt nicht.
Der Trigger merkt pro Missions-ID genau eine eingereihte Ansage. Die Voice lehnt
sie bei deaktivierter Stimme, fehlendem Pax, Ankunft oder Missionsende ab und
verwendet die vorhandene Queue samt Epoch-/End-Lock-Schutz. Keine neue Flugphase.

Die zwei bis vier Sätze erzählen eine weitere persönliche Begebenheit aus dem
Aufenthalt, mit Rückblick und bisher ausgegebenen Texten als Kontext. Dies kostet
höchstens einen zusätzlichen Text-/TTS-Vorgang je Lauf (Provider-Fallbacks wie
bisher). Es ist keine periodische Unterhaltung. Nach vollständigem Runtime-
Reset kann ein neuer Testlauf erneut erzählen; das Merkerfeld ist nicht persistent.

## Rückflugangebot als Vorschau (15.09.2026, nach v1761 lokal)

Die Überschrift nennt Besuchs- und Heimatplatz als „Rückflug von … nach …“.
Der Hinflug-Writer liefert optional `returnOfferText` (maximal 350 Zeichen):
einen kurzen Rückblick auf Begleitung, Ort und Zweck plus Überleitung zur
Heimreise. Er wird im privaten Vertrag mitgeführt und erst beim Folgeangebot
angezeigt. Er ist weder geflogene History noch ein Erlebnisnachweis. Der normale
Abschlussnachweis bleibt notwendig; Debug bleibt separat im Untertitel markiert.
Kein zusätzlicher KI-Aufruf. Alte Angebote ohne vorbereiteten Text verwenden
einen kurzen allgemeinen Rückblick mit dem Namen; ihre Überschrift wird beim
Rendern ebenfalls aus beiden Flugplätzen gebildet. Keine Prosa-Zeitformkonvertierung.

## Return V1.3: Optionale Erinnerungen blockieren Dispatch nicht (lokal)

Der Bericht vom 15.09., 07:59 weist ausschließlich `experienceRecap.moments:invalid`
aus. Die genaue Unterursache ist im damaligen Bericht nicht enthalten.
`moments` ist nun ergänzender Gesprächsstoff: maximal drei nichtleere Strings
bis je 240 Zeichen werden unverändert übernommen; ungültige oder überzählige
Einträge verworfen. Es gibt weder Textabschneidung noch erfundene Ersatzanekdoten.
Die verpflichtende Zusammenfassung, Reaktion, Briefing-/Sprecherstruktur und
Flugwertprüfung bleiben unverändert. Ohne brauchbare Einzelmomente nutzt Voice
den vorhandenen Rückblick und die bereits erlaubte persönliche Ausschmückung.
Der letzte Prüfstatus enthält Warnung sowie Typ, Anzahl und Längen der Einträge,
keine vollständigen Antworten oder Zugangsdaten. Keine Reparatur-API-Anfrage.

## Veröffentlichung v1762

Die Rückflugvorschau und die tolerante Prüfung optionaler Erinnerungen (V1.3)
sind mit App-Cache v1762 auf Origin veröffentlicht. Tracker bleibt v404.
