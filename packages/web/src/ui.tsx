import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode, type MouseEvent } from 'react';
import { countdown, yesPrice, pct, txUrl, short, type Market } from './lib';
import { explain, type Explained } from './errors';
import { toast, useToasts } from './store';
import { stickerSrc, type StickerName } from './art';

export function navigate(path: string) {
  if (location.pathname + location.hash === path) return;
  history.pushState({}, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
  const hash = path.split('#')[1];
  if (hash) requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  else scrollTo({ top: 0 });
}
export function Link({ to, className, children, ...rest }: { to: string; className?: string; children: ReactNode; 'aria-current'?: 'page' | undefined; 'aria-label'?: string }) {
  const onClick = (e: MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(to); };
  return <a href={to} className={className} onClick={onClick} {...rest}>{children}</a>;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function useMedia(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches);
  useEffect(() => { const mq = matchMedia(query); const on = () => setMatch(mq.matches); mq.addEventListener('change', on); on(); return () => mq.removeEventListener('change', on); }, [query]);
  return match;
}

export { useMarkets, useBalance } from './store';

/** True while the component is mounted: lets a transaction skip its error toast when the error is shown inline. */
export function useMounted() { const r = useMemo(() => ({ current: true }), []); useEffect(() => { r.current = true; return () => { r.current = false; }; }, [r]); return r; }

const paths: Record<string, string> = {
  arrow: 'M5 12h14M13 6l6 6-6 6',
  arrowUp: 'M7 17L17 7M9 7h8v8',
  arrowDown: 'M7 7l10 10M17 9v8H9',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  seal: 'M12 3l2.4 1.6 2.9-.2 1 2.7 2.4 1.6-.6 2.8.9 2.8-2.3 1.7-.9 2.8-2.9.1L12 21l-2.4-1.6-2.9.1-.9-2.8L3.5 15l.9-2.8-.6-2.8 2.4-1.6 1-2.7 2.9.2z',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  mic: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4M9 21h6',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  chain: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  scale: 'M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  board: 'M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z',
  resolved: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.7 2.7L16 9.8',
  pen: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.5M4 4v4h4M4 13a8 8 0 0 0 14.6 4.5M20 20v-4h-4',
  book: 'M5 4h9a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM5 16a4 4 0 0 1 4-4h9',
  wallet: 'M4 7a2 2 0 0 1 2-2h12v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14h.01',
  bars: 'M4 7h16M7 12h10M10 17h4',
};
export function Icon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

/** The Kotoba mark: 言 ("word") on a coral tile. */
export function Mark({ size = 28 }: { size?: number }) {
  return <span className="mark" style={{ width: size, height: size, fontSize: size * 0.58 }} aria-hidden="true">言</span>;
}
export function Wordmark() {
  return <span className="wordmark"><Mark /><span className="wm">Kotoba<i>.</i></span></span>;
}

export function Countdown({ target, now, compact }: { target: number; now: number; compact?: boolean }) {
  const c = countdown(target, now);
  if (c.done) return <span className="cd cd-done">Closed</span>;
  if (compact) return <span className="cd cd-compact">{c.d > 0 ? `${c.d}d ${c.h}h` : c.h > 0 ? `${c.h}h ${String(c.m).padStart(2, '0')}m` : `${c.m}m ${String(c.s).padStart(2, '0')}s`}</span>;
  return <div className="cd" role="timer" aria-label={`${c.d} days ${c.h} hours ${c.m} minutes`}>
    {([['d', c.d], ['h', c.h], ['m', c.m], ['s', c.s]] as const).map(([k, v]) => <span key={k} className="cd-cell"><b>{String(v).padStart(2, '0')}</b><i>{k}</i></span>)}
  </div>;
}

/** YES/NO split from the live LMSR price. */
export function SplitBar({ m, label }: { m: Pick<Market, 'yes' | 'no' | 'b'>; label?: ReactNode }) {
  const p = yesPrice(m);
  return <div className="split-bar">
    <div className="split-row"><span className="split-l">{label}</span><span className="split-v"><b className={p >= 0.5 ? 'pos' : 'neg'}>{pct(p >= 0.5 ? p : 1 - p)}</b> {p >= 0.5 ? 'YES' : 'NO'}</span></div>
    <div className="split-track" aria-label={`YES ${pct(p)}, NO ${pct(1 - p)}`} role="img"><span className="yes" style={{ flexGrow: p }} /><span className="no" style={{ flexGrow: 1 - p }} /></div>
  </div>;
}

export function Copy({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return <button className="copy" onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400); })} aria-label={`Copy ${label ?? 'value'}`}>{done ? 'Copied' : 'Copy'}</button>;
}

