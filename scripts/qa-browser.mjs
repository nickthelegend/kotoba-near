// Real browser integration test. Credentials are read in Node and injected only in memory.
// No traces, videos, HAR files, storage-state files, credential logging or credential copies.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { withChromeLock, LOCK } from '/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/0f121b7c-0081-4ec0-81a9-0ccb4f7f8b48/scratchpad/chrome-lock.mjs';
import { utimesSync } from 'node:fs';

// Do not let an inherited Playwright debug setting log credential injection arguments.
delete process.env.DEBUG;
delete process.env.PWDEBUG;
const { chromium } = await import('playwright-core');

const root = resolve(import.meta.dirname, '..');
const rpcUrl = 'https://near-testnet.drpc.org';
const deployment = JSON.parse(await readFile(resolve(root, 'deployments/testnet-2026-11-09.json'), 'utf8'));
const contract = deployment.contract_id;
const accountId = `player.${contract}`;
const market = 'fomc-2026-12-employment';
const marketPath = `/market/${market}`;
const cap = 3n * 10n ** 23n;
const date = new Date().toISOString().slice(0, 10);
const evidencePath = resolve(root, `deployments/qa-browser-${date}.json`);
const shots = '/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-grokbot/0f121b7c-0081-4ec0-81a9-0ccb4f7f8b48/scratchpad/flow-qa/kotoba/qa-signer';
const wait = ms => new Promise(r => setTimeout(r, ms));
function injectStartup({ config, origin }) {
  if (location.origin === origin) window.__KOTOBA_QA_SIGNER__ = config;
}
let phase = 'preflight', browser, server, heartbeat;
let evidence;
try { evidence = JSON.parse(await readFile(evidencePath, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; evidence = { network: 'testnet', contract, account: accountId, cap_yocto: cap.toString(), runs: [] }; }
const run = { started_at: new Date().toISOString(), status: 'running', screenshots: shots, transactions: [], cases: [] };
const persist = () => writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
async function memoryGate(label) {
  for (;;) {
    const status = execFileSync('sysctl', ['vm.swapusage'], { encoding: 'utf8' }).trim();
    console.log(label, status);
    const m = status.match(/free = ([\d.]+)([MG])/);
    if (m && Number(m[1]) * (m[2] === 'G' ? 1024 : 1) >= 500) return;
    console.log('Free swap below 500 MB; waiting two minutes.'); await wait(120000);
  }
}
async function rpc(method, params) {
  const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'qa-browser', method, params }), signal: AbortSignal.timeout(15000) });
  const body = await r.json(); if (!r.ok || body.error) throw new Error(`QA_RPC_${method.toUpperCase()}_UNAVAILABLE`); return body.result;
}
async function view(method_name, args) {
  const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  return JSON.parse(Buffer.from(r.result).toString());
}
async function snapshot() {
  const a = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: accountId });
  return { amount: a.amount, storage_usage: a.storage_usage, spendable: (BigInt(a.amount) - BigInt(a.storage_usage) * 10n ** 19n).toString(), yes_shares: await view('balance_of', { id: market, account: accountId, yes: true }) };
}
function freePort(start) {
  for (let p = start; p <= 5999; p++) {
    try { execFileSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN'], { stdio: 'ignore' }); }
    catch (e) { if (e.status === 1) return p; throw e; }
  }
  throw new Error('QA_NO_FREE_PORT');
}
async function startServer(qa) {
  const port = freePort(qa ? 5584 : 5583);
  const args = ['--filter', '@kotoba/web', 'exec', 'vite', ...(qa ? [] : ['preview']), '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
  server = spawn('pnpm', args, { cwd: root, detached: true, stdio: 'ignore', env: { ...process.env, VITE_QA_SIGNER: qa ? '1' : '0', VITE_NEAR_TESTNET_RPC: rpcUrl } });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error('QA_SERVER_EXITED');
    try { if ((await (await fetch(base)).text()).includes('Kotoba')) return base; } catch {}
    await wait(500);
  }
  throw new Error('QA_SERVER_NOT_READY');
}
function stopServer() { if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} server = undefined; } }
async function load(page, base, path = '/app') {
  await page.goto(base + path, { waitUntil: 'domcontentloaded' });
  await page.getByText('employment', { exact: false }).first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /Connect/.test(b.textContent) && !b.disabled));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
}
async function assertLayout(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'QA_HORIZONTAL_OVERFLOW');
}
async function productionShots(base) {
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 812 } });
    try {
      const page = await context.newPage(); await load(page, base); await assertLayout(page);
      await page.screenshot({ path: `${shots}/after-production-${width}.png` });
      assert.equal(await page.locator('.banner').count(), 0, 'QA_PRODUCTION_WALLET_ERROR');
    } finally { await context.close(); }
  }
}
async function guards(base) {
  const results = [];
  for (const [label, config, expected] of [
    ['mainnet account refused', { accountId: 'qa.near', rpcUrl, secretKey: 'not-a-key' }, 'QA_TESTNET_ACCOUNT_REQUIRED'],
    ['mainnet RPC refused', { accountId, rpcUrl: 'https://rpc.mainnet.near.org', secretKey: 'not-a-key' }, 'QA_TESTNET_RPC_REQUIRED'],
  ]) {
    const context = await browser.newContext();
    try {
      await context.addInitScript(config => { window.__KOTOBA_QA_SIGNER__ = config; }, config);
      const page = await context.newPage(); await page.goto(base);
      const message = await page.evaluate(async contractId => {
        const { setupQaSigner } = await import('/src/qa-signer.ts');
        const module = await setupQaSigner()({ options: { network: { networkId: 'testnet' } } });
        const wallet = await module.init({});
        try { await wallet.signIn({ contractId }); return 'unexpected success'; } catch (e) { return e.message; }
      }, contract);
      assert.equal(message, expected, 'QA_NETWORK_GUARD_FAILED'); results.push(label);
    } finally { await context.close(); }
  }
  run.guards = results; await persist(); console.log('PASS: testnet account and RPC guards');
}
async function flow(base, credentials, width) {
  phase = `${width}: before connect`;
  const before = await snapshot();
  const quote = BigInt(await view('quote', { id: market, yes: true, quantity: 1 }));
  const deposit = quote + (quote * 200n + 9999n) / 10000n;
  assert.ok(deposit < 10n ** 22n, 'QA_UNEXPECTED_QUOTE_OVER_0_01_NEAR');
  const previousReservation = evidence.runs.flatMap(r => r.transactions).reduce((n, t) => n + BigInt(t.depositYocto) + BigInt(t.gas) * 1_000_000_000n + 10n ** 21n, 0n);
  assert.ok(previousReservation + deposit + 31n * 10n ** 21n <= cap, 'QA_DAILY_SPEND_RESERVATION_CAP');
  assert.ok(BigInt(before.spendable) >= deposit + 31n * 10n ** 21n, 'QA_LOW_TESTNET_BALANCE');
  const context = await browser.newContext({ viewport: { width, height: width === 1440 ? 900 : 812 } });
  let page;
  const events = [];
  try {
    await context.exposeBinding('__KOTOBA_QA_REPORT_TX__', async (_source, event) => {
      // Explicit public-field projection: no private/signed payload is ever persisted.
      assert.equal(event.accountId, accountId, 'QA_EVENT_ACCOUNT'); assert.equal(event.receiverId, contract, 'QA_EVENT_CONTRACT');
      const publicEvent = Object.fromEntries(['hash', 'accountId', 'receiverId', 'methods', 'depositYocto', 'gas', 'stage', 'at', 'gasBurntYocto'].filter(k => event[k] !== undefined).map(k => [k, event[k]]));
      const existing = run.transactions.find(t => t.hash === event.hash);
      if (existing) Object.assign(existing, publicEvent); else run.transactions.push({ ...publicEvent, viewport: width });
      events.push({ hash: event.hash, stage: event.stage }); await persist();
    });
    page = await context.newPage();
    await page.addInitScript(injectStartup, { origin: new URL(base).origin, config: { accountId: credentials.account_id, secretKey: credentials.secret_key, rpcUrl, approval: 'auto' } }); const errors = []; page.on('pageerror', () => errors.push('pageerror'));
    page.on('popup', () => errors.push('unexpected wallet popup'));
    await load(page, base); await assertLayout(page);
    await page.getByRole('button', { name: /^Connect(?: wallet)?$/ }).click();
    await page.waitForFunction(() => document.querySelector('.side-out') || document.querySelector('.ph-bal a[href="/you"]'));
    await page.getByRole('link', { name: 'You', exact: true }).click();
    await page.getByRole('link', { name: accountId, exact: true }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: `${shots}/connected-${width}.png` });
    await page.getByRole('link', { name: 'Board', exact: true }).click();
    phase = `${width}: quote and invalid input`;
    await page.locator(`a[href="${marketPath}"]`).first().click();
    await page.waitForURL('**' + marketPath);
    await page.locator('.yn-yes').click();
    const qty = page.getByRole('textbox', { name: 'Number of shares' });
    await qty.fill('1.5'); await page.locator('.field-err').filter({ hasText: 'Whole shares only (no decimals or signs)' }).waitFor();
    assert.equal(await page.locator('.sheet .btn-block').isDisabled(), true, 'QA_INVALID_QUANTITY_NOT_BLOCKED');
    await qty.fill('100000'); await page.getByText(/this order needs/).waitFor({ timeout: 30000 });
    assert.equal(await page.locator('.sheet .btn-block').isDisabled(), true, 'QA_BALANCE_NOT_BLOCKED');
    assert.equal(events.length, 0, 'QA_INVALID_INPUT_SIGNED');
    await page.screenshot({ path: `${shots}/balance-block-${width}.png` });
    await qty.fill('1');
    const buy = page.getByRole('button', { name: /^Buy 1 YES/ });
    await page.waitForFunction(() => [...document.querySelectorAll('.sheet button')].some(b => /^Buy 1 YES/.test(b.textContent) && !b.disabled));
    phase = `${width}: sign and wait for final`;
    await buy.click();
    await page.getByText('Bought 1 YES', { exact: true }).waitFor({ timeout: 180000 });
    const href = await page.locator('.sheet-done a').getAttribute('href'); const hash = href.split('/').at(-1);
    const recorded = run.transactions.find(t => t.hash === hash);
    assert.equal(recorded?.stage, 'final', 'QA_RECEIPT_BEFORE_FINAL');
    const outcome = await rpc('tx', { tx_hash: hash, sender_account_id: accountId, wait_until: 'FINAL' });
    assert.equal(outcome.final_execution_status, 'FINAL', 'QA_NOT_FINAL');
    assert.equal(outcome.transaction.signer_id, accountId, 'QA_CHAIN_SIGNER_MISMATCH');
    assert.equal(outcome.transaction.receiver_id, contract, 'QA_CHAIN_RECEIVER_MISMATCH');
    const call = outcome.transaction.actions[0].FunctionCall;
    assert.equal(call.method_name, 'buy', 'QA_CHAIN_METHOD_MISMATCH');
    assert.deepEqual(JSON.parse(Buffer.from(call.args, 'base64').toString()), { id: market, yes: true, quantity: 1 }, 'QA_CHAIN_ARGS_MISMATCH');

    assert.ok(!outcome.status.Failure && outcome.receipts_outcome.every(r => !r.outcome.status.Failure), 'QA_CONTRACT_FAILED');
    await assertLayout(page); await page.screenshot({ path: `${shots}/receipt-${width}.png` });
    phase = `${width}: position and reload`;
    await page.getByRole('link', { name: 'See positions', exact: true }).click(); await page.waitForURL('**/you');
    const row = page.locator('.position').filter({ hasText: 'employment' });
    await row.getByText(`${before.yes_shares + 1} YES`, { exact: true }).waitFor({ timeout: 30000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await row.getByText(`${before.yes_shares + 1} YES`, { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.evaluate(() => '__KOTOBA_QA_SIGNER__' in window), false, 'QA_STARTUP_KEY_NOT_REMOVED');
    const leaked = await page.evaluate(secret => [localStorage, sessionStorage].some(storage => Object.values(storage).some(value => value.includes(secret))), credentials.secret_key);
    assert.equal(leaked, false, 'QA_KEY_PERSISTED'); assert.deepEqual(errors, [], 'QA_BROWSER_ERROR');
    await assertLayout(page); await page.screenshot({ path: `${shots}/position-${width}.png` });
    const after = await snapshot(); assert.equal(after.yes_shares, before.yes_shares + 1, 'QA_CHAIN_POSITION_MISMATCH');
    assert.ok(BigInt(run.before.amount) - BigInt(after.amount) <= cap, 'QA_ACTUAL_SPEND_CAP');
    run.cases.push({ viewport: width, status: 'pass', hash, before, after, invalid_quantity: 'blocked without signing', insufficient_balance: 'blocked without signing', receipt: 'final', reload_preserved_position: true, private_key_persisted: false, page_errors: errors.length });
    await persist(); console.log(`PASS: ${width}px connect → buy → FINAL receipt → position ${before.yes_shares} → ${after.yes_shares} → reload`);
  } catch (e) {
    if (page) await page.screenshot({ path: `${shots}/failed-${width}.png` }).catch(() => {});
    throw e;
  } finally { await context.close(); }
}
try {
  assert.ok(contract.endsWith('.testnet') && accountId.endsWith('.testnet'), 'QA_TESTNET_ONLY');
  await mkdir(shots, { recursive: true });
  run.before = await snapshot();
  const quote = BigInt(await view('quote', { id: market, yes: true, quantity: 1 }));
  const required = 2n * (quote + (quote * 200n + 9999n) / 10000n + 31n * 10n ** 21n);
  if (BigInt(run.before.spendable) < required) throw new Error(`LOW TESTNET BALANCE: ${Number(run.before.spendable) / 1e24} NEAR spendable; need ${Number(required) / 1e24} NEAR for both viewports. No transaction sent.`);
  const state = await view('get_market', { id: market });
  assert.ok(state.status === 'Open' && state.close_ns > Date.now() * 1e6, 'QA_MARKET_CLOSED');
  evidence.runs.push(run); await persist();
  // The secret is read only here in Node, after funding checks, and never passed to the build/server.
  let credentials;
  try { credentials = JSON.parse(await readFile(resolve(root, '.near-credentials/player.json'), 'utf8')); } catch { throw new Error('QA_EXISTING_PLAYER_CREDENTIALS_REQUIRED'); }
  assert.equal(credentials.account_id, accountId, 'QA_WRONG_DEMO_ACCOUNT');
  phase = 'production exclusion';
  await memoryGate('before production build');
  execFileSync('pnpm', ['--filter', '@kotoba/web', 'build'], { cwd: root, stdio: 'ignore', env: { ...process.env, VITE_QA_SIGNER: '1' } });
  const assets = resolve(root, 'packages/web/dist/assets');
  const files = await readdir(assets); const markers = /kotoba-qa-signer|qa-signer|QA signer|__KOTOBA_QA/;
  for (const file of files) assert.ok(!markers.test(file) && !markers.test(await readFile(resolve(assets, file), 'utf8')), 'QA_SIGNER_IN_PRODUCTION_BUNDLE');
  run.production = { forced_flag: 'VITE_QA_SIGNER=1', qa_module_absent: true, checked_assets: files.length };
  await persist(); console.log('PASS: production bundle grep (including a forced QA flag)');
  await withChromeLock(async () => {
    heartbeat = setInterval(() => { const now = new Date(); try { utimesSync(LOCK, now, now); } catch {} }, 60000);
    await memoryGate('before browser');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      phase = 'production screenshots'; const production = await startServer(false); await productionShots(production); stopServer();
      const qa = await startServer(true); phase = 'testnet guards'; await guards(qa);
      for (const width of [1440, 375]) await flow(qa, credentials, width);
    } finally { await browser.close(); browser = undefined; stopServer(); clearInterval(heartbeat); }
  });
  run.after = await snapshot(); run.spent_yocto = (BigInt(run.before.amount) - BigInt(run.after.amount)).toString();
  run.status = 'pass'; run.finished_at = new Date().toISOString(); await persist();
  console.log('PASS: browser E2E; total spent', Number(run.spent_yocto) / 1e24, 'testnet NEAR');
  console.log('Public transaction evidence:', evidencePath); console.log('Screenshots:', shots);
} catch (error) {
  run.status = 'failed'; run.failed_phase = phase; run.finished_at = new Date().toISOString();
  run.failure = error.message.startsWith('LOW TESTNET BALANCE:') || /^QA_[A-Z0-9_]+$/.test(error.message) ? error.message : 'QA_BROWSER_FLOW_FAILED';
  if (evidence.runs.includes(run)) await persist();
  console.error(run.failure, '| phase:', phase); process.exitCode = 1;
} finally { stopServer(); clearInterval(heartbeat); if (browser) await browser.close(); }
