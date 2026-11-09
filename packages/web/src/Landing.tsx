import { useEffect, useState } from 'react';
import { Art, Countdown, Icon, Link, OddsBar, useMarkets, useNow } from './ui';
import { CONTRACT, DEPLOYMENT, ORACLE, RUN, accountUrl, eventDate, fmtDate, outcome, short, viewAccount, yoctoToNear, type Market } from './lib';

function LiveStrip({ markets, error }: { markets: Market[] | null; error: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => { viewAccount(CONTRACT).then((a) => setBalance(yoctoToNear(a.amount) - a.storage_usage / 1e5)).catch(() => setBalance(null)); }, []);
  const verified = RUN.steps.filter((s) => s.outlayer?.attestation.ok).length;
  const open = markets?.filter((m) => m.status === 'Open').length;
  const settled = markets?.filter((m) => m.status !== 'Open').length;
  const shares = markets?.reduce((n, m) => n + m.yes + m.no, 0);
  const cell = (label: string, value: string | number | undefined, unit?: string) => <div className="strip-cell"><span>{label}</span><b>{error ? '—' : value ?? '…'}{unit && value !== undefined && <small>{unit}</small>}</b></div>;
  return <section className="strip" aria-label="Live contract figures">
    <div className="strip-head"><i className="live-dot" /> LIVE · NEAR TESTNET · <a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer">{CONTRACT}</a></div>
    <div className="strip-grid">
      {cell('Markets', markets?.length)}
      {cell('Open', open)}
      {cell('Settled', settled)}
      {cell('Shares minted', shares)}
      {cell('Free balance', balance === null ? undefined : balance.toFixed(3), 'NEAR')}
      {cell('TEE runs verified', `${verified}/${RUN.steps.filter((s) => s.outlayer).length}`)}
    </div>
    {error && <p className="strip-error">Could not read the contract: {error}</p>}
  </section>;
}

