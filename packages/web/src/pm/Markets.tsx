import { useEffect, useState } from 'react';
import { Link, navigate } from '../ui';
import { type KEvent, type Snapshot, chance, yesAsk, noAsk, volumeOf, label, near, fmtDate, speaker, view, PREVIOUS_CONTRACT } from './data';
import { PriceChart } from './Chart';
import { seriesFor, Countdown } from './Event';

type Old = { id: string; phrase: string; threshold: number; status: string; event: string; source_url: string; result: { count: number } | null };

/** Settled markets from the previous contract, read live. */
export function useResolved() {
  const [list, setList] = useState<Old[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { view<Old[]>('list_markets', {}, PREVIOUS_CONTRACT).then(ms => setList(ms.filter(m => m.status === 'Final' && m.result))).catch(() => setError('Could not read settled markets.')); }, []);
  return { list, error };
}

const icon = (i: number) => ['/art/kotoba-st-podium.webp', '/art/kotoba-st-mic.webp', '/art/kotoba-st-building.webp'][i % 3];

export function Markets({ events, snap, filter }: { events: KEvent[]; snap: Snapshot; filter: string }) {
  const resolved = useResolved();
  const featured = events[0];
  const showLive = filter !== 'resolved';
  return (
    <main className="k-markets">
      {showLive && featured && <Featured event={featured} snap={snap} />}
      {showLive && (
        <section>
          <div className="k-section-head"><h2>Live mention markets</h2><span>{events.reduce((n, e) => n + e.markets.length, 0)} words across {events.length} events</span></div>
          <div className="k-grid">
            {events.map((e, i) => <EventCard key={e.id} event={e} snap={snap} art={icon(i)} />)}
            <div className="k-card k-soon-card">
              <h3>Next on the mic</h3>
              <p>Earnings calls, debates and White House briefings need a transcript source the counter can trust. They open when one does.</p>
              <span>Earnings calls · Debates · Briefings</span>
            </div>
          </div>
        </section>
      )}
      <section>
        <div className="k-section-head"><h2>Resolved</h2><span>Settled by the sealed counter on the previous contract</span></div>
        {resolved.error ? <p className="k-empty">{resolved.error}</p> : !resolved.list ? <div className="k-grid">{[0, 1].map(i => <div key={i} className="k-card k-skel" />)}</div> : (
          <div className="k-grid">
            {groupOld(resolved.list).map(([title, ms], i) => (
              <article key={title} className="k-card k-ecard resolved">
                <div className="k-ecard-top"><img src={icon(i + 2)} alt="" /><div><h3>{title}</h3><small>Resolved · official transcript</small></div></div>
                {ms.map(m => {
                  const yes = m.result!.count >= m.threshold;
                  return (
                    <Link key={m.id} to={`/market/${m.id}`} className="k-erow">
                      <span>{label(m)}</span>
                      <em>said {m.result!.count}×</em>
                      <b className={'k-resolved ' + (yes ? 'yes' : 'no')}>{yes ? 'Yes' : 'No'}</b>
                    </Link>
                  );
                })}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function groupOld(ms: Old[]): [string, Old[]][] {
  const by = new Map<string, Old[]>();
  for (const m of ms) {
    const d = m.source_url.match(/(\d{4})(\d{2})(\d{2})\.pdf$/);
    const date = d ? fmtDate(new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]))) : '';
    const who = d && +d[1] === 2026 && +d[2] < 5 ? 'Powell' : 'Warsh';
    const key = `What did ${who} say? ${date}${/replay/.test(m.event) ? ' (replay)' : ''}`;
    by.set(key, [...(by.get(key) ?? []), m]);
  }
  return [...by];
}

function Featured({ event, snap }: { event: KEvent; snap: Snapshot }) {
  const ranked = [...event.markets].sort((a, b) => (chance(snap.books[b.id]) ?? 0) - (chance(snap.books[a.id]) ?? 0));
  const trades = snap.trades.filter(t => event.markets.some(m => m.id === t.market_id));
  return (
    <section className="k-featured">
      <div className="k-featured-copy">
        <p className="k-crumb"><span className="k-live"><i />Live</span> Fed chair · {fmtDate(event.date)}</p>
        <Link to={`/event/${event.id}`}><h1>What will {speaker(event.title)} say?</h1></Link>
        <p className="k-muted">{event.markets.length} words · {near(volumeOf(trades), 3)} volume · closes in <Countdown ms={event.closeMs} /></p>
        <div className="k-featured-rows">
          {ranked.slice(0, 4).map(m => (
            <div key={m.id} className="k-frow">
              <Link to={`/event/${event.id}?word=${m.id}`}>{label(m)}</Link>
              <b>{chance(snap.books[m.id]) ?? '—'}%</b>
              <button className="yes" onClick={() => navigate(`/event/${event.id}?word=${m.id}`)}>Yes {yesAsk(snap.books[m.id]) ?? '—'}¢</button>
              <button className="no" onClick={() => navigate(`/event/${event.id}?word=${m.id}`)}>No {noAsk(snap.books[m.id]) ?? '—'}¢</button>
            </div>
          ))}
        </div>
        <Link to={`/event/${event.id}`} className="k-btn k-btn-dark">Trade all {event.markets.length} words</Link>
      </div>
      <div className="k-featured-chart"><PriceChart series={seriesFor(ranked, snap).sort((a, b) => b.points.length - a.points.length).slice(0, 4)} height={330} /></div>
    </section>
  );
}

function EventCard({ event, snap, art }: { event: KEvent; snap: Snapshot; art: string }) {
  const ranked = [...event.markets].sort((a, b) => (chance(snap.books[b.id]) ?? 0) - (chance(snap.books[a.id]) ?? 0));
  const trades = snap.trades.filter(t => event.markets.some(m => m.id === t.market_id));
  return (
    <article className="k-card k-ecard">
      <Link to={`/event/${event.id}`} className="k-ecard-top">
        <img src={art} alt="" />
        <div><h3>What will {speaker(event.title)} say?</h3><small>{fmtDate(event.date, { month: 'long', day: 'numeric', year: 'numeric' })} · FOMC press conference</small></div>
      </Link>
      {ranked.slice(0, 3).map(m => (
        <div key={m.id} className="k-erow">
          <Link to={`/event/${event.id}?word=${m.id}`}>{label(m)}</Link>
          <b>{chance(snap.books[m.id]) ?? '—'}%</b>
          <span className="k-yn">
            <button className="yes" onClick={() => navigate(`/event/${event.id}?word=${m.id}`)}>Yes</button>
            <button className="no" onClick={() => navigate(`/event/${event.id}?word=${m.id}`)}>No</button>
          </span>
        </div>
      ))}
      <footer><span>{near(volumeOf(trades), 3)} vol</span><span>{event.markets.length} words</span><span>Closes {fmtDate(new Date(event.closeMs), { month: 'short', day: 'numeric' })}</span></footer>
    </article>
  );
}
