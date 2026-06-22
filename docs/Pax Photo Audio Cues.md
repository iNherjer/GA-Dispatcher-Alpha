# Pax Photo Audio Cues

Diese Regel beschreibt den gemeinsamen Einsatz von `foto.mp3` fuer Missionen, in denen ein PAX oder Operator tatsaechlich Fotos, Videos oder Bildserien aufnimmt.

## Grundregel

- `foto.mp3` ist ein Kamera-/Fotoeffekt, kein generischer Erfolgs- oder Warnsound.
- Der Effekt darf bei `infra_chain_recon`, `mapping_survey`, `media_photo`, `news_coverage`, Sightseeing-Fotoauftraegen und vergleichbaren Missionen genutzt werden, wenn die Story eine aktive Aufnahme plausibel macht.
- Der Effekt soll um ein fachliches Voice-Event herum liegen, zum Beispiel `point_complete`, `survey_area_entered`, `line_complete` oder eine Bildserien-Meldung.
- Nicht bei jedem Tick spielen. Ein Missionsereignis triggert genau eine kurze Foto-Sequenz.

## Timing

- Die Sequenz wird deterministisch randomisiert, damit derselbe Missionsstand stabil bleibt, aber Missionen nicht identisch klingen.
- Vor dem PAX-Text sind 0-2 Fotos sinnvoll, meist sehr kurz vor der Ansage.
- Nach dem PAX-Text sind 1-5 Fotos sinnvoll.
- Der Abstand zwischen einzelnen Fotos liegt normalerweise zwischen 1 und 10 Sekunden.
- Die Sequenz muss abbrechen, wenn sich die Mission-Epoch aendert oder die Mission endet.

## Umsetzung

- Neue Missionstypen sollen den vorhandenen Foto-Burst-Pfad wiederverwenden, nicht eigene Timer duplizieren.
- In `passenger-voice.js` ist das Muster `_paxPlayPhotoBurst(...)` plus `beforeAudio`/`afterAudio`.
- TTS darf nicht vom Fotoeffekt ueberdeckt werden. Der Effekt wird leise als kurzer Audioeffekt gespielt und die Voice bleibt das fuehrende Ereignis.
- `foto.mp3` muss in `sw.js` statisch gecacht werden; bei Aenderungen am Webapp-Shell-Umfang Cache-Version anheben.

## Textvarianten

- Wiederkehrende generische Eventtexte sollten als 2-3 Varianten vorbereitet und wiederverwendet werden.
- Dynamische Befundtexte, die einen konkreten Punkt, ein konkretes Objekt oder eine spaetere Follow-up-Entscheidung nennen, duerfen weiter per TTS erzeugt werden.
- Wenn feste Audio-Clips fuer wiederkehrende Ketten-/Survey-Ereignisse generiert werden, sollen sie ueber denselben Catalog-Mechanismus laufen wie die vorhandenen Mapping-/Survey-Clips.
