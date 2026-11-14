import { useEffect, useMemo, useState } from 'react';
import { Link } from '../ui';
import { type KEvent, type Snapshot, type Market, type Trade, PROOF_ROUTE, chance, yesAsk, noAsk, volumeOf, label, near, ago, fmtDate, speaker, shortAccount, accountURL, MAKERS } from './data';
import { PriceChart, COLORS, type Series } from './Chart';
import { OrderBook } from './OrderBook';
import { TradePanel, type Ticket } from './TradePanel';
import { Rules } from './Rules';
import type { Wallet } from '../wallet';

export function seriesFor(markets: Market[], snap: Snapshot): Series[] {
  return markets.map((m, i) => ({
    id: m.id, name: label(m), color: COLORS[i % COLORS.length],
    points: snap.trades.filter(t => t.market_id === m.id).map(t => ({ t: t.at_ns / 1e6, v: t.yes_price })),
    now: chance(snap.books[m.id]),
  }));
}

export function Countdown({ ms }: { ms: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((ms - now) / 1000));
  if (!s) return <>Closed</>;
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return <>{d ? `${d}d ` : ''}{h}h {m}m</>;
}

export function EventPage({ event, snap, wallet, tab, initialWord }: { event: KEvent; snap: Snapshot; wallet: Wallet; tab: 'market' | 'rules'; initialWord?: string }) {
  const ranked = useMemo(() => [...event.markets].sort((a, b) => (chance(snap.books[b.id]) ?? 0) - (chance(snap.books[a.id]) ?? 0)), [event.markets, snap.books]);
  const [selected, setSelected] = useState(initialWord && event.markets.some(m => m.id === initialWord) ? initialWord : ranked[0].id);
  const [ticket, setTicket] = useState<Ticket>({ yes: true, buy: true, kind: 'market', price: null });
  const [sheet, setSheet] = useState(false);
  useEffect(() => { if (initialWord && event.markets.some(m => m.id === initialWord)) setSelected(initialWord); }, [initialWord, event.markets]);
  const market = event.markets.find(m => m.id === selected) ?? ranked[0];
  const trades = snap.trades.filter(t => event.markets.some(m => m.id === t.market_id));
  const allSeries = seriesFor(ranked, snap);
  // The selected word first, then the most-traded words: lines need real fills to draw.
  const byFills = [...allSeries].sort((a, b) => b.points.length - a.points.length);
  const chartSeries = [allSeries.find(s => s.id === market.id)!, ...byFills.filter(s => s.id !== market.id && s.points.length)].slice(0, 4);
  const who = speaker(event.title);

  function pick(m: Market, yes: boolean) {
    setSelected(m.id);
    setTicket({ ...ticket, yes, buy: true, price: null });
    if (matchMedia('(max-width: 900px)').matches) setSheet(true);
  }

  return (
    <main className="k-event">
      <div className="k-event-main">
        <header className="k-event-head">
          <img src="/art/kotoba-st-podium.webp" alt="" className="k-event-icon" />
          <div>
            <p className="k-crumb"><Link to="/markets">Fed chair</Link> · {fmtDate(event.date)} · press conference</p>
            <h1>What will {who} say?</h1>
            <p className="k-event-sub">{event.title.replace(/\?$/, '')}. Each word is its own Yes/No market.</p>
          </div>
        </header>
        <div className="k-event-stats">
          <span><b>{near(volumeOf(trades), 3)}</b> volume</span>
          <span><b>{event.markets.length}</b> words</span>
          <span><b><Countdown ms={event.closeMs} /></b> until trading closes</span>
          <span className="k-live"><i />Live book</span>
        </div>
        <p className="k-resolves"><b>How this resolves:</b> a pinned program counts each word in the official Fed transcript inside an Intel TDX enclave. <Link to={PROOF_ROUTE}>See the proof →</Link></p>
        <div className="k-tabs" role="tablist">
          <Link to={`/event/${event.id}`} aria-current={tab === 'market' ? 'page' : undefined}>Market</Link>
          <Link to={`/event/${event.id}/rules`} aria-current={tab === 'rules' ? 'page' : undefined}>Rules &amp; resolution</Link>
        </div>

        {tab === 'rules' ? <Rules event={event} /> : (
          <>
            <section className="k-card k-chart-card">
              <PriceChart series={chartSeries} />
            </section>

            <section className="k-card k-outcomes">
              <div className="k-outcomes-head"><span>Word</span><span>Chance</span><span /></div>
              {ranked.map(m => {
                const b = snap.books[m.id], c = chance(b), mt = snap.trades.filter(t => t.market_id === m.id);
                const first = mt[0]?.yes_price, delta = c !== null && first !== undefined ? c - first : 0;
                const open = m.id === market.id;
                return (
                  <div key={m.id} className={'k-outcome' + (open ? ' open' : '')}>
                    <div className="k-outcome-row" onClick={() => setSelected(m.id)}>
                      <div className="k-outcome-name">
                        <b>{label(m)}</b>
                        <small>{near(volumeOf(mt), 3)} vol · {mt.length} fills</small>
                      </div>
                      <div className="k-outcome-chance">
                        <b>{c === null ? '—' : `${c}%`}</b>
                        {delta !== 0 && <small className={delta > 0 ? 'up' : 'down'}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}</small>}
                      </div>
                      <div className="k-outcome-buy">
                        <button className="yes" onClick={e => { e.stopPropagation(); pick(m, true); }}>Buy Yes <b>{yesAsk(b) ?? '—'}¢</b></button>
                        <button className="no" onClick={e => { e.stopPropagation(); pick(m, false); }}>Buy No <b>{noAsk(b) ?? '—'}¢</b></button>
                      </div>
                    </div>
                    {open && (
                      <div className="k-outcome-detail">
                        <OrderBook book={b} yes={ticket.yes} onSide={yes => setTicket({ ...ticket, yes, price: null })}
                          onPick={(price, buyAt) => setTicket({ ...ticket, buy: buyAt, kind: 'limit', price })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="k-card">
              <h2 className="k-h2">Recent fills</h2>
              <Fills trades={trades.slice(-12).reverse()} markets={event.markets} account={wallet.account} />
            </section>
          </>
        )}
      </div>

      <aside className={'k-event-side' + (sheet ? ' sheet' : '')}>
        <div className="k-sheet-grab"><button onClick={() => setSheet(false)} aria-label="Close trade panel">Close</button></div>
        <TradePanel market={market} book={snap.books[market.id]} snap={snap} wallet={wallet} ticket={ticket} setTicket={setTicket} />
        <Position market={market} snap={snap} wallet={wallet} />
      </aside>
      {sheet && <div className="k-scrim" onClick={() => setSheet(false)} />}

      <div className="k-mbar">
        <span>{label(market)}</span>
        <button className="yes" onClick={() => pick(market, true)}>Buy Yes {yesAsk(snap.books[market.id]) ?? '—'}¢</button>
        <button className="no" onClick={() => pick(market, false)}>Buy No {noAsk(snap.books[market.id]) ?? '—'}¢</button>
      </div>
    </main>
  );
}

function Position({ market, snap, wallet }: { market: Market; snap: Snapshot; wallet: Wallet }) {
  if (!wallet.account) return null;
  const y = snap.held[`${market.id}:YES`] ?? 0, n = snap.held[`${market.id}:NO`] ?? 0;
  const orders = snap.orders.filter(o => o.market_id === market.id);
  return (
    <div className="k-mini">
      <h3>Your position · {label(market)}</h3>
      {!y && !n && !orders.length ? <p className="k-muted">No shares or orders in this word yet.</p> : (
        <ul>
          {y > 0 && <li><span className="k-tag yes">Yes</span>{y} shares</li>}
          {n > 0 && <li><span className="k-tag no">No</span>{n} shares</li>}
          {orders.map(o => <li key={o.order_id}><span className="k-tag">{o.buy ? 'Bid' : 'Ask'}</span>{o.remaining} {o.yes ? 'Yes' : 'No'} at {o.price}¢ <Link to="/portfolio">Manage</Link></li>)}
        </ul>
      )}
    </div>
  );
}

export function Fills({ trades, markets, account }: { trades: Trade[]; markets: Market[]; account?: string }) {
  if (!trades.length) return <p className="k-empty">No fills yet. The first matched order shows up here.</p>;
  return (
    <ul className="k-fills">
      {trades.map(t => {
        const m = markets.find(x => x.id === t.market_id);
        const you = account && (t.taker === account || t.maker === account);
        return (
          <li key={t.market_id + t.trade_id}>
            <a href={accountURL(t.taker)} target="_blank" rel="noreferrer" className="k-who">{you ? 'You' : MAKERS.includes(t.taker) ? 'Demo maker' : shortAccount(t.taker)}</a>
            <span>{t.taker_buy ? 'bought' : 'sold'} <b className={t.yes ? 'yes' : 'no'}>{t.quantity} {t.yes ? 'Yes' : 'No'}</b> {m ? <>on <b>{label(m)}</b></> : null} at {t.price}¢</span>
            <time>{ago(t.at_ns)}</time>
          </li>
        );
      })}
    </ul>
  );
}