/** Event photo: generated art, or the press-room photo printed as a coral duotone. */
export function EventPhoto({ src, generated, className }: { src: string; generated: boolean; className?: string }) {
  const [ok, setOk] = useState(true);
  return <div className={`ev-photo ${generated ? '' : 'duo'} ${className ?? ''}`} aria-hidden="true">{ok && <img src={src} alt="" loading="lazy" decoding="async" onError={() => setOk(false)} />}</div>;
}

// Drawn stand-ins for the generated stickers, in the same coral duotone, until the PNGs land in public/art.
const glyphs: Record<StickerName, ReactNode> = {
  mic: <><rect x="24" y="8" width="16" height="28" rx="8" /><path d="M16 30a16 16 0 0 0 32 0" fill="none" strokeWidth="4" /><rect x="30" y="44" width="4" height="10" /><rect x="20" y="53" width="24" height="5" rx="2" /><path d="M24 16h16M24 22h16M24 28h16" stroke="#ff8a7f" strokeWidth="1.6" /></>,
  building: <><path d="M8 24L32 10l24 14z" /><rect x="10" y="26" width="44" height="4" /><rect x="13" y="32" width="5" height="18" /><rect x="23" y="32" width="5" height="18" /><rect x="36" y="32" width="5" height="18" /><rect x="46" y="32" width="5" height="18" /><rect x="8" y="51" width="48" height="4" /><rect x="5" y="56" width="54" height="4" /></>,
  gavel: <><g transform="rotate(-35 30 26)"><rect x="16" y="14" width="28" height="12" rx="3" /><rect x="12" y="12" width="6" height="16" rx="2" /><rect x="42" y="12" width="6" height="16" rx="2" /><rect x="28" y="26" width="5" height="30" rx="2" /></g><rect x="30" y="50" width="26" height="7" rx="2" /></>,
  newspaper: <><path d="M10 12h40v40a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z" /><path d="M50 22h6v30a6 6 0 0 1-6 6" /><g fill="#ff8a7f"><rect x="15" y="17" width="30" height="7" /><rect x="15" y="28" width="13" height="12" /><rect x="31" y="28" width="14" height="2.5" /><rect x="31" y="33" width="14" height="2.5" /><rect x="31" y="38" width="10" height="2.5" /><rect x="15" y="44" width="30" height="2.5" /><rect x="15" y="49" width="24" height="2.5" /></g></>,
  coin: <><circle cx="32" cy="32" r="24" /><circle cx="32" cy="32" r="18" fill="none" stroke="#ff8a7f" strokeWidth="2" /><text x="32" y="41" textAnchor="middle" fontSize="24" fontWeight="700" fill="#ff8a7f" fontFamily="sans-serif">言</text></>,
  podium: <><path d="M14 26h36l-5 30H19z" /><rect x="10" y="22" width="44" height="6" rx="2" /><path d="M26 22l-4-12M38 22l4-12" fill="none" strokeWidth="3" /><circle cx="22" cy="9" r="3.5" /><circle cx="42" cy="9" r="3.5" /><rect x="26" y="34" width="12" height="12" rx="6" fill="#ff8a7f" /></>,
};
function torn(seed: number) {
  let s = seed * 9301 + 49297;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pts: string[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) pts.push(`${(i / n) * 100}% ${r() * 3}%`);
  for (let i = 0; i < n; i++) pts.push(`${100 - r() * 3}% ${(i / n) * 100}%`);
  for (let i = 0; i < n; i++) pts.push(`${100 - (i / n) * 100}% ${100 - r() * 3}%`);
  for (let i = 0; i < n; i++) pts.push(`${r() * 3}% ${100 - (i / n) * 100}%`);
  return `polygon(${pts.join(',')})`;
}
export function Sticker({ name, className, seed = 1 }: { name: StickerName; className?: string; seed?: number }) {
  const src = stickerSrc(name);
  const [ok, setOk] = useState(true);
  const clip = useMemo(() => torn(seed), [seed]);
  if (src && ok) return <div className={`sticker sticker-img ${className ?? ''}`} aria-hidden="true"><img src={src} alt="" decoding="async" onError={() => setOk(false)} /></div>;
  return <div className={`sticker sticker-drawn ${className ?? ''}`} aria-hidden="true">
    <div className="sticker-paper" style={{ clipPath: clip }}><div className="sticker-face"><svg viewBox="0 0 64 64" fill="#3d0d09" stroke="#3d0d09">{glyphs[name]}</svg></div></div>
  </div>;
}

/* The 3D enamel kit (docs/ART-3D.md): one glossy object per spot, fixed size so nothing shifts, a slow float that
   prefers-reduced-motion turns off. */
