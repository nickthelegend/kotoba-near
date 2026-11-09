import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Countdown, Icon, Link, SplitBar, State, useNow } from './ui';
import { DEPLOYMENT, PINNED_PDF_SHA, PINNED_TEXT_SHA, eventDate, fmtDate, getMarket, outcome, runsFor, sha256Hex, short, splitHits, txUrl, pct, yesPrice, type Market, type Step } from './lib';
import { verifyLive, type LiveVerification } from './verify';
import { BetSheet } from './Trade';
import type { Wallet } from './wallet';

function RunCard({ run, label }: { run: Step; label: string }) {
  const o = run.outlayer!;
  const [live, setLive] = useState<LiveVerification | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { verifyLive(run.tx, o.input, o.output, DEPLOYMENT.oracle_sha256).then(setLive).catch((e) => setErr(String(e.message || e))); }, [run.tx, o.input, o.output]);
  const res = JSON.parse(o.output) as { count: number };
  const allOk = live?.checks.every((c) => c.ok);
  return <article className="run">
    <header className="run-head">
      <div><p className="label">{label}</p><h3>OutLayer request #{o.attestation.request_id}</h3></div>
      <span className={`seal ${live ? (allOk ? 'seal-ok' : 'seal-bad') : ''}`}><Icon name="seal" size={16} />{live ? (allOk ? 'Seal verified in your browser' : 'Check failed') : err ? 'Unavailable' : 'Checking…'}</span>
    </header>
    <ul className="checks">
      {(live?.checks ?? []).map((c) => <li key={c.key} className={c.ok ? 'ok' : 'bad'}><Icon name={c.ok ? 'check' : 'x'} size={16} /><div><b>{c.label}</b><span>{c.detail}</span></div></li>)}
      {!live && !err && [0, 1, 2, 3, 4].map((i) => <li key={i} className="pending"><i className="pulse" /><div><b>Re-checking</b><span>fetching the attestation from OutLayer</span></div></li>)}
      <li className={o.attestation.checks.intel_signature_chain ? 'ok' : 'bad'}><Icon name={o.attestation.checks.intel_signature_chain ? 'check' : 'x'} size={16} /><div><b>Intel signature chain</b><span>recorded by <code>verify-attestation.mjs</code> (dcap-qvl): TCB {o.attestation.tcb.status ?? o.attestation.tcb.error}</span></div></li>
    </ul>
    {err && <p className="sheet-err" role="alert">Live check failed: {err}</p>}
    <dl className="kv">
      <div><dt>Counted</dt><dd>{res.count}</dd></div>
      <div><dt>Transaction</dt><dd><a href={txUrl(run.tx)} target="_blank" rel="noreferrer" className="mono">{short(run.tx, 8, 6)}</a></dd></div>
      <div><dt>TDX quote</dt><dd className="mono">{live ? `${live.quoteBytes} bytes` : '…'}</dd></div>
      <div><dt>Report data</dt><dd className="mono">{short(o.attestation.report_data, 14, 8)}</dd></div>
      <div><dt>RTMR3 (app)</dt><dd className="mono">{short(o.attestation.measurements.rtmr3, 14, 8)}</dd></div>
      <div><dt>Raw record</dt><dd><a href={o.attestation.source} target="_blank" rel="noreferrer">OutLayer API <Icon name="external" size={12} /></a></dd></div>
    </dl>
  </article>;
}

function Transcript({ m }: { m: Market }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [cursor, setCursor] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pinned = m.source_url.endsWith('FOMCpresconf20260128.pdf') && m.result?.transcript_sha256 === PINNED_PDF_SHA;
  useEffect(() => {
    if (!pinned) return;
    fetch('/archive-20260128.txt').then(async (r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); const buf = await r.arrayBuffer(); if ((await sha256Hex(buf)) !== PINNED_TEXT_SHA) throw new Error('extracted text hash mismatch'); setText(new TextDecoder().decode(buf)); }).catch((e) => setErr(String(e.message || e)));
  }, [pinned]);
  const parts = useMemo(() => (text ? splitHits(text, m.phrase) : []), [text, m.phrase]);
  const hits = parts.filter((p) => p.hit).length;
  const ticks = useMemo(() => { let pos = 0; const out: number[] = []; for (const p of parts) { if (p.hit) out.push(pos / (text?.length || 1)); pos += p.text.length; } return out; }, [parts, text]);
  function jump(i: number) {
    const marks = bodyRef.current?.querySelectorAll('mark'); if (!marks?.length) return;
    const n = (i + marks.length) % marks.length; setCursor(n);
    marks.forEach((el, k) => el.classList.toggle('cur', k === n));
    marks[n].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  if (!m.result) return <State kind="empty" title="Transcript not published yet">The Fed posts the press conference PDF after the event. The market can be resolved from its close until the deadline. <a href={m.source_url} target="_blank" rel="noreferrer">Expected source URL</a></State>;
  if (!pinned) return <State kind="setup" title="Transcript text not pinned in this app">Open the official PDF and compare its SHA-256 to <code>{short(m.result.transcript_sha256, 12, 8)}</code>.</State>;
  if (err) return <State kind="error" title="Could not load the transcript text">{err}</State>;
  if (!text) return <State kind="loading" title="Loading the official transcript text…" />;
  return <div className="transcript">
    <div className="transcript-bar">
      <div><p className="label">Official transcript · {fmtDate(eventDate(m)!)} · full text, reporters’ questions included</p>
        <p className="transcript-count"><b>{hits}</b> whole-word hits for <q>{m.phrase}</q> in your browser · <b>{m.result.count}</b> attested by the TEE {hits === m.result.count ? <span className="match"><Icon name="check" size={14} />match</span> : <span className="mismatch">differs</span>}</p></div>
      {hits > 0 && <div className="transcript-nav"><button className="icon-btn" onClick={() => jump(cursor - 1)} aria-label="Previous hit"><Icon name="arrow" /></button><span className="mono">{cursor + 1}/{hits}</span><button className="icon-btn" onClick={() => jump(cursor + 1)} aria-label="Next hit"><Icon name="arrow" /></button></div>}
    </div>
    <div className="transcript-wrap">
      <div className="paper-text" ref={bodyRef} tabIndex={0} aria-label="Transcript text">{parts.map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <span key={i}>{p.text}</span>))}</div>
      <div className="rail" aria-hidden="true">{ticks.map((t, i) => <i key={i} style={{ top: `${t * 100}%` }} />)}</div>
    </div>
    <p className="transcript-foot mono">Text extracted from PDF {short(PINNED_PDF_SHA, 10, 6)} with the oracle’s own extractor (lopdf), pinned at SHA-256 {short(PINNED_TEXT_SHA, 10, 6)}. <a href={m.source_url} target="_blank" rel="noreferrer">Official PDF <Icon name="external" size={12} /></a></p>
  </div>;
}

