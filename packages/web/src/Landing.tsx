import { MarketCard } from './Board';
import { Countdown, Icon, Link, Obj, SplitBar, Sticker, Wordmark, useMarkets, useNow } from './ui';
import { CONTRACT, DEPLOYMENT, ORACLE, RUN, accountUrl, eventDate, isOpen, outcome, shares, short } from './lib';

const monthDay = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

export default function Landing() {
  const { markets, error } = useMarkets();
  const now = useNow();
  const open = (markets ?? []).filter((m) => isOpen(m, now)).sort((a, b) => shares(b) - shares(a));
  const settled = markets?.find((m) => m.result && m.phrase === 'inflation') ?? markets?.find((m) => m.result);
  const next = [...open].sort((a, b) => a.close_ns - b.close_ns)[0];
  const nextDate = next ? eventDate(next) : null;
  const tag = nextDate ? `${String(nextDate.getUTCDate()).padStart(2, '0')} ${nextDate.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase()} ${nextDate.getUTCFullYear()}` : null;
  const runs = RUN.steps.filter((s) => s.outlayer);
  const verified = runs.filter((s) => s.outlayer!.attestation.ok);
  const stat = (v: number | string | undefined) => (error && !markets ? '—' : v ?? '…');

  return <>
    <header className="l-nav">
      <Link to="/" aria-label="Kotoba home"><Wordmark /></Link>
      <nav aria-label="Primary">
        <Link to="/#how" className="l-link">How it settles</Link>
        <Link to="/app" className="pill-white">Open app</Link>
      </nav>
    </header>

    <main id="main">
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
          <Link to="/app" className="pill-coral pill-xl">Open the board</Link>
          <p className="l-sub">{next ? <>Live on NEAR testnet. Bets on the {monthDay(nextDate)} Fed press conference close in <Countdown target={next.close_ns / 1e6} now={now} compact />.</> : 'Word markets on NEAR testnet, settled by a sealed machine.'}</p>
        </div>
      </section>

      <section className="l-sec" id="how">
        <header className="l-head">
          <p className="lbl">How it settles</p>
          <h2>No referee. A sealed machine reads the transcript.</h2>
        </header>
        <ol className="beats">
          <li>
            <div className="beat-side"><span className="beat-n">01</span><Obj name="bubble" size={96} className="beat-obj" /></div>
            <div className="beat-copy"><h3>Pick a word, take a side.</h3><p>Each market asks one question: will this word appear in the official transcript? An LMSR market maker always quotes a price. A winning share pays 0.001 NEAR.</p></div>
            <div className="beat-live">{open[0] ? <SplitBar m={open[0]} label={<>“{open[0].phrase}” · {monthDay(eventDate(open[0]))}</>} /> : <span className="lbl">{error ? 'Contract unreadable' : 'Loading a live market…'}</span>}</div>
          </li>
          <li>
            <div className="beat-side"><span className="beat-n">02</span><Obj name="transcript" size={96} className="beat-obj" /></div>
            <div className="beat-copy"><h3>A TEE reads the transcript.</h3><p>After the event the contract calls OutLayer. Inside an Intel TDX enclave, a hash-pinned program downloads the federalreserve.gov PDF, extracts the text and counts whole-word hits. The count returns on-chain through a private callback.</p></div>
            <div className="beat-live">{settled?.result ? <p className="beat-fig"><b>{settled.result.count}</b><span>“{settled.phrase}” hits counted in the TEE · {monthDay(eventDate(settled))} transcript · settled {outcome(settled)}</span></p> : <span className="lbl">{error ? 'Contract unreadable' : 'Loading…'}</span>}</div>
          </li>
          <li>
            <div className="beat-side"><span className="beat-n">03</span><Obj name="magnifier" size={96} className="beat-obj" /></div>
            <div className="beat-copy"><h3>Anyone can check the seal.</h3><p>Each run publishes an Intel-signed quote that binds the program hash, the question and the answer. The resolution page re-checks it in your browser. Doubt a result? Bond 0.1 NEAR to re-run the same program.</p></div>
            <div className="beat-live"><p className="beat-fig"><b>{verified.length}/{runs.length}</b><span>recorded OutLayer runs pass every attestation check · requests {runs.map((r) => `#${r.outlayer!.attestation.request_id}`).join(', ')}</span></p></div>
          </li>
        </ol>
      </section>

      <section className="l-sec" id="live">
        <header className="l-head l-head-row">
          <div><p className="lbl">Live markets</p><h2>On the board now.</h2></div>
          <Link to="/app" className="l-more">Open the board <Icon name="arrow" size={16} /></Link>
        </header>
        <dl className="l-stats">
          <div><dt>Markets</dt><dd>{stat(markets?.length)}</dd></div>
          <div><dt>Open</dt><dd>{stat(markets ? open.length : undefined)}</dd></div>
          <div><dt>Settled</dt><dd>{stat(markets?.filter((m) => m.result).length)}</dd></div>
          <div><dt>Shares minted</dt><dd>{stat(markets?.reduce((n, m) => n + shares(m), 0))}</dd></div>
        </dl>
        {error && !markets ? <p className="l-err" role="alert">Could not read the contract: {error}</p>
          : <div className="l-cards">{(markets ? [...open.slice(0, 3), ...(settled ? [settled] : [])] : []).map((m) => <MarketCard key={m.id} m={m} now={now} />)}{!markets && [0, 1].map((i) => <div key={i} className="mcard skeleton" />)}</div>}
      </section>

      <section className="l-sec" id="tech">
        <header className="l-head"><p className="lbl">The NEAR tech</p><h2>What runs where, plainly.</h2></header>
        <div className="tech">
          <article><Obj name="cube" size={64} className="tech-obj" /><h3>OutLayer TEE execution</h3><p>The contract calls <code>request_execution</code> on <code>outlayer.testnet</code> with a WASM source pinned by SHA-256. OutLayer pauses with yield/resume, runs it in Intel TDX and resumes into our <code>#[private] on_result</code>, the only way a result gets in.</p></article>
          <article><Obj name="abacus" size={64} className="tech-obj" /><h3>Program pinned on FastFS</h3><p>The {(ORACLE.bytes / 1024).toFixed(0)} KB oracle is stored on NEAR through FastFS under its hash <code>{short(ORACLE.sha256, 8, 6)}</code>. The worker refuses bytes that don’t match; the attestation repeats the executed hash.</p></article>
          <article><Obj name="yes" size={64} className="tech-obj" /><h3>NEP-245 YES/NO shares</h3><p>Each market mints two multi-token classes, <code>&lt;id&gt;:YES</code> and <code>&lt;id&gt;:NO</code>, with <code>mt_transfer</code> and balance views. Winning shares burn when you claim.</p></article>
          <article><Obj name="seal" size={64} className="tech-obj" /><h3>Attestation you can re-check</h3><p>The TDX quote’s report data is SHA-256 over the program, input and output hashes, block and caller, and the enclave measurements must be approved on <code>worker.outlayer.testnet</code>.</p></article>
          <article><Obj name="stopwatch" size={64} className="tech-obj" /><h3>Time rules on-chain</h3><p>Bets stop five minutes before the press conference. Resolution is allowed only between close and the deadline; if nothing settles by then, every share redeems for half.</p></article>
          <article><Obj name="wallet" size={64} className="tech-obj" /><h3>Accounts</h3><p>Factory <a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer">{CONTRACT}</a>, deployed in <a href={DEPLOYMENT.deploy.explorer} target="_blank" rel="noreferrer">{short(DEPLOYMENT.deploy.hash, 6, 4)}</a>. Bets are signed with a NEAR testnet wallet.</p></article>
        </div>
      </section>
    </main>

    <footer className="l-foot">
      <div className="l-foot-row">
        <Wordmark />
        <p>Word markets on NEAR testnet, settled by an attested OutLayer program. MIT · © 2026 Nivesh Gajengi</p>
        <div className="l-foot-links"><a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer">Contract <Icon name="external" size={12} /></a><a href="https://outlayer.ai" target="_blank" rel="noreferrer">OutLayer <Icon name="external" size={12} /></a></div>
      </div>
      <p className="l-foot-mark" aria-hidden="true">言葉</p>
    </footer>
  </>;
}
