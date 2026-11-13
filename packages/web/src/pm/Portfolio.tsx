import { useState } from 'react';
import { Link } from '../ui';
import { type Snapshot, type Market, type Trade, chance, label, near, CENT, ago, txURL, waitFinal, refresh, TxError, contractError, MAKERS, shortAccount, accountURL, volumeOf, fmtDate } from './data';
import { Fills } from './Event';
import type { Wallet } from '../wallet';

type Row = { m: Market; yes: boolean; shares: number; avg: number | null; mark: number | null };

/** Average entry from the account's own fills (bought shares only). Minted pairs have no single-side cost. */
function positions(snap: Snapshot, account: string): Row[] {
  const rows: Row[] = [];
  for (const m of snap.markets) for (const yes of [true, false]) {
    const shares = snap.held[`${m.id}:${yes ? 'YES' : 'NO'}`] ?? 0;
    const resting = snap.orders.filter(o => o.market_id === m.id && o.yes === yes && !o.buy).reduce((n, o) => n + o.remaining, 0);
    if (!shares && !resting) continue;
    let qty = 0, cost = 0;
    for (const t of snap.trades.filter(t => t.market_id === m.id)) {
      // The account's side of this fill, as a YES or NO purchase.
      const asTaker = t.taker === account, asMaker = t.maker === account;
      if (!asTaker && !asMaker) continue;
      const myShareYes = asTaker ? t.yes : t.kind === 'swap' ? t.yes : !t.yes;
      const myPrice = asTaker ? t.price : t.kind === 'swap' ? t.price : 100 - t.price;
      const bought = asTaker ? t.taker_buy : t.kind === 'swap' ? !t.taker_buy : t.taker_buy;
      if (myShareYes !== yes) continue;
      if (bought) { qty += t.quantity; cost += t.quantity * myPrice; }
      else if (qty) { const a = cost / qty; qty -= Math.min(qty, t.quantity); cost = a * qty; }
    }
    const c = chance(snap.books[m.id]);
    rows.push({ m, yes, shares: shares + resting, avg: qty ? cost / qty : null, mark: c === null ? null : yes ? c : 100 - c });
  }
  return rows;
}

