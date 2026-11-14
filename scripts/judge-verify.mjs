#!/usr/bin/env node
// Re-checks Kotoba's key proofs against public data. No install, no keys, no build:
//   node scripts/judge-verify.mjs
// Sources: FastNEAR transaction API (testnet), NEAR testnet RPC, FastFS (OutLayer program bytes),
// and this repo's contract source. Exit code 0 only if every check passes.
// Not checked here: contract-routed OutLayer `resolve` on Nov 14 (failed on OutLayer's side, see JUDGES.md "Limits").
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEAR_RPC = 'https://test.rpc.fastnear.com';
const NEAR_ARCHIVAL_RPC = 'https://archival-rpc.testnet.fastnear.com'; // holds older transactions
const NEAR_TX_API = 'https://tx.test.fastnear.com/v0/transactions';
const EXPLORER = 'https://testnet.near.rocks/tx/';
const LMSR = 'kotoba-edfa2b47.testnet';   // previous contract: holds the settled markets and TEE evidence
const BOOK = 'kotoba-markets.testnet';    // current order-book contract
const CODE_HASH = 'b46b08da60dcd4d4970a0712beb0e1b33aab6e332646de4e090974419a7b2314';
const WASM_URL = `https://test.fastfs.io/${LMSR}/outlayer.testnet/${CODE_HASH}.wasm`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// Public endpoints rate-limit (HTTP 429): retry with backoff before reporting a failure.
const post = async (url, body) => {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < 6) { await sleep(1500 * (i + 1)); continue; }
    throw Error(`${url} answered HTTP ${r.status}`);
  }
};
const rpc = async (method, params, url = NEAR_RPC) => { const j = await post(url, { jsonrpc: '2.0', id: 1, method, params }); if (j.error) throw Error(JSON.stringify(j.error)); return j.result; };
// RPC `tx` cross-check with the signer from the transaction API: one attempt on the archival RPC (it holds older
// transactions), one on the main RPC. The main node can stall ~30 s on old transactions, hence the short timeouts.
let rpcChecked = 0, rpcSkipped = 0, rpcMisses = 0;
const txStatus = async (params) => {
  await sleep(300); // pacing keeps the public RPC from answering 429
  if (rpcMisses >= 3) { rpcSkipped++; return { skipped: true }; } // circuit breaker: the RPC is rate-limiting this IP, stop asking
  for (const url of [NEAR_ARCHIVAL_RPC, NEAR_RPC]) {
    try {
      const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(12000), headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tx', params }) });
      if (r.status === 429) break;
      const j = await r.json();
      if (j.result) { rpcChecked++; rpcMisses = 0; return j.result; }
    } catch {}
  }
  rpcSkipped++; rpcMisses++;
  return { skipped: true }; // RPC rate-limited or unavailable: the check then rests on the transaction API alone, and the run says so
};
const view = async (account_id, method_name, args = {}) => {
  const r = await rpc('query', { request_type: 'call_function', account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64'), finality: 'final' });
  return JSON.parse(Buffer.from(r.result).toString());
};
const rows = [];
const check = (ok, what, detail) => rows.push({ ok: !!ok, what, detail });
const safe = async (what, fn) => { try { await fn(); } catch (e) { check(false, what, `error: ${e.message}`); } };

// ---- proofs: [hash, description, expectation] ----
const OK = 'success';
const PROOFS = {
  deployBook:  ['DmLGSKUDbR95WubdCETcBppBhNNjWdUH5FCWeeEbZHTr', `Deploy + init of ${BOOK} (order-book contract)`, OK],
  listDec:     ['8iVvLvv4xRnAKS6fjLF5JAwbeFtHHy1H5ww71RQiVRGa', 'List the December event (12 words) on the order book', OK],
  listJan:     ['HckEA7C6Brd83beksA6xShnGGLKURV9GAaYEWsDnH26A', 'List the January event (5 words) on the order book', OK],
  buyOil:      ['8d1tEMyJPLKjuacCSyioAZCdys8NUaTv8bMqU8RZFjBh', 'Market buy, 10 Yes on "oil" (fills at the asks)', OK],
  bidHousing:  ['Cn7Y5bjteGqZHuNmtmspHogXyZEGfHFiJxafKECio9LM', 'Limit bid, 5 Yes on "housing" at 30c (rests on the book)', OK],
  cancelBid:   ['BqnKAfEBFPdpEepRehUtcqPTTb376UmmxWeYGcmTMPT5', 'Cancel that bid (escrow returned)', OK],
  sellOil:     ['8vvQdGsnKHajBx1anAYqtGEC3G91fEa6GgY1tz56pBdW', 'Market sell, 5 "oil" Yes into the best bid', OK],
  resolveInfl: ['33sMfUjXnhbPmL3jad6ijjXZwYWYXodeHLH9fTQujAyV', 'resolve fomc-2026-01-inflation-40: OutLayer TEE counted the pinned transcript', 'outlayer', { count: 40 }],
  challenge:   ['BT5BmcjyhUdheNEMqNuwyB294e6oD9uqEa4Rk4rSP15E', 'challenge: the same pinned program re-ran and counted again', 'outlayer', { count: 40 }],
  resolveRec:  ['GiwqWBNzKtN96xeRfkhhEJCVdzPHYwZm8znysas2bpGf', 'resolve fomc-2026-01-recession: TEE count is 0', 'outlayer', { count: 0 }],
  claim:       ['Eoudkc8kzcrL9qSydTm41HnfKk52gYJfdMQzMSvKUZFE', 'claim: the winning player was paid after settlement', OK],
  finalize:    ['61M2LbzkmKjzi8wShPC5K8HPSePWtetp493FofZG3YG2', 'finalize fomc-2026-01-recession after its challenge window', OK],
  sepResolve:  ['DkNvuJDwv9M2aPucpJWs3cgVwCMo8AsaUki8f2foNdkG', 'Separate Sep 2026 replay: resolve through the app, TEE counted 22', 'outlayer', { count: 22 }],
  sepFinalize: ['3sTUggZz8DWrqBjQQ3wmUqrKypSqn7GDC9QvrhEMip5c', 'Separate Sep 2026 replay: finalized after the 15-minute window', OK],
  earlyResolve:['3PahtoukKPJJvMMYPHe5YudFvWoEyTKxDKHqDcjiUGqj', 'Attack: resolve before the event ends is refused', 'refused', 'ERR_RESOLUTION_TIME'],
  lateBuy:     ['23d3vj4BQaDJAgdK1jJxWyEvKYn5iPrhMBfvgE5V5h1a', 'Attack: buy after betting closed is refused', 'refused', 'ERR_CLOSED'],
  loserClaim:  ['4HPAvPfnKhxyeXVkDgMoj874BhX5L3qtXyNvTDujgrRf', 'Attack: claim without winning shares is refused', 'refused', 'ERR_NO_WINNING_SHARES'],
  forged:      ['4b14MmNgrgiyATcGQfHPVPc5Cepd8VwDc4v54FxNh43X', 'Attack: a forged on_result call (fake oracle result) is refused', 'refused', 'is private'],
};

const src = readFileSync(join(ROOT, 'packages/book-contract/src/lib.rs'), 'utf8');
const old = readFileSync(join(ROOT, 'packages/contract/src/lib.rs'), 'utf8');
check(/\[private\]\s*pub fn on_result/.test(old) && /\[private\]\s*pub fn on_result/.test(src) && /request_execution/.test(old) && /OUTLAYER: &str = "outlayer\.testnet"/.test(old),
  'Source: resolve asks outlayer.testnet request_execution; the result callback on_result is #[private]',
  'packages/contract/src/lib.rs and packages/book-contract/src/lib.rs');

await safe('FastNEAR transaction API', async () => {
  const hashes = Object.values(PROOFS).map(p => p[0]);
  const byHash = {};
  for (let i = 0; i < hashes.length; i += 15) {
    const api = await post(NEAR_TX_API, { tx_hashes: hashes.slice(i, i + 15) });
    for (const t of api.transactions ?? []) byHash[t.transaction.hash] = t;
  }
  for (const [, [hash, what, kind, exp]] of Object.entries(PROOFS)) {
    const t = byHash[hash];
    if (!t) { check(false, what, `${hash} not found`); continue; }
    const signer = t.transaction.signer_id;
    const fin = await txStatus({ tx_hash: hash, sender_account_id: signer, wait_until: 'FINAL' }).catch(e => ({ error: e.message }));
    if (fin.error) { check(false, what, `RPC: ${fin.error}`); continue; }
    const rs = t.receipts ?? [];
    const fails = rs.map(r => r.execution_outcome?.outcome?.status).filter(s => s?.Failure).map(s => JSON.stringify(s.Failure));
    const link = `${EXPLORER}${hash}`;
    if (kind === OK) check(fails.length === 0, what, `${signer} · ${link}`);
    if (kind === 'refused') check(fails.some(f => f.includes(exp)), what, `failure contains "${exp}" · ${link}`);
    if (kind === 'outlayer') {
      // OutLayer's receipt carries the program output; the contract callback must then return true.
      let out = null;
      for (const r of rs) {
        const o = r.execution_outcome?.outcome;
        if (o?.executor_id === 'outlayer.testnet' && o.status?.SuccessValue) {
          try { out = JSON.parse(Buffer.from(o.status.SuccessValue, 'base64').toString()); } catch {}
        }
      }
      const cb = rs.some(r => r.execution_outcome?.outcome?.executor_id === LMSR && r.execution_outcome.outcome.status?.SuccessValue === Buffer.from('true').toString('base64'));
      const ok = fails.length === 0 && out && out.count === exp.count && out.code_hash === CODE_HASH && cb;
      check(ok, what, out ? `${signer}: count ${out.count}, code_hash ${String(out.code_hash).slice(0, 12)}…, contract callback true=${cb} · ${link}` : `no OutLayer output · ${link}`);
    }
  }
});

await safe('Pinned oracle program', async () => {
  const buf = Buffer.from(await (await fetch(WASM_URL)).arrayBuffer());
  const h = createHash('sha256').update(buf).digest('hex');
  check(h === CODE_HASH, 'Oracle WASM stored on FastFS hashes to the code_hash the contract pins and the TEE reported', `sha256 ${h.slice(0, 16)}… (${buf.length} bytes) · ${WASM_URL}`);
});

await safe('Settled market state', async () => {
  const m = await view(LMSR, 'get_market', { id: 'fomc-2026-01-inflation-40' });
  check(m?.status === 'Final' && m.result?.count === 40 && m.result.code_hash === CODE_HASH && m.threshold === 40,
    `${LMSR} get_market: Jan 28 2026 "inflation" (threshold 40) is Final with TEE count 40`, `status ${m?.status}, count ${m?.result?.count}, transcript ${String(m?.result?.transcript_sha256).slice(0, 12)}…`);
  const cfg = await view(LMSR, 'config');
  check(cfg?.[1] === CODE_HASH, `${LMSR} config pins the oracle program hash at init`, `pinned ${String(cfg?.[1]).slice(0, 16)}…`);
});

await safe('Live order book', async () => {
  const ms = await view(BOOK, 'list_markets');
  const events = new Set(ms.map(x => x.event_id));
  check(ms.length >= 17 && events.has('fed-2026-12-09'), `${BOOK} list_markets: 17+ word markets incl. the Dec 9 2026 FOMC event`, `${ms.length} markets, events: ${[...events].join(', ')}`);
  const b = await view(BOOK, 'get_book', { id: 'fed-2026-12-09-oil' });
  check(b?.bids?.length > 0 && b?.asks?.length > 0 && b.bids[0].price < b.asks[0].price, `${BOOK} get_book: "oil" has resting bids and asks, uncrossed`, `best bid ${b?.bids?.[0]?.price}, best ask ${b?.asks?.[0]?.price}`);
});

const pass = rows.filter(r => r.ok).length;
console.log(`\nKotoba live verification · ${new Date().toISOString()}\n`);
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.what}\n      ${r.detail}`);
console.log(`\nNEAR RPC tx cross-check: ${rpcChecked} confirmed, ${rpcSkipped} skipped (public RPC rate-limited or slow; those rest on the FastNEAR transaction API alone).`);
console.log(`\n${pass}/${rows.length} checks passed.`);
process.exit(pass === rows.length ? 0 : 1);
