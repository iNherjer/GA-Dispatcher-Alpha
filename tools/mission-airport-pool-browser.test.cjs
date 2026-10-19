const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || '/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');

test('loaded app uses the worldwide pool and exports Hunda through its GPS identifier', { timeout: 60000 }, async () => {
    const server = http.createServer((req, res) => {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + path.sep) || pathname.includes('/.')) return res.writeHead(404).end();
        try {
            const data = fs.readFileSync(file);
            res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/json');
            res.end(data);
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({ channel: process.env.GA_BROWSER_CHANNEL || 'chrome', headless: true });
        const page = await browser.newPage();
        await page.route('**/*', async route => {
            const url = new URL(route.request().url());
            if (url.hostname === '127.0.0.1' || /unpkg.com|cdnjs.cloudflare.com|cdn.jsdelivr.net/.test(url.hostname)) return route.continue();
            await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        });
        await page.addInitScript(() => localStorage.setItem('ga_onboarding_seen_v1', '1'));
        await page.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => typeof collectMissionAirportPool === 'function' && typeof window.exportMSFS === 'function');
        const result = await page.evaluate(async () => {
            globalAirports = await (await fetch('/airports.json')).json();
            fetchOpenAipDispatchAirports = async () => [buildAirportDispatchRecord('FBMN', globalAirports.FBMN)];
            currentStartICAO = 'FBMN';
            const pool = await collectMissionAirportPool(-19.9725, 23.4311, 100);
            const hasHunda = pool.some(record => record.icao === 'OUR-317575');
            const hasMopiri = pool.some(record => record.icao === 'OUR-595499');
            const maunCount = pool.filter(record => record.sourceId === globalAirports.FBMN.sourceId).length;
            gaAirportTypes.setSelected(['traffic', 'ga'], { persist: false, emit: false });
            const proposals = await collectMissionProposalAirportCandidates({
                start: { icao: 'FBMN', lat: -19.9725, lon: 23.4311 }, minNM: 5, maxNM: 100,
                dirPref: 'any', regionPref: 'any', limit: 1000
            });
            currentStartICAO = 'OUR-317575'; currentDestICAO = 'FBMN';
            currentMissionData = { mission: 'Hunda to Maun', departureAirport: { ident: currentStartICAO, altIdentifier: 'FBHU' } };
            currentDepElev = 3150; currentDestElev = 3093; currentSName = 'Hunda'; currentDName = 'Maun';
            routeWaypoints = [{ lat: -19.4, lng: 22.7, name: 'Hunda', icao: currentStartICAO },
                { lat: -19.97, lng: 23.43, name: 'Maun', icao: currentDestICAO }];
            window.isMissionDraftPending = () => false;
            let download;
            const originalCreate = URL.createObjectURL, originalClick = HTMLAnchorElement.prototype.click;
            URL.createObjectURL = blob => { download = blob; return originalCreate.call(URL, blob); };
            HTMLAnchorElement.prototype.click = () => {};
            try { window.exportMSFS(); } finally { URL.createObjectURL = originalCreate; HTMLAnchorElement.prototype.click = originalClick; }
            const xml = await download.text();
            return { hasHunda, hasMopiri, maunCount, newProposal: proposals.some(record => record.icao.startsWith('OUR-')),
                departureCorrect: xml.includes('<DepartureID>FBHU</DepartureID>'), internalKey: currentStartICAO };
        });
        assert.deepEqual(result, { hasHunda: true, hasMopiri: true, maunCount: 1, newProposal: true,
            departureCorrect: true, internalKey: 'OUR-317575' });
    } finally {
        if (browser) await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
});
