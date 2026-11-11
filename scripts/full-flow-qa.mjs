// Read-only production QA. Real RPC reads; outage cases explicitly intercept their named service.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { utimesSync } from 'node:fs';
import { createRequire } from 'node:module';
import { withChromeLock, LOCK } from '/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/0f121b7c-0081-4ec0-81a9-0ccb4f7f8b48/scratchpad/chrome-lock.mjs';
delete process.env.DEBUG;
delete process.env.PWDEBUG;
const { chromium } = await import('playwright-core');
const base = process.env.KOTOBA_WEB || 'http://127.0.0.1:5591';
assert.ok(new URL(base).hostname === '127.0.0.1' && +new URL(base).port >= 5300 && +new URL(base).port <= 5999);
const out = '/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/0f121b7c-0081-4ec0-81a9-0ccb4f7f8b48/scratchpad/flow-qa/kotoba/full-flow';
const contract = 'kotoba-edfa2b47.testnet', player = `player.${contract}`, market = '/market/fomc-2026-12-employment';
const ids = ['fomc-2026-12-employment', 'fomc-2026-12-inflation', 'fomc-2026-12-recession', 'fomc-2026-12-tariffs', 'fomc-2026-01-inflation-40', 'fomc-2026-01-recession'];
const rpcPattern = /https:\/\/(test\.rpc\.fastnear\.com|near-testnet\.drpc\.org)\/?$/;
// Meteor's restored-session reader requires a signer even for reads. This fresh,
// unregistered key authorizes no on-chain account and is never printed or copied to a file.
const { KeyPair } = createRequire(new URL('../packages/web/package.json', import.meta.url))('near-api-js');
const readOnlyKey = KeyPair.fromRandom('ed25519').toString();
await mkdir(out, { recursive: true });
const report = { at: new Date().toISOString(), base, cases: [], internal_links: [], external_links: [] };
const links = new Set(), externals = new Set(); let failed = 0;
const persist = () => writeFile(`${out}/audit.json`, JSON.stringify(report, null, 2) + '\n');
await withChromeLock(async () => {
  const heartbeat = setInterval(() => { const now = new Date(); try { utimesSync(LOCK, now, now); } catch {} }, 60000);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 812 }, permissions: ['clipboard-read', 'clipboard-write'] });
      // This audit never broadcasts. All actual writes belong to scripts/qa-browser.mjs.
      await context.route('**/*', async route => {
        const request = route.request();
        if (request.method() === 'POST') {
          let body; try { body = request.postDataJSON(); } catch {}
          if (body?.jsonrpc && !['query', 'tx', 'status', 'block', 'gas_price'].includes(body.method)) return route.abort('blockedbyclient');
        }
        return route.continue();
      });
      let page, diagnostics;
      async function fresh(account) {
        if (page) await page.close();
        page = await context.newPage(); diagnostics = { page_errors: [], console_errors: [], requests_failed: [], http_errors: [] };
        await page.addInitScript(({ account, contract, readOnlyKey }) => {
          localStorage.clear(); sessionStorage.clear();
          if (account) { // Restored-session fixture, not a successful Meteor approval.
            localStorage.setItem('default_meteor_wallet_auth_key', JSON.stringify({ accountId: account, allKeys: [] }));
            localStorage.setItem('near-wallet-selector:selectedWalletId', JSON.stringify('meteor-wallet'));
            localStorage.setItem('near-wallet-selector:contract', JSON.stringify({ contractId: contract, methodNames: [] }));
            localStorage.setItem(`_meteor_wallet${account}:testnet`, readOnlyKey);
          }
        }, { account, contract, readOnlyKey });
        page.on('pageerror', e => diagnostics.page_errors.push(e.message));
        page.on('console', m => {
          // Do not capture/debug-print key objects, including an upstream SDK regression.
          if (/KeyPair|extendedSecretKey|secretKey:/.test(m.text())) diagnostics.page_errors.push('Wallet emitted a key debug object');
          else if (m.type() === 'error') diagnostics.console_errors.push(m.text());
        });
        page.on('requestfailed', r => diagnostics.requests_failed.push({ url: r.url(), error: r.failure()?.errorText }));
        page.on('response', r => { if (r.status() >= 400) diagnostics.http_errors.push({ url: r.url(), status: r.status() }); });
        page.setDefaultTimeout(15000);
      }
      async function goto(path, ready) {
        await page.goto(base + path, { waitUntil: 'domcontentloaded' });
        if (ready) await page.locator(ready).first().waitFor({ timeout: 60000 });
        await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
      }
      async function step(name, fn, expectedFault = false) {
        const row = { width, name, expected_fault: expectedFault, status: 'PASS' };
        const start = Object.fromEntries(Object.entries(diagnostics).map(([k, v]) => [k, v.length]));
        try { await fn(); } catch (e) { row.status = 'FAIL'; row.error = e.message.split('\n')[0]; failed++; }
        try {
          await page.waitForFunction(() => [...document.images].filter(img => { const b = img.getBoundingClientRect(); return b.top < innerHeight && b.bottom > 0 && b.left < innerWidth && b.right > 0; }).every(img => img.complete && img.naturalWidth > 0));
          row.path = new URL(page.url()).pathname; row.screen = `${out}/${width}-${name}.png`;
          const dom = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth, text: document.body.innerText, pending: document.querySelectorAll('.skeleton,.skeleton-row,.checks .pending').length, links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')) }));
          for (const href of dom.links) { if (href.startsWith('/')) links.add(href); else if (/^https?:/.test(href)) externals.add(href); }
          row.bad_text = /\bundefined\b|\bNaN\b|\[object Object\]|TypeError:|ReferenceError:|ERR_[A-Z_]+/.test(dom.text);
          row.overflow = dom.scrollWidth > dom.innerWidth; row.pending = dom.pending;
          if (row.overflow || row.bad_text || !dom.text.trim()) { row.status = 'FAIL'; failed++; }
          await page.screenshot({ path: row.screen, fullPage: true });
        } catch (e) { row.capture_error = e.message.split('\n')[0]; row.status = 'FAIL'; failed++; }
        row.diagnostics = Object.fromEntries(Object.entries(diagnostics).map(([k, v]) => [k, v.slice(start[k])]));
        if (row.diagnostics.page_errors.length) { row.status = 'FAIL'; failed++; }
        report.cases.push(row); await persist(); console.log(`${row.status}: ${width} ${name}${row.error ? ' — ' + row.error : ''}`);
      }
      await fresh();
      await step('landing', async () => { await goto('/', '.l-stats'); await page.waitForFunction(() => document.querySelector('.l-stats dd')?.textContent === '6'); });
      await step('understand', async () => {
        if (width === 375) await page.locator('#how').scrollIntoViewIfNeeded(); // The approved phone header hides this link; users scroll.
        else { await page.getByRole('link', { name: 'How it settles', exact: true }).click(); await page.waitForFunction(() => location.hash === '#how' && Math.abs(document.querySelector('#how').getBoundingClientRect().top) < 100); }
        await page.locator('#how h2').waitFor();
      });
      await step('board', async () => { await page.getByRole('link', { name: 'Open app', exact: true }).click(); await page.locator(width === 1440 ? '.mcard' : '.ev-card').first().waitFor(); await page.waitForFunction(() => !document.querySelector('.skeleton')); });
      await step('filters', async () => {
        for (const name of ['Settled', 'All', 'Open']) { await page.getByRole('tab', { name: new RegExp('^' + name) }).click(); await page.waitForTimeout(100); }
        if (width === 375) { await page.getByRole('button', { name: 'Previous week', exact: true }).click(); await page.getByRole('button', { name: 'Next week', exact: true }).click(); }
        else { await page.getByRole('button', { name: 'Refresh markets' }).click(); await page.waitForFunction(() => !document.querySelector('button[aria-label="Refresh markets"]')?.disabled); }
      });
      if (width === 375) {
        await step('schedule-empty', async () => { await page.getByRole('button', { name: 'Today', exact: true }).click(); await page.getByText(/Nothing scheduled on/).waitFor(); });
        await step('schedule-jump', async () => { await page.getByRole('button', { name: /^Jump to/ }).click(); assert.equal(await page.locator('.rows .row').count(), 4); });
        await step('event-sheet', async () => { await page.locator('.ev-card').first().getByRole('button', { name: 'Your call' }).click(); assert.equal(await page.locator('.word-list li').count(), 4); });
        await page.getByRole('button', { name: 'Close', exact: true }).click();
      }
      await step('quote', async () => {
        await goto(market, '.yn-yes'); await page.locator('.yn-yes').click(); await page.waitForFunction(() => document.querySelector('.receipt dd')?.textContent?.includes('NEAR'));
        await page.getByRole('radio', { name: /^No/ }).click(); await page.getByRole('button', { name: 'More shares' }).click(); await page.getByRole('button', { name: 'Fewer shares' }).click(); await page.waitForTimeout(1000);
      });
      await step('invalid-quantity', async () => { await page.getByRole('textbox', { name: 'Number of shares' }).fill('1.5'); await page.locator('.field-err').waitFor(); assert.equal(await page.locator('.sheet .btn-block').isDisabled(), true); });
      await page.keyboard.press('Escape');
      await step('meteor-popup-closed', async () => {
        await page.evaluate(() => { const open = window.open.bind(window); window.open = (...args) => { window.__qaPopupUrl = String(args[0]); const popup = open(...args); if (popup) { const post = popup.postMessage.bind(popup); popup.postMessage = (msg, ...rest) => { if (msg?.inputs) window.__qaPublicRequest = { actionType: msg.actionType, network: msg.network, contract_id: msg.inputs.contract_id }; return post(msg, ...rest); }; } return popup; }; });
        await page.locator(width === 1440 ? '.side' : '.tabbar').getByRole('link', { name: 'You', exact: true }).click();
        const popupPromise = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Connect with Meteor Wallet', exact: true }).click();
        const popup = await popupPromise; const url = await page.evaluate(() => window.__qaPopupUrl); assert.ok(url.startsWith('https://wallet.meteorwallet.app/connect/testnet/login'));
        await page.waitForFunction(() => !!window.__qaPublicRequest);
        const request = await page.evaluate(() => window.__qaPublicRequest); assert.deepEqual(request, { actionType: 'login', network: 'testnet', contract_id: contract });
        report.cases.push({ width, name: 'meteor-url', status: 'PASS', url, request });
        await popup.close(); await page.getByText(/You closed the wallet without approving/).waitFor({ timeout: 30000 });
      });
      await fresh();
      await step('meteor-popup-blocked', async () => { await page.addInitScript(() => { window.open = () => null; }); await goto('/you', '.state-setup'); await page.getByRole('button', { name: 'Connect with Meteor Wallet', exact: true }).click(); await page.getByText(/Your browser blocked the wallet window/).waitFor(); });
      await fresh();
      await step('you-disconnected', async () => { await goto('/you', '.state-setup'); await page.screenshot({ path: `${out}/${width}-you-disconnected-state.png`, fullPage: true }); await page.getByRole('link', { name: 'Open a market', exact: false }).click(); await page.waitForURL('**/creators'); });
      await step('creators', async () => { await page.locator('.creator').waitFor(); await page.getByLabel('Word or phrase').fill('soft landing'); assert.equal(await page.locator('#err-id').count(), 0); });
      await step('composer-invalid', async () => { await page.getByLabel('Word or phrase').fill('bad  phrase'); await page.getByText('Letters and single spaces only', { exact: true }).waitFor(); await page.getByLabel('Liquidity b').fill('99'); await page.getByText('Between 100 and 100,000', { exact: true }).waitFor(); });
      await step('composer-duplicate', async () => { await page.getByLabel('Word or phrase').fill('employment'); await page.getByLabel('Liquidity b').fill('100'); await page.getByText(/fomc-2026-12-employment already exists/).waitFor(); });
      await step('resolved', async () => { await goto('/resolved', '.mcard'); assert.equal(await page.locator('.mcard').count(), 2); });
      for (const id of ids) await step(id, async () => {
        await goto('/market/' + id, '.market-head');
        if (id.includes('2026-01')) { await page.waitForFunction(() => [...document.querySelectorAll('.run .seal')].every(s => s.textContent.includes('Seal verified')), undefined, { timeout: 60000 }); await page.locator('.paper-text').waitFor(); }
        else await page.getByText('Transcript not published yet', { exact: true }).waitFor();
      });
      await step('transcript-navigation', async () => {
        await goto('/market/fomc-2026-01-inflation-40', '.paper-text'); assert.equal(await page.locator('.paper-text mark').count(), 40);
        await page.getByRole('button', { name: 'Next hit', exact: true }).click(); await page.locator('.transcript-nav').getByText('2/40').waitFor();
        await page.getByRole('button', { name: 'Previous hit', exact: true }).click(); await page.locator('.transcript-nav').getByText('1/40').waitFor();
        await page.getByRole('button', { name: 'Copy transcript hash', exact: true }).click(); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3');
      });
      await step('unknown-market', async () => { await goto('/market/fomc-2099-01-nothing', '.state-empty'); await page.screenshot({ path: `${out}/${width}-unknown-market-state.png`, fullPage: true }); await page.getByRole('link', { name: 'Back to the board' }).click(); await page.waitForURL('**/app'); });
      await fresh(player);
      await step('positions-read-only', async () => { await goto('/you', '.position'); await page.getByRole('link', { name: player, exact: true }).waitFor(); assert.ok(await page.locator('.position').count() >= 3); });
      await step('insufficient-balance', async () => { await goto(market, '.yn-yes'); await page.locator('.yn-yes').click(); await page.getByRole('textbox', { name: 'Number of shares' }).fill('100000'); await page.getByText(/this order needs/).waitFor(); assert.equal(await page.locator('.sheet .btn-block').isDisabled(), true); });
      await step('composer-balance', async () => { await goto('/creators', '.composer'); await page.getByLabel('Word or phrase').fill('soft landing'); await page.getByText(/opening this market needs/).waitFor(); assert.equal(await page.locator('.composer .btn-block').isDisabled(), true); });
      await step('sign-out', async () => { await goto('/you', '.position'); await page.locator('.you-links').getByRole('button', { name: /^Sign out/ }).click(); await page.getByText('No wallet connected', { exact: true }).waitFor(); });
      await fresh('nick.near');
      await step('mainnet-account', async () => { await goto('/you', '.banner'); await page.getByText(/That is a mainnet account/).waitFor(); await page.screenshot({ path: `${out}/${width}-mainnet-account-state.png`, fullPage: true }); await page.locator('.banner').getByRole('button', { name: 'Sign out', exact: true }).click(); await page.getByText('No wallet connected', { exact: true }).waitFor(); });
      await fresh('worker.outlayer.testnet');
      await step('positions-empty', async () => { await goto('/you', '.state-empty'); await page.getByText('No shares yet', { exact: true }).waitFor(); });
      await fresh(); await page.route(rpcPattern, route => route.abort('failed'));
      await step('rpc-down', async () => { await goto('/app', '.problem'); await page.getByText(/Cannot reach NEAR testnet/).waitFor(); }, true);
      await step('rpc-retry', async () => { await page.unroute(rpcPattern); await page.getByRole('button', { name: 'Try again', exact: true }).click(); await page.locator(width === 1440 ? '.mcard' : '.ev-card').first().waitFor(); await page.waitForFunction(() => !document.querySelector('.problem,.skeleton')); });
      await fresh(); await page.route(rpcPattern, route => route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"code":-429,"message":"Rate limits exceeded"}}' }));
      await step('rpc-rate-limit', async () => { await goto('/app', '.problem'); await page.getByText(/The NEAR RPC is rate-limiting us/).waitFor(); }, true);
      await fresh(); await page.route('https://testnet-api.outlayer.ai/attestations/**', route => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
      await step('attestation-unavailable', async () => { await goto('/market/fomc-2026-01-inflation-40', '.run .problem'); await page.getByText(/The TEE attestation is not published yet/).first().waitFor(); assert.equal(await page.locator('.paper-text mark').count(), 40); }, true);
      await step('attestation-retry', async () => { await page.unroute('https://testnet-api.outlayer.ai/attestations/**'); for (const button of await page.getByRole('button', { name: 'Try again', exact: true }).all()) await button.click(); await page.waitForFunction(() => [...document.querySelectorAll('.run .seal')].every(s => s.textContent.includes('Seal verified')), undefined, { timeout: 60000 }); });
      await context.close();
    }
    for (const href of links) { const path = href.split('#')[0]; const known = ['/', '/app', '/resolved', '/you', '/creators'].includes(path) || ids.some(id => path === '/market/' + id); report.internal_links.push({ href, known_route: known }); if (!known) failed++; }
    report.external_links = [...externals]; report.failures = failed; report.finished_at = new Date().toISOString(); await persist();
  } finally { await browser.close(); clearInterval(heartbeat); }
});
console.log(`QA: ${report.cases.length} cases; ${failed} failures; ${out}/audit.json`);
if (failed) process.exitCode = 1;
