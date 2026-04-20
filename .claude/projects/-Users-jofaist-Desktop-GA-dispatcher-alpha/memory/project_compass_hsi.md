---
name: Compass HSI Implementation State
description: Current state of compass rose feature and upcoming HSI redesign scope
type: project
---

Compass rose (ga-dispatcher-v340) is live in main branch. Working state:
- `#compassRoseWrap` inside `#mapArea` (overflow:hidden clips it), bottom:0, translateY(200px) → top 1/3 visible
- `#compassDisc` rotates via CSS transform: rotate(-hdg deg) set in updateCompassHeading()
- `buildCompassSvg()` in sync.js builds static SVG: ticks every 5°, 2-digit aviation labels every 10°, radially rotated
- `#compassBugGroup` and `#compassCdiGroup` are SVG groups inside compassSvg (inside the rotating disc), their own SVG transform sets position in disc space
- `hideCompassRose()` / `window.updateCompassHeading()` / `window.updateCompassInstruments()` are public APIs
- updateCompassHeading called from updateLivePlanePosition (covers both live GPS + sim)
- updateCompassInstruments called from updateNextWpTelemetry at end

**Why:** Need to track architecture for upcoming HSI upgrade session

**How to apply:** When continuing HSI work, the key insight is that elements inside #compassSvg rotate WITH the disc. CDI group has its own rotate(courseDeg) transform applied in disc-local space. CDI bar translate(offset,0) moves perpendicular to course. HDG bug rotate(bearingToWp) on outer ring.
