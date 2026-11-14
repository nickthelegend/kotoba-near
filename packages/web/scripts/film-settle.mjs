// Set-up for the v7 film's live settlement: one replay market on the published January 28, 2026 transcript,
// on the settlement contract kotoba-edfa2b47.testnet, so the film can resolve, challenge and claim it in the app.
// Steps (each signs once, testnet only, project-owned accounts only; keys are loaded by path and never printed):
// The first market, fomc-2026-01-tariffs-live, could not be resolved by trader.kotoba-markets.testnet: OutLayer failed every
// run that account requested (direct runs too), so the film uses player.kotoba-edfa2b47.testnet on fomc-2026-01-tariffs-film.
// Select with KOTOBA_FILM_MARKET=<id> and KOTOBA_FILM_ACCOUNT=<credential file> (defaults: the first market, trader-v4.json).
//   node film-settle.mjs status
//   node film-settle.mjs fund            kotoba-mm.testnet -> trader.kotoba-markets.testnet, 1 NEAR (gas and bonds for the film)
//   node film-settle.mjs create <secs>   the contract account lists the market; betting closes <secs> from now
//   node film-settle.mjs buy             the film's trader buys 20 Yes before the close
// Public evidence (hashes, args, market reads) is appended to deployments/film-v7-settlement-2026-11-14.json.
import { Account, Connection, KeyPair, keyStores, utils } from 'near-api-js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const CONTRACT = 'kotoba-edfa2b47.testnet';
const RPC = 'https://rpc.testnet.fastnear.com';
const ID = process.env.KOTOBA_FILM_MARKET ?? 'fomc-2026-01-tariffs-live';
const ACTOR = process.env.KOTOBA_FILM_ACCOUNT ?? 'trader-v4.json';
const SOURCE = 'https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf';
const FILE = resolve(root, 'deployments/film-v7-settlement-2026-11-14.json');
const cmd = process.argv[2] ?? 'status';

async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'film-settle', method, params }), signal: AbortSignal.timeout(30000) });
  const b = await r.json(); if (!r.ok || b.error) throw Error(`RPC_${method.toUpperCase()}_UNAVAILABLE ${JSON.stringify(b.error ?? r.status).slice(0, 200)}`); return b.result;
}
async function view(method_name, args) {
  const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: CONTRACT, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  return JSON.parse(Buffer.from(r.result).toString());
}
const balance = async id => { const a = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: id }); return utils.format.formatNearAmount(a.amount, 5); };
async function account(file) {
  const cred = JSON.parse(await readFile(resolve(root, '.near-credentials', file), 'utf8'));
  if (!cred.account_id.endsWith('.testnet')) throw Error('TESTNET_ONLY');
  const keys = new keyStores.InMemoryKeyStore();
  await keys.setKey('testnet', cred.account_id, KeyPair.fromString(cred.secret_key));
  const conn = Connection.fromConfig({ networkId: 'testnet', provider: { type: 'JsonRpcProvider', args: { url: RPC } }, signer: { type: 'InMemorySigner', keyStore: keys } });
  return new Account(conn, cred.account_id);
}
let evidence; try { evidence = JSON.parse(await readFile(FILE, 'utf8')); } catch { evidence = { contract: CONTRACT, market: ID, source_url: SOURCE, steps: [] }; }
async function record(step, outcome, extra = {}) {
  const hash = outcome.transaction.hash;
  const failed = [outcome.status, ...outcome.receipts_outcome.map(r => r.outcome.status)].some(s => s?.Failure);
  evidence.steps.push({ market: ID, step, tx: hash, explorer: `https://testnet.nearblocks.io/txns/${hash}`, signer: outcome.transaction.signer_id, receiver: outcome.transaction.receiver_id, status: failed ? 'failed' : 'final', at: new Date().toISOString(), ...extra });
  evidence.markets_after = { ...(evidence.markets_after ?? {}), [ID]: await view('get_market', { id: ID }).catch(() => null) };
  await writeFile(FILE, JSON.stringify(evidence, null, 2) + '\n');
  console.log(step, failed ? 'FAILED' : 'ok', hash);
  if (failed) throw Error(`${step} failed on chain: ${hash}`);
}

if (cmd === 'status') {
  console.log('trader', await balance('trader.kotoba-markets.testnet'), 'player', await balance('player.kotoba-edfa2b47.testnet'), 'mm', await balance('kotoba-mm.testnet'), 'contract', await balance(CONTRACT));
  console.log(JSON.stringify(await view('get_market', { id: ID }), null, 1));
} else if (cmd === 'fund') {
  const mm = await account('mm.json');
  const to = JSON.parse(await readFile(resolve(root, '.near-credentials', ACTOR), 'utf8')).account_id;
  const amount = utils.format.parseNearAmount('1');
  const out = await mm.sendMoney(to, BigInt(amount));
  await record(`fund ${to} (1 NEAR from kotoba-mm.testnet)`, out);
} else if (cmd === 'create') {
  const secs = Number(process.argv[3] ?? 240);
  if (!(secs >= 60 && secs <= 3600)) throw Error('CLOSE_SECONDS_60_TO_3600');
  if (await view('get_market', { id: ID })) throw Error('MARKET_EXISTS');
  const pdf = await fetch(SOURCE, { headers: { 'user-agent': 'Mozilla/5.0' } });
  const sha = Buffer.from(await crypto.subtle.digest('SHA-256', await pdf.arrayBuffer())).toString('hex');
  const args = { id: ID, event: 'FOMC press conference · 2026-01-28 · live settlement demo', source_url: SOURCE, phrase: 'tariffs', threshold: 10, close_ns: (Date.now() + secs * 1000) * 1e6, deadline_ns: Date.parse('2026-11-26T00:00:00Z') * 1e6, b: 100 };
  const deployer = await account('deployer.json');
  const out = await deployer.functionCall({ contractId: CONTRACT, methodName: 'create_market', args, gas: 50_000_000_000_000n, attachedDeposit: 70n * 10n ** 21n });
  await record('create market (contract account)', out, { args, source_check: { status: pdf.status, sha256: sha } });
} else if (cmd === 'buy') {
  const qty = 20;
  const quote = BigInt(await view('quote', { id: ID, yes: true, quantity: qty }));
  const trader = await account(ACTOR);
  const out = await trader.functionCall({ contractId: CONTRACT, methodName: 'buy', args: { id: ID, yes: true, quantity: qty }, gas: 30_000_000_000_000n, attachedDeposit: quote });
  await record(`buy ${qty} Yes (${trader.accountId})`, out, { quote_yocto: quote.toString() });
} else if (cmd === 'resolve') {
  // Resolve signed by the contract account itself (the only signer whose contract-routed OutLayer runs completed on Nov 14).
  const deployer = await account('deployer.json');
  const out = await deployer.functionCall({ contractId: CONTRACT, methodName: 'resolve', args: { id: ID }, gas: 300_000_000_000_000n, attachedDeposit: BigInt(process.env.KOTOBA_RESOLVE_MILLI ?? 120) * 10n ** 21n });
  const logs = out.receipts_outcome.flatMap(r => r.outcome.logs).filter(l => !l.startsWith('EVENT_JSON'));
  await record('resolve (contract account)', out, { logs });
  console.log(logs.join('\n'));
} else if (cmd === 'claim') {
  const holder = await account(ACTOR);
  const out = await holder.functionCall({ contractId: CONTRACT, methodName: 'claim', args: { id: ID }, gas: 30_000_000_000_000n, attachedDeposit: 0n });
  await record(`claim (${holder.accountId})`, out);
} else throw Error('USAGE: status | fund | create <secs> | buy | resolve | claim');
