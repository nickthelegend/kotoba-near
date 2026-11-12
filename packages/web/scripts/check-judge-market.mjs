// Read-only browser checks of the actual replay market; never resolves the one-shot demo.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
delete process.env.DEBUG; delete process.env.PWDEBUG;
const { chromium } = await import('playwright-core');
const { KeyPair } = createRequire(import.meta.url)('near-api-js');
const root = resolve(import.meta.dirname, '../../..');
const record = JSON.parse(await readFile(resolve(root, 'deployments/judge-market-2026-11-12.json'), 'utf8'));
const base = process.env.KOTOBA_WEB || 'http://127.0.0.1:5592';
assert.equal(new URL(base).hostname, '127.0.0.1'); assert.ok(+new URL(base).port >= 5300 && +new URL(base).port <= 5999);
const shots = '/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/kotoba/judging-r2';
await mkdir(shots, { recursive: true });
const rpc = async (method, params) => {
  const r = await fetch(record.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'judge-check', method, params }), signal: AbortSignal.timeout(20000) });
  const b = await r.json(); assert.ok(r.ok && !b.error, 'READ_RPC_UNAVAILABLE'); return b.result;
};
const live = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: record.contract, method_name: 'get_market', args_base64: Buffer.from(JSON.stringify({ id: record.args.id })).toString('base64') });
const market = JSON.parse(Buffer.from(live.result));
assert.equal(market.status, 'Open'); assert.equal(market.pending, false); assert.equal(market.result, null);
assert.ok(market.close_ns / 1e6 < Date.now() && market.deadline_ns / 1e6 > Date.parse('2026-11-18T23:59:59Z'));
const publicKeyFixture = KeyPair.fromRandom('ed25519').toString(); // Unregistered test key, not a funded credential.
const cases = [];
for (;;) {
  const state = execFileSync('memory_pressure', { encoding: 'utf8' }).trim().split('\n').at(-1);
  const free = Number(state.match(/(\d+(?:\.\d+)?)%/)?.[1]);
  if (!Number.isFinite(free)) throw Error('MEMORY_PRESSURE_UNAVAILABLE');
  if (free >= 30) break;
  console.log('Waiting for 30% free system memory.'); await new Promise(r => setTimeout(r, 120000));
}
await withChromeLock(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 375]) for (const [kind, account] of [['funded-view', record.contract], ['low-balance', `player.${record.contract}`]]) {
      const a = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: account });
      const spendable = BigInt(a.amount) - BigInt(a.storage_usage) * 10n ** 19n;
      const need = 421n * 10n ** 21n;
      assert.ok(kind === 'funded-view' ? spendable >= need : spendable < need);
      const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 812 } });
      let writes = 0;
      await context.route('**/*', async route => {
        let body; try { body = route.request().postDataJSON(); } catch {}
        if (body?.jsonrpc && !['query', 'tx', 'status', 'block', 'gas_price'].includes(body.method)) { writes++; return route.abort('blockedbyclient'); }
        return route.continue();
      });
      try {
        const page = await context.newPage(); const errors = []; let popups = 0;
        page.on('pageerror', () => errors.push('pageerror')); page.on('popup', () => popups++);
        await page.addInitScript(({ account, fixture, contract }) => {
          localStorage.setItem('default_meteor_wallet_auth_key', JSON.stringify({ accountId: account, allKeys: [] }));
          localStorage.setItem(`_meteor_wallet${account}:testnet`, fixture);
          localStorage.setItem('near-wallet-selector:selectedWalletId', JSON.stringify('meteor-wallet'));
          localStorage.setItem('near-wallet-selector:contract', JSON.stringify({ contractId: contract, methodNames: [] }));
        }, { account, fixture: publicKeyFixture, contract: record.contract });
        await page.goto(`${base}/market/${record.args.id}`, { waitUntil: 'domcontentloaded' });
        const button = page.getByRole('button', { name: 'Resolve with OutLayer · 0.12 NEAR', exact: true });
        await button.waitFor({ timeout: 60000 }); assert.equal(await button.isDisabled(), false);
        await page.getByText('Published transcript · replay demo', { exact: true }).waitFor();
        if (kind === 'low-balance') { await button.click(); await page.locator('.settle .problem').filter({ hasText: 'Not enough NEAR' }).waitFor({ timeout: 30000 }); }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(/\bundefined\b|\bNaN\b|TypeError:/.test(await page.locator('body').innerText()), false);
        assert.deepEqual(errors, []); assert.equal(writes, 0); assert.equal(popups, 0);
        const shot = `${shots}/resolve-${kind}-${width}.png`; await page.screenshot({ path: shot, fullPage: true });
        cases.push({ width, kind, account, spendable_yocto: spendable.toString(), button_enabled: true, writes, popups, page_errors: errors.length, screenshot: shot, status: 'pass' });
        console.log(`PASS ${width} ${kind}: resolve wired, no transaction sent`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
await writeFile(`${shots}/resolve-checks.json`, JSON.stringify({ at: new Date().toISOString(), market, creation_tx: record.tx, cases }, null, 2) + '\n');
