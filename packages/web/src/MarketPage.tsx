import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Boundary, Copy, Countdown, Icon, Link, Obj, Problem, SplitBar, State, useMarkets, useMounted, useNow } from './ui';
import { CONTRACT, DEPLOYMENT, JUDGE_DEMO, OUTLAYER_API, PINNED_PDF_SHA, PINNED_TEXT_SHA, UNIT_NEAR, batchBalance, near, eventDate, fmtDate, outcome, runsFor, sha256Hex, short, splitHits, txUrl, pct, yesPrice, type Market, type Step } from './lib';
import { explain, type Explained } from './errors';
import { CHAIN_CHANGED, refreshMarkets } from './store';
import { runTx, type TxStage } from './tx';
import { verifyLive, type LiveVerification } from './verify';
import { BetSheet } from './Trade';
import { WALLET, type Wallet } from './wallet';
import { discoverResolutionRuns, type DiscoveredRun } from './discovery.mjs';

function RunCard({ run, label }: { run: Step | DiscoveredRun; label: string }) {
  const o = run.outlayer!;
  const recorded = o.attestation;
  const [live, setLive] = useState<LiveVerification | null>(null);
  const [err, setErr] = useState<Explained | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setErr(null); verifyLive(run.tx, o.input, o.output, DEPLOYMENT.oracle_sha256).then(setLive).catch((e) => setErr(explain(e))); }, [run.tx, o.input, o.output, attempt]);
  const res = JSON.parse(o.output) as { count: number };
  const allOk = live?.checks.every((c) => c.ok);
  return <article className="run">
    <header className="run-head">
      <div><p className="label">{label}</p><h3>{recorded || live ? `OutLayer request #${recorded?.request_id ?? live?.requestId}` : 'Live OutLayer execution'}</h3></div>
      <span className={`seal ${live ? (allOk ? 'seal-ok' : 'seal-bad') : ''}`}><Icon name="seal" size={16} />{live ? (allOk ? 'Seal verified in your browser' : 'Check failed') : err ? 'Unavailable' : 'Checking…'}</span>
    </header>
    <ul className="checks">
      {(live?.checks ?? []).map((c) => <li key={c.key} className={c.ok ? 'ok' : 'bad'}><Icon name={c.ok ? 'check' : 'x'} size={16} /><div><b>{c.label}</b><span>{c.detail}</span></div></li>)}
      {!live && !err && [0, 1, 2, 3, 4].map((i) => <li key={i} className="pending"><i className="pulse" /><div><b>Re-checking</b><span>fetching the attestation from OutLayer</span></div></li>)}
      {recorded ? <li className={recorded.checks.intel_signature_chain ? 'ok' : 'bad'}><Icon name={recorded.checks.intel_signature_chain ? 'check' : 'x'} size={16} /><div><b>Intel signature chain</b><span>recorded by <code>verify-attestation.mjs</code> (dcap-qvl): TCB {recorded.tcb.status ?? recorded.tcb.error}</span></div></li>
        : <li><Icon name="book" size={16} /><div><b>Intel signature chain</b><span>check with the SDK: <code>{`node packages/sdk/scripts/verify-attestation.mjs --tx ${run.tx} --sender ${run.signer}`}</code></span></div></li>}
    </ul>
    {err && <Problem x={err} onRetry={() => setAttempt((n) => n + 1)} compact />}
    <dl className="kv">
      <div><dt>Counted</dt><dd>{res.count}</dd></div>
      <div><dt>Transaction</dt><dd><a href={txUrl(run.tx)} target="_blank" rel="noreferrer" className="mono">{short(run.tx, 8, 6)}</a></dd></div>
      <div><dt>TDX quote</dt><dd className="mono">{live ? `${live.quoteBytes} bytes` : '…'}</dd></div>
      <div><dt>Report data</dt><dd className="mono">{short(recorded?.report_data ?? live?.reportData ?? '…', 14, 8)}</dd></div>
      <div><dt>RTMR3 (app)</dt><dd className="mono">{short(recorded?.measurements.rtmr3 ?? live?.rtmr3 ?? '…', 14, 8)}</dd></div>
      <div><dt>Raw record</dt><dd><a href={recorded?.source ?? `${OUTLAYER_API}/attestations/by-tx/${run.tx}`} target="_blank" rel="noreferrer">OutLayer API <Icon name="external" size={12} /></a></dd></div>
    </dl>
  </article>;
}

