# Tracker / Standalone parity audit — 2026-09-08

Status: keine vollstaendige Ablaufparitaet bestaetigt. Die vorangegangenen 317
Tests und 12 Layoutvergleiche deckten nicht alle Standalone-Aktionen/Trigger ab.
Die Standalone-Missionsfunktionen bleiben Referenz und werden nicht angepasst.

## Ausgangsbefund (Korrekturen siehe Fortsetzungen unten)

1. **Manuelle PAX-Interaktionen fehlen.** Standalone verwendet
   `mission_scene_manual_pax` fuer Aussteigen und Wiedereinsteigen, mit
   `doorOpenWaitMs: 2000`, `doorCloseWaitMs: 1000` und 70-s-Rollback.
   `tracker-mission-execution-adapter.js` akzeptiert bei
   `request_pax_interaction` nur `deboard`; der Core erlaubt dieses Ereignis
   nur am Missionsende. `mission-apt-ui-core.js` sperrt PAX im Ladefenster.
   Vollstaendige manuelle Animationen und Wiederaufnahme sind damit nicht
   migriert. Nicht mit dem bereits angeglichenen finalen Farewell verwechseln.

2. **Weitere Voice-Trigger fehlen.** `_runLiveMissionTriggerTick` steigt bei
   Tracker-Authority aus. Standalone ruft ueber `checkPaxPoiProximity` u.a.
   `_maybePaxComfortFeedback` und `_maybeWrongStartContinue` auf; dafuer gibt
   es keine entsprechenden zentralen Runtime-Trigger. Der neue Standard-APT-
   Anflugtrigger deckt diese Ansagen nicht ab. Training/POI sind ebenfalls
   nicht durch diesen Standard-APT-Trigger abgedeckt und duerfen nicht als
   migriert betrachtet werden.

3. **4-NM-Trigger hat zusaetzliche Bedingungen.** Die Tracker-Runtime verlangt
   `onGround === false`, Phase `enroute` und geladenen PAX. Der Standalone-
   Standard-APT-Trigger verlangt im aktiven Missionslauf Zielnaehe und seine
   Voice-Guards, aber nicht dieselben Phase-/Bodenzustandsbedingungen. Gleicher
   Prompt und Radius beweisen deshalb noch keine gleiche Ausloesung.

4. **Cargo-Effekte sind nicht identisch.** Standalone verwendet pro Objekt
   eine 180-ms-Queue mit Sollzustand und `objectRevision`. Der Tracker bildet
   einzelne persistierte Effects ohne diesen gleichen Sollzustandsabgleich.
   Fuer Bordbestand verwendet Standalone
   `aircraft-equipment:<aircraftSlot>:<itemId>`, der Tracker dagegen
   `aircraft-equipment:tracker:<itemId>`. Die Sim-Objektauswahl priorisiert
   `objectKeys` vor Item-IDs; vorhandener Bordbestand kann deshalb beim
   Entfernen verfehlt werden. Spawn-Offsets verwenden grundsaetzlich dieselbe
   Cargo-Platzierung, aber das belegt keine volle Lebenszyklusparitaet.

5. **Cargo-Audiocues fehlen im zentralen Item-Pfad.** Der Tracker-Zweig von
   `missionCargoLoadItem` kehrt nach dem Intent zurueck. Standalone spielt
   danach `_missionCargoPlayAudioCue` fuer Laden/Pickup/Wiederladen. Der
   zentrale Cargo-Simulator-Effekt dispatcht Spawn/Remove, aber keinen
   entsprechenden Audioeffekt. Funktionierendes Boarding-TTS ersetzt diese
   Item-Sounds nicht.

6. **Signaturanimation nicht einheitlich getaktet.** Der EFB-Klickhandler setzt
   nach erfolgreicher Antwort einen neuen lokalen 1600-ms-Timer; andere
   Geraete erhalten die zentrale Signaturzeit. Der EFB-Markup-Renderer setzt
   `is-animating` anhand des lokalen Timers. Eine remote ausgeloeste Signatur
   hat damit nicht automatisch dieselbe sichtbare Animation/Restzeit.

