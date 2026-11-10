import { useMemo, useState } from 'react';
import Head from './Head';
import { BetSheet, EventSheet } from './Trade';
import { Countdown, EventPhoto, Icon, Link, Problem, SplitBar, State, useMarkets, useNow } from './ui';
import type { LiveMarket } from './store';
import { eventSrc } from './art';
import { eventDate, fmtDate, fmtTimeUTC, groupEvents, isOpen, outcome, pct, shares, yesPrice, type KEvent, type Market } from './lib';
import type { Wallet } from './wallet';

const DAY = 86_400_000;
const dayOf = (m: Market) => { const d = eventDate(m) ?? new Date(m.close_ns / 1e6); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const weekStart = (ms: number) => { const d = new Date(ms); const dow = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dow * DAY; };
const longDay = (ms: number) => new Date(ms).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
const hottest = (ms: Market[]) => [...ms].sort((a, b) => shares(b) - shares(a))[0];

type Pick = { m: Market; yes: boolean } | null;

/* ---------------- phone ---------------- */

function EventCard({ ev, index, prev, now, onCall }: { ev: KEvent; index: number; prev: KEvent | undefined; now: number; onCall: () => void }) {
  const art = eventSrc(index);
  const lead = hottest(ev.markets);
  const traded = ev.markets.reduce((n, m) => n + shares(m), 0);
  return <article className={`ev-card ${ev.open ? '' : 'ev-closed'}`}>
    <div className="ev-notch">{ev.open ? <span className="chip-time"><Icon name="clock" size={14} /><Countdown target={ev.closeMs} now={now} compact /></span> : <span className="chip-time">Settled</span>}</div>
    <span className="chip-src"><i className="dot-fed" />FOMC</span>
    <h3>{ev.title}</h3>
    <p className="ev-when">{ev.date ? longDay(ev.date.getTime()) : ''}{ev.open ? ` · bets close ${fmtTimeUTC(ev.closeMs)} UTC` : ` · ${ev.date?.getUTCFullYear() ?? ''}`}</p>
    <EventPhoto src={art.src} generated={art.generated} className="ev-art" />
    <div className="ev-body">
      <p className="ev-stats"><b>{traded}</b> shares · <b>{ev.markets.length}</b> markets</p>
      {ev.open || !lead.result ? <SplitBar m={lead} label={<>“{lead.phrase}”</>} />
        : <p className="ev-result">“{lead.phrase}” said <b>{lead.result.count}×</b> · settled <span className={`stamp stamp-${outcome(lead)!.toLowerCase()}`}>{outcome(lead)}</span></p>}
      <div className="ev-foot">
        {prev && <div className="ev-past" aria-label={`Last meeting: ${prev.markets.map((m) => `${m.phrase} ${outcome(m) ?? 'pending'}`).join(', ')}`}>
          <span>Last</span>{prev.markets.map((m) => <i key={m.id} className={`past past-${(outcome(m) ?? 'none').toLowerCase()}`} title={`${m.phrase}: ${outcome(m) ?? 'pending'}`}>{outcome(m) === 'YES' ? '▲' : outcome(m) === 'NO' ? '▼' : ''}</i>)}
        </div>}
        {ev.open ? <button className="pill-ink" onClick={onCall}>Your call <Icon name="arrow" size={15} /></button>
          : <Link to={`/market/${lead.id}`} className="pill-ink">See the proof <Icon name="arrow" size={15} /></Link>}
      </div>
    </div>
  </article>;
}

function Week({ markets, start, setStart, day, setDay, now }: { markets: Market[]; start: number; setStart: (n: number) => void; day: number | null; setDay: (d: number) => void; now: number }) {
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const isThisWeek = start === weekStart(now);
  const days = Array.from({ length: 7 }, (_, i) => start + i * DAY);
  return <section className="week" aria-label="Schedule">
    <header className="week-head">
      <h2>{isThisWeek ? 'This week' : `Week of ${new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`}</h2>
      <div className="week-nav">
        <button className="text-btn" onClick={() => { setStart(weekStart(now)); setDay(today); }}>Today</button>
        <button className="icon-round" onClick={() => setStart(start - 7 * DAY)} aria-label="Previous week"><Icon name="chevL" size={16} /></button>
        <button className="icon-round" onClick={() => setStart(start + 7 * DAY)} aria-label="Next week"><Icon name="chevR" size={16} /></button>
      </div>
    </header>
    <div className="days">
      {days.map((d) => {
        const n = markets.filter((m) => dayOf(m) === d).length;
        const dt = new Date(d);
        return <button key={d} className={`day ${day === d ? 'on' : ''} ${d < today ? 'past' : ''}`} onClick={() => setDay(d)} aria-pressed={day === d} aria-label={`${longDay(d)}: ${n} markets`}>
          <span className="day-name">{dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}</span>
          <b>{dt.getUTCDate()}</b>
          <span className={`day-n ${n ? 'has' : ''}`}>{n || '–'}</span>
        </button>;
      })}
    </div>
  </section>;
}

function Row({ m, now, onPick }: { m: Market; now: number; onPick: (p: Pick) => void }) {
  const open = isOpen(m, now);
  const p = yesPrice(m);
  const res = outcome(m);
  return <li className="row">
    <span className="row-time">{fmtTimeUTC(m.close_ns / 1e6)}</span>
    <Link to={`/market/${m.id}`} className="row-main">
      <b>“{m.phrase}”{m.threshold > 1 && <small> ≥ {m.threshold}×</small>}</b>
      <span>{open ? <><em className={p >= 0.5 ? 'pos' : 'neg'}>{p >= 0.5 ? 'YES' : 'NO'} {pct(p >= 0.5 ? p : 1 - p)}</em> · {shares(m)} shares{(m as LiveMarket).pendingQty ? ' · yours pending' : ''}</> : m.pending ? 'settling in the TEE' : m.result ? <>said {m.result.count}× · {m.status === 'Final' ? 'final' : 'provisional'}</> : 'closed · awaiting transcript'}</span>
    </Link>
    {open ? <button className="pill-coral" onClick={() => onPick({ m, yes: p < 0.5 ? false : true })}><i className="rec" />Your call</button>
      : res ? <Link to={`/market/${m.id}`} className={`pill-res res-${res.toLowerCase()}`}>{res}</Link> : <span className="pill-res">Closed</span>}
  </li>;
}

function Phone({ markets, now, onPick }: { markets: Market[]; now: number; onPick: (p: Pick) => void }) {
  const events = useMemo(() => groupEvents(markets, now), [markets, now]);
  const next = events.find((e) => e.open);
  const anchor = next?.date ? next.date.getTime() : now;
  const [start, setStart] = useState(() => weekStart(anchor));
  const [day, setDay] = useState<number | null>(() => (next?.date ? next.date.getTime() : null));
  const [filter, setFilter] = useState<'all' | 'open' | 'settled'>('all');
  const [sheet, setSheet] = useState<KEvent | null>(null);
  const list = markets.filter((m) => (filter === 'open' ? isOpen(m, now) : filter === 'settled' ? !isOpen(m, now) : true) && (day === null || dayOf(m) === day))
    .sort((a, b) => Number(isOpen(b, now)) - Number(isOpen(a, now)) || a.close_ns - b.close_ns || shares(b) - shares(a));
  const settled = events.filter((e) => !e.open);
  return <>
    <section className="carousel" aria-label="Events">
      {events.map((ev, i) => <EventCard key={ev.key} ev={ev} index={i} prev={ev.open ? settled[0] : settled[settled.indexOf(ev) + 1]} now={now} onCall={() => setSheet(ev)} />)}
    </section>
    <Week markets={markets} start={start} setStart={setStart} day={day} setDay={(d) => { setDay(d); setFilter('all'); }} now={now} />
    <div className="list-head">
      <p><b>{day === null ? 'All days' : longDay(day)}</b> <span>{list.length} {list.length === 1 ? 'market' : 'markets'}</span></p>
      <span className="lbl">All times UTC</span>
    </div>
    <div className="chips" role="tablist" aria-label="Filter markets">
      {(['all', 'open', 'settled'] as const).map((f) => <button key={f} role="tab" aria-selected={filter === f && (f !== 'all' || day === null)} className={`chip ${filter === f && (f !== 'all' || day === null) ? 'on' : ''}`} onClick={() => { setFilter(f); setDay(null); }}>{f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Settled'}</button>)}
      <span className="chip chip-static"><i className="dot-fed" />Central banks</span>
    </div>
    {list.length ? <ul className="rows">{list.map((m) => <Row key={m.id} m={m} now={now} onPick={onPick} />)}</ul>
      : <State kind="empty" title={day !== null ? `Nothing scheduled on ${longDay(day)}` : 'No markets here'} action={next?.date ? <button className="pill-light" onClick={() => { setStart(weekStart(next.date!.getTime())); setDay(next.date!.getTime()); }}>Jump to {longDay(next.date.getTime())}</button> : undefined}>Markets open when the scheduler reads the official FOMC calendar.</State>}
    {sheet && <EventSheet ev={sheet} onClose={() => setSheet(null)} onPick={(m, yes) => { setSheet(null); onPick({ m, yes }); }} />}
  </>;
}

/* ---------------- web ---------------- */

export function MarketCard({ m, now, onPick }: { m: Market; now: number; onPick?: (p: Pick) => void }) {
  const open = isOpen(m, now);
  const p = yesPrice(m);
  const res = outcome(m);
  const date = eventDate(m);
  return <article className="mcard">
    <header className="mcard-top">
      <span className="avs" aria-hidden="true"><i className="av av-fed"><Icon name="mic" size={13} /></i><i className="av av-mark">言</i><i className="av av-seal"><Icon name="seal" size={13} /></i></span>
      <div className="mcard-src">
        <p><b>Fed · {date ? fmtDate(date).replace(/, \d{4}$/, '') : ''}</b> <span>{open ? <>closes in <Countdown target={m.close_ns / 1e6} now={now} compact /></> : res ? 'settled' : 'closed'}</span></p>
        <small>{shares(m)} shares traded · liquidity b {m.b}{(m as LiveMarket).pendingQty ? <b className="pend"> · your {(m as LiveMarket).pendingQty} pending</b> : null}{m.pending ? ' · settling in the TEE' : ''}</small>
      </div>
      {open ? <span className={`lean ${p >= 0.5 ? 'lean-yes' : 'lean-no'}`}><Icon name={p >= 0.5 ? 'arrowUp' : 'arrowDown'} size={13} />{p >= 0.5 ? 'YES' : 'NO'} {pct(p >= 0.5 ? p : 1 - p)}</span>
        : res ? <span className={`lean ${res === 'YES' ? 'lean-yes' : 'lean-no'}`}><Icon name="check" size={13} />{res}</span> : <span className="lean">Closed</span>}
    </header>
    <h3><Link to={`/market/${m.id}`}>Will the Fed chair say “{m.phrase}”{m.threshold > 1 ? ` ${m.threshold}+ times` : ''}?</Link></h3>
    <p className="mcard-sum">{m.result
      ? <>Said <b>{m.result.count}</b> {m.result.count === 1 ? 'time' : 'times'} in the official {date ? fmtDate(date) : ''} transcript, needing {m.threshold}. Counted inside an OutLayer TEE; {m.status === 'Final' ? 'final and paid out.' : 'challenge window open.'}</>
      : <>Resolves YES if “{m.phrase}” appears {m.threshold > 1 ? `at least ${m.threshold} times` : 'at least once'} in the official {date ? fmtDate(date) : ''} press conference transcript, counted by a sealed program.</>}</p>
    <span className="tok"><i className="tok-dot" />{m.id}:{open ? (p >= 0.5 ? 'YES' : 'NO') : (res ?? 'YES')}</span>
    {open && onPick ? <div className="yn">
      <button className="yn-yes" onClick={() => onPick({ m, yes: true })}><Icon name="arrowUp" size={15} />Yes {pct(p)}</button>
      <button className="yn-no" onClick={() => onPick({ m, yes: false })}><Icon name="arrowDown" size={15} />No {pct(1 - p)}</button>
    </div> : <Link to={`/market/${m.id}`} className="yn-proof">{m.result ? 'See the transcript and seal' : 'Market details'} <Icon name="arrow" size={15} /></Link>}
  </article>;
}

function Web({ markets, now, onPick }: { markets: Market[]; now: number; onPick: (p: Pick) => void }) {
  const [tab, setTab] = useState<'open' | 'settled' | 'all'>('open');
  const list = markets.filter((m) => (tab === 'open' ? isOpen(m, now) : tab === 'settled' ? !isOpen(m, now) : true))
    .sort((a, b) => Number(isOpen(b, now)) - Number(isOpen(a, now)) || shares(b) - shares(a));
  const next = markets.filter((m) => isOpen(m, now)).sort((a, b) => a.close_ns - b.close_ns)[0];
  return <>
    <div className="web-tabs" role="tablist" aria-label="Markets">
      {(['open', 'settled', 'all'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'open' ? 'Open' : t === 'settled' ? 'Settled' : 'All'} <small>{markets.filter((m) => (t === 'open' ? isOpen(m, now) : t === 'settled' ? !isOpen(m, now) : true)).length}</small></button>)}
      {next && <span className="web-next"><i className="live-dot" />Next close · Fed {fmtDate(eventDate(next) ?? new Date(next.close_ns / 1e6))} · <Countdown target={next.close_ns / 1e6} now={now} compact /></span>}
    </div>
    {list.length ? <div className="web-grid">{list.map((m) => <MarketCard key={m.id} m={m} now={now} onPick={onPick} />)}</div>
      : <State kind="empty" title={tab === 'open' ? 'No market is taking bets' : 'Nothing here yet'}>The scheduler opens the standard word markets for each FOMC date on the Fed calendar.</State>}
  </>;
}

export default function Board({ wallet, desktop }: { wallet: Wallet; desktop: boolean }) {
  const { markets, problem, loading, reload, at } = useMarkets();
  const now = useNow();
  const [pick, setPick] = useState<Pick>(null);
  return <div className={desktop ? 'web-page' : 'ph-page'}>
    <Head wallet={wallet} desktop={desktop} onRefresh={reload} refreshing={loading} at={at} now={now} />
    {problem && !markets ? <Problem x={problem} onRetry={reload} />
      : !markets ? <div className={desktop ? 'web-grid' : 'carousel'}>{[0, 1, 2, 3].map((i) => <div key={i} className={desktop ? 'mcard skeleton' : 'ev-card skeleton'} />)}</div>
      : desktop ? <Web markets={markets} now={now} onPick={setPick} /> : <Phone markets={markets} now={now} onPick={setPick} />}
    {problem && markets && <p className="stale" role="status">Showing the last read from {new Date(at).toLocaleTimeString()}. {problem.title}: {problem.next} <button className="text-btn" onClick={reload}>Retry</button></p>}
    {pick && <BetSheet m={pick.m} side={pick.yes} wallet={wallet} onClose={() => setPick(null)} />}
  </div>;
}