function DiscoveredSeal({ market }: { market: Market }) {
  const [runs, setRuns] = useState<DiscoveredRun[] | null>(null);
  const [problem, setProblem] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; setRuns(null); setProblem('');
    discoverResolutionRuns({ contract: CONTRACT, marketId: market.id }).then(r => { if (active) setRuns(r); }).catch(() => { if (active) setProblem('Public resolve or challenge receipts are not available yet. Retry in a moment.'); });
    return () => { active = false; };
  }, [market.id, market.status, market.result?.count, market.result?.transcript_sha256, attempt]);
  return <section className="runs">
    <header className="board-head"><h2 className="h-obj"><Obj name="seal" size={44} still />The seal</h2><span className="mono dim">live public transaction lookup</span></header>
    {problem ? <State kind="setup" title="Seal lookup unavailable" action={<button className="pill-light" onClick={() => setAttempt(n => n + 1)}>Try again</button>}>{problem}</State>
      : !runs ? <State kind="loading" title="Finding resolve and challenge transactions…" />
      : <div className="runs-grid">{runs.map(r => <Boundary key={r.tx} label="Attestation check"><RunCard run={r} label={r.method === 'challenge' ? 'Challenge re-run' : 'Resolution'} /></Boundary>)}</div>}
  </section>;
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
  if (!m.result && m.id === JUDGE_DEMO.args.id && m.source_url === JUDGE_DEMO.source_check.url) return <State kind="empty" art="transcript" title="Published transcript · replay demo">This uses the published October 28 transcript, not a forecast. A funded testnet wallet can resolve it after bets close and before {new Date(m.deadline_ns / 1e6).toUTCString().replace(':00 GMT', ' UTC')}. <a href={m.source_url} target="_blank" rel="noreferrer">Official published PDF</a></State>;
  if (!m.result) return <State kind="empty" art="transcript" title="Transcript not published yet">The Fed posts the press conference PDF after the event. The market can be resolved from its close until the deadline. <a href={m.source_url} target="_blank" rel="noreferrer">Expected source URL</a></State>;
  if (!pinned) return <State kind="setup" art="magnifier" title="Transcript text not pinned in this app">Open the official PDF and compare its SHA-256 to <code>{short(m.result.transcript_sha256, 12, 8)}</code>.</State>;
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

const BOND_NEAR = 0.12; // 0.1 NEAR bond + 0.02 NEAR for OutLayer (unused is refunded), as in the recorded runs
const milli = (n: number) => BigInt(Math.round(n * 1000)) * 10n ** 21n;
const utc = (ms: number) => new Date(ms).toUTCString().replace(':00 GMT', ' UTC');

