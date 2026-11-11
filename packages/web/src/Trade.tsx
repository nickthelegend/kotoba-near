import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Countdown, Icon, Link, Obj, Problem, SplitBar, useMounted, useNow } from './ui';
import { UNIT_NEAR, fmtDate, isOpen, near, pct, quote, short, txUrl, yesPrice, type KEvent, type Market } from './lib';
import { explain, quantityError, upfrontYocto, type Explained } from './errors';
import { pending, useBalance, useMarkets, type LiveMarket } from './store';
import { runTx, type TxStage } from './tx';
import { WALLET, type Wallet } from './wallet';

function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return <div className="sheet-wrap" onClick={onClose}>
    <aside className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</aside>
  </div>;
}

const SLIPPAGE_BPS = 200n; // attach 2% over the quote; the contract refunds whatever it does not charge
const BUY_TGAS = 30;
const withSlippage = (y: bigint) => y + (y * SLIPPAGE_BPS + 9_999n) / 10_000n;

/** Why the buy button is disabled, or null when it can be pressed. */
function blockedReason(m: Market, now: number, wallet: Wallet, qtyErr: string | null, cost: bigint | null, spendable: bigint | null): string | null {
  if (m.status === 'Final') return 'This market has settled.';
  if (m.status === 'Provisional') return 'Bets are closed while the result can be challenged.';
  if (m.pending) return 'Bets are closed while the transcript is counted.';
  if (m.close_ns / 1e6 <= now) return `Bets closed at ${new Date(m.close_ns / 1e6).toUTCString().replace(':00 GMT', ' UTC')}.`;
  if (qtyErr) return qtyErr;
  if (!wallet.account) return null; // the button becomes Connect
  if (wallet.network) return wallet.network.title;
  if (cost === null) return 'Getting a price…';
  if (spendable !== null) {
    const need = upfrontYocto(withSlippage(cost), BUY_TGAS);
    if (spendable < need) return `You have ${near(spendable)}; this order needs ${near(need)} with slippage and gas.`;
  }
  return null;
}

