import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';
import { listMarkets, countdown, yesPrice, pct, type Market } from './lib';

export function navigate(path: string) {
  if (location.pathname + location.hash === path) return;
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  const hash = path.split('#')[1];
  if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  else scrollTo({ top: 0 });
}
export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: ReactNode; 'aria-current'?: 'page' | undefined }) {
  const onClick = (e: MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(to); };
  return <a href={to} className={className} onClick={onClick} {...rest}>{children}</a>;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

let cache: { at: number; data: Market[] } | null = null;
export function useMarkets() {
  const [markets, setMarkets] = useState<Market[] | null>(cache?.data ?? null);
  const [error, setError] = useState('');
  const load = () => listMarkets().then((d) => { cache = { at: Date.now(), data: d }; setMarkets(d); setError(''); }).catch((e) => setError(String(e.message || e)));
  useEffect(() => { if (!cache || Date.now() - cache.at > 10_000) load(); const t = setInterval(() => { if (!document.hidden) load(); }, 30_000); return () => clearInterval(t); }, []);
  return { markets, error, reload: load };
}

const paths: Record<string, string> = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  seal: 'M12 3l2.4 1.6 2.9-.2 1 2.7 2.4 1.6-.6 2.8.9 2.8-2.3 1.7-.9 2.8-2.9.1L12 21l-2.4-1.6-2.9.1-.9-2.8L3.5 15l.9-2.8-.6-2.8 2.4-1.6 1-2.7 2.9.2z',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  chain: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  scale: 'M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
};
export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function Countdown({ target, now, compact }: { target: number; now: number; compact?: boolean }) {
  const c = countdown(target, now);
  if (c.done) return <span className="cd cd-done">Closed</span>;
  if (compact) return <span className="cd cd-compact">{c.d > 0 ? `${c.d}d ${c.h}h` : `${c.h}h ${String(c.m).padStart(2, '0')}m`}</span>;
  return <div className="cd" role="timer" aria-label={`${c.d} days ${c.h} hours ${c.m} minutes`}>
    {([['d', c.d], ['h', c.h], ['m', c.m], ['s', c.s]] as const).map(([k, v]) => <span key={k} className="cd-cell"><b>{String(v).padStart(2, '0')}</b><i>{k}</i></span>)}
  </div>;
}

export function OddsBar({ m }: { m: Pick<Market, 'yes' | 'no' | 'b'> }) {
  const p = yesPrice(m);
  return <div className="odds">
    <div className="odds-row"><span className="odds-yes">YES <b>{pct(p)}</b></span><span className="odds-no"><b>{pct(1 - p)}</b> NO</span></div>
    <div className="odds-track" aria-hidden="true"><span style={{ width: `${p * 100}%` }} /></div>
  </div>;
}

export function Copy({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button className="copy" onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); })} aria-label={`Copy ${label ?? 'value'}`}>{done ? 'Copied' : 'Copy'}</button>;
}

export function Art({ src, alt, className, eager }: { src: string; alt: string; className?: string; eager?: boolean }) {
  const [ok, setOk] = useState(true);
  return <div className={`art ${className ?? ''} ${ok ? '' : 'art-missing'}`}>{ok && <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setOk(false)} />}</div>;
}

export function State({ kind, title, children, action }: { kind: 'loading' | 'empty' | 'error' | 'setup'; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className={`state state-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <span className="state-mark" aria-hidden="true">{kind === 'loading' ? <i className="pulse" /> : kind === 'error' ? '!' : kind === 'setup' ? '◇' : '○'}</span>
    <div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>
  </div>;
}
