import { useMemo, useState } from 'react';
import { Boundary, Icon, Link, Obj, Problem, State, useBalance, useMarkets, useMounted, useNow } from './ui';
import { accountUrl, eventDate, fmtDate, near, outcome, subsidy, type Market } from './lib';
import { upfrontYocto } from './errors';
import { refreshMarkets } from './store';
import { runTx, type TxStage } from './tx';
import type { Wallet } from './wallet';

const CREATE_TGAS = 50;
function Composer({ wallet, markets }: { wallet: Wallet; markets: Market[] | null }) {
  const now = useNow(30_000);
  const [date, setDate] = useState('2026-12-09');
  const [phrase, setPhrase] = useState('');
  const [rawThreshold, setThreshold] = useState('1');
  const [rawB, setB] = useState('100');
  const [stage, setStage] = useState<TxStage | null>(null);
  const mounted = useMounted();
  const { yocto: spendable } = useBalance(wallet.account);
  const day = date.replaceAll('-', '');
  const threshold = /^\d+$/.test(rawThreshold) ? Number(rawThreshold) : NaN;
  const b = /^\d+$/.test(rawB) ? Number(rawB) : NaN;
  const p = phrase.trim().toLowerCase();
  const id = `fomc-${date.slice(0, 7)}-${p.replace(/\s+/g, '-')}${threshold > 1 ? `-${threshold}` : ''}`;
  // FOMC press conferences start 2:30 p.m. Eastern; close five minutes before (EST Nov–Mar, EDT otherwise).
  const month = Number(date.slice(5, 7));
  const closeMs = Date.UTC(Number(date.slice(0, 4)), month - 1, Number(date.slice(8, 10)), month >= 11 || month <= 3 ? 19 : 18, 25);
  const seed = Number.isFinite(b) ? subsidy(b) : 0;
  const seedYocto = BigInt(Math.round(seed * 1000)) * 10n ** 21n;
  // Inline checks mirror the contract's own require! rules, so a bad market is caught before the wallet opens.
  const errs = {
    date: !/^\d{4}-\d{2}-\d{2}$/.test(date) ? 'Pick a date' : closeMs <= now ? 'That press conference has already started; pick an upcoming date' : null,
    phrase: phrase === '' ? null : !/^[a-z]+( [a-z]+)*$/.test(p) ? 'Letters and single spaces only' : p.length > 40 ? 'Up to 40 characters' : null,
    threshold: !Number.isInteger(threshold) || threshold < 1 ? 'A whole number, 1 or more' : null,
    b: !Number.isInteger(b) || b < 100 || b > 100_000 ? 'Between 100 and 100,000' : null,
    id: !p ? null : id.length > 64 ? 'This makes the market id longer than 64 characters; shorten the phrase' : markets?.some((m) => m.id === id) ? `${id} already exists. Change the word, date or count.` : null,
  };
  const need = upfrontYocto(seedYocto, CREATE_TGAS);
  const broke = wallet.account && spendable !== null && spendable < need ? `You have ${near(spendable)}; opening this market needs ${near(need)} with gas.` : null;
  const reason = !p ? 'Type a word or phrase' : errs.date ?? errs.phrase ?? errs.threshold ?? errs.b ?? errs.id ?? (wallet.network?.title || null) ?? broke;
  const busy = stage?.step === 'checking' || stage?.step === 'signing' || stage?.step === 'pending';
  async function create() {
    await runTx(wallet, {
      method: 'create_market', label: `Open “${p}” on ${date}`, tgas: CREATE_TGAS, depositYocto: seedYocto, onStage: setStage, inline: () => mounted.current,
      args: { id, event: `FOMC press conference · ${date}`, source_url: `https://www.federalreserve.gov/mediacenter/files/FOMCpresconf${day}.pdf`, phrase: p, threshold, close_ns: closeMs * 1e6, deadline_ns: (closeMs + 7 * 86_400_000) * 1e6, b },
    });
  }
  const field = (k: keyof typeof errs) => errs[k] ? <small className="field-err" id={`err-${k}`}>{errs[k]}</small> : null;
  return <div className="composer">
    <p className="label">Open a market</p>
    <h3>Pick a word for a press conference.</h3>
    <div className="fields">
      <label className="field"><span>Press conference date</span><input type="date" value={date} onChange={(e) => { setDate(e.target.value); setStage(null); }} aria-invalid={!!errs.date} aria-describedby={errs.date ? 'err-date' : undefined} />{field('date')}</label>
      <label className="field"><span>Word or phrase</span><input value={phrase} placeholder="soft landing" maxLength={41} onChange={(e) => { setPhrase(e.target.value); setStage(null); }} aria-invalid={!!errs.phrase || !!errs.id} aria-describedby={errs.phrase ? 'err-phrase' : errs.id ? 'err-id' : undefined} />{field('phrase')}</label>
      <label className="field"><span>Said at least</span><input inputMode="numeric" value={rawThreshold} onChange={(e) => { setThreshold(e.target.value.trim()); setStage(null); }} aria-invalid={!!errs.threshold} aria-describedby={errs.threshold ? 'err-threshold' : undefined} />{field('threshold')}</label>
      <label className="field"><span>Liquidity b</span><input inputMode="numeric" value={rawB} onChange={(e) => { setB(e.target.value.trim()); setStage(null); }} aria-invalid={!!errs.b} aria-describedby={errs.b ? 'err-b' : undefined} />{field('b')}</label>
    </div>
    {errs.id && <p className="field-err" id="err-id">{errs.id}</p>}
    <dl className="receipt">
      <div><dt>Market id</dt><dd className="mono">{p ? id : '—'}</dd></div>
      <div><dt>Source</dt><dd className="mono">FOMCpresconf{day}.pdf</dd></div>
      <div><dt>Bets close</dt><dd>{Number.isFinite(closeMs) ? new Date(closeMs).toUTCString().replace(':00 GMT', ' UTC') : '—'}</dd></div>
      <div><dt>Subsidy you seed (b·ln2, worst-case loss)</dt><dd>{errs.b ? '—' : near(seed)}</dd></div>
      <div><dt>You earn</dt><dd>1% of every trade, paid on-chain</dd></div>
    </dl>
    {stage?.step === 'failed' && stage.problem && <Problem x={stage.problem} onRetry={stage.problem.retry ? create : undefined} />}
    {stage?.step === 'confirmed' && <p className="why ok" role="status"><Icon name="check" size={14} />Market opened. <Link to={`/market/${id}`}>Open {id}</Link></p>}
    {wallet.account ? <button className="btn btn-coral btn-block" disabled={!!reason || busy} onClick={create}>{stage?.step === 'signing' ? 'Approve in Meteor Wallet…' : stage?.step === 'pending' ? 'Waiting for NEAR testnet…' : stage?.step === 'checking' ? 'Checking balance…' : `Open market as ${wallet.account}`}</button>
      : <button className="btn btn-coral btn-block" onClick={wallet.connect} disabled={!wallet.ready || wallet.connecting}>{wallet.connecting ? 'Waiting for Meteor Wallet…' : 'Connect a NEAR testnet wallet'}</button>}
    {wallet.account && reason && <p className="why" role="status"><Icon name="clock" size={14} />{reason}</p>}
    <p className="sheet-note">Sources are limited to federalreserve.gov press conference PDFs, the only free transcript feed we could verify. Podcast and stream transcripts are not supported yet.</p>
  </div>;
}

