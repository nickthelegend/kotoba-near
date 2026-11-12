// Real, scoped QA signer proof. Never signs for the reserved October market.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { withChromeLock } from '/Volumes/Extreme SSD/Projects/grokbot/orchestration/chrome-lock.mjs';
delete process.env.DEBUG; delete process.env.PWDEBUG;
const { chromium } = await import('playwright-core');
const root = resolve(import.meta.dirname, '../../..'), contract = 'kotoba-edfa2b47.testnet';
const id = 'fomc-2026-09-inflation-replay', reserved = 'fomc-2026-10-inflation-replay';
const rpcUrl = 'https://near-testnet.drpc.org', date = '2026-11-12';
const ledgerFile = resolve(root, `deployments/r3-${date}.json`), proofFile = resolve(root, `deployments/judge-path-proof-${date}.json`);
const shots = '/Volumes/Extreme SSD/Projects/grokbot/orchestration/shots/kotoba/r3';
const method = process.argv.includes('--finalize') ? 'finalize' : 'resolve';
const wait = ms => new Promise(r => setTimeout(r, ms));
const rpc = async (method, params) => { const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'r3-proof', method, params }), signal: AbortSignal.timeout(20000) }); const b = await r.json(); if (!r.ok || b.error) throw Error('R3_RPC_UNAVAILABLE'); return b.result; };
const view = async (method_name, args) => { const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') }); return JSON.parse(Buffer.from(r.result)); };
const balance = async () => { const a = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: contract }); return { amount: a.amount, storage_usage: a.storage_usage, spendable: (BigInt(a.amount) - BigInt(a.storage_usage) * 10n ** 19n).toString() }; };
const creation = JSON.parse(await readFile(resolve(root, `deployments/r3-create-proof-${date}.json`), 'utf8'));
let ledger, proof, server;
try { ledger = JSON.parse(await readFile(ledgerFile, 'utf8')); } catch { ledger = { at: new Date().toISOString(), contract, cap_yocto: (3n * 10n ** 23n).toString(), initial: creation.before, transactions: [{ method: 'create_market', id, hash: creation.tx, status: creation.status, gas_burnt_yocto: creation.tokens_burnt_yocto }], reserved_original_before: await view('get_market', { id: reserved }) }; }
try { proof = JSON.parse(await readFile(proofFile, 'utf8')); } catch { proof = { contract, id, create: creation, transactions: [] }; }
const save = async () => { await writeFile(ledgerFile, JSON.stringify(ledger, null, 2) + '\n'); await writeFile(proofFile, JSON.stringify(proof, null, 2) + '\n'); };
try {
  assert.equal(ledger.reserved_original_before.status, 'Open'); assert.equal(ledger.reserved_original_before.result, null);
  assert.ok(!ledger.transactions.some(t => t.method === method && t.status !== 'failed'), 'METHOD_ALREADY_SIGNED_RESUME_PUBLIC_HASH');
  let market = await view('get_market', { id });
  if (method === 'resolve') { assert.equal(market.status, 'Open'); while (market.close_ns / 1e6 > Date.now()) await wait(1000); }
  else { assert.equal(market.status, 'Provisional'); assert.ok(Date.now() >= market.challenge_until_ns / 1e6, 'CHALLENGE_WINDOW_STILL_OPEN'); }
  const before = await balance(); const spent = BigInt(ledger.initial.amount) - BigInt(before.amount);
  const gas = method === 'resolve' ? 300_000_000_000_000n : 30_000_000_000_000n;
  const price = BigInt((await rpc('gas_price', [null])).gas_price);
  assert.ok(spent + gas * price * 2n + (method === 'resolve' ? 20n * 10n ** 21n : 0n) < 3n * 10n ** 23n, 'R3_TOTAL_CAP');
  assert.ok(BigInt(before.spendable) >= gas * 1_000_000_000n + (method === 'resolve' ? 120n * 10n ** 21n : 0n) + 10n ** 21n, 'LOW_DEMO_BALANCE');
  await save(); await mkdir(shots, { recursive: true });
  const memory = execFileSync('memory_pressure', { encoding: 'utf8' }).match(/free percentage: (\d+)%/);
  assert.ok(memory && +memory[1] >= 30, 'WAIT_FOR_30_PERCENT_MEMORY');
  let port = 5593;
  while (port <= 5999) { try { execFileSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { stdio: 'ignore' }); port++; } catch (e) { if (e.status === 1) break; throw e; } }
  assert.ok(port <= 5999);
  server = spawn(process.execPath, [resolve(root, 'packages/web/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: resolve(root, 'packages/web'), detached: true, stdio: 'ignore', env: { ...process.env, VITE_QA_SIGNER: '1', VITE_NEAR_TESTNET_RPC: rpcUrl } });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await wait(250); }
  const credentials = JSON.parse(await readFile(resolve(root, '.near-credentials/deployer.json'), 'utf8')); assert.equal(credentials.account_id, contract);
  await withChromeLock(async () => {
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        await context.exposeBinding('__KOTOBA_QA_REPORT_TX__', async (_source, e) => {
          assert.equal(e.receiverId, contract); assert.equal(e.accountId, contract); assert.deepEqual(e.methods, [method]);
          const publicEvent = { method, id, hash: e.hash, status: e.stage, deposit_yocto: e.depositYocto, gas: e.gas, gas_burnt_yocto: e.gasBurntYocto, at: e.at };
          const old = ledger.transactions.find(t => t.hash === e.hash); if (old) Object.assign(old, publicEvent); else ledger.transactions.push(publicEvent);
          await save();
        });
        const page = await context.newPage(); const errors = []; page.on('pageerror', () => errors.push('pageerror'));
        await page.addInitScript(({ origin, config }) => { if (location.origin === origin) window.__KOTOBA_QA_SIGNER__ = config; }, { origin: base, config: { accountId: credentials.account_id, secretKey: credentials.secret_key, rpcUrl, allowedMethods: [method], allowedMarketIds: [id] } });
        await page.goto(`${base}/market/${id}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: `Connect to ${method}`, exact: true }).click({ timeout: 60000 });
        const button = page.getByRole('button', { name: method === 'resolve' ? 'Resolve with OutLayer · 0.12 NEAR' : 'Finalize', exact: true });
        await button.waitFor({ timeout: 60000 }); await page.screenshot({ path: `${shots}/before-${method}-1440.png`, fullPage: true });
        await button.click(); await page.locator('.settle .why.ok').waitFor({ timeout: 240000 });
        assert.deepEqual(errors, []); await page.screenshot({ path: `${shots}/after-${method}-1440.png`, fullPage: true });
      } finally { await context.close(); }
    } finally { await browser.close(); }
  });
  const entry = ledger.transactions.findLast(t => t.method === method); assert.equal(entry.status, 'final');
  const outcome = await rpc('EXPERIMENTAL_tx_status', { tx_hash: entry.hash, sender_account_id: contract, wait_until: 'FINAL' });
  const call = outcome.transaction.actions[0].FunctionCall;
  assert.equal(call.method_name, method); assert.deepEqual(JSON.parse(Buffer.from(call.args, 'base64')), { id });
  market = await view('get_market', { id }); assert.equal(market.status, method === 'resolve' ? 'Provisional' : 'Final'); assert.ok(market.result);
  if (method === 'resolve') {
    const request = outcome.receipts.flatMap(r => r.receipt?.Action?.actions ?? []).map(a => a.FunctionCall).find(f => f?.method_name === 'request_execution');
    const output = outcome.receipts_outcome.find(r => r.outcome.executor_id === 'outlayer.testnet' && r.outcome.status.SuccessValue && Buffer.from(r.outcome.status.SuccessValue, 'base64').toString().includes('transcript_sha256'));
    proof.tx = entry.hash; proof.input = JSON.parse(Buffer.from(request.args, 'base64')).input_data; proof.output = Buffer.from(output.outcome.status.SuccessValue, 'base64').toString();
  }
  proof[method] = { tx: entry.hash, market, at: new Date().toISOString() }; proof.market = market;
  if (method === 'finalize') {
    const bondReturn = outcome.receipts.find(r => r.receiver_id === contract && r.receipt?.Action?.actions?.some(a => a.Transfer?.deposit === '100000000000000000000000'));
    assert.ok(bondReturn, 'BOND_RETURN_RECEIPT_MISSING');
    proof.finalize.bond_return = { receipt_id: bondReturn.receipt_id, receiver: contract, amount_yocto: '100000000000000000000000' };
  }
  ledger.after = await balance(); ledger.cumulative_net_spend_yocto = (BigInt(ledger.initial.amount) - BigInt(ledger.after.amount)).toString();
  ledger.additional_storage_locked_yocto = (BigInt(ledger.after.storage_usage - ledger.initial.storage_usage) * 10n ** 19n).toString();
  ledger.reserved_original_after = await view('get_market', { id: reserved }); assert.equal(ledger.reserved_original_after.status, 'Open'); assert.equal(ledger.reserved_original_after.result, null);
  assert.ok(BigInt(ledger.cumulative_net_spend_yocto) < 3n * 10n ** 23n); await save();
  console.log(JSON.stringify({ method, hash: entry.hash, status: market.status, count: market.result.count, challenge_until: market.challenge_until_ns && new Date(market.challenge_until_ns / 1e6).toISOString(), net_spend_yocto: ledger.cumulative_net_spend_yocto }));
} catch (e) { console.error(/^[A-Z0-9_]+$/.test(e.message) ? e.message : 'R3_PROOF_CHECK_FAILED_SEE_PUBLIC_LEDGER'); process.exitCode = 1; }
finally { if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} } }
