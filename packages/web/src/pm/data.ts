// Live state of kotoba-markets.testnet: one `snapshot` view per refresh gives every market, book and fill.
import { useEffect, useSyncExternalStore } from 'react';

export const CONTRACT = 'kotoba-markets.testnet';
export const PREVIOUS_CONTRACT = 'kotoba-edfa2b47.testnet';
// A market that settled end to end with the pinned program: resolved, challenged and re-run, then paid out.
export const PROOF_ROUTE = '/market/fomc-2026-01-inflation-40';
export const MAKERS = ['kotoba-mm.testnet', 'flow.kotoba-mm.testnet'];
// Public testnet RPCs rate-limit per IP, so reads rotate and stick to whichever answered last.
const RPCS = ['https://rpc.testnet.fastnear.com', 'https://archival-rpc.testnet.fastnear.com', 'https://near-testnet.drpc.org', 'https://test.rpc.fastnear.com'];
let preferred = 0;
const order = () => RPCS.map((_, i) => RPCS[(preferred + i) % RPCS.length]);
const worked = (url: string) => { preferred = RPCS.indexOf(url); };
export const UNIT = 10n ** 21n; // payout of one winning share: 0.001 NEAR
export const CENT = UNIT / 100n;
export const ORDER_FEE = 3n * UNIT;

export type Status = 'Open' | 'Provisional' | 'Final';
export type Market = {
  id: string; event_id: string; event: string; source_url: string; phrase: string; threshold: number;
  close_ns: number; deadline_ns: number; yes: number; no: number; burned_yes: number; burned_no: number;
  status: Status; result: { count: number; transcript_sha256: string } | null;
};
export type Order = { order_id: number; market_id: string; owner: string; yes: boolean; buy: boolean; price: number; quantity: number; remaining: number; created_ns: number; cancelled: boolean };
export type Trade = { trade_id: number; market_id: string; yes: boolean; price: number; yes_price: number; quantity: number; maker: string; taker: string; maker_order: number; taker_order: number; taker_buy: boolean; kind: 'swap' | 'mint' | 'merge'; at_ns: number };
export type Level = { price: number; shares: number; orders: number };
export type Book = { market_id: string; bids: Level[]; asks: Level[]; last_yes_price: number | null; spread: number | null };
export type Snapshot = { markets: Market[]; books: Record<string, Book>; trades: Trade[]; held: Record<string, number>; orders: Order[]; cash: string; now_ns: string };

export async function view<T>(method_name: string, args: object = {}, account_id = CONTRACT): Promise<T> {
  let last: unknown;
  for (const url of order()) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id, method_name, args_base64: btoa(JSON.stringify(args)) } }),
        signal: AbortSignal.timeout(15000),
      });
      const b = await r.json();
      if (!r.ok || b.error || b.result?.error) throw new Error('NEAR testnet did not answer');
      worked(url);
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(b.result.result)));
    } catch (e) { last = e; }
  }
  throw new Error(last instanceof TypeError ? 'Public NEAR testnet RPCs are busy right now; retrying every few seconds' : last instanceof Error ? last.message : 'NEAR testnet did not answer');
}