/** The settlement step this market is on, and the button that moves it forward (anyone may press it). */
function SettleBox({ m, wallet, now }: { m: Market; wallet: Wallet; now: number }) {
  const [held, setHeld] = useState<{ yes: number; no: number } | null>(null);
  const [stage, setStage] = useState<TxStage | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [method, setMethod] = useState('');
  const mounted = useMounted();
  useEffect(() => { const on = () => setEpoch((n) => n + 1); addEventListener(CHAIN_CHANGED, on); return () => removeEventListener(CHAIN_CHANGED, on); }, []);
  useEffect(() => {
    setHeld(null);
    if (!wallet.account) return;
    let live = true;
    batchBalance(wallet.account, [`${m.id}:YES`, `${m.id}:NO`]).then(([y, n]) => live && setHeld({ yes: Number(y), no: Number(n) })).catch(() => live && setHeld(null));
    return () => { live = false; };
  }, [wallet.account, m.id, m.status, epoch]);
  const busy = stage?.step === 'checking' || stage?.step === 'signing' || stage?.step === 'pending';
  const go = (method: string, deposit: bigint, tgas: number, label: string) => {
    setMethod(method);
    return runTx(wallet, { method, args: { id: m.id }, depositYocto: deposit, tgas, label: `${label} · “${m.phrase}”`, onStage: setStage, inline: () => mounted.current });
  };
  const res = outcome(m);
  const closeMs = m.close_ns / 1e6, deadlineMs = m.deadline_ns / 1e6, windowMs = (m.challenge_until_ns ?? 0) / 1e6;
  let step: ReactNode = null, act: ReactNode = null;
  const btn = (label: string, onClick: () => void, cls = 'pill-ink') => wallet.account
    ? <button className={cls} disabled={busy || !!wallet.network} onClick={onClick}>{busy ? (stage?.step === 'signing' ? `Approve in ${WALLET.name}…` : stage?.step === 'pending' ? 'Waiting for NEAR…' : 'Checking…') : label}</button>
    : <button className="pill-light" onClick={wallet.connect} disabled={!wallet.ready}>Connect to {label.toLowerCase().split(' ')[0]}</button>;
  if (m.pending) step = <><i className="pulse" /> Counting the transcript in the TEE now.</>;
  else if (m.status === 'Open' && now >= closeMs && now <= deadlineMs) {
    step = <>Bets are closed. Anyone can resolve it until {utc(deadlineMs)}.</>;
    act = btn(`Resolve with OutLayer · ${BOND_NEAR} NEAR`, () => go('resolve', milli(BOND_NEAR), 300, 'Resolve'));
  } else if (m.status === 'Open' && now > deadlineMs) {
    const n = (held?.yes ?? 0) + (held?.no ?? 0);
    step = <>No result by the deadline, so every share refunds 0.0005 NEAR.</>;
    if (n > 0) act = btn(`Refund ${near(n * 0.0005)}`, () => go('claim_void', 0n, 30, 'Refund'), 'pill-coral');
  } else if (m.status === 'Provisional') {
    if (now < windowMs) {
      step = <>Provisional {res}. Challenges close in <Countdown target={windowMs} now={now} compact />.</>;
      act = btn(`Challenge · ${BOND_NEAR} NEAR bond`, () => go('challenge', milli(BOND_NEAR), 300, 'Challenge'));
    } else {
      step = <>Challenges are closed. Finalize to lock in {res}.</>;
      act = btn('Finalize', () => go('finalize', 0n, 30, 'Finalize'));
    }
  } else if (m.status === 'Final') {
    const win = held ? (res === 'YES' ? held.yes : held.no) : 0;
    step = <>Settled {res}. Each winning share pays 0.001 NEAR.</>;
    if (wallet.account && held) act = win > 0 ? btn(`Claim ${near(win * UNIT_NEAR)}`, () => go('claim', 0n, 30, 'Claim'), 'pill-coral') : <span className="why">{held.yes + held.no > 0 ? 'Your shares did not win.' : 'You have no shares here.'}</span>;
  }
  if (!step) return null;
  return <div className="settle">
    <p className="settle-step">{step}</p>
    {act}
    {stage?.step === 'failed' && stage.problem && <Problem x={stage.problem} compact />}
    {stage?.step === 'confirmed' && (method === 'claim'
      ? <div className="claimed" role="status"><Obj name="trophy" size={64} /><p><b>Winnings claimed.</b>{stage.tx && <> <a href={txUrl(stage.tx)} target="_blank" rel="noreferrer">View transaction</a></>}</p></div>
      : <p className="why ok" role="status"><Icon name="check" size={14} />Done.{stage.tx && <> <a href={txUrl(stage.tx)} target="_blank" rel="noreferrer">View transaction</a></>}</p>)}
  </div>;
}

