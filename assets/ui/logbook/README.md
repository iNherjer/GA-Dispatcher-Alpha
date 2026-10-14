# Flugbuch-Grafiken

Aktuell verwendet: `closed-tall-v2.png` und `open.png`, mit dem vorhandenen Ledereinschub `../homebase/pocket.png`. Zusätzliche Material-Weathering-Layer sind entfernt; der Schriftabrieb bleibt. Das Menü behält beim Öffnen und Schließen seine Größe, nur das Buch bewegt sich als darüberliegende Ebene. Die folgenden Varianten und Prompts dokumentieren die bisherigen Entwürfe.

## closed-directional-v3.png und metal-louver-v2.png (aktuell)

Bearbeitet mit dem eingebauten image_gen-Tool: Licht von links oben und ein integrierter Blech-Lüftungsschlitz statt eines aufgesetzten Fachrahmens.

### Buchlicht

Edit lighting ONLY on this complete transparent red leather Flugbuch. Preserve exact book geometry, full edges, near-square proportions, spine position, stitches, worn leather grain, exact gold title "Flugbuch" and airplane ornament positions, transparent alpha. Light it distinctly from ABOVE LEFT at about 45 degrees as a single warm diffused cockpit window light. The upper left leather and spine have softly brighter tactile grazing highlights; the illumination falls gradually diagonally toward the bottom right, which is noticeably shaded yet preserves dark burgundy detail. Gold lettering catches light on its upper-left bevels with small lower-right recess shadows. Highlight the top page edge more on the left, with gentle occlusion shadow under the top leather rim. Remove the evenly frontal studio illumination and any central frontal hotspot. No change in color palette or material, no added objects, no cast shadow outside the book; UI adds that. Cinematic natural directional but readable, no dramatic black crush. Genuine transparency.

### Geprägtes Blechfach

Redesign this sheet-metal pocket front as an INTEGRATED stamped louver, like a pressed outward ventilation slot in the sheet metal of a vintage car hood. One very wide shallow isolated UI foreground element, approximately 5:1 actual object ratio, straight-on orthographic view with a small visible top opening. The BOTTOM is flush and flat with the surrounding dark graphite UI metal: no projecting lower rolled rim, no lower screws, no separate rectangular frame, no box hanging in front. Toward the TOP the same metal gently curves outward and upward toward the viewer to form a forward-open lip: a rounded top edge catching upper-left light, a narrow darker inner underside indicating the opening. Sides smoothly taper and flatten into the base, pressed/formed from a single continuous sheet. Subtle brushed metal patina, small scratches, dark graphite, soft upper-left directional light; the lower quarter is matte and low contrast to visually merge into the UI. A shallow central dip in the upper opening edge to reveal the book behind. Keep ONE opaque FRONT surface below this edge only; the area above it is transparent for a book behind. No book, no rear wall, no scene, no letters. Entire object visible uncropped. IMPORTANT tight minimal transparent canvas margins (less than 2% on each side) and genuine transparent background. Only tiny local occlusion shading, no external hovering bottom drop shadow. Not a bolted-on rectangular tray: smooth flush bottom and pressed outward upper hood-louver form.

## metal-pocket.png

Erstellt mit dem eingebauten image_gen-Tool. Separater transparenter Vorderteil eines Blechfachs; Schatten und Buchpatina werden als UI-Layer hinzugefügt.

Use case: product-mockup. Asset type: transparent PNG foreground sheet-metal document pocket for a vintage civilian aviation cockpit web UI. ONE EMPTY very wide shallow front panel, width:height of the object around 5:1. Orthographic straight-on frontal view. Dark graphite gunmetal folded sheet metal, subtle brushed grain, light patina, tiny worn edge scratches, restrained oxidation on the corners. Raised rolled top lip with a very shallow smooth central dip so a red leather logbook behind is visible. Four small realistic slotted steel mounting screws near corners. Folded lower seam, thin highlight from upper left, darker right edge, realistic three-dimensional material. Entire object uncropped, minimal transparent margins, exact contour alpha. Opaque metal ONLY below the shallow upper rim, transparent above rim and around object. It is only the FRONT panel of a pocket, no rear wall or cavity, no book, no paper, no letters, no logos, no surrounding frame or background. Shadows should be tiny material-local shading; external drop shadow added in UI. Weathered premium cockpit hardware, no heavy rust, no bright chrome.

## closed-tall-v2.png (aktuelle Covergrafik)

Bearbeitet mit dem eingebauten image_gen-Tool; höhere Buchproportionen auf Wunsch des Users.

Edit this complete red leather Flugbuch asset. Preserve photorealistic oxblood leather, fine tan stitched perimeter, left spine, visible thin top paper edge, gold embossed exact text "Flugbuch" and small gold airplane ornament. Change book proportions to a TALLER near-square hardcover, width:height approximately 1.15:1 instead of the current wide landscape. Entire book fully visible uncropped, minimal transparent margins, same straight-on near orthographic view and upper-left soft lighting. Place Flugbuch title and airplane ornament within the upper 40% of the cover, centered horizontally, so that when lower 45% is hidden by a UI pocket all gold printing is visible. Clean alpha around edges, no surrounding shadows beyond tiny contact shading, genuinely transparent background, no UI or pocket, no extra text.

Die Schrift der UI-Tabelle nutzt die bereits im Projekt vorhandene Caveat-SemiBold.ttf lokal; die Tabelle bleibt vollständig innerhalb der Papierflächen.

Erstellt mit dem eingebauten image_gen-Tool am 2026-10-14. Transparente PNGs, vollständig im Projekt gespeichert. Die Fachblende, Inhalte und Navigation werden in HTML/CSS darüber gelegt.

## closed.png

Use case: product-mockup. Asset type: transparent PNG for a realistic cockpit web UI. Create ONE complete closed landscape pilot logbook, straight-on nearly orthographic front view with a very small visible top page edge and left spine. Entire book visible, uncropped. Width to height of book approximately 1.65:1. Deep oxblood red leather, tactile grain, worn edges, fine tan perimeter stitching, rounded corners, beautiful restrained antique gold embossed serif text exactly "Flugbuch", centered in upper middle of cover, small gold airplane silhouette with thin horizontal rules below. Premium handmade vintage aviation book. Soft lighting from upper left. Isolated on genuinely transparent background with no surrounding objects, no shelf, no UI, no hands, no extra text. Minimal transparent margins. The lower half will be occluded by a UI shelf but MUST be generated fully.

## open.png

Use case: product-mockup. Asset type: transparent PNG background for an interactive logbook UI. ONE open landscape aviation logbook viewed exactly straight down, orthographic, perfectly horizontal. Wide aspect ratio approximately 1.85:1. Full book visible uncropped with minimal transparent margin. Deep oxblood red leather binding around two warm ivory aged blank paper pages, fine tan perimeter stitching, subtle worn corners, layered page edges, realistic narrow center gutter and paper curve, restrained soft upper left lighting. Two pages occupy 88 percent of width and 85 percent of height, broad flat clean writable regions. Pages MUST be entirely blank: no letters, no lines, no numbers, no drawings, no hands, no surrounding objects or UI. Detailed photorealistic premium vintage book matching a red leather gold titled Flugbuch cover. Genuinely transparent background.
