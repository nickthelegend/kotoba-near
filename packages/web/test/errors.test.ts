// Error mapping, driven by error shapes captured from NEAR testnet (test/fixtures/testnet-errors.json,
// written by scripts/capture-errors.mjs). Wallet strings are read from the installed Meteor Wallet SDK.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { explain, panicOf, txFailure, rpcErrorFrom, TxFailed, RpcError, quantityError, upfrontYocto, spendableYocto } from '../src/errors.ts';

const here = import.meta.dirname;
const { cases } = JSON.parse(readFileSync(resolve(here, 'fixtures/testnet-errors.json'), 'utf8'));
// The Meteor SDK sits under the selector's Meteor module; resolve it from there.
const meteorModule = createRequire(import.meta.url).resolve('@near-wallet-selector/meteor-wallet');
const meteor = readFileSync(createRequire(meteorModule).resolve('@meteorwallet/sdk'), 'utf8') + readFileSync(meteorModule, 'utf8');
const fromTx = (k: string) => { const r = cases[k].body.result; return explain(new TxFailed(txFailure(r)!, r.transaction.hash)); };

test('view-call panics: quote with 0 and 100,001 shares, unknown market', () => {
  for (const k of ['view_quote_zero', 'view_quote_too_many']) {
    const e = rpcErrorFrom(cases[k].body, cases[k].http)!;
    assert.equal(panicOf(e.message), 'ERR_QUANTITY');
    const x = explain(e);
    assert.equal(x.kind, 'quantity'); assert.equal(x.code, 'ERR_QUANTITY'); assert.equal(x.tx, undefined);
  }
  const u = explain(rpcErrorFrom(cases.view_unknown_market.body)!);
  assert.equal(u.kind, 'unknown_market'); assert.equal(u.code, 'ERR_UNKNOWN_MARKET');
});

test('recorded failing transactions read back through RPC tx', () => {
  const closed = fromTx('tx_err_closed');
  assert.equal(closed.kind, 'closed'); assert.equal(closed.tx, '23d3vj4BQaDJAgdK1jJxWyEvKYn5iPrhMBfvgE5V5h1a');
  assert.equal(fromTx('tx_err_no_winning_shares').kind, 'no_winning_shares');
  assert.equal(fromTx('tx_err_resolution_time').kind, 'resolution_time');
  const priv = fromTx('tx_private_method');
  assert.equal(priv.kind, 'private_method'); assert.equal(priv.code, 'Method on_result is private');
});

test('txFailure is null for a successful outcome and finds a failing receipt', () => {
  assert.equal(txFailure({ status: { SuccessValue: '' }, receipts_outcome: [{ outcome: { status: { SuccessValue: '' } } }] }), null);
  const inner = cases.tx_err_closed.body.result.status.Failure;
  assert.equal(txFailure({ status: { SuccessValue: '' }, receipts_outcome: [{ outcome: { status: { Failure: inner } } }] }), 'ERR_CLOSED');
});

test('near-api-js 5 ServerTransactionError from the function-call-key path', () => {
  const under = explain(cases.call_buy_underpaid.thrown);
  assert.equal(under.kind, 'price_moved'); assert.equal(under.code, 'ERR_DEPOSIT'); assert.equal(under.retry, true);
  assert.equal(under.tx, cases.call_buy_underpaid.thrown.transaction_outcome.id);
  assert.equal(explain(cases.call_buy_quantity_zero.thrown).kind, 'quantity');
  const unk = explain(cases.call_buy_unknown_market.thrown);
  assert.equal(unk.kind, 'unknown_market'); assert.equal(unk.code, 'ERR_UNKNOWN_MARKET');
  assert.equal(explain(cases.call_claim_not_final.thrown).kind, 'not_final');
  assert.equal(explain(cases.call_buy_closed.thrown).kind, 'closed');
});

test('NotEnoughBalance (InvalidTxError) shows both amounts and no explorer link', () => {
  for (const k of ['call_buy_not_enough_balance', 'call_challenge_not_enough_balance']) {
    const x = explain(cases[k].thrown);
    assert.equal(x.kind, 'insufficient_balance');
    assert.equal(x.tx, undefined, 'the rejected tx never landed, so no NearBlocks link');
    assert.match(x.title, /you have 0\.123, this needs/);
  }
  assert.match(explain(cases.call_buy_not_enough_balance.thrown).title, /needs 50\.03$/);
});

