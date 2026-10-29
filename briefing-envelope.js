/* Presentation only: all briefing pages, mission data and actions stay in place. */
(() => {
    const box = document.getElementById('briefingBox');
    const stack = document.getElementById('notesStack');
    if (!box || !stack) return;
    const frame = document.createElement('div');
    frame.className = 'briefing-envelope';
    frame.id = 'briefingEnvelope';
    frame.innerHTML = `<svg class="briefing-envelope-masks" width="0" height="0" aria-hidden="true"><defs>
        <clipPath id="briefing-envelope-front-clip" clipPathUnits="objectBoundingBox"><path d="M0 0 L.015 .075 C.015 .13 .03 .165 .07 .198 L.48 .572 Q.50 .596 .52 .572 L.93 .198 C.97 .165 .985 .13 .985 .075 L1 0 L1 1 L0 1 Z"/></clipPath>
        <clipPath id="briefing-envelope-flap-clip" clipPathUnits="objectBoundingBox"><path d="M.015 .075 L.985 .075 C.985 .13 .97 .165 .93 .198 L.52 .572 Q.50 .596 .48 .572 L.07 .198 C.03 .165 .015 .13 .015 .075 Z"/></clipPath>
        </defs></svg><div class="briefing-envelope-art briefing-envelope-back" aria-hidden="true"><img src="assets/ui/briefing/envelope.webp" alt="" width="1280" height="776"></div>
        <div class="briefing-envelope-art briefing-envelope-face" aria-hidden="true"><img src="assets/ui/briefing/envelope.webp" alt="" width="1280" height="776"></div>
        <div class="briefing-envelope-art briefing-envelope-flap" aria-hidden="true"><img src="assets/ui/briefing/envelope.webp" alt="" width="1280" height="776"></div>
        <button class="briefing-envelope-trigger" type="button" aria-controls="notesStack" aria-expanded="false"><span class="briefing-envelope-title"></span><span class="briefing-envelope-address"><span class="briefing-envelope-address-label">Adresse:</span><span class="briefing-envelope-icao"></span><span class="briefing-envelope-airport"></span></span></button>`;
    box.insertBefore(frame, stack);
    const paper = document.createElement('div');
    paper.className = 'briefing-envelope-paper';
    paper.appendChild(stack);
    const stage = document.createElement('div');
    stage.className = 'briefing-envelope-stage';
    const carriage = document.createElement('div');
    carriage.className = 'briefing-envelope-carriage';
    carriage.append(...frame.querySelectorAll('.briefing-envelope-art'), paper);
    stage.appendChild(carriage);
    frame.appendChild(stage);
    box.classList.add('briefing-envelope-box');
    const trigger = frame.querySelector('.briefing-envelope-trigger');
    const flap = frame.querySelector('.briefing-envelope-flap');
    const art = [...frame.querySelectorAll('.briefing-envelope-art')];
    const title = frame.querySelector('.briefing-envelope-title');
    const address = frame.querySelector('.briefing-envelope-address');
    const oldClip = stack.querySelector('.paperclip');
    const clip = document.createElement('button');
    clip.type = 'button';
    clip.className = 'paperclip';
    clip.title = 'Briefing in den Umschlag legen';
    clip.setAttribute('aria-label', clip.title);
    oldClip?.replaceWith(clip);
    // Keep the moving clip above the envelope while the sheets remain behind it.
    const clipOverlay = document.createElement('div');
    clipOverlay.className = 'briefing-envelope-clip-overlay';
    clipOverlay.setAttribute('aria-hidden', 'true');
    const clipCopy = clip.cloneNode(false);
    clipCopy.className = 'briefing-envelope-clip-copy';
    clipCopy.tabIndex = -1;
    clipOverlay.inert = true;
    clipOverlay.appendChild(clipCopy);
    carriage.appendChild(clipOverlay);
    let opened = false;
    let busy = false;
    let revision = 0;
    let identity = '';
    let animations = [];
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = (element, frames, duration, easing = 'cubic-bezier(.22,.7,.25,1)', startTime) => {
        const run = element.animate(frames, { duration: reduced() ? 0 : duration, easing, fill: 'forwards' });
        if (startTime != null) run.startTime = startTime;
        animations.push(run);
        return run.finished.catch(() => {});
    };
    function clearMotion() {
        animations.forEach(run => run.cancel());
        animations = [];
        frame.style.height = '';
        paper.style.height = '';
        paper.style.top = '';
        clipOverlay.style.top = '';
        clipOverlay.style.transform = '';
        clipOverlay.style.opacity = '';
        stack.style.transform = '';
        stack.style.opacity = '';
        trigger.style.opacity = '';
        flap.style.transform = '';
        flap.style.opacity = '';
    }
    function settle(open) {
        clearMotion();
        opened = open;
        busy = false;
        frame.classList.remove('is-moving', 'is-peeking', 'is-stacked', 'is-fanning', 'is-released', 'has-open-flap');
        frame.classList.toggle('is-open', open);
        stack.hidden = !open;
        stack.inert = !open;
        trigger.hidden = open;
        trigger.setAttribute('aria-expanded', String(open));
    }
    function geometry() {
        const width = frame.clientWidth;
        const envelopeHeight = width * 776 / 1280;
        const paperHeight = Math.ceil(stack.offsetHeight);
        const paperOrigin = paperHeight + 40;
        const inset = Math.max(envelopeHeight * .16, envelopeHeight * .075 + 24);
        return {
            envelopeHeight, paperHeight, paperOrigin,
            inside: `translateY(${paperOrigin + inset}px) scale(.92)`,
            outside: 'translateY(40px) scale(1)',
            duration: Math.min(1500, Math.max(850, paperHeight * .55))
        };
    }
    function preparePaper(g) {
        // The viewport and envelope share one moving parent. Its bottom stays
        // physically inside the envelope, with no separate mask animation.
        paper.style.top = `${-g.paperOrigin}px`;
        clipOverlay.style.top = `${-g.paperOrigin}px`;
        paper.style.height = `${g.paperOrigin + g.envelopeHeight * .90}px`;
    }
    function extract(g, reverse) {
        const startTime = document.timeline.currentTime;
        const frames = [
            [frame, [{ height: `${g.envelopeHeight}px` }, { height: `${g.paperHeight}px` }]],
            [carriage, [{ transform: 'translateY(0px)' }, { transform: `translateY(${g.paperHeight}px)` }]],
            [stack, [{ transform: g.inside }, { transform: g.outside }]],
            [clipOverlay, [{ transform: g.inside }, { transform: g.outside }]],
            ...art.map(element => [element, [{ opacity: 1 }, { opacity: 1, offset: .85 }, { opacity: 0 }]])
        ];
        return Promise.all(frames.map(([element, keys]) => {
            const keyframes = reverse ? keys.map(key => ({ ...key, ...(key.offset == null ? {} : { offset: 1 - key.offset }) })).reverse() : keys;
            return animate(element, keyframes, g.duration, 'linear', startTime);
        }));
    }
    async function fanSheets(bundle) {
        const pages = [...stack.querySelectorAll('.mission-note-page')];
        pages.forEach(page => page.getBoundingClientRect());
        frame.classList.add('is-fanning');
        frame.classList.toggle('is-stacked', bundle);
        pages.forEach(page => getComputedStyle(page).transform);
        await Promise.allSettled(pages.flatMap(page => page.getAnimations()).map(run => run.finished));
        frame.classList.remove('is-fanning');
    }
    async function open() {
        if (busy || opened) return;
        const ticket = ++revision;
        busy = true;
        frame.classList.add('is-moving', 'is-peeking', 'is-stacked');
        stack.hidden = false;
        stack.inert = true;
        const g = geometry();
        frame.style.height = `${g.envelopeHeight}px`;
        preparePaper(g);
        stack.style.transform = g.inside;
        clipOverlay.style.transform = g.inside;
        stack.style.opacity = '0';
        clipOverlay.style.opacity = '0';
        await Promise.all([
            animate(flap, [{ transform: 'perspective(900px) rotateX(0deg)', opacity: 1 }, { transform: 'perspective(900px) rotateX(-180deg)', opacity: 1 }], 420),
            animate(trigger, [{ opacity: 1 }, { opacity: 0 }], 220),
            animate(stack, [{ opacity: 0 }, { opacity: 1 }], 420),
            animate(clipOverlay, [{ opacity: 0 }, { opacity: 1 }], 420)
        ]);
        if (ticket !== revision) return;
        frame.classList.remove('is-peeking');
        frame.classList.add('has-open-flap');
        await extract(g, false);
        if (ticket !== revision) return;
        clearMotion();
        frame.classList.add('is-released');
        frame.classList.remove('is-moving', 'is-peeking');
        trigger.hidden = true;
        await fanSheets(false);
        if (ticket !== revision) return;
        settle(true);
        clip.focus({ preventScroll: true });
    }
    async function close() {
        if (busy || !opened) return;
        const ticket = ++revision;
        busy = true;
        stack.inert = true;
        // First align the loose sheets, then run the extraction backwards.
        await fanSheets(true);
        if (ticket !== revision) return;
        const g = geometry();
        frame.style.height = `${g.paperHeight}px`;
        frame.classList.remove('is-open', 'is-released');
        frame.classList.add('is-moving', 'has-open-flap');
        preparePaper(g);
        trigger.hidden = false;
        trigger.style.opacity = '0';
        flap.style.transform = 'perspective(900px) rotateX(-180deg)';
        flap.style.opacity = '1';
        await extract(g, true);
        if (ticket !== revision) return;
        frame.classList.remove('has-open-flap');
        await Promise.all([
            animate(flap, [{ transform: 'perspective(900px) rotateX(-180deg)', opacity: 1 }, { transform: 'perspective(900px) rotateX(0deg)', opacity: 1 }], 420),
            animate(trigger, [{ opacity: 0 }, { opacity: 1 }], 220),
            animate(stack, [{ opacity: 1 }, { opacity: 0 }], 420),
            animate(clipOverlay, [{ opacity: 1 }, { opacity: 0 }], 420)
        ]);
        if (ticket !== revision) return;
        settle(false);
        trigger.focus({ preventScroll: true });
    }
    const titleMeasure = document.createElement('canvas').getContext('2d');
    let titleText = '';
    let fitFrame = 0;
    function fitTitle() {
        const width = frame.clientWidth;
        if (!width || !titleMeasure || !titleText) return;
        const height = width * 776 / 1280;
        const inset = Math.max(8, width * .025);
        const top = height * .12;
        const bottom = height * .48;
        const style = getComputedStyle(title);
        const spacing = parseFloat(style.letterSpacing) || 0;
        let layout = [];
        let chosenSize = 6;
        // Each line must fit at its lower edge, where the flap is narrower.
        for (let size = Math.min(22, width * .04); size >= 6; size -= .5) {
            titleMeasure.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
            const lineHeight = size * 1.2;
            const pending = titleText.split(/\s+/).filter(Boolean);
            const lines = [];
            const measure = text => titleMeasure.measureText(text).width + Math.max(0, text.length - 1) * spacing;
            for (let y = top + lineHeight; y <= bottom && pending.length; y += lineHeight) {
                const edge = width * (.015 + .485 * Math.max(0, (y / height - .07) / .53));
                const available = Math.max(1, width - 2 * (edge + inset));
                let line = '';
                while (pending.length && measure(line ? `${line} ${pending[0]}` : pending[0]) <= available) {
                    line = line ? `${line} ${pending.shift()}` : pending.shift();
                }
                if (!line) {
                    const characters = Array.from(pending[0]);
                    while (characters.length && measure(line + characters[0]) <= available) line += characters.shift();
                    if (!line) break;
                    if (characters.length) pending[0] = characters.join('');
                    else pending.shift();
                }
                lines.push({ text: line, width: available });
            }
            if (!pending.length) { layout = lines; chosenSize = size; break; }
        }
        // Real mission titles fit well above the lower limit; retain all copy.
        if (!layout.length) layout = [{ text: titleText, width: width * .5 }];
        title.style.fontSize = `${chosenSize}px`;
        title.replaceChildren(...layout.map(line => {
            const span = document.createElement('span');
            span.className = 'briefing-envelope-title-line';
            span.style.width = `${line.width}px`;
            span.textContent = line.text;
            return span;
        }));
    }
    function scheduleTitleFit() {
        cancelAnimationFrame(fitFrame);
        fitFrame = requestAnimationFrame(fitTitle);
    }
    let fittedWidth = 0;
    if (typeof ResizeObserver === 'function') new ResizeObserver(entries => {
        const width = entries[0].contentRect.width;
        if (Math.abs(width - fittedWidth) < .5) return;
        fittedWidth = width;
        scheduleTitleFit();
    }).observe(frame);
    window.addEventListener('resize', scheduleTitleFit, { passive: true });
    document.fonts?.ready.then(scheduleTitleFit);
    function receive() {
        const heading = document.getElementById('mTitle')?.textContent.trim() || 'Flugauftrag';
        const icao = document.getElementById('mDepICAO')?.textContent.trim() || '';
        const airport = document.getElementById('mDepName')?.textContent.trim() || '';
        const mission = window.currentMissionData;
        const nextIdentity = `${mission?.missionId || mission?.id || ''}|${heading}|${icao}|${airport}`;
        titleText = heading;
        title.textContent = heading;
        scheduleTitleFit();
        address.querySelector('.briefing-envelope-icao').textContent = icao;
        address.querySelector('.briefing-envelope-airport').textContent = airport;
        trigger.setAttribute('aria-label', `${heading}. Startplatz: ${[icao, airport].filter(Boolean).join(' · ')}. Briefing öffnen`);
        if (identity !== nextIdentity) {
            identity = nextIdentity;
            ++revision;
            settle(false);
        }
    }
    trigger.addEventListener('click', open);
    clip.addEventListener('click', event => { event.stopPropagation(); close(); });
    window.gaBriefingEnvelope = { receive, open, close };
    receive();
})();