export default function MarketPage({ id, wallet }: { id: string; wallet: Wallet }) {
  const [m, setM] = useState<Market | null | undefined>(undefined);
  const [side, setSide] = useState<boolean | null>(null);
  const [err, setErr] = useState('');
  const now = useNow();
  useEffect(() => { getMarket(id).then(setM).catch((e) => setErr(String(e.message || e))); }, [id]);
  if (err) return <div className="page"><State kind="error" title="Could not read this market">{err}</State></div>;
  if (m === undefined) return <div className="page"><State kind="loading" title="Reading the market from NEAR testnet…" /></div>;
  if (m === null) return <div className="page"><State kind="empty" title={`No market called ${id}`} action={<Link to="/app" className="btn btn-ghost btn-sm">Back to the board</Link>} /></div>;
  const runs = runsFor(m.id);
  const res = outcome(m);
  const open = m.status === 'Open' && m.close_ns / 1e6 > now;
  return <div className="page market">
    <Link to={m.status === 'Open' ? '/app' : '/resolved'} className="back"><Icon name="chevL" size={16} /> {m.status === 'Open' ? 'Board' : 'Resolved'}</Link>
    <header className="market-head">
      <div>
        <span className="chip-src"><i className="dot-fed" />{m.event.replace('FOMC press conference', 'Fed press conference')}</span>
        <h1>Will they say <q>{m.phrase}</q>{m.threshold > 1 ? <> at least {m.threshold} times</> : ''}?</h1>
        <p className="market-meta mono">{m.id} · creator {m.creator} · {m.status}</p>
      </div>
      <div className={`verdict ${m.result ? 'verdict-res' : ''}`}>
        {m.result ? <><span className="verdict-n">{m.result.count}</span><span className="verdict-l">hits · needed {m.threshold}</span><span className={`stamp stamp-big stamp-${res!.toLowerCase()}`}>{res}</span></>
          : open ? <><span className="label">Bets close in</span><Countdown target={m.close_ns / 1e6} now={now} /><SplitBar m={m} label={<>“{m.phrase}”</>} /><div className="yn yn-wide"><button className="yn-yes" onClick={() => setSide(true)}><Icon name="arrowUp" size={15} />Yes {pct(yesPrice(m))}</button><button className="yn-no" onClick={() => setSide(false)}><Icon name="arrowDown" size={15} />No {pct(1 - yesPrice(m))}</button></div></>
          : <span className="label">Closed · awaiting resolution</span>}
      </div>
    </header>

    {m.result && <section className="hashes">
      <div><span className="label">Transcript SHA-256 (on-chain)</span><code>{m.result.transcript_sha256}</code><Copy value={m.result.transcript_sha256} label="transcript hash" /></div>
      <div><span className="label">Program SHA-256 (pinned at deploy)</span><code>{m.result.code_hash}</code><Copy value={m.result.code_hash} label="program hash" /></div>
      <div><span className="label">Source</span><a href={m.source_url} target="_blank" rel="noreferrer">{m.source_url.replace('https://', '')} <Icon name="external" size={12} /></a></div>
    </section>}

    {runs.length > 0 && <section className="runs">
      <header className="board-head"><h2>The seal</h2><span className="mono dim">{runs.length === 2 ? 'resolved, then challenged and re-run with the same result' : 'one attested run'}</span></header>
      <div className="runs-grid">{runs.map((r, i) => <RunCard key={r.tx} run={r} label={r.method === 'challenge' ? 'Challenge re-run' : i === 0 ? 'Resolution' : 'Run'} />)}</div>
    </section>}

    <section className="board-sec"><header className="board-head"><h2>Every counted word</h2></header><Transcript m={m} /></section>
    {side !== null && <BetSheet m={m} side={side} wallet={wallet} onClose={() => setSide(null)} />}
  </div>;
}