export default function Landing() {
  const { markets, error } = useMarkets();
  const now = useNow();
  const settled = markets?.find((m) => m.status !== 'Open' && m.result && m.phrase === 'inflation') ?? markets?.find((m) => m.status !== 'Open');
  const upcoming = markets?.filter((m) => m.status === 'Open' && m.close_ns / 1e6 > now).sort((a, b) => a.close_ns - b.close_ns) ?? [];
  const next = upcoming[0];
  const ledger = RUN.steps.slice().reverse().slice(0, 9);

  return <>
    <section className="hero">
      <Art src="/art/kotoba-hero.webp" alt="A brass podium microphone on a dark stage; red and white sound ribbons stream from it" className="hero-art" eager />
      <div className="hero-inner">
        <p className="kicker"><span className="kanji">言葉</span> Word markets · settled by a sealed machine</p>
        <h1>Bet on what<br />they’ll <em>say.</em></h1>
        <p className="lead">Will the Fed chair say “recession” on December 9? Buy YES or NO on any word in an official transcript. When the transcript is published, a program inside an Intel TDX enclave reads it, counts the word and settles the market. Nobody referees.</p>
        <div className="hero-cta">
          <Link to="/app" className="btn btn-red">Open the board <Icon name="arrow" /></Link>
          {settled && <Link to={`/market/${settled.id}`} className="btn btn-ghost">See a settled market</Link>}
        </div>
        {next && <div className="hero-next">
          <span className="label">Next event · {fmtDate(eventDate(next) ?? new Date(next.close_ns / 1e6))} · FOMC press conference</span>
          <Countdown target={next.close_ns / 1e6} now={now} />
        </div>}
      </div>
    </section>

    <LiveStrip markets={markets} error={error} />

    <section className="how" id="how">
      <header className="section-head"><p className="label">How it works</p><h2>Three steps. <span className="dim">No referee.</span></h2></header>
      <ol className="beats">
        <li className="beat">
          <span className="beat-n">01</span>
          <div className="beat-body"><h3>Pick a word, take a side</h3><p>Each market asks one question: will this word appear at least N times in the official transcript? Prices come from an LMSR market maker seeded by the creator, so there is always a price. Each share pays 0.001 NEAR if it is right.</p>
            {next ? <div className="beat-demo"><p className="beat-q">“{next.phrase}” ≥ {next.threshold}×</p><OddsBar m={next} /></div> : <div className="beat-demo muted">Loading a live market…</div>}
          </div>
        </li>
        <li className="beat beat-art">
          <span className="beat-n">02</span>
          <div className="beat-body"><h3>A sealed room reads the transcript</h3><p>After the event the contract calls OutLayer. Inside an Intel TDX enclave, our pinned WASM downloads the official federalreserve.gov PDF, hashes it, extracts the text and counts whole-word matches. The result comes back to the contract on-chain.</p></div>
          <Art src="/art/kotoba-feature-transcript.webp" alt="A paper transcript scroll with one red highlighted line lifting off it" eager />
        </li>
        <li className="beat beat-art beat-flip">
          <span className="beat-n">03</span>
          <div className="beat-body"><h3>Anyone can check the seal</h3><p>Every run carries an Intel-signed quote that binds the program hash, the question and the answer. Anyone can verify it. If you doubt a result, bond 0.1 NEAR to rerun the same sealed program. If the answer changes, you win the bond.</p></div>
          <Art src="/art/kotoba-feature-seal.webp" alt="A brass press inside a glass case stamping a red wax seal onto paper" eager />
        </li>
      </ol>
    </section>

    <section className="proof" id="proof">
      <header className="section-head light"><p className="label">Live proof</p><h2>The record, on NEAR testnet.</h2></header>
      <div className="proof-grid">
        <article className="paper">
          {settled?.result ? <>
            <p className="paper-label">Settled · {settled.event}</p>
            <h3 className="paper-title">“{settled.phrase}” was said <b>{settled.result.count}</b> times.</h3>
            <p className="paper-sub">The market asked for {settled.threshold} or more, so it settled <span className={`stamp stamp-${outcome(settled)?.toLowerCase()}`}>{outcome(settled)}</span></p>
            <dl className="paper-dl">
              <div><dt>Transcript SHA-256</dt><dd className="mono">{short(settled.result.transcript_sha256, 16, 8)}</dd></div>
              <div><dt>Program SHA-256</dt><dd className="mono">{short(settled.result.code_hash, 16, 8)}</dd></div>
              <div><dt>Status</dt><dd>{settled.status === 'Final' ? 'Final · challenged and re-run' : 'Provisional · challenge window open'}</dd></div>
            </dl>
            <Link to={`/market/${settled.id}`} className="btn btn-ink">Read the transcript with every hit marked <Icon name="arrow" /></Link>
          </> : <p className="paper-sub">{error ? `Could not read markets: ${error}` : 'Loading the settled market from the contract…'}</p>}
        </article>
        <div className="ledger" aria-label="Recorded transactions">
          <div className="ledger-head"><span>Recorded run · Nov 9 2026</span><a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer">All on NearBlocks <Icon name="external" size={13} /></a></div>
          <ul>
            {ledger.map((s) => <li key={s.tx} className={s.ok ? '' : 'rejected'}>
              <span className="ledger-step">{s.step.replace(' through OutLayer', '')}</span>
              <span className="ledger-meta">{s.ok ? (s.outlayer ? `TEE request #${s.outlayer.attestation.request_id}` : 'ok') : `rejected · ${(s.failure?.match(/ERR_[A-Z_]+|private/)?.[0] ?? 'failed')}`}</span>
              <a href={s.explorer} target="_blank" rel="noreferrer" className="mono">{short(s.tx, 6, 4)} <Icon name="external" size={12} /></a>
            </li>)}
          </ul>
        </div>
      </div>
    </section>

    <section className="tech" id="tech">
      <header className="section-head"><p className="label">What runs on NEAR</p><h2>The plumbing, plainly.</h2></header>
      <div className="tech-grid">
        <article><Icon name="seal" size={22} /><h3>OutLayer TEE execution</h3><p>The contract calls <code>request_execution</code> on <code>outlayer.testnet</code> with a <code>WasmUrl</code> source pinned by SHA-256. OutLayer pauses with NEAR yield/resume, runs the WASM in Intel TDX and resumes with the output. Our <code>#[private] on_result</code> callback is the only way in.</p></article>
        <article><Icon name="doc" size={22} /><h3>Program pinned on FastFS</h3><p>The oracle WASM ({(ORACLE.bytes / 1024).toFixed(0)} KB) is stored on NEAR through FastFS at a URL named by its hash, <code>{short(ORACLE.sha256, 10, 6)}</code>. The worker refuses bytes that do not match, and the attestation repeats the executed hash.</p></article>
        <article><Icon name="scale" size={22} /><h3>NEP-245 YES/NO shares</h3><p>Every market mints two multi-token classes, <code>&lt;id&gt;:YES</code> and <code>&lt;id&gt;:NO</code>, with <code>mt_transfer</code>, <code>mt_transfer_call</code> and balance views. Winning shares are burned when you claim.</p></article>
        <article><Icon name="chain" size={22} /><h3>Attestation you can verify</h3><p>OutLayer publishes each run’s TDX quote. The quote’s report data is SHA-256 of the program hash, input hash, output hash, block and caller. The enclave measurements must be approved on <code>worker.outlayer.testnet</code>. The resolution page re-checks this in your browser.</p></article>
        <article><Icon name="clock" size={22} /><h3>Time rules on-chain</h3><p>Bets stop at the market’s close, five minutes before the press conference. Resolution is only allowed between close and the deadline. If nothing settles by the deadline, every share redeems for half a unit.</p></article>
        <article><Icon name="user" size={22} /><h3>Accounts</h3><p>The factory is <a href={accountUrl(CONTRACT)} target="_blank" rel="noreferrer">{CONTRACT}</a>, deployed in tx <a href={DEPLOYMENT.deploy.explorer} target="_blank" rel="noreferrer">{short(DEPLOYMENT.deploy.hash, 6, 4)}</a>. The demo player is a named sub-account, <code>player.{CONTRACT}</code>. Bets in this app are signed with a NEAR testnet wallet.</p></article>
      </div>
    </section>
  </>;
}
