import { useEffect, useState } from 'react';

type OracleOutput = { count: number; transcript_sha256: string; source_url: string; code_hash: string; attestation: string };
type Market = { id: string; event: string; source_url: string; phrase: string; threshold: number; close_ns: number; deadline_ns: number; b: number; yes: number; no: number; creator: string; status: 'Open' | 'Provisional' | 'Final'; result: OracleOutput | null; challenge_until_ns: number | null; pending: boolean };
const contract = import.meta.env.VITE_NEAR_TESTNET_CONTRACT as string | undefined;
const rpc = (import.meta.env.VITE_NEAR_TESTNET_RPC as string | undefined) || 'https://test.rpc.fastnear.com';
const fedCalendar = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
function odds(m: Market) { const p = 1 / (1 + Math.exp((m.no - m.yes) / m.b)); return Math.round(p * 100); }
function until(ns: number, now: number) { const sec = Math.max(0, Math.floor(ns / 1e9 - now / 1000)); const days = Math.floor(sec / 86400); const hours = Math.floor((sec % 86400) / 3600); return sec ? `${days}d ${hours}h` : 'Closed'; }
function highlight(text: string, phrase: string) {
  const parts: { text: string; hit: boolean }[] = [];
  const normalized = text.toLowerCase();
  const needle = phrase.toLowerCase();
  let start = 0;
  for (let index = normalized.indexOf(needle); index >= 0; index = normalized.indexOf(needle, index + needle.length)) {
    const before = index === 0 || !/[a-z0-9]/i.test(text[index - 1]);
    const end = index + needle.length;
    const after = end === text.length || !/[a-z0-9]/i.test(text[end]);
    if (!before || !after) continue;
    parts.push({ text: text.slice(start, index), hit: false }, { text: text.slice(index, end), hit: true });
    start = end;
  }
  parts.push({ text: text.slice(start), hit: false });
  return parts;
}
async function viewQuote(market: Market, yes: boolean, quantity: number): Promise<string> {
  const args = btoa(JSON.stringify({ id: market.id, yes, quantity }));
  const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba-quote', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: 'quote', args_base64: args } }) });
  if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'NEAR RPC rejected quote');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result)));
}
function nearAmount(yocto: string) { return `${(Number(BigInt(yocto) / 10n ** 21n) / 1000).toFixed(3)} NEAR`; }
async function loadMarkets(): Promise<Market[]> {
  const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'kotoba', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: contract, method_name: 'list_markets', args_base64: 'e30=' } }) });
  if (!response.ok) throw new Error(`NEAR RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'NEAR RPC rejected the request');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(body.result.result)));
}
export default function App() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(contract));
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState<Market | null>(null);
  const [side, setSide] = useState(true);
  const [quantity, setQuantity] = useState(10);
  const [quote, setQuote] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [archive, setArchive] = useState('');
  const [archiveError, setArchiveError] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  useEffect(() => { if (!contract) return; loadMarkets().then(setMarkets).catch(e => setError(String(e.message || e))).finally(() => setLoading(false)); }, []);
  useEffect(() => { fetch('/archive-20260128.txt').then(async response => { if (!response.ok) throw new Error(`Archive HTTP ${response.status}`); const data = await response.arrayBuffer(); const digest = await crypto.subtle.digest('SHA-256', data); const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join(''); if (hash !== 'b3a6ffd6c6912f1ff63c04bbb544913eff55917cbbb57fab17d317d28ff706f1') throw new Error('Archive text hash mismatch'); setArchive(new TextDecoder().decode(data)); }).catch(e => setArchiveError(String(e.message || e))); }, []);
  useEffect(() => {
    if (!selected || selected.status !== 'Open' || selected.close_ns <= Date.now() || !Number.isInteger(quantity) || quantity <= 0 || quantity > 100_000) { setQuote(''); return; }
    let active = true;
    setQuote(''); setQuoteError('');
    viewQuote(selected, side, quantity).then(value => { if (active) setQuote(value); }).catch(e => { if (active) setQuoteError(String(e.message || e)); });
    return () => { active = false; };
  }, [selected, side, quantity]);
  return <>
    <header className="site-header"><a className="wordmark" href="#top" aria-label="Kotoba home"><span className="mark">言</span><span>KOTOBA<span className="wordmark-dot">.</span></span></a><nav><a href="#markets">Markets</a><a href="#how">How it settles</a><a href="#source">Sources</a></nav><div className="network"><span className="network-dot"/> NEAR TESTNET</div></header>
    <main id="top">
      <section className="hero"><div className="hero-copy"><p className="eyebrow">WORDS / ODDS / PROOF</p><h1>What will<br/>they <em>say?</em></h1><p className="hero-lead">Take a position on the words that shape the news. When the official transcript arrives, the result is settled by verifiable code.</p><a className="primary-link" href="#markets">Explore markets <span>↗</span></a><div className="hero-meta"><span>01 / Public events</span><span>02 / Official transcripts</span><span>03 / On-chain settlement</span></div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="quote-glyph">“</div><div className="floating-word">RECESSION<span>?</span></div><div className="art-caption">SPEECH BECOMES SIGNAL</div></div></section>
      <section className="market-section" id="markets"><div className="section-head"><div><p className="eyebrow">01 / THE BOARD</p><h2>Markets in motion<span className="accent">.</span></h2></div><a className="subtle-link" href={fedCalendar} target="_blank" rel="noreferrer">View Fed calendar ↗</a></div>
        {!contract ? <div className="state-card"><span className="state-icon">◇</span><h3>Setup required: VITE_NEAR_TESTNET_CONTRACT</h3><p>Set the deployed testnet contract account in <code>packages/web/.env</code> to load live markets. No odds are shown until the chain responds.</p></div> : loading ? <div className="state-card"><h3>Reading NEAR testnet…</h3><p>Fetching market state from {contract}.</p></div> : error ? <div className="state-card error"><h3>Could not load markets</h3><p>{error}</p><button onClick={() => { setLoading(true); setError(''); loadMarkets().then(setMarkets).catch(e => setError(String(e.message || e))).finally(() => setLoading(false)); }}>Retry</button></div> : markets.length === 0 ? <div className="state-card"><span className="state-icon">○</span><h3>No markets yet</h3><p>The deployed contract has no markets. A creator can open one with a seeded subsidy before the event begins.</p></div> : <div className="market-grid">{markets.map(m => <article className="market-card" key={m.id}><div className="market-top"><span className="pill">{m.status}</span><span className="card-index">{m.id}</span></div><h3>Will the transcript say <em>“{m.phrase}”</em> at least {m.threshold} {m.threshold === 1 ? 'time' : 'times'}?</h3><p className="event-name">{m.event}</p><div className="odds"><div><span className="odds-value">{odds(m)}%</span><span>YES</span></div><div><span className="odds-value">{100 - odds(m)}%</span><span>NO</span></div></div><div className="card-foot"><span>{m.status === 'Open' ? `Closes in ${until(m.close_ns, now)}` : m.status === 'Final' ? 'Resolved' : 'Challenge window'}</span><button onClick={() => setSelected(m)}>Inspect ↗</button></div></article>)}</div>}
      </section>
      <section className="mechanism" id="how"><div className="section-head"><div><p className="eyebrow">02 / THE MECHANISM</p><h2>No referee in the room<span className="accent">.</span></h2></div></div><div className="steps"><div><span className="step-number">01</span><h3>Take a side</h3><p>A seeded LMSR curve gives every open market a YES and NO price. The quote comes from contract state.</p></div><div><span className="step-number">02</span><h3>Read the source</h3><p>The official transcript is fetched by hash-pinned code in OutLayer’s TEE. Its SHA-256 becomes part of the result.</p></div><div><span className="step-number">03</span><h3>Challenge the result</h3><p>Anyone can pay a bond to rerun the same program during the challenge window. The rerun decides the final result.</p></div></div></section>
      <section className="source-section" id="source"><p className="eyebrow">03 / THE RECORD</p><h2>Trace every word<span className="accent">.</span></h2><p>This archive uses the official January 28, 2026 Fed PDF. Its PDF SHA-256 is <code>2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3</code>. The pinned oracle extraction contains 40 whole-word matches for “inflation.”</p><a href="https://www.federalreserve.gov/mediacenter/files/FOMCpresconf20260128.pdf" target="_blank" rel="noreferrer">Open official PDF ↗</a><div className="heatmap"><div className="heatmap-head"><strong>INFLATION / 40 HITS</strong><span>FINAL TRANSCRIPT · 2026-01-28</span></div>{archiveError ? <p>Archive error: {archiveError}</p> : archive ? <pre>{highlight(archive, 'inflation').map((part, index) => part.hit ? <mark key={index}>{part.text}</mark> : part.text)}</pre> : <p>Loading the pinned transcript…</p>}</div></section>
    </main><footer><div className="wordmark"><span className="mark">言</span>KOTOBA<span className="wordmark-dot">.</span></div><p>Built for NEAR testnet. Source records remain public.</p><span>2026</span></footer>
    {selected && <div className="sheet-backdrop" onClick={() => setSelected(null)}><aside className="sheet" role="dialog" aria-modal="true" aria-label="Market details" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button><p className="eyebrow">MARKET / {selected.id}</p><h2>{selected.event}</h2><p className="sheet-prompt">“{selected.phrase}” · at least {selected.threshold} time(s)</p><dl><div><dt>Status</dt><dd>{selected.status}</dd></div><div><dt>YES price</dt><dd>{odds(selected)}%</dd></div><div><dt>NO price</dt><dd>{100 - odds(selected)}%</dd></div><div><dt>Closes</dt><dd>{new Date(selected.close_ns / 1e6).toLocaleString()}</dd></div></dl><a className="source-link" href={selected.source_url} target="_blank" rel="noreferrer">Official source PDF ↗</a>{selected.result ? <div className="result"><h3>Transcript result</h3><p>Count: {selected.result.count}</p><p>SHA-256: <code>{selected.result.transcript_sha256}</code></p><p>Code hash: <code>{selected.result.code_hash}</code></p><p>Attestation: <code>{selected.result.attestation || 'Independent attestation reference pending'}</code></p>{selected.source_url.endsWith('FOMCpresconf20260128.pdf') && selected.result.transcript_sha256 === '2c2683d9d1f08b06668c0cf3257918e68dd748ef7a804dd14094e6e2c3e35cd3' && archive && <div className="result-heatmap"><strong>Hash-matched transcript · {selected.phrase}</strong><pre>{highlight(archive, selected.phrase).map((part, index) => part.hit ? <mark key={index}>{part.text}</mark> : part.text)}</pre></div>}</div> : <p className="setup-note">The transcript has not been resolved yet.</p>}{selected.status === 'Open' && selected.close_ns > now && <div className="bet-sheet"><h3>Position preview</h3><div className="side-picker"><button className={side ? 'active' : ''} onClick={() => setSide(true)}>YES</button><button className={!side ? 'active' : ''} onClick={() => setSide(false)}>NO</button></div><label>Shares <input type="number" min="1" max="100000" step="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))}/></label><p>{quoteError ? `Quote error: ${quoteError}` : quote ? `Contract quote: ${nearAmount(quote)}` : 'Reading contract quote…'}</p><button className="bet-disabled" disabled>Setup required: email sign-in and NEP-366 relayer</button></div>}{selected.status !== 'Open' && <div className="setup-note">Browser claiming requires email sign-in and a NEP-366 relayer.</div>}</aside></div>}
  </>;
}
