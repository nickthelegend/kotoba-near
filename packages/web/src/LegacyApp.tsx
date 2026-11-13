import { useEffect, useState } from 'react';
import Landing from './Landing';
import Board from './Board';
import Resolved from './Resolved';
import You from './You';
import MarketPage from './MarketPage';
import Creators from './Creators';
import { Boundary, Icon, Link, Mark, Toaster, useMedia } from './ui';
import { useWallet, type Wallet } from './wallet';
import { CONTRACT, accountUrl, short } from './lib';

function useRoute() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => { const on = () => setPath(location.pathname); addEventListener('popstate', on); return () => removeEventListener('popstate', on); }, []);
  return path;
}

type Page = 'home' | 'app' | 'resolved' | 'you' | 'creators' | 'market';
const TABS: { page: Page; to: string; label: string; icon: string }[] = [
  { page: 'app', to: '/app', label: 'Board', icon: 'board' },
  { page: 'resolved', to: '/resolved', label: 'Resolved', icon: 'resolved' },
  { page: 'you', to: '/you', label: 'You', icon: 'user' },
];

function Sidebar({ page, wallet }: { page: Page; wallet: Wallet }) {
  const cur = (p: Page) => (page === p || (p === 'resolved' && page === 'market') ? 'page' : undefined);
  return <aside className="side">
    <Link to="/" className="side-logo" aria-label="Kotoba home"><Mark size={36} /></Link>
    <nav aria-label="App">
      {TABS.map((t) => <Link key={t.page} to={t.to} aria-current={cur(t.page)}><Icon name={t.icon} />{t.label}</Link>)}
      <Link to="/creators" aria-current={cur('creators')}><Icon name="pen" />Creators</Link>
      <Link to="/#how"><Icon name="book" />How it settles</Link>
    </nav>
    <div className="side-foot">
      <span className="net"><i className="live-dot" />NEAR testnet</span>
      <a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer" className="mono">{short(CONTRACT, 10, 8)} <Icon name="external" size={11} /></a>
      {wallet.account && <button className="side-out" onClick={wallet.disconnect}>Sign out {short(wallet.account, 8, 6)}</button>}
    </div>
  </aside>;
}

function TabBar({ page }: { page: Page }) {
  return <nav className="tabbar" aria-label="App">
    {TABS.map((t) => <Link key={t.page} to={t.to} className="tab" aria-current={page === t.page ? 'page' : undefined}><Icon name={t.icon} size={20} /><span>{t.label}</span></Link>)}
  </nav>;
}

export default function App() {
  const path = useRoute().replace(/^\/previous/, '') || '/';
  const wallet = useWallet();
  const desktop = useMedia('(min-width: 960px)');
  const marketId = path.match(/^\/market\/([a-z0-9-]+)/)?.[1];
  const page: Page = marketId ? 'market' : path.startsWith('/app') ? 'app' : path.startsWith('/resolved') ? 'resolved' : path.startsWith('/you') ? 'you' : path.startsWith('/creators') ? 'creators' : 'home';
  useEffect(() => {
    const t: Record<Page, string> = { home: 'Kotoba · Bet on what they’ll say', app: 'Kotoba · Board', resolved: 'Kotoba · Resolved', you: 'Kotoba · You', creators: 'Kotoba · Creators', market: `Kotoba · ${marketId}` };
    document.title = t[page];
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', page === 'home' || !desktop ? '#141210' : '#f7efe6');
  }, [page, marketId, desktop]);

  const issue = wallet.problem ?? wallet.network;
  const banner = issue && <p className="banner" role="alert"><span><b>{issue.title}.</b> {issue.next}</span> {wallet.problem && <button onClick={() => wallet.setProblem(null)} aria-label="Dismiss"><Icon name="x" size={14} /></button>}{!wallet.problem && wallet.network && <button className="banner-act" onClick={wallet.disconnect}>Sign out</button>}</p>;
  if (page === 'home') return <div className="site"><a className="skip" href="#main">Skip to content</a>{banner}<Boundary label="This page"><Landing /></Boundary><Toaster /></div>;

  return <div className={`app ${desktop ? 'app-web' : 'app-phone'}`}>
    <a className="skip" href="#main">Skip to content</a>
    {desktop && <Sidebar page={page} wallet={wallet} />}
    <main id="main" className="app-main">
      {banner}
      <Boundary key={page + (marketId ?? '')} label="This page">
        {page === 'app' && <Board wallet={wallet} desktop={desktop} />}
        {page === 'resolved' && <Resolved wallet={wallet} desktop={desktop} />}
        {page === 'you' && <You wallet={wallet} desktop={desktop} />}
        {page === 'creators' && <Creators wallet={wallet} />}
        {page === 'market' && <MarketPage id={marketId!} wallet={wallet} />}
      </Boundary>
    </main>
    <Toaster />
    {!desktop && <TabBar page={page === 'creators' ? 'you' : page} />}
  </div>;
}
