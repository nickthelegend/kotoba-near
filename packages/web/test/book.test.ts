import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chance, sideBook, walk, label, groupEvents, contractError, yesAsk, noAsk, type Book, type Market } from '../src/pm/data.ts';

const book: Book = {
  market_id: 'fed-2026-12-09-ai',
  bids: [{ price: 61, shares: 4, orders: 1 }, { price: 59, shares: 10, orders: 2 }],
  asks: [{ price: 63, shares: 5, orders: 1 }, { price: 66, shares: 8, orders: 1 }],
  last_yes_price: 62, spread: 2,
};

test('chance is the midpoint while the spread is 10 cents or less, else the last fill', () => {
  assert.equal(chance(book), 62);
  assert.equal(chance({ ...book, asks: [{ price: 90, shares: 1, orders: 1 }], last_yes_price: 70 }), 70);
  assert.equal(chance(undefined), null);
});

test('the NO book mirrors the YES book, so Yes and No quotes add to 100 plus the spread', () => {
  const no = sideBook(book, false);
  assert.deepEqual(no.asks.map(l => l.price), [39, 41]);
  assert.deepEqual(no.bids.map(l => l.price), [37, 34]);
  assert.equal(no.last, 38);
  assert.equal(yesAsk(book)! + noAsk(book)!, 100 + book.spread!);
});

test('walking the book matches price priority and stops at the limit', () => {
  assert.deepEqual(walk(book.asks, 7, 99, true), { filled: 7, avg: (5 * 63 + 2 * 66) / 7, cost: 5 * 63 + 2 * 66, worst: 66 });
  assert.equal(walk(book.asks, 7, 64, true).filled, 5);
  assert.equal(walk(book.bids, 6, 60, false).filled, 4);
});

test('labels, events and contract errors read like the product', () => {
  const m = { id: 'fed-2026-12-09-inflation-30', event_id: 'fed-2026-12-09', event: 'What will Warsh say at the December FOMC press conference?', source_url: 'https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20261209.pdf', phrase: 'inflation', threshold: 30, close_ns: Date.parse('2026-12-09T19:00:00Z') * 1e6 } as Market;
  assert.equal(label(m), 'Inflation (30+ times)');
  assert.equal(label({ phrase: 'ai', threshold: 1 }), 'AI');
  assert.equal(label({ phrase: 'balance sheet', threshold: 1 }), 'Balance Sheet');
  const [e] = groupEvents([m]);
  assert.equal(e.id, 'fed-2026-12-09');
  assert.equal(e.date.toISOString().slice(0, 10), '2026-12-09');
  assert.equal(contractError('Smart contract panicked: ERR_SELF_CROSS'), 'This would trade against your own resting order. Cancel it first.');
  assert.match(contractError('ERR_SOMETHING_NEW'), /ERR_SOMETHING_NEW/);
});
