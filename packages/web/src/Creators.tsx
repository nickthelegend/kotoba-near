import { useMemo, useState } from 'react';
import { Icon, Link, State, useMarkets } from './ui';
import { accountUrl, eventDate, fmtDate, outcome, subsidy, type Market } from './lib';
import type { Wallet } from './wallet';

function Composer({ wallet }: { wallet: Wallet }) {
  const [date, setDate] = useState('2026-12-09');
  const [phrase, setPhrase] = useState('');
  const [threshold, setThreshold] = useState(1);
  const [b, setB] = useState(100);
  const [err, setErr] = useState('');
  const day = date.replaceAll('-', '');
  const id = `fomc-${date.slice(0, 7)}-${phrase.trim().toLowerCase().replace(/\s+/g, '-')}${threshold > 1 ? `-${threshold}` : ''}`;
  const phraseOk = /^[a-z]+( [a-z]+)*$/i.test(phrase.trim()) && phrase.trim().length <= 40;
  const idOk = id.length <= 64;
  // FOMC press conferences start 2:30 p.m. Eastern; close five minutes before (EST Nov–Mar, EDT otherwise).
  const month = Number(date.slice(5, 7));
  const closeMs = Date.UTC(Number(date.slice(0, 4)), month - 1, Number(date.slice(8, 10)), month >= 11 || month <= 3 ? 19 : 18, 25);
  const seed = subsidy(b);
  async function create() {
    setErr('');
    try {
      await wallet.callContract('create_market', { id, event: `FOMC press conference · ${date}`, source_url: `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${day}.pdf`, phrase: phrase.trim().toLowerCase(), threshold, close_ns: closeMs * 1e6, deadline_ns: (closeMs + 7 * 86_400_000) * 1e6, b }, (BigInt(Math.round(seed * 1000)) * 10n ** 21n).toString(), 50);
    } catch (e) { setErr(String((e as Error).message || e)); }
  }
  return <div className="composer">
    <p className="label">Open a market</p>
    <h3>Pick a word for a press conference.</h3>
    <div className="fields">
      <label className="field"><span>Press conference date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="field"><span>Word or phrase</span><input value={phrase} placeholder="soft landing" maxLength={40} onChange={(e) => setPhrase(e.target.value)} aria-invalid={phrase !== '' && !phraseOk} /></label>
      <label className="field"><span>Said at least</span><input inputMode="numeric" value={threshold} onChange={(e) => setThreshold(Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1))} /></label>
      <label className="field"><span>Liquidity b</span><input inputMode="numeric" value={b} onChange={(e) => setB(Math.min(100_000, Number(e.target.value.replace(/\D/g, '')) || 0))} aria-invalid={b < 100} /></label>
    </div>
    <dl className="receipt">
      <div><dt>Market id</dt><dd className="mono">{phrase ? id : '—'}</dd></div>
      <div><dt>Source</dt><dd className="mono">FOMCpresconf{day}.pdf</dd></div>
      <div><dt>Bets close</dt><dd>{new Date(closeMs).toUTCString().replace(':00 GMT', ' UTC')}</dd></div>
      <div><dt>Subsidy you seed (b·ln2, worst-case loss)</dt><dd>{b >= 100 ? `${seed.toFixed(3)} NEAR` : 'b must be ≥ 100'}</dd></div>
      <div><dt>You earn</dt><dd>1% of every trade, paid on-chain</dd></div>
    </dl>
    {phrase !== '' && !phraseOk && <p className="sheet-err">Letters and single spaces only, up to 40 characters. The oracle counts whole words, ignoring case.</p>}
    {err && <p className="sheet-err" role="alert">{err}</p>}
    {wallet.account ? <button className="btn btn-coral btn-block" disabled={!phraseOk || !idOk || b < 100} onClick={create}>Open market as {wallet.account}</button>
      : <button className="btn btn-coral btn-block" onClick={wallet.connect} disabled={!wallet.ready}>Connect a NEAR testnet wallet</button>}
    <p className="sheet-note">Sources are limited to federalreserve.gov press conference PDFs, the only free transcript feed we could verify. Podcast and stream transcripts are not supported yet.</p>
  </div>;
}

export default function Creators({ wallet }: { wallet: Wallet }) {
  const { markets, error } = useMarkets();
  const byCreator = useMemo(() => {
    const map = new Map<string, Market[]>();
    for (const m of markets ?? []) map.set(m.creator, [...(map.get(m.creator) ?? []), m]);
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [markets]);
  return <div className="page creators">
    <header className="page-head">
            <h1>Open the market.<br /><span className="dim">Keep 1% of every trade.</span></h1>
      <p className="lead">Anyone can open a word market on a Fed press conference by seeding the LMSR subsidy. Creators earn a 1% fee on every buy, paid to their account the moment the trade lands.</p>
    </header>
    <div className="creators-grid">
      <section>
        {error ? <State kind="error" title="Could not read the contract">{error}</State>
          : !markets ? <State kind="loading" title="Reading creators from the contract…" />
          : byCreator.length === 0 ? <State kind="empty" title="No creator markets yet" />
          : byCreator.map(([creator, list]) => <article key={creator} className="creator">
            <header><span className="avatar" aria-hidden="true">{creator[0].toUpperCase()}</span><div><a href={accountUrl(creator)} target="_blank" rel="noreferrer" className="mono">{creator}</a><span className="dim">{list.length} markets · {list.reduce((n, m) => n + m.yes + m.no, 0)} shares traded</span></div></header>
            <ul>{list.map((m) => <li key={m.id}><Link to={`/market/${m.id}`}><q>{m.phrase}</q>{m.threshold > 1 && <span className="dim"> ≥{m.threshold}</span>}<span className="dim"> · FOMC {eventDate(m) ? fmtDate(eventDate(m)!) : ''}</span></Link><span className={`chip chip-${(outcome(m) ?? m.status).toLowerCase()}`}>{outcome(m) ?? m.status}</span></li>)}</ul>
          </article>)}
      </section>
      <Composer wallet={wallet} />
    </div>
    <p className="footnote"><Icon name="mic" size={14} /> The standard Fed markets (recession, inflation, tariffs, employment) are opened by the scheduler from the official FOMC calendar, signed by the factory account.</p>
  </div>;
}
