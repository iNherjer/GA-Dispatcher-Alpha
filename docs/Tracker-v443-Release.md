# Tracker v443 Alpha – Trainingsfuehrung

POI-Training zeigt in App bei Tracker-Autoritaet und im EFB einen dauerhaften,
verschiebbaren Aufgabenplan: nummerierte Schritte, gruene Erfolge, rote
Abweichungen und Winkel-/Haltefortschritt. Anweisungen koennen erneut vorgelesen
und im Verlauf nachgelesen werden.

Tracker-Coaching fixiert die angekuendigten Sollwerte, nimmt ungueltige
Startfreigaben zurueck und zaehlt nur kontinuierlich gueltige Haltezeit.
Ausleiten erfordert auch passende Hoehe. Festgefahrene Phasen, anhaltende
Abweichungen und Messluecken verlangen einen neuen Durchgang; bestaetigte
Uebungen bleiben erhalten. Phasenansagen haben Vorrang und veraltete Audioeffekte
werden verworfen. Original-Standalone-Prozedur unveraendert.

Alle Entscheidungen bleiben im Missionsprozess, getrennt von Telemetrie und UI.
Dynamische Anweisungen verwenden TTS mit echten Sollwerten; ohne TTS-Konfiguration
bleiben Aufgaben und Verlauf lesbar. Lokale Banner-Aktualisierung erzeugt keine
zusaetzlichen Cloud-Speicher-Writes.

Validierung: 683/684 Tests der Gesamtsuite bestanden. Der bestehende zeitabhaengige
Navigationston-Test scheiterte unter paralleler Last, bestand aber isoliert (2/2).
Die abschliessenden gezielten Trainings-/Audio-/EFB-Tests bestanden (39/39),
einschliesslich Wiederholungs-Intent durch die Authority, fester Referenzwerte,
Haltezeit, falscher Hoehe beim Ausleiten und veralteter Audioeffekte.
Original-Generatorchecks bestanden. Banner bei EFB-Groesse in Chrome visuell
geprueft. Reales Windows-/MSFS-Flugverhalten bleibt im Alpha-Feldtest zu pruefen.
