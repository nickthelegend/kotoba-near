// Kotoba v4 deployment, listing and demo liquidity on NEAR testnet. Every signed transaction is saved
// before broadcast, so a rerun follows saved hashes instead of spending twice.
//   node scripts/markets.mjs deploy --send   create accounts, deploy, list events, seed books
//   node scripts/markets.mjs flow --send     one round of demo market-maker flow (run on a timer)
// Keys live in the gitignored .near-credentials/ and are never printed.
import { Account, Connection, KeyPair, keyStores, transactions, utils } from 'near-api-js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomInt } from 'node:crypto';

const root = resolve(import.meta.dirname, '../../..');
const RPC = 'https://test.rpc.fastnear.com';
const CONTRACT = 'kotoba-markets.testnet';
const MAKER = 'kotoba-mm.testnet';
const FLOW = 'flow.kotoba-mm.testnet';
const TRADER = 'trader.kotoba-markets.testnet';
const U = 10n ** 21n, C = U / 100n, FEE = 3n * U, NEAR = 10n ** 24n;
const TGAS = 10n ** 12n;
const evidencePath = resolve(root, 'deployments/markets-v4-2026-11-13.json');

// Opening YES prices come from how often each phrase appeared in the July 29, September 16 and
// October 28, 2026 press-conference transcripts (counts in deployments, see `basis`).
export const EVENTS = [
  {
    event_id: 'fed-2026-12-09',
    event: 'What will Warsh say at the December FOMC press conference?',
    pdf: 'https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20261209.pdf',
    close: '2026-12-09T19:00:00Z', deadline: '2027-01-09T00:00:00Z',
    words: [
      ['inflation-30', 'inflation', 30, 60, '40 / 23 / 33'],
      ['ai', 'ai', 1, 88, '7 / 3 / 7'],
      ['unemployment', 'unemployment', 1, 84, '1 / 4 / 2'],
      ['productivity', 'productivity', 1, 86, '3 / 1 / 7'],
      ['geopolitical', 'geopolitical', 1, 63, '0 / 3 / 4'],
      ['balance-sheet', 'balance sheet', 1, 58, '2 / 0 / 6'],
      ['oil', 'oil', 1, 52, '0 / 1 / 8'],
      ['housing', 'housing', 1, 34, '0 / 0 / 2'],
      ['tariffs', 'tariffs', 1, 27, '0 / 1 / 0'],
      ['recession', 'recession', 1, 9, '0 / 0 / 0'],
      ['stagflation', 'stagflation', 1, 7, '0 / 0 / 0'],
      ['bitcoin', 'bitcoin', 1, 4, '0 / 0 / 0'],
    ],
  },
  {
    event_id: 'fed-2027-01-27',
    event: 'What will Warsh say at the January FOMC press conference?',
    pdf: 'https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20270127.pdf',
    close: '2027-01-27T19:00:00Z', deadline: '2027-02-27T00:00:00Z',
    words: [
      ['inflation-30', 'inflation', 30, 57, '40 / 23 / 33'],
      ['ai', 'ai', 1, 85, '7 / 3 / 7'],
      ['oil', 'oil', 1, 48, '0 / 1 / 8'],
      ['recession', 'recession', 1, 12, '0 / 0 / 0'],
      ['shutdown', 'shutdown', 1, 15, '0 / 0 / 0'],
    ],
  },
];
export const marketId = (e, slug) => `${e.event_id}-${slug}`;

const fc = (method, args, deposit = 0n, gas = 60n * TGAS) => transactions.functionCall(method, args, gas, deposit);
let evidence;
try { evidence = JSON.parse(await readFile(evidencePath, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') throw e; evidence = { network: 'testnet', contract: CONTRACT, maker: MAKER, flow: FLOW, trader: TRADER, startedAt: new Date().toISOString(), note: 'Demo liquidity: every order and fill is real, placed by Kotoba-owned maker accounts. It is not customer volume.', transactions: [] }; }
const save = () => writeFile(evidencePath, JSON.stringify(evidence, null, 2) + '\n');

async function rpc(method, params) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method, params }), signal: AbortSignal.timeout(30000) });
      const b = await r.json();
      if (!r.ok || b.error) throw Error(`RPC_${method}_${b.error?.cause?.name ?? r.status}`);
      return b.result;
    } catch (e) { if (attempt >= 3) throw e; await new Promise(r => setTimeout(r, 2000)); }
  }
}
export async function view(method_name, args = {}, account_id = CONTRACT) {
  const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  return JSON.parse(Buffer.from(r.result));
}
const exists = async id => rpc('query', { request_type: 'view_account', finality: 'final', account_id: id }).then(() => true, e => { if (/UNKNOWN_ACCOUNT/.test(e.message)) return false; throw e; });

