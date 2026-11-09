import { useEffect, useState } from 'react';
import Landing from './Landing';
import Board from './Board';
import MarketPage from './MarketPage';
import Creators from './Creators';
import { Icon, Link } from './ui';
import { useWallet } from './wallet';
import { CONTRACT, accountUrl, short } from './lib';

function useRoute() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const on = () => setPath(location.pathname); addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, []);
  return path;
}

export default function App() {
  const path = useRoute();
  const wallet = useWallet();
  const marketId = path.match(/^\/market\/([a-z0-9-]+)/)?.[1];
  const page = marketId ? 'market' : path.startsWith('/app') ? 'app' : path.startsWith('/creators') ? 'creators' : 'home';
  useEffect(() => {
    document.title = page === 'home' ? 'Kotoba · Bet on what they’ll say' : page === 'app' ? 'Kotoba · Board' : page === 'creators' ? 'Kotoba · Creators' : `Kotoba · ${marketId}`;
  }, [page, marketId]);
  const cur = (p: string) => (page === p ? 'page' : undefined);
  return <div className={`shell page-${page}`}>
    <a className="skip" href="#main">Skip to content</a>
    <header className="topbar">
      <Link to="/" className="wordmark"><span className="wm-kanji">言葉</span><span className="wm-latin">Kotoba</span></Link>
      <nav className="nav" aria-label="Primary">
        <Link to="/app" aria-current={cur('app')}>Board</Link>
        <Link to="/creators" aria-current={cur('creators')}>Creators</Link>
        <Link to="/#how">How it settles</Link>
      </nav>
      <div className="topbar-end">
        <span className="net"><i className="live-dot" />Testnet</span>
        {wallet.account ? <button className="btn btn-ghost btn-sm" onClick={wallet.disconnect} title="Sign out">{short(wallet.account, 10, 8)}</button>
          : page === 'home' ? <Link to="/app" className="btn btn-red btn-sm">Open board</Link>
          : <button className="btn btn-red btn-sm" onClick={wallet.connect} disabled={!wallet.ready}>Connect</button>}
      </div>
    </header>
    {wallet.error && <p className="banner" role="alert">{wallet.error} <button onClick={() => wallet.setError('')} aria-label="Dismiss"><Icon name="x" size={14} /></button></p>}
    <main id="main">
      {page === 'home' && <Landing />}
      {page === 'app' && <Board wallet={wallet} />}
      {page === 'creators' && <Creators wallet={wallet} />}
      {page === 'market' && <MarketPage id={marketId!} />}
    </main>
    <footer className="foot">
      <div className="foot-row">
        <p>Word markets on NEAR testnet, settled by an attested OutLayer program. Inspired by Mentioned and Memetic Machines (Colosseum Frontier 2026).</p>
        <div className="foot-links"><a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer">Contract <Icon name="external" size={12} /></a><a href="https://outlayer.ai" target="_blank" rel="noreferrer">OutLayer <Icon name="external" size={12} /></a><span>MIT · © 2026 Nivesh Gajengi</span></div>
      </div>
      <div className="foot-mark" aria-hidden="true"><span>言葉</span>KOTOBA</div>
    </footer>
  </div>;
}