export default function Creators({ wallet }: { wallet: Wallet }) {
  const { markets, problem } = useMarkets();
  const byCreator = useMemo(() => {
    const map = new Map<string, Market[]>();
    for (const m of markets ?? []) map.set(m.creator, [...(map.get(m.creator) ?? []), m]);
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [markets]);
  return <div className="page creators">
    <header className="page-head page-head-art">
      <div>
        <h1>Open the market.<br /><span className="dim">Keep 1% of every trade.</span></h1>
        <p className="lead">Anyone can open a word market on a Fed press conference by seeding the LMSR subsidy. Creators earn a 1% fee on every buy, paid to their account the moment the trade lands.</p>
      </div>
      <Obj name="mic" size={168} className="head-obj" />
    </header>
    <div className="creators-grid">
      <section>
        {problem && !markets ? <Problem x={problem} onRetry={() => refreshMarkets()} />
          : !markets ? <State kind="loading" title="Reading creators from the contract…" />
          : byCreator.length === 0 ? <State kind="empty" art="quiet" title="No creator markets yet" />
          : byCreator.map(([creator, list]) => <article key={creator} className="creator">
            <header><span className="avatar" aria-hidden="true">{creator[0].toUpperCase()}</span><div><a href={accountUrl(creator)} target="_blank" rel="noreferrer" className="mono">{creator}</a><span className="dim">{list.length} markets · {list.reduce((n, m) => n + m.yes + m.no, 0)} shares traded</span></div></header>
            <ul>{list.map((m) => <li key={m.id}><Link to={`/market/${m.id}`}><q>{m.phrase}</q>{m.threshold > 1 && <span className="dim"> ≥{m.threshold}</span>}<span className="dim"> · FOMC {eventDate(m) ? fmtDate(eventDate(m)!) : ''}</span></Link><span className={`chip chip-${(outcome(m) ?? m.status).toLowerCase()}`}>{outcome(m) ?? m.status}</span></li>)}</ul>
          </article>)}
      </section>
      <Boundary label="Market composer"><Composer wallet={wallet} markets={markets} /></Boundary>
    </div>
    <p className="footnote"><Icon name="mic" size={14} /> The standard Fed markets (recession, inflation, tariffs, employment) are opened by the scheduler from the official FOMC calendar, signed by the factory account.</p>
  </div>;
}
