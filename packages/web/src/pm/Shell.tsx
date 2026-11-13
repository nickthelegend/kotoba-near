import { useState, type ReactNode } from 'react';
import { Link, navigate } from '../ui';
import { shortAccount, CONTRACT, accountURL, type Snapshot } from './data';
import type { Wallet } from '../wallet';

export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link to="/" className={'k-logo' + (dark ? ' dark' : '')} aria-label="Kotoba home">
      <span className="k-mark">言</span>
      <span>kotoba</span>
    </Link>
  );
}

export function Header({ path, wallet, snap }: { path: string; wallet: Wallet; snap: Snapshot | null }) {
  const [q, setQ] = useState('');
  const words = snap?.markets ?? [];
  const hits = q.trim() ? words.filter(m => m.phrase.includes(q.trim().toLowerCase())).slice(0, 6) : [];
  const active = (p: string) => (path.startsWith(p) ? 'page' : undefined);
  return (
    <header className="k-header">
      <div className="k-header-row">
        <Logo />
        <div className="k-search">
          <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input aria-label="Search words" placeholder="Search words, like “AI” or “oil”" value={q} onChange={e => setQ(e.target.value)} />
          {hits.length > 0 && (
            <div className="k-search-results" role="listbox">
              {hits.map(m => (
                <button key={m.id} onClick={() => { setQ(''); navigate(`/event/${m.event_id}?word=${m.id}`); }}>
                  <b>{m.phrase === 'ai' ? 'AI' : m.phrase}</b><span>{m.event.replace(/ press conference\?$/, '')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <nav className="k-nav">
          <Link to="/markets" aria-current={active('/markets') ?? active('/event')}>Markets</Link>
          <Link to="/portfolio" aria-current={active('/portfolio')}>Portfolio</Link>
          <Link to="/activity" aria-current={active('/activity')}>Activity</Link>
        </nav>
        <Connect wallet={wallet} snap={snap} />
      </div>
      <div className="k-cats">
        <Link to="/markets" aria-current={path === '/markets' ? 'page' : undefined}>All</Link>
        <Link to="/markets?c=fed">Fed chair</Link>
        <Link to="/markets?c=resolved">Resolved</Link>
        <span className="k-soon">Earnings calls <small>soon</small></span>
        <span className="k-soon">Debates <small>soon</small></span>
        <span className="k-soon">White House <small>soon</small></span>
        <span className="k-net"><i /> NEAR testnet</span>
      </div>
    </header>
  );
}

export function Connect({ wallet, snap }: { wallet: Wallet; snap: Snapshot | null }) {
  if (!wallet.account) {
    return <button className="k-btn k-btn-dark" onClick={wallet.connect} disabled={!wallet.ready || wallet.connecting}>{wallet.connecting ? 'Opening wallet…' : 'Connect wallet'}</button>;
  }
  const cash = snap ? Number(BigInt(snap.cash) / 10n ** 18n) / 1e6 : null;
  return (
    <div className="k-account">
      <Link to="/portfolio" className="k-account-cash"><small>Cash</small><b>{cash === null ? '…' : `${cash.toLocaleString('en-US', { maximumFractionDigits: 4 })} NEAR`}</b></Link>
      <button className="k-avatar" title={`${wallet.account} · click to disconnect`} onClick={wallet.disconnect}>
        <span>{wallet.account[0].toUpperCase()}</span>{shortAccount(wallet.account)}
      </button>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="k-footer">
      <div>
        <Logo />
        <p>Mention markets on NEAR. Testnet coins only, no cash value.</p>
      </div>
      <div className="k-footer-links">
        <Link to="/markets">Markets</Link>
        <Link to="/portfolio">Portfolio</Link>
        <Link to="/activity">Activity</Link>
        <Link to="/event/fed-2026-12-09/rules">How markets resolve</Link>
        <a href={accountURL(CONTRACT)} target="_blank" rel="noreferrer">Contract ↗</a>
        <Link to="/previous/app">Previous version</Link>
      </div>
    </footer>
  );
}

export function MobileNav({ path }: { path: string }) {
  const items: [string, string, ReactNode][] = [
    ['/markets', 'Markets', <path key="m" d="M4 19V9m6 10V5m6 14v-7m4 7H2" />],
    ['/portfolio', 'Portfolio', <path key="p" d="M3 7h18v13H3zM8 7V4h8v3" />],
    ['/activity', 'Activity', <path key="a" d="M3 12h4l3-8 4 16 3-8h4" />],
  ];
  return (
    <nav className="k-mnav">
      {items.map(([to, name, icon]) => (
        <Link key={to} to={to} aria-current={path.startsWith(to) || (to === '/markets' && path.startsWith('/event')) ? 'page' : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden>{icon}</svg>{name}
        </Link>
      ))}
    </nav>
  );
}

export function ErrorBar({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="k-errorbar" role="alert"><span>{message}</span><button onClick={onRetry}>Try again</button></div>;
}
