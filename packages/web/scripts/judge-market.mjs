// One testnet replay market on a published transcript. Default: read-only preflight.
// --send loads the existing deployer key by path, signs once and saves only public evidence.
import { Account, Connection, KeyPair, keyStores, transactions, utils } from 'near-api-js';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '../../..');
const contract = 'kotoba-edfa2b47.testnet';
const rpcUrl = 'https://near-testnet.drpc.org';
const proof = process.argv.includes('--r3-proof'), second = process.argv.includes('--r3-second');
if (proof && second) throw Error('CHOOSE_ONE_REPLAY');
const id = proof ? 'fomc-2026-09-inflation-replay' : second ? 'fomc-2026-10-employment-replay' : 'fomc-2026-10-inflation-replay';
const date = proof ? '20260916' : '20261028';
const source = `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${date}.pdf`;
const deadline = Date.parse('2026-11-26T00:00:00Z');
const file = resolve(root, proof ? 'deployments/r3-create-proof-2026-11-12.json' : second ? 'deployments/r3-create-second-2026-11-12.json' : 'deployments/judge-market-2026-11-12.json');
const deposit = 70n * 10n ** 21n, gas = 50_000_000_000_000n, cap = 3n * 10n ** 23n;
const reserved = deposit + gas * 1_000_000_000n + 10n ** 21n;
const wait = ms => new Promise(r => setTimeout(r, ms));
let evidence;
const save = () => writeFile(file, JSON.stringify(evidence, null, 2) + '\n');
async function rpc(method, params) {
  const r = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'judge-market', method, params }), signal: AbortSignal.timeout(20000) });
  const b = await r.json(); if (!r.ok || b.error) throw Error(`RPC_${method.toUpperCase()}_UNAVAILABLE`); return b.result;
}
async function view(method_name, args) {
  const r = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  return JSON.parse(Buffer.from(r.result).toString());
}
async function balance() {
  const a = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: contract });
  return { amount: a.amount, storage_usage: a.storage_usage, spendable_yocto: (BigInt(a.amount) - BigInt(a.storage_usage) * 10n ** 19n).toString() };
}
async function follow() {
  let result;
  for (let i = 0; i < 45; i++) {
    try { result = await rpc('tx', { tx_hash: evidence.tx, sender_account_id: contract, wait_until: 'FINAL' }); } catch {}
    if (result?.final_execution_status === 'FINAL') break;
    await wait(1500);
  }
  if (result?.final_execution_status !== 'FINAL') throw Error('FINALITY_UNKNOWN_RESUME_SAVED_HASH');
  if (result.transaction.signer_id !== contract || result.transaction.receiver_id !== contract || result.transaction.actions.length !== 1) throw Error('FINAL_TRANSACTION_MISMATCH');
  const call = result.transaction.actions[0].FunctionCall;
  if (call?.method_name !== 'create_market' || BigInt(call.deposit) !== deposit || JSON.stringify(JSON.parse(Buffer.from(call.args, 'base64'))) !== JSON.stringify(evidence.args)) throw Error('FINAL_CALL_MISMATCH');
  const receipts = [result.transaction_outcome, ...result.receipts_outcome];
  const failed = [result.status, ...receipts.map(r => r.outcome.status)].some(s => s.Failure);
  evidence.status = failed ? 'failed' : 'final'; evidence.final_at = new Date().toISOString();
  evidence.tokens_burnt_yocto = receipts.reduce((n, r) => n + BigInt(r.outcome.tokens_burnt), 0n).toString();
  evidence.after = await balance(); evidence.market = await view('get_market', { id });
  evidence.balance_decrease_yocto = (BigInt(evidence.before.amount) - BigInt(evidence.after.amount)).toString();
  evidence.new_storage_locked_yocto = (BigInt(evidence.after.storage_usage - evidence.before.storage_usage) * 10n ** 19n).toString();
  await save();
  if (failed || evidence.market?.id !== id || Object.entries(evidence.args).some(([key, value]) => evidence.market[key] !== value)) throw Error('CREATION_FAILED_SEE_PUBLIC_TX');
  if (BigInt(evidence.balance_decrease_yocto) > cap) throw Error('BUDGET_EXCEEDED');
  console.log(JSON.stringify({ status: evidence.status, tx: evidence.tx, route: `/market/${id}`, close: new Date(evidence.args.close_ns / 1e6).toISOString(), deadline: new Date(evidence.args.deadline_ns / 1e6).toISOString(), evidence: file }));
}
try {
  if (!contract.endsWith('.testnet') || !rpcUrl.includes('testnet') || reserved > cap) throw Error('TESTNET_BUDGET_GUARD');
  try { evidence = JSON.parse(await readFile(file, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (evidence?.tx) {
    if (evidence.contract !== contract || evidence.account !== contract || evidence.args?.id !== id || evidence.reserved_budget_yocto !== reserved.toString()) throw Error('SAVED_EVIDENCE_MISMATCH');
    if (evidence.status === 'final') console.log(JSON.stringify({ status: 'already_created', tx: evidence.tx, market: await view('get_market', { id }) }));
    else await follow();
  }
  else {
    if (!proof && !second) throw Error('ORIGINAL_REPLAY_RESERVED_FOR_JUDGES');
    if (Date.now() + 120000 >= deadline) throw Error('JUDGING_WINDOW_EXPIRED');
    if (await view('get_market', { id })) throw Error('MARKET_EXISTS_REFUSE_DUPLICATE');
    const before = await balance(), markets = await view('list_markets', {});
    if (markets.some(m => m.pending || m.status === 'Provisional')) throw Error('PENDING_LIABILITIES_REQUIRE_REVIEW');
    // Preserve existing markets' entire unburned share exposure plus each open LMSR seed.
    const priorReserve = markets.reduce((n, m) => n + BigInt(m.yes - m.burned_yes + m.no - m.burned_no) * 10n ** 21n + (m.status === 'Open' ? BigInt(Math.ceil(m.b * Math.LN2)) * 10n ** 21n : 0n), 0n);
    if (BigInt(before.spendable_yocto) < priorReserve + reserved) throw Error('LOW_BALANCE_AFTER_EXISTING_ESCROW_RESERVE');
    const response = await fetch(source, { signal: AbortSignal.timeout(20000) });
    const pdf = Buffer.from(await response.arrayBuffer());
    if (!response.ok || pdf.subarray(0, 4).toString() !== '%PDF') throw Error('PUBLISHED_PDF_UNAVAILABLE');
    const args = { id, event: `FOMC press conference · ${proof ? '2026-09-16' : '2026-10-28'} · replay demo`, source_url: source, phrase: second ? 'employment' : 'inflation', threshold: 1, close_ns: (Date.now() + 30000) * 1e6, deadline_ns: deadline * 1e6, b: 100 };
    evidence = { network: 'testnet', contract, account: contract, rpc: rpcUrl, status: 'preflight', args, source_check: { url: source, status: response.status, bytes: pdf.length, sha256: createHash('sha256').update(pdf).digest('hex'), checked_at: new Date().toISOString() }, cap_yocto: cap.toString(), attached_deposit_yocto: deposit.toString(), gas: gas.toString(), reserved_budget_yocto: reserved.toString(), existing_escrow_reserve_yocto: priorReserve.toString(), before };
    if (!process.argv.includes('--send')) console.log(JSON.stringify(evidence, null, 2));
    else {
      const credentials = JSON.parse(await readFile(resolve(root, '.near-credentials/deployer.json'), 'utf8'));
      if (credentials.account_id !== contract) throw Error('DEPLOYER_ACCOUNT_MISMATCH');
      const keys = new keyStores.InMemoryKeyStore(); await keys.setKey('testnet', contract, KeyPair.fromString(credentials.secret_key));
      const connection = Connection.fromConfig({ networkId: 'testnet', provider: { type: 'JsonRpcProvider', args: { url: rpcUrl } }, signer: { type: 'InMemorySigner', keyStore: keys } });
      const account = new Account(connection, contract);
      const [hash, signed] = await account.signTransaction(contract, [transactions.functionCall('create_market', args, gas, deposit)]);
      evidence.tx = utils.serialize.base_encode(hash); evidence.explorer = `https://testnet.nearblocks.io/txns/${evidence.tx}`; evidence.status = 'signed'; evidence.signed_at = new Date().toISOString();
      await writeFile(file, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
      try { await rpc('send_tx', { signed_tx_base64: Buffer.from(signed.encode()).toString('base64'), wait_until: 'NONE' }); } catch {} // Follow the same hash; never re-sign on timeout.
      await follow();
    }
  }
} catch (error) {
  console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'JUDGE_MARKET_FAILED_NO_SECRET_DETAILS'); process.exitCode = 1;
}
