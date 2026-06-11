THANOS VIRTUAL SNIFFER
======================

Ziel
----
DRSM soll auf einen virtuellen COM-Port senden, als waere dort ein Thanos AMC.
Dieses Tool liest die andere Seite des virtuellen COM-Paares und schreibt mit:

- wann Datenpakete/Chunks ankommen
- wie gross die Pakete sind
- ob die Abstaende eher 2 ms, 10 ms oder 20 ms sind
- rohe Bytes fuer spaetere Analyse


Wichtig
-------
Eine normale EXE kann unter Windows keinen echten COM-Port erzeugen.
Dafuer braucht man einen Virtual-COM-Pair-Treiber.

Moegliche Loesungen:
- com0com / Null-modem emulator
- Eltima Virtual Serial Port Driver
- andere virtuelle Nullmodem-Treiber

Beispiel:
Virtuelles Paar erstellen:
COM43 <--> COM44

Dann:
- DRSM Thanos Output auf COM43 stellen
- Dieses Tool auf COM44 stellen

Wenn nichts ankommt, die Seiten tauschen.


Sink Mode
---------
Datei:
01 Start Sink Mode COM32.bat

DRSM sendet an den virtuellen Port.
Das Tool liest die Daten, leitet sie aber NICHT an den echten Thanos weiter.
Das Rig sollte sich dabei nicht bewegen.

Gut fuer:
- reine Output-Timing-Messung
- ungefaehrlichere Diagnose

Falls DRSM den Controller als offline ansieht oder auf Rueckmeldungen wartet,
kann Sink Mode eventuell nicht funktionieren.


Proxy Mode
----------
Datei:
02 Start Proxy Mode COM32 zu echtem Thanos.bat

DRSM sendet an den virtuellen Port.
Das Tool liest und protokolliert die Daten.
Dann leitet es sie an den echten Thanos-COM-Port weiter.
Rueckdaten vom Thanos werden ebenfalls zurueckgeleitet.

WARNUNG:
Das Rig kann sich bewegen.
Nur mit geringer Intensitaet und sicherer Situation testen.


BAT-Dateien anpassen
--------------------
Die BAT-Dateien im Editor oeffnen und diese Werte anpassen:

LISTEN_COM
  Die Seite des virtuellen COM-Paares, auf die das Tool hoert.

REAL_THANOS_COM
  Nur Proxy Mode: echter COM-Port des Thanos Controllers.

BAUD
  Muss zur DRSM/Thanos-Einstellung passen.
  Wenn unsicher: mit dem Wert anfangen, der in DRSM fuer den Output steht.

DURATION
  Testdauer in Sekunden.


Ausgabe
-------
Nach jedem Lauf entsteht ein Ordner:
thanos-sniff-YYYYMMDD-HHMMSS

Darin:
- summary.txt
- chunks.csv
- to-controller.raw
- from-controller.raw (nur Proxy Mode sinnvoll)

Bitte zur Auswertung den ganzen Ordner schicken.


Grenze der Analyse
------------------
Der Thanos-Output enthaelt normalerweise Zielpositionen fuer Aktuatoren,
nicht direkt Pitch/Roll.

Wir koennen damit sehr gut sehen:
- kommen Pakete wirklich alle 2 ms?
- kommen sie eher alle 10/20 ms?
- gibt es Aussetzer oder Bursts?
- sind Aktuator-Zielwerte treppenfoermig?

Direkte Pitch/Roll-Werte sieht man hier nur, wenn DRSM sie auch wirklich im
Thanos-Protokoll sendet. Normalerweise sind sie aber bereits in Aktuatorwege
umgerechnet.