async function credential(file, accountId, create) {
  const path = resolve(root, '.near-credentials', file);
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT' || !create) throw Error('MISSING_CREDENTIAL_' + file);
    const k = KeyPair.fromRandom('ed25519');
    const c = { account_id: accountId, secret_key: k.toString() };
    await writeFile(path, JSON.stringify(c), { mode: 0o600, flag: 'wx' });
    return c;
  }
}
async function signer(file) {
  const c = await credential(file);
  const keys = new keyStores.InMemoryKeyStore();
  await keys.setKey('testnet', c.account_id, KeyPair.fromString(c.secret_key));
  return new Account(Connection.fromConfig({ networkId: 'testnet', provider: { type: 'JsonRpcProvider', args: { url: RPC } }, signer: { type: 'InMemorySigner', keyStore: keys } }), c.account_id);
}
const publicKey = async file => KeyPair.fromString((await credential(file)).secret_key).getPublicKey();

/** Signs once, saves the hash, broadcasts, then waits for FINAL. A rerun with the same label only follows the hash. */
async function send(label, file, receiver, actions) {
  let item = evidence.transactions.find(t => t.label === label);
  const a = await signer(file);
  if (!item) {
    const [hash, tx] = await a.signTransaction(receiver, actions);
    item = { label, hash: utils.serialize.base_encode(hash), signer: a.accountId, receiver, status: 'signed', at: new Date().toISOString() };
    evidence.transactions.push(item);
    await save();
    await rpc('send_tx', { signed_tx_base64: Buffer.from(tx.encode()).toString('base64'), wait_until: 'NONE' }).catch(() => {});
  }
  if (item.status === 'final') return item;
  let out;
  for (let i = 0; i < 80; i++) {
    out = await rpc('tx', { tx_hash: item.hash, sender_account_id: item.signer, wait_until: 'FINAL' }).catch(() => null);
    if (out?.final_execution_status === 'FINAL') break;
    await new Promise(r => setTimeout(r, 1500));
  }
  if (out?.final_execution_status !== 'FINAL') throw Error('UNCONFIRMED_' + label + '_follow_' + item.hash);
  const failure = out.status.Failure ?? out.receipts_outcome.find(r => r.outcome.status.Failure)?.outcome.status.Failure;
  item.status = failure ? 'failed' : 'final';
  item.gasBurntYocto = [out.transaction_outcome, ...out.receipts_outcome].reduce((n, r) => n + BigInt(r.outcome.tokens_burnt), 0n).toString();
  if (failure) item.failure = JSON.stringify(failure).slice(0, 300);
  await save();
  if (failure) throw Error('FAILED_' + label + ' ' + item.failure);
  console.log(label, item.hash);
  return item;
}

async function helperAccount(file, id) {
  const c = await credential(file, id, true);
  if (await exists(id)) return;
  const r = await fetch('https://helper.nearprotocol.com/account', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newAccountId: id, newAccountPublicKey: KeyPair.fromString(c.secret_key).getPublicKey().toString() }) });
  if (!r.ok) throw Error(`HELPER_${r.status}_${(await r.text()).slice(0, 120).replace(/[^\w .-]/g, '')}`);
  evidence.funding = [...(evidence.funding ?? []), { account: id, source: 'NEAR testnet helper faucet', at: new Date().toISOString() }];
  await save();
  for (let i = 0; i < 20 && !(await exists(id)); i++) await new Promise(r => setTimeout(r, 1500));
}

const order = (id, yes, buy, price, quantity, kind = 'limit', tgas = 30n) =>
  fc('place_order', { id, yes, buy, price, quantity, kind }, FEE + (buy ? BigInt(price) * BigInt(quantity) * C : 0n), tgas * TGAS);

async function deploy() {
  await helperAccount('markets.json', CONTRACT);
  await helperAccount('mm.json', MAKER);
  const wasm = await readFile(resolve(root, 'packages/contract/target/near/kotoba_book.wasm'));
  evidence.wasmSha256 = createHash('sha256').update(wasm).digest('hex');
  const [wasm_url, wasm_hash, challenge_window_ns] = await view('config', {}, 'kotoba-edfa2b47.testnet');
  evidence.oracle = { wasm_url, wasm_hash, challenge_window_ns };
  await save();
  await send('deploy', 'markets.json', CONTRACT, [transactions.deployContract(wasm), fc('new', { wasm_url, wasm_hash, challenge_window_ns }, 0n, 30n * TGAS)]);
  await credential('flow.json', FLOW, true);
  await credential('trader-v4.json', TRADER, true);
  if (!(await exists(FLOW))) await send('create-flow', 'mm.json', FLOW, [transactions.createAccount(), transactions.transfer(2n * NEAR), transactions.addKey(await publicKey('flow.json'), transactions.fullAccessKey())]);
  if (!(await exists(TRADER))) await send('create-trader', 'markets.json', TRADER, [transactions.createAccount(), transactions.transfer(NEAR / 2n), transactions.addKey(await publicKey('trader-v4.json'), transactions.fullAccessKey())]);

  for (const e of EVENTS) {
    const listing = e.words.map(([slug, phrase, threshold]) => fc('create_market', { id: marketId(e, slug), event_id: e.event_id, event: e.event, source_url: e.pdf, phrase, threshold, close_ns: Date.parse(e.close) * 1e6, deadline_ns: Date.parse(e.deadline) * 1e6 }, 0n, 20n * TGAS));
    await send('list-' + e.event_id, 'markets.json', CONTRACT, listing);
  }
  // The maker mints pairs and quotes a ladder on both sides; the second maker adds outer depth.
  for (const e of EVENTS) for (const [slug, , , fair] of e.words) {
    const id = marketId(e, slug);
    const asks = [1, 2, 4, 6].map(o => fair + o).filter(p => p <= 99);
    const bids = [1, 2, 4, 6].map(o => fair - o).filter(p => p >= 1);
    const sizes = [4, 6, 9, 12];
    await send('quote-' + id, 'mm.json', CONTRACT, [
      fc('mint_pairs', { id, quantity: 80 }, FEE + 80n * U, 30n * TGAS),
      ...asks.map((p, i) => order(id, true, false, p, sizes[i])),
      ...bids.map((p, i) => order(id, false, false, 100 - p, sizes[i])),
    ]);
    const outer = [fair - 3, fair - 8].filter(p => p >= 1);
    if (outer.length) await send('depth-' + id, 'flow.json', CONTRACT, outer.map((p, i) => order(id, true, true, p, 5 + 3 * i)));
  }
  evidence.deployedAt = new Date().toISOString();
  await save();
}