/** Waits for a transaction to reach FINAL and throws with the contract's error if any receipt failed. */
export async function waitFinal(hash: string, sender: string) {
  for (let i = 0; i < 60; i++) {
    for (const url of order()) {
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba-tx', method: 'tx', params: { tx_hash: hash, sender_account_id: sender, wait_until: 'FINAL' } }), signal: AbortSignal.timeout(20000) });
        const out = await r.json();
        if (out.result?.final_execution_status === 'FINAL') {
          const failure = out.result.status?.Failure ?? out.result.receipts_outcome?.find((x: { outcome: { status: { Failure?: unknown } } }) => x.outcome.status.Failure)?.outcome.status.Failure;
          if (failure) throw new TxError(contractError(JSON.stringify(failure)), hash);
          return out.result;
        }
      } catch (e) { if (e instanceof TxError) throw e; }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new TxError('Still confirming. Check the receipt before trying again.', hash);
}
export class TxError extends Error { hash?: string; constructor(message: string, hash?: string) { super(message); this.hash = hash; } }

const ERRORS: Record<string, string> = {
  ERR_CASH: 'Not enough cash for this order.',
  ERR_INSUFFICIENT_SHARES: 'You do not hold that many shares.',
  ERR_SELF_CROSS: 'This would trade against your own resting order. Cancel it first.',
  ERR_CLOSED: 'Trading on this word has closed.',
  ERR_ORDER_OWNER: 'Only the owner can cancel this order.',
  ERR_ORDER_CLOSED: 'This order is already filled or cancelled.',
  ERR_PRICE: 'Use a price from 1¢ to 99¢.',
  ERR_QUANTITY: 'Use 1 to 100,000 whole shares.',
};
export function contractError(raw: string) {
  const code = raw.match(/ERR_[A-Z_]+/)?.[0];
  return (code && ERRORS[code]) || (code ? `Refused by the contract (${code}).` : 'The transaction failed on NEAR testnet.');
}

// ---------------------------------------------------------------- store

type State = { snap: Snapshot | null; error: string; account: string; loading: boolean; at: number };
let state: State = { snap: null, error: '', account: '', loading: false, at: 0 };
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => { state = { ...state, ...patch }; listeners.forEach(l => l()); };
let inflight: Promise<void> | null = null;

export function refresh(account = state.account): Promise<void> {
  if (inflight && account === state.account) return inflight;
  if (account !== state.account) set({ account });
  set({ loading: true });
  inflight = view<Snapshot>('snapshot', { account: account || null })
    .then(snap => { if (account === state.account) set({ snap, error: '', at: Date.now() }); })
    .catch(e => set({ error: e instanceof Error ? e.message : 'NEAR testnet did not answer' }))
    .finally(() => { inflight = null; set({ loading: false }); });
  return inflight;
}

/** Live snapshot, refreshed every few seconds while the page is open. */
export function useSnapshot(account: string, everyMs = 6000) {
  const s = useSyncExternalStore(l => { listeners.add(l); return () => listeners.delete(l); }, () => state);
  useEffect(() => {
    refresh(account);
    const t = setInterval(() => { if (!document.hidden) refresh(account); }, everyMs);
    return () => clearInterval(t);
  }, [account, everyMs]);
  return s;
}

// ---------------------------------------------------------------- derived

export type KEvent = { id: string; title: string; date: Date; closeMs: number; source: string; markets: Market[] };

export function groupEvents(markets: Market[]): KEvent[] {
  const by = new Map<string, KEvent>();
  for (const m of markets) {
    let e = by.get(m.event_id);
    if (!e) {
      const d = m.source_url.match(/(\d{4})(\d{2})(\d{2})\.pdf$/);
      e = { id: m.event_id, title: m.event, date: d ? new Date(Date.UTC(+d[1], +d[2] - 1, +d[3])) : new Date(m.close_ns / 1e6), closeMs: m.close_ns / 1e6, source: m.source_url, markets: [] };
      by.set(m.event_id, e);
    }
    e.markets.push(m);
  }
  return [...by.values()].sort((a, b) => a.closeMs - b.closeMs);
}

/** Polymarket's rule: the midpoint while the spread is 10¢ or less, otherwise the last trade. */
export function chance(book: Book | undefined): number | null {
  if (!book) return null;
  const bid = book.bids[0]?.price, ask = book.asks[0]?.price;
  if (bid !== undefined && ask !== undefined && ask - bid <= 10) return Math.round((bid + ask) / 2);
  return book.last_yes_price ?? (bid !== undefined && ask !== undefined ? Math.round((bid + ask) / 2) : null);
}
/** What it costs right now to buy one YES or one NO share. */
export const yesAsk = (b?: Book) => b?.asks[0]?.price ?? null;
export const noAsk = (b?: Book) => (b?.bids[0] ? 100 - b.bids[0].price : null);

export const volumeOf = (trades: Trade[]) => trades.reduce((n, t) => n + BigInt(t.price) * CENT * BigInt(t.quantity), 0n);

export function label(m: Pick<Market, 'phrase' | 'threshold'>) {
  const word = m.phrase === 'ai' ? 'AI' : m.phrase.replace(/\b\w/g, c => c.toUpperCase());
  return m.threshold > 1 ? `${word} (${m.threshold}+ times)` : word;
}
export const speaker = (title: string) => title.match(/What will (\w+) say/)?.[1] ?? 'the speaker';

// ---------------------------------------------------------------- book math

/** The YES book, or its NO mirror: a NO ask at q is the YES bid at 100 - q. */
export function sideBook(book: Book | undefined, yes: boolean): { bids: Level[]; asks: Level[]; last: number | null } {
  if (!book) return { bids: [], asks: [], last: null };
  if (yes) return { bids: book.bids, asks: book.asks, last: book.last_yes_price };
  const flip = (l: Level) => ({ ...l, price: 100 - l.price });
  return { bids: book.asks.map(flip), asks: book.bids.map(flip), last: book.last_yes_price === null ? null : 100 - book.last_yes_price };
}

/** Walks the book the way the contract will: best price first, up to `limit`. */
export function walk(levels: { price: number; shares: number }[], qty: number, limit: number, buy: boolean) {
  let filled = 0, cost = 0, worst = 0;
  for (const l of levels) {
    if (filled >= qty) break;
    if (buy ? l.price > limit : l.price < limit) break;
    const take = Math.min(l.shares, qty - filled);
    filled += take; cost += take * l.price; worst = l.price;
  }
  return { filled, avg: filled ? cost / filled : null, cost, worst };
}

// ---------------------------------------------------------------- format

export function near(yocto: bigint | string | number, digits = 4) {
  const n = Number(BigInt(yocto) / 10n ** 16n) / 1e8;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 5 : digits })} NEAR`;
}
export const centsToNear = (cents: number) => near(BigInt(Math.round(cents)) * CENT);
export const fmtDate = (d: Date, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
export function ago(ns: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ns / 1e6) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export const shortAccount = (a: string) => (a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-9)}` : a);
export const txURL = (hash: string) => `https://testnet.nearblocks.io/txns/${hash}`;
export const accountURL = (id: string) => `https://testnet.nearblocks.io/address/${id}`;
