import { useEffect, useState } from 'react';
import Head from './Head';
import { Icon, Link, Problem, State, useMarkets, useNow } from './ui';
import { UNIT_NEAR, accountUrl, batchBalance, isOpen, near, outcome, txUrl, type Market } from './lib';
import { explain, type Explained } from './errors';
import { CHAIN_CHANGED, refreshMarkets, usePending } from './store';
import { runTx } from './tx';
import type { Wallet } from './wallet';

type Position = { m: Market; yes: number; no: number };

/** What a position can do right now, from the live market state. */
function action(m: Market, now: number, yes: number, no: number) {
  const res = outcome(m);
  if (isOpen(m, now)) return { label: 'Open', note: '' };
  if (m.pending) return { label: 'Settling', note: 'Counting the transcript' };
  if (m.status === 'Provisional') return { label: `Result ${res} · provisional`, note: 'Claimable once finalized' };
  if (m.status === 'Final') {
    const win = res === 'YES' ? yes : no;
    return win > 0 ? { claim: 'claim' as const, amount: win * UNIT_NEAR, label: `Claim ${near(win * UNIT_NEAR)}` } : { label: `Settled ${res}`, note: 'No payout' };
  }
  if (now > m.deadline_ns / 1e6) return { claim: 'claim_void' as const, amount: ((yes + no) * UNIT_NEAR) / 2, label: `Refund ${near(((yes + no) * UNIT_NEAR) / 2)}` };
  return { label: 'Closed', note: 'Waiting for the transcript' };
}

export default function You({ wallet, desktop }: { wallet: Wallet; desktop: boolean }) {
  const { markets, problem } = useMarkets();
  const mine = usePending().filter((p) => p.account === wallet.account);
  const now = useNow();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [posProblem, setPosProblem] = useState<Explained | null>(null);
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState<{ id: string; x: Explained } | null>(null);
  const [epoch, setEpoch] = useState(0);
  const ids = markets?.map((m) => m.id).join(',') ?? '';
  useEffect(() => { const on = () => setEpoch((n) => n + 1); addEventListener(CHAIN_CHANGED, on); return () => removeEventListener(CHAIN_CHANGED, on); }, []);
  useEffect(() => {
    setPosProblem(null);
    if (!wallet.account || !markets) { setPositions(null); return; }
    let live = true;
    const tokens = markets.flatMap((m) => [`${m.id}:YES`, `${m.id}:NO`]);
    // One NEP-245 batch read for every share balance.
    batchBalance(wallet.account, tokens)
      .then((b) => live && setPositions(markets.map((m, i) => ({ m, yes: Number(b[2 * i]), no: Number(b[2 * i + 1]) })).filter((x) => x.yes || x.no)))
      .catch((e) => live && setPosProblem(explain(e)));
    return () => { live = false; };
  }, [wallet.account, ids, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  async function claim(m: Market, method: 'claim' | 'claim_void', amount: number) {
    setBusy(m.id); setFailed(null);
    const r = await runTx(wallet, { method, args: { id: m.id }, depositYocto: 0n, tgas: 30, label: `${method === 'claim' ? 'Claim' : 'Refund'} ${near(amount)} · “${m.phrase}”` });
    if (!r.ok) setFailed({ id: m.id, x: r.problem });
    setBusy('');
  }
  const live = (id: string) => markets?.find((x) => x.id === id);
  return <div className={desktop ? 'web-page' : 'ph-page'}>
    <Head wallet={wallet} desktop={desktop} />
    <header className="page-title">
      <h1>You</h1>
      <p>{wallet.account ? <>Signed in as <a href={accountUrl(wallet.account)} target="_blank" rel="noreferrer" className="mono">{wallet.account}</a>. Share balances below are read live from the contract.</> : 'Connect a NEAR testnet wallet to see your YES and NO shares and claim winnings.'}</p>
    </header>
    {!wallet.account ? <State kind="setup" title="No wallet connected" action={<button className="pill-coral" onClick={wallet.connect} disabled={!wallet.ready || wallet.connecting}>{wallet.connecting ? 'Waiting for MyNearWallet…' : 'Connect with MyNearWallet'}</button>}>Kotoba runs on NEAR testnet. A testnet account is free at testnet.mynearwallet.com.</State>
      : wallet.network ? <Problem x={wallet.network} />
      : problem && !markets ? <Problem x={problem} onRetry={() => refreshMarkets()} />
      : posProblem ? <Problem x={posProblem} onRetry={() => setEpoch((n) => n + 1)} />
      : !positions ? <ul className="position-list" aria-busy="true">{[0, 1, 2].map((i) => <li key={i} className="position skeleton-row" />)}</ul>
      : positions.length === 0 && mine.length === 0 ? <State kind="empty" title="No shares yet" action={<Link to="/app" className="pill-coral">Open the board</Link>}>Pick a word on the board and make your call.</State>
      : <ul className="position-list">
        {mine.map((p) => { const m = live(p.id); return <li key={p.key} className="position position-pending">
          <div className="position-main"><Link to={`/market/${p.id}`}><b>“{m?.phrase ?? p.id}”</b></Link><span>{p.stage === 'signing' ? 'Waiting for your approval' : 'Confirming on NEAR'}</span></div>
          <div className="position-sides"><span className={`yn-chip ${p.yes ? 'yes' : 'no'}`}>+{p.qty} {p.yes ? 'YES' : 'NO'}</span></div>
          <div className="position-act">{p.tx ? <a href={txUrl(p.tx)} target="_blank" rel="noreferrer" className="lbl">Pending ↗</a> : <span className="lbl">Pending</span>}</div>
        </li>; })}
        {positions.map(({ m, yes, no }) => {
          const a = action(m, now, yes, no);
          return <li key={m.id} className="position">
            <div className="position-main"><Link to={`/market/${m.id}`}><b>“{m.phrase}”</b></Link><span>{m.event.replace('FOMC press conference', 'Fed')}{'note' in a && a.note ? ` · ${a.note}` : ''}</span></div>
            <div className="position-sides">{yes > 0 && <span className="yn-chip yes">{yes} YES</span>}{no > 0 && <span className="yn-chip no">{no} NO</span>}</div>
            <div className="position-act">{'claim' in a && a.claim
              ? <button className="pill-coral" disabled={busy === m.id} onClick={() => claim(m, a.claim, a.amount)}>{busy === m.id ? 'Claiming…' : a.label}</button>
              : <span className="lbl">{a.label}</span>}</div>
            {failed?.id === m.id && <div className="position-err"><Problem x={failed.x} onRetry={'claim' in a && a.claim ? () => claim(m, a.claim, a.amount) : undefined} compact /></div>}
          </li>;
        })}
      </ul>}
    <div className="you-links">
      <Link to="/creators" className="you-link"><Icon name="pen" /><span><b>Open a market</b><small>Seed a word market on a Fed press conference and keep 1% of every trade.</small></span><Icon name="arrow" /></Link>
      {wallet.account && <button className="you-link" onClick={wallet.disconnect}><Icon name="wallet" /><span><b>Sign out</b><small>{wallet.account}</small></span><Icon name="arrow" /></button>}
    </div>
  </div>;
}