## In dieser Pruefung korrigiert

Der EFB-Verlade-Clickhandler uebernahm Item-ID und Action nur noch fuer
`set_manifest_item`. Dadurch fehlten bei `set_boardbook_time` die Zeitart
(z.B. landing) und bei `replace_equipment` die Item-ID. Die Uebernahme gilt
wieder fuer alle Item-Aktionen. Regression fuehrt den wirklichen EFB-Handler
mit Bordbuch- und Erneuerungsbuttons aus. 30 EFB-/Adaptertests sowie der
Interface-Selftest sind gruen.

Die fachliche Bordbucheintragung nutzt auf beiden Seiten bereits
`mission-manifest-core` (planBoardBookEntry / commitMetadataTransition) und
aufgezeichnete Flugereignisse. Das ist eine gute gemeinsame Grundlage, aber
noch kein vollstaendiger geraeteuebergreifender Trigger-/Zeitvergleich.

## Naechster Paritaetsnachweis

Gleiche Ereignisspur gegen unveraenderte Standalone-Funktionen und zentrale
Tracker-Runtime abspielen: Mission starten/Bordbuch, PAX manuell aus/ein,
Cargo laden/ausladen/wiederladen, schnelle Gegenaktionen, Anflug/Komfort,
Landung/Signatur/Farewell. Manifest, Objektidentitaeten, Sim-Kommandos,
Audioereignisse, Gates und logische Wartezeiten vergleichen. Danach dieselben
Intents aus App, EFB und zweiter App testen. Reale Bewegung und Audioausgabe
in MSFS/Coherent sind weiterhin nur durch einen In-Sim-Test bestaetigbar.

## Fortsetzung: Standard-A–B, weitere gezielte Angleichung

Die Punkte 3 und 6 sowie der Objektschluessel-Teil von Punkt 4 sind korrigiert:

- Standard-Anflug benoetigt keine Phase `enroute`, keinen expliziten
  Luftzustand und keinen geladenen Manifest-PAX mehr. Der eingefrorene
  Passenger-Kontext entscheidet, ob die Ansage vorhanden ist. Aktiver Lauf,
  Duplikatschutz und Abschluss-Guards bleiben erhalten. Auch der 2-s-Callback
  wird nicht allein wegen einer zwischenzeitlichen Landung verworfen.
- Cargo-Effects transportieren den Flugzeugslot aus dem Manifest. Der
  Simulator-Adapter normalisiert ihn wie `_missionCargoAircraftSlot` und
  verwendet dieselben stabilen Equipment-Schluessel fuer Spawn und Remove.
- EFB-Signaturen verwenden den zentralen Zeitstempel. Remote-Signaturen und
  spaetes Oeffnen verwenden die Restzeit; Neurendern setzt den CSS-Fortschritt
  ueber einen negativen Animations-Delay fort. Der Tracker liefert den mit
  denselben UI-Regeln berechneten Zustand nach Ablauf mit, sodass die
  Schaltflaechen auch ohne weiteren Poll nach 1600 ms freigegeben werden.

Nachweise: 16 Kombinationen der echten Standalone-Anflug-Guards gegen den
Core; Runtime-Trigger sowohl am Boden als auch in der Luft; 24 Kombinationen
von Standalone-Cargo-Schluesseln gegen Core und Simulator-Bridge; wirklicher
EFB-Renderer mit remote gesetzter Signatur und ausbleibenden Folgepolls.
Die 12 bestehenden Fenstervergleiche sind weiterhin identisch. Diese
Nachweise schliessen die weiterhin offenen Punkte 1, 2, 5 und die
180-ms-Sollzustandsqueue aus Punkt 4 ausdruecklich nicht ein.

## Fortsetzung: manuelle PAX, Flugansagen und Cargo-Lebenszyklus

