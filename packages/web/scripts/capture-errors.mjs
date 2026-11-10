// Captures real error shapes from NEAR testnet, the RPC endpoints and OutLayer, and writes them to
// packages/web/test/fixtures/testnet-errors.json for the error-mapping unit tests.
// Failing transactions are signed with the gitignored player key through near-api-js 5.0.0, the same
// library and code path MyNearWallet's function-call key uses in the browser. The key is read in code
// and never printed. Each failing transaction burns a little testnet gas (well under 0.01 NEAR in total).
import { Account, Connection, KeyPair, keyStores } from 'near-api-js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const out = resolve(import.meta.dirname, '../test/fixtures/testnet-errors.json');
const CONTRACT = JSON.parse(await readFile(resolve(root, 'deployments/testnet-2026-11-09.json'), 'utf8')).contract_id;
const RPC = process.env.NEAR_TESTNET_RPC || 'https://test.rpc.fastnear.com';
const OPEN = 'fomc-2026-12-employment';
const FINAL = 'fomc-2026-01-inflation-40';

const rpc = async (url, method, params) => {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method, params }) });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  return { http: r.status, body };
};
const view = (method_name, args) => rpc(RPC, 'query', { request_type: 'call_function', finality: 'final', account_id: CONTRACT, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
// Keep only what the mapper reads, so the fixture stays small and carries no transaction payloads.
const errOf = (e) => ({ name: e?.constructor?.name, type: e?.type, message: e?.message, context: e?.context ? { transactionHash: e.context.transactionHash } : undefined, transaction_outcome: e?.transaction_outcome ? { id: e.transaction_outcome.id } : undefined });

const fixtures = { captured_at: new Date().toISOString(), contract: CONTRACT, rpc: RPC, cases: {} };
const put = (k, v) => { fixtures.cases[k] = v; console.log('captured', k); };

// 1. View-call panics (what quote/get_market return when the contract rejects the arguments).
put('view_quote_zero', await view('quote', { id: OPEN, yes: true, quantity: 0 }));
put('view_quote_too_many', await view('quote', { id: OPEN, yes: true, quantity: 100001 }));
put('view_unknown_market', await view('prices', { id: 'fomc-2099-01-nothing' }));
// 2. A mainnet-style account looked up on testnet (network mismatch).
put('view_account_mainnet_name', await rpc(RPC, 'query', { request_type: 'view_account', finality: 'final', account_id: 'nick.near' }));
// 3. OutLayer has no attestation for a transaction it never executed (result not yet available).
{ const r = await fetch(`https://testnet-api.outlayer.ai/attestations/by-tx/3PahtoukKPJJvMMYPHe5YudFvWoEyTKxDKHqDcjiUGqj`); put('outlayer_no_attestation', { http: r.status, body: (await r.text()).slice(0, 400) }); }
// 4. Recorded failing transactions from the public run, read back through the RPC `tx` method.
const recorded = { tx_err_closed: ['23d3vj4BQaDJAgdK1jJxWyEvKYn5iPrhMBfvgE5V5h1a', 'player.kotoba-edfa2b47.testnet'], tx_err_no_winning_shares: ['HLzDkSrJnzhdF7RThgrFk66Wdn7wPt3kN7NGjtb7KT3x', 'player.kotoba-edfa2b47.testnet'], tx_private_method: ['4b14MmNgrgiyATcGQfHPVPc5Cepd8VwDc4v54FxNh43X', 'player.kotoba-edfa2b47.testnet'], tx_err_resolution_time: ['3PahtoukKPJJvMMYPHe5YudFvWoEyTKxDKHqDcjiUGqj', CONTRACT] };
for (const [k, [hash, signer]] of Object.entries(recorded)) {
  const r = await rpc(RPC, 'tx', { tx_hash: hash, sender_account_id: signer, wait_until: 'FINAL' });
  put(k, { http: r.http, body: r.body?.result ? { result: { status: r.body.result.status, transaction: { hash: r.body.result.transaction.hash, signer_id: r.body.result.transaction.signer_id } } } : r.body });
}
// 5. An unknown transaction hash (what polling returns before the RPC has seen a just-submitted tx).
put('tx_unknown', await rpc(RPC, 'tx', { tx_hash: '11111111111111111111111111111111', sender_account_id: 'player.kotoba-edfa2b47.testnet', wait_until: 'NONE' }));

// 6. New failing transactions signed by the player through near-api-js 5 (the browser's function-call-key path).
const creds = JSON.parse(await readFile(resolve(root, '.near-credentials/player.json'), 'utf8'));
const keyStore = new keyStores.InMemoryKeyStore();
await keyStore.setKey('testnet', creds.account_id, KeyPair.fromString(creds.secret_key));
const connection = Connection.fromConfig({ networkId: 'testnet', provider: { type: 'JsonRpcProvider', args: { url: RPC } }, signer: { type: 'InMemorySigner', keyStore } });
const player = new Account(connection, creds.account_id);
const yocto = (near) => BigInt(Math.round(near * 1e6)) * 10n ** 18n;
const attempt = async (k, params) => {
  try { const r = await player.functionCall({ contractId: CONTRACT, gas: 30_000_000_000_000n, ...params }); put(k, { unexpected_success: r.transaction.hash }); }
  catch (e) { put(k, { thrown: errOf(e) }); }
};
await attempt('call_buy_underpaid', { methodName: 'buy', args: { id: OPEN, yes: true, quantity: 10 }, attachedDeposit: 1n });
await attempt('call_buy_quantity_zero', { methodName: 'buy', args: { id: OPEN, yes: true, quantity: 0 }, attachedDeposit: yocto(0.001) });
await attempt('call_buy_unknown_market', { methodName: 'buy', args: { id: 'fomc-2099-01-nothing', yes: true, quantity: 1 }, attachedDeposit: yocto(0.001) });
await attempt('call_claim_not_final', { methodName: 'claim', args: { id: OPEN }, attachedDeposit: 0n });
await attempt('call_buy_closed', { methodName: 'buy', args: { id: FINAL, yes: true, quantity: 1 }, attachedDeposit: yocto(0.002) });
// 0.105 NEAR plus 30 Tgas of prepaid gas is more than the player holds, so this one also fails as NotEnoughBalance.
await attempt('call_challenge_not_enough_balance', { methodName: 'challenge', args: { id: FINAL }, attachedDeposit: yocto(0.105) });
// More NEAR than the account holds: the RPC rejects the transaction before it lands (no hash, no fee).
await attempt('call_buy_not_enough_balance', { methodName: 'buy', args: { id: OPEN, yes: true, quantity: 10 }, attachedDeposit: yocto(50) });

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(fixtures, null, 2) + '\n');
console.log('wrote', out);