const OBJ_ALT = {
  mic: 'Coral enamel broadcast microphone with a smiling face',
  bubble: 'Coral enamel speech bubble holding a cream word tile with a smiling face',
  transcript: 'Cream transcript page between two coral rolls, one line highlighted',
  abacus: 'Coral enamel abacus with cream beads, mid-count',
  yes: 'Green enamel YES token with an up arrow',
  no: 'Coral enamel NO token with a down arrow',
  cube: 'Coral enamel enclave cube with a cream seal on its side',
  gavel: 'Coral enamel gavel resting on its sound block',
  magnifier: 'Coral magnifier enlarging one highlighted line on a page',
  trophy: 'Coral enamel trophy cup with a cream rim',
  quiet: 'Sleeping coral enamel microphone',
  warning: 'Coral enamel warning triangle',
  seal: 'Coral enamel seal rosette with a check mark',
  stopwatch: 'Coral enamel stopwatch with a cream dial',
  wallet: 'Coral enamel wallet with a smiling face',
} as const;
export type ObjName = keyof typeof OBJ_ALT;
export function Obj({ name, size, className, still, alt }: { name: ObjName; size: number; className?: string; still?: boolean; alt?: string }) {
  return <img className={`obj ${still ? '' : 'obj-float'} ${className ?? ''}`} src={`/art/3d/kotoba-3d-${name}.webp`} width={size} height={size} alt={alt ?? OBJ_ALT[name]} loading="lazy" decoding="async" draggable={false} />;
}

export function State({ kind, title, children, action, art }: { kind: 'loading' | 'empty' | 'error' | 'setup'; title: string; children?: ReactNode; action?: ReactNode; art?: ObjName }) {
  const obj = art ?? (kind === 'error' ? 'warning' : undefined);
  return <div className={`state state-${kind} ${obj ? 'state-art' : ''}`} role={kind === 'error' ? 'alert' : 'status'}>
    {obj ? <Obj name={obj} size={88} className="state-obj" /> : <span className="state-mark" aria-hidden="true">{kind === 'loading' ? <i className="pulse" /> : kind === 'error' ? '!' : kind === 'setup' ? '◇' : '○'}</span>}
    <div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>
  </div>;
}

/** A mapped error as a product would say it: one sentence, the contract's own code in small print, one next step. */
export function Problem({ x, onRetry, compact, className }: { x: Explained; onRetry?: () => void; compact?: boolean; className?: string }) {
  const act = onRetry && x.retry ? <button className="problem-act" onClick={onRetry}>Try again</button>
    : x.tx ? <a className="problem-act" href={txUrl(x.tx)} target="_blank" rel="noreferrer">View transaction</a> : null;
  return <div className={`problem ${compact ? 'problem-compact' : ''} ${className ?? ''}`} role="alert" title={x.detail}>
    <p><b>{x.title}.</b> {x.next}{x.code && /^ERR_|^Method /.test(x.code) && <small className="problem-code"> Contract: {x.code}</small>}</p>
    {act}
  </div>;
}

/** Keeps one failing panel from blanking the page: it shows the real error and a retry in that panel's place. */
export class Boundary extends Component<{ label: string; children: ReactNode }, { error: unknown; key: number }> {
  state = { error: null as unknown, key: 0 };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidCatch(error: unknown, info: ErrorInfo) { console.error(`[${this.props.label}]`, error, info.componentStack); }
  render() {
    if (!this.state.error) return <div key={this.state.key} style={{ display: 'contents' }}>{this.props.children}</div>;
    const x = explain(this.state.error);
    return <State kind="error" title={`${this.props.label} failed to render`} action={<button className="pill-light" onClick={() => this.setState((s) => ({ error: null, key: s.key + 1 }))}>Try again</button>}>{x.detail}</State>;
  }
}

/** Transaction toasts: pending (with the NearBlocks link as soon as there is a hash), confirmed, or the mapped failure. */
export function Toaster() {
  const list = useToasts();
  return <div className="toasts" aria-live="polite" aria-relevant="additions text">
    {list.map((t) => <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
      <span className="toast-mark" aria-hidden="true">{t.tone === 'pending' ? <i className="pulse" /> : <Icon name={t.tone === 'success' ? 'check' : t.tone === 'error' ? 'x' : 'seal'} size={16} />}</span>
      <div className="toast-body"><b>{t.title}</b>{t.body && <span>{t.body}</span>}{t.tx && <a href={txUrl(t.tx)} target="_blank" rel="noreferrer" className="mono">{short(t.tx, 8, 6)} on NearBlocks <Icon name="external" size={11} /></a>}</div>
      <button className="icon-btn toast-x" onClick={() => toast.dismiss(t.id)} aria-label="Dismiss"><Icon name="x" size={14} /></button>
    </div>)}
  </div>;
}

/** "Live · 4 s ago" for polled data. */
export function Freshness({ at, loading, now }: { at: number; loading?: boolean; now: number }) {
  if (!at) return null;
  const s = Math.max(0, Math.round((now - at) / 1000));
  return <span className="fresh"><i className="live-dot" />{loading ? 'Updating' : s < 2 ? 'Live' : `Updated ${s}s ago`}</span>;
}