Die offenen Standard-A–B-Pfade aus Punkten 1, 2, 4 und 5 sind jetzt angebunden:

- Manuelles Aus-/Einsteigen nutzt aus den unveraenderten Standalone-Helfern
  abgeleitete Sim-Kommandos, einschliesslich Tueroeffnungswartezeit 2000 ms,
  Tuerschliesswartezeit 1000 ms, sofortigem Manifestwechsel und 70-s-Rollback.
  Ein Fehler setzt nur die betroffene Position zurueck; eine bereits
  ungueltig gewordene Unterschrift wird nicht wiederhergestellt. Der laufende
  Vorgang sperrt Folgeaktionen auf allen Interfaces. Auch nach Sim-Trennung
  bleibt der Rollback-Timer aktiv.
- Cargo-Objekte erhalten eine unabhaengige 180-ms-Queue pro Objektschluessel.
  Schnelle Gegenaktionen ersetzen den wartenden Sollzustand; Revisionen
  bleiben monoton und werden im privaten Runtime-Kontext gespeichert.
  Position, Asset-Kandidaten und Equipment-Slot kommen aus dem Aktionskontext.
- Cargo-/PAX-Cues verwenden originale Cue-Auswahl, Gain und Variantenseeds.
  Wartende Cargo-Sounds werden wie in Standalone zusammengefasst. Cue-only
  Jobs benoetigen weder Textgenerierung noch einen TTS-API-Key und verwenden
  denselben geraeteuebergreifenden Playback-Lease wie Ansagen.
- Komfort, Fortsetzung nach falschem Start, falscher Landeplatz, Landing-Roll
  bei entsprechendem Ankunftsplan und Pflichtfrachtabwurf verwenden kopierte
  Originalfunktionen aus passenger-voice.js. Der Generator prueft gegen die
  unveraenderte Quelle; Wartezeiten, Schwellen und Cooldowns sind uebernommen.
  Detektorzustand und bereits erzeugte Effekte verhindern Wiederholungen beim
  Tracker-Neustart. Der Adapter transportiert jetzt auch die zuvor verworfenen
  Payloads von Anflug- und Flugansage-Systemereignissen.

Nachweise: 336 Tracker-/Core-Tests, Originalfunktionsvergleiche fuer manuelle
PAX, 21 Audio-Szenarien und 24 Cargo-Objektschluessel; 18 identische
Fenstervergleiche einschliesslich PAX-Aus-/Einsteigen auf Desktop, EFB und
Smartphone. Der Standalone-Ausfuehrungspfad wurde nicht veraendert.

Auch der zusaetzliche Standalone-Anflugfallback ist nun zentral angebunden:
Beim erstmaligen Low-Speed-Landekandidaten (bis 4,5 NM, gs < 18,
AGL < 140, aktiver Recorder und vorherige Airborne-Phase) wird derselbe
Anflugeffekt wie beim 4-NM-Standardtrigger angefordert. Die vorhandenen
Voice-Ende-Guards, 2 Sekunden Vorlauf und Duplikatsperre gelten gemeinsam.
Fortdauernde niedrige Geschwindigkeit loest beim spaeteren Einflug in den
Radius keinen neuen Fallback aus; Beschleunigen und erneutes Abbremsen
erzeugen dagegen einen neuen Kandidaten. Pause/Menu verbrauchen ihn nicht.
12 neue Ereignisspuren vergleichen den zentralen Ablauf gegen den echten
Standalone-Fallbackzweig, einschliesslich Grenzen und Wiederholungen.

Noch kein vollstaendiger Paritaetsbeweis: Training-/POI-Sondertrigger sind
nicht Teil dieser Standard-A–B-Angleichung. Tatsaechliche Sim-Animationen,
Audioausgabe und gleichzeitige Geraetenutzung brauchen einen neuen In-Sim-Lauf.

## Erneuter Ablauf- und Karten-UI-Audit nach dem 4,5-NM-Fix