/** One round of demo flow: a few words move a cent or two as the second maker takes the inside quote,
 * and the first maker refills its ladder. Fair values drift around the opening price. */
async function flow(rounds = 1) {
  const snap = await view('snapshot', { account: MAKER });
  const all = EVENTS.flatMap(e => e.words.map(w => ({ id: marketId(e, w[0]), open: w[3] })));
  for (let r = 0; r < rounds; r++) {
    const picks = [...all].sort(() => randomInt(1000) - 500).slice(0, 4);
    const tag = new Date().toISOString().slice(0, 16);
    for (const { id, open } of picks) {
      const book = (await view('get_book', { id }));
      const ask = book.asks[0], bid = book.bids[0];
      if (!ask || !bid) continue;
      const mid = (ask.price + bid.price) / 2;
      // Mean-reverting walk: lean back toward the opening price, with noise.
      const up = randomInt(100) < 50 + Math.max(-25, Math.min(25, (open - mid) * 4));
      const take = Math.min(up ? ask.shares : bid.shares, 2 + randomInt(4));
      const label = `flow-${tag}-${id}`;
      if (evidence.transactions.some(t => t.label === label)) continue;
      // Buying YES lifts the ask; buying NO hits the YES bid (a NO buy at 100 - bid).
      try { await send(label, 'flow.json', CONTRACT, [up ? order(id, true, true, ask.price, take, 'market', 100n) : order(id, false, true, 100 - bid.price, take, 'market', 100n)]); }
      catch (e) { console.error('skipped', id, e.message.slice(0, 80)); continue; }
      const after = await view('get_book', { id });
      const held = snap.held;
      const refill = [];
      const a0 = after.asks[0]?.price ?? ask.price, b0 = after.bids[0]?.price ?? bid.price;
      if (after.asks.length < 4 && a0 + 1 <= 99) refill.push(order(id, true, false, Math.min(99, (after.asks.at(-1)?.price ?? a0) + 1 + randomInt(2)), 4 + randomInt(6)));
      if (after.bids.length < 4 && b0 - 1 >= 1) refill.push(order(id, false, false, 100 - Math.max(1, (after.bids.at(-1)?.price ?? b0) - 1 - randomInt(2)), 4 + randomInt(6)));
      // Keep the inside tight after a move: quote one level next to the new last price.
      if (up && after.bids[0] && a0 - after.bids[0].price > 2) refill.push(order(id, false, false, 100 - (a0 - 2), 3 + randomInt(4)));
      if (!up && after.asks[0] && after.asks[0].price - b0 > 2) refill.push(order(id, true, false, b0 + 2, 3 + randomInt(4)));
      const yesHeld = held[id + ':YES'] ?? 0, noHeld = held[id + ':NO'] ?? 0;
      if (refill.length) await send(`refill-${tag}-${id}`, 'mm.json', CONTRACT, yesHeld < 30 || noHeld < 30 ? [fc('mint_pairs', { id, quantity: 60 }, FEE + 60n * U, 30n * TGAS), ...refill] : refill).catch(e => console.error('refill skipped', id, e.message.slice(0, 80)));
    }
  }
}

const [cmd] = process.argv.slice(2);
try {
  if (!process.argv.includes('--send')) throw Error('EXPLICIT_SEND_FLAG_REQUIRED');
  if (cmd === 'deploy') await deploy();
  else if (cmd === 'flow') await flow();
  else throw Error('USAGE_deploy_or_flow');
} catch (e) {
  console.error(/^[\w .:/-]+$/.test(e.message) ? e.message : 'MARKETS_SCRIPT_FAILED ' + String(e.message).replace(/ed25519:\w+/g, '[key]').slice(0, 300));
  process.exitCode = 1;
}
