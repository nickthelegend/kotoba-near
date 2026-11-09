import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { countPhrase, estimateOutlayerCost, fetchFomcDates, fetchOfficialPdf, highlightPhrase, lmsrCost, lmsrPrices, lmsrQuote, oneClickDryQuote, sha256, viewMarket } from '../src/index.mjs';

test('LMSR prices sum to 1 over imbalanced inventories', () => {
  for (const yes of [0, 1, 100, 10000]) for (const no of [0, 2, 100, 30000]) {
    const p = lmsrPrices(yes, no, 1000);
    assert.ok(Math.abs(p.yes + p.no - 1) < 1e-12);
  }
});
test('buying a complete set costs one unit per share', () => {
  assert.ok(Math.abs(lmsrCost(100, 100, 1000) - lmsrCost(0, 0, 1000) - 100) < 1e-9);
});
test('buying shares increases its own price', () => {
  assert.ok(lmsrPrices(10, 0, 1000).yes > lmsrPrices(0, 0, 1000).yes);
});
test('quotes charge positive cost and reject invalid quantities', () => {
  assert.ok(lmsrQuote(0, 0, 1000, 'yes', 10) >= 5);
  assert.throws(() => lmsrQuote(0, 0, 1000, 'yes', 0));
});
test('whole-word, case-insensitive phrase rule', () => {
  assert.equal(countPhrase('Recession; pre-recession. recessionary RECESSION', 'recession'), 3);
  assert.equal(countPhrase('rate\ncut and rate cut', 'rate cut'), 2);
});
test('highlighting identifies countable words for display', () => {
  assert.equal(highlightPhrase('Inflation, inflation.', 'inflation').filter(x => x.hit).length, 2);
});
test('real January 2026 Fed transcript fixture is pinned and counted', async () => {
  const base = new URL('../fixtures/', import.meta.url);
  const pdf = await readFile(new URL('FOMCpresconf20260128.pdf', base));
  const text = await readFile(new URL('FOMCpresconf20260128.txt', base), 'utf8');
  assert.equal(sha256(pdf), '2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3');
  assert.equal(sha256(text), 'b3a6ffd6c6912f1ff63c04bbb544913eff55917cbbb57fab17d317d28ff706f1');
  assert.equal(countPhrase(text, 'inflation'), 40);
  assert.equal(countPhrase(text, 'recession'), 0);
});
test('a transcript swap changes the source hash', async () => {
  const pdf = await readFile(new URL('../fixtures/FOMCpresconf20260128.pdf', import.meta.url));
  assert.notEqual(sha256(Buffer.concat([pdf, Buffer.from('changed')])), sha256(pdf));
});
test('official Fed PDF is fetched live and matches the pinned FINAL fixture', async () => {
  const result = await fetchOfficialPdf('https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf');
  assert.equal(result.transcript_sha256, '2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3');
});
test('official Fed calendar supplies the December 2026 meeting', async () => {
  const dates = await fetchFomcDates(2026);
  assert.ok(dates.some(d => d.month === 12 && d.day === 9));
});
test('OutLayer testnet returns a live compute estimate', async () => {
  const cost = await estimateOutlayerCost();
  assert.ok(cost > 0n);
});
test('RPC reader requires an actual testnet contract ID', async () => {
  await assert.rejects(viewMarket('', 'foo'), /Setup required: NEAR_TESTNET_CONTRACT/);
});
test('1Click preview requires a mainnet account before any request', async () => {
  await assert.rejects(oneClickDryQuote({ accountId: '' }), /Setup required: NEAR_MAINNET_ACCOUNT/);
});