export default function MarketPage({ id, wallet }: { id: string; wallet: Wallet }) {
  const { markets, problem, loading } = useMarkets();
  const [side, setSide] = useState<boolean | null>(null);
  const now = useNow();
  const m = markets?.find((x) => x.id === id);
  if (problem && !markets) return <div className="page"><Problem x={problem} onRetry={() => refreshMarkets()} /></div>;
  if (!markets) return <div className="page"><State kind="loading" title="Reading the market from NEAR testnet…" /></div>;
  if (!m) return <div className="page"><State kind="empty" art="quiet" title={`No market called ${id}`} action={<Link to="/app" className="btn btn-ghost btn-sm">Back to the board</Link>}>The Kotoba contract has no market with this id.{loading ? ' Re-checking…' : ''}</State></div>;
  const runs = runsFor(m.id);
  const res = outcome(m);
  const open = m.status === 'Open' && m.close_ns / 1e6 > now;
  return <div className="page market">
    <Link to={m.status === 'Open' ? '/app' : '/resolved'} className="back"><Icon name="chevL" size={16} /> {m.status === 'Open' ? 'Board' : 'Resolved'}</Link>
    <header className="market-head">
      <div>
        <span className="chip-src"><i className="dot-fed" />{m.event.replace('FOMC press conference', 'Fed press conference')}</span>
        <h1>Will they say <q>{m.phrase}</q>{m.threshold > 1 ? <> at least {m.threshold} times</> : ''}?</h1>
        <p className="market-meta mono">{m.id} · creator {m.creator} · {m.pending ? 'Settling' : m.status}</p>
      </div>
      <div className={`verdict ${m.result ? 'verdict-res' : ''}`}>
        {m.result ? <><div className="verdict-top"><Obj name={res === 'YES' ? 'yes' : 'no'} size={80} className="verdict-obj" alt={`${res} token`} /><span className="verdict-n">{m.result.count}</span></div><span className="verdict-l">hits · needed {m.threshold}</span><span className={`stamp stamp-big stamp-${res!.toLowerCase()}`}>{res}</span></>
          : open ? <><span className="label">Bets close in</span><Countdown target={m.close_ns / 1e6} now={now} /><SplitBar m={m} label={<>“{m.phrase}”</>} /><div className="yn yn-wide"><button className="yn-yes" onClick={() => setSide(true)}><Icon name="arrowUp" size={15} />Yes {pct(yesPrice(m))}</button><button className="yn-no" onClick={() => setSide(false)}><Icon name="arrowDown" size={15} />No {pct(1 - yesPrice(m))}</button></div></>
          : <><Obj name={m.pending ? 'abacus' : now > m.deadline_ns / 1e6 ? 'warning' : 'stopwatch'} size={80} className="verdict-obj" /><span className="label">{m.pending ? 'Settling in the TEE' : 'Closed · awaiting resolution'}</span></>}
        <SettleBox m={m} wallet={wallet} now={now} />
      </div>
    </header>
    {m.result && <section className="hashes">
      <div><span className="label">Transcript SHA-256 (on-chain)</span><code>{m.result.transcript_sha256}</code><Copy value={m.result.transcript_sha256} label="transcript hash" /></div>
      <div><span className="label">Program SHA-256 (pinned at deploy)</span><code>{m.result.code_hash}</code><Copy value={m.result.code_hash} label="program hash" /></div>
      <div><span className="label">Source</span><a href={m.source_url} target="_blank" rel="noreferrer">{m.source_url.replace('https://', '')} <Icon name="external" size={12} /></a></div>
    </section>}

    {runs.length > 0 && <section className="runs">
      <header className="board-head"><h2 className="h-obj"><Obj name="seal" size={44} still />The seal</h2><span className="mono dim">{runs.length === 2 ? 'resolved, then challenged and re-run with the same result' : 'one attested run'}</span></header>
      <div className="runs-grid">{runs.map((r, i) => <Boundary key={r.tx} label="Attestation check"><RunCard run={r} label={r.method === 'challenge' ? 'Challenge re-run' : i === 0 ? 'Resolution' : 'Run'} /></Boundary>)}</div>
    </section>}
    {m.result && runs.length === 0 && <DiscoveredSeal market={m} />}

    <section className="board-sec"><header className="board-head"><h2>Every counted word</h2></header><Boundary label="Transcript"><Transcript m={m} /></Boundary></section>
    {side !== null && <BetSheet m={m} side={side} wallet={wallet} onClose={() => setSide(null)} />}
  </div>;
}
