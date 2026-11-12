// No signing: before/after live seals, failure recovery and static hard-refresh routes.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
delete process.env.DEBUG; delete process.env.PWDEBUG;
const { chromium } = await import('playwright-core');
const root = resolve(import.meta.dirname, '../../..');
const before = process.argv.includes('--before');
const sourceRoot = before ? process.env.KOTOBA_BASELINE_ROOT : root;
assert.ok(sourceRoot);
const dir = '/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/kotoba/r3';
await mkdir(dir, { recursive: true });
assert.ok(Number(execFileSync('memory_pressure', { encoding: 'utf8' }).match(/free percentage: (\d+)%/)?.[1]) >= 30, 'WAIT_FOR_MEMORY');
if (!before) {
  const assets = resolve(root, 'packages/web/dist/assets');
  for (const name of await readdir(assets)) assert.ok(!/qa-signer|QA signer|__KOTOBA_QA/.test(name + await readFile(resolve(assets, name), 'utf8')), 'QA_SIGNER_IN_PRODUCTION');
}
const proof = JSON.parse(await readFile(resolve(root, 'deployments/judge-path-proof-2026-11-12.json'), 'utf8'));
const rows = [], errors = [];
let server;
try {
  let port = 5594;
  while (port <= 5999) { try { execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { stdio: 'ignore' }); port++; } catch (e) { if (e.status === 1) break; throw e; } }
  assert.ok(port <= 5999);
  server = spawn(process.execPath, [resolve(sourceRoot, 'packages/web/node_modules/vite/bin/vite.js'), ...(before ? [] : ['preview']), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: resolve(sourceRoot, 'packages/web'), detached: true, stdio: 'ignore', env: { ...process.env, VITE_QA_SIGNER: '0' } });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(r => setTimeout(r, 250)); }
  await withChromeLock(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      for (const width of [1440, 375]) {
        const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 812 }, reducedMotion: 'reduce' });
        try {
          const page = await context.newPage(); page.on('pageerror', () => errors.push('pageerror'));
          for (const id of ['fomc-2026-01-inflation-40', 'fomc-2026-01-recession', proof.id]) {
            const r = await page.goto(`${base}/market/${id}`, { waitUntil: 'domcontentloaded' }); assert.equal(r.status(), 200);
            await page.locator('.market-head').waitFor({ timeout: 60000 });
            if (id.startsWith('fomc-2026-01')) {
              const count = id.endsWith('-40') ? 2 : 1;
              await page.waitForFunction(n => document.querySelectorAll('.seal-ok').length === n, count, { timeout: 90000 });
              assert.equal(await page.locator('.run .checks li.ok').count(), count * 6);
              assert.equal(await page.getByText('check with the SDK', { exact: false }).count(), 0);
            } else if (!before) {
              await page.waitForFunction(() => document.querySelectorAll('.seal-ok').length === 1, undefined, { timeout: 90000 });
              assert.equal(await page.locator('.run .checks li.ok').count(), 5);
              assert.equal(await page.locator('.run .checks li').count(), 6);
              assert.ok((await page.locator('.run .checks code').innerText()).includes(`--tx ${proof.tx} --sender ${proof.contract}`));
              assert.equal(await page.locator('.verdict-n').innerText(), String(JSON.parse(proof.output).count));
            } else assert.equal(await page.locator('.runs').count(), 0);
            await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            const shot = `${dir}/${before ? 'before' : 'after'}-${id}-${width}.png`;
            await page.screenshot({ path: shot, fullPage: true }); rows.push({ width, id, shot, seals: await page.locator('.seal-ok').count(), status: 'pass' });
          }
          if (!before) {
            await page.route('https://api-testnet.nearblocks.io/v3/accounts/**', r => r.abort());
            await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByText('Seal lookup unavailable', { exact: true }).waitFor();
            assert.equal(await page.locator('.seal-ok').count(), 0);
            await page.screenshot({ path: `${dir}/lookup-failure-${width}.png`, fullPage: true });
            await page.unroute('https://api-testnet.nearblocks.io/v3/accounts/**');
            await page.getByRole('button', { name: 'Try again', exact: true }).click();
            await page.waitForFunction(() => document.querySelectorAll('.seal-ok').length === 1, undefined, { timeout: 90000 });
            rows.push({ width, state: 'lookup failure and real retry', status: 'pass' });
            for (const path of ['/', '/app', `/market/${proof.id}`]) {
              const response = await page.goto(base + path); assert.equal(response.status(), 200); await page.reload();
              await page.locator(path === '/' ? '.l-stats' : path === '/app' ? '.mcard,.ev-card' : '.market-head').first().waitFor({ timeout: 60000 });
              rows.push({ width, path, hard_refresh: 'pass' });
            }
          }
          assert.deepEqual(errors, []);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  });
  await writeFile(`${dir}/${before ? 'before' : 'after'}-checks.json`, JSON.stringify({ at: new Date().toISOString(), rows, errors, production_excludes_qa: !before }, null, 2) + '\n');
  console.log(`PASS ${before ? 'baseline' : 'production'}: ${rows.length} checks, zero page errors`);
} catch (e) { console.error(String(e.message).split('\n')[0]); process.exitCode = 1; }
finally { if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} } }