export function Portfolio({ snap, wallet }: { snap: Snapshot; wallet: Wallet }) {
  const [tab, setTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [busy, setBusy] = useState<number | 'withdraw' | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string; hash?: string } | null>(null);
  if (!wallet.account) {
    return (
      <main className="k-page">
        <div className="k-empty-hero">
          <img src="/art/kotoba-st-coin.webp" alt="" />
          <h1>Your positions live here</h1>
          <p>Connect a NEAR testnet wallet to see your shares, open orders and fills.</p>
          <button className="k-btn k-btn-dark" onClick={wallet.connect} disabled={!wallet.ready}>Connect wallet</button>
        </div>
      </main>
    );
  }
  const rows = positions(snap, wallet.account);
  const value = rows.reduce((n, r) => n + (r.mark ?? 0) * r.shares, 0);
  const pnl = rows.reduce((n, r) => n + (r.avg !== null && r.mark !== null ? (r.mark - r.avg) * r.shares : 0), 0);
  const mine = snap.trades.filter(t => t.taker === wallet.account || t.maker === wallet.account).reverse();
  const cash = BigInt(snap.cash);

  async function act(key: number | 'withdraw', method: string, args: object, text: string) {
    setBusy(key); setNote(null);
    try {
      const sent = await wallet.callContract(method, args, '1', 60);
      if (!sent.hash) throw new TxError('The wallet returned no transaction hash.');
      await waitFinal(sent.hash, wallet.account);
      setNote({ ok: true, text, hash: sent.hash });
      await refresh(wallet.account);
    } catch (e) {
      const err = e as Error & { hash?: string };
      setNote({ ok: false, text: err instanceof TxError ? err.message : contractError(String(err?.message ?? err)), hash: err?.hash });
    } finally { setBusy(null); }
  }

  return (
    <main className="k-page">
      <h1 className="k-page-title">Portfolio</h1>
      <div className="k-stats">
        <div className="k-stat"><small>Positions value</small><b>{near(BigInt(Math.round(value)) * CENT)}</b><span>marked at the current chance</span></div>
        <div className="k-stat"><small>Cash in Kotoba</small><b>{near(cash)}</b>
          <button className="k-link" disabled={!cash || busy !== null} onClick={() => act('withdraw', 'withdraw', { amount: snap.cash }, `Withdrew ${near(cash)} to your wallet`)}>{busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw to wallet'}</button>
        </div>
        <div className="k-stat"><small>Unrealized P&amp;L</small><b className={pnl > 0 ? 'up' : pnl < 0 ? 'down' : ''}>{pnl >= 0 ? '+' : '−'}{near(BigInt(Math.round(Math.abs(pnl))) * CENT)}</b><span>vs. your fill prices</span></div>
        <div className="k-stat"><small>Open orders</small><b>{snap.orders.length}</b><span>{snap.orders.reduce((n, o) => n + o.remaining, 0)} shares resting</span></div>
      </div>
      {note && <div className={'k-receipt ' + (note.ok ? 'ok' : 'bad')} role="status"><b>{note.text}</b>{note.hash && <a href={txURL(note.hash)} target="_blank" rel="noreferrer">Receipt ↗</a>}</div>}
      <div className="k-tabs" role="tablist">
        {(['positions', 'orders', 'history'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'positions' ? `Positions (${rows.length})` : t === 'orders' ? `Open orders (${snap.orders.length})` : `History (${mine.length})`}</button>)}
      </div>
      <section className="k-card k-table-card">
        {tab === 'positions' && (rows.length === 0 ? <Empty text="No positions yet." /> : (
          <table className="k-table">
            <thead><tr><th>Market</th><th>Shares</th><th>Avg</th><th>Now</th><th>Value</th><th>P&amp;L</th><th /></tr></thead>
            <tbody>{rows.map(r => {
              const pl = r.avg !== null && r.mark !== null ? (r.mark - r.avg) * r.shares : null;
              return (
                <tr key={r.m.id + r.yes}>
                  <td><Link to={`/event/${r.m.event_id}?word=${r.m.id}`} className="k-cellword"><b>{label(r.m)}</b><small>{fmtDate(new Date(r.m.close_ns / 1e6))} · <span className={'k-tag ' + (r.yes ? 'yes' : 'no')}>{r.yes ? 'Yes' : 'No'}</span></small></Link></td>
                  <td>{r.shares}</td>
                  <td>{r.avg === null ? '—' : `${r.avg.toFixed(1)}¢`}</td>
                  <td>{r.mark === null ? '—' : `${r.mark}¢`}</td>
                  <td>{r.mark === null ? '—' : near(BigInt(r.mark * r.shares) * CENT)}</td>
                  <td className={pl === null ? '' : pl >= 0 ? 'up' : 'down'}>{pl === null ? 'minted' : `${pl >= 0 ? '+' : '−'}${near(BigInt(Math.round(Math.abs(pl))) * CENT)}`}</td>
                  <td><Link to={`/event/${r.m.event_id}?word=${r.m.id}`} className="k-btn k-btn-ghost sm">Trade</Link></td>
                </tr>
              );
            })}</tbody>
          </table>
        ))}
        {tab === 'orders' && (snap.orders.length === 0 ? <Empty text="No open orders. Limit orders that don't fill right away rest here." /> : (
          <table className="k-table">
            <thead><tr><th>Market</th><th>Side</th><th>Price</th><th>Filled</th><th>Placed</th><th /></tr></thead>
            <tbody>{snap.orders.map(o => {
              const m = snap.markets.find(x => x.id === o.market_id)!;
              return (
                <tr key={o.order_id}>
                  <td><b>{label(m)}</b></td>
                  <td><span className={'k-tag ' + (o.yes ? 'yes' : 'no')}>{o.buy ? 'Buy' : 'Sell'} {o.yes ? 'Yes' : 'No'}</span></td>
                  <td>{o.price}¢</td>
                  <td>{o.quantity - o.remaining} / {o.quantity}</td>
                  <td>{ago(o.created_ns)}</td>
                  <td><button className="k-btn k-btn-ghost sm" disabled={busy !== null} onClick={() => act(o.order_id, 'cancel_order', { order_id: o.order_id }, `Cancelled: ${o.remaining} ${o.yes ? 'Yes' : 'No'} at ${o.price}¢ on ${label(m)}`)}>{busy === o.order_id ? 'Cancelling…' : 'Cancel'}</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        ))}
        {tab === 'history' && (mine.length === 0 ? <Empty text="No fills yet." /> : <Fills trades={mine} markets={snap.markets} account={wallet.account} />)}
      </section>
    </main>
  );
}

const Empty = ({ text }: { text: string }) => <div className="k-empty"><img src="/art/kotoba-st-newspaper.webp" alt="" /><p>{text}</p><Link to="/markets" className="k-btn k-btn-ghost sm">Browse markets</Link></div>;

export function Activity({ snap }: { snap: Snapshot }) {
  const [only, setOnly] = useState('all');
  const trades = snap.trades.filter(t => only === 'all' || t.market_id.startsWith(only)).slice().reverse();
  const day = snap.trades.filter(t => Date.now() - t.at_ns / 1e6 < 86400e3);
  const traders = new Set(snap.trades.flatMap(t => [t.taker, t.maker]));
  const events = [...new Set(snap.markets.map(m => m.event_id))];
  return (
    <main className="k-page">
      <h1 className="k-page-title">Activity</h1>
      <div className="k-stats">
        <div className="k-stat"><small>Fills, 24h</small><b>{day.length}</b></div>
        <div className="k-stat"><small>Volume, 24h</small><b>{near(volumeOf(day), 3)}</b></div>
        <div className="k-stat"><small>Accounts that traded</small><b>{traders.size}</b><span>{[...traders].filter(t => MAKERS.includes(t)).length} are Kotoba demo makers</span></div>
      </div>
      <div className="k-tabs" role="tablist">
        <button role="tab" aria-selected={only === 'all'} onClick={() => setOnly('all')}>All events</button>
        {events.map(e => <button key={e} role="tab" aria-selected={only === e} onClick={() => setOnly(e)}>{fmtDate(new Date(`${e.slice(4)}T00:00:00Z`), { month: 'short', day: 'numeric' })} conference</button>)}
      </div>
      <section className="k-card k-table-card">
        {trades.length === 0 ? <Empty text="No fills yet." /> : (
          <table className="k-table k-activity">
            <thead><tr><th>Trader</th><th>Action</th><th>Word</th><th>Price</th><th>Value</th><th>Time</th></tr></thead>
            <tbody>{trades.slice(0, 80).map(t => <ActivityRow key={t.market_id + t.trade_id} t={t} m={snap.markets.find(m => m.id === t.market_id)!} />)}</tbody>
          </table>
        )}
      </section>
      <p className="k-muted small">Every row is a real fill on <a href={accountURL('kotoba-markets.testnet')} target="_blank" rel="noreferrer">kotoba-markets.testnet</a>. Demo makers are Kotoba-owned accounts that keep the books liquid; this is testnet volume, not customers.</p>
    </main>
  );
}

function ActivityRow({ t, m }: { t: Trade; m: Market }) {
  const name = MAKERS.includes(t.taker) ? 'Demo maker' : shortAccount(t.taker);
  return (
    <tr>
      <td><a href={accountURL(t.taker)} target="_blank" rel="noreferrer" className="k-who"><span className="k-dot">{name[0]}</span>{name}</a></td>
      <td>{t.taker_buy ? 'Bought' : 'Sold'} <span className={'k-tag ' + (t.yes ? 'yes' : 'no')}>{t.quantity} {t.yes ? 'Yes' : 'No'}</span></td>
      <td><Link to={`/event/${m.event_id}?word=${m.id}`}>{label(m)}</Link> <small className="k-muted">{fmtDate(new Date(m.close_ns / 1e6), { month: 'short', day: 'numeric' })}</small></td>
      <td>{t.price}¢</td>
      <td>{near(BigInt(t.price * t.quantity) * CENT)}</td>
      <td>{ago(t.at_ns)}</td>
    </tr>
  );
}
