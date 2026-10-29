# Briefing-Umschlag

`envelope.webp` ist die optimierte transparente Laufzeitgrafik (1280 px breit, ca. 100 KB). Erzeugt mit image_gen, danach mit `cwebp -q 84 -alpha_q 100 -m 6 -resize 1280 0` konvertiert. Vorderteil und Klappe nutzen dieselbe Grafik mit einer gemeinsamen SVG-Kantenkontur. Titel und Startadresse bleiben echte HTML-Texte.

## Prompt

Use case: product-mockup. Asset type: photorealistic transparent envelope graphic for vintage civilian aviation mission briefing web UI. ONE complete closed horizontal cream/light buff paper envelope, straight-on orthographic view, width:height 1.65:1. Back face toward viewer with a broad triangular upper flap meeting at the center, visible diagonal folded paper seams; bottom front panel has a broad plain writing area for live HTML title and airport address. Unprinted, NO text, NO stamps, NO logos, no seal, no string, no other objects. Slightly aged matte fibrous paper, subtle scuffs and rubbed edges, fine warm creases, believable thickness at corners. Restrained upper-left soft lighting, gentle material-local fold shadows, no external cast shadow (UI adds it). Exact rectangular silhouette with tiny softly worn rounded corners, straight aligned top/bottom edges. Entire envelope uncropped, minimal transparent margins at most 1% on each side. Genuine alpha transparency outside envelope. Premium tactile realism matching a red leather flight logbook and leather tool roll cockpit UI. Horizontal landscape composition, ample empty lower central paper area.

Titel oben mittig, Startadresse mit Label unten rechts (ICAO und Platzname auf getrennten Zeilen). Seiten bleiben beim Herausziehen bündig; erst nach Freigabe des ganzen Briefings fächern sie mit einer 360-ms-Transition auf. Der Animationsausschnitt lässt Platz für die aufgeklappte Klappe und die Büroklammer.

Der Titel passt seine Schriftgröße und Zeilenaufteilung an die nach unten schmaler werdende Klappe an. Je Zeilenunterkante gilt ein Innenabstand von mindestens 8 px beziehungsweise 2,5 % der Umschlagbreite zur Diagonale. Bei Titel- oder Breitenänderungen wird die Aufteilung neu gemessen.

Im Umschlag ist der Zettelstapel auf 92 % verkleinert und nach unten eingerückt, einschließlich Freiraum für die Klammer. Herausziehen und Größenänderung laufen linear bis 100 %. Beim Schließen werden zuerst die Seiten gebündelt; anschließend laufen Umschlagbewegung, Verkleinerung und Klappenschließen in umgekehrter Reihenfolge.

Die aufgeklappte Verschlusslasche liegt während des Herausziehens hinter dem Papier. Die gerundete V-Kante wird ausschließlich vom opaken Umschlag-Vorderteil verdeckt. Ein rechteckiger Overflow-Ausschnitt begrenzt das Papier knapp innerhalb der opaken Umschlagunterkante und bewegt sich synchron zum Vorderteil; außerhalb der Öffnung bleibt das Briefing unbeschnitten. Geometrie und Seitenverhältnis entsprechen den tatsächlichen 1280 × 776 Pixeln der WebP-Datei.

Während der Animation begrenzt ein eigener Bühnenausschnitt auch den Layout-Überlauf des langen Zettelstapels. Dadurch entstehen keine zusätzlichen Scrollflächen durch verdecktes Papier. Der obere Freiraum bleibt für Klappe und Klammer erhalten; ein stabiler Scrollbar-Gutter verhindert seitliche Breitenwechsel beim Wachsen beziehungsweise Schrumpfen des Briefings.

Der Papier-Viewport verwendet zusätzlich `clip-path: inset(0)` und einen eigenen isolierten Layer, damit auch WebKit die transformierten Blätter an der bewegten Unterkante abschneidet. Beim Schließen sind Anfangs- und Endhöhe des Viewports explizit gesetzt, einschließlich der anschließenden Klappbewegung.

Umschlag und Papier-Viewport liegen jetzt in einem gemeinsamen bewegten Träger. Die untere Papiergrenze ist relativ zum Umschlag fest und wird nicht mehr separat animiert. Der Stapel wird innerhalb dieses Trägers gegenläufig verschoben und skaliert; alle Extraktionsanimationen teilen denselben Startzeitpunkt. Damit bleiben Umschlag und Verdeckung auch bei ausgelassenen Frames verbunden.

Die Papierseiten behalten mit `will-change: transform` und ausgeblendeter Rückseite ihre Compositing-Ebene nach dem Auffächern. Dadurch entfällt die anschließende Raster-Neuausrichtung der feinen Papierlinien beim Wechsel zurück in den statischen Zustand.

Während der Bewegung wird die Klammer rein visuell auf einer eigenen Ebene oberhalb des Umschlags gespiegelt, mit derselben Gegenbewegung und Skalierung wie der Stapel. Die bedienbare Originalklammer bleibt außerhalb der Animation am Papier; die Darstellungskopie ist inert und für Screenreader verborgen.