Ausgangsbefunde dieses Audits (Umsetzung und Praezisierung unten):

1. **Audiovergabe ueber mehrere Geraete ist nur pro Job exklusiv.**
   `tracker-voice-service.js:getNextPlayback/claimPlayback` sperrt nur den
   bereits beanspruchten Job. Ein zweiter bereiter Job wird einem anderen
   Client angeboten. Lokaler Repro mit zwei Cue-Jobs: EFB claimt A, danach
   wird B angeboten und vom Smartphone erfolgreich geclaimt. Damit ist die
   Reihenfolge eines einzelnen Standalone-Players nicht sichergestellt.
2. **Anflug-/Landing-Roll-Abbruch waehrend Text-/Audiogenerierung fehlt.**
   `tracker-mission-boarding-voice.js` prueft das Missionsende nach dem
   Vorlauf, aber nicht erneut nach `voiceService.wait` oder vor Playback.
   Standalone prueft `cancelWhenMissionEnd` mehrfach in `_speakAndShow`.
   Ein inzwischen gestartetes Farewell kann daher eine spaete Anflugantwort
   ueberholen; der alte Job kann anschliessend noch spielbereit werden.
3. **Komfortsperre greift fuer eine wartende Anflugansage zu spaet.**
   Runtime uebergibt `approachDone: !!snapshot.state.voice.approach` und
   verarbeitet Komfort vor dem Anflugtrigger. Der Voice-Outcome entsteht erst
   beim ACK; Standalone setzt `_paxAtTargetDone` schon beim Einreihen vor
   dem 2-s-Timer. Der persistierte angeforderte Anflugeffekt muss bereits
   dieselbe Sperre begruenden. Gleiche kopierte Funktion allein reicht nicht.
4. **Falscher Landeplatz: Aufrufhaeufigkeit weicht ab.** Standalone prueft
   den Hinweis bei groundStill fortlaufend mit vorheriger Airborne-Phase und
   90-s-Guard. Tracker ruft ihn nur beim akzeptierten `GROUND_STILL`-Ereignis
   auf. Fortgesetztes Stehen liefert `noop`; der Hinweis wird nach dem
   Cooldown nicht erneut geprueft. Der Aufrufer verwendet zudem nicht
   denselben Flight-Recorder-Nachweis wie Standalone.
5. **Falscher Startort bei frischem Boarding nicht zuverlaessig erkennbar.**
   Boarding-Voice liest ausschliesslich privaten Runtime-`latestTelemetry`.
   Der Adapter kehrt vor `flags.started` vor dem Schreiben dieser Werte
   zurueck. Fuer einen frischen Run fehlt beim Boarding damit die aktuelle
   Position; Standalone bekommt sie fuer die Begruessung direkt. Danach kann
   auch die daran gekoppelte Wrong-Start-Fortsetzung fehlen.

UI-Erstvergleich auf Codebasis, noch kein kompletter visueller Kartentest:

- Missionsbanner: EFB-CSS erzwingt 620 px / 24 px Rand statt Standalone
  560 px / 32 px. Bei wartendem Intent ersetzt der EFB-Renderer den Inhalt
  durch eigene Tracker-/Wartetexte. Aeltere Payloads ohne kanonisches UI
  verwenden ausserdem eine eigene Bannertext-Fallbacklogik.
- Telemetriefenster: EFB erzwingt 25 px rechten Innenabstand, deckenderen
  Hintergrund und entfernt Blur; eigene Close-Controls veraendern den Platz.
- Dateninhalt: EFB setzt `teleVS` fest auf `--`; Standalone berechnet und
  faerbt die Steigrate. `currentPosRef` zeigt im EFB Koordinaten/Hoehe statt
  Standalone-Distanz/Richtung/Ortsreferenz. Das ist auch Daten-/Darstellungslogik,
  nicht allein CSS. Die ALT-Zeile ist trotz historischer ID `teleAGL` mit ALT
  beschriftet und wurde hier nicht faelschlich als AGL-Verwechslung gewertet.

