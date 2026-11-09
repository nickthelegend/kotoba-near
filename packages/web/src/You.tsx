import { useEffect, useState } from 'react';
import Head from './Head';
import { Icon, Link, State, useMarkets, useNow } from './ui';
import { UNIT_NEAR, accountUrl, balanceOf, isOpen, outcome, type Market } from './lib';
import type { Wallet } from './wallet';

type Position = { m: Market; yes: number; no: number };

export default function You({ wallet, desktop }: { wallet: Wallet; desktop: boolean }) {
  const { markets, error } = useMarkets();
  const now = useNow();
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [posErr, setPosErr] = useState('');
  const [busy, setBusy] = useState('');
  useEffect(() => {
    setPositions(null); setPosErr('');
    if (!wallet.account || !markets) return;
    let live = true;
    Promise.all(markets.map(async (m) => ({ m, yes: await balanceOf(m.id, wallet.account, true), no: await balanceOf(m.id, wallet.account, false) })))
      .then((p) => live && setPositions(p.filter((x) => x.yes || x.no)))
      .catch((e) => live && setPosErr(String(e.message || e)));
    return () => { live = false; };
  }, [wallet.account, markets]);
  async function claim(id: string) {
    setBusy(id);
    try { await wallet.callContract('claim', { id }, '0', 50); } catch (e) { setPosErr(String((e as Error).message || e)); } finally { setBusy(''); }
  }
  return <div className={desktop ? 'web-page' : 'ph-page'}>
    <Head wallet={wallet} desktop={desktop} />
    <header className="page-title">
      <h1>You</h1>
      <p>{wallet.account ? <>Signed in as <a href={accountUrl(wallet.account)} target="_blank" rel="noreferrer" className="mono">{wallet.account}</a>. Share balances below are read live from the contract.</> : 'Connect a NEAR testnet wallet to see your YES and NO shares and claim winnings.'}</p>
    </header>
    {!wallet.account ? <State kind="setup" title="No wallet connected" action={<button className="pill-coral" onClick={wallet.connect} disabled={!wallet.ready}>Connect with MyNearWallet</button>}>Kotoba runs on NEAR testnet. A testnet account is free at testnet.mynearwallet.com.</State>
      : error && !markets ? <State kind="error" title="Could not read the contract">{error}</State>
      : posErr ? <State kind="error" title="Could not read your shares">{posErr}</State>
      : !positions ? <State kind="loading" title="Reading your shares…" />
      : positions.length === 0 ? <State kind="empty" title="No shares yet" action={<Link to="/app" className="pill-coral">Open the board</Link>}>Pick a word on the board and make your call.</State>
      : <ul className="position-list">{positions.map(({ m, yes, no }) => {
          const res = outcome(m);
          const win = res === 'YES' ? yes : res === 'NO' ? no : 0;
          return <li key={m.id} className="position">
            <div className="position-main"><Link to={`/market/${m.id}`}><b>“{m.phrase}”</b></Link><span>{m.event.replace('FOMC press conference', 'Fed')}</span></div>
            <div className="position-sides">{yes > 0 && <span className="yn-chip yes">{yes} YES</span>}{no > 0 && <span className="yn-chip no">{no} NO</span>}</div>
            <div className="position-act">{isOpen(m, now) ? <span className="lbl">Open</span>
              : m.status === 'Final' && win > 0 ? <button className="pill-coral" disabled={busy === m.id} onClick={() => claim(m.id)}>Claim {(win * UNIT_NEAR).toFixed(3)} NEAR</button>
              : <span className="lbl">{res ? `Settled ${res}${m.status === 'Final' ? '' : ' · provisional'}` : 'Closed'}</span>}</div>
          </li>;
        })}</ul>}
    <div className="you-links">
      <Link to="/creators" className="you-link"><Icon name="pen" /><span><b>Open a market</b><small>Seed a word market on a Fed press conference and keep 1% of every trade.</small></span><Icon name="arrow" /></Link>
      {wallet.account && <button className="you-link" onClick={wallet.disconnect}><Icon name="wallet" /><span><b>Sign out</b><small>{wallet.account}</small></span><Icon name="arrow" /></button>}
    </div>
  </div>;
}
