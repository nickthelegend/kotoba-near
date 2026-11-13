import { useEffect, useRef, useState } from 'react';
import { type Book, type Level, centsToNear, sideBook } from './data';

export function OrderBook({ book, yes, onSide, onPick, rows = 5 }: { book: Book | undefined; yes: boolean; onSide: (yes: boolean) => void; onPick: (price: number, buy: boolean) => void; rows?: number }) {
  const { bids, asks, last } = sideBook(book, yes);
  const a = asks.slice(0, rows), b = bids.slice(0, rows);
  const cum = (levels: Level[]) => { let s = 0; return levels.map(l => (s += l.shares)); };
  const ca = cum(a), cb = cum(b);
  const max = Math.max(ca.at(-1) ?? 0, cb.at(-1) ?? 0, 1);
  let totalA = 0, totalB = 0;
  const spread = a[0] && b[0] ? a[0].price - b[0].price : null;
  const flash = useFlash(book, yes);
  return (
    <div className="k-book">
      <div className="k-book-head">
        <h3>Order book</h3>
        <div className="k-seg" role="tablist">
          <button role="tab" aria-selected={yes} onClick={() => onSide(true)}>Trade Yes</button>
          <button role="tab" aria-selected={!yes} onClick={() => onSide(false)}>Trade No</button>
        </div>
      </div>
      <div className="k-book-cols"><span>Price</span><span>Shares</span><span>Total</span></div>
      {!book ? <div className="k-book-empty">Reading the book…</div> : (
        <>
          <div className="k-book-asks">
            {a.length === 0 && <div className="k-book-empty">No sellers yet</div>}
            {a.map((l, i) => { totalA += l.price * l.shares; return { l, i, total: totalA }; }).reverse().map(({ l, i, total }) => (
              <button key={'a' + l.price} className={'k-level ask' + (flash.has('a' + l.price) ? ' flash' : '')} onClick={() => onPick(l.price, true)} title={`Buy ${yes ? 'Yes' : 'No'} at ${l.price}¢`}>
                <i style={{ width: `${(ca[i] / max) * 100}%` }} />
                <b>{l.price}¢</b><span>{l.shares.toLocaleString()}</span><span>{centsToNear(total)}</span>
                {i === 0 && <em>Ask</em>}
              </button>
            ))}
          </div>
          <div className="k-book-mid"><span>Last <b>{last === null ? '—' : `${last}¢`}</b></span><span>Spread <b>{spread === null ? '—' : `${spread}¢`}</b></span></div>
          <div className="k-book-bids">
            {b.map((l, i) => { totalB += l.price * l.shares; return (
              <button key={'b' + l.price} className={'k-level bid' + (flash.has('b' + l.price) ? ' flash' : '')} onClick={() => onPick(l.price, false)} title={`Sell ${yes ? 'Yes' : 'No'} at ${l.price}¢`}>
                <i style={{ width: `${(cb[i] / max) * 100}%` }} />
                <b>{l.price}¢</b><span>{l.shares.toLocaleString()}</span><span>{centsToNear(totalB)}</span>
                {i === 0 && <em>Bid</em>}
              </button>
            ); })}
            {b.length === 0 && <div className="k-book-empty">No buyers yet</div>}
          </div>
        </>
      )}
    </div>
  );
}

/** Highlights levels whose size changed since the last read, so live fills are visible. */
function useFlash(book: Book | undefined, yes: boolean) {
  const prev = useRef<Map<string, number>>(new Map());
  const lastSide = useRef(yes);
  const [hot, setHot] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!book) return;
    const next = new Map<string, number>();
    const view = sideBook(book, yes);
    view.asks.forEach(l => next.set('a' + l.price, l.shares));
    view.bids.forEach(l => next.set('b' + l.price, l.shares));
    const changed = new Set<string>();
    const sameSide = lastSide.current === yes;
    lastSide.current = yes;
    if (prev.current.size && sameSide) next.forEach((v, k) => { if (prev.current.get(k) !== v) changed.add(k); });
    prev.current = next;
    if (changed.size) { setHot(changed); const t = setTimeout(() => setHot(new Set()), 1400); return () => clearTimeout(t); }
  }, [book, yes]);
  return hot;
}