Empfohlene Reihenfolge: zentrale Audio-Reihenfolge und Abbruch, anschliessend
Trigger-Anbindung einschliesslich Boarding-Position; danach Kartenbanner und
alle drei Telemetriefenster anhand gleicher Daten/Viewportgroessen vergleichen.
Die bisherigen 18 Fenstervergleiche pruefen den Verlade-Manager, nicht die
gesamte Kartenoberflaeche. Die 348 bestandenen Tests widerlegen diese neuen
Abweichungen nicht; dafuer fehlen bislang die entsprechenden Ereignisspuren.


## Umsetzung des erneuten Audits

- Playback wird jetzt serviceweit exklusiv vergeben, auch bei verschiedenen
  Job-IDs und Clients. Wartende Jobs werden waehrend einer belegten Ausgabe
  nicht als unbeansprucht verworfen (begrenzte Gesamtwartezeit bleibt).
- Anflug-/Landing-Roll-Jobs bleiben waehrend der Generierung deferred.
  Ein Missionsende-Monitor beendet auch eine haengende Generierung logisch;
  erneute Guards vor Aktivierung, Angebot und Claim unterdruecken spaete Jobs.
- Ein angeforderter Anflugeffekt sperrt Komfort sofort, einschliesslich des
  Telemetriepakets, das den normalen oder Low-Speed-Anflug ausloest.
- Wrong-Start-Boarding bekommt die aktuelle Position direkt vom angeschlossenen
  Simulator. Die vor Missionsstart noch leere Recorder-Telemetrie ist damit
  keine Voraussetzung mehr.
- Off-Destination wird auf passenden Boden-Ticks mit Recorder-Flugnachweis
  geprueft, nicht nur beim einmaligen GROUND_STILL-Event. Praezisierung des
  Ausgangsbefunds: Standalone setzt nach stabiler Landung den Recorder zurueck;
  eine endlose Wiederholung alle 90 Sekunden waere gerade NICHT identisch.
  Die Tracker-Pruefung folgt diesem Recorder-Lebenszyklus und dem Cooldown.

Karten-UI: originale Bannerbreite und Texte auch bei wartendem Intent;
originale Telemetrieabstaende/Hintergruende, keine zusaetzlichen Close-Buttons
im Fenster. Ein-/Ausblenden bleibt pro Fenster im Anzeigemenue moeglich.
Der Schriftstandard ist 100 Prozent; explizite gespeicherte Skalierungen
bleiben erhalten. Rueckkehr auf 100 Prozent stellt die originalen responsiven
CSS-Schriftgroessen wieder her. Steigrate wird wie in Standalone aus dem
Hoehenunterschied ueber mehr als eine Sekunde berechnet und eingefaerbt,
GS behaelt eine Nachkommastelle. ALT zeigt MSL mit Originalfarben.
Die App uebertraegt additiv die mit vorhandenen Helfern erzeugte AKTUELL-
Ortsreferenz sowie Wegpunktnamen/Frequenzen; EFB rendert diese und das
Gradzeichen im NEXT-LEG-Fenster. Standalone-Ausfuehrungsfunktionen unveraendert.

Nachweise: 378 Node-Tests inklusive EFB-Map-Shell; Audio-Mehrgeraete-Claim,
Missionsende waehrend Generierung, frischer falscher Boarding-Startort und
Komfort bei angefordertem Anflug. 15 Browservergleiche des echten EFB-
Banner-Renderers gegen Standalone-Bannertexte mit allen drei Telemetriefenstern
bei 1024/800/390 px, einschliesslich Schriftstandard. Vergleich ist auf diese
Kartenkomponenten begrenzt; kein kompletter EFB-In-Sim-Nachweis. Vorhandene
App-Differentialtests und Handoff-/Interface-Regressionen ebenfalls gruen.
