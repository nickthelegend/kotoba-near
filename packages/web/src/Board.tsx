import { useEffect, useMemo, useState } from 'react';
import { Art, Countdown, Icon, Link, OddsBar, State, useMarkets, useNow } from './ui';
import { UNIT_NEAR, eventDate, fmtDate, outcome, pct, quote, yesPrice, yoctoToNear, type Market } from './lib';
import type { Wallet } from './wallet';

function MarketCard({ m, now, onBet }: { m: Market; now: number; onBet: (m: Market) => void }) {
  const open = m.status === 'Open' && m.close_ns / 1e6 > now;
  const result = outcome(m);
  return <article className={`card ${open ? '' : 'card-closed'}`}>
    <div className="card-top">
      <span className="tag">FOMC · {fmtDate(eventDate(m) ?? new Date(m.close_ns / 1e6))}</span>
      {open ? <span className="tag tag-live"><i className="live-dot" />Closes in <Countdown target={m.close_ns / 1e6} now={now} compact /></span>
        : result ? <span className={`stamp stamp-${result.toLowerCase()}`}>{result}</span> : <span className="tag">Awaiting transcript</span>}
    </div>
    <h3 className="card-q">Will they say <q>{m.phrase}</q>{m.threshold > 1 ? <> at least <b>{m.threshold}</b> times</> : ''}?</h3>
    {m.result ? <p className="card-count"><b>{m.result.count}</b> whole-word hits in the official transcript</p> : <OddsBar m={m} />}
    <div className="card-foot">
      <span className="mono dim">{m.yes + m.no} shares · b={m.b}</span>
      {open ? <button className="btn btn-red btn-sm" onClick={() => onBet(m)}>Trade</button>
        : <Link to={`/market/${m.id}`} className="btn btn-ghost btn-sm">{m.result ? 'See the proof' : 'Details'} <Icon name="arrow" size={15} /></Link>}
    </div>
  </article>;
}

function BetSheet({ m, wallet, onClose }: { m: Market; wallet: Wallet; onClose: () => void }) {
  const [yes, setYes] = useState(true);
  const [qty, setQty] = useState(10);
  const [cost, setCost] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const p = yesPrice(m);
  useEffect(() => {
    let live = true; setCost(null); setErr('');
    if (!Number.isInteger(qty) || qty < 1 || qty > 100_000) { setErr('Choose 1 to 100,000 shares'); return; }
    const t = setTimeout(() => quote(m.id, yes, qty).then((q) => live && setCost(q)).catch((e) => live && setErr(String(e.message || e))), 180);
    return () => { live = false; clearTimeout(t); };
  }, [m.id, yes, qty]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  async function place() {
    if (!cost) return;
    setSending(true);
    try { await wallet.callContract('buy', { id: m.id, yes, quantity: qty }, cost); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setSending(false); }
  }
  const costNear = cost ? yoctoToNear(cost) : null;
  return <div className="sheet-wrap" onClick={onClose}>
    <aside className="sheet" role="dialog" aria-modal="true" aria-label={`Trade ${m.phrase}`} onClick={(e) => e.stopPropagation()}>
      <header className="sheet-head">
        <p className="label">{m.event}</p>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </header>
      <h2 className="sheet-q">Will they say <q>{m.phrase}</q>{m.threshold > 1 ? ` ≥ ${m.threshold}×` : ''}?</h2>
      <div className="split" role="radiogroup" aria-label="Side">
        <button role="radio" aria-checked={yes} className={`split-btn split-yes ${yes ? 'on' : ''}`} onClick={() => setYes(true)}><span>YES</span><b>{pct(p)}</b></button>
        <button role="radio" aria-checked={!yes} className={`split-btn split-no ${!yes ? 'on' : ''}`} onClick={() => setYes(false)}><span>NO</span><b>{pct(1 - p)}</b></button>
      </div>
      <div className="stepper">
        <span className="label">Shares</span>
        <div className="stepper-ctl">
          <button className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 5))} aria-label="Fewer shares"><Icon name="minus" /></button>
          <input inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} aria-label="Number of shares" />
          <button className="icon-btn" onClick={() => setQty((q) => Math.min(100_000, q + 5))} aria-label="More shares"><Icon name="plus" /></button>
        </div>
      </div>
      <dl className="receipt">
        <div><dt>You pay (contract quote, incl. 1% creator fee)</dt><dd>{err ? '—' : costNear === null ? <i className="pulse" /> : `${costNear.toFixed(4)} NEAR`}</dd></div>
        <div><dt>Pays if {yes ? 'YES' : 'NO'} wins</dt><dd>{(qty * UNIT_NEAR).toFixed(3)} NEAR</dd></div>
        <div><dt>Bets close</dt><dd>{new Date(m.close_ns / 1e6).toUTCString().replace(':00 GMT', ' UTC')}</dd></div>
      </dl>
      {err && <p className="sheet-err" role="alert">{err}</p>}
      {wallet.account
        ? <button className="btn btn-red btn-block notch" disabled={!cost || sending} onClick={place}>{sending ? 'Opening wallet…' : `Buy ${qty} ${yes ? 'YES' : 'NO'} as ${wallet.account}`}</button>
        : <button className="btn btn-red btn-block notch" onClick={wallet.connect} disabled={!wallet.ready}>Connect a NEAR testnet wallet to trade</button>}
      <p className="sheet-note">Signed by your MyNearWallet testnet account. Email sign-in and gasless relayed bets are not built yet.</p>
      <Link to={`/market/${m.id}`} className="sheet-link">Market details and source <Icon name="arrow" size={14} /></Link>
    </aside>
  </div>;
}

