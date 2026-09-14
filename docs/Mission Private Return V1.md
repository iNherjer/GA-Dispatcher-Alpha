# Private Return V1

Stand: 14.09.2026. Release: App-Cache `ga-dispatcher-v1760`, Tracker Alpha v404.

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
Auch der bisherige Debug-Knopf zum künstlichen Abschließen erzeugt daraus keine
private Erlebnisgeschichte. Alte Abschlüsse ohne diesen Nachweis werden nicht
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
