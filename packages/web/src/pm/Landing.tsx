import { useState } from 'react';
import { Link, Sticker, Wordmark } from '../ui';
import { type KEvent, type Snapshot, chance, volumeOf, near, label, fmtDate, speaker, yesAsk, noAsk } from './data';
import { OrderBook } from './OrderBook';
import { PriceChart } from './Chart';
import { seriesFor, Countdown, Fills } from './Event';
import { useResolved } from './Markets';
import { Footer } from './Shell';

const FAQ: [string, string][] = [
  ['What is a mention market?', 'A Yes/No market on whether a speaker says a word. “Will Warsh say ‘AI’ at the December press conference?” If you buy Yes at 88¢ and the word is said, each share pays 100¢.'],
  ['Who decides whether the word was said?', 'Nobody at Kotoba. After the event, a pinned program downloads the official Federal Reserve transcript inside a sealed Intel TDX enclave and counts whole-word matches. Anyone can check the seal or pay a bond to rerun it.'],
  ['Why an order book instead of a bonding curve?', 'Prices come from real bids and asks, so you can see depth, sell before the event, or rest a limit order. A Yes bid and a No bid that add up to 100¢ mint a new pair, just like Polymarket.'],
  ['Does it count only the speaker?', 'Not yet. The counter reads the whole transcript, reporters’ questions included. The rules page says so for every market.'],
  ['Is this real money?', 'No. Kotoba runs on NEAR testnet: one winning share pays 0.001 test NEAR. The books are seeded by Kotoba’s own demo market makers, and every order and fill is a real testnet transaction.'],
];