test('mainnet account looked up on testnet is a network mismatch; unknown testnet account is not', () => {
  const e = rpcErrorFrom(cases.view_account_mainnet_name.body)!;
  assert.equal(e.causeName, 'UNKNOWN_ACCOUNT');
  assert.equal(explain(e).kind, 'network_mismatch');
  const t = explain(new RpcError('account nobody-xyz.testnet does not exist while viewing', { causeName: 'UNKNOWN_ACCOUNT' }));
  assert.equal(t.kind, 'unknown_account');
});

test('unknown transaction while polling is retryable', () => {
  const x = explain(rpcErrorFrom(cases.tx_unknown.body)!);
  assert.equal(x.kind, 'tx_not_found'); assert.equal(x.retry, true);
});

test('OutLayer has no attestation yet (HTTP 404)', () => {
  assert.equal(cases.outlayer_no_attestation.http, 404);
  const x = explain(new Error(`OutLayer attestation API HTTP ${cases.outlayer_no_attestation.http}`));
  assert.equal(x.kind, 'attestation_pending'); assert.equal(x.retry, true);
});

test('wallet pop-up errors, using the strings in the installed Meteor Wallet SDK and module', () => {
  for (const [s, kind] of [['User closed the window before completing the action', 'user_rejected'], ['User closed the window', 'user_rejected'], ["User didn't complete the action", 'user_rejected'], ['User cancelled the action', 'user_rejected'], ["Couldn't open popup window to complete wallet action", 'popup_blocked'], ['Wallet not signed in', 'wallet_not_connected']] as const) {
    assert.ok(meteor.includes(s), `${s} is in @meteorwallet/sdk or @near-wallet-selector/meteor-wallet`);
    assert.equal(explain(new Error(s)).kind, kind);
  }
});

test('real FastNEAR 429 body and dRPC free-plan broadcast timeout', () => {
  const r = explain(rpcErrorFrom(cases.fastnear_429.body, cases.fastnear_429.http)!);
  assert.equal(r.kind, 'rate_limited'); assert.equal(r.retry, true);
  const t = explain(cases.drpc_broadcast_timeout.thrown);
  assert.equal(t.kind, 'tx_timeout');
  assert.equal(t.tx, 'BmR8kmNWwbKtdCtiF4UpcP4VkUtnnRrNTgLPUhcBdYTW', 'the hash is kept so the app follows it (it did land)');
  assert.equal(explain(new Error('Request timeout on the free plan, please upgrade to paid plan')).kind, 'rpc_down');
});

test('rate limits and outages (constructed shapes)', () => {
  assert.equal(explain(rpcErrorFrom(null, 429)!).kind, 'rate_limited');
  assert.equal(explain(rpcErrorFrom({ jsonrpc: '2.0', error: { code: -429, message: 'Too many requests' } })!).kind, 'rate_limited');
  assert.equal(explain(new TypeError('Failed to fetch')).kind, 'rpc_down');
  assert.equal(explain(new Error('NEAR testnet RPC unreachable (test.rpc.fastnear.com, near-testnet.drpc.org): fetch failed')).kind, 'rpc_down');
});

test('an unrecognised panic is shown verbatim, never swallowed', () => {
  const x = explain(new Error('{"ExecutionError":"Smart contract panicked: ERR_SOMETHING_NEW"}'));
  assert.equal(x.kind, 'contract'); assert.equal(x.detail, 'ERR_SOMETHING_NEW');
});

test('inline quantity validation', () => {
  assert.equal(quantityError('10'), null);
  assert.match(quantityError('')!, /Enter/);
  assert.match(quantityError('0')!, /at least 1/);
  assert.match(quantityError('1.5')!, /Whole shares/);
  assert.match(quantityError('-3')!, /Whole shares/);
  assert.match(quantityError('100001')!, /100,000/);
});

test('upfront cost matches the costs the RPC quoted on testnet', () => {
  const milli = (n: number) => BigInt(n) * 10n ** 21n;
  // NotEnoughBalance said 50.0309 NEAR for a 50 NEAR, 30 Tgas buy; 0.4209 for 0.12 NEAR at 300 Tgas.
  assert.ok(Math.abs(Number(upfrontYocto(milli(50_000), 30) - milli(50_030)) / 1e24 - 0.001) < 0.0002);
  assert.ok(Math.abs(Number(upfrontYocto(milli(120), 300)) / 1e24 - 0.4209) < 0.0002);
  assert.equal(spendableYocto('123665848936106100000000', 182), 123665848936106100000000n - 1820000000000000000000n);
});
