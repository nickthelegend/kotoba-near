// The approval sheet's plain-words reading of the exact calls the film signs (args shapes from TradePanel and Portfolio).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCall, marketName, nearAmount } from '../src/qa-describe.ts';

const T = 10n ** 12n;
test('market ids read as the word, threshold and press-conference date', () => {
  assert.deepEqual(marketName('fed-2026-12-09-oil'), { word: 'Oil', times: 1, date: 'Dec 9' });
  assert.deepEqual(marketName('fed-2027-01-27-inflation-30'), { word: 'Inflation', times: 30, date: 'Jan 27' });
  assert.deepEqual(marketName('fed-2026-12-09-balance-sheet'), { word: 'Balance Sheet', times: 1, date: 'Dec 9' });
  assert.equal(marketName('fed-2026-12-09-ai').word, 'AI');
});
test('amounts are exact NEAR, and the 1 yocto confirmation deposit is named as such', () => {
  assert.equal(nearAmount(4_500_000_000_000_000_000_000n), '0.0045 NEAR');
  assert.equal(nearAmount(1n), '1 yoctoNEAR');
  assert.equal(nearAmount(0n), '0 NEAR');
});
test('market buy, limit bid, market sell and cancel read in plain words', () => {
  const buy = describeCall('place_order', { id: 'fed-2026-12-09-oil', yes: true, buy: true, price: 45, quantity: 10, kind: 'market' }, 4_500_000_000_000_000_000_000n, 150n * T);
  assert.equal(buy.title, 'Buy 10 Yes shares at up to 45¢');
  assert.equal(buy.detail[0], '“Oil” · Dec 9 press conference');
  assert.equal(buy.deposit, '0.0045 NEAR');
  assert.equal(buy.gas, '150 Tgas max, unused gas refunded');
  const bid = describeCall('place_order', { id: 'fed-2026-12-09-housing', yes: true, buy: true, price: 30, quantity: 5, kind: 'limit' }, 4_500_000_000_000_000_000_000n, 150n * T);
  assert.equal(bid.title, 'Bid 30¢ for 5 Yes shares');
  assert.match(bid.detail[1], /waits in the book for a seller/);
  const sell = describeCall('place_order', { id: 'fed-2026-12-09-oil', yes: true, buy: false, price: 41, quantity: 5, kind: 'market' }, 3_000_000_000_000_000_000_000n, 150n * T);
  assert.equal(sell.title, 'Sell 5 Yes shares at 41¢ or more');
  const cancel = describeCall('cancel_order', { order_id: 42 }, 1n, 60n * T);
  assert.equal(cancel.title, 'Cancel resting order #42');
  assert.equal(cancel.deposit, "1 yoctoNEAR (confirms it's you)");
});
