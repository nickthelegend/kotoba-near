import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discoverResolutionRuns } from '../src/discovery.mjs';

test('discovers the real January inflation resolution and challenge from public receipts', { timeout: 90000 }, async () => {
  const runs = await discoverResolutionRuns({ contract: 'kotoba-edfa2b47.testnet', marketId: 'fomc-2026-01-inflation-40' });
  assert.deepEqual(runs.map(r => r.tx), ['33sMfUjXnhbPmL3jad6ijjXZwYWYXodeHLH9fTQujAyV', 'BT5BmcjyhUdheNEMqNuwyB294e6oD9uqEa4Rk4rSP15E']);
  assert.deepEqual(runs.map(r => r.method), ['resolve', 'challenge']);
  for (const r of runs) { assert.equal(JSON.parse(r.outlayer.input).phrase, 'inflation'); assert.equal(JSON.parse(r.outlayer.output).count, 40); }
});
test('discovers the real January recession resolution without confusing another market', { timeout: 90000 }, async () => {
  const runs = await discoverResolutionRuns({ contract: 'kotoba-edfa2b47.testnet', marketId: 'fomc-2026-01-recession' });
  assert.deepEqual(runs.map(r => r.tx), ['GiwqWBNzKtN96xeRfkhhEJCVdzPHYwZm8znysas2bpGf']);
  assert.equal(JSON.parse(runs[0].outlayer.output).count, 0);
});
test('discovery rejects mainnet and missing live records without inventing a pass', async () => {
  await assert.rejects(discoverResolutionRuns({ contract: 'wrong.near', marketId: 'example' }), /Testnet/);
  await assert.rejects(discoverResolutionRuns({ contract: 'kotoba-edfa2b47.testnet', marketId: 'missing-r3-market' }), /No matching/);
});
