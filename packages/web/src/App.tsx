import { useEffect, useMemo, useState } from 'react';
import LegacyApp from './LegacyApp';
import { useWallet } from './wallet';
import { CONTRACT, groupEvents, useSnapshot, refresh } from './pm/data';
import { Header, Footer, MobileNav, ErrorBar } from './pm/Shell';
import { Landing } from './pm/Landing';
import { Markets } from './pm/Markets';
import { EventPage } from './pm/Event';
import { Portfolio, Activity } from './pm/Portfolio';
import './pm/pm.css';

function useLocation() {
  const [loc, set] = useState(() => location.pathname + location.search);
  useEffect(() => { const f = () => set(location.pathname + location.search); addEventListener('popstate', f); return () => removeEventListener('popstate', f); }, []);
  const url = new URL(loc, location.origin);
  return { path: url.pathname.replace(/\/$/, '') || '/', query: url.searchParams };
}

const LEGACY = ['/market/', '/previous', '/resolved', '/creators', '/you'];

export default function App() {
  const { path } = useLocation();
  if (LEGACY.some(p => path.startsWith(p))) return <LegacyApp />;
  return <Kotoba />;
}

function Kotoba() {
  const { path, query } = useLocation();
  const wallet = useWallet(CONTRACT);
  const { snap, error } = useSnapshot(wallet.account);
  const events = useMemo(() => (snap ? groupEvents(snap.markets) : []), [snap]);
  useEffect(() => { document.title = path === '/' ? 'Kotoba · Bet on what they’ll say' : `Kotoba · ${path.split('/')[1].replace(/^\w/, c => c.toUpperCase())}`; }, [path]);

  if (path === '/') return <Landing events={events} snap={snap} />;
  const eventMatch = path.match(/^\/event\/([\w-]+)(\/rules)?$/);
  const event = eventMatch ? events.find(e => e.id === eventMatch[1]) ?? (eventMatch[1] === 'powell-dec-9' ? events[0] : undefined) : undefined;

  let body;
  if (!snap) body = error ? <Problem text={error} /> : <Loading />;
  else if (eventMatch) body = event ? <EventPage key={event.id} event={event} snap={snap} wallet={wallet} tab={eventMatch[2] ? 'rules' : 'market'} initialWord={query.get('word') ?? undefined} /> : <Problem text="That event does not exist on kotoba-markets.testnet." />;
  else if (path === '/portfolio') body = <Portfolio snap={snap} wallet={wallet} />;
  else if (path === '/activity') body = <Activity snap={snap} />;
  else body = <Markets events={events} snap={snap} filter={query.get('c') ?? 'all'} />;

  return (
    <div className="k-app">
      <Header path={path} wallet={wallet} snap={snap} />
      {snap && error && <ErrorBar message={`${error}. Showing the last good read.`} onRetry={() => refresh(wallet.account)} />}
      {(wallet.problem || wallet.network) && <ErrorBar message={(wallet.problem ?? wallet.network)!.title} onRetry={() => wallet.setProblem(null)} />}
      {body}
      <Footer />
      <MobileNav path={path} />
    </div>
  );
}

function Loading() {
  return (
    <main className="k-page k-loading" aria-busy="true">
      <div className="k-skel wide" /><div className="k-grid">{[0, 1, 2].map(i => <div key={i} className="k-card k-skel" />)}</div>
      <p className="k-muted">Reading live order books from NEAR testnet…</p>
    </main>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <main className="k-page">
      <div className="k-empty-hero">
        <img src="/art/3d/kotoba-3d-warning.webp" alt="" />
        <h1>Can’t read the markets</h1>
        <p>{text}</p>
        <button className="k-btn k-btn-dark" onClick={() => refresh()}>Try again</button>
      </div>
    </main>
  );
}