export function BetSheet({ m: picked, side, wallet, onClose }: { m: Market; side: boolean; wallet: Wallet; onClose: () => void }) {
  const { markets } = useMarkets();
  const m: LiveMarket = markets?.find((x) => x.id === picked.id) ?? picked;
  const now = useNow();
  const { yocto: spendable } = useBalance(wallet.account);
  const [yes, setYes] = useState(side);
  const [raw, setRaw] = useState('10');
  const qtyErr = quantityError(raw);
  const qty = qtyErr ? 0 : Number(raw);
  const [cost, setCost] = useState<bigint | null>(null);
  const [shown, setShown] = useState<bigint | null>(null); // the price the player saw when they last changed the order
  const [quoteProblem, setQuoteProblem] = useState<Explained | null>(null);
  const [moved, setMoved] = useState<{ from: bigint; to: bigint } | null>(null);
  const [stage, setStage] = useState<TxStage | null>(null);
  const mounted = useMounted();
  const busy = stage?.step === 'checking' || stage?.step === 'signing' || stage?.step === 'pending';

  // Quote on every change (debounced), then re-quote with each market poll so the price stays live.
  const getQuote = useCallback(async (fresh: boolean) => {
    if (!qty) return null;
    try { const q = BigInt(await quote(m.id, yes, qty)); setCost(q); setQuoteProblem(null); if (fresh) setShown(q); return q; }
    catch (e) { setQuoteProblem(explain(e)); setCost(null); return null; }
  }, [m.id, yes, qty]);
  useEffect(() => {
    setCost(null); setShown(null); setMoved(null); setQuoteProblem(null);
    if (!qty) return;
    const t = setTimeout(() => getQuote(true), 180);
    return () => clearTimeout(t);
  }, [getQuote, qty]);
  const marketVersion = `${m.yes}/${m.no}/${m.status}`;
  useEffect(() => { if (qty && shown !== null && !busy) getQuote(false); }, [marketVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  async function place(accept?: bigint) {
    if (!qty) return;
    setMoved(null);
    // Re-quote right before signing; stop if the price moved past the slippage limit since the player looked.
    const fresh = await getQuote(false);
    if (fresh === null) return;
    const base = accept ?? shown ?? fresh;
    if (fresh > withSlippage(base)) { setMoved({ from: base, to: fresh }); return; }
    const key = `${m.id}:${Date.now()}`;
    await runTx(wallet, {
      method: 'buy', args: { id: m.id, yes, quantity: qty }, depositYocto: withSlippage(fresh), tgas: BUY_TGAS,
      label: `Buy ${qty.toLocaleString('en-US')} ${yes ? 'YES' : 'NO'} · “${m.phrase}”`,
      optimistic: {
        apply: () => pending.add({ key, id: m.id, yes, qty, account: wallet.account, stage: 'signing' }),
        submitted: (tx) => pending.update(key, { stage: 'pending', tx }),
        rollback: () => pending.remove(key), confirm: () => pending.remove(key),
      },
      onStage: setStage, inline: () => mounted.current,
    });
  }

  const p = yesPrice(m);
  const reason = blockedReason(m, now, wallet, qtyErr, cost, spendable);
  const done = stage?.step === 'confirmed';
  const failed = stage?.step === 'failed' ? stage.problem : null;
  const setQty = (n: number) => { setRaw(String(Math.min(100_000, Math.max(1, n)))); setStage(null); };
  return <Sheet label={`Trade ${m.phrase}`} onClose={onClose}>
    <header className="sheet-head">
      <span className="chip-src"><Icon name="mic" size={14} />{m.event.replace('FOMC press conference', 'Fed press conference')}</span>
      <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
    </header>
    <h2 className="sheet-q">Will they say <q>{m.phrase}</q>{m.threshold > 1 ? ` at least ${m.threshold} times` : ''}?</h2>
    {done ? <div className="sheet-done" role="status">
      <Obj name={yes ? 'yes' : 'no'} size={64} className="done-obj" alt={`${yes ? 'YES' : 'NO'} token`} />
      <div><b>Bought {qty.toLocaleString('en-US')} {yes ? 'YES' : 'NO'}</b><span>Pays {near(qty * UNIT_NEAR)} if {yes ? 'YES' : 'NO'} wins.</span>
        {stage?.tx && <a href={txUrl(stage.tx)} target="_blank" rel="noreferrer" className="mono">{short(stage.tx, 8, 6)} on NearBlocks <Icon name="external" size={12} /></a>}</div>
    </div> : <>
      <div className="pick" role="radiogroup" aria-label="Side">
        <button role="radio" aria-checked={yes} disabled={busy} className={`pick-btn pick-yes ${yes ? 'on' : ''}`} onClick={() => { setYes(true); setStage(null); }}><span>Yes</span><b>{pct(p)}</b></button>
        <button role="radio" aria-checked={!yes} disabled={busy} className={`pick-btn pick-no ${!yes ? 'on' : ''}`} onClick={() => { setYes(false); setStage(null); }}><span>No</span><b>{pct(1 - p)}</b></button>
      </div>
      <div className="stepper">
        <label className="lbl" htmlFor="qty">Shares</label>
        <div className="stepper-ctl">
          <button className="icon-btn" disabled={busy || qty <= 1} onClick={() => setQty((qty || 1) - 5)} aria-label="Fewer shares"><Icon name="minus" /></button>
          <input id="qty" inputMode="numeric" value={raw} disabled={busy} onChange={(e) => { setRaw(e.target.value.trim()); setStage(null); }} aria-label="Number of shares" aria-invalid={!!qtyErr} aria-describedby={qtyErr ? 'qty-err' : undefined} />
          <button className="icon-btn" disabled={busy || qty >= 100_000} onClick={() => setQty((qty || 0) + 5)} aria-label="More shares"><Icon name="plus" /></button>
        </div>
      </div>
      {qtyErr && <p className="field-err" id="qty-err">{qtyErr}</p>}
      <dl className="receipt">
        <div><dt>You pay <small>contract quote, incl. 1% creator fee</small></dt><dd>{qtyErr || quoteProblem ? '—' : cost === null ? <i className="pulse" /> : `${near(cost)}`}</dd></div>
        <div><dt>Max charge <small>2% slippage, unused part refunded</small></dt><dd>{cost === null ? '—' : `${near(withSlippage(cost))}`}</dd></div>
        <div><dt>Pays if {yes ? 'YES' : 'NO'} wins</dt><dd>{qty ? near(qty * UNIT_NEAR) : '—'}</dd></div>
        <div><dt>Bets close</dt><dd>{m.close_ns / 1e6 > now ? <Countdown target={m.close_ns / 1e6} now={now} compact /> : 'closed'}</dd></div>
      </dl>
      {shown !== null && cost !== null && cost !== shown && !moved && <p className="sheet-note" role="status">Price {cost > shown ? 'rose' : 'fell'} to {near(cost)} (was {near(shown)}).</p>}
    </>}
    {quoteProblem && <Problem x={quoteProblem} onRetry={() => getQuote(true)} compact />}
    {moved && <div className="problem" role="alert">
      <p><b>Price moved to {near(moved.to)}.</b> It was {near(moved.from)} when you set this order.</p>
      <button className="problem-act" onClick={() => { setShown(moved.to); place(moved.to); }}>Buy at {near(moved.to)}</button>
    </div>}
    {failed && <Problem x={failed} onRetry={failed.retry ? () => place() : undefined} />}
    {done ? <div className="sheet-acts"><button className="btn btn-coral btn-block" onClick={() => setStage(null)}>Buy more</button><Link to="/you" className="pill-light">See positions</Link></div>
      : !wallet.account
        ? <button className="btn btn-coral btn-block" onClick={wallet.connect} disabled={!wallet.ready || wallet.connecting || !!reason}>{wallet.connecting ? `Waiting for ${WALLET.name}…` : 'Connect a NEAR testnet wallet'}</button>
        : <button className="btn btn-coral btn-block" disabled={!!reason || busy || !!moved} onClick={() => place()}>
            {stage?.step === 'checking' ? 'Checking balance and price…' : stage?.step === 'signing' ? `Approve in ${WALLET.name}…` : stage?.step === 'pending' ? 'Waiting for NEAR testnet…' : `Buy ${qty ? qty.toLocaleString('en-US') : ''} ${yes ? 'YES' : 'NO'}${cost !== null ? ` · ${near(cost)}` : ''}`}
          </button>}
    {reason && !done && <p className="why" role="status"><Icon name="clock" size={14} />{reason}</p>}
    {stage?.step === 'pending' && stage.tx && <p className="sheet-note">Sent. <a href={txUrl(stage.tx)} target="_blank" rel="noreferrer">View on NearBlocks</a></p>}
    {wallet.problem && <Problem x={wallet.problem} compact />}
    <p className="sheet-note">{wallet.account ? `Signed in ${WALLET.name} as ${short(wallet.account, 14, 8)}.` : `Bets are signed in ${WALLET.name} on NEAR testnet.`} Shares pay out at settlement; there is no early sell.</p>
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
