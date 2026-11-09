import { useEffect, useState, type ReactNode } from 'react';
import { Countdown, Icon, Link, SplitBar, useNow } from './ui';
import { UNIT_NEAR, fmtDate, isOpen, pct, quote, yesPrice, yoctoToNear, type KEvent, type Market } from './lib';
import type { Wallet } from './wallet';

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return <div className="sheet-wrap" onClick={onClose}>
    <aside className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</aside>
  </div>;
}

export function BetSheet({ m, side, wallet, onClose }: { m: Market; side: boolean; wallet: Wallet; onClose: () => void }) {
  const [yes, setYes] = useState(side);
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
  async function place() {
    if (!cost) return;
    setSending(true);
    try { await wallet.callContract('buy', { id: m.id, yes, quantity: qty }, cost); }
    catch (e) { setErr(String((e as Error).message || e)); }
    finally { setSending(false); }
  }
  const costNear = cost ? yoctoToNear(cost) : null;
  return <Sheet label={`Trade ${m.phrase}`} onClose={onClose}>
    <header className="sheet-head">
      <span className="chip-src"><Icon name="mic" size={14} />{m.event.replace('FOMC press conference', 'Fed press conference')}</span>
      <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
    </header>
    <h2 className="sheet-q">Will they say <q>{m.phrase}</q>{m.threshold > 1 ? ` at least ${m.threshold} times` : ''}?</h2>
    <div className="pick" role="radiogroup" aria-label="Side">
      <button role="radio" aria-checked={yes} className={`pick-btn pick-yes ${yes ? 'on' : ''}`} onClick={() => setYes(true)}><span>Yes</span><b>{pct(p)}</b></button>
      <button role="radio" aria-checked={!yes} className={`pick-btn pick-no ${!yes ? 'on' : ''}`} onClick={() => setYes(false)}><span>No</span><b>{pct(1 - p)}</b></button>
    </div>
    <div className="stepper">
      <span className="lbl">Shares</span>
      <div className="stepper-ctl">
        <button className="icon-btn" onClick={() => setQty((q) => Math.max(1, q - 5))} aria-label="Fewer shares"><Icon name="minus" /></button>
        <input inputMode="numeric" value={qty} onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, '')) || 0)} aria-label="Number of shares" />
        <button className="icon-btn" onClick={() => setQty((q) => Math.min(100_000, q + 5))} aria-label="More shares"><Icon name="plus" /></button>
      </div>
    </div>
    <dl className="receipt">
      <div><dt>You pay <small>contract quote, incl. 1% creator fee</small></dt><dd>{err ? '—' : costNear === null ? <i className="pulse" /> : `${costNear.toFixed(4)} NEAR`}</dd></div>
      <div><dt>Pays if {yes ? 'YES' : 'NO'} wins</dt><dd>{(qty * UNIT_NEAR).toFixed(3)} NEAR</dd></div>
      <div><dt>Bets close</dt><dd>{new Date(m.close_ns / 1e6).toUTCString().replace(':00 GMT', ' UTC')}</dd></div>
    </dl>
    {err && <p className="sheet-err" role="alert">{err}</p>}
    {wallet.account
      ? <button className="btn btn-coral btn-block" disabled={!cost || sending} onClick={place}>{sending ? 'Opening wallet…' : `Buy ${qty} ${yes ? 'YES' : 'NO'}`}</button>
      : <button className="btn btn-coral btn-block" onClick={wallet.connect} disabled={!wallet.ready}>Connect a NEAR testnet wallet</button>}
    <p className="sheet-note">{wallet.account ? `Signed by ${wallet.account} in MyNearWallet (testnet).` : 'Bets are signed in MyNearWallet on NEAR testnet.'} Email sign-in and gasless bets are not built yet.</p>
    <Link to={`/market/${m.id}`} className="sheet-link">Market details and source <Icon name="arrow" size={14} /></Link>
  </Sheet>;
}

/** "Your call": every word market on one event, priced live. */
export function EventSheet({ ev, onPick, onClose }: { ev: KEvent; onPick: (m: Market, yes: boolean) => void; onClose: () => void }) {
  const now = useNow();
  return <Sheet label={`${ev.title} markets`} onClose={onClose}>
    <header className="sheet-head">
      <span className="chip-src"><Icon name="mic" size={14} />FOMC · {ev.date ? fmtDate(ev.date) : ''}</span>
      <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
    </header>
    <h2 className="sheet-q">{ev.title}</h2>
    <p className="sheet-sub">{ev.open ? <>Bets close in <Countdown target={ev.closeMs} now={now} compact />, five minutes before the chair takes the podium.</> : 'Closed. Each market settled from the official transcript.'}</p>
    <ul className="word-list">
      {ev.markets.map((m) => <li key={m.id}>
        <div className="word-main"><SplitBar m={m} label={<b>“{m.phrase}”{m.threshold > 1 && <small> ≥ {m.threshold}×</small>}</b>} /></div>
        {isOpen(m, now) ? <div className="yn">
          <button className="yn-yes" onClick={() => onPick(m, true)}>Yes {pct(yesPrice(m))}</button>
          <button className="yn-no" onClick={() => onPick(m, false)}>No {pct(1 - yesPrice(m))}</button>
        </div> : <Link to={`/market/${m.id}`} className="pill-ink">Proof <Icon name="arrow" size={14} /></Link>}
      </li>)}
    </ul>
  </Sheet>;
}