export default function Board({ wallet }: { wallet: Wallet }) {
  const { markets, error, reload } = useMarkets();
  const now = useNow();
  const [bet, setBet] = useState<Market | null>(null);
  const { open, settled, nextClose, nextEvent } = useMemo(() => {
    const list = markets ?? [];
    const open = list.filter((m) => m.status === 'Open' && m.close_ns / 1e6 > now).sort((a, b) => a.close_ns - b.close_ns);
    const settled = list.filter((m) => !(m.status === 'Open' && m.close_ns / 1e6 > now));
    return { open, settled, nextClose: open[0]?.close_ns, nextEvent: open[0] ? eventDate(open[0]) : null };
  }, [markets, now]);

  return <div className="board">
    <section className="event-hero">
      <Art src="/art/kotoba-og.webp" alt="A row of brass press microphones on a dark table, one glowing red" className="event-art" eager />
      <div className="event-inner">
        <p className="label">Upcoming · Federal Reserve</p>
        <h1>{nextEvent ? <>FOMC press conference<br /><span className="dim">{fmtDate(nextEvent)} · 2:30 p.m. ET</span></> : 'No open events'}</h1>
        {nextClose ? <><p className="event-sub">Bets close five minutes before the chair takes the podium.</p><Countdown target={nextClose / 1e6} now={now} /></> : <p className="event-sub">The scheduler opens the standard word markets for each FOMC date on the Fed calendar.</p>}
      </div>
    </section>

    <section className="board-sec">
      <header className="board-head"><h2>Open markets</h2><span className="mono dim">{markets ? `${open.length} live · odds refresh every 30 s` : ''}</span></header>
      {error ? <State kind="error" title="Could not read the contract" action={<button className="btn btn-ghost btn-sm" onClick={reload}>Retry</button>}>{error}</State>
        : !markets ? <div className="grid">{[0, 1, 2, 3].map((i) => <div key={i} className="card skeleton" />)}</div>
        : open.length === 0 ? <State kind="empty" title="No market is taking bets">The next FOMC markets open when the scheduler runs against the Fed calendar.</State>
        : <div className="grid">{open.map((m) => <MarketCard key={m.id} m={m} now={now} onBet={setBet} />)}</div>}
    </section>

    {settled.length > 0 && <section className="board-sec">
      <header className="board-head"><h2>Settled and closed</h2><span className="mono dim">resolved by OutLayer · re-checkable</span></header>
      <div className="grid">{settled.map((m) => <MarketCard key={m.id} m={m} now={now} onBet={setBet} />)}</div>
    </section>}

    {bet && <BetSheet m={bet} wallet={wallet} onClose={() => setBet(null)} />}
  </div>;
}
