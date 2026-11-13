import { useEffect, useMemo, useState } from 'react';
import { type Book, type Market, type Snapshot, sideBook, walk, CENT, ORDER_FEE, UNIT, label, near, txURL, waitFinal, contractError, TxError, refresh, type Trade } from './data';
import type { Wallet } from '../wallet';

export type Ticket = { yes: boolean; buy: boolean; kind: 'market' | 'limit'; price: number | null };
type Status = { step: 'idle' } | { step: 'signing' | 'confirming'; hash?: string } | { step: 'done'; hash: string; text: string } | { step: 'error'; text: string; hash?: string };

export function TradePanel({ market, book, snap, wallet, ticket, setTicket, onDone }: {
  market: Market; book: Book | undefined; snap: Snapshot | null; wallet: Wallet;
  ticket: Ticket; setTicket: (t: Ticket) => void; onDone?: (trades: Trade[]) => void;
}) {
  const [shares, setShares] = useState('10');
  const [draft, setDraft] = useState<string | null>(null); // the limit price while it is being typed
  const [status, setStatus] = useState<Status>({ step: 'idle' });
  const { yes, buy, kind } = ticket;
  const view = sideBook(book, yes);
  const best = buy ? view.asks[0]?.price : view.bids[0]?.price;
  const yesQuote = book?.asks[0]?.price ?? null, noQuote = book?.bids[0] ? 100 - book.bids[0].price : null;
  const price = kind === 'limit' ? ticket.price ?? best ?? 50 : null;
  useEffect(() => { setStatus({ step: 'idle' }); }, [market.id, yes, buy]);

  const q = Number(shares);
  const validQty = Number.isInteger(q) && q > 0 && q <= 100_000;
  const held = snap?.held[`${market.id}:${yes ? 'YES' : 'NO'}`] ?? 0;
  const cash = BigInt(snap?.cash ?? '0');
  const est = useMemo(() => walk(buy ? view.asks : view.bids, validQty ? q : 0, kind === 'limit' ? price! : buy ? 99 : 1, buy), [view, q, price, kind, buy, validQty]);
  // A market buy escrows up to the worst level it needs; anything unfilled comes straight back as cash.
  const orderPrice = kind === 'limit' ? price! : buy ? (est.filled ? est.worst : best ?? 99) : (est.filled ? est.worst : best ?? 1);
  const escrow = buy && validQty ? BigInt(orderPrice) * CENT * BigInt(q) : 0n;
  const fromWallet = (escrow > cash ? escrow - cash : 0n) + ORDER_FEE;
  const payout = validQty ? BigInt(q) * UNIT : 0n;
  const ownCross = (snap?.orders ?? []).some(o => o.market_id === market.id && (o.yes === yes ? o.buy !== buy && (buy ? o.price <= orderPrice : o.price >= orderPrice) : o.buy === buy && (buy ? 100 - o.price <= orderPrice : 100 - o.price >= orderPrice)));
  const problem = !validQty ? 'Enter whole shares (1 to 100,000).'
    : kind === 'limit' && (!Number.isInteger(price) || price! < 1 || price! > 99) ? 'Limit price must be 1¢ to 99¢.'
    : !buy && wallet.account && q > held ? `You hold ${held} ${yes ? 'Yes' : 'No'} shares.`
    : kind === 'market' && !best ? `No ${buy ? 'sellers' : 'buyers'} right now. Use a limit order.`
    : ownCross ? 'This would cross your own resting order. Cancel it in Portfolio first.' : '';
  const busy = status.step === 'signing' || status.step === 'confirming';

  async function submit() {
    if (!wallet.account) { await wallet.connect(); return; }
    setStatus({ step: 'signing' });
    try {
      const sent = await wallet.callContract('place_order', { id: market.id, yes, buy, price: orderPrice, quantity: q, kind }, fromWallet.toString(), 150);
      if (!sent.hash) throw new TxError('The wallet returned no transaction hash.');
      setStatus({ step: 'confirming', hash: sent.hash });
      const out = await waitFinal(sent.hash, wallet.account);
      const fills: Trade[] = out.receipts_outcome.flatMap((r: { outcome: { logs: string[] } }) => r.outcome.logs)
        .filter((l: string) => l.startsWith('{"event":"trade"')).map((l: string) => JSON.parse(l).data);
      const n = fills.reduce((s, t) => s + t.quantity, 0);
      const avg = n ? fills.reduce((s, t) => s + t.quantity * t.price, 0) / n : 0;
      const verb = buy ? 'Bought' : 'Sold';
      const text = n === q ? `${verb} ${n} ${yes ? 'Yes' : 'No'} at ${fmtAvg(avg)}`
        : n > 0 ? `${verb} ${n} of ${q} at ${fmtAvg(avg)}${kind === 'limit' ? `; ${q - n} resting at ${orderPrice}¢` : '; the rest was returned'}`
        : kind === 'limit' ? `Order resting at ${orderPrice}¢ for ${q} shares` : 'Nothing filled; your escrow was returned';
      setStatus({ step: 'done', hash: sent.hash, text });
      await refresh(wallet.account);
      onDone?.(fills);
    } catch (e) {
      const err = e as Error & { hash?: string };
      const rejected = /reject|cancel|closed the window|user denied/i.test(err.message ?? '');
      setStatus({ step: 'error', text: rejected ? 'You closed the wallet without signing.' : err instanceof TxError ? err.message : contractError(String(err?.message ?? err)), hash: err?.hash });
    }
  }

  const sideClass = yes ? 'yes' : 'no';
  return (
    <div className="k-ticket">
      <div className="k-ticket-word">
        <span className="k-ticket-avatar">{market.phrase === 'ai' ? 'AI' : market.phrase.slice(0, 2).toUpperCase()}</span>
        <div><b>{label(market)}</b><small>Said at least {market.threshold === 1 ? 'once' : `${market.threshold} times`}</small></div>
      </div>
      <div className="k-ticket-tabs">
        <button aria-pressed={buy} onClick={() => setTicket({ ...ticket, buy: true, price: null })}>Buy</button>
        <button aria-pressed={!buy} onClick={() => setTicket({ ...ticket, buy: false, price: null })}>Sell</button>
        <select aria-label="Order type" value={kind} onChange={e => setTicket({ ...ticket, kind: e.target.value as Ticket['kind'], price: null })}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
        </select>
      </div>
      <div className="k-ticket-sides">
        <button className={'yes' + (yes ? ' on' : '')} onClick={() => setTicket({ ...ticket, yes: true, price: null })}>Yes <b>{yesQuote ?? '—'}¢</b></button>
        <button className={'no' + (!yes ? ' on' : '')} onClick={() => setTicket({ ...ticket, yes: false, price: null })}>No <b>{noQuote ?? '—'}¢</b></button>
      </div>
      {kind === 'limit' && (
        <label className="k-field">
          <span>Limit price</span>
          <div className="k-stepper">
            <button aria-label="Lower price" onClick={() => { setDraft(null); setTicket({ ...ticket, price: Math.max(1, (price ?? 50) - 1) }); }}>−</button>
            <input aria-label="Limit price in cents" inputMode="numeric" value={draft ?? String(price ?? '')} onBlur={() => setDraft(null)} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 3); setDraft(v); setTicket({ ...ticket, price: v ? Number(v) : 0 }); }} />
            <em>¢</em>
            <button aria-label="Raise price" onClick={() => { setDraft(null); setTicket({ ...ticket, price: Math.min(99, (price ?? 50) + 1) }); }}>+</button>
          </div>
        </label>
      )}
      <label className="k-field">
        <span>Shares {!buy && wallet.account ? <small>· you hold {held}</small> : null}</span>
        <input className="k-shares" aria-label="Shares" inputMode="numeric" value={shares} onChange={e => setShares(e.target.value.replace(/\D/g, ''))} />
      </label>
      <div className="k-chips">
        {[1, 5, 10, 25].map(n => <button key={n} onClick={() => setShares(String((validQty ? q : 0) + n))}>+{n}</button>)}
        {!buy && <button onClick={() => setShares(String(held))} disabled={!held}>Max</button>}
      </div>
      <dl className="k-summary">
        <div><dt>Avg price</dt><dd>{est.avg === null ? (kind === 'limit' ? `rests at ${price}¢` : '—') : fmtAvg(est.avg)}</dd></div>
        <div><dt>Fills now</dt><dd>{est.filled} of {validQty ? q : 0}</dd></div>
        <div><dt>{buy ? 'Cost' : 'You receive'}</dt><dd>{near(BigInt(Math.round(est.cost + (kind === 'limit' && validQty ? (q - est.filled) * (price ?? 0) : 0))) * CENT)}</dd></div>
        <div><dt>Order fee</dt><dd>{near(ORDER_FEE)}</dd></div>
      </dl>
      {buy && (
        <div className={'k-towin ' + sideClass}>
          <span>To win if {yes ? 'Yes' : 'No'}</span>
          <b>{near(payout)}</b>
          {est.avg !== null && <small>{Math.round((100 / est.avg - 1) * 100)}% return</small>}
        </div>
      )}
      {problem && wallet.account && <p className="k-field-error">{problem}</p>}
      <button className={'k-submit ' + (buy ? sideClass : 'sell')} disabled={busy || (!!wallet.account && !!problem)} onClick={submit}>
        {!wallet.account ? 'Connect wallet to trade' : status.step === 'signing' ? 'Signing in your wallet…' : status.step === 'confirming' ? 'Confirming on NEAR…' : `${buy ? 'Buy' : 'Sell'} ${yes ? 'Yes' : 'No'}`}
      </button>
      {status.step === 'done' && <div className="k-receipt ok" role="status"><b>{status.text}</b><a href={txURL(status.hash)} target="_blank" rel="noreferrer">Receipt ↗</a></div>}
      {status.step === 'confirming' && status.hash && <div className="k-receipt" role="status"><span className="k-spin" />Waiting for finality<a href={txURL(status.hash)} target="_blank" rel="noreferrer">Receipt ↗</a></div>}
      {status.step === 'error' && <div className="k-receipt bad" role="alert"><b>{status.text}</b>{status.hash && <a href={txURL(status.hash)} target="_blank" rel="noreferrer">Receipt ↗</a>}</div>}
      <p className="k-ticket-note">{kind === 'market' ? 'Fills against the book now; anything unfilled returns to your cash.' : 'Fills what it can now and rests in the book for the rest.'} Each share pays 0.001 test NEAR if right.</p>
    </div>
  );
}
const fmtAvg = (c: number) => `${Number.isInteger(c) ? c : c.toFixed(1)}¢`;