export function Landing({ events, snap }: { events: KEvent[]; snap: Snapshot | null }) {
  const event = events[0];
  const resolved = useResolved();
  const [open, setOpen] = useState(0);
  const ranked = event && snap ? [...event.markets].sort((a, b) => (chance(snap.books[b.id]) ?? 0) - (chance(snap.books[a.id]) ?? 0)) : [];
  const hero = ranked[0];
  const words = snap?.markets.length ?? 0;
  const close = event ? new Date(event.closeMs) : null;
  const tag = close ? `${String(close.getUTCDate()).padStart(2, '0')} ${close.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()} ${close.getUTCFullYear()}` : '';

  return (
    <div className="k-landing">
      <header className="l-nav">
        <Link to="/" aria-label="Kotoba home"><Wordmark /></Link>
        <nav aria-label="Primary">
          <a href="#how" className="l-link">How it works</a>
          <a href="#faq" className="l-link">FAQ</a>
          <Link to="/markets" className="pill-white">Open markets</Link>
        </nav>
      </header>

      <section className="l-hero">
        <div className="stickers" aria-hidden="true">
          <Sticker name="gavel" seed={3} className="st st-gavel" />
          <Sticker name="coin" seed={5} className="st st-coin" />
          <div className="st st-building"><Sticker name="building" seed={7} />{tag && <span className="date-tag">{tag}</span>}<span className="kanji-tag">言</span></div>
          <Sticker name="newspaper" seed={11} className="st st-news" />
          <Sticker name="mic" seed={13} className="st st-mic" />
          <div className="torn-band" />
          <Sticker name="podium" seed={17} className="st st-podium" />
        </div>
        <div className="l-hero-copy">
          <h1>Bet on what<br />they’ll say.</h1>
          <Link to={event ? `/event/${event.id}` : '/markets'} className="pill-coral pill-xl">Trade the December words</Link>
          <p className="l-sub">
            {event && hero && snap
              ? <>Will {speaker(event.title)} say “{label(hero)}” on {fmtDate(event.date, { month: 'short', day: 'numeric' })}? The book says <b>{chance(snap.books[hero.id])}%</b>. Trading closes in <b><Countdown ms={event.closeMs} /></b>.</>
              : 'Mention markets on NEAR. Reading the live books…'}
          </p>
        </div>
      </section>

      <section className="k-l-board" id="live">
        <div className="k-l-wrap">
          <div className="k-l-head">
            <h2>A real market for every word.</h2>
            <p>{words || '…'} words on two Fed press conferences, each with its own order book on NEAR.</p>
          </div>
          {event && snap ? (
            <div className="k-l-live">
              <div className="k-card k-l-event">
                <p className="k-crumb"><span className="k-live"><i />Live</span> {fmtDate(event.date)} · FOMC press conference</p>
                <h3>What will {speaker(event.title)} say?</h3>
                {ranked.slice(0, 6).map(m => (
                  <Link key={m.id} to={`/event/${event.id}?word=${m.id}`} className="k-l-row">
                    <span>{label(m)}</span>
                    <b>{chance(snap.books[m.id]) ?? '—'}%</b>
                    <em className="yes">Yes {yesAsk(snap.books[m.id]) ?? '—'}¢</em>
                    <em className="no">No {noAsk(snap.books[m.id]) ?? '—'}¢</em>
                  </Link>
                ))}
                <Link to={`/event/${event.id}`} className="k-btn k-btn-dark">See all {event.markets.length} words</Link>
              </div>
              <div className="k-card k-l-chart"><PriceChart series={seriesFor(ranked, snap).sort((a, b) => b.points.length - a.points.length).slice(0, 4)} height={300} /></div>
            </div>
          ) : <div className="k-card k-skel tall" />}
          <dl className="k-l-stats">
            <div><dt>Word markets</dt><dd>{words || '…'}</dd></div>
            <div><dt>Fills on chain</dt><dd>{snap ? snap.trades.length : '…'}</dd></div>
            <div><dt>Volume</dt><dd>{snap ? near(volumeOf(snap.trades), 3) : '…'}</dd></div>
            <div><dt>Markets settled by the seal</dt><dd>{resolved.list ? resolved.list.length : '…'}</dd></div>
          </dl>
        </div>
      </section>

      <section className="k-l-how" id="how">
        <div className="k-l-wrap">
          <div className="k-l-feature">
            <div className="k-l-copy">
              <img src="/art/3d/kotoba-3d-bubble.webp" alt="" className="k-l-obj" />
              <h3>Pick the words you know.</h3>
              <p>Every word is its own market. The price is the crowd’s chance: 63¢ means 63%. Buy Yes if you think it gets said, No if you think it won’t.</p>
            </div>
            <div className="k-card k-l-demo">
              {snap && ranked.slice(0, 4).map(m => (
                <div key={m.id} className="k-l-row static"><span>{label(m)}</span><b>{chance(snap.books[m.id])}%</b><em className="yes">Yes {yesAsk(snap.books[m.id])}¢</em><em className="no">No {noAsk(snap.books[m.id])}¢</em></div>
              ))}
            </div>
          </div>
          <div className="k-l-feature flip">
            <div className="k-l-copy">
              <img src="/art/3d/kotoba-3d-abacus.webp" alt="" className="k-l-obj" />
              <h3>Trade on a real order book.</h3>
              <p>Bids and asks live on chain and match by price, then time. Rest a limit order, sell before the speech, or cancel any time. No house sets the odds.</p>
            </div>
            <div className="k-card k-l-demo">{snap && hero && <OrderBook book={snap.books[hero.id]} yes onSide={() => {}} onPick={() => {}} rows={4} />}</div>
          </div>
          <div className="k-l-feature">
            <div className="k-l-copy">
              <img src="/art/3d/kotoba-3d-transcript.webp" alt="" className="k-l-obj" />
              <h3>The transcript settles it.</h3>
              <p>After the conference, a sealed program reads the official Fed transcript and counts. In January it found “inflation” 40 times; that market paid Yes.</p>
            </div>
            <div className="k-card k-l-demo k-l-fills">
              <h4>Latest fills</h4>
              {snap && <Fills trades={snap.trades.slice(-5).reverse()} markets={snap.markets} />}
            </div>
          </div>
        </div>
      </section>

      <section className="k-l-trust">
        <div className="k-l-wrap">
          <img src="/art/3d/kotoba-3d-seal.webp" alt="" className="k-l-seal" />
          <h2>Nobody at Kotoba decides who said what.</h2>
          <div className="k-l-trust-grid">
            <div><b>Pinned program</b><p>The counter’s hash is fixed in the contract. A different program can’t settle a market.</p></div>
            <div><b>Sealed run</b><p>It runs inside an Intel TDX enclave on OutLayer. The quote binds the program, the transcript hash and the count.</p></div>
            <div><b>Checked in your browser</b><p>Each market’s rules page re-verifies the seal live. Anyone can bond 0.1 NEAR to rerun the count.</p></div>
          </div>
          <Link to={event ? `/event/${event.id}/rules` : '/markets'} className="pill-white">See the seal on a settled market</Link>
        </div>
      </section>

      <section className="k-l-faq" id="faq">
        <div className="k-l-wrap narrow">
          <h2>Questions</h2>
          {FAQ.map(([q, a], i) => (
            <div key={q} className={'k-faq' + (open === i ? ' open' : '')}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>{q}<span>{open === i ? '−' : '+'}</span></button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </div>
  );
}
