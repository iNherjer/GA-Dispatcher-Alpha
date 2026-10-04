const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.GA_PLAYWRIGHT_MODULE || '/Users/jofaist/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');

test('missing-key dialog: cancel, session, persistent provider key and local dispatch', async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.GA_BROWSER_CHANNEL ? { channel: process.env.GA_BROWSER_CHANNEL } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 440, height: 894 } });
        const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
        const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
        const dialog = html.match(/<dialog id="dispatchApiKeyDialog"[\s\S]*?<\/dialog>/)[0];
        const helper = app.slice(app.indexOf('let _dispatchApiKeyPrompt = null;'), app.indexOf('\nfunction getAiCostEstimateText'));
        await page.setContent(`<style>${fs.readFileSync(path.join(root, 'styles.css'), 'utf8')}</style><button id="before">Dispatch</button><input id="apiKeyInput"><input id="openAiApiKeyInput">${dialog}`);
        await page.evaluate(() => {
            window.testStorage = {};
            Object.defineProperty(window, 'localStorage', { value: { getItem: k => window.testStorage[k] || null, setItem: (k,v) => { window.testStorage[k] = v; } } });
            window.testProvider = 'gemini';
            window.getSelectedAiProvider = () => window.testProvider;
            window.AI_PROVIDER_LABELS = { gemini: 'Gemini', openai: 'OpenAI' };
            window.OPENAI_API_KEY_STORAGE_KEY = 'ga_openai_key';
            window._clearApiKeyValidationCache = () => {};
            window.updateAiCostEstimate = () => {};
        });
        await page.addScriptTag({ content: helper });
        const open = () => page.evaluate(() => { window.testResult = null; requestDispatchApiKey().then(r => { window.testResult = r; }); });
        await open();
        assert.equal(await page.locator('#dispatchApiKeyPassword').getAttribute('type'), 'password');
        await page.keyboard.press('Escape');
        assert.equal(await page.evaluate(() => window.testResult), 'cancel');
        assert.deepEqual(await page.evaluate(() => window.testStorage), {});
        await open();
        await page.locator('#dispatchApiKeyPassword').fill('fixture-session');
        await page.locator('#dispatchApiKeyRemember').uncheck();
        await page.locator('#dispatchApiKeyShow').check();
        assert.equal(await page.locator('#dispatchApiKeyPassword').getAttribute('type'), 'text');
        await page.getByRole('button', { name: 'Mit KI fortfahren', exact: true }).click();
        assert.equal(await page.evaluate(() => window.testResult), 'ai');
        assert.deepEqual(await page.evaluate(() => window.testStorage), {});
        assert.equal(await page.locator('#apiKeyInput').inputValue(), 'fixture-session');
        assert.equal(await page.locator('#dispatchApiKeyPassword').inputValue(), '');
        await page.evaluate(() => { window.testProvider = 'openai'; });
        await open();
        await page.locator('#dispatchApiKeyPassword').fill('fixture-openai');
        await page.getByRole('button', { name: 'Mit KI fortfahren', exact: true }).click();
        assert.deepEqual(await page.evaluate(() => window.testStorage), { ga_openai_key: 'fixture-openai' });
        await open();
        await page.getByRole('button', { name: 'Ohne KI fortfahren', exact: true }).click();
        assert.equal(await page.evaluate(() => window.testResult), 'local');
        await open();
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.dispatch-api-key-option').first().evaluate(el => getComputedStyle(el).display), 'flex');
        await page.screenshot({ path: '/tmp/dispatch-api-key-dialog-mobile.png' });
        assert.equal(await page.locator('#dispatchApiKeyDialog').evaluate(el => el.scrollWidth <= el.clientWidth), true);
        await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
        await page.setViewportSize({ width: 838, height: 890 });
        await page.evaluate(() => {
            window.PasswordCredential = class { constructor(data) { this.id = data.id; this.password = data.password; } };
            Object.defineProperty(navigator, 'credentials', { configurable: true, value: {
                store: credential => { window.managerProvider = credential.id; return Promise.reject(new Error('dismissed')); }
            } });
        });
        await open();
        await page.locator('#dispatchApiKeyPassword').fill('fixture-manager');
        await page.locator('#dispatchApiKeyManager').check();
        await page.getByRole('button', { name: 'Mit KI fortfahren', exact: true }).click();
        assert.equal(await page.evaluate(() => window.testResult), 'ai');
        assert.equal(await page.evaluate(() => window.managerProvider), 'GA Dispatcher OpenAI API-Key');
        await page.evaluate(() => { localStorage.setItem = () => { throw new Error('quota'); }; });
        await open();
        await page.locator('#dispatchApiKeyPassword').fill('fixture-no-storage');
        await page.getByRole('button', { name: 'Mit KI fortfahren', exact: true }).click();
        assert.equal(await page.evaluate(() => window.testResult), null);
        assert.match(await page.locator('#dispatchApiKeyError').textContent(), /Lokales Speichern/);
        await page.locator('#dispatchApiKeyRemember').uncheck();
        await page.getByRole('button', { name: 'Mit KI fortfahren', exact: true }).click();
        assert.equal(await page.evaluate(() => window.testResult), 'ai');

    } finally { await browser.close(); }
});
