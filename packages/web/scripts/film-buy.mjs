// One capped testnet buy for filming. Default is read-only; --send signs once.
// Keys are loaded only inside --send, from the existing player credential file.
// Public evidence goes outside the repository, and no key material is logged.
import { Account, Connection, KeyPair, keyStores, transactions, utils } from 'near-api-js';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const contract = JSON.parse(await readFile(resolve(root, 'deployments/testnet-2026-11-09.json'), 'utf8')).contract_id;
const playerId = `player.${contract}`;
const marketId = 'fomc-2026-12-employment';
const quantity = 20;
const rpcUrl = 'https://near-testnet.drpc.org';
const output = process.env.KOTOBA_FILM_OUT;
const send = process.argv.includes('--send');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function rpc(method, params) {
  const response = await fetch(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'film', method, params }), signal: AbortSignal.timeout(45000) });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(`RPC_${method}_UNAVAILABLE`);
  return body.result;
}
async function view(method_name, args) {
  const result = await rpc('query', { request_type: 'call_function', finality: 'final', account_id: contract, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
  return JSON.parse(Buffer.from(result.result).toString());
}
const near = value => utils.format.formatNearAmount(String(value), 6);
async function snapshot() {
  const account = await rpc('query', { request_type: 'view_account', finality: 'final', account_id: playerId });
  const market = await view('get_market', { id: marketId });
  const shares = await view('balance_of', { id: marketId, account: playerId, yes: true });
  return { at: new Date().toISOString(), account: playerId, amount: account.amount, storage_usage: account.storage_usage, spendable: (BigInt(account.amount) - BigInt(account.storage_usage) * 10n ** 19n).toString(), market, shares };
}
try {
  if (!contract.endsWith('.testnet')) throw new Error('TESTNET_ONLY');
  const before = await snapshot();
  const quote = BigInt(await view('quote', { id: marketId, yes: true, quantity }));
  const deposit = quote + (quote * 200n + 9999n) / 10000n;
  if (before.market.status !== 'Open' || before.market.close_ns <= Date.now() * 1e6) throw new Error('MARKET_CLOSED');
  if (deposit > 5n * 10n ** 22n) throw new Error('DEPOSIT_CAP_0_05_NEAR');
  if (BigInt(before.spendable) < deposit + 31n * 10n ** 21n) throw new Error('INSUFFICIENT_SPENDABLE');
  const base = { network: 'testnet', contract, account: playerId, market: marketId, quantity, yes: true, quote: quote.toString(), deposit: deposit.toString(), before };
  console.log(`NEAR testnet | ${playerId}`);
  console.log(`Spendable: ${near(before.spendable)} NEAR`);
  console.log(`Buy ${quantity} YES | employment | quote ${near(quote)} NEAR`);
  console.log(`Before: ${before.shares} YES shares`);
  if (!send) {
    if (output) await writeFile(output, JSON.stringify(base, null, 2));
    console.log('Read-only check. Add --send to buy once.');
    process.exit(0);
  }
  if (!output) throw new Error('KOTOBA_FILM_OUT_REQUIRED');
  try { await access(output); throw new Error('EVIDENCE_EXISTS_REFUSE_SECOND_BUY'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const credentials = JSON.parse(await readFile(resolve(root, '.near-credentials/player.json'), 'utf8'));
  if (credentials.account_id !== playerId) throw new Error('PLAYER_MISMATCH');
  const keyStore = new keyStores.InMemoryKeyStore();
  await keyStore.setKey('testnet', playerId, KeyPair.fromString(credentials.secret_key));
  const connection = Connection.fromConfig({ networkId: 'testnet', provider: { type: 'JsonRpcProvider', args: { url: rpcUrl } }, signer: { type: 'InMemorySigner', keyStore } });
  const account = new Account(connection, playerId);
  const [hash, signed] = await account.signTransaction(contract, [transactions.functionCall('buy', { id: marketId, yes: true, quantity }, 30_000_000_000_000n, deposit)]);
  const tx = utils.serialize.base_encode(hash);
  const evidence = { ...base, tx, sent_at: new Date().toISOString(), status: 'signed' };
  await writeFile(output, JSON.stringify(evidence, null, 2), { flag: 'wx' });
  console.log(`Sending capped buy. Max deposit: ${near(deposit)} NEAR`);
  // Broadcast exactly once; on timeout, poll this known hash instead of signing again.
  try { await rpc('send_tx', { signed_tx_base64: Buffer.from(signed.encode()).toString('base64'), wait_until: 'NONE' }); } catch { console.log('Following the signed transaction hash...'); }
  let outcome;
  for (let i = 0; i < 60; i++) {
    try { outcome = await rpc('tx', { tx_hash: tx, sender_account_id: playerId, wait_until: 'FINAL' }); if (outcome.status) break; } catch {}
    await sleep(1500);
  }
  if (!outcome?.status) throw new Error('FINALITY_TIMEOUT_CHECK_SAVED_HASH');
  const after = await snapshot();
  const failures = [outcome.status, ...(outcome.receipts_outcome || []).map(r => r.outcome.status)].filter(s => s?.Failure);
  Object.assign(evidence, { after, final_at: new Date().toISOString(), status: failures.length ? 'failed' : 'final', tokens_burnt: [outcome.transaction_outcome, ...(outcome.receipts_outcome || [])].reduce((n, r) => n + BigInt(r.outcome.tokens_burnt), 0n).toString() });
  await writeFile(output, JSON.stringify(evidence, null, 2));
  if (failures.length) throw new Error('ON_CHAIN_FAILURE_SEE_TX');
  if (after.shares !== before.shares + quantity) throw new Error('SHARE_DELTA_MISMATCH');
  console.log('FINAL | buy succeeded');
  console.log(`After: ${after.shares} YES shares (+${quantity})`);
  console.log(`Market inventory: ${before.market.yes} -> ${after.market.yes} YES`);
  console.log(`Transaction: ${tx}`);
} catch (error) {
  // Deliberately avoid dumping SDK errors, credential objects or signed payloads.
  const safe = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'FILM_BUY_FAILED';
  console.error(safe); process.exitCode = 1;
}
